import {stmt} from '../core'
import {privacyFingerprint} from './replay'
import type {Match} from './discovery'

// Only declared narrative fields are editable. Identity, money, dates, source
// proofs and routing fields never participate in a text replacement.
interface Store {kind:string;table:string;columns:string[];jsonColumn:string|null;fields:string[];accountColumn?:string}
const evidenceFields=['renewalEvidence','billing.reference','support.reference']
const stores:Store[]=[
 {kind:'trust-evidence',table:'buoy_trust_proposals',columns:['evidence'],jsonColumn:'evidence',fields:['evidence.preview.person.name','evidence.reference']},
 {kind:'trust-review',table:'buoy_trust_proposals',columns:['reason'],jsonColumn:null,fields:[]},
 {kind:'proposal',table:'buoy_proposals',columns:['payload'],jsonColumn:'payload',fields:['title','reason','evidence']},
 {kind:'task',table:'buoy_tasks',columns:['title','outcome','evidence'],jsonColumn:null,fields:[]},
 {kind:'decision',table:'buoy_decisions',columns:['reason','evidence'],jsonColumn:null,fields:[]},
 {kind:'sentiment',table:'buoy_sentiments',columns:['reason'],jsonColumn:null,fields:[]},
 {kind:'handover',table:'buoy_handovers',columns:['note'],jsonColumn:null,fields:[]},
 {kind:'proposal-source',table:'buoy_proposals',columns:['snapshot'],jsonColumn:'snapshot',fields:evidenceFields},
 {kind:'account-source',table:'buoy_accounts',columns:['document'],jsonColumn:'document',fields:evidenceFields,accountColumn:'id'},
]
const held=`EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=t.account_id AND
 (EXISTS(SELECT 1 FROM buoy_privacy_holds h WHERE h.person_id=m.person_id)
 OR EXISTS(SELECT 1 FROM buoy_review_hold_dependencies h WHERE h.person_id=m.person_id)))`
const trustHeld=`(${held} OR ${held.replaceAll('t.account_id','t.related_account_id')} OR
 EXISTS(SELECT 1 FROM buoy_customer_people p WHERE p.id IN(json_extract(t.evidence,'$.evidence.claim.personId'),json_extract(t.evidence,'$.evidence.preview.person.id'),json_extract(t.evidence,'$.evidence.preview.previous.person_id')) AND
 (EXISTS(SELECT 1 FROM buoy_privacy_holds h WHERE h.person_id=p.id) OR EXISTS(SELECT 1 FROM buoy_review_hold_dependencies h WHERE h.person_id=p.id))))`
export const NATIVE_TEXT_SQL=`SELECT json_object(${stores.map(s=>`'${s.kind}',json((SELECT json_group_array(json_object('id',t.id,'accountId',t.${s.accountColumn??'account_id'},'held',${s.table==='buoy_trust_proposals'?trustHeld:held.replaceAll('t.account_id','t.'+(s.accountColumn??'account_id'))},'values',json_object(${s.columns.map(c=>`'${c}',t.${c}`).join(',')}))) FROM (SELECT * FROM ${s.table} ORDER BY id) t))`).join(',')})`
interface Row {id:string;accountId:string;held:number;values:Record<string,string|null>}
export async function nativeText(db:D1Database,key:CryptoKey,redact:(value:string)=>string){
 const image=await db.prepare(NATIVE_TEXT_SQL+' AS snapshot').first<{snapshot:string}>()
 const raw=image!.snapshot,records=JSON.parse(raw) as Record<string,Row[]>,matches:Match[]=[]
 const patches:{row:Row;store:Store;changes:{id:string;field:string;after:string}[]}[]=[]
 for(const store of stores)for(const row of records[store.kind]){
  const values=store.jsonColumn?JSON.parse(row.values[store.jsonColumn]!):row.values
  const changes:{id:string;field:string;after:string}[]=[]
  for(const field of store.jsonColumn?store.fields:store.columns){
   const before=field.split('.').reduce((value,key)=>value?.[key],values);if(typeof before!=='string')continue
   const after=redact(before);if(after===before)continue
   const id=await privacyFingerprint(key,[store.kind,row.id,field,before])
   matches.push({id,recordId:row.id,recordKind:store.kind,path:field,before,after,held:!!row.held})
   changes.push({id,field,after})
  }
  if(changes.length)patches.push({row,store,changes})
 }
 return {raw,matches,statements(selected:string[]){
  const statements:D1PreparedStatement[]=[],accounts=new Set<string>()
  for(const {row,store,changes} of patches){
   const chosen=changes.filter(c=>selected.includes(c.id));if(!chosen.length)continue
   if(store.jsonColumn){
    const document=JSON.parse(row.values[store.jsonColumn]!)
    for(const change of chosen){const path=change.field.split('.');let target=document;for(const part of path.slice(0,-1))target=target[part];target[path.at(-1)!]=change.after}
    statements.push(stmt(db,`UPDATE ${store.table} SET ${store.jsonColumn}=? WHERE id=?`,JSON.stringify(document),row.id))
   }else statements.push(stmt(db,`UPDATE ${store.table} SET ${chosen.map(c=>c.field+'=?').join(',')} WHERE id=?`,...chosen.map(c=>c.after),row.id))
   accounts.add(row.accountId)
  }
  // A review based on the former narrative must never authorize changed work.
  for(const accountId of accounts)statements.push(stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id=?',accountId))
  return statements
 }}
}
