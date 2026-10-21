import {AGGREGATE_ADOPTION_SNAPSHOT,CONSUMER_ADOPTION_SNAPSHOT} from '../adoption/consumers-image'
import {date,insist} from '../core'
import {validateHealthInputs} from './dependencies'
import {includes} from './rules'
import {SNAPSHOT,definitions,evaluated,type Image} from './snapshot'
const literal=(value:unknown)=>"'"+JSON.stringify(value).replaceAll("'","''")+"'"

/** Derive health-input membership without publishing intermediate intervals.
 * The second read fences the complete layer-1 image; later writes fence the
 * complete resulting SQL image, including distinct aggregate calculations. */
export async function snapshot(db:D1Database,on?:string){
 const dated=(sql:string)=>on===undefined?sql:sql.replaceAll("date('now','+1 day')",`date('${date(on,'Measurement date')}','+1 day')`).replaceAll("date('now')",`date('${on}')`)
 let sql=dated(SNAPSHOT),row=await db.prepare(sql).first<{snapshot:string}>()
 insist(row,'Segment data unavailable.',503)
 const base=row.snapshot,image=JSON.parse(base) as Image
 const rules=image.consumers.filter(r=>r.enabled&&r.health&&r.scope==='segment')
 if(rules.length){
  const segments=definitions(image),inputs=new Set(rules.map(r=>r.segmentId)),accounts=evaluated(image,on??image.adoption.on,false)
  validateHealthInputs(segments,image.consumers)
  const memberships=segments.filter(s=>inputs.has(s.id)).flatMap(s=>accounts.filter(a=>includes(s,a.account.id,a.values,a.people)).map(a=>({segmentId:s.id,accountId:a.account.id})))
  const healthInputs=segments.filter(s=>inputs.has(s.id)).map(({id,name,revision})=>({id,name,revision}))
  const relation=`(SELECT segment_id,account_id,exited_at FROM buoy_segment_entries WHERE segment_id NOT IN (SELECT value FROM json_each(${literal([...inputs])})) UNION ALL SELECT json_extract(value,'$.segmentId'),json_extract(value,'$.accountId'),NULL FROM json_each(${literal(memberships)}))`
  const aggregate=`SELECT json_patch(json((${AGGREGATE_ADOPTION_SNAPSHOT.replaceAll('buoy_segment_entries',relation)})),json_object('healthInputs',json(${literal(healthInputs)})))`
  sql=dated(SNAPSHOT.replace(CONSUMER_ADOPTION_SNAPSHOT,aggregate))
  row=await db.prepare(`${sql} WHERE (${dated(SNAPSHOT)})=?`).bind(base).first<{snapshot:string}>()
  insist(row,'Adoption inputs changed. Refresh before reading.',409)
 }
 return {raw:row.snapshot,sql,value:JSON.parse(row.snapshot) as Image}
}
