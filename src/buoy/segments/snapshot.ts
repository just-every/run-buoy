import { guard, insist } from '../core'
import { health, noticeDate, type Account, type Sentiment } from '../health'
import { DEFAULT_STALENESS } from '../settings'
import { TIERS, type Segment, type Values } from './rules'
// One SQL image fences every rule input and the previous membership intervals.
export const SNAPSHOT = `SELECT json_object(
 'accounts',json((SELECT json_group_array(json_object('id',id,'document',document,'revision',revision,'createdAt',created_at)) FROM (SELECT * FROM buoy_accounts ORDER BY id))),
 'segments',json((SELECT json_group_array(json_object('id',id,'document',document,'revision',revision,'createdAt',created_at)) FROM (SELECT * FROM buoy_segments ORDER BY created_at,id))),
 'classifications',json((SELECT json_group_array(json_object('accountId',account_id,'tier',tier,'stage',stage,'tierManual',tier_manual,'stageManual',stage_manual)) FROM (SELECT * FROM buoy_classifications ORDER BY account_id))),
 'owners',json((SELECT json_group_array(json_object('accountId',account_id,'ownerId',owner_id)) FROM (SELECT * FROM buoy_account_owners ORDER BY account_id))),
 'territories',json((SELECT json_group_array(json_object('accountId',account_id,'territory',territory)) FROM (SELECT * FROM buoy_account_territories ORDER BY account_id))),
 'sentiments',json((SELECT json_group_array(json_object('accountId',account_id,'rating',rating,'reason',reason,'recordedBy',recorded_by,'recordedAt',recorded_at,'expiresOn',expires_on)) FROM (SELECT * FROM buoy_sentiments ORDER BY recorded_at,id))),
 'tasks',json((SELECT json_group_array(json_object('accountId',account_id,'completedAt',completed_at)) FROM (SELECT * FROM buoy_tasks ORDER BY id))),
 'entries',json((SELECT json_group_array(json_object('id',id,'segmentId',segment_id,'accountId',account_id,'enteredAt',entered_at,'exitedAt',exited_at,'proposalId',proposal_id)) FROM (SELECT * FROM buoy_segment_entries ORDER BY entered_at,id))),
 'tiers',(SELECT document FROM buoy_tiers WHERE singleton=1),
 'staleness',(SELECT value FROM buoy_settings WHERE key='staleness')
 ) AS snapshot`
interface Row {id:string;document:string;revision:string;createdAt:string}
interface Classification {accountId:string;tier:string|null;stage:string|null;tierManual:number;stageManual:number}
export interface Image {accounts:Row[];segments:Row[];classifications:Classification[];owners:{accountId:string;ownerId:string}[];territories:{accountId:string;territory:string}[];sentiments:(Sentiment&{accountId:string})[];tasks:{accountId:string;completedAt:string|null}[];entries:{id:string;segmentId:string;accountId:string;enteredAt:string;exitedAt:string|null;proposalId:string|null}[];staleness:string|null;tiers:string|null}
export async function snapshot(db:D1Database){const row=await db.prepare(SNAPSHOT).first<{snapshot:string}>();insist(row,'Segment data unavailable.',503);return {raw:row.snapshot,value:JSON.parse(row.snapshot) as Image}}
export const fence=(db:D1Database,raw:string)=>guard(db,`(${SNAPSHOT})=?`,raw)
export const tierNames=(image:Image):string[]=>image.tiers?JSON.parse(image.tiers):TIERS
export const definitions=(image:Image):Segment[]=>image.segments.map(row=>({...JSON.parse(row.document),id:row.id,revision:row.revision,createdAt:row.createdAt}))
export function accountValues(image:Image,on:string) {
 const limits=image.staleness?JSON.parse(image.staleness):DEFAULT_STALENESS
 return image.accounts.map(row=>{
  const a=JSON.parse(row.document) as Account,sentiment=image.sentiments.findLast(s=>s.accountId===a.id)??null,h=health(a,on,sentiment,limits),classification=image.classifications.find(c=>c.accountId===a.id)
  const values:Values={id:a.id,name:a.name,renewalDate:a.renewalDate,noticeDays:a.noticeDays,renewalEvidence:a.renewalEvidence,revision:row.revision,createdAt:row.createdAt,ownerId:image.owners.find(o=>o.accountId===a.id)?.ownerId??null,territory:image.territories.find(o=>o.accountId===a.id)?.territory??null,tier:classification?.tierManual?classification.tier:null,stage:classification?.stageManual?classification.stage:null,'health.status':h.status,'health.reasons':h.reasons.join('\n'),openTasks:image.tasks.filter(t=>t.accountId===a.id&&!t.completedAt).length,completedTasks:image.tasks.filter(t=>t.accountId===a.id&&t.completedAt).length,daysToRenewal:(Date.parse(a.renewalDate)-Date.parse(on))/86400000,noticeDate:noticeDate(a)}
  for(const kind of ['billing','support'] as const)if(a[kind])for(const [key,v] of Object.entries(a[kind]!))values[`${kind}.${key}`]=v
  if(a.billing)values['billing.balanceMinor']=a.billing.totalMinor-a.billing.creditsMinor-a.billing.allocatedMinor
  for(const e of h.evidence){values[`health.${e.kind}Missing`]=Number(e.missing);values[`health.${e.kind}Stale`]=Number(e.stale)}
  if(sentiment)for(const key of ['rating','reason','recordedBy','recordedAt','expiresOn'] as const)values[`sentiment.${key}`]=sentiment[key]
  return {account:{...a,revision:row.revision},values,classification}
 })
}
