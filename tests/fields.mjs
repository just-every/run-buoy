import {startWorker} from './worker.mjs'
import {fieldJourney} from './field-journey.mjs'
import assert from 'node:assert/strict'
const app=await startWorker(),{cookie,request,signIn}=app
try{
 const call=(path,method='GET',body,extra={})=>request('/api/buoy'+path,{method,body,cookie,...extra})
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 await request('/auth/invite',{method:'POST',cookie,body:{email:'member@example.test',displayName:'CS colleague',role:'member'}})
 const member=await signIn('member@example.test'),today=new Date().toISOString().slice(0,10)
 const account=(id='harbour')=>({id,name:'Harbour Software',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed order form',billing:null,support:{observedAt:today,reference:'Support record',openTickets:3,urgentTickets:1}})
 await fieldJourney({call,json,request,cookie,member,account,signIn})
 console.log('ACCOUNT-004 public HTTP field types, ten-account preview, formulas, explanations, history, native changes, segments and erasure passed.')
}finally{await app.close()}
