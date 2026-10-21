import { guard } from '../core'
import { CAMPAIGN_COLUMNS, id, now, stmt, type Campaign, type Mapping } from './model'
// A five-minute pending reservation prevents concurrent fetches overspending a
// cap. Only actual view receipts count as views; expired reservations do not.
export async function deliveries(db:D1Database,sourceId:string,m:Mapping|null,credentialGuard:D1PreparedStatement,mappingGuard:D1PreparedStatement,credentialId:string,erasureGuard:D1PreparedStatement){
 const stamp=now(),expires=new Date(Date.parse(stamp)+300000).toISOString()
 const raw=m?await stmt(db,`SELECT ${CAMPAIGN_COLUMNS} FROM buoy_inapp_campaigns WHERE source_id=? AND enabled=1 ORDER BY created_at,id`,sourceId).all():{results:[]}
 const candidates=raw.results.map(c=>({...c,steps:JSON.parse(String(c.steps)),enabled:!!c.enabled,deliveryId:id()})) as unknown as (Campaign&{deliveryId:string})[]
 const statements=[credentialGuard,mappingGuard,erasureGuard]
 if(m)for(const c of candidates){
  const after=new Date(Date.parse(stamp)-c.windowHours*3600000).toISOString()
  statements.push(stmt(db,`INSERT INTO buoy_inapp_deliveries(id,campaign_id,account_id,person_id,source_id,claim_key,created_at,expires_at)
   SELECT ?,c.id,?,?,?,?,?,? FROM buoy_inapp_campaigns c WHERE c.id=? AND c.enabled=1
   AND EXISTS(SELECT 1 FROM buoy_segment_entries se WHERE se.segment_id=c.segment_id AND se.account_id=? AND se.exited_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM buoy_inapp_receipts r JOIN buoy_usage_events e ON e.id=r.event_id JOIN buoy_usage_mappings um ON um.source_id=e.source_id AND um.user_id IS e.user_id AND um.group_id IS e.group_id WHERE r.campaign_id=c.id AND um.person_id=? AND r.kind IN ('completion','dismissal'))
   AND (SELECT count(*) FROM buoy_inapp_receipts r JOIN buoy_usage_events e ON e.id=r.event_id JOIN buoy_usage_mappings um ON um.source_id=e.source_id AND um.user_id IS e.user_id AND um.group_id IS e.group_id WHERE r.campaign_id=c.id AND um.person_id=? AND r.kind='view' AND e.observed_at>?)
    +(SELECT count(*) FROM buoy_inapp_deliveries d WHERE d.campaign_id=c.id AND d.person_id=? AND d.expires_at>? AND NOT EXISTS(SELECT 1 FROM buoy_inapp_receipts r WHERE r.delivery_id=d.id AND r.kind='view'))<c.max_views`,c.deliveryId,m.accountId,m.personId,sourceId,m.claimKey,stamp,expires,c.id,m.accountId,m.personId,m.personId,after,m.personId,stamp))
 }
 statements.push(stmt(db,'UPDATE buoy_inapp_credentials SET last_used_at=? WHERE id=?',stamp,credentialId),stmt(db,'DELETE FROM buoy_assertions'))
 const results=await db.batch(statements)
 return {messages:candidates.filter((_,i)=>results[i+3].meta.changes===1).map(c=>({id:c.id,kind:c.kind,title:c.title,body:c.body,steps:c.steps,deliveryId:c.deliveryId}))}
}
