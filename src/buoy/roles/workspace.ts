import {state} from '../accounts'
import {guard,insist,now,stmt,text,type Actor} from '../core'
import {HANDLER} from '../tasks'
import {localTime,taskTiming} from '../settings'
import {readableIds,roleAccess,roleFence,scopeFence,scopeImage,type RoleAccess} from './access'
import {projectState,type ProjectedAccount} from './projection'

export interface ScopedWorkspaceHome {
 person:{id:string;displayName:string};people:{id:string;displayName:string}[];
 on:string;readOnly:true;book:ProjectedAccount[];
 tasks:{id:string;accountId:string;accountName:string;dueDate:string;priority:string;type:string;title:string}[];
 alerts:{id:string;accountId:string;accountName:string;createdAt:string;title:string}[];
 renewals:{accountId:string;name:string;renewalDate:string;opportunities:{id:string}[]}[];
 meetings:{status:'unavailable';reason:string};interpretation:string
}
type Person={id:string;displayName:string;version:number}
type Task={id:string;accountId:string;dueDate:string;priority:string;type:string;handlerId:string}
type Alert={id:string;accountId:string;createdAt:string}
type Renewal={id:string;accountId:string;renewalDate:string}

/** The same current-book/day/handler/alert semantics as the native workspace.
 * Read authority belongs to the caller: inspecting another person's home never
 * adopts that person's role or broadens the caller's records or fields. */
export async function scopedWorkspaceHome(db:D1Database,actor:Actor,target=actor.id,provided?:RoleAccess):Promise<ScopedWorkspaceHome>{
 const access=provided??await roleAccess(db,actor),targetId=text(target,'CSM',100)
 insist(access.restricted&&!access.stale,'A current assigned staff profile is required.',403)
 const inspectOthers=['yes','read-only'].includes(access.permissions.home)
 insist(targetId===actor.id||inspectOthers,'Your profile can open only your own home.',403)
 const person=await stmt(db,"SELECT id,display_name AS displayName,version FROM oa_operators WHERE id=? AND status='active'",targetId).first<Person>()
 insist(person,'This home is unavailable.',404)
 const image=await scopeImage(db),visible=new Set(readableIds(image.value,actor,access))
 const owned=image.value.accounts.filter(account=>account.ownerId===targetId),bookIds=owned.filter(account=>visible.has(account.id)).map(account=>account.id)
 // An empty all-scope book is a valid empty home. A scope that excludes the
 // target's entire nonempty book is refused without exposing its person/name.
 insist(targetId===actor.id||bookIds.length>0||(owned.length===0&&access.scope.kind==='all'&&access.roleScope.kind==='all'&&access.permissions.read==='all'),'This home is outside your current record scope.',403)
 const projected=await projectState(db,actor,await state(db,actor),access),selected=new Set(bookIds),book=projected.accounts.filter(account=>selected.has(account.id)).sort((a,b)=>a.id.localeCompare(b.id))
 const timingRow=await db.prepare("SELECT value FROM buoy_settings WHERE key='tasks'").first<{value:string}>(),timing=await taskTiming(db),on=localTime(timing.timeZone).date,end=new Date(Date.parse(on)+90*86400000).toISOString().slice(0,10),stamp=now(),ids=JSON.stringify(bookIds)
 const rows=await db.batch<Record<string,unknown>>([
  roleFence(db,actor,access),scopeFence(db,image),
  guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=?)",targetId,person.version),
  guard(db,"(SELECT value FROM buoy_settings WHERE key='tasks') IS ?",timingRow?.value??null),
  db.prepare("SELECT id,display_name AS displayName FROM oa_operators WHERE status='active' ORDER BY display_name,id"),
  stmt(db,`SELECT t.id,t.account_id AS accountId,t.due_date AS dueDate,t.priority,t.type,${HANDLER} AS handlerId FROM buoy_tasks t WHERE t.completed_at IS NULL AND t.due_date=? AND t.account_id IN(SELECT value FROM json_each(?)) ORDER BY t.due_date,t.id`,on,on,on,ids),
  stmt(db,`SELECT n.id,n.account_id AS accountId,n.created_at AS createdAt FROM buoy_inbox n
   LEFT JOIN buoy_adoption_alert_notices r ON r.notice_id=n.id
   LEFT JOIN buoy_adoption_alert_state s ON s.rule_id=r.rule_id AND s.account_id=r.account_id AND s.person_id=r.person_id
   LEFT JOIN buoy_adoption_dismissals d ON d.rule_id=r.rule_id AND d.account_id=r.account_id AND d.person_id=r.person_id
   WHERE n.person_id=? AND n.type='signal' AND n.read_at IS NULL AND n.account_id IN(SELECT value FROM json_each(?))
   AND ((r.notice_id IS NOT NULL AND s.active=1) OR (r.notice_id IS NULL AND n.source LIKE 'health:%'
    AND json_extract((SELECT fingerprint FROM buoy_alert_state WHERE account_id=n.account_id),'$[1]')='at-risk'
    AND n.id=(SELECT n2.id FROM buoy_inbox n2 WHERE n2.person_id=n.person_id AND n2.account_id=n.account_id AND n2.type='signal' AND n2.source LIKE 'health:%' ORDER BY n2.created_at DESC,n2.id DESC LIMIT 1)))
   AND (d.until IS NULL OR d.until<=?) ORDER BY n.created_at DESC,n.id`,targetId,ids,stamp),
  stmt(db,"SELECT id,account_id AS accountId,json_extract(document,'$.renewalDate') AS renewalDate FROM buoy_renewals WHERE account_id IN(SELECT value FROM json_each(?)) ORDER BY id",ids),
  stmt(db,'DELETE FROM buoy_assertions'),
 ])
 const safePerson=({id,displayName}:{id:string;displayName:string})=>({id,displayName})
 const people=(rows[4].results as unknown as {id:string;displayName:string}[]).filter(candidate=>candidate.id===actor.id||candidate.id===targetId||(inspectOthers&&image.value.accounts.some(account=>account.ownerId===candidate.id&&visible.has(account.id)))).map(safePerson)
 const accountName=(accountId:string)=>book.find(account=>account.id===accountId)!.name
 const opportunities=rows[7].results as unknown as Renewal[]
 return {person:safePerson(person),people,on,readOnly:true,book,
  tasks:(rows[5].results as unknown as Task[]).filter(task=>task.handlerId===targetId).map(task=>({id:task.id,accountId:task.accountId,accountName:accountName(task.accountId),dueDate:task.dueDate,priority:task.priority,type:task.type,title:'Task due today'})),
  alerts:(rows[6].results as unknown as Alert[]).map(alert=>({...alert,accountName:accountName(alert.accountId),title:'Account alert'})),
  renewals:book.filter(account=>account.renewalDate>=on&&account.renewalDate<=end).map(account=>({accountId:account.id,name:account.name,renewalDate:account.renewalDate,opportunities:opportunities.filter(row=>row.accountId===account.id&&row.renewalDate===account.renewalDate).map(row=>({id:row.id}))})),
  meetings:{status:'unavailable',reason:'Calendar capture is not connected; meeting information is unavailable.'},
  interpretation:'This is the current assigned book within your record and commercial-field scope. Tasks are open, handled by this person today (including away cover), and due on the installation calendar date. Alerts are current and unread, excluding dismissed alerts. Renewals include both endpoints of the next 90 days. Task and alert text is withheld because it can contain unrestricted source or commercial details. This home is read-only.',
 }
}
