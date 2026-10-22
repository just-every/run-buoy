import {insist,object,text} from '../core'
import {FIELDS,segmentInput,type Rules} from '../segments/rules'
export interface Step {id:string;kind:'task'|'wait'|'branch'|'approval'|'external'|'fields'|'playbook';title:string;next:number;otherwise?:number;rules?:Rules;seconds?:number;timeoutSeconds?:number;dueDays?:number;channel?:'email'|'slack'|'webhook';values?:Record<string,unknown>;playbookId?:string;playbookVersion?:string}
export interface Definition {name:string;ownerId:string;enabled:boolean;reentryDays:number;failureThreshold:number;trigger:{kind:'manual'|'rule'|'segment'|'stage'|'renewal'|'contract-start'|'webhook';rules?:Rules;segmentId?:string;stage?:string;days?:number};entry:Rules|null;exit:Rules|null;steps:Step[]}
const keys=(o:Record<string,unknown>,allowed:string[])=>insist(Object.keys(o).every(k=>allowed.includes(k)),'Unsupported playbook configuration field.')
const integer=(v:unknown,min:number,max:number,label:string)=>{insist(typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max,`${label} must be a whole number from ${min} to ${max}.`);return v}
export const rules=(value:unknown,fields:Record<string,'text'|'number'>=FIELDS):Rules=>segmentInput({name:'Playbook condition',mode:'dynamic',rules:value,accountIds:[],tier:null,stage:null},new Set(),undefined,fields).rules
export function definition(input:unknown,fields:Record<string,'text'|'number'>=FIELDS):Definition {
 const parseRules=(value:unknown)=>rules(value,fields)
 const d=object(input);keys(d,['name','ownerId','enabled','reentryDays','failureThreshold','trigger','entry','exit','steps'])
 insist(typeof d.enabled==='boolean','Choose whether enrollment is enabled.')
 const trigger=object(d.trigger);keys(trigger,['kind','rules','segmentId','stage','days'])
 insist(['manual','rule','segment','stage','renewal','contract-start','webhook'].includes(String(trigger.kind)),'Choose a supported enrollment trigger.')
 const normalized:Definition['trigger']={kind:trigger.kind as Definition['trigger']['kind']}
 if(trigger.kind==='rule')normalized.rules=parseRules(trigger.rules)
 if(trigger.kind==='segment')normalized.segmentId=text(trigger.segmentId,'Entry segment',100)
 if(trigger.kind==='stage'){insist(['onboarding','adoption','expansion','renewal','churned'].includes(String(trigger.stage)),'Choose a lifecycle stage.');normalized.stage=String(trigger.stage)}
 if(trigger.kind==='renewal'||trigger.kind==='contract-start')normalized.days=integer(trigger.days,-365,365,'Renewal offset')
 insist(Array.isArray(d.steps)&&d.steps.length>=1&&d.steps.length<=32,'Use 1 to 32 ordered steps.')
 const count=d.steps.length,ids=new Set<string>()
 const steps:Step[]=d.steps.map((value,index)=>{
  const s=object(value);keys(s,['id','kind','title','next','otherwise','rules','seconds','timeoutSeconds','dueDays','channel','values','playbookId','playbookVersion'])
  const stepId=text(s.id,'Step id',80);insist(/^[a-zA-Z0-9_-]+$/.test(stepId)&&!ids.has(stepId),'Step ids must be unique letters, numbers, dashes or underscores.');ids.add(stepId)
  insist(['task','wait','branch','approval','external','fields','playbook'].includes(String(s.kind)),'Choose task, wait, branch, approval, reviewed fields or external receipt.')
  const step:Step={id:stepId,kind:s.kind as Step['kind'],title:text(s.title,'Step title',500),next:s.next===undefined?index+1:integer(s.next,index+1,count,'Next step index')}
  if(s.kind==='playbook'){step.playbookId=text(s.playbookId,'Child playbook',100);if(s.playbookVersion!==undefined)step.playbookVersion=text(s.playbookVersion,'Child playbook version',100)}
  if(s.kind==='fields'){const values=object(s.values);insist(Object.keys(values).length>0&&Object.keys(values).length<=20,'A field step changes 1–20 custom fields.');step.values=values}
  if(s.kind==='task')step.dueDays=integer(s.dueDays??0,0,365,'Task due offset')
  if(s.kind==='wait'){step.seconds=integer(s.seconds??0,0,31536000,'Wait duration');if(s.rules!==undefined)step.rules=parseRules(s.rules);if(s.timeoutSeconds!==undefined)step.timeoutSeconds=integer(s.timeoutSeconds,1,31536000,'Condition timeout');insist(step.seconds>0||step.rules,'A wait needs a duration or condition.');insist(!step.timeoutSeconds||step.rules,'Timeouts apply to condition waits.')}
  if(s.kind==='branch'){step.rules=parseRules(s.rules);step.otherwise=integer(s.otherwise,index+1,count,'Other branch index')}
  if(s.kind==='external'){insist(['email','slack','webhook'].includes(String(s.channel)),'Choose email, Slack or webhook receipt.');step.channel=s.channel as Step['channel']}
  return step
 })
 return {name:text(d.name,'Playbook name',100),ownerId:text(d.ownerId,'Run owner',100),enabled:d.enabled as boolean,reentryDays:integer(d.reentryDays,1,365,'Re-enrollment interval'),failureThreshold:integer(d.failureThreshold,1,500,'Failure threshold'),trigger:normalized,entry:d.entry==null?null:parseRules(d.entry),exit:d.exit==null?null:parseRules(d.exit),steps}
}
