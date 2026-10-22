import {localTime,taskTiming,DEFAULT_TASK_TIMING} from '../settings'
import {checkedValues,fieldWrites,fieldDiff} from './fields'
import {segmentFields} from '../segments'
import {hierarchyApprovalImage,hierarchyApprovalFence} from '../hierarchy-approval'
import {hasAggregateHealth} from '../adoption/consumers'
import {aggregateProof} from '../adoption/proof'
import {authority,guard,id,insist,now,stmt,requirePerson,text,type Actor} from '../core'
import {auditRecord,accountAudit} from '../audit-records'
import {snapshot,evaluated,fence} from '../segments/snapshot'
import {matches} from '../segments/rules'
import {definition,type Definition,type Step} from './model'
type Run={id:string;playbook_id:string;version_id:string;account_id:string;entry_key:string;owner_id:string;cursor:number;status:string;revision:string;account_revision:string;started_at:string;updated_at:string;due_at:string|null;error:string|null}
type Book={id:string;revision:string;document:string;enabled:number;published_at:string}
const active="status NOT IN('completed','exited')"
const getRun=async(db:D1Database,runId:string)=>{const r=await stmt(db,'SELECT * FROM buoy_playbook_runs WHERE id=?',runId).first<Run>();insist(r,'Playbook run not found.',404);return r}
const enabled=(db:D1Database,r:Run)=>guard(db,`EXISTS(SELECT 1 FROM buoy_playbook_runs r JOIN buoy_playbooks p ON p.id=r.playbook_id WHERE r.id=? AND r.revision=? AND p.enabled=1)`,r.id,r.revision)
const automation=(run:Run)=>({kind:'agent' as const,id:'playbook:'+run.id})
const inputs=(s:Step|undefined,values:Record<string,unknown>)=>Object.fromEntries((s?.rules?.conditions??[]).map(c=>[c.field,values[c.field]??null]))
const event=(db:D1Database,r:Run,status:string,at:string,values:Record<string,unknown>,result:Record<string,unknown>,attempt:number)=>stmt(db,'INSERT INTO buoy_playbook_events(id,run_id,step_index,attempt,status,inputs,result,recorded_at,event_seq) VALUES(?,?,?,?,?,?,?,?,(SELECT COALESCE(max(event_seq),0)+1 FROM buoy_playbook_events WHERE run_id=?))',id(),r.id,r.cursor,attempt,status,JSON.stringify(values),JSON.stringify(result),at,r.id)
async function transition(db:D1Database,r:Run,status:string,at:string,values:Record<string,unknown>,result:Record<string,unknown>,attempt:number,extra:D1PreparedStatement[]=[],cursor=r.cursor,due:string|null=null,error:string|null=null){
 await db.batch([enabled(db,r),...extra,event(db,r,status,at,values,result,attempt),stmt(db,'UPDATE buoy_playbook_runs SET status=?,cursor=?,revision=?,updated_at=?,due_at=?,error=? WHERE id=?',status,cursor,id(),at,due,error,r.id),stmt(db,'DELETE FROM buoy_assertions')])
}
export async function publish(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['id','revision','config'].includes(k)),'Unsupported publish field.')
 const validationImage=await snapshot(db),d=definition(input.config,segmentFields(validationImage.value)),bookId=input.id===undefined?id():text(input.id,'Playbook id',100),version=id(),at=now()
 for(const step of d.steps){
  if(step.kind==='fields')step.values=checkedValues(validationImage.value.custom.definitions,step.values!)
  if(step.kind==='playbook'){
   insist(step.playbookId!==bookId,'A playbook cannot directly start itself.')
   const child=await stmt(db,'SELECT revision FROM buoy_playbooks WHERE id=?',step.playbookId).first<{revision:string}>();insist(child,'Choose an existing child playbook.')
   step.playbookVersion??=child.revision
   insist(await stmt(db,'SELECT id FROM buoy_playbook_versions WHERE id=? AND playbook_id=?',step.playbookVersion,step.playbookId).first(),'Choose a version belonging to the child playbook.')
  }
 }
 const old=await stmt(db,'SELECT * FROM buoy_playbooks WHERE id=?',bookId).first<Book>()
 insist(old?input.revision===old.revision:input.revision==null,'Playbook changed. Reload before publishing.',409)
 insist((await stmt(db,'SELECT count(*) AS n FROM buoy_playbooks').first<{n:number}>())!.n<50||old,'At most 50 playbooks fit this installation.',409)
 if(d.trigger.kind==='segment')insist(await stmt(db,'SELECT id FROM buoy_segments WHERE id=?',d.trigger.segmentId).first(),'Entry segment not found.')
 await db.batch([authority(db,actor,true),fence(db,validationImage),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",d.ownerId),guard(db,old?'EXISTS(SELECT 1 FROM buoy_playbooks WHERE id=? AND revision=?)':'NOT EXISTS(SELECT 1 FROM buoy_playbooks WHERE id=?)',bookId,...(old?[old.revision]:[])),stmt(db,'INSERT INTO buoy_playbooks(id,revision,document,enabled,published_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,document=excluded.document,enabled=excluded.enabled,published_at=excluded.published_at',bookId,version,JSON.stringify(d),Number(d.enabled),at),stmt(db,'INSERT INTO buoy_playbook_versions(id,playbook_id,document,published_by,published_at) VALUES(?,?,?,?,?)',version,bookId,JSON.stringify(d),'person:'+actor.id,at),auditRecord(db,actor,'playbook.published',bookId),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:bookId,revision:version,config:d}
}
export async function enrollmentPlan(db:D1Database,actor:Actor|undefined,bookId:string,input:Record<string,unknown>,at=new Date(),versionId?:string,reviewImage?:Awaited<ReturnType<typeof snapshot>>){
 if(actor)requirePerson(actor)
 const key=text(input.operationKey,'Enrollment operation key',100),accountId=text(input.accountId,'Account',100),book=await stmt(db,'SELECT * FROM buoy_playbooks WHERE id=?',bookId).first<Book>()
 insist(book?.enabled,'Enable the playbook before enrollment.',409)
 const prior=await stmt(db,'SELECT id FROM buoy_playbook_runs WHERE playbook_id=? AND account_id=? AND entry_key=?',bookId,accountId,key).first<{id:string}>();if(prior)return {id:prior.id,replayed:true,versionId:null,guards:[] as D1PreparedStatement[],statements:[] as D1PreparedStatement[]}
 const selected=versionId?await stmt(db,'SELECT id,document FROM buoy_playbook_versions WHERE id=? AND playbook_id=?',versionId,bookId).first<{id:string;document:string}>():{id:book.revision,document:book.document};insist(selected,'Playbook version not found.',409)
 const d=JSON.parse(selected.document) as Definition,image=reviewImage??await snapshot(db),a=evaluated(image.value,at.toISOString().slice(0,10)).find(a=>a.account.id===accountId)
 insist(a,'Account not found.',404)
 insist(!d.entry||matches(d.entry,a.values,a.people),'Account does not meet entry criteria.',409)
 insist(!d.exit||!matches(d.exit,a.values,a.people),'Account already meets exit criteria.',409)
 const cutoff=new Date(at.getTime()-d.reentryDays*86400000).toISOString()
 const runId=id(),revision=id()
 const guards=[...(actor?[authority(db,actor,true)]:[]),fence(db,image),guard(db,"EXISTS(SELECT 1 FROM buoy_playbooks WHERE id=? AND revision=? AND enabled=1)",bookId,book.revision),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",d.ownerId),guard(db,`NOT EXISTS(SELECT 1 FROM buoy_playbook_runs WHERE playbook_id=? AND account_id=? AND (${active} OR started_at>?))`,bookId,accountId,cutoff)]
 const statements=[stmt(db,"INSERT INTO buoy_playbook_runs(id,playbook_id,version_id,account_id,entry_key,owner_id,status,revision,account_revision,started_at,updated_at) VALUES(?,?,?,?,?,?,'running',?,?,?,?)",runId,bookId,selected.id,accountId,key,d.ownerId,revision,a.account.revision,at.toISOString(),at.toISOString()),stmt(db,"INSERT INTO buoy_playbook_events(id,run_id,step_index,attempt,status,inputs,result,recorded_at,event_seq) VALUES(?,?,-1,1,'enrolled',?,?,?,0)",id(),runId,JSON.stringify({accountRevision:a.account.revision,trigger:d.trigger.kind}),JSON.stringify({actor:actor?'person:'+actor.id:'automation',version:selected.id}),at.toISOString()),...accountAudit(db,actor??{kind:'agent',id:'playbook:'+runId},accountId,'playbook.enrolled'),stmt(db,'DELETE FROM buoy_assertions')]
 return {id:runId,replayed:false,versionId:selected.id,guards,statements}
}
export async function enroll(db:D1Database,actor:Actor|undefined,bookId:string,input:Record<string,unknown>,at=new Date(),intakeFence:D1PreparedStatement[]=[],versionId?:string,effects?:(childId:string)=>D1PreparedStatement[]){
 const plan=await enrollmentPlan(db,actor,bookId,input,at,versionId)
 if(plan.replayed){insist(!effects,'The child launch operation already exists. Reload the parent run.',409);return {id:plan.id,replayed:true}}
 await db.batch([...intakeFence,...plan.guards,...plan.statements.slice(0,-1),...(effects?effects(plan.id):[]),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:plan.id,replayed:false}
}
export async function advance(db:D1Database,runId:string,clock=new Date()){
 const at=clock.toISOString()
 for(let tick=0;tick<33;tick++){
  const r=await getRun(db,runId)
  if(['completed','exited'].includes(r.status))return
  const book=await stmt(db,'SELECT enabled FROM buoy_playbooks WHERE id=?',r.playbook_id).first<{enabled:number}>();if(!book?.enabled)return
  const version=await stmt(db,'SELECT document FROM buoy_playbook_versions WHERE id=?',r.version_id).first<{document:string}>(),d=JSON.parse(version!.document) as Definition
  const image=await snapshot(db),a=evaluated(image.value,at.slice(0,10)).find(a=>a.account.id===r.account_id);if(!a)return
  const attempt=(await stmt(db,'SELECT COALESCE(max(attempt),1) AS n FROM buoy_playbook_events WHERE run_id=? AND step_index=?',r.id,r.cursor).first<{n:number}>())!.n
  if(d.exit&&matches(d.exit,a.values,a.people)){await transition(db,r,'exited',at,inputs({rules:d.exit} as Step,a.values),{reason:'Exit criteria satisfied'},attempt,[fence(db,image)]);return}
  if(r.status==='failed')return
  const s=d.steps[r.cursor]
  if(!s){await transition(db,r,'completed',at,{}, {reason:'All selected steps completed'},attempt,[fence(db,image)]);return}
  const values=inputs(s,a.values)
  const finish=async(result:Record<string,unknown>,next=s.next)=>transition(db,r,'running',at,values,{step:s.id,...result},attempt,[fence(db,image)],next)
  if(s.kind==='branch'){const matched=matches(s.rules!,a.values,a.people);await finish({matched,next:matched?s.next:s.otherwise},matched?s.next:s.otherwise);continue}
  if(s.kind==='wait'){
   if(r.status!=='waiting'){
    const due=new Date(clock.getTime()+s.seconds!*1000).toISOString()
    await transition(db,r,'waiting',at,values,{step:s.id,dueAt:due,timeoutAt:s.timeoutSeconds?new Date(clock.getTime()+s.timeoutSeconds*1000).toISOString():null},attempt,[fence(db,image)],r.cursor,due)
    continue
   }
   const started=await stmt(db,"SELECT result FROM buoy_playbook_events WHERE run_id=? AND step_index=? AND status='waiting' AND attempt=? ORDER BY event_seq DESC LIMIT 1",r.id,r.cursor,attempt).first<{result:string}>(),timeout=JSON.parse(started!.result).timeoutAt as string|null
   const ready=at>=r.due_at!&&(!s.rules||matches(s.rules,a.values,a.people))
   if(ready){await finish({waitSatisfied:true});continue}
   if(timeout&&at>=timeout)await transition(db,r,'failed',at,values,{step:s.id,error:'Wait condition was not satisfied before its timeout.'},attempt,[fence(db,image)],r.cursor,r.due_at,'Wait condition was not satisfied before its timeout.')
   return
  }
  if(s.kind==='task'){
   const link=await stmt(db,'SELECT p.id,p.status,p.account_revision FROM buoy_playbook_proposals x JOIN buoy_proposals p ON p.id=x.proposal_id WHERE x.run_id=? AND x.step_index=?',r.id,r.cursor).first<{id:string;status:string;account_revision:string}>()
   if(link?.status==='approved'){await finish({proposalId:link.id,taskCreated:true});continue}
   if(r.status==='approval')return
   if(!await stmt(db,"SELECT id FROM oa_operators WHERE id=? AND status='active'",r.owner_id).first()){await transition(db,r,'failed',at,{}, {step:s.id,error:'Run owner is inactive. Choose an active owner when retrying.'},attempt,[],r.cursor,null,'Run owner is inactive. Choose an active owner when retrying.');return}
   const timingRow=await stmt(db,"SELECT value FROM buoy_settings WHERE key='tasks'").first<{value:string}>(),timing=timingRow?JSON.parse(timingRow.value):DEFAULT_TASK_TIMING,on=localTime(timing.timeZone??null,clock).date
   const hierarchy=await hierarchyApprovalImage(db,r.account_id),adoptionProof=await hasAggregateHealth(db)?await aggregateProof(image.value,r.account_id):undefined
   const proposalId=id(),payload={title:s.title,dueDate:new Date(Date.parse(on)+s.dueDays!*86400000).toISOString().slice(0,10),ownerId:r.owner_id,priority:'medium',type:'general',playRun:r.id,playStep:r.cursor,playTimeZone:timing.timeZone??'UTC',...(hierarchy.proof?{hierarchyProof:hierarchy.proof}:{}),...(adoptionProof?{adoptionProof}:{})}
   await transition(db,r,'approval',at,{}, {step:s.id,proposalId,accountRevision:a.account.revision},attempt,[fence(db,image),guard(db,"COALESCE((SELECT value FROM buoy_settings WHERE key='tasks'),'')=?",timingRow?.value??''),hierarchyApprovalFence(db,hierarchy),stmt(db,"INSERT INTO buoy_proposals(id,account_id,kind,account_revision,snapshot,payload,status,prepared_by,prepared_at) VALUES(?,?,'playbook',?,?,?,'prepared',?,?)",proposalId,r.account_id,a.account.revision,JSON.stringify(a.account),JSON.stringify(payload),'playbook:'+r.playbook_id,at),stmt(db,'INSERT INTO buoy_playbook_proposals(run_id,step_index,proposal_id) VALUES(?,?,?) ON CONFLICT(run_id,step_index) DO UPDATE SET proposal_id=excluded.proposal_id',r.id,r.cursor,proposalId),stmt(db,'UPDATE buoy_playbook_runs SET account_revision=? WHERE id=?',a.account.revision,r.id),...accountAudit(db,automation(r),r.account_id,'playbook.step-prepared')]);return
  }
  if(s.kind==='approval'||s.kind==='external'||s.kind==='fields'||s.kind==='playbook'){
   const status=s.kind==='external'?'receipt':'approval';if(r.status===status)return
   await transition(db,r,status,at,{}, {step:s.id,title:s.title,channel:s.channel??null,externalWork:s.kind==='external',...(s.kind==='fields'?{changes:fieldDiff(image.value,r.account_id,s.values!)}:{}),...(s.kind==='playbook'?{childPlaybookId:s.playbookId,childVersion:s.playbookVersion}:{}),accountRevision:a.account.revision},attempt,[fence(db,image),stmt(db,'UPDATE buoy_playbook_runs SET account_revision=? WHERE id=?',a.account.revision,r.id)]);return
  }
 }
}
export async function act(db:D1Database,actor:Actor,runId:string,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['revision','action','reference','outcome','ownerId'].includes(k)),'Unsupported run action field.')
 const r=await getRun(db,runId);insist(input.revision===r.revision,'Run changed. Reload before acting.',409)
 const version=await stmt(db,'SELECT document FROM buoy_playbook_versions WHERE id=?',r.version_id).first<{document:string}>(),d=JSON.parse(version!.document) as Definition,s=d.steps[r.cursor],at=now()
 const attempt=(await stmt(db,'SELECT COALESCE(max(attempt),1) AS n FROM buoy_playbook_events WHERE run_id=? AND step_index=?',r.id,r.cursor).first<{n:number}>())!.n
 const image=await snapshot(db),a=evaluated(image.value,at.slice(0,10)).find(a=>a.account.id===r.account_id);insist(a,'Account no longer exists.',404)
 const extra=[authority(db,actor,true),fence(db,image)]
 if(input.action==='review'){
  insist(['approval','receipt'].includes(r.status),'Only pending work can be reviewed.',409)
  await transition(db,r,s.kind==='task'?'running':r.status,at,inputs(s,a.values),{reviewedBy:'person:'+actor.id,accountRevision:a.account.revision,...(s.kind==='fields'?{changes:fieldDiff(image.value,r.account_id,s.values!)}:{})},attempt,[...extra,stmt(db,'UPDATE buoy_playbook_runs SET account_revision=? WHERE id=?',a.account.revision,r.id)])
 }else if(input.action==='retry'){
  insist(r.status==='failed','Only a failed step can be retried.',409)
  const ownerId=input.ownerId===undefined?r.owner_id:text(input.ownerId,'Run owner',100)
  await transition(db,r,'running',at,{}, {retriedBy:'person:'+actor.id,previousAttempt:attempt},attempt+1,[...extra,guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",ownerId),stmt(db,'UPDATE buoy_playbook_runs SET owner_id=? WHERE id=?',ownerId,r.id)])
 }else{
  insist((input.action==='approve'&&(s.kind==='approval'||s.kind==='fields'||s.kind==='playbook')&&r.status==='approval')||(input.action==='receipt'&&s.kind==='external'&&r.status==='receipt'),'This step does not accept that action.',409)
  insist(a.account.revision===r.account_revision,'Account evidence changed. Review current inputs before acting.',409)
  insist(!d.exit||!matches(d.exit,a.values,a.people),'Exit criteria are met. Advance the run before acting.',409)
  const reference=text(input.reference,'Approval or external-work evidence',1000)
  if(s.kind==='fields')extra.push(...fieldWrites(db,actor,image.value,r.account_id,s.values!,reference))
  const failed=input.action==='receipt'&&input.outcome==='failed'
  if(input.action==='receipt')insist(input.outcome==='succeeded'||input.outcome==='failed','Choose succeeded or failed external work.')
  if(s.kind==='playbook'){
   await enroll(db,actor,s.playbookId!,{accountId:r.account_id,operationKey:'child:'+r.id+':'+r.cursor},new Date(),[enabled(db,r),...extra],s.playbookVersion,childId=>[
    event(db,r,'running',at,{}, {step:s.id,recordedBy:'person:'+actor.id,reference,childRunId:childId,childVersion:s.playbookVersion},attempt),
    stmt(db,'UPDATE buoy_playbook_runs SET parent_run_id=?,parent_step=? WHERE id=?',r.id,r.cursor,childId),
    stmt(db,"UPDATE buoy_playbook_runs SET status='running',cursor=?,revision=?,updated_at=?,due_at=NULL,error=NULL WHERE id=?",s.next,id(),at,r.id)
   ])
  }else await transition(db,r,failed?'failed':'running',at,inputs(s,a.values),{step:s.id,recordedBy:'person:'+actor.id,reference,outcome:input.outcome??'approved',providerVerified:false,...(s.kind==='fields'?{changedFields:Object.keys(s.values!)}:{})},attempt,extra,failed?r.cursor:s.next,null,failed?'External work was reported failed. Review the recorded evidence before retrying.':null)
 }
 if(s.kind==='fields'&&input.action==='approve'){const {recalculateScorecards}=await import('../scorecards');const {reconcile}=await import('../segments');await recalculateScorecards(db);await reconcile(db,actor)}
 await advance(db,runId)
 return getRun(db,runId)
}
export async function alertFailures(db:D1Database){
 const rows=(await db.prepare("SELECT v.id,v.document,min(r.account_id) AS accountId,count(*) AS n FROM buoy_playbook_versions v JOIN buoy_playbook_runs r ON r.version_id=v.id WHERE r.status='failed' GROUP BY v.id ORDER BY v.id").all<{id:string;document:string;accountId:string;n:number}>()).results
 // An alert episode closes only when the unresolved failed-run count falls below its threshold.
 const versions=(await db.prepare('SELECT * FROM buoy_playbook_alerts').all<{version_id:string;episode:number;opened:number}>()).results
 for(const old of versions){const row=rows.find(r=>r.id===old.version_id);if(!row||row.n<(JSON.parse(row.document) as Definition).failureThreshold)await stmt(db,'UPDATE buoy_playbook_alerts SET opened=0 WHERE version_id=?',old.version_id).run()}
 for(const row of rows){const d=JSON.parse(row.document) as Definition;if(row.n<d.failureThreshold)continue
  await stmt(db,'INSERT OR IGNORE INTO buoy_playbook_alerts(version_id) VALUES(?)',row.id).run()
  await db.batch([stmt(db,'UPDATE buoy_playbook_alerts SET opened=1,episode=episode+1 WHERE version_id=? AND opened=0',row.id),stmt(db,`INSERT OR IGNORE INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at) SELECT lower(hex(randomblob(16))),o.id,?,'signal','playbook-failure:'||a.version_id||':'||a.episode,'Playbook failure threshold crossed',?,? FROM buoy_playbook_alerts a CROSS JOIN oa_operators o WHERE a.version_id=? AND a.opened=1 AND o.status='active' AND o.role IN('owner','admin')`,row.accountId,`${d.name}: ${row.n} unresolved failed runs; threshold ${d.failureThreshold}. Review Playbooks on the account. Slack delivery is unavailable.`,now(),row.id)])
 }
}
export async function runPlaybooks(db:D1Database,clock=new Date()){
 const books=(await db.prepare('SELECT * FROM buoy_playbooks WHERE enabled=1 ORDER BY id').all<Book>()).results
 if(!books.length)return
 const image=await snapshot(db),accounts=evaluated(image.value,clock.toISOString().slice(0,10)),calendar=localTime((await taskTiming(db)).timeZone,clock).date
 for(const book of books){const d=JSON.parse(book.document) as Definition;if(d.trigger.kind==='manual'||d.trigger.kind==='webhook')continue
  for(const a of accounts){let matching=false
   if(d.trigger.kind==='rule')matching=matches(d.trigger.rules!,a.values,a.people)
   if(d.trigger.kind==='stage')matching=a.stage===d.trigger.stage
   if(d.trigger.kind==='contract-start'){const day=a.values['revenue.contractStart'];matching=typeof day==='string'&&(Date.parse(day)-Date.parse(calendar))/86400000===d.trigger.days}
   if(d.trigger.kind==='renewal')matching=(Date.parse(a.account.renewalDate)-Date.parse(calendar))/86400000===d.trigger.days
   if(d.trigger.kind==='segment')matching=image.value.entries.some(e=>e.accountId===a.account.id&&e.segmentId===d.trigger.segmentId&&!e.exitedAt)
   const previous=await stmt(db,'SELECT matching,interval_id FROM buoy_playbook_triggers WHERE playbook_id=? AND account_id=?',book.id,a.account.id).first<{matching:number;interval_id:string}>()
   const interval=matching&&!previous?.matching?id():previous?.interval_id??id()
   if(matching&&!previous?.matching){
    try{await enroll(db,undefined,book.id,{accountId:a.account.id,operationKey:'trigger:'+interval},clock)}catch(error){if(!(error instanceof Error)||!(/constraint|criteria|Re-enrollment|record or authority/i.test(error.message)))throw error}
   }
   await stmt(db,'INSERT INTO buoy_playbook_triggers(playbook_id,account_id,matching,interval_id) VALUES(?,?,?,?) ON CONFLICT(playbook_id,account_id) DO UPDATE SET matching=excluded.matching,interval_id=excluded.interval_id',book.id,a.account.id,Number(matching),interval).run()
  }
 }
 const runs=(await db.prepare(`SELECT id FROM buoy_playbook_runs WHERE ${active} ORDER BY COALESCE(checked_at,''),updated_at,id LIMIT 100`).all<{id:string}>()).results
 for(const run of runs){await advance(db,run.id,clock);await stmt(db,'UPDATE buoy_playbook_runs SET checked_at=? WHERE id=?',clock.toISOString(),run.id).run()}
 await alertFailures(db)
}
export async function playState(db:D1Database,actor:Actor,accountId?:string){
 requirePerson(actor)
 const books=(await db.prepare('SELECT * FROM buoy_playbooks ORDER BY published_at,id').all<Book>()).results
 const runs=(await stmt(db,`SELECT id,playbook_id,version_id,account_id,entry_key,owner_id,cursor,status,revision,account_revision,started_at,updated_at,due_at,error,parent_run_id,parent_step FROM buoy_playbook_runs ${accountId?'WHERE account_id=?':''} ORDER BY started_at DESC,id LIMIT 100`,...(accountId?[accountId]:[])).all<Run>()).results
 const events=await Promise.all(runs.map(async r=>({runId:r.id,events:(await stmt(db,'SELECT step_index AS stepIndex,attempt,status,inputs,result,recorded_at AS recordedAt FROM buoy_playbook_events WHERE run_id=? ORDER BY event_seq',r.id).all<{stepIndex:number;attempt:number;status:string;inputs:string;result:string;recordedAt:string}>()).results.map(e=>({...e,inputs:JSON.parse(e.inputs),result:JSON.parse(e.result)}))})))
 const versions=(await stmt(db,'SELECT id,document FROM buoy_playbook_versions WHERE id IN(SELECT value FROM json_each(?))',JSON.stringify(runs.map(r=>r.version_id))).all<{id:string;document:string}>()).results
 const links=(await db.prepare('SELECT * FROM buoy_playbook_proposals').all<{run_id:string;step_index:number;proposal_id:string}>()).results
 return {fields:segmentFields((await snapshot(db)).value),definitions:books.map(b=>({id:b.id,revision:b.revision,config:JSON.parse(b.document) as Definition})),runs:runs.map(r=>({...r,config:JSON.parse(versions.find(v=>v.id===r.version_id)!.document) as Definition,events:events.find(e=>e.runId===r.id)!.events,proposalId:links.find(x=>x.run_id===r.id&&x.step_index===r.cursor)?.proposal_id??null})),interpretation:'External work is performed outside Buoy and recorded by an owner/admin. A receipt is not provider verification or automatic delivery. Disabled playbooks freeze existing runs; earlier versions remain pinned.'}
}
