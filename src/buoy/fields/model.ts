import { insist, object, text, date } from '../core'
import { minorUnitDigits } from '../currencies'
import { evaluateFormula, validateFormula, formulaReferences } from './formula'
export type Definition = {key:string;label:string;type:string;options?:string[];formula?:string}
export type FieldAccount = {id:string;name:string;revision:string;document:string;manual:Record<string,unknown>;previous:Record<string,unknown>}
export interface Image {definitions:Definition[];accounts:FieldAccount[]}
export const BASE_FIELDS = ['id','name','renewalDate','noticeDays','renewalEvidence','billing.observedAt','billing.reference','billing.currency','billing.totalMinor','billing.creditsMinor','billing.allocatedMinor','billing.dueDate','support.observedAt','support.reference','support.openTickets','support.urgentTickets']
const TYPES=['text','number','currency','date','picklist','multi-select','boolean','formula']
export function definition(input:Record<string,unknown>):Definition {
 insist(Object.keys(input).every(k=>['key','label','type','options','formula'].includes(k)),'Unsupported field definition property.')
 const key=text(input.key,'Field key',60);insist(/^[a-z][a-z0-9_]*$/.test(key),'Use a lowercase field key with letters, digits and underscores.')
 insist(TYPES.includes(String(input.type)),'Choose a supported field type.')
 const result:Definition={key,label:text(input.label,'Field label',100),type:String(input.type)}
 if(['picklist','multi-select'].includes(result.type)){
  insist(Array.isArray(input.options)&&input.options.length>0&&input.options.length<=100,'Choose 1–100 field options.')
  result.options=input.options.map(v=>text(v,'Option',100));insist(new Set(result.options).size===result.options.length,'Field options must be unique.')
 }else insist(input.options===undefined,'Only choice fields accept options.')
 if(result.type==='formula')result.formula=text(input.formula,'Formula',2000)
 else insist(input.formula===undefined,'Only calculated fields accept a formula.')
 return result
}
export function fieldValue(d:Definition,value:unknown):unknown {
 if(value===null)return null
 switch(d.type){
  case 'text':insist(typeof value==='string'&&value.length<=4000,'Text fields accept up to 4000 characters.');return value
  case 'number':insist(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER,'Number fields need a finite safe number.');return value
  case 'boolean':insist(typeof value==='boolean','Boolean fields need true or false.');return value
  case 'date':return date(value,'Custom date')
  case 'picklist':insist(d.options?.includes(String(value))&&typeof value==='string','Choose a configured field option.');return value
  case 'multi-select':insist(Array.isArray(value)&&value.every(v=>typeof v==='string'&&d.options?.includes(v))&&new Set(value).size===value.length,'Choose unique configured field options.');return value
  case 'currency':{
   const money=object(value);insist(Object.keys(money).length===2&&Object.hasOwn(money,'currency')&&Object.hasOwn(money,'amountMinor'),'Currency fields need currency and amountMinor.')
   insist(typeof money.currency==='string'&&minorUnitDigits(money.currency)!==undefined,'Use a supported ISO 4217 currency code.')
   insist(Number.isSafeInteger(money.amountMinor)&&Number(money.amountMinor)>=0,'Currency amountMinor must be a nonnegative safe whole number.');return money
  }
  default:insist(false,'Calculated values cannot be entered by hand.')
 }
}
export function references(defs:Definition[],baseFields=BASE_FIELDS) {
 return [...baseFields,...defs.flatMap(d=>d.type==='currency'?[`custom.${d.key}.amountMinor`,`custom.${d.key}.currency`]:[`custom.${d.key}`])]
}
export function ordered(defs:Definition[],baseFields=BASE_FIELDS) {
 const pending=defs.filter(d=>d.type==='formula'),done:Definition[]=[],active=new Set<string>(),visited=new Set<string>()
 const visit=(d:Definition)=>{
  if(visited.has(d.key))return
  insist(!active.has(d.key),'Calculated fields cannot have circular dependencies.');active.add(d.key)
  try{validateFormula(d.formula!,references(defs,baseFields))}catch(error){insist(false,error instanceof Error?error.message:'Invalid formula.')} 
  for(const ref of formulaReferences(d.formula!)){const dep=pending.find(x=>`custom.${x.key}`===ref);if(dep)visit(dep)}
  active.delete(d.key);visited.add(d.key);done.push(d)
 }
 pending.forEach(visit);return done
}
export function flatten(a:FieldAccount,values:Record<string,unknown>,baseFields=BASE_FIELDS) {
 const doc=JSON.parse(a.document),flat:Record<string,unknown>={id:a.id,name:a.name}
 for(const key of baseFields){const [parent,child]=key.split('.');flat[key]=key==='id'?a.id:key==='name'?a.name:child?doc[parent]?.[child]??null:doc[parent]??null}
 for(const [key,value] of Object.entries(values)){
  flat[`custom.${key}`]=value
  if(value&&typeof value==='object'&&!Array.isArray(value))for(const [part,v] of Object.entries(value))flat[`custom.${key}.${part}`]=v
 }
 return flat
}
export function evaluate(image:Image,baseFields=BASE_FIELDS) {
 const formulas=ordered(image.definitions,baseFields)
 const results=image.accounts.map(a=>({id:a.id,name:a.name,revision:a.revision,values:Object.fromEntries(image.definitions.filter(d=>d.type!=='formula').map(d=>[d.key,a.manual[d.key]??null])),explanations:{} as Record<string,string>}))
 for(const d of formulas){
  const portfolio=image.accounts.map((a,i)=>flatten(a,results[i].values,baseFields))
  for(let i=0;i<results.length;i++){
   const result=evaluateFormula(d.formula!,portfolio[i],portfolio)
   results[i].values[d.key]=result.value;results[i].explanations[d.key]=result.explanation
  }
 }
 return results
}
export function ruleFields(defs:Definition[]):Record<string,'text'|'number'> {
 return Object.fromEntries(defs.flatMap(d=>d.type==='currency'?[[`custom.${d.key}.amountMinor`,'number'],[`custom.${d.key}.currency`,'text']]:[[`custom.${d.key}`,['number','formula','boolean'].includes(d.type)?'number':'text']]))
}
export function ruleValues(defs:Definition[],values:Record<string,unknown>):Record<string,string|number|null> {
 const result:Record<string,string|number|null>={}
 for(const d of defs){const v=values[d.key]??null
  if(d.type==='currency'){const m=v as {currency:string;amountMinor:number}|null;result[`custom.${d.key}.amountMinor`]=m?.amountMinor??null;result[`custom.${d.key}.currency`]=m?.currency??null}
  else result[`custom.${d.key}`]=v===null?null:typeof v==='boolean'?Number(v):Array.isArray(v)?JSON.stringify(v):v as string|number
 }return result
}
