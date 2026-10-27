import {insist,stmt} from '../core'
import {ATTRIBUTED,MAPPED_JOIN} from '../usage/mappings'
import {calculate} from '../scorecards/calculate'
import type {ScorecardConfig,ScorecardResult} from '../scorecards/types'
import {staleness} from '../settings'

export interface Signal {name:string;weeklyDropPercent:number;urgentTickets:number}
export interface Observation {accountId:string;on:string;current:number|null;previous:number|null;urgent:number|null;score?:number|null;supportReference:string|null;matched:boolean;missing:string[]}
export const interpretation='Historical observations, not a churn prediction or proof of causation. Weekly fire counts are matching account weeks, not delivered alerts. Churn capture counts distinct accounts with a recorded churn outcome after a match. Current reviewed identities apply; source completeness and historical identity changes are unknown. Missing or stale support and an absent prior active baseline are not matches.'
export function period(){
 const end=new Date(new Date().toISOString().slice(0,10)),start=new Date(end)
 start.setUTCFullYear(start.getUTCFullYear()-1)
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)}
}
const WINDOWS=`WITH RECURSIVE windows(ending) AS (
 SELECT ? UNION ALL SELECT date(ending,'-7 days') FROM windows WHERE date(ending,'-7 days')>?
), activity AS (
 SELECT DISTINCT m.account_id account_id,m.person_id person_id,date(e.observed_at) on_day
 FROM buoy_usage_events e ${MAPPED_JOIN}
 WHERE ${ATTRIBUTED} AND m.person_id IS NOT NULL AND e.type IN ('track','event')
), measured AS (
 SELECT a.id accountId,w.ending,
 count(DISTINCT CASE WHEN v.on_day>=date(w.ending,'-7 days') THEN v.person_id END) current,
 count(DISTINCT CASE WHEN v.on_day<date(w.ending,'-7 days') THEN v.person_id END) previous,
 (SELECT h.document FROM buoy_support_history h WHERE h.account_id=a.id AND h.observed_on<w.ending ORDER BY h.observed_on DESC,h.id DESC LIMIT 1) support
 FROM buoy_accounts a CROSS JOIN windows w LEFT JOIN activity v ON v.account_id=a.id AND v.on_day>=date(w.ending,'-14 days') AND v.on_day<w.ending
 GROUP BY a.id,w.ending
) SELECT * FROM measured ORDER BY ending,accountId`
export async function history(db:D1Database,signal:Signal){
 const {start,end}=period(),limits=await staleness(db)
 const rows=(await stmt(db,WINDOWS,end,start).all<{accountId:string;ending:string;current:number;previous:number;support:string|null}>()).results
 const observations:Observation[]=rows.map(r=>{
  const support=r.support?JSON.parse(r.support) as {observedAt:string;reference:string;urgentTickets:number}:null
  const on=new Date(Date.parse(r.ending)-86400000).toISOString().slice(0,10)
  const missing=[...(r.previous===0?['Prior weekly active baseline unavailable.']:[]),...(!support||Date.parse(on)-Date.parse(support.observedAt)>limits.supportDays*86400000?['Historical support unavailable or stale.']:[])]
  return {accountId:r.accountId,on,current:r.current,previous:r.previous,urgent:support?.urgentTickets??null,supportReference:support?.reference??null,missing,matched:missing.length===0&&r.current*100<=r.previous*(100-signal.weeklyDropPercent)&&support!.urgentTickets>=signal.urgentTickets}
 })
 const churns=(await stmt(db,`SELECT d.account_id accountId,d.renewal_date onDay FROM buoy_decisions d LEFT JOIN buoy_decision_outcomes o ON o.decision_id=d.id WHERE COALESCE(o.outcome,d.outcome)='churned' AND d.renewal_date>=? AND d.renewal_date<?
 UNION SELECT account_id,json_extract(document,'$.renewalDate') FROM buoy_renewals WHERE json_extract(document,'$.outcome')='churned' AND json_extract(document,'$.renewalDate')>=? AND json_extract(document,'$.renewalDate')<? ORDER BY accountId,onDay`,start,end,start,end).all<{accountId:string;onDay:string}>()).results
 const churned=[...new Set(churns.map(c=>c.accountId))].sort(),matched=observations.filter(r=>r.matched)
 const caught=churned.filter(id=>matched.some(r=>r.accountId===id&&churns.some(c=>c.accountId===id&&r.on<c.onDay)))
 return {start,end,fireCount:matched.length,matchedAccountIds:[...new Set(matched.map(r=>r.accountId))].sort(),churnedAccountIds:churned,caughtAccountIds:caught,churnCapture:{caught:caught.length,total:churned.length,rate:churned.length?caught.length/churned.length:null},missingWeeks:observations.filter(r=>r.missing.length).length,observations,interpretation}
}
// The publication fence includes source changes even when aggregate counts stay equal.
export const SOURCE_SQL=`SELECT json_object(
 'accounts',(SELECT json_group_array(json_object('id',id,'revision',revision)) FROM (SELECT * FROM buoy_accounts ORDER BY id)),
 'support',(SELECT json_group_array(json_object('id',id,'account',account_id,'document',document)) FROM (SELECT * FROM buoy_support_history ORDER BY id)),
 'events',(SELECT json_group_array(json_object('id',id,'source',source_id,'user',user_id,'group',group_id,'type',type,'at',observed_at)) FROM (SELECT * FROM buoy_usage_events ORDER BY id)),
 'mappings',(SELECT json_group_array(json_object('source',source_id,'claim',claim_key,'revision',revision)) FROM (SELECT * FROM buoy_usage_mappings ORDER BY source_id,claim_key)),
 'memberships',(SELECT json_group_array(json_object('person',person_id,'account',account_id)) FROM (SELECT * FROM buoy_customer_memberships ORDER BY person_id,account_id)),
 'decisions',(SELECT json_group_array(json_object('id',id,'outcome',outcome,'date',renewal_date)) FROM (SELECT * FROM buoy_decisions ORDER BY id)),
 'outcomes',(SELECT json_group_array(json_object('id',decision_id,'outcome',outcome)) FROM (SELECT * FROM buoy_decision_outcomes ORDER BY decision_id)),
 'renewals',(SELECT json_group_array(json_object('id',id,'revision',revision)) FROM (SELECT * FROM buoy_renewals ORDER BY id)),
 'scorecards',(SELECT json_group_array(json_object('id',id,'document',document)) FROM (SELECT * FROM buoy_scorecard_history ORDER BY id)),
 'settings',(SELECT value FROM buoy_settings WHERE key='staleness')) snapshot`
