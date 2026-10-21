import { authority, guard, id, insist, now, object, requirePerson, stmt, text, type Actor } from '../core'
import { definition, evaluate, fieldValue, ordered, type Definition, type Image } from './model'
export const FIELD_SNAPSHOT=`SELECT json_object(
 'links',json((SELECT json_group_array(json_object('accountId',account_id,'parentId',parent_id,'kind',kind)) FROM(SELECT * FROM buoy_account_hierarchy ORDER BY account_id))),
 'users',json((SELECT json_group_array(json_object('personId',m.person_id,'accountId',m.account_id)) FROM buoy_customer_memberships m JOIN buoy_customer_people p ON p.id=m.person_id WHERE p.kind='user' ORDER BY m.person_id,m.account_id)),
 'definitions',json((SELECT json_group_array(json(document)) FROM (SELECT document FROM buoy_fields ORDER BY key))),
 'accounts',json((SELECT json_group_array(json_object('id',a.id,'name',json_extract(a.document,'$.name'),'revision',a.revision,'document',a.document,'manual',json(COALESCE(v.document,'{}')),'previous',json(COALESCE(r.document,'{}')))) FROM buoy_accounts a LEFT JOIN buoy_field_values v ON v.account_id=a.id LEFT JOIN buoy_field_results r ON r.account_id=a.id ORDER BY a.id))
 ) AS snapshot`
