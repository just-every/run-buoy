import { date, insist } from '../core'
import { ATTRIBUTED, MAPPED_JOIN } from '../usage/mappings'
import { measuredSnapshot, consumerMeasuredSnapshot } from './segment-inputs'
import type { ConsumerAdoptionImage, ConsumerRule } from './consumers-model'

export const CONSUMER_SNAPSHOT=`SELECT json_group_array(json_patch(json(document),json_object('id',id,'revision',revision))) FROM (SELECT * FROM buoy_adoption_consumers ORDER BY created_at,id)`
// This embeds the report's metric image. Added metadata describes its sources
// and manual denominators; it does not calculate a second version of a metric.
export const CONSUMER_ADOPTION_SNAPSHOT=`SELECT json_patch(json((${measuredSnapshot})),json_object(
 'healthInputs',json((SELECT json_group_array(json_object('id',s.id,'name',json_extract(s.document,'$.name'),'revision',s.revision)) FROM (SELECT * FROM buoy_segments ORDER BY created_at,id) s WHERE EXISTS(SELECT 1 FROM buoy_adoption_consumers c WHERE json_extract(c.document,'$.enabled')=1 AND json_extract(c.document,'$.health')=1 AND json_extract(c.document,'$.scope')='segment' AND json_extract(c.document,'$.segmentId')=s.id))),
 'sources',json((SELECT json_group_array(json_object('id',id,'name',name,'kind',kind,'reference',reference,'eventCount',eventCount,'attributedEventCount',attributedEventCount,'lastObservedAt',lastObservedAt,'staleDays',staleDays,'freshness',CASE WHEN lastObservedAt IS NULL THEN 'missing' WHEN julianday(date('now'))-julianday(substr(lastObservedAt,1,10))>staleDays THEN 'stale' ELSE 'current' END)) FROM (
  SELECT s.id,s.name,s.kind,s.reference,s.stale_days AS staleDays,count(e.id) AS eventCount,max(e.observed_at) AS lastObservedAt,
   count(CASE WHEN ${ATTRIBUTED} AND e.user_id IS NOT NULL AND m.person_id IS NOT NULL THEN 1 END) AS attributedEventCount
  FROM buoy_usage_sources s LEFT JOIN buoy_usage_events e ON e.source_id=s.id AND julianday(e.observed_at)>=julianday(date('now','+1 day'))-60 AND julianday(e.observed_at)<julianday(date('now','+1 day'))
  ${MAPPED_JOIN} GROUP BY s.id ORDER BY s.name,s.id))),
 'seatEvidence',json((SELECT json_group_array(json_object('accountId',account_id,'seats',seats,'sourceSystem',source_system,'reference',reference,'observedAt',observed_at,'staleDays',stale_days,'freshness',CASE WHEN julianday(date('now'))-julianday(observed_at)>stale_days THEN 'stale' ELSE 'current' END)) FROM (SELECT * FROM buoy_adoption_seats ORDER BY account_id))),
 'personLicenses',json((SELECT json_group_array(json_object('accountId',account_id,'personId',person_id,'licensed',json(CASE WHEN licensed=1 THEN 'true' ELSE 'false' END),'sourceSystem',source_system,'reference',reference,'observedAt',observed_at,'staleDays',stale_days,'freshness',CASE WHEN julianday(date('now'))-julianday(observed_at)>stale_days THEN 'stale' ELSE 'current' END)) FROM (SELECT * FROM buoy_adoption_person_licenses ORDER BY account_id,person_id)))
 ))`
export const AGGREGATE_ADOPTION_SNAPSHOT=CONSUMER_ADOPTION_SNAPSHOT.replace(measuredSnapshot,consumerMeasuredSnapshot)
const IMAGE=`SELECT json_object('rules',json((${CONSUMER_SNAPSHOT})),'adoption',json((${CONSUMER_ADOPTION_SNAPSHOT})),
 'segments',json((SELECT json_group_array(json_object('id',s.id,'name',json_extract(s.document,'$.name'),'accountIds',json((SELECT json_group_array(account_id) FROM (SELECT account_id FROM buoy_segment_entries WHERE segment_id=s.id AND exited_at IS NULL ORDER BY account_id))))) FROM (SELECT * FROM buoy_segments ORDER BY created_at,id) s)),
 'owners',json((SELECT json_group_array(json_object('accountId',a.account_id,'personId',a.owner_id)) FROM buoy_account_owners a JOIN oa_operators o ON o.id=a.owner_id AND o.status='active' ORDER BY a.account_id))) AS snapshot`
const AGGREGATE_IMAGE=IMAGE.replace(CONSUMER_ADOPTION_SNAPSHOT,AGGREGATE_ADOPTION_SNAPSHOT)
export function consumerImageSql(on?:string,aggregate=false){
 const image=aggregate?AGGREGATE_IMAGE:IMAGE
 if(on===undefined)return image
 const day=date(on,'Adoption measurement date')
 return image.replaceAll("date('now','+1 day')",`date('${day}','+1 day')`).replaceAll("date('now')",`date('${day}')`)
}
const AGGREGATE_ENABLED="EXISTS(SELECT 1 FROM buoy_adoption_consumers WHERE json_extract(document,'$.enabled')=1 AND json_extract(document,'$.scope')='segment')"
export async function requestedImageSql(db:D1Database,on?:string,aggregate=false){
 if(!aggregate)return consumerImageSql(on)
 const row=await db.prepare(`SELECT ${AGGREGATE_ENABLED} AS enabled`).first<{enabled:number}>()
 insist(row,'Adoption measures unavailable.',503)
 const enabled=row.enabled===1
 // Refuse a concurrent enable/disable rather than measuring the wrong scope.
 return consumerImageSql(on,enabled)+` WHERE (${AGGREGATE_ENABLED})=${enabled?1:0}`
}
export interface ConsumerImage {rules:ConsumerRule[];adoption:ConsumerAdoptionImage;owners:{accountId:string;personId:string}[];segments:{id:string;name:string;accountIds:string[]}[]}
export async function consumerImage(db:D1Database,on?:string,aggregate=false){
 const sql=await requestedImageSql(db,on,aggregate),row=await db.prepare(sql).first<{snapshot:string}>()
 insist(row,'Adoption measures unavailable.',503)
 return {raw:row.snapshot,value:JSON.parse(row.snapshot) as ConsumerImage,sql}
}
