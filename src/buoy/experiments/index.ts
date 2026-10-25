import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {auditRecord} from '../audit-records'
import {authority,date,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {snapshot,evaluated,definitions,fence} from '../segments/snapshot'
import {enrollmentPlan,advance} from '../play/engine'
import {outcomeReport} from '../outcomes/report'
import {canonicalJson} from '../../modules/import-kit/src/d1/index.ts'

type Baseline={revision:string;segmentId:string;health:string;healthScore:number|null;arrMinor:number;currency:string;arrReference:string;customerSince:string;tenureDays:number;tenureField:string;asOf:string}
type Subject={account_id:string;pair_index:number;cohort:'enrolled'|'comparison';baseline:string;run_id:string|null}
type Experiment={id:string;request:string;document:string;revision:string;status:'proposed'|'approved';proposed_at:string;prepared_by:string;approved_by:string|null;approved_at:string|null;approval_reference:string|null;health_report_id:string|null;renewal_report_id:string|null;playbook_id:string|null}
const get=async(db:D1Database,key:string)=>{const row=await stmt(db,'SELECT * FROM buoy_experiments WHERE id=?',key).first<Experiment>();insist(row,'Experiment not found.',404);return row}
const subjects=async(db:D1Database,key:string)=>(await stmt(db,'SELECT * FROM buoy_experiment_accounts WHERE experiment_id=? ORDER BY pair_index,cohort',key).all<Subject>()).results
const safe=(input:Record<string,unknown>)=>{
 insist(Object.keys(input).every(k=>['name','segmentId','tenureField','pairs','windowDays','successMetric','intervention','operationKey'].includes(k)),'Unsupported experiment field. Pricing changes, service withholding and disadvantage are forbidden.')
 insist(input.intervention==='additional-check-in','Only an optional additional check-in is supported. Withholding contracted service or changing pricing is forbidden.')
 insist(input.successMetric==='healthy'||input.successMetric==='renewed','Choose healthy or renewed as the success metric before approval.')
}
export async function proposeExperiment(db:D1Database,actor:Actor,input:Record<string,unknown>){
 if(actor.kind==='person')requirePerson(actor)
 safe(input)
 const operationKey=text(input.operationKey,'Operation key',100),request=canonicalJson(input)
 const prior=await stmt(db,'SELECT id,request FROM buoy_experiments WHERE operation_key=?',operationKey).first<{id:string;request:string}>()
 if(prior){insist(prior.request===request,'Operation key belongs to another experiment.',409);return experimentReport(db,prior.id)}
 insist(Number.isInteger(input.pairs)&&Number(input.pairs)>=2&&Number(input.pairs)<=50,'Choose 2 to 50 matched pairs.')
 insist(Number.isInteger(input.windowDays)&&Number(input.windowDays)>=1&&Number(input.windowDays)<=365,'Choose 1 to 365 whole UTC days.')
 const image=await snapshot(db),on=now().slice(0,10),segmentId=text(input.segmentId,'Segment',100),segment=definitions(image.value).find(s=>s.id===segmentId)
 insist(segment,'Choose an existing segment.')
 const tenureField=text(input.tenureField,'Customer-since field',100)
 insist(image.value.custom.definitions.some(d=>'custom.'+d.key===tenureField&&d.type==='date'),'Customer tenure needs an existing typed customer-since date field.')
 const members=new Set(image.value.entries.filter(e=>e.segmentId===segmentId&&!e.exitedAt).map(e=>e.accountId))
 const candidates=evaluated(image.value,on).filter(a=>members.has(a.account.id)),groups=new Map<string,{accountId:string;baseline:Baseline}[]>(),excluded:{accountId:string;reason:string}[]=[]
 const decisions=(await db.prepare("SELECT DISTINCT account_id FROM buoy_decisions WHERE outcome='renewed'").all<{account_id:string}>()).results
 for(const a of candidates){
  const v=a.values,since=v[tenureField],amount=v['revenue.arrMinor'],currency=v['revenue.currency'],reference=v['revenue.reference']
  if(typeof since!=='string'||since>on||typeof amount!=='number'||typeof currency!=='string'||typeof reference!=='string'||v['revenue.status']!=='active'||v['health.status']==='unknown'||v['health.status']==='healthy'||decisions.some(d=>d.account_id===a.account.id)){
   excluded.push({accountId:a.account.id,reason:'Missing baseline factor, already healthy or already renewed.'});continue
  }
  date(since,'Customer since')
  const b:Baseline={revision:a.account.revision,segmentId,health:String(v['health.status']),healthScore:typeof v['health.score']==='number'?v['health.score']:null,arrMinor:amount,currency,arrReference:reference,customerSince:since,tenureDays:(Date.parse(on)-Date.parse(since))/86400000,tenureField,asOf:on}
  const key=canonicalJson([b.segmentId,b.health,b.healthScore,b.arrMinor,b.currency,b.tenureDays]);groups.set(key,[...(groups.get(key)??[]),{accountId:a.account.id,baseline:b}])
 }
 const pairs:{accountId:string;baseline:Baseline;pairIndex:number;cohort:'enrolled'|'comparison'}[]=[]
 // Randomize within exact strata before assigning one intervention and one holdout.
 // The persisted assignments, rather than a replayed random draw, are authoritative.
 for(const rows of groups.values()){
  const shuffled=rows.map(row=>({row,rank:crypto.randomUUID()})).sort((a,b)=>a.rank.localeCompare(b.rank)).map(r=>r.row)
  while(shuffled.length>=2&&pairs.length<Number(input.pairs)*2){const pairIndex=pairs.length/2;for(const cohort of ['enrolled','comparison'] as const)pairs.push({...shuffled.shift()!,pairIndex,cohort})}
 }
 insist(pairs.length===Number(input.pairs)*2,'Not enough comparable accounts. Exact segment, baseline health, native ARR currency and customer tenure matches are required.',409)
 const experimentId=id(),revision=id(),at=now(),document={name:text(input.name,'Experiment name',100),segmentId,segmentName:segment.name,tenureField,pairs:Number(input.pairs),windowDays:Number(input.windowDays),successMetric:input.successMetric,intervention:input.intervention,eligibleCount:candidates.length,excludedCount:excluded.length,unmatchedCount:candidates.length-excluded.length-pairs.length}
 await db.batch([authority(db,actor,actor.kind==='person',actor.kind==='agent'?'experiment.prepare':undefined),fence(db,image),
 stmt(db,"INSERT INTO buoy_experiments(id,operation_key,request,document,revision,status,proposed_at,prepared_by) VALUES(?,?,?,?,?,'proposed',?,?)",experimentId,operationKey,request,JSON.stringify(document),revision,at,actor.kind+':'+actor.id),
 ...pairs.map(p=>stmt(db,'INSERT INTO buoy_experiment_accounts(experiment_id,account_id,pair_index,cohort,baseline) VALUES(?,?,?,?,?)',experimentId,p.accountId,p.pairIndex,p.cohort,JSON.stringify(p.baseline))),
 auditRecord(db,actor,'experiment.proposed','experiment:'+experimentId),stmt(db,'DELETE FROM buoy_assertions')])
 return experimentReport(db,experimentId)
}
export async function approveExperiment(db:D1Database,actor:Actor,key:string,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['revision','reference'].includes(k)),'Approval accepts only the reviewed revision and leadership evidence.')
 const row=await get(db,key);insist(row.revision===input.revision,'Experiment changed. Review before approving.',409)
 const reference=text(input.reference,'Leadership approval evidence',1000)
 if(row.status==='approved')return experimentReport(db,key)
 const cohort=await subjects(db,key),d=JSON.parse(row.document),image=await snapshot(db),on=now().slice(0,10)
 insist(cohort.length===d.pairs*2,'A subject was erased. Prepare a new complete experiment.',409)
 for(const s of cohort){const b=JSON.parse(s.baseline) as Baseline,a=evaluated(image.value,on).find(a=>a.account.id===s.account_id);insist(a&&a.account.revision===b.revision&&a.values['health.status']===b.health&&(a.values['health.score']??null)===b.healthScore&&a.values['revenue.arrMinor']===b.arrMinor&&a.values['revenue.currency']===b.currency&&a.values[JSON.parse(row.document).tenureField]===b.customerSince&&image.value.entries.some(e=>e.segmentId===d.segmentId&&e.accountId===s.account_id&&!e.exitedAt),'Baseline evidence or segment membership changed. Prepare a new experiment.',409)}
 const at=new Date(),bookId=id(),version=id(),healthId=id(),renewalId=id()
 // This generated manual playbook only offers additive work. It has no field,
 // price, outbound, service-removal or automatic enrollment step.
 const config={name:d.name,ownerId:actor.id,enabled:true,reentryDays:365,failureThreshold:1,trigger:{kind:'manual'},entry:null,exit:null,steps:[{id:'check-in',kind:'task',title:'Offer an optional additional customer success check-in. Keep all contracted services unchanged.',dueDays:7,next:1}]}
 const book={id:bookId,revision:version,document:JSON.stringify(config),enabled:1,published_at:at.toISOString()}
 const plans=[]
 for(const s of cohort.filter(s=>s.cohort==='enrolled'))plans.push({subject:s,plan:await enrollmentPlan(db,actor,bookId,{accountId:s.account_id,operationKey:'experiment:'+key},at,undefined,image,book)})
 const statements=[authority(db,actor,true),guard(db,'(SELECT count(*) FROM buoy_playbooks)<50'),fence(db,image),guard(db,"EXISTS(SELECT 1 FROM buoy_experiments WHERE id=? AND revision=? AND status='proposed')",key,row.revision),
 stmt(db,'INSERT INTO buoy_playbooks(id,revision,document,enabled,published_at) VALUES(?,?,?,?,?)',bookId,version,book.document,1,book.published_at),
 stmt(db,'INSERT INTO buoy_playbook_versions(id,playbook_id,document,published_by,published_at) VALUES(?,?,?,?,?)',version,bookId,book.document,'person:'+actor.id,book.published_at)]
 for(const kind of ['healthy','renewed'] as const){const reportId=kind==='healthy'?healthId:renewalId;statements.push(stmt(db,'INSERT INTO buoy_outcomes(id,document,started_at,deadline,created_by,operation_key) VALUES(?,?,?,?,?,?)',reportId,JSON.stringify({name:d.name+' '+kind,segmentId:d.segmentId,segmentName:d.segmentName,kind,windowDays:d.windowDays}),at.toISOString(),new Date(at.getTime()+d.windowDays*86400000).toISOString(),actor.id,'experiment:'+key+':'+kind))
 for(const s of cohort)statements.push(stmt(db,'INSERT INTO buoy_outcome_accounts(report_id,account_id,cohort,baseline_revision) VALUES(?,?,?,?)',reportId,s.account_id,s.cohort,(JSON.parse(s.baseline) as Baseline).revision))}
 for(const {subject,plan}of plans)statements.push(...plan.guards,...plan.statements,stmt(db,'UPDATE buoy_experiment_accounts SET run_id=? WHERE experiment_id=? AND account_id=?',plan.id,key,subject.account_id),stmt(db,'UPDATE buoy_outcome_accounts SET run_id=? WHERE report_id IN(?,?) AND account_id=?',plan.id,healthId,renewalId,subject.account_id))
 statements.push(stmt(db,"UPDATE buoy_experiments SET status='approved',approved_by=?,approved_at=?,approval_reference=?,health_report_id=?,renewal_report_id=?,playbook_id=? WHERE id=?",'person:'+actor.id,at.toISOString(),reference,healthId,renewalId,bookId,key),auditRecord(db,actor,'experiment.approved','experiment:'+key),stmt(db,'DELETE FROM buoy_assertions'))
 await db.batch(statements)
 for(const {plan}of plans)await advance(db,plan.id)
 return experimentReport(db,key)
}
// Newcombe's difference of Wilson score intervals stays nonzero at extreme
// rates and is honest about uncertainty for small binary-outcome cohorts.
function wilson(successes:number,n:number){const z=1.959963984540054,p=successes/n,den=1+z*z/n,mid=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [mid-half,mid+half]}
function estimate(report:Awaited<ReturnType<typeof outcomeReport>>){
 const a=report.enrolled,b=report.comparison
 if(!a.length||!b.length)return null
 const pa=report.rate,pb=report.comparisonRate,[la,ua]=wilson(a.filter(a=>a.reachedAt).length,a.length),[lb,ub]=wilson(b.filter(a=>a.reachedAt).length,b.length),difference=pa-pb
 return {difference,interval:[Math.max(-1,difference-Math.sqrt((pa-la)**2+(ub-pb)**2)),Math.min(1,difference+Math.sqrt((ua-pa)**2+(pb-lb)**2))],confidence:0.95,method:'Newcombe difference of Wilson score intervals',interventionN:a.length,holdoutN:b.length,report}
}
export async function experimentReport(db:D1Database,key:string){
 const row=await get(db,key),cohort=await subjects(db,key)
 return {id:row.id,revision:row.revision,status:row.status,...JSON.parse(row.document),proposedAt:row.proposed_at,preparedBy:row.prepared_by,approvedBy:row.approved_by,approvedAt:row.approved_at,approvalReference:row.approval_reference,playbookId:row.playbook_id,
 assignments:cohort.map(s=>({accountId:s.account_id,pairIndex:s.pair_index,cohort:s.cohort,baseline:JSON.parse(s.baseline),runId:s.run_id})),
 health:row.health_report_id?estimate(await outcomeReport(db,row.health_report_id)):null,renewal:row.renewal_report_id?estimate(await outcomeReport(db,row.renewal_report_id)):null,
 interpretation:'Observational matched comparison, not proof of causation or guaranteed retention. A health increase never proves retained revenue.',
 biases:['Only measured segment, baseline health, ARR and customer tenure are matched; unmeasured confounding and selection remain.','Recorded customer-since dates and confirmed ARR are operator evidence, not provider verification.','Small samples, incomplete observation windows, missing outcomes and contamination by other work can bias results.',
 'The descriptive 95 percent interval assumes independent binary observations; pair dependence and multiple comparisons are not adjusted.','Erasure removes subjects and evidence; surviving sample sizes and estimates can change.'],
 measurement:'First observed healthy evidence and new approved renewed decisions within the inclusive UTC window; task completion alone is not an outcome.'}
}
export const experimentsApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
experimentsApi.post('/api/buoy/experiments',async c=>c.json(await proposeExperiment(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
experimentsApi.post('/api/buoy/experiments/:id/approve',async c=>c.json(await approveExperiment(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
experimentsApi.get('/api/buoy/experiments/:id',async c=>{requirePerson(c.get('actor'));return c.json(await experimentReport(c.env.DB,c.req.param('id')))})
