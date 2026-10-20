import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
import {usageJourney} from './usage-journey.mjs'
const app=await startWorker(),{request,cookie,signIn,dispatch,origin}=app
try{
 const call=(path,method='GET',body,extra={})=>request('/api/buoy'+path,{cookie,method,body,...extra})
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 await request('/auth/invite',{cookie,method:'POST',body:{email:'member@example.test',displayName:'CS colleague',role:'member'}})
 const member=await signIn('member@example.test')
 await usageJourney({call,json,request,cookie,member,signIn,dispatch,origin})
}finally{await app.close()}
