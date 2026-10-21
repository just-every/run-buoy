import {scorecardAssignments,assignmentFence} from './assignments'
import {auditRecord} from '../audit-records'
import {authority,guard,id,insist,object,requirePerson,stmt,type Actor} from '../core'
import {fence} from '../segments/snapshot'
import {calculate} from './calculate'
import {scorecardConfig} from './config'
import {inputImage} from './inputs'
import {calculationWrites,reader,RESULTS_SQL,revisionFence,storage} from './storage'
import type {ScorecardConfig,ScorecardResult,ScorecardVersion} from './types'
export type {ScorecardConfig,ScorecardResult,ScorecardVersion,ScorecardField,RetainedInputs,Breakdown,SourceEvidence,Band,Measure} from './types'

async function versions(db:D1Database):Promise<ScorecardVersion[]>{
 const rows=await db.prepare('SELECT id,revision,document,published_by AS publishedBy,published_at AS publishedAt FROM buoy_scorecard_versions ORDER BY published_at DESC,id DESC').all<{id:string;revision:string;document:string;publishedBy:string;publishedAt:string}>()
 return rows.results.map(({document,...row})=>({...JSON.parse(document),...row}))
}
export async function currentScores(db:D1Database):Promise<Map<string,ScorecardResult>>{
 const rows=await db.prepare('SELECT account_id AS accountId,document FROM buoy_scorecard_results ORDER BY account_id').all<{accountId:string;document:string}>()
 return new Map(rows.results.map(row=>[row.accountId,JSON.parse(row.document) as ScorecardResult]))
}
export async function scorecardState(db:D1Database,actor:Actor){
 await reader(db,actor)
 const [stored,image,allVersions,history]=await Promise.all([storage(db),inputImage(db,new Date()),versions(db),db.prepare("SELECT id,account_id AS accountId,version_id AS versionId,calculated_at AS calculatedAt,json_extract(document,'$.score') AS score,json_extract(document,'$.band') AS band FROM buoy_scorecard_history ORDER BY calculated_at DESC,id DESC LIMIT 500").all<{id:string;accountId:string;versionId:string;calculatedAt:string;score:number|null;band:string}>()])
 return {assignments:(await scorecardAssignments(db)).rows.map(({document,versionRevision,publishedBy,publishedAt,...row})=>row),revision:stored.revision,published:stored.published,versions:allVersions,fields:image.fields,segments:image.segments.map(({id,name,revision})=>({id,name,revision})),accounts:stored.results.map(row=>JSON.parse(row.document) as ScorecardResult),history:history.results}
}
export async function previewScorecard(db:D1Database,actor:Actor,input:{config?:unknown;versionId?:unknown;historyId?:unknown}={}){
 await reader(db,actor)
 insist(Object.keys(input).every(key=>['config','versionId','historyId'].includes(key)),'Unsupported scorecard preview property.')
 insist(input.versionId===undefined||typeof input.versionId==='string','Version id must be text.')
 insist(input.historyId===undefined||typeof input.historyId==='string','History id must be text.')
 const stored=await storage(db)
 let version=stored.published
 if(input.versionId!==undefined){version=(await versions(db)).find(v=>v.id===input.versionId)??null;insist(version,'Scorecard version not found.',404)}
 const at=new Date(),image=await inputImage(db,at)
 let retained:ScorecardResult|null=null
 if(input.historyId!==undefined){
  const row=await stmt(db,'SELECT document FROM buoy_scorecard_history WHERE id=?',input.historyId).first<{document:string}>()
  insist(row,'Retained calculation not found.',404);retained=JSON.parse(row.document) as ScorecardResult
  // A history selection defaults to the configuration that actually produced it.
  if(input.versionId===undefined&&input.config===undefined)version=(await versions(db)).find(v=>v.id===retained!.versionId)??null
 }
 const config:ScorecardConfig=input.config===undefined?(insist(version,'Publish or supply a scorecard configuration.'),version.config):scorecardConfig(input.config,retained?.inputs.fields??image.fields,image.segments)
 const revision=input.config===undefined?version!.revision:'preview',versionId=input.config===undefined?version!.id:'preview'
 const accounts=retained?[calculate(config,retained.inputs,{accountId:retained.accountId,accountRevision:retained.accountRevision,configRevision:revision,versionId,calculatedAt:retained.calculatedAt})]:image.accounts.map(account=>calculate(config,account.inputs,{accountId:account.accountId,accountRevision:account.accountRevision,configRevision:revision,versionId,calculatedAt:at.toISOString()}))
 return {versionId,config,accounts,historical:!!retained}
}
export async function publishScorecard(db:D1Database,actor:Actor,input:{revision:unknown;config:unknown}){
 requirePerson(actor);await reader(db,actor)
 const raw=object(input);insist(Object.keys(raw).every(key=>['revision','config'].includes(key)),'Unsupported scorecard publication property.')
 const [stored,image]=await Promise.all([storage(db),inputImage(db,new Date())])
 insist(input.revision===stored.revision,'Scorecard changed. Reload before publishing.',409)
 const config=scorecardConfig(input.config,image.fields,image.segments),revision=id(),versionId=id(),stamp=new Date().toISOString()
 const version:ScorecardVersion={id:versionId,revision,config,publishedBy:`${actor.kind}:${actor.id}`,publishedAt:stamp,dependencies:{segments:image.segments.filter(s=>config.segments.some(c=>c.segmentId===s.id)).map(({id,revision})=>({id,revision})),consumers:image.consumers.map(({id,revision})=>({id,revision})),fields:image.fields.filter(f=>config.measures.some(m=>m.field===f.key))}}
 const assignments=await scorecardAssignments(db)
 const results=image.accounts.map(account=>{const selected=assignments.versions.get(account.accountId);return calculate(selected?.config??config,account.inputs,{accountId:account.accountId,accountRevision:account.accountRevision,configRevision:selected?.revision??revision,versionId:selected?.id??versionId,calculatedAt:stamp})}),writes=await calculationWrites(db,results,stored.results,true)
 await db.batch([authority(db,actor,true),assignmentFence(db,assignments.raw),revisionFence(db,stored.revision),guard(db,`(${RESULTS_SQL})=?`,stored.rawResults),...image.fences.map(source=>fence(db,source)),
  stmt(db,'INSERT INTO buoy_scorecard_versions(id,revision,document,published_by,published_at) VALUES(?,?,?,?,?)',versionId,revision,JSON.stringify({config,dependencies:version.dependencies}),version.publishedBy,stamp),
  stmt(db,'INSERT INTO buoy_scorecard_current(singleton,revision,version_id) VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET revision=excluded.revision,version_id=excluded.version_id',revision,versionId),
  ...writes.statements,auditRecord(db,actor,'health.scorecard-published',`scorecard:${versionId}`),stmt(db,'DELETE FROM buoy_assertions')])
 return {revision,versionId,config,accounts:writes.accounts}
}
export async function recalculateScorecards(db:D1Database,at=new Date()){
 const stored=await storage(db)
 if(!stored.published)return
 const version=stored.published,image=await inputImage(db,at),stamp=at.toISOString(),assignments=await scorecardAssignments(db)
 const results=image.accounts.map(account=>{const selected=assignments.versions.get(account.accountId)??version;return calculate(selected.config,account.inputs,{accountId:account.accountId,accountRevision:account.accountRevision,configRevision:selected.revision,versionId:selected.id,calculatedAt:stamp})}),writes=await calculationWrites(db,results,stored.results)
 if(!writes.statements.length)return
 await db.batch([assignmentFence(db,assignments.raw),revisionFence(db,stored.revision),guard(db,`(${RESULTS_SQL})=?`,stored.rawResults),...image.fences.map(source=>fence(db,source)),...writes.statements,stmt(db,'DELETE FROM buoy_assertions')])
}
