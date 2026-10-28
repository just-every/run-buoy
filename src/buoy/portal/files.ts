import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {actorFor} from '../access'
import {accountAudit} from '../audit-records'
import {authority,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {portalGrant} from './authority'

const MAX_BYTES=750_000
const mediaTypes=new Set(['text/plain','application/pdf','image/png','image/jpeg'])
export type PortalFile={id:string;filename:string;mediaType:string;size:number;createdAt:string}
export async function portalFiles(db:D1Database,planId:string,personId:string,revision:string){
 return (await stmt(db,'SELECT id,filename,media_type AS mediaType,size,created_at AS createdAt FROM buoy_portal_files WHERE plan_id=? AND person_id=? AND plan_revision=? ORDER BY created_at,id',planId,personId,revision).all<PortalFile>()).results
}
async function boundedForm(request:Request){
 insist(request.headers.get('content-type')?.startsWith('multipart/form-data'),'Choose a file to upload.',415)
 const reader=request.body?.getReader();insist(reader,'Choose a file to upload.')
 const chunks:Uint8Array[]=[];let size=0
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES+16000){await reader.cancel();insist(false,'Choose a file smaller than 750 KB.',413)}chunks.push(value)}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}
 return new Response(body,{headers:{'content-type':request.headers.get('content-type')!}}).formData()
}
export async function uploadPortalFile(db:D1Database,actor:Actor,grantId:string,request:Request){
 const {row,fence}=await portalGrant(db,actor,grantId),form=await boundedForm(request)
 insist([...form.keys()].every(key=>['revision','file'].includes(key))&&form.getAll('file').length===1,'Choose one file.')
 insist(form.get('revision')===row.revision,'Access changed. Reload before continuing.',409)
 const file=form.get('file');insist(file instanceof File&&file.size>0&&file.size<=MAX_BYTES,'Choose a nonempty file smaller than 750 KB.')
 const filename=text(file.name,'File name',150);insist(!/[\x00-\x1f/\\]/.test(filename),'Choose a file name without folder paths.')
 insist(mediaTypes.has(file.type),'Choose a PDF, PNG, JPEG or plain text file.')
 const bytes=new Uint8Array(await file.arrayBuffer()),parts:string[]=[]
 for(let offset=0;offset<bytes.length;offset+=32768)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)))
 const fileId=id(),stamp=now()
 await db.batch([fence(),
  stmt(db,'INSERT INTO buoy_portal_files(id,account_id,plan_id,person_id,operator_id,plan_revision,filename,media_type,size,payload,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',fileId,row.account_id,row.plan_id,row.person_id,actor.id,row.plan_revision,filename,file.type,bytes.length,btoa(parts.join('')),stamp),
  stmt(db,"INSERT INTO buoy_portal_events(id,account_id,plan_id,person_id,operator_id,kind,body,recorded_at) VALUES(?,?,?,?,?,'file-uploaded',?,?)",fileId,row.account_id,row.plan_id,row.person_id,actor.id,filename,stamp),
  ...accountAudit(db,actor,row.account_id,'portal.file-uploaded'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:fileId}
}
function download(row:{filename:string;payload:string}){
 return new Response(Uint8Array.from(atob(row.payload),char=>char.charCodeAt(0)),{headers:{'content-type':'application/octet-stream','content-disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(row.filename),'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}
export const portalFilesApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
portalFilesApi.post('/api/buoy/portal/:id/files',async c=>c.json(await uploadPortalFile(c.env.DB,c.get('actor'),c.req.param('id'),c.req.raw),201))
portalFilesApi.get('/api/buoy/portal/:id/files/:file',async c=>{
 const {row,fence}=await portalGrant(c.env.DB,c.get('actor'),c.req.param('id'))
 const file=await stmt(c.env.DB,'SELECT filename,payload FROM buoy_portal_files WHERE id=? AND plan_id=? AND person_id=? AND plan_revision=?',c.req.param('file'),row.plan_id,row.person_id,row.plan_revision).first<{filename:string;payload:string}>()
 insist(file,'File unavailable.',404);await c.env.DB.batch([fence(),stmt(c.env.DB,'DELETE FROM buoy_assertions')]);return download(file)
})
portalFilesApi.get('/api/buoy/accounts/:id/portal-files/:file',async c=>{
 const actor=await actorFor(c.req.raw,c.env);requirePerson(actor,true)
 const file=await stmt(c.env.DB,'SELECT filename,payload FROM buoy_portal_files WHERE id=? AND account_id=?',c.req.param('file'),c.req.param('id')).first<{filename:string;payload:string}>()
 insist(file,'File unavailable.',404);await c.env.DB.batch([authority(c.env.DB,actor,true),stmt(c.env.DB,'DELETE FROM buoy_assertions')]);return download(file)
})
