import {guard,id,insist,stmt,type Actor} from '../core'
import type {ScorecardResult,ScorecardVersion} from './types'
export const CURRENT_SQL=`SELECT json_object('revision',c.revision,'versionId',c.version_id,'document',v.document,'publishedBy',v.published_by,'publishedAt',v.published_at) AS snapshot FROM buoy_scorecard_current c JOIN buoy_scorecard_versions v ON v.id=c.version_id WHERE c.singleton=1`
const RESULT_FENCE="json_object('accountId',account_id,'inputKey',input_key,'versionId',version_id,'calculatedAt',calculated_at)"
export const RESULTS_SQL=`SELECT json_group_array(json(${RESULT_FENCE})) AS snapshot FROM (SELECT * FROM buoy_scorecard_results ORDER BY account_id)`
export interface StoredResult {accountId:string;inputKey:string;document:string}
export async function storage(db:D1Database){
 const [head,result]=await Promise.all([db.prepare(CURRENT_SQL).first<{snapshot:string}>(),db.prepare(`SELECT account_id AS accountId,input_key AS inputKey,document,${RESULT_FENCE} AS resultFence FROM buoy_scorecard_results ORDER BY account_id`).all<StoredResult&{resultFence:string}>()])
 insist(result,'Scorecard results unavailable.',503)
 const current=head?JSON.parse(head.snapshot) as {revision:string;versionId:string;document:string;publishedBy:string;publishedAt:string}:null
 const published:ScorecardVersion|null=current?{...JSON.parse(current.document),id:current.versionId,revision:current.revision,publishedBy:current.publishedBy,publishedAt:current.publishedAt}:null
 return {revision:current?.revision??null,published,results:result.results as StoredResult[],rawResults:'['+result.results.map(row=>row.resultFence).join(',')+']'}
}
export function revisionFence(db:D1Database,revision:string|null){
 return revision===null?guard(db,'NOT EXISTS(SELECT 1 FROM buoy_scorecard_current WHERE singleton=1)'):guard(db,'EXISTS(SELECT 1 FROM buoy_scorecard_current WHERE singleton=1 AND revision=?)',revision)
}
export async function reader(db:D1Database,actor:Actor){
 insist(actor.kind==='person'&&['owner','admin','member'].includes(actor.role),'Only signed-in staff can read scorecards.',403)
 const allowed=await stmt(db,"SELECT id FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin','member')",actor.id).first()
 insist(allowed,'Only active staff can read scorecards.',403)
}
export async function inputKey(result:ScorecardResult){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({configRevision:result.configRevision,inputs:result.inputs,selectedSegment:result.selectedSegment,breakdown:result.breakdown,score:result.score,band:result.band})))
 return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')
}
export async function calculationWrites(db:D1Database,results:ScorecardResult[],prior:StoredResult[],invalidateAll=false){
 const rows=await Promise.all(results.map(async result=>{
  const key=await inputKey(result),old=prior.find(p=>p.accountId===result.accountId),changed=old?.inputKey!==key
  const previous=old?JSON.parse(old.document) as ScorecardResult:null
  const refresh=changed||invalidateAll||previous?.accountRevision!==result.accountRevision||Date.parse(result.calculatedAt)-Date.parse(previous!.calculatedAt)>=3600000
  const revision=changed||invalidateAll?id():result.accountRevision
  return {accountId:result.accountId,versionId:result.versionId,inputKey:key,document:refresh?JSON.stringify({...result,accountRevision:revision}):old!.document,calculatedAt:refresh?result.calculatedAt:previous!.calculatedAt,changed,refresh,revision,historyId:id()}
 }))
 if(!rows.length)return {statements:[],accounts:results}
 const groups:typeof rows[]=[]
 let group:typeof rows=[],bytes=2
 for(const row of rows.filter(row=>row.refresh)){
  const size=new TextEncoder().encode(JSON.stringify(row)).byteLength+1
  if(group.length&&bytes+size>512000){groups.push(group);group=[];bytes=2}
  group.push(row);bytes+=size
 }
 if(group.length)groups.push(group)
 const statements=groups.flatMap(group=>{
 const all=JSON.stringify(group),changed=JSON.stringify(group.filter(r=>r.changed)),invalidated=JSON.stringify(group.filter(r=>r.changed||invalidateAll))
 return [
  stmt(db,"INSERT INTO buoy_scorecard_history(id,account_id,version_id,input_key,document,calculated_at) SELECT json_extract(value,'$.historyId'),json_extract(value,'$.accountId'),json_extract(value,'$.versionId'),json_extract(value,'$.inputKey'),json_extract(value,'$.document'),json_extract(value,'$.calculatedAt') FROM json_each(?)",changed),
  stmt(db,"INSERT INTO buoy_scorecard_results(account_id,version_id,input_key,document,calculated_at) SELECT json_extract(value,'$.accountId'),json_extract(value,'$.versionId'),json_extract(value,'$.inputKey'),json_extract(value,'$.document'),json_extract(value,'$.calculatedAt') FROM json_each(?) WHERE true ON CONFLICT(account_id) DO UPDATE SET version_id=excluded.version_id,input_key=excluded.input_key,document=excluded.document,calculated_at=excluded.calculated_at",all),
  stmt(db,"UPDATE buoy_accounts SET revision=(SELECT json_extract(value,'$.revision') FROM json_each(?) WHERE json_extract(value,'$.accountId')=buoy_accounts.id) WHERE id IN(SELECT json_extract(value,'$.accountId') FROM json_each(?))",invalidated,invalidated)
 ]})
 return {accounts:rows.map(r=>JSON.parse(r.document) as ScorecardResult),statements}
}
