import {insist,object,text} from '../core'
import {evaluateFormula,formulaReferences,validateFormula} from '../fields/formula'
import {matches,segmentInput,type Rules,type Values} from '../segments/rules'
export type Catalog=Record<string,'text'|'number'>
export interface ReportSpec {name:string;object:'account';rules:Rules;segmentId:string|null;groupBy:string;measure:string;operation:'sum'|'average'|'count';formula:string|null;chart:'table'|'bar';sharedRoles:string[]}
export interface ReportRow {id:string;values:Values;currency:string|null;ownerName:string|null}
export const SAFE_FIELDS:Catalog={id:'text',name:'text',ownerId:'text',renewalDate:'text','health.status':'text','revenue.arrMinor':'number','revenue.currency':'text'}
const keys=(row:Record<string,unknown>,names:string[])=>insist(Object.keys(row).every(k=>names.includes(k)),'Unsupported report property.')
export function reportInput(value:unknown,catalog:Catalog,roleIds:string[]):ReportSpec{
 const row=object(value);keys(row,['name','object','rules','segmentId','groupBy','measure','operation','formula','chart','sharedRoles'])
 insist(row.object==='account','Only native account reports are available today.')
 const rules=object(row.rules);insist(Array.isArray(rules.conditions),'Filters need an explicit condition array.')
 const validated=segmentInput({name:'Report',mode:rules.conditions.length?'dynamic':'static',rules,accountIds:[],tier:null,stage:null,playbook:null},new Set(),[],catalog)
 insist(typeof row.groupBy==='string'&&Object.hasOwn(catalog,row.groupBy),'Choose an available grouping.')
 insist(['sum','average','count'].includes(String(row.operation)),'Choose sum, average or count.')
 const formula=row.formula===null||row.formula===''?null:text(row.formula,'Formula',500)
 if(formula){try{validateFormula(formula,Object.keys(catalog))}catch(error){insist(false,error instanceof Error?error.message:'Invalid formula.')}}
 const moneyFields=(formula?formulaReferences(formula):[String(row.measure)]).filter(k=>/Minor$/.test(k))
 insist(moneyFields.every(k=>['revenue.arrMinor','revenue.mrrMinor'].includes(k)),'Money measures currently use contracted native ARR or MRR; other monetary measures need their own explicit currency carrier.')
 insist(row.operation==='count'||formula||typeof row.measure==='string'&&catalog[row.measure]==='number','Choose a numeric measure or a formula.')
 insist(row.segmentId===null||typeof row.segmentId==='string'&&row.segmentId.length<=100,'Choose a current segment or all accounts.')
 insist(row.chart==='table'||row.chart==='bar','Choose table or bar chart.')
 insist(Array.isArray(row.sharedRoles)&&row.sharedRoles.length<=50,'Choose explicit viewer roles.')
 const sharedRoles=row.sharedRoles.map(v=>text(v,'Viewer role',100));insist(new Set(sharedRoles).size===sharedRoles.length&&sharedRoles.every(r=>roleIds.includes(r)),'Choose unique current viewer roles.')
 return {name:text(row.name,'Report name',100),object:'account',rules:validated.rules,segmentId:row.segmentId as string|null,groupBy:row.groupBy,measure:row.operation==='count'?'count':formula?'calculated':String(row.measure),operation:row.operation as ReportSpec['operation'],formula,chart:row.chart,sharedRoles}
}
export function requiredFields(spec:ReportSpec){return [...new Set([spec.groupBy,...spec.rules.conditions.map(c=>c.field),...(spec.operation==='count'?[]:spec.formula?formulaReferences(spec.formula):[spec.measure])])]}
export function calculateReport(spec:ReportSpec,source:ReportRow[]){
 const rows=source.filter(r=>matches(spec.rules,r.values)),portfolio=rows.map(r=>r.values)
 const inputs=rows.map(row=>{const result=spec.operation==='count'?{value:1,explanation:'One matching account',inputs:{id:row.id}}:spec.formula?evaluateFormula(spec.formula,row.values,portfolio):{value:row.values[spec.measure]??null,explanation:'Current '+spec.measure,inputs:{[spec.measure]:row.values[spec.measure]??null}};return {...row,value:typeof result.value==='number'&&Number.isFinite(result.value)?result.value:null,explanation:result.explanation,inputs:result.inputs}})
 // A measure or calculation referencing native money always retains currency;
 // totals across currencies are never fabricated. Unknown currency has its own group.
 const monetary=spec.operation!=='count'&&requiredFields({...spec,rules:{match:'all',conditions:[]}}).some(k=>/Minor$/.test(k)),grouped=new Map<string,typeof inputs>()
 for(const row of inputs){const group=row.values[spec.groupBy]??null,key=JSON.stringify([group,monetary?row.currency:null]);grouped.set(key,[...(grouped.get(key)??[]),row])}
 const groups=[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([key,items])=>{const [group,currency]=JSON.parse(key),missing=items.filter(r=>r.value===null).length,sum=items.reduce((n,r)=>n+(r.value??0),0),value=missing?null:spec.operation==='average'?sum/items.length:sum;return {group,label:spec.groupBy==='ownerId'?items[0].ownerName??'Unassigned':group===null?'Missing':String(group),currency,count:items.length,missing,value:value!==null&&Number.isFinite(value)?value:null}})
 return {count:rows.length,groups,inputs:inputs.map(({id,value,explanation,inputs})=>({id,value,explanation,inputs})),unit:monetary?'native minor units':spec.operation==='count'?'accounts':'numeric units',formula:spec.formula}
}
export function reportCsv(spec:ReportSpec,result:ReturnType<typeof calculateReport>){
 const quote=(value:unknown)=>{let s=value===null||value===undefined?'Unavailable':String(value);if(/^[=+\-@\t\r]/.test(s)&&typeof value!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
 const rows:unknown[][]=[['Report','Grouping','Currency','Accounts','Missing inputs','Value','Unit','Formula'],...result.groups.map(g=>[spec.name,g.label,g.currency??'',g.count,g.missing,g.value,result.unit,spec.formula??spec.measure])]
 return rows.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n'
}
