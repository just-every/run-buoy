import { authority, guard, insist, requirePerson, stmt, type Actor } from '../core'
import { auditIfChanged } from '../audit-records'
import { COST_LABEL, policyFromRow, type PolicyRow } from './policy'
export async function agentState(db: D1Database, actor: Actor) {
 requirePerson(actor, true)
 const results = await db.batch<Record<string, unknown>>([
  db.prepare('SELECT disabled FROM buoy_agent_settings WHERE singleton=1'),
  db.prepare('SELECT id,label,expires_at AS expiresAt,revoked_at AS revokedAt,scopes,data_classes,requests_per_minute,budget_minor FROM buoy_agent_tokens ORDER BY expires_at DESC,id'),
  db.prepare('SELECT id,token_id AS tokenId,command,status,reason,spent_minor AS spentMinor,occurred_at AS occurredAt FROM buoy_agent_ledger ORDER BY occurred_at DESC,id DESC LIMIT 100')])
 return {disabled: !!results[0].results[0].disabled, agents: results[1].results.map(row => ({id: row.id, label: row.label, expiresAt: row.expiresAt, revokedAt: row.revokedAt,
  ...policyFromRow(row as unknown as PolicyRow), spentMinor: 0})), entries: results[2].results, costLabel: COST_LABEL}
}
export async function setAgentSettings(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 requirePerson(actor, true)
 insist(Object.keys(input).length === 1 && typeof input.disabled === 'boolean', 'Set disabled to true or false.')
 await db.batch<Record<string, unknown>>([authority(db, actor, true), guard(db, "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')", actor.id),
  stmt(db, 'UPDATE buoy_agent_settings SET disabled=? WHERE singleton=1 AND disabled<>?', Number(input.disabled), Number(input.disabled)),
  auditIfChanged(db, actor, 'agent.access-changed', 'installation:agents', input.disabled ? 'Agent access disabled.' : 'Agent access enabled.'),
  stmt(db, 'INSERT INTO agent_door_state(id,local_paused) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET local_paused=excluded.local_paused',Number(input.disabled)),stmt(db, 'DELETE FROM buoy_assertions')])
 return {disabled: input.disabled}
}
