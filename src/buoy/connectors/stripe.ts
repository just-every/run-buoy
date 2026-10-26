import { insist } from '../core'
// A fixed provider origin and GET-only transport: product requests cannot
// select an endpoint, change subscriptions or move money.
export async function customers(secret: string, cursor: string | null, observedAt:string) {
 const url=new URL('https://api.stripe.com/v1/customers')
 url.searchParams.set('limit','100')
 if(cursor)url.searchParams.set('starting_after',cursor)
 let response: Response
 try { response=await fetch(url,{method:'GET',redirect:'manual',headers:{Authorization:'Bearer '+secret,'Stripe-Version':'2025-02-24.acacia'},signal:AbortSignal.timeout(20000)}) }
 catch { throw new Error('Stripe could not be reached. Recheck the connection.') }
 if(!response.ok)throw new Error(response.status===401||response.status===403?'Stripe refused the credential. Reconnect with customer-read permission.':response.status===429?'Stripe rate limit reached. Try the next run.':'Stripe request failed (HTTP '+response.status+').')
 const body=await response.json() as {data?: {id?:unknown;object?:unknown;created?:unknown;livemode?:unknown}[];has_more?:unknown}
 insist(Array.isArray(body.data)&&typeof body.has_more==='boolean','Invalid Stripe customer page.',502)
 const records=body.data.map(row=>{
  insist(row.object==='customer'&&typeof row.id==='string'&&/^cus_[A-Za-z0-9]+$/.test(row.id)&&row.livemode===false&&Number.isSafeInteger(row.created)&&Number(row.created)>=0,'Invalid Stripe test customer record.',502)
  new Date(Number(row.created)*1000).toISOString()
  return {id:row.id,observedAt}
 })
 insist(new Set(records.map(r=>r.id)).size===records.length&&(!body.has_more||records.length>0),'Invalid Stripe pagination.',502)
 return {records,more:body.has_more}
}
