import { id, insist, object, requirePerson, stmt, text, type Actor } from '../core'
import { auditRecord } from '../audit-records'
import { fieldValue, evaluatePeople, peopleProjection, withPersonDefinition } from './model'
import { peopleImage } from './snapshot'
import { peopleChanges, writePeople } from './write'

export async function previewPersonField(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 const next=withPersonDefinition((await peopleImage(db)).value,input),records=evaluatePeople(next.image),accounts=peopleProjection(next.image,records)
 return {definition:next.definition,records:records.slice(0,10),accounts:[...accounts.filter(a=>a.records.length),...accounts.filter(a=>!a.records.length)].slice(0,10),totalRecords:records.length,totalAccounts:accounts.length}
}
export async function savePersonField(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 const data=await peopleImage(db),next=withPersonDefinition(data.value,input)
 await writePeople(db,actor,data.raw,[
  stmt(db,'INSERT INTO buoy_customer_fields(key,document,revision) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET document=excluded.document,revision=excluded.revision',next.definition.key,JSON.stringify(next.definition),id()),
  ...peopleChanges(db,actor,next.image,`Customer field definition ${next.definition.key}`),auditRecord(db,actor,'customer-field.saved',`customer-field:${next.definition.key}`)
 ])
 return {key:next.definition.key}
}
export async function savePersonValues(db:D1Database,actor:Actor,personId:string,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(key=>['values','revision','source','sourceAccountId'].includes(key)),'Unsupported customer value property.')
 const data=await peopleImage(db),person=data.value.records.find(item=>item.id===personId)
 insist(person,'Customer person not found.',404);insist(person.revision===input.revision,'Customer person changed. Reload before saving.',409)
 const raw=object(input.values),values:Record<string,unknown>={},source=text(input.source,'Field source reference',1000)
 const sourceAccountId=input.sourceAccountId===undefined?undefined:text(input.sourceAccountId,'Field source account',100)
 if(sourceAccountId)insist(person.accountIds.includes(sourceAccountId),'A field source account must be an explicit person membership.')
 for(const [key,value] of Object.entries(raw)){
  const d=data.value.definitions.find(item=>item.key===key);insist(d,'Unknown customer field.');values[key]=fieldValue(d,value)
 }
 const image={...data.value,records:data.value.records.map(item=>item.id===personId?{...item,manual:values}:item)}
 const custody=sourceAccountId?[sourceAccountId]:person.accountIds
 const sources=Object.keys(values).flatMap(key=>custody.map(accountId=>({key,accountId})))
 await writePeople(db,actor,data.raw,[
  stmt(db,'INSERT INTO buoy_customer_values(person_id,document) VALUES(?,?) ON CONFLICT(person_id) DO UPDATE SET document=excluded.document',personId,JSON.stringify(values)),
  stmt(db,'DELETE FROM buoy_customer_value_sources WHERE person_id=?',personId),
  stmt(db,"INSERT INTO buoy_customer_value_sources(person_id,field_key,account_id) SELECT ?,json_extract(value,'$.key'),json_extract(value,'$.accountId') FROM json_each(?)",personId,JSON.stringify(sources)),
  ...peopleChanges(db,actor,image,source,personId,sourceAccountId),auditRecord(db,actor,'customer-person.fields-changed',`customer-person:${personId}`)
 ])
 return {personId}
}
export async function refreshPeople(db:D1Database,actor:Actor){
 if(actor.kind!=='person'||!['owner','admin'].includes(actor.role))return
 const data=await peopleImage(db)
 if(data.value.definitions.length)await writePeople(db,actor,data.raw,peopleChanges(db,actor,data.value,'Calculated from current customer person inputs'))
}
