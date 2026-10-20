import { authority, guard, id, insist, now, object, requirePerson, stmt, text, type Actor } from '../core'
import { accountAudit } from '../audit-records'
import { definition, evaluate, fieldValue, ordered, type Definition, type Image } from './model'
export const FIELD_SNAPSHOT=`SELECT json_object(
 'definitions',json((SELECT json_group_array(json(document)) FROM (SELECT document FROM buoy_fields ORDER BY key))),
 'accounts',json((SELECT json_group_array(json_object('id',a.id,'name',json_extract(a.document,'$.name'),'revision',a.revision,'document',a.document,'manual',json(COALESCE(v.document,'{}')),'previous',json(COALESCE(r.document,'{}')))) FROM buoy_accounts a LEFT JOIN buoy_field_values v ON v.account_id=a.id LEFT JOIN buoy_field_results r ON r.account_id=a.id ORDER BY a.id))
 ) AS snapshot`
export async function image(db:D1Database){const row=await db.prepare(FIELD_SNAPSHOT).first<{snapshot:string}>();insist(row,'Custom fields unavailable.',503);return {raw:row.snapshot,value:JSON.parse(row.snapshot) as Image}}
export function changes(db:D1Database,actor:Actor,data:Image,source:string){
 const results=evaluate(data), statements:D1PreparedStatement[]=[],stamp=now()
 for(const result of results){
  const before=data.accounts.find(a=>a.id===result.id)!.previous
  const keys=new Set([...Object.keys(before),...Object.keys(result.values)])
  const changed=[...keys].filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(result.values[k]??null))
  if(!changed.length)continue
  for(const key of changed)statements.push(stmt(db,'INSERT INTO buoy_field_history(id,account_id,field_key,old_value,new_value,actor,source,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)',id(),result.id,key,JSON.stringify(before[key]??null),JSON.stringify(result.values[key]??null),`${actor.kind}:${actor.id}`,source,stamp))
  statements.push(stmt(db,'INSERT INTO buoy_field_results(account_id,document) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET document=excluded.document',result.id,JSON.stringify(result.values)),stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),result.id),...accountAudit(db,actor,result.id,'account.fields-changed'))
 }
 return statements
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
 await write(db,actor,data.raw,[stmt(db,'INSERT INTO buoy_field_values(account_id,document) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET document=excluded.document',accountId,JSON.stringify(values)),...changes(db,actor,next,source)])
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
