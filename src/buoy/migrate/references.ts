import {sha256} from '../../modules/import-kit/src/provenance/identity.ts'
import {parseJson} from '../../modules/import-kit/src/readers/json.ts'
import type {Json,ParsedRecord} from '../../modules/import-kit/src/types.ts'

export const referenceKinds=['successplay-definitions','successflow-categories','definition-schema'] as const
const pointer=(path:string,key:string)=>path+'/'+key.replaceAll('~','~0').replaceAll('/','~1')

/** Opaque source custody only: no vendor schema or executable semantics are inferred. */
export function referenceRecords(value:unknown):ParsedRecord[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||!value.length||value.length>10)throw Error('Supply 1 to 10 Totango reference files.')
 const names=new Set<string>();let elements=0
 return value.map((raw,index)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid Totango reference file.')
  const reference=raw as Record<string,unknown>
  if(Object.keys(reference).some(key=>!['name','kind','text','sha256'].includes(key))||typeof reference.name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(reference.name)||names.has(reference.name)||!referenceKinds.includes(reference.kind as typeof referenceKinds[number]))throw Error('Reference files need unique safe names and an explicit supported kind.')
  names.add(reference.name)
  if(typeof reference.text!=='string'||sha256(reference.text)!==reference.sha256)throw Error('Original reference digest does not match its embedded UTF-8 text.')
  const document=parseJson(reference.text.replace(/^\uFEFF/,''),{artifact:reference.name})
  if(!document||typeof document!=='object')throw Error('A Totango reference must be a JSON object or array.')
  const fields:string[]=[]
  const visit=(item:Json,path:string,depth:number)=>{
   if(depth>32||++elements>1000)throw Error('Totango references exceed the review element bound.')
   fields.push(path)
   if(item&&typeof item==='object')for(const [key,child]of Object.entries(item))visit(child,pointer(path,key),depth+1)
  }
  visit(document,'',0)
  return {kind:'migration-reference',sourceId:reference.name,pointer:'/references/'+index+'/text',payload:{name:reference.name,kind:reference.kind as string,sha256:reference.sha256 as string,document,fields}}
 })
}
