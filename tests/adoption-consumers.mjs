// ADOPT-001 consumer shards retain the full 90-day, 30-account fixture.
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
import {adoptionFixture,defineAdoption} from './adoption-fixture.mjs'
import {currentAdoption} from './adoption-current-fixture.mjs'
import {adoptionConsumers} from './adoption-consumer-journey.mjs'
import {healthScorecards} from './health-scorecard-journey.mjs'
import {healthScorecardBrowser} from './health-scorecard-browser.mjs'
import {adoptionAggregateAlerts} from './adoption-aggregate-journey.mjs'
const mode=process.argv[2]
assert.ok(['account','segment','health'].includes(mode),'Select an adoption consumer shard.')
const app=await startWorker()
try{
 const fixture=await adoptionFixture(app,{count:mode==='health'?2:30})
 await defineAdoption(fixture.api)
 await fixture.api('/adoption/definitions','POST',{kind:'feature',key:'customer_success_workspace_adoption_dashboard_weekly_reporting_automation',name:'Workspace reporting adoption',events:['Report generated']})
 await currentAdoption(fixture,'consumer-shard-'+mode)
 assert.equal((await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'consumer-member@example.test',displayName:'CS colleague',role:'member'}})).status,202)
 const member=await app.signIn('consumer-member@example.test')
 if(mode==='health'){const result=await healthScorecards(app,fixture,member);await healthScorecardBrowser(app,fixture,result)}
 else await (mode==='account'?adoptionConsumers:adoptionAggregateAlerts)(app,fixture,member)
}finally{await app.close()}
