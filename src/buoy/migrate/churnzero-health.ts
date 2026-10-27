import {sha256} from '../../modules/import-kit/src/provenance/identity.ts'
import type {ScorecardField} from '../scorecards/types'
import {parseJson} from '../../modules/import-kit/src/readers/json.ts'

/** A retained incumbent observation, separate from Buoy's published scorecard.
 * No scale, weight, band, observation date or scoring rule is inferred. */
export interface MigrationHealth {
 source:'churnzero';sourceId:string;score:number|null;factors:Record<string,number|null>
 fields:{score:string;factors:string|Record<string,string>}
}
export const healthFields=['churnScore','churnScoreFactors'] as const
export function churnzeroHealth(row:Record<string,unknown>,columns:Record<string,unknown>,sourceId:string):MigrationHealth|undefined{
 if(!healthFields.some(field=>columns[field]!==undefined))return undefined
 const factorColumns=columns.churnScoreFactors
 const individual=!!factorColumns&&typeof factorColumns==='object'&&!Array.isArray(factorColumns)
 if(typeof columns.churnScore!=='string'||!(typeof factorColumns==='string'||individual))throw Error('Map both ChurnScore and its factor columns explicitly.')
 const numeric=(value:unknown):number|null=>{
  if(value===null)return null
  if(typeof value==='string'){
   if(value.trim()==='')return null
   if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim()))throw Error('ChurnScore must be finite decimal text or empty for unavailable.')
   value=Number(value)
  }
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)throw Error('ChurnScore and factor observations must be finite numbers or null for unavailable.')
  return value
 }
 const score=numeric(row[String(columns.churnScore)]),raw=individual?Object.fromEntries(Object.entries(factorColumns as Record<string,unknown>).map(([name,column])=>{if(typeof column!=='string')throw Error('Each factor must name an exact source column.');return [name,row[column]]})):row[String(factorColumns)]
 // Use the shared duplicate-key reader: never silently discard a factor.
 const parsed=typeof raw==='string'?parseJson(raw,{artifact:'ChurnScore factors',pointer:''}):raw
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('ChurnScore factors must be a JSON object of named numeric observations or null.')
 const entries=Object.entries(parsed)
 if(entries.length<1||entries.length>200)throw Error('Supply 1 to 200 explicit ChurnScore factors.')
 const factors=Object.fromEntries(entries.map(([name,value])=>{
  if(!name.trim()||name.length>200||/[\u0000-\u001f]/.test(name)||!individual&&typeof value!=='number'&&value!==null)throw Error('Each ChurnScore factor needs its exact name and a numeric value or null.')
  return [name,numeric(value)]
 }))
 return {source:'churnzero',sourceId,score,factors,fields:{score:String(columns.churnScore),factors:individual?factorColumns as Record<string,string>:String(factorColumns)}}
}

export const migrationFactorKey=(name:string)=>'migration.churnzero.factor.'+sha256(name).slice(0,40)
export function migrationScoreFields(observations:(MigrationHealth|undefined)[]):ScorecardField[]{
 if(!observations.some(Boolean))return []
 const names=[...new Set(observations.flatMap(row=>Object.keys(row?.factors??{})))].sort()
 return [{key:'migration.churnzero.score',name:'Imported ChurnZero ChurnScore',kind:'migration',valueType:'number',unit:'source scale; observation date unavailable'},
 ...names.map(name=>({key:migrationFactorKey(name),name:'Imported ChurnZero factor: '+name,kind:'migration' as const,valueType:'number' as const,migrationFactor:name,unit:'source units; observation date unavailable'}))]
}
