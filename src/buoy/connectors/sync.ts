import type { Bindings } from '../../auth.server'
import { authority,guard,id,insist,now,stmt,type Actor } from '../core'
import { unseal } from './vault'
import { customers } from './stripe'
type Connection={id:string;version:number;cursor:string|null;disconnected_at:string|null;sealed:string}
export async function syncConnection(env:Bindings,connectionId:string,actor?:Actor) {
 const db=env.DB, runId=id(), started=now(), lease=Date.now()+60000
 const current=await stmt(db,'SELECT c.*,k.sealed FROM buoy_connections c LEFT JOIN buoy_connection_credentials k ON k.connection_id=c.id WHERE c.id=?',connectionId).first<Connection>()
 insist(current,'Connection not found.',404)
 insist(!current.disconnected_at&&current.sealed,'Reconnect this source before syncing.',409)
 const locked=await db.batch([...(actor?[authority(db,actor,true)]:[]),stmt(db,'UPDATE buoy_connections SET lease_until=? WHERE id=? AND version=? AND lease_until<? AND disconnected_at IS NULL',lease,connectionId,current.version,Date.now())])
 insist(locked.at(-1)!.meta.changes===1,'A sync is already running. Try again later.',409)
 await stmt(db,"INSERT INTO buoy_connection_runs(id,connection_id,started_at,status,cursor_before) VALUES(?,?,?,'running',?)",runId,connectionId,started,current.cursor).run()
 try {
  const secret=await unseal(env.SESSION_SECRET,connectionId,current.sealed)
  const page=await customers(secret,current.cursor), finished=now(), cursor=page.more?page.records.at(-1)!.id:null
  const statements=page.records.map(record=>stmt(db,'INSERT INTO buoy_connection_records(connection_id,source_id,observed_at) VALUES(?,?,?) ON CONFLICT(connection_id,source_id) DO UPDATE SET observed_at=excluded.observed_at',connectionId,record.id,record.observedAt))
  const before=await stmt(db,'SELECT count(*) AS n FROM buoy_connection_records WHERE connection_id=?',connectionId).first<{n:number}>()
  await db.batch([...(actor?[authority(db,actor,true)]:[]),guard(db,'EXISTS(SELECT 1 FROM buoy_connections c JOIN buoy_connection_credentials k ON k.connection_id=c.id WHERE c.id=? AND c.version=? AND c.lease_until=? AND c.disconnected_at IS NULL)',connectionId,current.version,lease),...statements,stmt(db,"UPDATE buoy_connection_runs SET finished_at=?,status='succeeded',read_count=?,added_count=(SELECT count(*)-? FROM buoy_connection_records WHERE connection_id=?),cursor_after=? WHERE id=?",finished,page.records.length,before!.n,connectionId,cursor,runId),stmt(db,'UPDATE buoy_connections SET cursor=?,last_success=?,last_error=NULL,lease_until=0 WHERE id=?',cursor,finished,connectionId),stmt(db,'DELETE FROM buoy_assertions')])
 }catch(error){
  // Never persist provider response bodies, keys, SQL or cryptography errors.
  const message=error instanceof Error&&/^Stripe |^Invalid Stripe /.test(error.message)?error.message:'Sync could not complete. Recheck the credential and connection.'
  await db.batch([stmt(db,"UPDATE buoy_connection_runs SET finished_at=?,status='failed',error=? WHERE id=?",now(),message,runId),stmt(db,'UPDATE buoy_connections SET last_error=?,lease_until=0 WHERE id=? AND version=? AND lease_until=?',message,connectionId,current.version,lease)])
 }
 return stmt(db,'SELECT * FROM buoy_connection_runs WHERE id=?',runId).first()
}
export async function scheduledConnections(env:Bindings) {
 const rows=await env.DB.prepare('SELECT id FROM buoy_connections WHERE disconnected_at IS NULL AND lease_until<? ORDER BY (SELECT max(started_at) FROM buoy_connection_runs r WHERE r.connection_id=buoy_connections.id),id LIMIT 20').bind(Date.now()).all<{id:string}>()
 for(const row of rows.results){try{await syncConnection(env,row.id)}catch{/* A concurrent/manual run keeps its own lease and result. */}}
}
