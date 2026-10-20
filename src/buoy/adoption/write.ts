import { accountAudit, auditRecord } from '../audit-records'
import { authority, guard, insist, now, requirePerson, stmt, text, type Actor } from '../core'

function only(input:Record<string,unknown>,keys:string[]){insist(Object.keys(input).every(key=>keys.includes(key)),'Unsupported adoption property.')}
export async function saveDefinition(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor);only(input,['kind','key','name','events'])
 insist(input.kind==='feature'||input.kind==='module','Definition kind must be feature or module.')
 const key=text(input.key,'Definition key',80),name=text(input.name,'Definition name',100)
 insist(/^[a-z][a-z0-9_-]*$/.test(key),'Definition key must start with a lowercase letter and contain lowercase letters, numbers, underscores or hyphens.')
 insist(Array.isArray(input.events)&&input.events.length>0&&input.events.length<=100,'Choose 1–100 event names.')
 const events=input.events.map(value=>text(value,'Event name',200))
 insist(new Set(events).size===events.length,'Event names must be distinct.')
 const updatedAt=now(),definition={kind:input.kind,key,name,events,updatedAt}
 await db.batch([authority(db,actor,true),
  stmt(db,`INSERT INTO buoy_adoption_definitions(kind,key,name,events,updated_at) VALUES(?,?,?,?,?)
   ON CONFLICT(kind,key) DO UPDATE SET name=excluded.name,events=excluded.events,updated_at=excluded.updated_at`,definition.kind,key,name,JSON.stringify(events),updatedAt),
  auditRecord(db,actor,'adoption.definition-saved',`adoption:${definition.kind}:${key}`),stmt(db,'DELETE FROM buoy_assertions')])
 return definition
}
export async function saveSeats(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor);only(input,['accountId','seats'])
 const accountId=text(input.accountId,'Account ID',200),seats=input.seats
 insist(seats===null||(typeof seats==='number'&&Number.isSafeInteger(seats)&&seats>=0),'Seats must be a nonnegative whole number, or null to clear.')
 const updatedAt=now()
 await db.batch([authority(db,actor,true),guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=?)',accountId),
  seats===null?stmt(db,'DELETE FROM buoy_adoption_seats WHERE account_id=?',accountId):
   stmt(db,`INSERT INTO buoy_adoption_seats(account_id,seats,updated_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET seats=excluded.seats,updated_at=excluded.updated_at`,accountId,seats,updatedAt),
  ...accountAudit(db,actor,accountId,'adoption.seats-saved'),stmt(db,'DELETE FROM buoy_assertions')])
 return {accountId,seats,updatedAt}
}
