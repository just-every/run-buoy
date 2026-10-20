import { accountAudit, auditRecord } from '../audit-records'
import { authority, date, guard, id, insist, now, requirePerson, stmt, text, type Actor } from '../core'

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
 requirePerson(actor);only(input,['accountId','seats','reference','observedAt','staleDays'])
 const accountId=text(input.accountId,'Account ID',200),seats=input.seats
 insist(seats===null||(typeof seats==='number'&&Number.isSafeInteger(seats)&&seats>=0),'Seats must be a nonnegative whole number, or null to clear.')
 const updatedAt=now(),staleDays=input.staleDays??30
 let evidence:{sourceSystem:'manual';reference:string;observedAt:string;staleDays:number}|null=null
 if(seats!==null){
  insist(Number.isInteger(staleDays)&&Number(staleDays)>=1&&Number(staleDays)<=365,'Seat evidence staleness must be 1–365 whole days.')
  evidence={sourceSystem:'manual',reference:text(input.reference,'Seat evidence reference',1000),observedAt:date(input.observedAt,'Seat observation date'),staleDays:Number(staleDays)}
 }
 const snapshot={seats,cleared:seats===null,sourceSystem:'manual',reference:evidence?.reference??null,observedAt:evidence?.observedAt??null,staleDays:evidence?.staleDays??null}
 await db.batch([authority(db,actor,true),guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=?)',accountId),
  seats===null?stmt(db,'DELETE FROM buoy_adoption_seats WHERE account_id=?',accountId):
   stmt(db,`INSERT INTO buoy_adoption_seats(account_id,seats,source_system,reference,observed_at,stale_days,updated_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(account_id) DO UPDATE SET seats=excluded.seats,source_system=excluded.source_system,reference=excluded.reference,observed_at=excluded.observed_at,stale_days=excluded.stale_days,updated_at=excluded.updated_at`,accountId,seats,evidence!.sourceSystem,evidence!.reference,evidence!.observedAt,evidence!.staleDays,updatedAt),
  stmt(db,'INSERT INTO buoy_adoption_seat_history(id,account_id,document,recorded_by,recorded_at) VALUES(?,?,?,?,?)',id(),accountId,JSON.stringify(snapshot),`person:${actor.id}`,updatedAt),
  stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),accountId),
  ...accountAudit(db,actor,accountId,'adoption.seats-saved'),stmt(db,'DELETE FROM buoy_assertions')])
 return {accountId,seats,updatedAt,...evidence}
}
