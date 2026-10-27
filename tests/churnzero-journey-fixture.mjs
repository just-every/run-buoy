import {createHash} from 'node:crypto'
import {csvRows} from '../src/buoy/migrate/csv.ts'

// Deliberately synthetic preparation data, never a claimed vendor export schema.
export const journeyMapping={column:'Journey Definitions',id:'journey_id',name:'label',steps:'steps',stepId:'step_id'}
export const journeyDefinition={journey_id:'synthetic-buoy-journey-1',label:'Synthetic renewal review',revision:7,entry:{kind:'renewal',days:-30},steps:[{step_id:'synthetic-buoy-step-1',action:'task',assignedTo:'synthetic-buoy-owner-1',days:2},{step_id:'synthetic-buoy-step-2',action:'webhook',destination:'https://example.invalid/observe',dependsOn:['synthetic-buoy-step-1']}],enabled:true}
export const journeyPointers=['','/journey_id','/label','/revision','/entry','/entry/kind','/entry/days','/steps','/steps/0','/steps/0/step_id','/steps/0/action','/steps/0/assignedTo','/steps/0/days','/steps/1','/steps/1/step_id','/steps/1/action','/steps/1/destination','/steps/1/dependsOn','/steps/1/dependsOn/0','/enabled']
export function journeyBundle(input,definitions=[journeyDefinition]){
 const [header,...rows]=csvRows(input.csv)
 const prior=header.indexOf(journeyMapping.column)
 const nextHeader=prior<0?[...header,journeyMapping.column]:header
 const csv=[nextHeader,...rows.map(row=>prior<0?[...row,JSON.stringify(definitions)]:row.map((value,index)=>index===prior?JSON.stringify(definitions):value))].map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n'
 return {...input,csv,originalSha256:createHash('sha256').update(csv).digest('hex'),columns:{...input.columns,journeyDefinitions:journeyMapping}}
}
