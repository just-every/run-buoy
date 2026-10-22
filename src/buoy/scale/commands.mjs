import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {join} from 'node:path'

// Run only checkout-local CLIs. Keep output private: setup/export can print links.
export async function command(root, script, args, {timeout=3_600_000,json=false,expected=0}={}) {
 const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}
 delete env.RER_LOCAL_OPERATION;delete env.RER_ONBOARDING_PROCESS_OWNER
 const child=spawn(process.execPath,[join(root,script),...args],{cwd:root,env,stdio:['ignore','pipe','pipe']})
 let output='',errorOutput=''
 child.stdout.on('data',chunk=>{output=(output+chunk).slice(-4_000_000)})
 child.stderr.on('data',chunk=>{errorOutput=(errorOutput+chunk).slice(-4_000_000)})
 const timer=setTimeout(()=>child.kill('SIGTERM'),timeout)
 try {
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
  // Scale D1 files contain synthetic rows only. Keep a bounded diagnostic,
  // removing URLs, long opaque identifiers and terminal escape sequences.
  const diagnostic=args[0]==='d1'?(output+errorOutput).replace(/\x1b\[[0-9;]*m/g,'').replace(/https?:\/\/[^\s]+/g,'[URL]').replace(/[A-Za-z0-9_+./=-]{24,}/g,'[identifier]').slice(-1800):''
  assert.equal(code,expected,`${args[0]} failed (exit ${code}; signal ${child.signalCode??'none'}). CLI output withheld. ${diagnostic}`)
  if(json)return JSON.parse(output)
 } finally {clearTimeout(timer)}
}
export const rer=(root,args,options)=>command(root,'node_modules/@runeditrun/rer/bin/rer.mjs',args,options)
export const d1=(root,args,options)=>command(root,'node_modules/wrangler/bin/wrangler.js',['d1','execute','DB','--local','--persist-to',join(root,'.wrangler/state'),'--config','dist/server/wrangler.json',...args],options)
export async function query(root,sql){
 const result=await d1(root,['--command',sql,'--json'],{json:true})
 assert.ok(Array.isArray(result)&&result.every(item=>item.success),'D1 query completed')
 return result.flatMap(item=>item.results)
}
