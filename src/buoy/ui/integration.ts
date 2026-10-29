import type {IntegrationInventory} from '../integration'
import {escape,section} from './html'
import type {State} from './types'

const timestamp=(value:string|number|null,unknown:string)=>{
 if(value===null)return unknown
 const instant=new Date(value)
 return '<time datetime="'+escape(instant.toISOString())+'">'+escape(new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(instant))+' UTC</time>'
}
const operations:Record<string,string>={'accounts.read':'Read accounts','accounts.write':'Write accounts'}
const reasons:Record<string,string>={revocation:'Revoked by owner',expiry:'Expired',issuer_change:'Issuing owner changed',account_erasure:'Account erased; named grant withdrawn'}

export function integrationPanel(inventory:IntegrationInventory,state:State):string{
 const records=inventory.items.map(token=>{
  const accounts=token.accountScope==='all'?'All current and future accounts':token.accountIds.map(id=>{
   const account=state.accounts.find(account=>account.id===id)
   return account?account.name+' ('+id+')':id
  }).join(', ')||'No remaining accounts'
  const values=[
   ['Operations',token.scopes.map(scope=>escape(operations[scope]??scope)).join(' · ')],
   ['Account scope',escape(accounts)],
   ['Rate limit',escape(token.requestsPerMinute)+' requests per UTC minute'],
   ['Issuer',escape(token.issuer.displayName??'Former owner')+' ('+escape(token.issuer.id)+')'],
   ['Created (UTC)',timestamp(token.createdAt,'Unknown')],
   ['Last used (UTC)',timestamp(token.lastUsedAt,'Never used')],
   ['Expires (UTC)',timestamp(token.expiresAt,'Unknown')],
   ['Expiry warning',token.expiringSoon?'Expires within 14 days':'None'],
   ['Stop reason',token.stoppedReason?escape(reasons[token.stoppedReason]??token.stoppedReason):'Active']
  ]
  return '<article class="record" data-integration-id="'+escape(token.id)+'"><h3>'+escape(token.label)+'</h3><dl>'+values.map(([label,value])=>'<dt>'+label+'</dt><dd>'+value+'</dd>').join('')+'</dl></article>'
 }).join('')
 return section('Integration credentials','<p>Owner-only inventory of server credentials. Secrets and stored hashes are never shown. Times are UTC; unknown creation times remain unknown.</p>'+ (records||'<p>No integration credentials have been issued.</p>'),'integration-inventory')
}
