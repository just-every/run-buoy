import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,realpath} from 'node:fs/promises'
import {join} from 'node:path'

// Wrangler's local CLI omits size_after from JSON. Use its same public D1 SDK
// against the actual persisted binding, retaining authoritative logical size
// instead of counting transient SQLite WAL checkpoint traffic as database data.
export async function databaseBytes(root){
 const require=createRequire(await realpath(join(root,'node_modules/wrangler/package.json')))
 const {Miniflare,convertV4MiniflareOptions}=require('miniflare')
 const config=JSON.parse(await readFile(join(root,'dist/server/wrangler.json'),'utf8'))
 const binding=config.d1_databases.find(row=>row.binding==='DB')
 assert.ok(binding,'The emitted Worker has its real D1 binding')
 const id=binding.preview_database_id??binding.database_id??binding.binding
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'',resourcePersistencePath:join(root,'.wrangler/state/v3'),d1Databases:{DATABASE:id}}))
 try{
  const db=await mf.getD1Database('DATABASE'),result=await db.prepare('SELECT 1 AS capacity_probe').run(),bytes=result.meta?.size_after
  assert.ok(result.success&&Number.isSafeInteger(bytes)&&bytes>0,'D1 reports a positive logical database size')
  return bytes
 }finally{await mf.dispose()}
}
