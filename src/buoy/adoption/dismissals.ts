import { commit, guard, insist, now, stmt, text, type Actor } from '../core'

/** Receipt custody is checked against the original complete SQL source identity. */
export const noticeIdentity = `SELECT r.rule_id AS ruleId,r.account_id AS accountId,r.person_id AS personId,r.episode
 FROM buoy_adoption_alert_notices r JOIN buoy_inbox n ON n.id=r.notice_id
 WHERE n.id=? AND n.person_id=? AND n.type='signal' AND n.account_id=r.account_id AND n.person_id=r.person_id
 AND n.source='adoption:'||r.rule_id||':'||r.account_id||':'||r.person_id||':'||r.episode`
export async function dismissAdoptionAlert(db:D1Database,actor:Actor,noticeId:string,input:Record<string,unknown>){
 insist(actor.kind==='person','Notifications belong to the signed-in person.',403)
 const notice=await stmt(db,noticeIdentity,noticeId,actor.id).first<{ruleId:string;accountId:string;personId:string;episode:string}>()
 insist(notice,'Adoption alert not found.',404)
 insist(Object.keys(input).every(key=>['reason','until'].includes(key)),'Only a reason and dismissal deadline can be supplied.')
 const reason=text(input.reason,'Dismissal reason',1000),createdAt=now()
 insist(typeof input.until==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.until),'Choose an explicit ISO UTC dismissal deadline.')
 const deadline=Date.parse(input.until),instant=Date.parse(createdAt)
 insist(Number.isFinite(deadline)&&new Date(deadline).toISOString().replace('.000Z','Z')===input.until.replace('.000Z','Z')&&deadline>instant&&deadline<=instant+365*86400000,'Dismissal deadline must be a real future UTC instant within 365 days.')
 const until=new Date(deadline).toISOString()
 await commit(db,actor,notice.accountId,'signal.dismissed',[
  guard(db,`EXISTS(${noticeIdentity} AND r.rule_id=? AND r.account_id=? AND r.episode=?)`,noticeId,actor.id,notice.ruleId,notice.accountId,notice.episode),
  stmt(db,`INSERT INTO buoy_adoption_dismissals(rule_id,account_id,person_id,reason,until,created_at,notice_id) VALUES(?,?,?,?,?,?,?)
   ON CONFLICT(rule_id,account_id,person_id) DO UPDATE SET reason=excluded.reason,until=excluded.until,created_at=excluded.created_at,notice_id=excluded.notice_id`,notice.ruleId,notice.accountId,actor.id,reason,until,createdAt,noticeId),
  stmt(db,'UPDATE buoy_adoption_alert_state SET active=0 WHERE rule_id=? AND account_id=? AND person_id=?',notice.ruleId,notice.accountId,actor.id),
  stmt(db,`UPDATE buoy_inbox SET email='dismissed' WHERE email IN ('pending','queued') AND id IN (
   SELECT notice_id FROM buoy_adoption_alert_notices WHERE rule_id=? AND account_id=? AND person_id=?)`,notice.ruleId,notice.accountId,actor.id)
 ])
 return {id:noticeId,adoptionRuleId:notice.ruleId,dismissal:{reason,until,createdAt}}
}
