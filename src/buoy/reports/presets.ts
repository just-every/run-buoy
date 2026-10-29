import {insist} from '../core'
import type {ReportSpec} from './model'

export const dashboardPresets=[
 {id:'portfolio-health',name:'Current portfolio health distribution',description:'Count current accounts in each health band, including unknown evidence.',groupBy:'health.status'},
 {id:'csm-book-size',name:'Current CSM book size',description:'Count current accounts by their assigned CSM, including unassigned accounts.',groupBy:'ownerId'},
] as const

export function presetReport(presetId:unknown,segmentId:unknown):ReportSpec{
 const preset=dashboardPresets.find(p=>p.id===presetId)
 insist(preset,'Choose an available starter dashboard.')
 insist(segmentId===null||typeof segmentId==='string'&&segmentId.length>0&&segmentId.length<=100,'Choose a current segment or all accounts.')
 return {name:preset.name,object:'account',rules:{match:'all',conditions:[]},segmentId:segmentId as string|null,groupBy:preset.groupBy,measure:'count',operation:'count',formula:null,chart:'bar',sharedRoles:[]}
}
