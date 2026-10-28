import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {digest,jsonBody} from '../access'
import {accountAudit} from '../audit-records'
import {authority,date,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {inputImage} from '../scorecards/inputs'
import {planProjection,type PlanRow} from '../plans/model'
import {accountHealth} from '../sentiment'
import type {Account} from '../health'
import type {Renewal} from './index'

export const READINESS_SQL=`SELECT json_object(
 'renewal',json(r.document),'renewalRevision',r.revision,'account',json(a.document),'accountRevision',a.revision,
 'people',json((SELECT json_group_array(json_object('id',p.id,'name',p.name,'kind',p.kind,'revision',p.revision,
   'roles',json((SELECT json_group_array(role) FROM(SELECT role FROM buoy_stakeholder_roles WHERE account_id=a.id AND person_id=p.id ORDER BY role))),
   'status',s.status,'source',s.source,'observedOn',s.observed_on,'statusRevision',s.revision))
  FROM buoy_customer_memberships m JOIN buoy_customer_people p ON p.id=m.person_id LEFT JOIN buoy_stakeholder_status s ON s.account_id=m.account_id AND s.person_id=m.person_id WHERE m.account_id=a.id ORDER BY p.id)),
 'plans',json((SELECT json_group_array(json_object('id',p.id,'accountId',p.account_id,'revision',p.revision,'customerOwnerId',p.customer_owner_id,'document',p.document,
  'confirmations',''||(SELECT json_group_array(json_object('objectiveId',objective_id,'personId',person_id)) FROM buoy_plan_confirmations c WHERE c.plan_id=p.id AND c.plan_revision=p.revision))) FROM buoy_success_plans p WHERE p.account_id=a.id ORDER BY p.id)),
 'tasks',json((SELECT json_group_array(json_object('id',id,'title',title,'dueOn',due_date,'ownerId',owner_id)) FROM buoy_tasks WHERE account_id=a.id AND completed_at IS NULL ORDER BY id)),
 'engagement',json((SELECT json_group_array(json_object('personId',person_id,'kind',kind,'at',recorded_at)) FROM buoy_portal_events WHERE account_id=a.id ORDER BY id)),
 'billing',json((SELECT json_object('snapshotId',s.id,'observedAt',s.observed_at,'source',s.source_reference,'available',c.disconnected_at IS NULL AND k.connection_id IS NOT NULL AND b.last_error IS NULL AND julianday(?) - julianday(substr(s.observed_at,1,10)) BETWEEN 0 AND b.stale_days)
  FROM buoy_billing_current x JOIN buoy_billing_snapshots s ON s.id=x.snapshot_id JOIN buoy_connections c ON c.id=s.connection_id LEFT JOIN buoy_connection_credentials k ON k.connection_id=c.id JOIN buoy_billing_settings b ON b.connection_id=c.id WHERE x.account_id=a.id))
 ) AS snapshot FROM buoy_renewals r JOIN buoy_accounts a ON a.id=r.account_id WHERE r.id=?`
interface Stakeholder {id:string;name:string;kind:string;roles:string[];revision:string;status:'active'|'departed'|null;source:string|null;observedOn:string|null}
interface Image {renewal:Renewal;renewalRevision:string;account:Account;accountRevision:string;people:Stakeholder[];plans:PlanRow[];tasks:{id:string;title:string;dueOn:string;ownerId:string|null}[];engagement:{personId:string;kind:string;at:string}[];billing:{snapshotId:string;observedAt:string;source:string;available:number}|null}
export interface ReadinessCitation {kind:string;title:string;reference:string;href:string}
export async function readinessImage(db:D1Database,renewalId:string){
 const on=now().slice(0,10),row=await stmt(db,READINESS_SQL,on,renewalId).first<{snapshot:string}>();insist(row,'Renewal not found.',404)
 const image=JSON.parse(row.snapshot) as Image,renewal={...image.renewal,id:renewalId},accountId=renewal.accountId,href='/app/accounts/'+encodeURIComponent(accountId)
 const metrics=await inputImage(db,new Date()),values=metrics.accounts.find(a=>a.accountId===accountId)?.inputs.values??{}
 const plans=image.plans.map(p=>planProjection(p,values)),health=await accountHealth(db,image.account)
 const flags:ReadinessCitation[]=[],add=(kind:string,title:string,reference:string,fragment:string)=>flags.push({kind,title,reference,href:fragment.startsWith('/app/')?fragment:href+fragment})
 const champions=image.people.filter(p=>p.roles.includes('champion'))
 for(const p of champions.filter(p=>p.status==='departed'))add('departed-champion','Champion departed: '+p.name,p.source!+' · '+p.observedOn,'#account-hierarchy')
 if(!champions.some(p=>p.status!=='departed'))add('missing-champion','No current champion is recorded.','Current stakeholder roles','#account-hierarchy')
 if(!image.people.some(p=>p.kind==='contact'&&p.roles.includes('economic-buyer')&&p.status!=='departed'))add('missing-authority','No current economic buyer contact is recorded.','Current stakeholder roles','#account-hierarchy')
 for(const p of plans)for(const goal of p.objectives)if(goal.status!=='achieved')add(goal.status==='awaiting-customer-confirmation'?'unconfirmed-goal':'unresolved-goal',goal.title+' — '+goal.status,p.name+' · revision '+p.revision+' · objective '+goal.id,'#success-plans')
 if(!plans.length)add('missing-plan','No success-plan goals are recorded.','Current success plans','#success-plans')
 for(const task of image.tasks)add('open-obligation',task.title+' — due '+task.dueOn,'Task '+task.id,'#tasks')
 for(const risk of renewal.riskReasons)add('open-risk',risk,renewal.sourceReference,'#health')
 if(health.status==='at-risk')add('health-risk','Current account health is at risk.',health.reasons.join(' '),'#health')
 if(health.status==='unknown')add('health-gap','Current health evidence is incomplete.',health.reasons.join(' '),'#health')
 if(renewal.sourceKind==='stripe-test'&&!image.billing?.available)add('billing-unavailable','Current billing verification is unavailable.','Reconnect or refresh the billing source.','/app/billing')
 if(renewal.outcome&&renewal.outcome!=='deferred'&&renewal.billingReconciliation!=='matched')add('billing-mismatch',renewal.billingReconciliation==='mismatch'?'Stripe does not match the approved renewal terms.':'Approved renewal terms await a new billing observation.',renewal.billingActual?.sourceReference??renewal.sourceReference,'/app/renewals?renewal='+encodeURIComponent(renewalId)+'#renewal-record')
 const startsOn=new Date(Date.parse(renewal.renewalDate)-120*86400000).toISOString().slice(0,10)
 const proof=await digest(JSON.stringify({raw:row.snapshot,on,plans,health}))
 const milestones=[{title:flags.some(f=>f.kind==='departed-champion')?'Replace the departed champion and confirm renewal authority':'Review renewal authority with the customer',dueOn:renewal.noticeDeadline??renewal.renewalDate},{title:'Confirm success-plan goals and unresolved obligations',dueOn:renewal.noticeDeadline??renewal.renewalDate},{title:'Review terms and the notice decision',dueOn:renewal.noticeDeadline??renewal.renewalDate},{title:'Verify approved terms reached billing',dueOn:renewal.renewalDate}]
 return {raw:row.snapshot,on,proof,image,state:{renewalId,accountId,startsOn,active:on>=startsOn&&on<=renewal.renewalDate,terms:{renewalDate:renewal.renewalDate,noticeDeadline:renewal.noticeDeadline,expectedArrMinor:renewal.expectedArrMinor,currency:renewal.currency,sourceReference:renewal.sourceReference},flags,stakeholders:image.people,engagement:image.engagement,milestones,classification:['standard'],commercialClassification:['money','commitment'],billing:{status:renewal.billingReconciliation??'not-approved',expectedArrMinor:renewal.resultArrMinor??null,actual:renewal.billingActual??null,available:!!image.billing?.available},interpretation:'Readiness is current cited evidence, not a renewal prediction. A timeline is an internal draft until reviewed; internal approval does not confirm customer agreement or authorize billing changes.'}}
}
export async function readinessState(db:D1Database,actor:Actor,renewalId:string){
 if(actor.kind==='person')requirePerson(actor)
 const data=await readinessImage(db,renewalId)
 const timelines=(await stmt(db,'SELECT id,customer_id AS customerId,staff_id AS staffId,document,prepared_by AS preparedBy,prepared_at AS preparedAt,approved_by AS approvedBy,approved_at AS approvedAt,evidence_proof AS evidenceProof FROM buoy_renewal_timelines WHERE renewal_id=? ORDER BY prepared_at,id',renewalId).all<{id:string;customerId:string;staffId:string;document:string;preparedBy:string;preparedAt:string;approvedBy:string|null;approvedAt:string|null;evidenceProof:string}>()).results.map(({document,evidenceProof,...row})=>({...row,milestones:JSON.parse(document),current:evidenceProof===data.proof}))
 return {...data.state,revision:data.proof,timelines}
}
export async function saveStakeholderStatus(db:D1Database,actor:Actor,renewalId:string,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['revision','personId','status','observedOn','source'].includes(k)),'Unsupported stakeholder evidence property.')
 const current=await readinessImage(db,renewalId),personId=text(input.personId,'Stakeholder',100)
 insist(input.revision===current.proof,'Readiness evidence changed. Reload.',409)
 insist(current.image.people.some(p=>p.id===personId&&p.kind==='contact'),'Choose a contact on this account.')
 insist(input.status==='active'||input.status==='departed','Choose active or departed.')
 const observedOn=date(input.observedOn,'Observation date');insist(observedOn<=current.on,'Departure evidence cannot be future-dated.')
 const source=text(input.source,'Stakeholder evidence source')
 await db.batch([authority(db,actor,true),guard(db,'('+READINESS_SQL.replace(' AS snapshot','')+')=?',current.on,renewalId,current.raw),stmt(db,'INSERT INTO buoy_stakeholder_status(account_id,person_id,status,source,observed_on,revision,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account_id,person_id) DO UPDATE SET status=excluded.status,source=excluded.source,observed_on=excluded.observed_on,revision=excluded.revision,recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at',current.state.accountId,personId,input.status,source,observedOn,id(),actor.id,now()),stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),current.state.accountId),...accountAudit(db,actor,current.state.accountId,'renewal.stakeholder-evidence'),stmt(db,'DELETE FROM buoy_assertions')])
 return {status:'saved'}
}
export const readinessApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
readinessApi.get('/api/buoy/renewals/:id/readiness',async c=>c.json(await readinessState(c.env.DB,c.get('actor'),c.req.param('id'))))
readinessApi.put('/api/buoy/renewals/:id/stakeholder-status',async c=>c.json(await saveStakeholderStatus(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