export async function image(db:D1Database){const row=await db.prepare(FIELD_SNAPSHOT).first<{snapshot:string}>();insist(row,'Custom fields unavailable.',503);return {raw:row.snapshot,value:JSON.parse(row.snapshot) as Image}}
export function changes(db:D1Database,actor:Actor,data:Image,source:string,sourceAccountId:string|null=null){
 const results=evaluate(data),stamp=now(),history:Record<string,unknown>[]=[],rows:Record<string,unknown>[]=[]
 for(const result of results){
  const before=data.accounts.find(a=>a.id===result.id)!.previous
  const keys=new Set([...Object.keys(before),...Object.keys(result.values)])
  const changed=[...keys].filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(result.values[k]??null))
  if(!changed.length)continue
  for(const key of changed)history.push({id:id(),accountId:result.id,key,oldValue:JSON.stringify(before[key]??null),newValue:JSON.stringify(result.values[key]??null)})
  rows.push({accountId:result.id,document:JSON.stringify(result.values),revision:id(),auditId:id()})
 }
 if(!rows.length)return []
 const documents=JSON.stringify(rows)
 // Set-based writes keep a portfolio rollup within D1's query budget even when
 // all 500 current accounts change. The snapshot fence still covers every input.
 return [
  stmt(db,"INSERT INTO buoy_field_history(id,account_id,field_key,old_value,new_value,actor,source,recorded_at,source_account_id) SELECT json_extract(value,'$.id'),json_extract(value,'$.accountId'),json_extract(value,'$.key'),json_extract(value,'$.oldValue'),json_extract(value,'$.newValue'),?,?,?,? FROM json_each(?)",`${actor.kind}:${actor.id}`,source,stamp,sourceAccountId,JSON.stringify(history)),
  stmt(db,"INSERT INTO buoy_field_results(account_id,document) SELECT json_extract(value,'$.accountId'),json_extract(value,'$.document') FROM json_each(?) WHERE true ON CONFLICT(account_id) DO UPDATE SET document=excluded.document",documents),
  stmt(db,"UPDATE buoy_accounts SET revision=(SELECT json_extract(value,'$.revision') FROM json_each(?) WHERE json_extract(value,'$.accountId')=buoy_accounts.id) WHERE id IN (SELECT json_extract(value,'$.accountId') FROM json_each(?))",documents,documents),
  stmt(db,"INSERT OR IGNORE INTO buoy_audit_subjects(account_id,subject) SELECT json_extract(value,'$.accountId'),lower(hex(randomblob(16))) FROM json_each(?)",documents),
  stmt(db,"INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) SELECT json_extract(j.value,'$.auditId'),?,'account.fields-changed',s.subject,'',? FROM json_each(?) j JOIN buoy_audit_subjects s ON s.account_id=json_extract(j.value,'$.accountId')",`${actor.kind}:${actor.id}`,stamp,documents)
 ]
}
async function write(db:D1Database,actor:Actor,raw:string,statements:D1PreparedStatement[]){
 if(statements.length)await db.batch([authority(db,actor,true),guard(db,`(${FIELD_SNAPSHOT})=?`,raw),...statements,stmt(db,'DELETE FROM buoy_assertions')])
}
export async function fieldsState(db:D1Database){
 const data=(await image(db)).value
 const history=(await db.prepare('SELECT account_id AS accountId,field_key AS key,old_value AS oldValue,new_value AS newValue,actor,source,recorded_at AS recordedAt FROM buoy_field_history ORDER BY recorded_at DESC,id').all<{accountId:string;key:string;oldValue:string;newValue:string;actor:string;source:string;recordedAt:string}>()).results
 return {definitions:data.definitions,accounts:evaluate(data),history:history.map(r=>({...r,oldValue:JSON.parse(r.oldValue),newValue:JSON.parse(r.newValue)}))}
}
function withDefinition(data:Image,input:Record<string,unknown>){
 const d=definition(input),prior=data.definitions.find(x=>x.key===d.key)
 insist(prior||data.definitions.length<100,'At most 100 fields are supported.')
 if(prior)insist(prior.type===d.type,'A field type cannot change; create a new field instead.')
 const definitions=[...data.definitions.filter(x=>x.key!==d.key),d].sort((a,b)=>a.key.localeCompare(b.key))
 ordered(definitions)
 for(const a of data.accounts)for(const [key,value] of Object.entries(a.manual)){const def=definitions.find(x=>x.key===key);insist(def,'Unknown custom field.');fieldValue(def,value)}
 return {definition:d,image:{...data,definitions}}
}
export async function previewField(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 const next=withDefinition((await image(db)).value,input)
 return {definition:next.definition,accounts:evaluate(next.image)}
}
export async function saveField(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 const data=await image(db),next=withDefinition(data.value,input)
 await write(db,actor,data.raw,[stmt(db,'INSERT INTO buoy_fields(key,document,revision) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET document=excluded.document,revision=excluded.revision',next.definition.key,JSON.stringify(next.definition),id()),...changes(db,actor,next.image,`Field definition ${next.definition.key}`)])
 return {key:next.definition.key}
}
export async function saveValues(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['values','revision','source'].includes(k)),'Unsupported custom value property.')
 const data=await image(db),account=data.value.accounts.find(a=>a.id===accountId)
 insist(account,'Account not found.',404);insist(account.revision===input.revision,'Account changed. Reload before saving.',409)
 const raw=object(input.values),values:Record<string,unknown>={},source=text(input.source,'Field source reference',1000)
 for(const [key,value] of Object.entries(raw)){const d=data.value.definitions.find(x=>x.key===key);insist(d,'Unknown custom field.');values[key]=fieldValue(d,value)}
 const next={...data.value,accounts:data.value.accounts.map(a=>a.id===accountId?{...a,manual:values}:a)}
 await write(db,actor,data.raw,[stmt(db,'INSERT INTO buoy_field_values(account_id,document) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET document=excluded.document',accountId,JSON.stringify(values)),...changes(db,actor,next,source,accountId)])
 return {accountId}
}
/** Standard source refreshes preserve their own transaction and append dependent
 * calculation changes before the successful HTTP response is returned. */
export async function refreshFields(db:D1Database,actor:Actor){
 const data=await image(db);if(!data.value.definitions.length)return
 // Recalculation inherits the caller's existing native authority. A reader may
 // observe only; successful writes are refreshed with their owner/admin actor.
 if(actor.kind!=='person'||!['owner','admin'].includes(actor.role))return
 await write(db,actor,data.raw,changes(db,actor,data.value,'Calculated from current account inputs'))
}
