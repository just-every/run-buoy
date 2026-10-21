import {authority,insist,stmt,type Actor} from './core'
import {ATTRIBUTED,MAPPED_JOIN} from './usage/mappings'
export async function accountActivity(db:D1Database,actor:Actor,accountId:string,query:URLSearchParams){
 insist(actor.kind==='person','Record activity requires a staff session.',403)
 insist([...query.keys()].every(key=>['cursor','limit','kind','personId','source'].includes(key)),'Unsupported activity filter.')
 const exists=await stmt(db,'SELECT id FROM buoy_accounts WHERE id=?',accountId).first();insist(exists,'Account not found.',404)
 const limit=Number(query.get('limit')??50);insist(Number.isInteger(limit)&&limit>=1&&limit<=200,'Activity page size must be 1–200.')
 const parts=[
  `SELECT 'proposal:'||id AS id,kind||'-prepared' AS kind,prepared_at AS occurredAt,NULL AS personId,COALESCE(json_extract(payload,'$.title'),json_extract(payload,'$.outcome')) AS title,COALESCE(json_extract(payload,'$.evidence'),'Native preparation') AS reference,'#proposals' AS fragment,'native' AS source FROM buoy_proposals WHERE account_id=?`,
  `SELECT 'approval:'||id,kind||'-approved',approved_at,NULL,'Proposal approved','Revision-bound human approval','#proposals','native' AS source FROM buoy_proposals WHERE account_id=? AND status='approved'`,
  `SELECT 'task:'||t.id,'task-created',p.approved_at,NULL,t.title,'Approved playbook task','#tasks','native' AS source FROM buoy_tasks t JOIN buoy_proposals p ON p.id=t.proposal_id WHERE t.account_id=?`,
  `SELECT 'completion:'||id,'task-completed',completed_at,NULL,title,evidence,'#tasks','native' AS source FROM buoy_tasks WHERE account_id=? AND completed_at IS NOT NULL`,
  `SELECT 'decision:'||d.id,'renewal-outcome',d.recorded_at,NULL,COALESCE(o.outcome,d.outcome),d.evidence,'#decisions','native' AS source FROM buoy_decisions d LEFT JOIN buoy_decision_outcomes o ON o.decision_id=d.id WHERE d.account_id=?`,
  `SELECT 'sentiment:'||id,'sentiment',recorded_at,NULL,rating,reason,'#record-sentiment','manual' AS source FROM buoy_sentiments WHERE account_id=?`,
  `SELECT 'survey:'||id,'survey-response',observed_at,person_id,survey_name||' '||kind||' '||value,reference,'#surveys','received-survey' AS source FROM buoy_survey_responses WHERE account_id=?`,
  `SELECT 'contract:'||id,'recurring-contract',recorded_at,NULL,'Recurring contract confirmed',json_extract(document,'$.source.reference'),'#revenue','person-confirmed-contract' AS source FROM buoy_recurring_contract_versions WHERE account_id=?`,
  `SELECT 'fields:'||id,'field-change',recorded_at,NULL,field_key,source,'#account-hierarchy','manual' AS source FROM buoy_field_history WHERE account_id=?`,
  `SELECT 'hierarchy:'||id,'organization-change',recorded_at,NULL,'Organization and stakeholder roles changed',source,'#hierarchy-history','manual' AS source FROM buoy_hierarchy_history WHERE account_id=?`,
  `SELECT 'license:'||id,'person-license',recorded_at,person_id,'Person license evidence',COALESCE(json_extract(document,'$.newValue.reference'),json_extract(document,'$.oldValue.reference'),'License evidence cleared'),'#product-usage','manual' AS source FROM buoy_adoption_person_license_history WHERE account_id=?`,
  `SELECT 'usage:'||e.id,'usage-event',e.observed_at,m.person_id,COALESCE(e.event,e.type),e.source_reference,'#product-usage','usage:'||e.source_id AS source FROM buoy_usage_events e ${MAPPED_JOIN} WHERE ${ATTRIBUTED} AND m.account_id=?`,
  `SELECT 'account:'||a.id,a.action,a.occurred_at,NULL,a.action,'Native account audit','#account-hierarchy','native' AS source FROM buoy_audit a JOIN buoy_audit_subjects s ON s.subject=a.subject WHERE s.account_id=? AND a.action IN ('account.created','account.updated','account.reassigned','health.scorecard-assigned')`,
  `SELECT 'renewal-history:'||h.id,CASE h.field_key WHEN 'source' THEN 'renewal-source' WHEN 'pipeline' THEN 'renewal-pipeline' ELSE 'renewal-field' END,h.recorded_at,NULL,h.field_key,h.source,'renewal:'||r.id,'native' FROM buoy_renewal_history h JOIN buoy_renewals r ON r.id=h.record_id WHERE r.account_id=?`
 ]
 const clauses:string[]=[],params:unknown[]=[]
 if(query.has('kind')){clauses.push('kind=?');params.push(query.get('kind'))}
 if(query.has('source')){insist(query.get('source')!.length<=200,'Source filter is limited to 200 characters.');clauses.push('source=?');params.push(query.get('source'))}
 if(query.has('personId')){clauses.push('personId=?');params.push(query.get('personId'))}
 if(query.has('cursor')){let cursor:unknown;try{cursor=JSON.parse(atob(query.get('cursor')!))}catch{insist(false,'Invalid activity cursor.')};insist(Array.isArray(cursor)&&cursor.length===2&&cursor.every(v=>typeof v==='string'&&v.length<=200),'Invalid activity cursor.');clauses.push('(occurredAt<? OR (occurredAt=? AND id<?))');params.push(cursor[0],cursor[0],cursor[1])}
 // D1 bounds compound SELECTs more tightly than desktop SQLite. Each shard
 // reads in the same batch transaction; limit+1 from every shard is sufficient
 // to merge an exact global page, including its next-page indicator.
 const groups:string[][]=[];for(let i=0;i<parts.length;i+=3)groups.push(parts.slice(i,i+3))
 const sourceQuery=stmt(db,"SELECT DISTINCT 'usage:'||s.id AS id,s.name FROM buoy_usage_sources s JOIN buoy_usage_mappings m ON m.source_id=s.id JOIN buoy_customer_memberships c ON c.person_id=m.person_id AND c.account_id=m.account_id WHERE m.account_id=? ORDER BY s.name,s.id",accountId)
 const results=await db.batch([authority(db,actor),...groups.map(group=>stmt(db,`WITH activity(id,kind,occurredAt,personId,title,reference,fragment,source) AS(${group.join(' UNION ALL ')}) SELECT * FROM activity ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY occurredAt DESC,id DESC LIMIT ?`,...group.map(()=>accountId),...params,limit+1)),sourceQuery,stmt(db,'DELETE FROM buoy_assertions')])
 const rows=results.slice(1,-2).flatMap(result=>result.results) as {id:string;kind:string;occurredAt:string;personId:string|null;title:string;reference:string;fragment:string;source:string}[]
 const compare=(a:string,b:string)=>a===b?0:a>b?1:-1;rows.sort((a,b)=>compare(b.occurredAt,a.occurredAt)||compare(b.id,a.id))
 const records=rows.slice(0,limit).map(({fragment,...r})=>({...r,href:r.kind==='field-change'?'/app/fields?account='+encodeURIComponent(accountId)+'#field-history':fragment.startsWith('renewal:')?'/app/renewals?renewal='+encodeURIComponent(fragment.slice(8))+'#renewal-history':'/app/accounts/'+encodeURIComponent(accountId)+fragment})),last=records.at(-1)
 const sources=[{id:'native',name:'Native actions'},{id:'manual',name:'Manual observations and fields'},{id:'received-survey',name:'Received customer surveys'},{id:'person-confirmed-contract',name:'Confirmed recurring contracts'},...results.at(-2)!.results as {id:string;name:string}[]],kinds=Object.entries({'playbook-prepared':'Playbook prepared','renewal-prepared':'Renewal prepared','playbook-approved':'Playbook approved','renewal-approved':'Renewal approved','task-created':'Task created','task-completed':'Task completed','renewal-outcome':'Renewal outcome',sentiment:'CSM sentiment','survey-response':'Survey response','recurring-contract':'Recurring contract','field-change':'Custom field change','organization-change':'Organization and stakeholders','person-license':'Customer license','usage-event':'Product usage','account.created':'Account created','account.updated':'Account sources refreshed','account.reassigned':'CSM reassigned','health.scorecard-assigned':'Scorecard assigned','renewal-source':'Renewal sources refreshed','renewal-pipeline':'Renewal pipeline change','renewal-field':'Renewal field change'}).map(([id,name])=>({id,name}))
 return {accountId,records,filters:{sources,kinds},nextCursor:rows.length>limit&&last?btoa(JSON.stringify([last.occurredAt,last.id])):null,interpretation:'Current native record activity, newest observation/action first, with links to the native source section. Connected email, calendar, CRM and support timelines remain ACCOUNT-002 work.'}
}
