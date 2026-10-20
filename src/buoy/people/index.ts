import { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { jsonBody } from '../access'
import { insist, type Actor } from '../core'
import { evaluatePeople, peopleProjection, personRuleFields, relatedPersonFields } from './model'
import { peopleImage } from './snapshot'
import { savePerson } from './records'
import { previewPersonField, savePersonField, savePersonValues } from './fields'
export { refreshPeople } from './fields'
export { PEOPLE_SNAPSHOT, peopleImage } from './snapshot'
export { evaluatePeople, personRuleFields, personRuleValues, relatedPersonFields } from './model'
export async function peopleState(db:D1Database,actor:Actor){
 insist(actor.kind==='person'&&['owner','admin','member'].includes(actor.role),'Customer people require a staff session.',403)
 const data=(await peopleImage(db)).value,records=evaluatePeople(data)
 const history=(await db.prepare('SELECT person_id AS personId,field_key AS key,old_value AS oldValue,new_value AS newValue,actor,source,recorded_at AS recordedAt FROM buoy_customer_history ORDER BY recorded_at DESC,id').all<{personId:string;key:string;oldValue:string;newValue:string;actor:string;source:string;recordedAt:string}>()).results
 return {definitions:data.definitions,records,accounts:peopleProjection(data,records),fields:relatedPersonFields(data.definitions),recordFields:personRuleFields(data.definitions),history:history.map(row=>({...row,oldValue:JSON.parse(row.oldValue),newValue:JSON.parse(row.newValue)}))}
}
export const peopleApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
peopleApi.get('/api/buoy/customer-people',async c=>c.json(await peopleState(c.env.DB,c.get('actor'))))
peopleApi.post('/api/buoy/customer-people',async c=>c.json(await savePerson(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
peopleApi.put('/api/buoy/customer-people/:id',async c=>c.json(await savePerson(c.env.DB,c.get('actor'),await jsonBody(c.req.raw),c.req.param('id'))))
peopleApi.get('/api/buoy/customer-fields',async c=>c.json(await peopleState(c.env.DB,c.get('actor'))))
peopleApi.post('/api/buoy/customer-fields/preview',async c=>c.json(await previewPersonField(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
peopleApi.post('/api/buoy/customer-fields',async c=>c.json(await savePersonField(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
peopleApi.put('/api/buoy/customer-people/:id/fields',async c=>c.json(await savePersonValues(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
