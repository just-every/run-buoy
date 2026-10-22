import {d1} from './commands.mjs'
import assert from 'node:assert/strict'
import {fileRecords} from '@runeditrun/rer/modules/portability/files'
import {cp,mkdir,statfs,symlink} from 'node:fs/promises'
import {join,relative} from 'node:path'

const excluded=new Set(['node_modules','.git','.wrangler','.rer','.seed','.cache','.tanstack','exports','test-results','logs'])
export async function copyInstallation(root,parent,name){
 const target=join(parent,name);await mkdir(target)
 await cp(root,target,{recursive:true,filter:path=>{
  const part=relative(root,path).split('/')[0]
  return !excluded.has(part)&&!part.startsWith('.env')&&!part.startsWith('.dev.vars')
 }})
 await symlink(join(root,'node_modules'),join(target,'node_modules'),'dir')
 return target
}
export async function databaseBytes(root){
 // D1's own metadata reports logical database size. Counting SQLite WAL files
 // would project transient checkpoint traffic as retained service capacity.
 const result=await d1(root,['--command','SELECT 1 AS capacity_probe','--json'],{json:true})
 assert.ok(Array.isArray(result)&&result.length===1&&result[0].success,'D1 capacity probe completed')
 const bytes=result[0].meta?.size_after
 assert.ok(Number.isSafeInteger(bytes)&&bytes>0,'D1 reports a positive logical database size')
 return bytes
}
export async function requireSpace(path,bytes){
 const fs=await statfs(path),available=fs.bavail*fs.bsize
 assert.ok(available>bytes,`SCALE-001 needs ${Math.ceil(bytes/1e9)} GB free for source, archive and restore; ${Math.floor(available/1e9)} GB available. No reduced-volume pass is permitted.`)
}
export async function archiveCounts(path){
 const counts=new Map()
 let manifest
 // Published reader verifies part order, row order, checksums and closing data.
 for await(const item of fileRecords(path)){
  if(item.kind==='manifest')manifest=item
  if(item.kind!=='part')continue
  for(const row of item.items)if(row.kind==='row')counts.set(row.table,(counts.get(row.table)??0)+1)
 }
 assert.ok(manifest,'Archive contains its public manifest')
 for(const table of manifest.tables)assert.equal(counts.get(table.name)??0,table.count,'Archive row count matches its declared table count: '+table.name)
 return Object.fromEntries(counts)
}
