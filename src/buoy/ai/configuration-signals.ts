import {guard,now,stmt} from '../core'
import {history,historyImage,SOURCE_SQL,type Signal} from './configuration-history'

/** Published deterministic signals use the existing internal inbox and its preferences. */
export async function configurationSignals(db:D1Database){
 const signals=(await db.prepare('SELECT id,document FROM buoy_configuration_signals WHERE enabled=1 ORDER BY id').all<{id:string;document:string}>()).results
 if(!signals.length)return
 for(const signal of signals){
  const source=await historyImage(db),result=await history(db,JSON.parse(signal.document) as Signal)
  const latest=result.observations.filter(r=>r.on===new Date(Date.parse(result.end)-86400000).toISOString().slice(0,10)&&r.matched)
  if(!latest.length)continue
  const statements=latest.map(r=>stmt(db,`INSERT OR IGNORE INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at)
   SELECT lower(hex(randomblob(16))),o.owner_id,a.id,'signal',?||':'||o.owner_id,?,?,? FROM buoy_accounts a JOIN buoy_account_owners o ON o.account_id=a.id JOIN oa_operators p ON p.id=o.owner_id AND p.status='active' WHERE a.id=?`,
   'configuration:'+signal.id+':'+r.accountId+':'+r.on,JSON.parse(signal.document).name,
   `Observed ${r.current} weekly active people after ${r.previous}; ${r.urgent} open urgent tickets. Evidence through ${r.on} UTC. ${result.interpretation}`,now(),r.accountId))
  await db.batch([guard(db,`(${SOURCE_SQL})=?`,source),guard(db,'EXISTS(SELECT 1 FROM buoy_configuration_signals WHERE id=? AND document=? AND enabled=1)',signal.id,signal.document),...statements,stmt(db,'DELETE FROM buoy_assertions')])
 }
}
