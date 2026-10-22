import {descendantIds} from './fields/model'
import {guard,insist,stmt} from './core'
interface Sources {accounts:{id:string;revision:string}[];links:{accountId:string;parentId:string|null;kind:string}[]}
const sql=`WITH RECURSIVE subtree(id) AS(SELECT ? UNION SELECT h.account_id FROM buoy_account_hierarchy h JOIN subtree s ON h.parent_id=s.id)
 SELECT json_object('accounts',json((SELECT json_group_array(json_object('id',id,'revision',revision)) FROM(SELECT id,revision FROM buoy_accounts WHERE id IN(SELECT id FROM subtree) ORDER BY id))),
 'links',json((SELECT json_group_array(json_object('accountId',account_id,'parentId',parent_id,'kind',kind)) FROM(SELECT * FROM buoy_account_hierarchy WHERE account_id IN(SELECT id FROM subtree) ORDER BY account_id))))`
/** Native aggregate inputs stay bound even if a changed source produces the same
 * aggregate, or no custom field happens to consume that aggregate. */
export async function hierarchyProof(image:Sources,accountId:string,on=new Date().toISOString().slice(0,10)){
 const descendants=descendantIds({links:image.links},accountId);if(!descendants.length)return undefined
 const ids=new Set([accountId,...descendants]),value={on,accounts:image.accounts.filter(a=>ids.has(a.id)).map(({id,revision})=>({id,revision})).sort((a,b)=>a.id.localeCompare(b.id)),links:image.links.filter(l=>ids.has(l.accountId)).map(({accountId,parentId,kind})=>({accountId,parentId,kind})).sort((a,b)=>a.accountId.localeCompare(b.accountId))}
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))
 return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')
}
export async function hierarchyApprovalImage(db:D1Database,accountId:string){const row=await stmt(db,sql+' AS snapshot',accountId).first<{snapshot:string}>();insist(row,'Hierarchy approval inputs unavailable.',503);return {raw:row.snapshot,proof:await hierarchyProof(JSON.parse(row.snapshot) as Sources,accountId),accountId}}
export const hierarchyApprovalFence=(db:D1Database,image:Awaited<ReturnType<typeof hierarchyApprovalImage>>)=>guard(db,`(${sql})=?`,image.accountId,image.raw)
