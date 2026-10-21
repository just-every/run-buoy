import { id, insist, now, requirePerson, stmt, text, type Actor } from '../core'
import { auditRecord } from '../audit-records'
import { peopleImage, type PersonRow } from './snapshot'
import { accountRevisionStatements, historyStatements, peopleChanges, writePeople, type HistoryChange } from './write'

export async function savePerson(db:D1Database,actor:Actor,input:Record<string,unknown>,personId?:string){
 requirePerson(actor)
 insist(Object.keys(input).every(key=>['kind','name','accountIds','revision','source'].includes(key)),'Unsupported customer person property.')
 insist(input.kind==='contact'||input.kind==='user','Choose contact or user.')
 const name=text(input.name,'Customer person name',200),source=text(input.source,'Person source reference',1000),data=await peopleImage(db)
 const prior=personId?data.value.records.find(person=>person.id===personId):undefined
 if(personId){insist(prior,'Customer person not found.',404);insist(prior.revision===input.revision,'Customer person changed. Reload before saving.',409)}
 else{insist(input.revision===undefined,'A new customer person has no revision.');insist(data.value.records.length<10000,'At most 10000 customer people are supported.')}
 insist(Array.isArray(input.accountIds)&&input.accountIds.length>0&&input.accountIds.length<=500,'Choose 1–500 explicit account memberships.')
 const accountIds=input.accountIds.map(value=>text(value,'Account membership',100))
 insist(new Set(accountIds).size===accountIds.length&&accountIds.every(accountId=>data.value.accounts.some(account=>account.id===accountId)),'Memberships must name unique existing accounts.')
 accountIds.sort()
 // Kind is an identity boundary for explicit reviewed product mappings.
 if(prior)insist(prior.kind===input.kind,'A customer person kind cannot change; create the other kind explicitly.')
 const person:PersonRow={id:prior?.id??id(),kind:input.kind,name,accountIds,revision:id(),createdAt:prior?.createdAt??now(),manual:prior?.manual??{},previous:prior?.previous??{},valueAccounts:prior?.valueAccounts,previousAccounts:prior?.previousAccounts}
 const image={...data.value,records:[...data.value.records.filter(item=>item.id!==person.id),person].sort((a,b)=>a.id.localeCompare(b.id))}
 const history:HistoryChange[]=[],custody=[...new Set([...accountIds,...prior?.accountIds??[]])]
 for(const key of ['kind','name','accountIds'] as const){
  const before=prior?.[key]??null,after=person[key]
  if(JSON.stringify(before)!==JSON.stringify(after))history.push({personId:person.id,key:`person.${key}`,oldValue:before,newValue:after,accountIds:custody})
 }
 await writePeople(db,actor,data.raw,[
  stmt(db,'INSERT INTO buoy_customer_people(id,kind,name,revision,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,revision=excluded.revision',person.id,person.kind,person.name,person.revision,person.createdAt),
  stmt(db,'DELETE FROM buoy_customer_memberships WHERE person_id=? AND account_id NOT IN (SELECT value FROM json_each(?))',person.id,JSON.stringify(accountIds)),
  stmt(db,'INSERT OR IGNORE INTO buoy_customer_memberships(person_id,account_id) SELECT ?,value FROM json_each(?)',person.id,JSON.stringify(accountIds)),
  ...historyStatements(db,actor,source,history),...peopleChanges(db,actor,image,source,person.id),
  ...accountRevisionStatements(db,custody),auditRecord(db,actor,'customer-person.saved',`customer-person:${person.id}`)
 ])
 return {id:person.id}
}
