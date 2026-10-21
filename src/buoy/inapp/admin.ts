import type { Actor } from '../core'
import { authority, requirePerson } from '../core'
import { auditRecord, auditIfChanged } from '../audit-records'
import { digest } from '../usage/model'
import { adminRead, adminWrite, CAMPAIGN_COLUMNS, id, insist, now, only, source, stmt, text } from './model'
export async function inappState(db:D1Database,actor:Actor){
 const rows=await adminRead(db,actor,[stmt(db,`SELECT ${CAMPAIGN_COLUMNS} FROM buoy_inapp_campaigns ORDER BY created_at,id`),stmt(db,'SELECT id,name FROM buoy_usage_sources ORDER BY name'),stmt(db,"SELECT id,json_extract(document,'$.name') AS name FROM buoy_segments ORDER BY name"),stmt(db,'SELECT id,source_id AS sourceId,label,creator_id AS creatorId,created_at AS createdAt,last_used_at AS lastUsedAt,revoked_at AS revokedAt FROM buoy_inapp_credentials ORDER BY created_at,id')])
 return {campaigns:(rows[0].results as Record<string,unknown>[]).map(c=>({...c,steps:JSON.parse(String(c.steps)),enabled:!!c.enabled})),sources:rows[1].results,segments:rows[2].results,credentials:(rows[3].results as Record<string,unknown>[]).map(c=>({...c,scope:['inapp']}))}
}
export async function saveCampaign(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor);only(input,['sourceId','segmentId','kind','title','body','steps','maxViews','windowHours','enabled'])
 const sourceId=text(input.sourceId,'Usage source'),segmentId=text(input.segmentId,'Target segment');await source(db,sourceId)
 insist(await stmt(db,'SELECT id FROM buoy_segments WHERE id=?',segmentId).first(),'Target segment not found.',404)
 insist(['announcement','banner','checklist','walkthrough'].includes(String(input.kind)),'Choose an announcement, banner, checklist or walkthrough.')
 const steps=input.steps??[];insist(Array.isArray(steps)&&steps.length<=20&&steps.every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=500),'Supply up to twenty plain-text steps.')
 insist(!['checklist','walkthrough'].includes(String(input.kind))||steps.length>0,'A checklist or walkthrough needs at least one step.')
 insist(Number.isInteger(input.maxViews)&&Number(input.maxViews)>=1&&Number(input.maxViews)<=1000,'Maximum views must be 1–1000.')
 insist(Number.isInteger(input.windowHours)&&Number(input.windowHours)>=1&&Number(input.windowHours)<=8760,'Cap window must be 1–8760 UTC hours.')
 insist(typeof input.enabled==='boolean','Choose whether the message is enabled.')
 const key=id()
 await adminWrite(db,actor,[stmt(db,'INSERT INTO buoy_inapp_campaigns(id,source_id,segment_id,kind,title,body,steps,max_views,window_hours,enabled,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,sourceId,segmentId,input.kind,text(input.title,'Message title',200),text(input.body,'Message body',4000),JSON.stringify(steps),input.maxViews,input.windowHours,input.enabled?1:0,now()),auditRecord(db,actor,'inapp.created',`inapp:${key}`)])
 return {id:key}
}
export async function toggleCampaign(db:D1Database,actor:Actor,key:string,input:Record<string,unknown>){
 only(input,['enabled']);insist(typeof input.enabled==='boolean','Choose whether the message is enabled.')
 await adminWrite(db,actor,[stmt(db,'UPDATE buoy_inapp_campaigns SET enabled=? WHERE id=?',input.enabled?1:0,key),auditIfChanged(db,actor,'inapp.toggled',`inapp:${key}`)])
 return {id:key}
}
export async function issueInapp(db:D1Database,actor:Actor,input:Record<string,unknown>){
 only(input,['sourceId','label']);requirePerson(actor);const sourceId=text(input.sourceId,'Source');await source(db,sourceId)
 const key=id(),stamp=now(),label=text(input.label,'Credential label',100)
 const secret='buoy_inapp_'+[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('')
 await adminWrite(db,actor,[stmt(db,'INSERT INTO buoy_inapp_credentials(id,source_id,token_hash,label,creator_id,created_at) VALUES(?,?,?,?,?,?)',key,sourceId,await digest(secret),label,actor.id,stamp),auditRecord(db,actor,'inapp.credential-issued',`inapp-credential:${key}`)])
 return {credential:{id:key,sourceId,label,scope:['inapp'],creatorId:actor.id,createdAt:stamp,lastUsedAt:null,revokedAt:null},secret}
}
export async function revokeInapp(db:D1Database,actor:Actor,key:string){
 await adminWrite(db,actor,[stmt(db,'UPDATE buoy_inapp_credentials SET revoked_at=? WHERE id=? AND revoked_at IS NULL',now(),key),auditIfChanged(db,actor,'inapp.credential-revoked',`inapp-credential:${key}`)])
 return {status:'revoked'}
}
export async function personTimeline(db:D1Database,actor:Actor,personId:string,cursor:string|null=null){
 insist(actor.kind==='person','Staff sign-in required.',403)
 const rows=await db.batch([authority(db,actor),stmt(db,`SELECT e.id,e.event,e.source_id AS sourceId,e.source_reference AS sourceReference,e.observed_at AS observedAt,e.received_at AS receivedAt,m.account_id AS accountId,r.kind,c.title AS campaignTitle FROM buoy_usage_events e JOIN buoy_usage_mappings m ON m.source_id=e.source_id AND m.user_id IS e.user_id AND m.group_id IS e.group_id JOIN buoy_customer_memberships cm ON cm.person_id=m.person_id AND cm.account_id=m.account_id LEFT JOIN buoy_inapp_receipts r ON r.event_id=e.id LEFT JOIN buoy_inapp_campaigns c ON c.id=r.campaign_id WHERE m.person_id=? AND (? IS NULL OR e.received_at||'|'||e.id<?) ORDER BY e.received_at DESC,e.id DESC LIMIT 51`,personId,cursor,cursor),stmt(db,'DELETE FROM buoy_assertions')])
 const records=(rows[1].results as Record<string,unknown>[]).slice(0,50),last=records.at(-1)
 // Receipt instants are server observation/receipt instants, not browser dates.
 return {events:records,nextCursor:rows[1].results.length>50&&last?String(last.receivedAt)+'|'+String(last.id):null}
}
