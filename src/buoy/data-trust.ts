import {Hono} from 'hono'
import type {Bindings} from '../auth.server'
import {jsonBody} from './access'
import {account,state} from './accounts'
import {accountAudit} from './audit-records'
import {authority,guard,id,insist,now,requirePerson,stmt,text,type Actor} from './core'
import {revenueState} from './revenue'
import {previewMapping,approveMapping} from './usage/mappings'
import {digest,only} from './usage/model'

interface Finding {kind:'duplicate'|'arr'|'stale'|'mapping';accountId:string;relatedAccountId:string|null;title:string;fix:string;evidence:Record<string,unknown>}
export interface TrustProposal extends Finding {id:string;fingerprint:string;status:string;preparedAt:string;reviewedAt:string|null;reviewedBy:string|null;reason:string|null}
export interface TrustPage {findings:Finding[];proposals:TrustProposal[]}
const normalized=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')
async function findings(db:D1Database,actor:Actor):Promise<Finding[]>{
 const native=await state(db,actor),revenue=await revenueState(db,actor),result:Finding[]=[],names=new Map<string,typeof native.accounts[number]>()
 for(const row of native.accounts){
  const other=names.get(normalized(row.name))
  if(other)result.push({kind:'duplicate',accountId:row.id,relatedAccountId:other.id,title:'Possible duplicate company',fix:'Review identity evidence and an undoable merge; keep both records until then.',evidence:{accounts:[{id:other.id,name:other.name,revision:other.revision},{id:row.id,name:row.name,revision:row.revision}],match:'Exact normalized name only; identity is unconfirmed.'}})
  else names.set(normalized(row.name),row)
  const stale=row.health.evidence.filter(source=>source.stale)
  if(stale.length)result.push({kind:'stale',accountId:row.id,relatedAccountId:null,title:'Stale health sources',fix:'Refresh the named sources and review health again.',evidence:{accountId:row.id,revision:row.revision,sources:stale,observations:{billing:row.billing,support:row.support},evaluatedOn:row.health.evaluatedOn}})
 }
 for(const row of revenue.reconciliation.filter(row=>row.status==='pending'))result.push({kind:'arr',accountId:row.accountId,relatedAccountId:null,title:'Contract and Stripe ARR disagree',fix:'Review both source references; correct the authoritative source outside this task. Neither amount is overwritten.',evidence:{...row}})
 return result
}
const fingerprint=(finding:Finding)=>digest(JSON.stringify(finding))
export async function trustState(db:D1Database,actor:Actor):Promise<TrustPage>{
 requirePerson(actor)
 const rows=await db.batch<Record<string,unknown>>([authority(db,actor,true),db.prepare('SELECT * FROM buoy_trust_proposals ORDER BY prepared_at DESC,id'),stmt(db,'DELETE FROM buoy_assertions')])
 return {findings:await findings(db,actor),proposals:rows[1].results.map(row=>({...JSON.parse(String(row.evidence)),id:row.id,fingerprint:row.fingerprint,status:row.status,preparedAt:row.prepared_at,reviewedAt:row.reviewed_at,reviewedBy:row.reviewed_by,reason:row.reason})) as TrustProposal[]}
}
async function prepareFinding(db:D1Database,actor:Actor,finding:Finding){
 const key=await fingerprint(finding),proposalId=id(),stamp=now()
 const prior=await stmt(db,'SELECT id FROM buoy_trust_proposals WHERE fingerprint=?',key).first<{id:string}>()
 if(prior)return prior
 const current=await account(db,finding.accountId)
 const writes=[authority(db,actor,true),guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',current.id,current.revision)]
 if(finding.relatedAccountId){const related=await account(db,finding.relatedAccountId);writes.push(guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',related.id,related.revision))}
 await db.batch([...writes,stmt(db,`INSERT INTO buoy_trust_proposals(id,account_id,related_account_id,kind,evidence,fingerprint,status,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,'prepared',?,?)`,proposalId,finding.accountId,finding.relatedAccountId,finding.kind,JSON.stringify(finding),key,actor.id,stamp),...accountAudit(db,actor,finding.accountId,'trust.prepared'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:proposalId}
}
export async function scanTrust(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor);only(input,[])
 const candidates=await findings(db,actor),prepared=[]
 for(const finding of candidates)prepared.push(await prepareFinding(db,actor,finding))
 return {proposals:prepared}
}
export async function proposeMappingFix(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor);only(input,['sourceId','userId','groupId','accountId','personId','reason'])
 const {reason,...claim}=input,reference=text(reason,'Source evidence and reason',2000)
 const preview=await previewMapping(db,actor,claim)
 insist(preview.source!.kind==='segment'&&preview.groupId!==null,'Choose an exact Segment group.')
 insist(preview.previous&&preview.previous.account_id!==preview.accountId,'Choose an existing mapping and a different reviewed account.',409)
 const finding:Finding={kind:'mapping',accountId:preview.accountId,relatedAccountId:String(preview.previous.account_id),title:'Segment group correction',fix:'Apply only the exact reviewed claim; retain original observations and refresh both accounts.',evidence:{claim,reference,preview}}
 return prepareFinding(db,actor,finding)
}
export async function reviewTrust(db:D1Database,actor:Actor,proposalId:string,input:Record<string,unknown>){
 requirePerson(actor);only(input,['decision','reason','ownerId','dueDate'])
 insist(input.decision==='approve'||input.decision==='reject','Choose approve or reject.')
 const reason=text(input.reason,'Review reason',2000),row=await stmt(db,'SELECT * FROM buoy_trust_proposals WHERE id=?',proposalId).first<Record<string,string>>()
 insist(row,'Data-trust proposal not found.',404)
 if(row.status!=='prepared'){
  insist(row.status===(input.decision==='approve'?'approved':'rejected'),'This proposal already has a different decision.',409)
  await db.batch([authority(db,actor,true),stmt(db,'DELETE FROM buoy_assertions')]);return {id:proposalId,status:row.status}
 }
 const finding=JSON.parse(row.evidence) as Finding,stamp=now(),status=input.decision==='approve'?'approved':'rejected'
 const writes=[authority(db,actor,true),guard(db,"EXISTS(SELECT 1 FROM buoy_trust_proposals WHERE id=? AND status='prepared' AND fingerprint=?)",proposalId,row.fingerprint),stmt(db,'UPDATE buoy_trust_proposals SET status=?,reviewed_by=?,reviewed_at=?,reason=? WHERE id=?',status,actor.id,stamp,reason,proposalId),...accountAudit(db,actor,row.account_id,`trust.${status}`)]
 if(input.decision==='reject'){await db.batch([...writes,stmt(db,'DELETE FROM buoy_assertions')]);return {id:proposalId,status}}
 if(finding.kind==='mapping'){
  const {claim,preview}=finding.evidence as {claim:Record<string,unknown>;preview:{fingerprint:string}}
  const fresh=await previewMapping(db,actor,claim)
  insist(fresh.fingerprint===preview.fingerprint,'Mapping evidence changed. Prepare a new correction.',409)
  await approveMapping(db,actor,{...claim,fingerprint:preview.fingerprint},writes)
 }else{
  const native=await account(db,row.account_id),related=finding.relatedAccountId?await account(db,finding.relatedAccountId):null
  const current=(await findings(db,actor)).find(value=>JSON.stringify(value)===JSON.stringify(finding))
  insist(current,'Source evidence changed. Scan and review again.',409)
  const ownerId=text(input.ownerId,'Fix task owner',200)
  const {date}=await import('./core'),dueDate=date(input.dueDate,'Fix task due date')
  writes.push(guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",ownerId),guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',native.id,native.revision))
  if(related)writes.push(guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',related.id,related.revision))
  // These are approved fix tasks, not approved merges or source-authority writes.
  writes.push(stmt(db,`INSERT INTO buoy_proposals(id,account_id,kind,account_revision,snapshot,payload,status,prepared_by,prepared_at,approved_by,approved_at) VALUES(?,?,'playbook',?,?,?,'approved',?,?,?,?)`,proposalId,native.id,native.revision,JSON.stringify(native),JSON.stringify({title:finding.title,dueDate,ownerId,trustFinding:proposalId}),'native-data-trust',row.prepared_at,`person:${actor.id}:${actor.displayName}`,stamp),stmt(db,`INSERT INTO buoy_tasks(id,account_id,proposal_id,title,due_date,owner_id,priority,type) VALUES(?,?,?,?,?,?,'medium','general')`,id(),native.id,proposalId,`${finding.title}: ${finding.fix}`,dueDate,ownerId))
  await db.batch([...writes,stmt(db,'DELETE FROM buoy_assertions')])
 }
 return {id:proposalId,status}
}
export const trustApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
trustApi.get('/api/buoy/trust',async c=>c.json(await trustState(c.env.DB,c.get('actor'))))
trustApi.post('/api/buoy/trust/scan',async c=>c.json(await scanTrust(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
trustApi.post('/api/buoy/trust/mappings',async c=>c.json(await proposeMappingFix(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
trustApi.post('/api/buoy/trust/:id/review',async c=>c.json(await reviewTrust(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
