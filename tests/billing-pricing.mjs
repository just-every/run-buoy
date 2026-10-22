import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {startWorker} from './worker.mjs'
import {billingFixtureKey,billingWebhookSecret} from './billing-fixture.mjs'

// One emitted-Worker journey; only the Stripe network edge has synthetic data.
// Dollar examples below are independently worked business bills, not calls to
// the production calculator or a second implementation of it.
export async function pricingJourney(){
 const customerId='synthetic-buoy-3000',subscriptionId='synthetic-buoy-3001',productId='synthetic-buoy-3002',accountId='synthetic-buoy-3003',created=Math.floor(Date.now()/1000)-3600
 let serial=3010,frame,providerInvalid=null
 const calls=[],sid=()=> 'synthetic-buoy-'+serial++
 const coupon=(id,values)=>({id,object:'coupon',livemode:false,valid:true,duration:'forever',duration_in_months:null,percent_off:null,amount_off:null,currency:null,applies_to:null,currency_options:null,...values})
 const discount=(id,values={})=>({id:sid(),object:'discount',coupon:id,customer:customerId,subscription:subscriptionId,subscription_item:null,start:created,end:null,promotion_code:null,...values})
 function plan(){frame={items:[],prices:new Map(),coupons:new Map(),discounts:[],customerDiscount:null,currency:'usd'};providerInvalid=null}
 function item(values={},quantity=1){
  const price={id:sid(),object:'price',livemode:false,billing_scheme:'per_unit',transform_quantity:null,tiers_mode:null,unit_amount_decimal:'1000',unit_amount:1000,product:productId,currency:frame.currency,recurring:{interval:'month',interval_count:1,usage_type:'licensed'},...values}
  frame.prices.set(price.id,price)
  const row={id:sid(),object:'subscription_item',subscription:subscriptionId,quantity,price,discounts:[]};frame.items.push(row);return row
 }
 const tiers=()=>[{up_to:5,unit_amount:500,unit_amount_decimal:'500',flat_amount:1000,flat_amount_decimal:'1000'},{up_to:10,unit_amount:400,unit_amount_decimal:'400',flat_amount:2000,flat_amount_decimal:'2000'},{up_to:null,unit_amount:300,unit_amount_decimal:'300',flat_amount:3000,flat_amount_decimal:'3000'}]
 const providerFetch=async request=>{
  const url=new URL(request.url);calls.push({method:request.method,path:url.pathname,query:Object.fromEntries(url.searchParams)})
  assert.equal(url.origin,'https://api.stripe.com');assert.equal(request.method,'GET','Every pricing/provider lookup stays read-only');assert.equal(request.headers.get('stripe-version'),'2025-02-24.acacia')
  const list=data=>Response.json({object:'list',data,has_more:false})
  if(url.pathname==='/v1/customers')return list([])
  if(url.pathname==='/v1/customers/'+customerId)return Response.json({id:customerId,object:'customer',livemode:false,created,discount:frame.customerDiscount})
  if(url.pathname==='/v1/subscriptions')return list([{id:subscriptionId,object:'subscription',livemode:false,customer:customerId,currency:frame.currency,status:'active',created,current_period_start:created,current_period_end:created+31536000,cancel_at_period_end:false,canceled_at:null,discounts:frame.discounts}])
  if(url.pathname==='/v1/subscription_items')return list(frame.items)
  if(url.pathname.startsWith('/v1/prices/')){const price=frame.prices.get(decodeURIComponent(url.pathname.slice('/v1/prices/'.length)));assert.ok(price);return Response.json(price)}
  if(url.pathname.startsWith('/v1/coupons/')){const value=frame.coupons.get(decodeURIComponent(url.pathname.slice('/v1/coupons/'.length)));assert.ok(value);return Response.json(providerInvalid==='live-coupon'?{...value,livemode:true}:value)}
  assert.ok(['/v1/invoices','/v1/payment_intents','/v1/charges','/v1/credit_notes'].includes(url.pathname),'Pricing fixture refuses any unplanned provider path');return list([])
 }
 plan()
 const app=await startWorker({providerFetch})
 try{
  const call=async(path,method='GET',body,status=200,headers={})=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body,headers});assert.equal(r.status,status,`${method} ${path}: ${await r.clone().text()}`);return r.json()}
  const on=new Date().toISOString().slice(0,10)
  await call('/accounts','POST',{id:accountId,name:'Synthetic pricing customer',renewalDate:new Date(Date.now()+365*86400000).toISOString().slice(0,10),noticeDays:30,renewalEvidence:'Reviewed synthetic pricing terms',billing:null,support:null},201)
  const connection=await call('/connections','POST',{name:'Pricing source',key:billingFixtureKey},201),base='/billing/'+connection.id
  const preview=await call(base+'/bindings/preview','POST',{customerId,accountId});await call(base+'/bindings','POST',{token:preview.token},201)
  await call(base+'/webhook-secret','PUT',{secret:billingWebhookSecret})
  const state=()=>call('/billing'),observation=async()=>(await state()).observations.find(o=>o.accountId===accountId)
  const sync=async(label,arr,mrr,code=frame.currency.toUpperCase())=>{const run=await call(base+'/sync','POST',{});assert.equal(run.status,'succeeded',label+': '+run.error);const row=await observation(),r=row.document.revenue.find(r=>r.currency===code);assert.ok(r,label+' native currency');assert.equal(r.arr.roundedMinor,arr,label+' ARR');assert.equal(r.mrr.roundedMinor,mrr,label+' MRR');assert.equal(row.observedAt.slice(0,10),on);return row}

  item({unit_amount:1000,unit_amount_decimal:'1000',transform_quantity:{divide_by:5,round:'up'}},6)
  item({unit_amount:1000,unit_amount_decimal:'1000',transform_quantity:{divide_by:5,round:'down'}},6)
  await sync('Six users, five-user bundles: two rounded up and one rounded down',36000,3000)

  for(const [mode,quantity,arr,mrr]of [['volume',12,79200,6600],['graduated',12,133200,11100],['graduated',0,12000,1000],['volume',5,42000,3500],['graduated',6,70800,5900]]){
   plan();const row=item({billing_scheme:'tiered',tiers_mode:mode,unit_amount:null,unit_amount_decimal:null,tiers:tiers()},quantity)
   // Stripe does not include tiers unless expanded; the fixed price GET must.
   row.price={...row.price};delete row.price.tiers
   const result=await sync(mode+' tier bill at quantity '+quantity,arr,mrr)
   assert.equal(result.document.subscriptions[0].lines[0].tiers.length,3)
  }
  assert.ok(calls.some(c=>c.path.startsWith('/v1/prices/')&&c.query['expand[0]']==='tiers'),'Tier facts came through the fixed expanded price read')

  plan();const first=item({unit_amount:10000,unit_amount_decimal:'10000'}),second=item({unit_amount:6000,unit_amount_decimal:'6000'})
  const itemCoupon='synthetic-buoy-3100 / 10%!',percentCoupon='synthetic-buoy-3101',fixedCoupon='synthetic-buoy-3102'
  frame.coupons.set(itemCoupon,coupon(itemCoupon,{percent_off:10}));frame.coupons.set(percentCoupon,coupon(percentCoupon,{percent_off:20}));frame.coupons.set(fixedCoupon,coupon(fixedCoupon,{amount_off:500,currency:'usd'}))
  first.discounts=[discount(itemCoupon,{subscription_item:first.id})];frame.discounts=[discount(percentCoupon),discount(fixedCoupon)]
  let priced=await sync('Item 10% before subscription 20% then 500 minor off: (9000+6000)*0.8-500',138000,11500)
  assert.equal(priced.document.subscriptions[0].lines[0].discounts[0].couponId,itemCoupon)
  assert.ok(calls.some(c=>c.path==='/v1/coupons/'+encodeURIComponent(itemCoupon)),'Buyer-chosen coupon ID punctuation is encoded on a fixed provider path')
  frame.discounts.reverse();await sync('Changing stack order changes recurring price: (15000-500)*0.8',139200,11600)

  plan();item({unit_amount:60001,unit_amount_decimal:'60001',recurring:{interval:'year',interval_count:1,usage_type:'licensed'}},2)
  frame.coupons.set(fixedCoupon,coupon(fixedCoupon,{amount_off:1000,currency:'usd'}));frame.discounts=[discount(fixedCoupon)]
  priced=await sync('Annual fixed discount is normalized once with the annual amount',119002,9917)
  assert.deepEqual(priced.document.revenue[0].mrr,{numeratorMinor:'59501',denominator:'6',roundedMinor:9917})

  plan();item({unit_amount:10000,unit_amount_decimal:'10000'})
  const repeating='synthetic-buoy-3110',expired='synthetic-buoy-3111',once='synthetic-buoy-3112',redeemed='synthetic-buoy-3113'
  frame.coupons.set(repeating,coupon(repeating,{percent_off:25.5,duration:'repeating',duration_in_months:3}));frame.coupons.set(expired,coupon(expired,{percent_off:50,duration:'repeating',duration_in_months:1}));frame.coupons.set(once,coupon(once,{percent_off:100,duration:'once'}));frame.coupons.set(redeemed,coupon(redeemed,{percent_off:10,valid:false}))
  frame.discounts=[discount(repeating,{end:created+86400}),discount(expired,{end:created+1}),discount(once),discount(redeemed)]
  priced=await sync('Current repeating 25.5%, expired/once excluded, previously redeemed permanent 10% retained',80460,6705)
  assert.equal(priced.document.subscriptions[0].discounts.length,4,'Excluded and no-longer-redeemable coupon facts remain visible')

  plan();item({unit_amount:10000,unit_amount_decimal:'10000'});item({unit_amount:5000,unit_amount_decimal:'5000',product:'synthetic-buoy-3120'})
  frame.coupons.set(percentCoupon,coupon(percentCoupon,{percent_off:20,applies_to:{products:[productId]}}));frame.discounts=[discount(percentCoupon)]
  await sync('Product-restricted 20% affects the 10000 item only',156000,13000)
  frame.coupons.set(percentCoupon,coupon(percentCoupon,{amount_off:20000,currency:'usd',applies_to:{products:[productId]}}));await sync('Fixed product discount caps at the eligible amount, never negative',60000,5000)
  frame.coupons.set(percentCoupon,coupon(percentCoupon,{amount_off:999,currency:'eur',currency_options:{usd:{amount_off:1000}}}));await sync('Selected native currency option gives 1000 USD minor off, without FX guessing',168000,14000)

  plan();item({unit_amount:1000,unit_amount_decimal:'1000'});const metered=item({unit_amount:null,unit_amount_decimal:'35.5',recurring:{interval:'month',interval_count:1,usage_type:'metered'}},null)
  frame.coupons.set(fixedCoupon,coupon(fixedCoupon,{amount_off:100,currency:'usd'}));metered.discounts=[discount(fixedCoupon,{subscription_item:metered.id})]
  priced=await sync('Uncommitted metered usage never inflates licensed recurring revenue',12000,1000)
  const meter=priced.document.subscriptions[0].lines.find(l=>l.usageType==='metered');assert.equal(meter.quantity,null);assert.equal(meter.unitAmountDecimal,'35.5');assert.equal(meter.discounts.length,1)
  frame.items=[metered];await sync('Meter-only subscription has known zero contracted recurring amount',0,0)

  plan();frame.currency='kwd';item({unit_amount:null,unit_amount_decimal:'0.25',recurring:{interval:'month',interval_count:3,usage_type:'licensed'}},3)
  priced=await sync('Fractional minor units in three-decimal currency remain exact before display rounding',3,0,'KWD')
  assert.deepEqual(priced.document.revenue[0].mrr,{numeratorMinor:'1',denominator:'4',roundedMinor:0})
  plan();frame.currency='jpy';item({unit_amount:null,unit_amount_decimal:'0.5'});await sync('Zero-decimal currency still keeps a decimal unit price and half-up minor display',6,1,'JPY')

  plan();item({unit_amount:10000,unit_amount_decimal:'10000'});frame.coupons.set(percentCoupon,coupon(percentCoupon,{percent_off:20}));frame.discounts=[discount(percentCoupon)]
  const prior=await sync('Signed discount update initial recurring terms',96000,8000)
  frame.coupons.set(percentCoupon,coupon(percentCoupon,{percent_off:25}))
  const event={id:sid(),object:'event',livemode:false,type:'customer.discount.updated',created:Math.floor(Date.now()/1000),data:{object:{id:sid(),object:'discount',customer:customerId}}},t=Math.floor(Date.now()/1000),signature=`t=${t},v1=${createHmac('sha256',billingWebhookSecret).update(t+'.'+JSON.stringify(event)).digest('hex')}`
  await call(base+'/webhook','POST',event,200,{'stripe-signature':signature})
  const changed=await observation();assert.equal(changed.document.revenue[0].arr.roundedMinor,90000);assert.ok((await state()).history.some(o=>o.id===prior.id&&o.document.revenue[0].arr.roundedMinor===96000),'A verified discount change appends source history without overwriting prior terms')
  frame.discounts=[];frame.customerDiscount=discount(percentCoupon,{subscription:null});await sync('Customer recurring discount is inherited when the subscription has none',90000,7500)

  for(const invalid of ['tiers','transform','coupon-percent','live-coupon','unexpanded-discount']){
   const before=await observation(),history=(await state()).history.map(o=>o.id)
   plan();const row=item()
   if(invalid==='tiers'){row.price.billing_scheme='tiered';row.price.tiers_mode='graduated';row.price.unit_amount_decimal=null;row.price.tiers=[{up_to:5,unit_amount:1},{up_to:4,unit_amount:1},{up_to:null,flat_amount:0}]}
   if(invalid==='transform')row.price.transform_quantity={divide_by:0,round:'up'}
   if(['coupon-percent','live-coupon'].includes(invalid)){frame.coupons.set(percentCoupon,coupon(percentCoupon,{percent_off:invalid==='coupon-percent'?101:20}));frame.discounts=[discount(percentCoupon)];providerInvalid=invalid}
   if(invalid==='unexpanded-discount')frame.discounts=['synthetic-buoy-3199']
   const run=await call(base+'/sync','POST',{});assert.equal(run.status,'failed',invalid+' must fail the complete customer read')
   const after=await observation();assert.equal(after.id,before.id);assert.deepEqual(after.document,before.document);assert.equal(after.freshness,'Failed');assert.deepEqual((await state()).history.map(o=>o.id),history,'Invalid pricing cannot append a partial source observation')
  }
  assert.ok(calls.every(call=>call.method==='GET'))
  console.log('Stripe pricing public HTTP: transformed quantities; volume/graduated/flat tiers and boundaries; decimal native amounts; ordered item/subscription/product/currency recurring discounts; expiry and one-off treatment; metered exclusion with retained source facts; signed coupon update; complete-read invalidation and GET-only lookups passed.')
 }finally{await app.close()}
}
