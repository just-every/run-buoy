import {Hono} from 'hono'
import type {Bindings} from '../auth.server'
import {jsonBody} from './access'
import {date,guard,id,insist,now,object,requirePerson,stmt,text,type Actor} from './core'
import {auditRecord} from './audit-records'
import {erasedIdentity,privacyFingerprint,replayKey} from './privacy/replay'
import {discover} from './privacy/discovery'
import {privacyImage as image} from './privacy/image'
import {holdSnapshot} from './privacy/snapshot'

export const owner=(db:D1Database,actor:Actor)=>{requirePerson(actor,true);return guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner')",actor.id)}
export async function privacyState(db:D1Database,actor:Actor,personId:string){
 requirePerson(actor,true)
 await replayKey(db)
 const results=await db.batch([owner(db,actor),stmt(db,'SELECT document FROM buoy_customer_holders WHERE person_id=?',personId),stmt(db,'DELETE FROM buoy_assertions')])
 const row=results[1].results[0] as {document:string}|undefined
 const hold=await stmt(db,'SELECT subject,actor,recorded_at AS recordedAt,reason FROM buoy_privacy_holds WHERE person_id=?',personId).first()
 return {holders:row?JSON.parse(row.document):[],hold,notice:'Owner-recorded external holders are not verified connections. Buoy does not erase or export from external systems. Preview exact name and email matches in usage properties, traits, context and native work notes before erasure. Retained source snapshots, other free text, existing archives and downloaded exports must be reviewed separately. Holds never release automatically.'}
}
export async function saveHolders(db:D1Database,actor:Actor,personId:string,input:Record<string,unknown>){
 requirePerson(actor,true)
 insist(Object.keys(input).every(k=>['revision','holders'].includes(k)),'Unsupported holder property.')
 insist(Array.isArray(input.holders)&&input.holders.length<=50,'List at most 50 external holders.')
 const holders=input.holders.map(raw=>{insist(raw&&typeof raw==='object'&&!Array.isArray(raw),'Each holder needs a system and reference.');const r=raw as Record<string,unknown>;insist(Object.keys(r).every(k=>['system','reference'].includes(k)),'Unsupported holder property.');return {system:text(r.system,'System name',100),reference:text(r.reference,'Holder evidence reference',1000)}})
 insist(new Set(holders.map(h=>h.system.toLowerCase())).size===holders.length,'External systems must be distinct.')
 const current=await image(db,personId)
 insist(current.person.revision===input.revision,'Customer person changed. Reload before continuing.',409)
 await db.batch([owner(db,actor),...current.fences(),stmt(db,'INSERT INTO buoy_customer_holders(person_id,document,revision) VALUES(?,?,?) ON CONFLICT(person_id) DO UPDATE SET document=excluded.document,revision=excluded.revision',personId,JSON.stringify(holders),id()),stmt(db,'UPDATE buoy_customer_people SET revision=? WHERE id=?',id(),personId),auditRecord(db,actor,'customer.holders-recorded',current.subject),stmt(db,'DELETE FROM buoy_assertions')])
 return {status:'recorded'}
}
function requestRecord(input:unknown){
 const value=object(input)
 insist(Object.keys(value).every(k=>['verificationMethod','receivedDate','requesterReference'].includes(k)),'Unsupported verification record property.')
 insist(['verified-session','verified-offline','contractual-authority'].includes(String(value.verificationMethod)),'Record how the requester was verified.')
 const receivedDate=date(value.receivedDate,'Request received date')
 insist(receivedDate<=now().slice(0,10),'Request received date cannot be in the future.')
 const requesterReference=text(value.requesterReference,'Opaque requester reference',36)
 insist(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requesterReference),'Use the UUID of the separately verified request; never a name or email.')
 return {verificationMethod:String(value.verificationMethod),receivedDate,requesterReference}
}
export async function privacyPreview(db:D1Database,actor:Actor,personId:string,input:Record<string,unknown>){
 requirePerson(actor,true)
 insist(Object.keys(input).every(k=>['revision','emails'].includes(k)),'Unsupported preview property.')
 const current=await image(db,personId)
 insist(current.person.revision===input.revision,'Customer person changed. Reload before continuing.',409)
 const replay=await replayKey(db),discovery=await discover(db,replay.key,current.person,input.emails??[])
 await db.batch([owner(db,actor),...current.fences(),discovery.guard(),stmt(db,'DELETE FROM buoy_assertions')])
 return {fingerprint:await privacyFingerprint(replay.key,[current.raw,discovery.raw,discovery.terms]),matches:discovery.matches,
  held:current.data.hold.length>0||current.data.businessReviewHolds.length>0,counts:Object.fromEntries(Object.entries(current.data).filter(([k])=>!['hold','subject','usageSources','declaredHolders'].includes(k)).map(([k,v])=>[k,v.length])),
  notice:'Exact, case-sensitive name and email phrases only; longer words and identifiers remain unchanged. Review each selected replacement. Coverage: usage properties, traits and context; proposal titles, reasons and evidence; linked trust proposals and copied customer names; task titles, outcomes and evidence; renewal decision reasons and evidence; sentiment reasons; handover notes; account renewal, billing and support evidence references and their retained proposal copies. Native notes on an account containing held customer records are retained. Other source snapshots, other free text and external systems need separate review. A linked business review with held customer facts retains the affected customer until that hold is explicitly released.'}
}
export async function privacyHold(db:D1Database,actor:Actor,personId:string,input:Record<string,unknown>){
 requirePerson(actor,true)
 insist(Object.keys(input).every(k=>['revision','confirmation','operation','reason'].includes(k)),'Unsupported hold property.')
 const current=await image(db,personId)
 insist(current.person.revision===input.revision,'Customer person changed. Reload before continuing.',409)
 insist(input.confirmation===current.person.name,'Type the customer name to confirm the hold change.')
 insist(['set','release'].includes(String(input.operation)),'Choose set or release hold.')
 insist(['legal-obligation','contractual-retention','dispute','review-completed'].includes(String(input.reason)),'Choose a hold reason category.')
 const statements=[owner(db,actor),...current.fences()]
 if(input.operation==='set'){
  insist(!current.data.hold.length,'This customer already has a hold.',409)
  const snapshot=holdSnapshot(db,personId,current.raw)
  statements.push(stmt(db,'INSERT INTO buoy_privacy_holds(person_id,subject,actor,recorded_at,reason,snapshot) VALUES(?,?,?,?,?,?)',personId,current.subject,`person:${actor.id}`,now(),input.reason,snapshot.manifest),...snapshot.statements)
 }else{
  insist(current.data.hold.length,'This customer has no active hold.',409)
  statements.push(stmt(db,'DELETE FROM buoy_privacy_holds WHERE person_id=?',personId))
 }
 statements.push(stmt(db,'UPDATE buoy_customer_people SET revision=? WHERE id=?',id(),personId),auditRecord(db,actor,'customer.hold-'+(input.operation==='set'?'set':'released'),current.subject),stmt(db,'DELETE FROM buoy_assertions'))
 await db.batch(statements)
 return {status:input.operation==='set'?'held':'released'}
}
export async function privacyRequest(db:D1Database,actor:Actor,personId:string,input:Record<string,unknown>,action:'exported'|'erased'){
 requirePerson(actor,true)
 insist(Object.keys(input).every(k=>['revision','confirmation','request','fingerprint','emails','redactions'].includes(k)),'Unsupported privacy request property.')
 const current=await image(db,personId)
 insist(current.person.revision===input.revision,'Customer person changed. Reload before continuing.',409)
 insist(input.confirmation===current.person.name,'Type the customer name to confirm this privacy request.')
 const verified=requestRecord(input.request),replay=await replayKey(db)
 const reviewed=await discover(db,replay.key,current.person,input.emails??[]),discovery=action==='erased'?reviewed:null
 if(discovery)insist(input.fingerprint===await privacyFingerprint(replay.key,[current.raw,discovery.raw,discovery.terms]),'Privacy evidence changed. Preview and review again.',409)
 const held=!!(current.data.hold.length||current.data.businessReviewHolds.length)
 const selected=input.redactions??[]
 insist(Array.isArray(selected)&&selected.every(x=>typeof x==='string'),'Select reviewed redactions.')
 insist(action==='erased'||selected.length===0,'Export does not apply text replacements.')
 insist(!held||selected.length===0,'A held customer is retained; no redactions are applied.',409)
 const stamp=now(),receipt={id:id(),subject:current.subject,action:action==='erased'&&held?'erasure-held':action,actor:`person:${actor.id}`,recordedAt:stamp,
  externalHolders:[...new Set(current.holders.map(h=>h.system))],counts:Object.fromEntries(Object.entries(current.data).filter(([k])=>!['hold','declaredHolders','usageSources','subject'].includes(k)).map(([k,v])=>[k,v.length])),
  retained:held?Object.fromEntries(Object.entries(current.data).filter(([k])=>!['hold','subject'].includes(k)).map(([k,v])=>[k,v.length])):{},
  redacted:held?0:selected.length,unreviewedMatches:discovery?discovery.matches.length-selected.length:0,
  outcome:action==='exported'?'exported':held?'held':'erased',
  scope:'Current linked Buoy customer records; selected exact usage and native work-note matches only. A hold retains the whole customer, its baseline snapshot and captured later linked record versions until explicit release. Unselected or held matches, source snapshots, other free text, external systems and previously downloaded archives and exports are not changed.'}
 const statements=[owner(db,actor),...current.fences(),replay.guard()]
 statements.push(reviewed.guard())
 if(discovery)statements.push(...discovery.statements(selected as string[]))
 if(action==='erased'&&!held){
  const identities=[...new Map(current.data.usageMappings.filter(m=>m.user_id).map(m=>[JSON.stringify([m.source_id,m.user_id]),m])).values()]
  for(const m of identities)statements.push(stmt(db,'INSERT OR IGNORE INTO buoy_erased_usage_identities(source_id,identity_hash) VALUES(?,?)',m.source_id,await erasedIdentity(replay.key,String(m.source_id),String(m.user_id))))
  statements.push(stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id IN(SELECT account_id FROM buoy_customer_memberships WHERE person_id=?)',personId),stmt(db,'DELETE FROM buoy_success_plans WHERE customer_owner_id=?',personId),stmt(db,'DELETE FROM buoy_customer_people WHERE id=?',personId))
 }
 statements.push(stmt(db,'INSERT INTO buoy_privacy_receipts(id,subject,action,actor,recorded_at,document) VALUES(?,?,?,?,?,?)',receipt.id,receipt.subject,action,receipt.actor,stamp,JSON.stringify(receipt)),
  stmt(db,'INSERT INTO buoy_privacy_requests(id,subject,verification_method,received_date,requester_reference) VALUES(?,?,?,?,?)',receipt.id,receipt.subject,verified.verificationMethod,verified.receivedDate,verified.requesterReference),
  auditRecord(db,actor,action==='erased'&&held?'customer.erasure-held':'customer.'+action,receipt.subject),stmt(db,'DELETE FROM buoy_assertions'))
 await db.batch(statements)
 return action==='exported'?{receipt,format:'buoy-customer-export/v1',records:{...current.data,freeTextMatches:reviewed.matches}}: {receipt}
}
export const privacyApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
privacyApi.get('/api/buoy/privacy/receipts',async c=>{const actor=c.get('actor');requirePerson(actor,true);const result=await c.env.DB.batch([owner(c.env.DB,actor),stmt(c.env.DB,'SELECT document FROM buoy_privacy_receipts ORDER BY recorded_at DESC,id'),stmt(c.env.DB,'DELETE FROM buoy_assertions')]);return c.json({receipts:result[1].results.map(r=>JSON.parse(String((r as {document:string}).document)))})})
privacyApi.get('/api/buoy/customer-people/:id/privacy',async c=>c.json(await privacyState(c.env.DB,c.get('actor'),c.req.param('id'))))
privacyApi.put('/api/buoy/customer-people/:id/privacy/holders',async c=>c.json(await saveHolders(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
for(const [verb,action] of [['export','exported'],['erase','erased']] as const)privacyApi.post('/api/buoy/customer-people/:id/privacy/'+verb,async c=>c.json(await privacyRequest(c.env.DB,c.get('actor'),c.req.param('id')!,await jsonBody(c.req.raw),action)))

privacyApi.post('/api/buoy/customer-people/:id/privacy/preview',async c=>c.json(await privacyPreview(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
privacyApi.post('/api/buoy/customer-people/:id/privacy/hold',async c=>c.json(await privacyHold(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
privacyApi.get('/api/buoy/privacy/requests',async c=>{const actor=c.get('actor');requirePerson(actor,true);const result=await c.env.DB.batch([owner(c.env.DB,actor),stmt(c.env.DB,'SELECT id,subject,verification_method AS verificationMethod,received_date AS receivedDate,requester_reference AS requesterReference FROM buoy_privacy_requests ORDER BY id'),stmt(c.env.DB,'DELETE FROM buoy_assertions')]);return c.json({requests:result[1].results})})
