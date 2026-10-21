import type { AdoptionDefinition, AdoptionFraction, AdoptionMetrics, AdoptionPeriod } from './types'

export type Scope='summary'|'account'|'person'|'segment'
export type SubjectRow={scope:Scope;id:string;name:string;kind:'contact'|'user'|null;accountIds:string;seats:number|null}
export type CountRow={scope:Scope;id:string;period:'current'|'previous';dau:number;wau:number;mau:number;eventCount:number}
export type DefinitionRow={scope:Scope;id:string;period:'current'|'previous';kind:'feature'|'module';key:string;name:string;people:number}
export type FirstRow={scope:Scope;id:string;people:number;meanSeconds:number}

export function metricReader(counts:CountRow[],definitionsUsed:DefinitionRow[],first:FirstRow[],definitions:Pick<AdoptionDefinition,'kind'|'key'>[]){
 const bySubject=<T extends {scope:Scope;id:string}>(rows:T[])=>{
  const map=new Map<string,T[]>()
  for(const row of rows){const key=JSON.stringify([row.scope,row.id]),list=map.get(key)??[];list.push(row);map.set(key,list)}
  return (subject:SubjectRow)=>map.get(JSON.stringify([subject.scope,subject.id]))??[]
 }
 const subjectCounts=bySubject(counts),subjectDefinitions=bySubject(definitionsUsed),subjectFirst=bySubject(first)
 const metrics=(subject:SubjectRow):AdoptionMetrics=>{
  const period=(which:'current'|'previous'):AdoptionPeriod=>{
   const count=subjectCounts(subject).find(row=>row.period===which)!,used=subjectDefinitions(subject).filter(row=>row.period===which)
   const fractions=(kind:'feature'|'module'):AdoptionFraction[]=>used.filter(row=>row.kind===kind).map(({key,name,people})=>({key,name,people,fraction:count.mau?people/count.mau:null}))
   return {dau:count.dau,wau:count.wau,mau:count.mau,eventCount:count.eventCount,depth:count.mau?count.eventCount/count.mau:null,
    breadth:definitions.length?used.filter(row=>row.people>0).length/definitions.length:null,
    utilization:subject.seats?count.mau/subject.seats:null,features:fractions('feature'),modules:fractions('module')}
  }
  const current=period('current'),previous=period('previous'),weeklyChange=previous.wau?(current.wau-previous.wau)/previous.wau:null,firstValue=subjectFirst(subject)[0]
  return {current,previous,weeklyChange,weeklyDrop:weeklyChange!==null&&weeklyChange<=-0.3,firstValue:{people:firstValue?.people??0,meanSeconds:firstValue?Math.round(firstValue.meanSeconds*1000)/1000:null}}
 }
 return metrics
}
