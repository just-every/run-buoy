import {insist,text,type Actor} from '../core'
import {roleAccess,type RoleAccess} from './access'
import {projectState} from './projection'

/** Match the sanitized projection itself. Forbidden text never participates in
 * matching, excerpts, counts, ordering or pagination. */
export async function scopedSearch(db:D1Database,actor:Actor,query:URLSearchParams,provided?:RoleAccess){
 insist([...query.keys()].every(key=>['q','limit','cursor'].includes(key)&&query.getAll(key).length===1),'Unsupported or repeated search parameter.')
 const q=text(query.get('q'),'Search text',200);insist(!/[\u0000-\u001f]/.test(q),'Search text cannot contain control characters.')
 const limit=Number(query.get('limit')??50);insist(Number.isInteger(limit)&&limit>=1&&limit<=100,'Search page size must be 1–100.')
 let after=''
 if(query.has('cursor')){
  let cursor:unknown;try{cursor=JSON.parse(atob(query.get('cursor')!))}catch{insist(false,'Invalid search cursor.')}
  insist(Array.isArray(cursor)&&cursor.length===3&&cursor[0]===encodeURIComponent(q)&&cursor[1]==='account'&&typeof cursor[2]==='string'&&cursor[2].length>0&&cursor[2].length<=200,'Invalid search cursor for this query.');after=cursor[2]
 }
 const access=provided??await roleAccess(db,actor),{state}=await import('../accounts'),data=await projectState(db,actor,await state(db,actor),access)
 const matches=data.accounts.map(account=>{
  const searchText=[account.id,account.name,account.renewalDate,account.ownerId??'',account.health.status,account.arrBand?.label??'',...(account.commercial?[account.commercial.currency??'',account.commercial.arrMinor===null?'':String(account.commercial.arrMinor),account.commercial.mrrMinor===null?'':String(account.commercial.mrrMinor)]:[])].join('\n')
  return {account,searchText,position:searchText.toLowerCase().indexOf(q.toLowerCase())}
 }).filter(row=>row.position>=0&&row.account.id>after).sort((a,b)=>a.account.id<b.account.id?-1:a.account.id>b.account.id?1:0)
 const results=matches.slice(0,limit).map(({account,searchText,position})=>({kind:'account' as const,id:account.id,title:account.name,accountIds:[account.id],excerpt:(position>50?'…':'')+searchText.slice(Math.max(0,position-50),Math.max(0,position-50)+250),href:'/app/accounts/'+encodeURIComponent(account.id)}))
 const last=results.at(-1)
 return {query:q,results,nextCursor:matches.length>limit&&last?btoa(JSON.stringify([encodeURIComponent(q),'account',last.id])):null,interpretation:'Search is limited to current account fields permitted by the assigned profile. Linked records and source text are not searched.'}
}
