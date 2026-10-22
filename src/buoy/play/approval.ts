import {insist,stmt} from '../core'
import {snapshot,evaluated,fence} from '../segments/snapshot'
import {matches} from '../segments/rules'
import type {Definition} from './model'
export async function checkPlayApproval(db:D1Database,proposalId:string,payload:Record<string,unknown>,accountId:string){
 const row=await stmt(db,"SELECT v.document,r.account_revision FROM buoy_playbook_runs r JOIN buoy_playbooks p ON p.id=r.playbook_id JOIN buoy_playbook_versions v ON v.id=r.version_id JOIN buoy_playbook_proposals x ON x.run_id=r.id AND x.step_index=r.cursor WHERE r.id=? AND r.account_id=? AND r.cursor=? AND r.status='approval' AND p.enabled=1 AND x.proposal_id=?",payload.playRun,accountId,payload.playStep,proposalId).first<{document:string;account_revision:string}>()
 insist(row,'This step is no longer awaiting approval or its playbook is disabled.',409)
 const d=JSON.parse(row.document) as Definition,image=await snapshot(db),a=evaluated(image.value,new Date().toISOString().slice(0,10)).find(a=>a.account.id===accountId)
 insist(a&&(!d.exit||!matches(d.exit,a.values,a.people)),'Exit criteria are met. Advance the run before approval.',409)
 return fence(db,image)
}
