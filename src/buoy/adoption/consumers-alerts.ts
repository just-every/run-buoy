import { guard, id, now, stmt } from '../core'
import { consumerImage, measuredConsumers } from './consumers'
import type { ConsumerEvaluation } from './consumers-model'

function explanation(measure:ConsumerEvaluation){
 const sources=measure.sources.map(source=>`${source.name} (${source.kind}; ${source.reference}): ${source.attributedEventCount} attributed of ${source.eventCount} observed events in the two monthly windows; latest ${source.lastObservedAt??'missing'}; ${source.freshness}`).join('; ')
 const seats=measure.seatEvidence.map(seat=>`${seat.accountId}: ${seat.seats} manually recorded seats; ${seat.reference}; observed ${seat.observedAt}; ${seat.freshness}`).join('; ')
 const licenses=measure.personLicenses.map(license=>`${license.personId} at ${license.accountId}: manually recorded ${license.licensed?'licensed':'unlicensed'}; ${license.reference}; observed ${license.observedAt}; ${license.freshness}`).join('; ')
 return `${measure.reason}\nMeasured on ${measure.on} UTC using current reviewed mappings, memberships and definitions. Observed activity does not establish source completeness.\nInstallation source evidence: ${sources||'No recorded sources.'}\nAccount seat evidence: ${seats||'Missing.'}${licenses?`\nPerson license evidence: ${licenses}`:''}\nManual seat and license evidence remains in utilization when stale; it is not billing verification. First value starts at the first observed identify, not a verified signup.`
}
/** No outbound delivery: inbox email remains pending for the existing preferences
 * and mail dispatcher. A matching episode belongs to each rule/account/owner. */
export async function recordAdoptionAlerts(db:D1Database){
 const activeOwner="EXISTS(SELECT 1 FROM buoy_account_owners a JOIN oa_operators o ON o.id=a.owner_id AND o.status='active')"
 const alertRule="EXISTS(SELECT 1 FROM buoy_adoption_consumers WHERE json_extract(document,'$.enabled')=1 AND json_extract(document,'$.alert')=1)"
 const enabled=await db.prepare(`SELECT 1 AS enabled WHERE ${activeOwner} AND ${alertRule}`).first()
 if(!enabled){
  await db.prepare(`UPDATE buoy_adoption_alert_state SET active=0 WHERE active=1 AND (NOT ${activeOwner} OR NOT ${alertRule})`).run()
  return
 }
 const snapshot=await consumerImage(db,undefined,true),owners=new Map(snapshot.value.owners.map(owner=>[owner.accountId,owner.personId])),episode=id(),at=now()
 const measures=[...measuredConsumers({...snapshot.value,rules:snapshot.value.rules.filter(rule=>rule.alert)},new Set(owners.keys()))].flatMap(([accountId,evaluations])=>{
  const personId=owners.get(accountId)
  return personId?evaluations.filter(measure=>measure.alert).map(measure=>({ruleId:measure.ruleId,accountId,personId,matched:measure.matched,missing:measure.missing,title:measure.name,body:explanation(measure)})):[]
 }),payload=JSON.stringify(measures)
 await db.batch([guard(db,`(${snapshot.sql})=?`,snapshot.raw),
  // A missing metric does not prove recovery. Disablement, reassignment or a
  // known non-match rearms the recipient for the next matching episode.
  stmt(db,`UPDATE buoy_adoption_alert_state SET active=0 WHERE active=1 AND NOT EXISTS (
   SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.ruleId')=rule_id AND json_extract(j.value,'$.accountId')=account_id AND json_extract(j.value,'$.personId')=person_id
    AND (json_extract(j.value,'$.matched')=1 OR json_extract(j.value,'$.missing')=1))`,payload),
  stmt(db,`INSERT INTO buoy_adoption_alert_state(rule_id,account_id,person_id,episode,active)
   SELECT json_extract(value,'$.ruleId'),json_extract(value,'$.accountId'),json_extract(value,'$.personId'),?,1 FROM json_each(?) WHERE json_extract(value,'$.matched')=1
   ON CONFLICT(rule_id,account_id,person_id) DO UPDATE SET episode=excluded.episode,active=1 WHERE buoy_adoption_alert_state.active=0`,episode,payload),
  // Only the transaction that opened this episode can create its inbox record.
  stmt(db,`INSERT OR IGNORE INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at)
   SELECT lower(hex(randomblob(16))),s.person_id,s.account_id,'signal','adoption:'||s.rule_id||':'||s.account_id||':'||s.person_id||':'||s.episode,json_extract(j.value,'$.title'),json_extract(j.value,'$.body'),?
   FROM buoy_adoption_alert_state s JOIN json_each(?) j ON json_extract(j.value,'$.ruleId')=s.rule_id AND json_extract(j.value,'$.accountId')=s.account_id AND json_extract(j.value,'$.personId')=s.person_id
   WHERE s.active=1 AND s.episode=? AND json_extract(j.value,'$.matched')=1`,at,payload,episode),
  stmt(db,'DELETE FROM buoy_assertions')])
}
