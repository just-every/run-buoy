import { date, insist } from '../core'
import { ATTRIBUTED, MAPPED_JOIN } from '../usage/mappings'
import type { AdoptionWindows } from './types'

const day=(value:number)=>new Date(value).toISOString().slice(0,10)
export function selection(query:URLSearchParams){
 insist([...query.keys()].every(key=>['on','accountId','personId','segmentId'].includes(key)),'Unsupported adoption filter.')
 insist([...new Set(query.keys())].every(key=>query.getAll(key).length===1),'Adoption filters must not repeat.')
 const on=date(query.get('on')??day(Date.now()),'Report date'),end=Date.parse(on)+86400000
 const filters=Object.fromEntries(['accountId','personId','segmentId'].map(key=>{
  const value=query.get(key);insist(value===null||(value.length>0&&value.length<=200),'Invalid adoption filter.');return [key,value]
 })) as {accountId:string|null;personId:string|null;segmentId:string|null}
 const window=(length:number,previous=false)=>({start:day(end-length*86400000*(previous?2:1)),end:day(end-length*86400000*(previous?1:0)-86400000)})
 const windows:AdoptionWindows={current:{day:window(1),week:window(7),month:window(30)},previous:{day:window(1,true),week:window(7,true),month:window(30,true)}}
 return {on,filters,windows,params:[filters.accountId,filters.personId,filters.segmentId,new Date(end).toISOString()]}
}
/** Scope membership is current and explicit. DISTINCT removes multi-account
 * duplication of one event in a person, segment or portfolio aggregate. */
export const BASE=`WITH filter AS (SELECT ? AS accountId,? AS personId,? AS segmentId,julianday(?) AS until),
 selected_accounts AS (
  SELECT a.id,json_extract(a.document,'$.name') AS name FROM buoy_accounts a,filter f
  WHERE (f.accountId IS NULL OR a.id=f.accountId)
   AND (f.personId IS NULL OR EXISTS(SELECT 1 FROM buoy_customer_memberships WHERE account_id=a.id AND person_id=f.personId))
   AND (f.segmentId IS NULL OR EXISTS(SELECT 1 FROM buoy_segment_entries WHERE account_id=a.id AND segment_id=f.segmentId AND exited_at IS NULL))
 ), scopes AS (
  SELECT 'summary' AS scope,'all' AS id,'All selected accounts' AS name,NULL AS kind
  UNION ALL SELECT 'account',id,name,NULL FROM selected_accounts
  UNION ALL SELECT 'person',p.id,p.name,p.kind FROM buoy_customer_people p,filter f
   WHERE (f.personId IS NULL OR p.id=f.personId) AND EXISTS(SELECT 1 FROM buoy_customer_memberships cm JOIN selected_accounts a ON a.id=cm.account_id WHERE cm.person_id=p.id)
  UNION ALL SELECT 'segment',s.id,json_extract(s.document,'$.name'),NULL FROM buoy_segments s,filter f WHERE f.segmentId IS NULL OR s.id=f.segmentId
 ), scope_accounts AS (
  SELECT 'summary' AS scope,'all' AS id,a.id AS accountId,NULL AS personId FROM selected_accounts a
  UNION ALL SELECT 'account',id,id,NULL FROM selected_accounts
  UNION ALL SELECT 'person',p.id,cm.account_id,p.id FROM scopes p JOIN buoy_customer_memberships cm ON cm.person_id=p.id JOIN selected_accounts a ON a.id=cm.account_id WHERE p.scope='person'
  UNION ALL SELECT 'segment',s.id,se.account_id,NULL FROM scopes s JOIN buoy_segment_entries se ON se.segment_id=s.id AND se.exited_at IS NULL JOIN selected_accounts a ON a.id=se.account_id WHERE s.scope='segment'
 ), observations AS (
  SELECT e.id,m.person_id AS personId,m.account_id AS accountId,e.type,e.event,julianday(e.observed_at) AS at
  FROM buoy_usage_events e ${MAPPED_JOIN},filter f
  WHERE ${ATTRIBUTED} AND e.user_id IS NOT NULL AND m.person_id IS NOT NULL AND julianday(e.observed_at)<f.until
   AND (f.personId IS NULL OR m.person_id=f.personId)
 ), scoped AS (
  SELECT DISTINCT sa.scope,sa.id,o.id AS eventId,o.personId,o.type,o.event,o.at
  FROM observations o JOIN scope_accounts sa ON sa.accountId=o.accountId AND (sa.personId IS NULL OR sa.personId=o.personId)
 ), periods AS (
  SELECT 'current' AS period,until AS dayEnd,until AS weekEnd,until AS monthEnd FROM filter
  UNION ALL SELECT 'previous',until-1,until-7,until-30 FROM filter
 )`
