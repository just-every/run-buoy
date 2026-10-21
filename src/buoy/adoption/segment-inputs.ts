import { BASE, SUBJECTS, COUNTS, DEFINITIONS, FIRST_VALUE } from './queries'
import { metricReader, type SubjectRow, type CountRow, type DefinitionRow, type FirstRow } from './metrics'
import type { AdoptionMetrics } from './types'

// Reuse the report SQL with today's inclusive UTC windows and no caller filter.
// Aggregate inputs share the segment's single image and transaction fence.
const base=BASE.replace('SELECT ? AS accountId,? AS personId,? AS segmentId,julianday(?) AS until',"SELECT NULL AS accountId,NULL AS personId,NULL AS segmentId,julianday(date('now','+1 day')) AS until")
const rows=(query:string,columns:string[])=>{
 const body=query.slice(BASE.length).trimStart(),select=body.startsWith(',')?'WITH '+body.slice(1):body
 return `json((SELECT json_group_array(json_object(${columns.map(c=>`'${c}',${c}`).join(',')})) FROM (${select}) WHERE scope IN ('account','person')))`
}
export const measuredSnapshot=`${base} SELECT json_object(
 'on',date('now'),
 'subjects',${rows(SUBJECTS,['scope','id','name','kind','accountIds','seats'])},
 'counts',${rows(COUNTS,['scope','id','period','dau','wau','mau','eventCount'])},
 'used',${rows(DEFINITIONS,['scope','id','period','kind','key','name','people'])},
 'first',${rows(FIRST_VALUE,['scope','id','people','meanSeconds'])},
 'definitions',json((SELECT json_group_array(json_object('kind',kind,'key',key)) FROM (SELECT kind,key FROM buoy_adoption_definitions ORDER BY kind,key)))
 )`
// Aggregate metrics are needed only by an enabled segment alert. Ordinary
// account/person health and membership rules retain their existing report image.
export const consumerMeasuredSnapshot=measuredSnapshot.replaceAll("WHERE scope IN ('account','person')",`WHERE scope IN ('account','person',CASE WHEN EXISTS(
 SELECT 1 FROM buoy_adoption_consumers WHERE json_extract(document,'$.enabled')=1 AND json_extract(document,'$.scope')='segment') THEN 'segment' END)`)
export interface AdoptionImage {on:string;subjects:SubjectRow[];counts:CountRow[];used:DefinitionRow[];first:FirstRow[];definitions:{kind:'feature'|'module';key:string}[]}
const numeric=['dau','wau','mau','eventCount','depth','breadth','utilization'] as const
export function adoptionRuleFields(image:AdoptionImage):Record<string,'number'>{
 const keys=[...(['current','previous'] as const).flatMap(period=>[
  ...numeric.map(key=>`${period}.${key}`),
  ...image.definitions.map(d=>`${period}.${d.kind}.${d.key}`)
 ]),'weeklyChange','weeklyDrop','firstValue.people','firstValue.meanSeconds']
 return Object.fromEntries(keys.map(key=>['adoption.'+key,'number']))
}
function values(metrics:AdoptionMetrics):Record<string,number|null>{
 const result:Record<string,number|null>={}
 for(const period of ['current','previous'] as const){
  for(const key of numeric)result[`adoption.${period}.${key}`]=metrics[period][key]
  for(const kind of ['feature','module'] as const)for(const item of metrics[period][kind==='feature'?'features':'modules'])result[`adoption.${period}.${kind}.${item.key}`]=item.fraction
 }
 return {...result,'adoption.weeklyChange':metrics.weeklyChange,'adoption.weeklyDrop':Number(metrics.weeklyDrop),
  'adoption.firstValue.people':metrics.firstValue.people,'adoption.firstValue.meanSeconds':metrics.firstValue.meanSeconds}
}
export function adoptionRuleValues(image:AdoptionImage){
 const read=metricReader(image.counts,image.used,image.first,image.definitions)
 return new Map(image.subjects.map(subject=>[`${subject.scope}:${subject.id}`,values(read(subject))]))
}

// Keep unrelated product doors cheap before an adoption rule is configured.
export const ADOPTION_SNAPSHOT=`SELECT CASE WHEN EXISTS (
 SELECT 1 FROM buoy_adoption_consumers WHERE json_extract(document,'$.enabled')=1 AND json_extract(document,'$.health')=1
 UNION ALL SELECT 1 FROM buoy_segments s,json_each(s.document,'$.rules.conditions') c
 WHERE json_extract(c.value,'$.field') LIKE 'adoption.%' OR json_extract(c.value,'$.field') LIKE 'people.%.adoption.%'
 ) THEN (${measuredSnapshot}) ELSE json_object('on',date('now'),'subjects',json('[]'),'counts',json('[]'),'used',json('[]'),'first',json('[]'),
 'definitions',json((SELECT json_group_array(json_object('kind',kind,'key',key)) FROM (SELECT kind,key FROM buoy_adoption_definitions ORDER BY kind,key)))) END`
