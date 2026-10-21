import {REVENUE_FIELDS} from '../revenue/model'
import { insist, object, text } from '../core'
export const TIERS = ['high-touch', 'scaled', 'digital']
export const STAGES = ['onboarding', 'adoption', 'expansion', 'renewal', 'churned']
export const FIELDS: Record<string, 'text' | 'number'> = {...REVENUE_FIELDS,
 id:'text',name:'text',renewalDate:'text',noticeDays:'number',renewalEvidence:'text',revision:'text',createdAt:'text',ownerId:'text',territory:'text',tier:'text',stage:'text',
 'billing.observedAt':'text','billing.reference':'text','billing.currency':'text','billing.totalMinor':'number','billing.creditsMinor':'number','billing.allocatedMinor':'number','billing.dueDate':'text','billing.balanceMinor':'number',
 'support.observedAt':'text','support.reference':'text','support.openTickets':'number','support.urgentTickets':'number',
 'health.score':'number','health.recalculatedAt':'text','health.nativeStatus':'text','health.nativeReasons':'text','health.status':'text','health.reasons':'text','health.billingMissing':'number','health.billingStale':'number','health.supportMissing':'number','health.supportStale':'number',
 'sentiment.rating':'text','sentiment.reason':'text','sentiment.recordedBy':'text','sentiment.recordedAt':'text','sentiment.expiresOn':'text',
 openTasks:'number',completedTasks:'number',daysToRenewal:'number',noticeDate:'text'
}
export type Values = Record<string, string | number | null>
export type RelatedPeople = {contact:Values[];user:Values[]}
export interface Condition {field:string;op:string;value?:string|number}
export interface Rules {match:'all'|'any';conditions:Condition[]}
export interface Segment {id:string;name:string;mode:'static'|'dynamic';rules:Rules;accountIds:string[];tier:string|null;stage:string|null;playbook:{title:string;dueDays:number}|null;revision:string;createdAt:string}
const keys = (row:Record<string,unknown>,allowed:string[]) => insist(Object.keys(row).every(k=>allowed.includes(k)), 'Unsupported segment field.')
export function classify(value:unknown,kind:'tier'|'stage',tiers=TIERS) {
 insist(value === null || (kind==='tier'?tiers:STAGES).includes(String(value)), `Choose a valid ${kind}.`)
 return value as string|null
}
export function segmentInput(input:Record<string,unknown>,accountIds:Set<string>,tiers=TIERS,fields=FIELDS) {
 keys(input,['id','revision','name','mode','rules','accountIds','tier','stage','playbook'])
 insist(input.mode==='dynamic'||input.mode==='static','Choose dynamic or static membership.')
 const rules=object(input.rules);keys(rules,['match','conditions'])
 insist(rules.match==='all'||rules.match==='any','Choose all or any conditions.')
 insist(Array.isArray(rules.conditions)&&rules.conditions.length<=32,'Use at most 32 conditions.')
 const conditions=rules.conditions.map(value=>{
  const c=object(value);keys(c,['field','op','value'])
  const field=text(c.field,'Rule field',200),op=String(c.op),kind=fields[field]
  insist(kind,'Choose a supported rule field.')
  insist(['eq','ne','is-missing',...(kind==='number'?['gt','gte','lt','lte']:['contains','gt','gte','lt','lte'])].includes(op),'Choose a supported rule operator.')
  if(op==='is-missing'){insist(c.value===undefined,'Missing checks take no value.');return {field,op}}
  const customNumber=field==='health.score'||field.startsWith('custom.')||field.startsWith('adoption.')||/^people\.(contact|user)\.(custom|adoption)\./.test(field)
  insist(typeof c.value===(kind==='text'?'string':'number')&&(kind!=='number'||(customNumber?Number.isFinite(c.value):Number.isSafeInteger(c.value))),`Rule value must be ${kind==='number'?(customNumber?'a finite number':'a safe whole number'):'text'}.`)
  if(kind==='text')insist(String(c.value).length<=1000,'Rule text is too long.')
  return {field,op,value:c.value as string|number}
 })
 for(const c of conditions)if(['revenue.arrMinor','revenue.mrrMinor'].includes(c.field)&&c.op!=='is-missing')insist(rules.match==='all'&&conditions.some(other=>other.field==='revenue.currency'&&other.op==='eq'),'A recurring revenue comparison needs an all-rule with its exact currency.')
 for(const c of conditions)if((c.field.startsWith('custom.')||/^people\.(contact|user)\.custom\./.test(c.field))&&c.field.endsWith('.amountMinor')&&c.op!=='is-missing'){
  const currency=c.field.replace(/\.amountMinor$/,'.currency')
  insist(rules.match==='all'&&conditions.some(other=>other.field===currency&&other.op==='eq'),'A custom money comparison needs an all-rule with its exact currency.')
 }
 insist(input.mode==='static'||conditions.length>0,'Dynamic segments need a condition.')
 insist(Array.isArray(input.accountIds)&&input.accountIds.length<=500,'Static membership must be an account-id array.')
 const ids=input.accountIds.map(v=>text(v,'Static account',100));insist(new Set(ids).size===ids.length&&ids.every(v=>accountIds.has(v)),'Static account ids must be unique existing accounts.')
 insist(input.mode==='static'||ids.length===0,'Dynamic segments do not take static members.')
 let playbook:Segment['playbook']=null
 if(input.playbook!==null&&input.playbook!==undefined){const p=object(input.playbook);keys(p,['title','dueDays']);insist(Number.isInteger(p.dueDays)&&Number(p.dueDays)>=0&&Number(p.dueDays)<=365,'Entry task is due in 0 to 365 whole days.');playbook={title:text(p.title,'Entry task title',500),dueDays:Number(p.dueDays)}}
 return {name:text(input.name,'Segment name',100),mode:input.mode,rules:{match:rules.match,conditions},accountIds:ids,tier:classify(input.tier??null,'tier',tiers),stage:classify(input.stage??null,'stage'),playbook} as Omit<Segment,'id'|'revision'|'createdAt'>
}
function conditionMatches(c:Condition,values:Values){
  const v=values[c.field]??null
  if(c.op==='is-missing')return v===null
  if(v===null)return false
  switch(c.op){case'eq':return v===c.value;case'ne':return v!==c.value;case'contains':return String(v).includes(String(c.value));case'gt':return v>c.value!;case'gte':return v>=c.value!;case'lt':return v<c.value!;case'lte':return v<=c.value!;default:return false}
}
export function matches(rules:Rules,values:Values,people:RelatedPeople={contact:[],user:[]}) {
 const native=rules.conditions.filter(c=>!/^people\.(contact|user)\./.test(c.field))
 const tests=native.map(c=>conditionMatches(c,values))
 for(const kind of ['contact','user'] as const){
  const prefix=`people.${kind}.`,conditions=rules.conditions.filter(c=>c.field.startsWith(prefix)).map(c=>({...c,field:c.field.slice(prefix.length)}))
  // Conjunctions bind to the same related record, including money's exact
  // currency. Two different people cannot jointly satisfy one person predicate.
  if(conditions.length)tests.push(people[kind].some(person=>rules.match==='all'?conditions.every(c=>conditionMatches(c,person)):conditions.some(c=>conditionMatches(c,person))))
 }
 return rules.match==='all'?tests.every(Boolean):tests.some(Boolean)
}
export const includes = (segment:Segment,id:string,values:Values,people?:RelatedPeople) => segment.mode==='static'?segment.accountIds.includes(id):matches(segment.rules,values,people)
