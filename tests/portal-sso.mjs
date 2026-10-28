import assert from 'node:assert/strict'
import {planFixture} from './plan-fixture.mjs'
import {portalIdentityEdge,cookies} from './portal-sso-provider.mjs'

export async function portalSsoJourney(){
 const instant=Date.UTC(2026,9,28,12),edge=portalIdentityEdge(instant)
 const f=await planFixture({clock:instant,bindings:edge.bindings,providerFetch:edge.fetch})
 try{
  await edge.link(f.app)
  const email=['synthetic-buoy-sso-customer','example.test'].join('@'),otherEmail=['synthetic-buoy-sso-other','example.test'].join('@')
  const plan=await f.save()
  await f.api('/portal-invitations','POST',{email,displayName:'Company SSO champion'})
  const stranger=await edge.signIn(f.app,['synthetic-buoy-sso-stranger','example.test'].join('@'),'synthetic-buoy-stranger')
  assert.equal(stranger.status,403);assert.equal((await f.app.request('/api/buoy/portal/home',{cookie:cookies(stranger)})).status,401)
  const accepted=await edge.signIn(f.app,email,'synthetic-buoy-company-champion');assert.equal(accepted.status,303,await accepted.clone().text())
  const customerCookie=cookies(accepted)
  assert.equal((await f.app.request('/api/buoy/state',{cookie:customerCookie})).status,403,'SSO invitation acceptance retains customer-only separation before sharing')
  const grant=await f.api('/accounts/'+f.accountId+'/portal-sharing','POST',{planId:plan.id,planRevision:plan.revision,email,days:30,taskIds:[]})
  const read=()=>f.app.request('/api/buoy/portal/'+grant.id,{cookie:customerCookie})
  const response=await read();assert.equal(response.status,200);const view=await response.json()
  assert.equal(view.name,'Customer success draft')
  const confirmed=await f.app.request('/api/buoy/portal/'+grant.id+'/action',{cookie:customerCookie,method:'POST',body:{revision:view.revision,action:'confirm',objectiveId:'statement',statement:'Company SSO authenticated this customer confirmation.'}});assert.equal(confirmed.status,201)
  assert.equal((await f.plans()).plans[0].objectives[1].status,'achieved')
  assert.equal((await f.app.request('/api/buoy/accounts/'+f.accountId+'/activity',{cookie:customerCookie})).status,403)
  await f.api('/portal-invitations','POST',{email:otherEmail,displayName:'Other company contact'})
  const switched=await edge.signIn(f.app,otherEmail,'synthetic-buoy-company-champion');assert.equal(switched.status,403,'A bound company identity cannot switch to another invited person')
  const other=await edge.signIn(f.app,otherEmail,'synthetic-buoy-other-customer');assert.equal(other.status,303)
  assert.equal((await f.app.request('/api/buoy/portal/'+grant.id,{cookie:cookies(other)})).status,403,'An authenticated company peer cannot read another customer grant')
  const stopped=await f.app.request('/auth/settings/identity',{cookie:f.app.cookie,method:'POST',body:{idpSignIn:false}});assert.equal(stopped.status,200)
  assert.equal((await read()).status,401,'Stopping company SSO revokes an already open provider session')
  assert.equal(edge.tokenCalls,4)
  console.log('PORTAL-001 company SSO links through the owner door, verifies signed identity, accepts only invited recipients, refuses subject switching and peer reads, and revokes open sessions. Provider edge only is synthetic.')
 }finally{await f.app.close()}
}
