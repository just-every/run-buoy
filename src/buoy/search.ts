import { authority, insist, stmt, text, type Actor } from './core'

// Search live product values, never auth, connector custody, inboxes, intake
// review queues or historical snapshots. No independent index can outlive erasure.
const fieldText = (document:string) => `COALESCE((SELECT group_concat(CAST(atom AS TEXT),char(10)) FROM json_tree(COALESCE(${document},'{}')) WHERE type IN ('text','integer','real')),'')`
const RECORDS = `
 SELECT 'account' AS kind,a.id,json_extract(a.document,'$.name') AS title,json_array(a.id) AS account_ids,
 a.id||char(10)||json_extract(a.document,'$.name')||char(10)||json_extract(a.document,'$.renewalEvidence')||char(10)||
 COALESCE(json_extract(a.document,'$.billing.reference'),'')||char(10)||COALESCE(json_extract(a.document,'$.support.reference'),'')||char(10)||${fieldText('f.document')} AS search_text
 FROM buoy_accounts a LEFT JOIN buoy_field_results f ON f.account_id=a.id
 UNION ALL
 SELECT p.kind,p.id,p.name,
 (SELECT json_group_array(account_id) FROM (SELECT account_id FROM buoy_customer_memberships WHERE person_id=p.id ORDER BY account_id)),
 p.id||char(10)||p.name||char(10)||${fieldText('f.document')}
 FROM buoy_customer_people p LEFT JOIN buoy_customer_results f ON f.person_id=p.id
 WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m JOIN buoy_accounts a ON a.id=m.account_id WHERE m.person_id=p.id)
 UNION ALL
 SELECT 'task',t.id,t.title,json_array(t.account_id),
 t.id||char(10)||t.title||char(10)||COALESCE(t.outcome,'')||char(10)||COALESCE(t.evidence,'')
 FROM buoy_tasks t JOIN buoy_accounts a ON a.id=t.account_id`

export interface SearchResult {kind:'account'|'contact'|'user'|'task';id:string;title:string;accountIds:string[];excerpt:string;href:string}
export async function search(db:D1Database,actor:Actor,query:URLSearchParams){
 // This is precisely today's ordinary account/customer read boundary. Future
 // ROLE-001 record and field scope must extend this door before those roles ship.
 insist(actor.kind==='person'&&['owner','admin','member'].includes(actor.role),'Search requires a staff session.',403)
 insist([...query.keys()].every(key=>['q','limit','cursor'].includes(key))&&[...query.keys()].every(key=>query.getAll(key).length===1),'Unsupported or repeated search parameter.')
 const q=text(query.get('q'),'Search text',200)
 insist(!/[\u0000-\u001f]/.test(q),'Search text cannot contain control characters.')
 const limit=Number(query.get('limit')??50)
 insist(Number.isInteger(limit)&&limit>=1&&limit<=100,'Search page size must be 1–100.')
 let after=['','']
 if(query.has('cursor')){
  let cursor:unknown
  try{cursor=JSON.parse(atob(query.get('cursor')!))}catch{insist(false,'Invalid search cursor.')}
  insist(Array.isArray(cursor)&&cursor.length===3&&cursor[0]===encodeURIComponent(q)&&['account','contact','user','task'].includes(cursor[1])&&typeof cursor[2]==='string'&&cursor[2].length>0&&cursor[2].length<=200,'Invalid search cursor for this query.')
  after=cursor.slice(1)
 }
 const result=await db.batch([authority(db,actor),stmt(db,`WITH records AS (${RECORDS}),matches AS (
 SELECT *,instr(lower(search_text),lower(?)) AS position FROM records
 ) SELECT kind,id,title,account_ids AS accountIds,
 CASE WHEN position>51 THEN '…' ELSE '' END||substr(search_text,max(1,position-50),250)||CASE WHEN length(search_text)>max(1,position-50)+249 THEN '…' ELSE '' END AS excerpt
 FROM matches WHERE position>0 AND (kind,id)>(?,?) ORDER BY kind,id LIMIT ?`,q,...after,limit+1),stmt(db,'DELETE FROM buoy_assertions')])
 const rows=result[1].results as unknown as {kind:SearchResult['kind'];id:string;title:string;accountIds:string;excerpt:string}[]
 const results:SearchResult[]=rows.slice(0,limit).map(row=>{
  const accountIds=JSON.parse(row.accountIds) as string[]
  const href=row.kind==='contact'||row.kind==='user'?'/app/customer-people?person='+encodeURIComponent(row.id)
   :'/app/accounts/'+encodeURIComponent(accountIds[0])+(row.kind==='task'?'#tasks':'')
  return {...row,accountIds,href}
 })
 const last=results.at(-1)
 return {query:q,results,nextCursor:rows.length>limit&&last?btoa(JSON.stringify([encodeURIComponent(q),last.kind,last.id])):null}
}
