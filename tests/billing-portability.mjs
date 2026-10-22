import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {billingFixtureKey,billingWebhookSecret} from './billing-fixture.mjs'

// Only public Worker doors seed domain records. The caller supplies the Stripe
// network-edge fixture; the real CLI later exports/imports the persisted D1.
export async function seedBillingPortability(call,request,cookie,source,connectionId){
 const accountId='synthetic-buoy-2200',on=new Date().toISOString().slice(0,10)
 await call('/accounts','POST',{id:accountId,name:'Portable Stripe billing account',renewalDate:new Date(Date.now()+365*86400000).toISOString().slice(0,10),noticeDays:30,renewalEvidence:'Synthetic portable Stripe order',billing:null,support:null})
 const base='/billing/'+connectionId,preview=await call(base+'/bindings/preview','POST',{customerId:'synthetic-buoy-101',accountId})
 await call(base+'/bindings','POST',{token:preview.token})
 await call(base+'/webhook-secret','PUT',{secret:billingWebhookSecret})
 const first=await call(base+'/sync','POST',{});assert.equal(first.status,'succeeded',first.error)
 source.amount=5500
 const event={id:'synthetic-buoy-2201',object:'event',livemode:false,type:'customer.subscription.updated',created:Math.floor(Date.now()/1000),data:{object:{id:'synthetic-buoy-301',object:'subscription',customer:'synthetic-buoy-101'}}},t=Math.floor(Date.now()/1000)
 const signature=`t=${t},v1=${createHmac('sha256',billingWebhookSecret).update(t+'.'+JSON.stringify(event)).digest('hex')}`
 const delivery=await request('/api/buoy'+base+'/webhook',{method:'POST',body:event,headers:{'stripe-signature':signature}})
 assert.equal(delivery.status,200,await delivery.clone().text())
 const billing=await call('/billing'),observation=billing.observations.find(o=>o.accountId===accountId)
 assert.equal(observation.document.revenue[0].arr.roundedMinor,198000)
 assert.ok(billing.history.filter(o=>o.accountId===accountId).length>=2)
 assert.ok(billing.changes.filter(c=>c.account_id===accountId).length>=2)
 assert.ok(observation.document.risks.some(r=>r.kind==='failed-payment'&&r.amountMinor===8500))
 assert.equal(observation.freshness,'Current')
 assert.equal(billing.connections.find(c=>c.id===connectionId).credential_present,1)
 assert.equal(billing.connections.find(c=>c.id===connectionId).webhook_present,1)
 const role=await call('/roles/definitions','POST',{revision:(await call('/roles')).revision,name:'Portable reviewed account reader',permissions:{read:'scope',commercialRead:'band'},scope:{kind:'own'},commercial:'band'})
 const email='synthetic-buoy-2202@example.test',invite=await request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'Portable reviewed colleague',role:'member'}})
 assert.equal(invite.status,202)
 const person=(await call('/roles')).people.find(p=>p.displayName==='Portable reviewed colleague');assert.ok(person)
 await call('/roles/assignments','PUT',{revision:(await call('/roles')).revision,personId:person.id,roleId:role.id,sharedAccountIds:[accountId],grants:{concessionLimitMinor:25000,renewalOutcome:true}})
 const roles=await call('/roles'),assignment=roles.assignments.find(a=>a.personId===person.id)
 assert.equal(assignment.roleId,role.id);assert.equal(assignment.grants.concessionLimitMinor,25000);assert.equal(assignment.grants.renewalOutcome,true)
 return {accountId,connectionId,roleId:role.id,personId:person.id,on}
}
const retainedObservation=({freshness,confidence,...observation})=>observation
export async function billingPortabilityImage(call,ids){
 const billing=await call('/billing'),roles=await call('/roles')
 return {...ids,billing,roles:{definitions:roles.roles,assignment:roles.assignments.find(a=>a.personId===ids.personId)}}
}
export function assertBillingArchiveRows(rows,image){
 for(const table of ['buoy_connection_credentials','buoy_billing_webhook_credentials','buoy_role_assignments'])assert.ok(!rows.some(row=>row.table===table),'Real archive excludes '+table+' authority')
 assert.ok(rows.some(row=>row.table==='buoy_role_definitions'&&row.row.id===image.roleId),'Real archive retains the custom permission definition')
 const snapshots=rows.filter(row=>row.table==='buoy_billing_snapshots'&&row.row.account_id===image.accountId)
 assert.equal(snapshots.length,image.billing.history.filter(o=>o.accountId===image.accountId).length)
 assert.ok(rows.some(row=>row.table==='buoy_billing_current'&&row.row.account_id===image.accountId&&row.row.snapshot_id===image.billing.observations.find(o=>o.accountId===image.accountId).id),'Real archive retains the current source pointer')
 assert.ok(rows.some(row=>row.table==='buoy_billing_bindings'&&row.row.account_id===image.accountId),'Real archive retains the explicit reviewed binding')
 assert.ok(rows.some(row=>row.table==='buoy_billing_changes'&&row.row.account_id===image.accountId),'Real archive retains the before/after plan history')
 const text=JSON.stringify(rows)
 for(const secret of [billingFixtureKey,billingWebhookSecret])assert.ok(!new RegExp('\\b'+secret+'\\b').test(text),'Neither provider API nor webhook signing credential appears in archive rows')
}
export async function assertBillingPortability(call,request,cookie,image){
 const billing=await call('/billing'),roles=await call('/roles'),before=image.billing
 assert.deepEqual(billing.bindings,before.bindings,'Reviewed Stripe customer/account bindings restore exactly')
 assert.deepEqual(billing.observations.map(retainedObservation),before.observations.map(retainedObservation),'Current Stripe snapshot IDs, source records and native minor amounts restore exactly')
 assert.deepEqual(billing.history.map(retainedObservation),before.history.map(retainedObservation),'Every immutable Stripe observation and source reference restores exactly')
 assert.deepEqual(billing.changes,before.changes,'Subscription changes and source snapshot links restore exactly')
 assert.deepEqual(billing.runs,before.runs,'Billing run counts, customer cursor and source status restore exactly')
 const connection=billing.connections.find(c=>c.id===image.connectionId),source=before.connections.find(c=>c.id===image.connectionId)
 assert.equal(connection.credential_present,0);assert.equal(connection.webhook_present,0);assert.equal(connection.freshness,'Reconnect required')
 assert.deepEqual({...connection,credential_present:source.credential_present,webhook_present:source.webhook_present,freshness:source.freshness},source,'Only installation-local authority and its displayed availability change')
 const observation=billing.observations.find(o=>o.accountId===image.accountId)
 assert.equal(observation.freshness,'Reconnect required');assert.match(observation.confidence,/Reduced.*Stripe billing reconnect required/)
 const health=(await call('/accounts/'+image.accountId+'/health')).health
 assert.match(health.reasons.join(' '),/Stripe billing evidence is reconnect required; dependent confidence is reduced/)
 assert.ok(health.evidence.some(e=>e.sourceSystem==='stripe-test'&&e.stale))
 assert.deepEqual(roles.roles,image.roles.definitions,'Custom permission definitions restore exactly')
 assert.deepEqual(roles.assignments,[],'Native-person profile assignments and named approval grants never restore')
 assert.ok(!roles.people.some(p=>p.id===image.personId),'No old native identity is recreated to revive its profile grants')
 assert.equal((await request('/api/buoy/billing/'+image.connectionId+'/sync',{cookie,method:'POST',body:{}})).status,409,'Restored observations cannot authorize a next source read')
 const event={id:'synthetic-buoy-2203',object:'event',livemode:false,type:'customer.subscription.updated',data:{object:{customer:'synthetic-buoy-101'}}},t=Math.floor(Date.now()/1000)
 const signature=`t=${t},v1=${createHmac('sha256',billingWebhookSecret).update(t+'.'+JSON.stringify(event)).digest('hex')}`
 assert.equal((await request('/api/buoy/billing/'+image.connectionId+'/webhook',{method:'POST',body:event,headers:{'stripe-signature':signature}})).status,409,'Old webhook authority cannot reconcile after restore')
 return billing
}
// Preserve the original archive fixture's full equality. The newly added source
// account alone gains a new revision/health image because authority is excluded.
export function assertBillingAwareAccounts(after,before,image){
 assert.deepEqual(after.filter(a=>a.id!==image.accountId),before.filter(a=>a.id!==image.accountId),'Every prior archive fixture account still restores exactly')
 const restored=after.find(a=>a.id===image.accountId),original=before.find(a=>a.id===image.accountId)
 const business=({revision,health,outlook,stripeBilling,...account})=>account
 assert.deepEqual(business(restored),business(original),'The new Stripe account business record restores exactly')
 const {credentialPresent,...source}=restored.stripeBilling,{credentialPresent:priorCredential,...priorSource}=original.stripeBilling
 assert.equal(credentialPresent,0);assert.equal(priorCredential,1);assert.deepEqual(source,priorSource,'All Stripe evidence persists while read authority is withheld')
 assert.ok(restored.health.reasons.some(r=>r.includes('Stripe billing evidence is reconnect required')))
 assert.notEqual(restored.revision,original.revision,'Restored source confidence recalculation invalidates old account approvals')
}
export function assertBillingAwareRevenue(after,before,image){
 const prior=before.accounts.find(a=>a.accountId===image.accountId),restored=after.accounts.find(a=>a.accountId===image.accountId)
 assert.deepEqual(after,{...before,accounts:before.accounts.map(a=>a.accountId===image.accountId?{...prior,revision:restored.revision}:a)},'All confirmed revenue and metadata restore exactly; only the new source account confidence revision changes')
}
export function assertBillingAwareScorecardHistory(after,before,image){
 const ids=new Set(before.map(row=>row.id)),retained=after.filter(row=>ids.has(row.id)),added=after.filter(row=>!ids.has(row.id))
 assert.deepEqual(retained,before,'Every retained calculation from the original archive restores exactly')
 assert.ok(added.length>0&&added.every(row=>row.accountId===image.accountId),'Only the restored Stripe account adds a confidence recalculation')
}
