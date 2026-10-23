import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {commit,date,guard,id,insist,now,object,requirePerson,stmt,text,type Actor} from '../core'
import {inputImage} from '../scorecards/inputs'
import {PLAN_SQL,planProjection,type PlanDocument,type PlanRow,type Objective} from './model'
const keys=(value:Record<string,unknown>,allowed:string[])=>insist(Object.keys(value).every(k=>allowed.includes(k)),'Unsupported success plan property.')
export async function plansState(db:D1Database,actor:Actor,accountId:string){
 requirePerson(actor)
 insist(await stmt(db,'SELECT 1 FROM buoy_accounts WHERE id=?',accountId).first(),'Account not found.',404)
 const image=await inputImage(db,new Date()),values=image.accounts.find(a=>a.accountId===accountId)!.inputs.values
 const rows=JSON.parse((await db.prepare(PLAN_SQL).first<{snapshot:string}>())!.snapshot) as PlanRow[]
 return {accountId,plans:rows.filter(p=>p.accountId===accountId).map(p=>planProjection(p,values)),fields:image.fields.filter(f=>!f.related&&f.kind!=='goal'&&(f.valueType===undefined||f.valueType==='number')),interpretation:'Current observed metric attainment can regress. Customer statements await authenticated customer confirmation. Internal drafts grant no customer access.'}
}
export async function savePlan(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>){
 requirePerson(actor);keys(input,['id','revision','accountRevision','name','staffOwnerId','customerOwnerId','objectives'])
 const current=await stmt(db,'SELECT revision FROM buoy_accounts WHERE id=?',accountId).first<{revision:string}>();insist(current,'Account not found.',404)
 insist(input.accountRevision===current.revision,'Account changed. Reload before saving the plan.',409)
 const planId=input.id===undefined?id():text(input.id,'Plan id',100)
 const prior=await stmt(db,'SELECT revision FROM buoy_success_plans WHERE id=? AND account_id=?',planId,accountId).first<{revision:string}>()
 if(input.id!==undefined)insist(prior,'Success plan not found.',404)
 insist(prior?input.revision===prior.revision:input.revision===undefined,'Plan changed. Reload before saving.',409)
 const name=text(input.name,'Plan name',200),staffOwnerId=text(input.staffOwnerId,'Staff owner',100),customerOwnerId=text(input.customerOwnerId,'Customer owner',100)
 const data=await plansState(db,actor,accountId),numeric=new Set(data.fields.map(f=>f.key))
 insist(Array.isArray(input.objectives)&&input.objectives.length>0&&input.objectives.length<=20,'A plan needs 1–20 objectives.')
 const objectives:Objective[]=input.objectives.map(raw=>{
  const value=object(raw);keys(value,['id','title','kind','field','target','direction','dueOn'])
  const common={id:text(value.id,'Objective id',100),title:text(value.title,'Business objective',500),dueOn:date(value.dueOn,'Objective due date')}
  insist(value.kind==='metric'||value.kind==='customer-statement','Choose a metric or customer statement objective.')
  if(value.kind==='customer-statement'){insist(value.field===undefined&&value.target===undefined&&value.direction===undefined,'Customer statements cannot claim metric attainment.');return {...common,kind:'customer-statement'}}
  const field=text(value.field,'Metric',150);insist(numeric.has(field),'Choose an available numeric source metric; goal feedback is refused.')
  insist(typeof value.target==='number'&&Number.isFinite(value.target),'The target must be a finite number.')
  insist(value.direction==='at-least'||value.direction==='at-most','Choose at least or at most.')
  return {...common,kind:'metric',field,target:value.target,direction:value.direction}
 })
 insist(new Set(objectives.map(o=>o.id)).size===objectives.length,'Objective ids must be unique.')
 const revision=id(),stamp=now(),document=JSON.stringify({name,objectives} satisfies PlanDocument)
 await commit(db,actor,accountId,'plan.saved',[
  guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',accountId,current.revision),
  guard(db,prior?'EXISTS(SELECT 1 FROM buoy_success_plans WHERE id=? AND revision=?)':'NOT EXISTS(SELECT 1 FROM buoy_success_plans WHERE id=?)',planId,...(prior?[prior.revision]:[])),
  guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",staffOwnerId),
  guard(db,"EXISTS(SELECT 1 FROM buoy_customer_people p JOIN buoy_customer_memberships m ON m.person_id=p.id WHERE p.id=? AND p.kind='contact' AND m.account_id=?)",customerOwnerId,accountId),
  stmt(db,'INSERT INTO buoy_success_plans(id,account_id,revision,staff_owner_id,customer_owner_id,document,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,staff_owner_id=excluded.staff_owner_id,customer_owner_id=excluded.customer_owner_id,document=excluded.document,updated_at=excluded.updated_at',planId,accountId,revision,staffOwnerId,customerOwnerId,document,stamp,stamp),
  stmt(db,'INSERT INTO buoy_success_plan_history(id,plan_id,account_id,revision,document,actor_id,recorded_at) VALUES(?,?,?,?,?,?,?)',id(),planId,accountId,revision,document,actor.id,stamp),
  stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),accountId)
 ],true)
 return {id:planId,revision}
}
export const plansApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
plansApi.get('/api/buoy/accounts/:id/plans',async c=>c.json(await plansState(c.env.DB,c.get('actor'),c.req.param('id'))))
plansApi.post('/api/buoy/accounts/:id/plans',async c=>c.json(await savePlan(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw)),201))