export async function historyImage(db:D1Database){const row=await db.prepare(SOURCE_SQL).first<{snapshot:string}>();insist(row,'History unavailable.',503);return row.snapshot}

export async function scorecardHistory(db:D1Database,config:ScorecardConfig){
 const {start,end}=period()
 const retained=(await stmt(db,`SELECT document,calculated_at at FROM buoy_scorecard_history WHERE calculated_at>=? AND calculated_at<? ORDER BY calculated_at,observed_seq,id`,start,end).all<{document:string;at:string}>()).results
 const latest=new Map<string,{document:string;at:string}>()
 // Weeks include their starting UTC midnight and exclude their ending midnight.
 for(const row of retained){const r=JSON.parse(row.document) as ScorecardResult;latest.set(r.accountId+':'+(Math.ceil((Date.parse(end)-Date.parse(row.at))/604800000)-1),row)}
 const observations:Observation[]=[...latest.values()].map(row=>{
  const retained=JSON.parse(row.document) as ScorecardResult,result=calculate(config,retained.inputs,{accountId:retained.accountId,accountRevision:retained.accountRevision,configRevision:'backtest',versionId:'backtest',calculatedAt:row.at})
  return {accountId:retained.accountId,on:row.at.slice(0,10),current:null,previous:null,urgent:null,supportReference:null,score:result.score,matched:result.band==='at-risk',missing:result.score===null?['Required retained scorecard inputs unavailable.']:[]}
 }).sort((a,b)=>a.on.localeCompare(b.on)||a.accountId.localeCompare(b.accountId))
 const churns=(await stmt(db,`SELECT d.account_id accountId,d.renewal_date onDay FROM buoy_decisions d LEFT JOIN buoy_decision_outcomes o ON o.decision_id=d.id WHERE COALESCE(o.outcome,d.outcome)='churned' AND d.renewal_date>=? AND d.renewal_date<? UNION SELECT account_id,json_extract(document,'$.renewalDate') FROM buoy_renewals WHERE json_extract(document,'$.outcome')='churned' AND json_extract(document,'$.renewalDate')>=? AND json_extract(document,'$.renewalDate')<?`,start,end,start,end).all<{accountId:string;onDay:string}>()).results
 const accountCount=Number((await db.prepare('SELECT count(*) n FROM buoy_accounts').first<{n:number}>())?.n??0),weeks=Math.ceil((Date.parse(end)-Date.parse(start))/604800000)
 const matched=observations.filter(r=>r.matched),churned=[...new Set(churns.map(c=>c.accountId))].sort(),caught=churned.filter(id=>matched.some(r=>r.accountId===id&&churns.some(c=>c.accountId===id&&r.on<c.onDay)))
 return {start,end,fireCount:matched.length,matchedAccountIds:[...new Set(matched.map(r=>r.accountId))].sort(),churnedAccountIds:churned,caughtAccountIds:caught,churnCapture:{caught:caught.length,total:churned.length,rate:churned.length?caught.length/churned.length:null},missingWeeks:accountCount*weeks-observations.filter(r=>r.missing.length===0).length,observations,interpretation:'Retained scorecard inputs only; the latest recorded calculation in each account week is replayed with the draft. Weeks without retained calculations are unavailable, never filled from current values. '+interpretation}
}
