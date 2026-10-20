import { authority, guard, id, now, stmt, type Actor } from '../core'
import { evaluatePeople } from './model'
import { PEOPLE_SNAPSHOT, type PeopleImage } from './snapshot'

export interface HistoryChange {personId:string;key:string;oldValue:unknown;newValue:unknown;accountIds:string[]}
export function historyStatements(db:D1Database,actor:Actor,source:string,entries:HistoryChange[]){
 if(!entries.length)return []
 const stamp=now(),rows=entries.map(entry=>({...entry,id:id(),oldValue:JSON.stringify(entry.oldValue??null),newValue:JSON.stringify(entry.newValue??null)})),json=JSON.stringify(rows)
 return [
  stmt(db,"INSERT INTO buoy_customer_history(id,person_id,field_key,old_value,new_value,actor,source,recorded_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.personId'),json_extract(value,'$.key'),json_extract(value,'$.oldValue'),json_extract(value,'$.newValue'),?,?,? FROM json_each(?)",`${actor.kind}:${actor.id}`,source,stamp,json),
  stmt(db,"INSERT OR IGNORE INTO buoy_customer_history_accounts(history_id,account_id) SELECT json_extract(h.value,'$.id'),a.value FROM json_each(?) h,json_each(h.value,'$.accountIds') a",json)
 ]
}
export function accountRevisionStatements(db:D1Database,accountIds:string[]){
 if(!accountIds.length)return []
 return [stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id IN (SELECT value FROM json_each(?))',JSON.stringify([...new Set(accountIds)]))]
}
export function peopleChanges(db:D1Database,actor:Actor,image:PeopleImage,source:string,sourcePersonId?:string,sourceAccountId?:string){
 const records=evaluatePeople(image),history:HistoryChange[]=[],rows:{id:string;document:string;revision:string}[]=[],accountIds=new Set<string>()
 const portfolioAccounts=[...new Set(image.records.flatMap(person=>person.accountIds))]
 const sourceAccounts=sourceAccountId?[sourceAccountId]:image.records.find(person=>person.id===sourcePersonId)?.accountIds??[]
 for(const record of records){
  const before=image.records.find(person=>person.id===record.id)!.previous
  const keys=[...new Set([...Object.keys(before),...Object.keys(record.values)])]
  const changed=keys.filter(key=>JSON.stringify(before[key]??null)!==JSON.stringify(record.values[key]??null))
  if(!changed.length)continue
  for(const key of changed){
   const formula=image.definitions.find(d=>d.key===key)?.type==='formula'
   history.push({personId:record.id,key,oldValue:before[key]??null,newValue:record.values[key]??null,accountIds:[...new Set([...record.accountIds,...sourceAccounts,...(formula?portfolioAccounts:[])])]})
  }
  record.accountIds.forEach(accountId=>accountIds.add(accountId))
  rows.push({id:record.id,document:JSON.stringify(record.values),revision:id()})
 }
 if(!rows.length)return []
 const json=JSON.stringify(rows)
 return [
  ...historyStatements(db,actor,source,history),
  stmt(db,"INSERT INTO buoy_customer_results(person_id,document) SELECT json_extract(value,'$.id'),json_extract(value,'$.document') FROM json_each(?) WHERE true ON CONFLICT(person_id) DO UPDATE SET document=excluded.document",json),
  stmt(db,"UPDATE buoy_customer_people SET revision=(SELECT json_extract(value,'$.revision') FROM json_each(?) WHERE json_extract(value,'$.id')=buoy_customer_people.id) WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))",json,json),
  ...accountRevisionStatements(db,[...accountIds])
 ]
}
export async function writePeople(db:D1Database,actor:Actor,raw:string,statements:D1PreparedStatement[]){
 if(statements.length)await db.batch([authority(db,actor,true),guard(db,`(${PEOPLE_SNAPSHOT})=?`,raw),...statements,stmt(db,'DELETE FROM buoy_assertions')])
}
