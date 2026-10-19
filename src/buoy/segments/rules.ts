import { insist, object, text } from '../core'
export const TIERS = ['high-touch', 'scaled', 'digital']
export const STAGES = ['onboarding', 'adoption', 'expansion', 'renewal', 'churned']
export const FIELDS: Record<string, 'text' | 'number'> = {
 id:'text',name:'text',renewalDate:'text',noticeDays:'number',renewalEvidence:'text',revision:'text',createdAt:'text',ownerId:'text',territory:'text',tier:'text',stage:'text',
 'billing.observedAt':'text','billing.reference':'text','billing.currency':'text','billing.totalMinor':'number','billing.creditsMinor':'number','billing.allocatedMinor':'number','billing.dueDate':'text','billing.balanceMinor':'number',
 'support.observedAt':'text','support.reference':'text','support.openTickets':'number','support.urgentTickets':'number',
 'health.status':'text','health.reasons':'text','health.billingMissing':'number','health.billingStale':'number','health.supportMissing':'number','health.supportStale':'number',
 'sentiment.rating':'text','sentiment.reason':'text','sentiment.recordedBy':'text','sentiment.recordedAt':'text','sentiment.expiresOn':'text',
 openTasks:'number',completedTasks:'number',daysToRenewal:'number',noticeDate:'text'
}
export type Values = Record<string, string | number | null>
export interface Condition {field:string;op:string;value?:string|number}
export interface Rules {match:'all'|'any';conditions:Condition[]}
export interface Segment {id:string;name:string;mode:'static'|'dynamic';rules:Rules;accountIds:string[];tier:string|null;stage:string|null;playbook:{title:string;dueDays:number}|null;revision:string;createdAt:string}
const keys = (row:Record<string,unknown>,allowed:string[]) => insist(Object.keys(row).every(k=>allowed.includes(k)), 'Unsupported segment field.')
export function classify(value:unknown,kind:'tier'|'stage') {
 insist(value === null || (kind==='tier'?TIERS:STAGES).includes(String(value)), `Choose a valid ${kind}.`)
 return value as string|null
}
export function segmentInput(input:Record<string,unknown>,accountIds:Set<string>) {
 keys(input,['id','revision','name','mode','rules','accountIds','tier','stage','playbook'])
 insist(input.mode==='dynamic'||input.mode==='static','Choose dynamic or static membership.')
 const rules=object(input.rules);keys(rules,['match','conditions'])
 insist(rules.match==='all'||rules.match==='any','Choose all or any conditions.')
 insist(Array.isArray(rules.conditions)&&rules.conditions.length<=32,'Use at most 32 conditions.')
 const conditions=rules.conditions.map(value=>{
  const c=object(value);keys(c,['field','op','value'])
  const field=text(c.field,'Rule field',100),op=String(c.op),kind=FIELDS[field]
  insist(kind,'Choose a supported rule field.')
  insist(['eq','ne','is-missing',...(kind==='number'?['gt','gte','lt','lte']:['contains','gt','gte','lt','lte'])].includes(op),'Choose a supported rule operator.')
  if(op==='is-missing'){insist(c.value===undefined,'Missing checks take no value.');return {field,op}}
  insist(typeof c.value===(kind==='text'?'string':'number')&&(kind!=='number'||Number.isSafeInteger(c.value)),`Rule value must be ${kind==='number'?'a safe whole number':'text'}.`)
  if(kind==='text')insist(String(c.value).length<=1000,'Rule text is too long.')
  return {field,op,value:c.value as string|number}
 })
 insist(input.mode==='static'||conditions.length>0,'Dynamic segments need a condition.')
 insist(Array.isArray(input.accountIds)&&input.accountIds.length<=500,'Static membership must be an account-id array.')
 const ids=input.accountIds.map(v=>text(v,'Static account',100));insist(new Set(ids).size===ids.length&&ids.every(v=>accountIds.has(v)),'Static account ids must be unique existing accounts.')
 insist(input.mode==='static'||ids.length===0,'Dynamic segments do not take static members.')
 let playbook:Segment['playbook']=null
 if(input.playbook!==null&&input.playbook!==undefined){const p=object(input.playbook);keys(p,['title','dueDays']);insist(Number.isInteger(p.dueDays)&&Number(p.dueDays)>=0&&Number(p.dueDays)<=365,'Entry task is due in 0 to 365 whole days.');playbook={title:text(p.title,'Entry task title',500),dueDays:Number(p.dueDays)}}
 return {name:text(input.name,'Segment name',100),mode:input.mode,rules:{match:rules.match,conditions},accountIds:ids,tier:classify(input.tier??null,'tier'),stage:classify(input.stage??null,'stage'),playbook} as Omit<Segment,'id'|'revision'|'createdAt'>
}
export function matches(rules:Rules,values:Values) {
 const tests=rules.conditions.map(c=>{
  const v=values[c.field]??null
  if(c.op==='is-missing')return v===null
  if(v===null)return false
  switch(c.op){case'eq':return v===c.value;case'ne':return v!==c.value;case'contains':return String(v).includes(String(c.value));case'gt':return v>c.value!;case'gte':return v>=c.value!;case'lt':return v<c.value!;case'lte':return v<=c.value!;default:return false}
 })
 return rules.match==='all'?tests.every(Boolean):tests.some(Boolean)
}
export const includes = (segment:Segment,id:string,values:Values) => segment.mode==='static'?segment.accountIds.includes(id):matches(segment.rules,values)
