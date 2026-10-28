import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {accountAudit} from '../audit-records'
import {authority,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {READINESS_SQL,readinessImage} from './readiness'

export async function prepareTimeline(db:D1Database,actor:Actor,renewalId:string,input:Record<string,unknown>){
 if(actor.kind==='person')requirePerson(actor)
 insist(Object.keys(input).every(k=>['revision','customerId','staffId'].includes(k)),'A timeline cannot set commercial terms.')
 const current=await readinessImage(db,renewalId),customerId=text(input.customerId,'Customer participant',100),staffId=text(input.staffId,'Staff owner',100)
 insist(input.revision===current.proof,'Readiness evidence changed. Prepare from the current sources.',409)
 insist(current.state.active,'Renewal readiness opens 120 days before renewal.',409)
 insist(current.image.people.some(p=>p.id===customerId&&p.kind==='contact'&&p.status!=='departed'),'Choose a current account contact for the customer review.')
 const timelineId=id(),stamp=now()
 await db.batch([authority(db,actor,false,'renewal.timeline.prepare'),guard(db,'('+READINESS_SQL.replace(' AS snapshot','')+')=?',current.on,renewalId,current.raw),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",staffId),stmt(db,'INSERT INTO buoy_renewal_timelines(id,renewal_id,account_id,customer_id,staff_id,evidence_proof,document,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?,?)',timelineId,renewalId,current.state.accountId,customerId,staffId,current.proof,JSON.stringify(current.state.milestones),`${actor.kind}:${actor.id}`,stamp),...accountAudit(db,actor,current.state.accountId,'renewal.timeline-prepared'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:timelineId,status:'prepared',classification:['standard'],customerAgreement:'unconfirmed',milestones:current.state.milestones}
}
export async function approveTimeline(db:D1Database,actor:Actor,renewalId:string,timelineId:string){
 requirePerson(actor)
 const row=await stmt(db,'SELECT evidence_proof AS proof,account_id AS accountId,approved_at AS approvedAt,staff_id AS staffId FROM buoy_renewal_timelines WHERE id=? AND renewal_id=?',timelineId,renewalId).first<{proof:string;accountId:string;approvedAt:string|null;staffId:string}>();insist(row,'Timeline not found.',404)
 if(row.approvedAt){await db.batch([authority(db,actor,true),stmt(db,'DELETE FROM buoy_assertions')]);return {id:timelineId,status:'approved'}}
 const current=await readinessImage(db,renewalId)
 insist(row.proof===current.proof,'Readiness evidence changed. Prepare a new timeline before approval.',409)
 await db.batch([authority(db,actor,true),guard(db,'('+READINESS_SQL.replace(' AS snapshot','')+')=?',current.on,renewalId,current.raw),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",row.staffId),guard(db,'EXISTS(SELECT 1 FROM buoy_renewal_timelines WHERE id=? AND approved_at IS NULL AND evidence_proof=?)',timelineId,row.proof),stmt(db,'UPDATE buoy_renewal_timelines SET approved_by=?,approved_at=? WHERE id=?',actor.id,now(),timelineId),...accountAudit(db,actor,row.accountId,'renewal.timeline-approved'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:timelineId,status:'approved',customerAgreement:'unconfirmed'}
}
export const timelineApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
timelineApi.post('/api/buoy/renewals/:id/timelines',async c=>c.json(await prepareTimeline(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw)),201))
timelineApi.post('/api/buoy/renewals/:id/timelines/:timelineId/approve',async c=>{await jsonBody(c.req.raw);return c.json(await approveTimeline(c.env.DB,c.get('actor'),c.req.param('id'),c.req.param('timelineId')))})
