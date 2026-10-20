import { insist } from '../core'
import { definition, fieldValue, ruleFields, ruleValues, type Definition } from '../fields/model'
import { evaluateFormula, formulaReferences, validateFormula } from '../fields/formula'
import type { PeopleImage, PersonRow } from './snapshot'

export { definition, fieldValue }
export const PERSON_FIELDS:Record<string,'text'|'number'>={id:'text',name:'text',kind:'text',createdAt:'text',accountCount:'number'}
export function personReferences(definitions:Definition[]){
 return [...Object.keys(PERSON_FIELDS),...Object.keys(ruleFields(definitions))]
}
export function orderedPeople(definitions:Definition[]){
 const formulas=definitions.filter(d=>d.type==='formula'),ordered:Definition[]=[],active=new Set<string>(),done=new Set<string>()
 const visit=(d:Definition)=>{
  if(done.has(d.key))return
  insist(!active.has(d.key),'Calculated fields cannot have circular dependencies.');active.add(d.key)
  try{validateFormula(d.formula!,personReferences(definitions))}catch(error){insist(false,error instanceof Error?error.message:'Invalid formula.')}
  for(const ref of formulaReferences(d.formula!)){const dependency=formulas.find(item=>ref===`custom.${item.key}`);if(dependency)visit(dependency)}
  active.delete(d.key);done.add(d.key);ordered.push(d)
 }
 formulas.forEach(visit);return ordered
}
function formulaInputs(person:PersonRow,values:Record<string,unknown>){
 const flat:Record<string,unknown>={id:person.id,name:person.name,kind:person.kind,createdAt:person.createdAt,accountCount:person.accountIds.length}
 for(const [key,value] of Object.entries(values)){
  flat[`custom.${key}`]=value
  if(value&&typeof value==='object'&&!Array.isArray(value))for(const [part,v] of Object.entries(value))flat[`custom.${key}.${part}`]=v
 }
 return flat
}
export function evaluatePeople(image:PeopleImage){
 const formulas=orderedPeople(image.definitions)
 const records=image.records.map(person=>({id:person.id,kind:person.kind,name:person.name,accountIds:person.accountIds,revision:person.revision,createdAt:person.createdAt,
  values:Object.fromEntries(image.definitions.filter(d=>d.type!=='formula').map(d=>[d.key,person.manual[d.key]??null])),explanations:{} as Record<string,string>}))
 for(const d of formulas){
  const portfolio=image.records.map((person,index)=>formulaInputs(person,records[index].values))
  for(let index=0;index<records.length;index++){
   const result=evaluateFormula(d.formula!,portfolio[index],portfolio)
   records[index].values[d.key]=result.value;records[index].explanations[d.key]=result.explanation
  }
 }
 return records
}
export function withPersonDefinition(image:PeopleImage,input:Record<string,unknown>){
 const d=definition(input),prior=image.definitions.find(item=>item.key===d.key)
 insist(prior||image.definitions.length<100,'At most 100 customer fields are supported.')
 if(prior)insist(prior.type===d.type,'A field type cannot change; create a new field instead.')
 const definitions=[...image.definitions.filter(item=>item.key!==d.key),d].sort((a,b)=>a.key.localeCompare(b.key))
 orderedPeople(definitions)
 for(const person of image.records)for(const [key,value] of Object.entries(person.manual)){
  const def=definitions.find(item=>item.key===key);insist(def,'Unknown customer field.');fieldValue(def,value)
 }
 return {definition:d,image:{...image,definitions}}
}
export function personRuleFields(definitions:Definition[]){return {...PERSON_FIELDS,...ruleFields(definitions)}}
export function personRuleValues(definitions:Definition[],person:ReturnType<typeof evaluatePeople>[number]){
 return {...ruleValues(definitions,person.values),id:person.id,name:person.name,kind:person.kind,createdAt:person.createdAt,accountCount:person.accountIds.length}
}
export function relatedPersonFields(definitions:Definition[]):Record<string,'text'|'number'>{
 return Object.fromEntries((['contact','user'] as const).flatMap(kind=>Object.entries(personRuleFields(definitions)).map(([field,type])=>[`people.${kind}.${field}`,type])))
}
export function peopleProjection(image:PeopleImage,records=evaluatePeople(image)){
 return image.accounts.map(account=>({...account,records:records.filter(person=>person.accountIds.includes(account.id))}))
}
