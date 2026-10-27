import {createHash} from 'node:crypto'
import {csvRows} from '../src/buoy/migrate/csv.ts'

// Deliberately synthetic preparation data, never a claimed vendor export schema.
export const journeyMapping={column:'Journey Definitions',id:'journey_id',name:'label',steps:'steps',stepId:'step_id'}
export const journeyDefinition={journey_id:'synthetic-buoy-journey-1',label:'Synthetic renewal review',revision:7,entry:{kind:'renewal',days:-30},steps:[{step_id:'synthetic-buoy-step-1',action:'task',assignedTo:'synthetic-buoy-owner-1',days:2},{step_id:'synthetic-buoy-step-2',action:'webhook',destination:'https://example.invalid/observe',dependsOn:['synthetic-buoy-step-1']}],enabled:true}
export const journeyPointers=['','/journey_id','/label','/revision','/entry','/entry/kind','/entry/days','/steps','/steps/0','/steps/0/step_id','/steps/0/action','/steps/0/assignedTo','/steps/0/days','/steps/1','/steps/1/step_id','/steps/1/action','/steps/1/destination','/steps/1/dependsOn','/steps/1/dependsOn/0','/enabled']
export const structureMapping={column:'Journey Definitions',id:'Id',name:'Name',steps:'Milestones',stepId:'Id',schema:'churnzero-journey-v1'}
// Synthetic entity values using the public ChurnZero REST reference. The child
// arrays are a documented preparation join, not claimed vendor export columns.
export const structureDefinition={Id:101,Name:'Synthetic onboarding',Description:'synthetic-buoy-journey',ExpectedDuration:45,ProgressBottom:40,ProgressTop:50,IsActive:true,IsSharedExternally:true,Status:'Running',Milestones:[
 {Id:201,JourneyId:101,Name:'Requirements',Description:'synthetic-buoy-phase-1',ExpectedDuration:10,ProgressBottom:9,ProgressTop:12,Tasks:[{Id:301,JourneyMilestoneId:201,Subject:'Synthetic welcome call',IsConditional:false,IsOptional:false,IsExternallyVisible:true}],Achievements:[{Id:401,JourneyMilestoneId:201,Name:'Synthetic first login',IsConditional:true,IsOptional:true,IsExternallyVisible:false,Condition:{source:'synthetic-buoy-condition'}}]},
 {Id:202,JourneyId:101,Name:'Configuration',ExpectedDuration:20,ProgressBottom:18,ProgressTop:24,Tasks:[],Achievements:[]}
]}
export const expectedStructure={schema:'churnzero-journey-v1',description:'synthetic-buoy-journey',expectedDays:45,progress:{behindAfterDays:40,stuckAfterDays:50},milestones:[
 {sourceId:'201',name:'Requirements',description:'synthetic-buoy-phase-1',expectedDays:10,progress:{behindAfterDays:9,stuckAfterDays:12},tasks:[{sourceId:'301',name:'Synthetic welcome call',conditional:false,optional:false,externallyVisible:true}],achievements:[{sourceId:'401',name:'Synthetic first login',conditional:true,optional:true,externallyVisible:false}]},
 {sourceId:'202',name:'Configuration',description:null,expectedDays:20,progress:{behindAfterDays:18,stuckAfterDays:24},tasks:[],achievements:[]}
]}
export function journeyBundle(input,definitions=[journeyDefinition],mapping=journeyMapping){
 const [header,...rows]=csvRows(input.csv)
 const prior=header.indexOf(journeyMapping.column)
 const nextHeader=prior<0?[...header,journeyMapping.column]:header
 const csv=[nextHeader,...rows.map(row=>prior<0?[...row,JSON.stringify(definitions)]:row.map((value,index)=>index===prior?JSON.stringify(definitions):value))].map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n'
 return {...input,csv,originalSha256:createHash('sha256').update(csv).digest('hex'),columns:{...input.columns,journeyDefinitions:mapping}}
}
export const structureBundle=input=>journeyBundle(input,[structureDefinition],structureMapping)
