import {stmt} from './core'
export async function trustNotes(db:D1Database,accountId?:string){
 const rows=(await stmt(db,`SELECT id,account_id,related_account_id,reviewed_at FROM buoy_trust_proposals WHERE status='approved' AND kind='mapping' ${accountId?'AND (account_id=? OR related_account_id=?)':''} ORDER BY reviewed_at,id`,...(accountId?[accountId,accountId]:[])).all<{id:string;account_id:string;related_account_id:string|null;reviewed_at:string}>()).results
 const result=new Map<string,string[]>()
 for(const row of rows)for(const target of [row.account_id,row.related_account_id])if(target){const notes=result.get(target)??[];notes.push(`Data trust correction ${row.id}: Segment attribution reviewed at ${row.reviewed_at}; health refreshed after this change.`);result.set(target,notes)}
 return result
}
