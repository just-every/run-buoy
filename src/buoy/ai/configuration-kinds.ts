import {insist,object,type Actor} from '../core'
import {scorecardConfig} from '../scorecards/config'
import {inputImage} from '../scorecards/inputs'
import {publishScorecard} from '../scorecards'
import {storage} from '../scorecards/storage'
import {segmentInput,FIELDS} from '../segments/rules'
import {snapshot,tierNames} from '../segments/snapshot'
import {saveSegment,segmentFields} from '../segments'
import {definition} from '../play/model'
import {publish} from '../play/engine'
import {reportInput} from '../reports/model'
import {reportSource,saveReport} from '../reports'
export const kinds=['signal','scorecard','segment','playbook','report'] as const
export type Kind=typeof kinds[number]
// Only schema information leaves the installation. Record values and identities stay local.
export const schemas={
 signal:{name:'Risk signal',weeklyDropPercent:30,urgentTickets:1},
 scorecard:{name:'Support health',measures:[{key:'urgent',name:'Urgent tickets',field:'support.urgentTickets',min:0,max:10,weight:1,direction:'lower',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]},
 segment:{name:'Urgent support',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'support.urgentTickets',op:'gte',value:1}]},tier:null,stage:null,playbook:null},
 playbook:{name:'Review urgent support',enabled:false,reentryDays:30,failureThreshold:3,trigger:{kind:'manual'},entry:null,exit:null,steps:[{id:'review',kind:'task',title:'Review support evidence',dueDays:1,next:1}]},
 report:{name:'Accounts by health',object:'account',rules:{match:'all',conditions:[]},segmentId:null,groupBy:'health.status',measure:'count',operation:'count',formula:null,chart:'table',sharedRoles:[]},
}
export async function validateConfiguration(db:D1Database,actor:Actor,kind:Kind,input:unknown){
 const raw=object(input)
 if(kind==='scorecard'){const image=await inputImage(db,new Date());return scorecardConfig(raw,image.fields,image.segments)}
 if(kind==='segment'){const image=(await snapshot(db)).value;return segmentInput(raw,new Set(image.accounts.map(a=>a.id)),tierNames(image),segmentFields(image))}
 if(kind==='playbook'){
  insist(!Object.hasOwn(raw,'ownerId'),'The reviewing person owns a drafted playbook.')
  return definition({...raw,ownerId:actor.id},FIELDS)
 }
 if(kind==='report'){const src=await reportSource(db,actor);return reportInput(raw,src.catalog,src.ctx.roles)}
 insist(false,'Choose an available configuration kind.')
}
export async function publishConfiguration(db:D1Database,actor:Actor,kind:Kind,config:Record<string,unknown>,effects:(key:string)=>D1PreparedStatement[]){
 if(kind==='scorecard')return publishScorecard(db,actor,{revision:(await storage(db)).revision,config},effects)
 if(kind==='segment')return saveSegment(db,actor,config,effects)
 if(kind==='playbook')return publish(db,actor,{config},effects)
 if(kind==='report')return saveReport(db,actor,{spec:config},effects)
 insist(false,'Choose an available configuration kind.')
}