export const SUBJECTS=`${BASE}
 SELECT s.scope,s.id,s.name,s.kind,
  COALESCE((SELECT json_group_array(accountId) FROM (SELECT DISTINCT accountId FROM scope_accounts WHERE scope=s.scope AND id=s.id ORDER BY accountId)),'[]') AS accountIds,
  CASE WHEN s.scope='person' THEN NULL WHEN count(sa.accountId)>0 AND count(seats.seats)=count(sa.accountId) THEN sum(seats.seats) ELSE NULL END AS seats
 FROM scopes s LEFT JOIN scope_accounts sa ON sa.scope=s.scope AND sa.id=s.id LEFT JOIN buoy_adoption_seats seats ON seats.account_id=sa.accountId
 GROUP BY s.scope,s.id ORDER BY s.scope,s.name,s.id`
export const COUNTS=`${BASE}
 SELECT s.scope,s.id,p.period,
  count(DISTINCT CASE WHEN e.at>=p.dayEnd-1 AND e.at<p.dayEnd THEN e.personId END) AS dau,
  count(DISTINCT CASE WHEN e.at>=p.weekEnd-7 AND e.at<p.weekEnd THEN e.personId END) AS wau,
  count(DISTINCT CASE WHEN e.at>=p.monthEnd-30 AND e.at<p.monthEnd THEN e.personId END) AS mau,
  count(CASE WHEN e.at>=p.monthEnd-30 AND e.at<p.monthEnd THEN 1 END) AS eventCount
 FROM scopes s CROSS JOIN periods p LEFT JOIN scoped e ON e.scope=s.scope AND e.id=s.id AND e.type IN ('track','event') AND e.at>=p.monthEnd-30 AND e.at<p.dayEnd
 GROUP BY s.scope,s.id,p.period`
export const DEFINITIONS=`${BASE}
 SELECT s.scope,s.id,p.period,d.kind,d.key,d.name,count(DISTINCT e.personId) AS people
 FROM scopes s CROSS JOIN periods p CROSS JOIN buoy_adoption_definitions d
 LEFT JOIN scoped e ON e.scope=s.scope AND e.id=s.id AND e.type IN ('track','event') AND e.at>=p.monthEnd-30 AND e.at<p.monthEnd
  AND EXISTS(SELECT 1 FROM json_each(d.events) WHERE value=e.event)
 GROUP BY s.scope,s.id,p.period,d.kind,d.key ORDER BY d.kind,d.key`
export const FIRST_VALUE=`${BASE},
 identified AS (SELECT scope,id,personId,min(at) AS firstAt FROM scoped WHERE type='identify' GROUP BY scope,id,personId),
 valued AS (SELECT i.scope,i.id,i.personId,(min(e.at)-i.firstAt)*86400 AS seconds FROM identified i JOIN scoped e
  ON e.scope=i.scope AND e.id=i.id AND e.personId=i.personId AND e.at>i.firstAt AND e.type IN ('track','event')
  WHERE EXISTS(SELECT 1 FROM buoy_adoption_definitions d,json_each(d.events) j WHERE j.value=e.event)
  GROUP BY i.scope,i.id,i.personId)
 SELECT scope,id,count(*) AS people,avg(seconds) AS meanSeconds FROM valued GROUP BY scope,id`
