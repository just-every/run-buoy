import type {portalState} from '../portal'
import {apiCall,ApiError} from './actions'
import {escape,section,form,hidden,textarea,button} from './html'
import {shell} from './shell'
import type {Api} from './types'
type Portal=Awaited<ReturnType<typeof portalState>>
export async function portalPage(request:Request,api:Api){
 const url=new URL(request.url),match=url.pathname.match(/^\/portal\/([^/]+)$/),path=url.pathname
 try{
  if(!match){const data=await apiCall<{plans:{id:string;name:string}[]}>(api,request,'/api/buoy/portal/home');return shell({title:'Your shared plans',portal:true,current:'/portal',state:null,body:section('Current plans',data.plans.length?'<ul>'+data.plans.map(p=>'<li><a href="/portal/'+escape(p.id)+'">'+escape(p.name)+'</a></li>').join('')+'</ul>':'<p>No current shared plans. Ask your account owner to review access.</p>')})}
  const grantId=decodeURIComponent(match[1]),endpoint='/api/buoy/portal/'+encodeURIComponent(grantId)
  let error:string|undefined,status=200,fields:Record<string,string>={}
  if(request.method==='POST')try{
   if(request.headers.get('origin')!==url.origin)throw new ApiError('Submit this form from your shared plan.',403)
   if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
    const response=await api(new Request(new URL(endpoint+'/files',request.url),{method:'POST',headers:request.headers,body:request.body})),result=await response.json() as {error?:string}
    if(!response.ok)throw new ApiError(result.error??'Unable to upload this file.',response.status)
   }else{
    if(Number(request.headers.get('content-length')??0)>16000)throw new ApiError('Reduce the size of your comment.',413)
    for(const [k,v] of await request.formData()){if(typeof v!=='string')throw new ApiError('Only text is accepted.');fields[k]=v}
    await apiCall(api,request,endpoint+'/action','POST',fields)
   }
   return new Response(null,{status:303,headers:{location:path,'cache-control':'no-store'}})
  }catch(e){error=e instanceof Error?e.message:'Unable to save.';status=e instanceof ApiError?e.status:400}
  const data=await apiCall<Portal>(api,request,endpoint),base=hidden('revision',data.revision)
  const objectives=data.objectives.map(o=>'<li class="record"><h3>'+escape(o.title)+'</h3><p>'+escape(o.status==='achieved'?(o.kind==='customer-statement'?'Confirmed by customer':'Achieved from data'):o.status==='awaiting-customer-confirmation'?'Awaiting your confirmation':o.status==='unavailable'?'Metric evidence unavailable':'In progress')+' · Due '+escape(o.dueOn)+'</p>'+(o.kind==='customer-statement'&&o.status!=='achieved'?form('confirm-'+o.id,path,base+hidden('action','confirm')+hidden('objectiveId',o.id)+textarea('statement','Your confirmation statement',fields.objectiveId===o.id?fields.statement:'')+button('Confirm outcome')):'')+'</li>').join('')
  const tasks=data.tasks.map(t=>'<li class="record"><h3>'+escape(t.title)+'</h3>'+(t.completedAt?'<p>Completed by customer or staff</p>':form('task-'+t.id,path,base+hidden('action','complete-task')+hidden('taskId',t.id)+textarea('evidence','Completion evidence',fields.taskId===t.id?fields.evidence:'')+button('Complete customer task')))+'</li>').join('')
  const files=section('Shared files','<ul>'+data.files.map(file=>'<li><a href="'+escape(endpoint+'/files/'+file.id)+'">'+escape(file.filename)+'</a> · '+escape(file.size)+' bytes</li>').join('')+'</ul><form id="portal-upload" method="post" action="'+escape(path)+'" enctype="multipart/form-data">'+base+'<label>File for the account owner<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" required></label><p>PDF, image or plain text, up to 750 KB. The account owner can download it.</p>'+button('Upload file')+'</form>')
  return shell({title:data.name,portal:true,state:null,current:path,error,status,body:'<p><a href="/portal">Your shared plans</a></p>'+section('Agreed objectives','<ul class="records">'+objectives+'</ul>')+section('Milestones','<ul>'+data.milestones.map(m=>'<li>'+escape(m.title)+'</li>').join('')+'</ul>')+section('Your tasks','<ul class="records">'+tasks+'</ul>')+files+section('Plan comments','<ul>'+data.comments.map(c=>'<li class="record"><p>'+escape(c.body)+'</p><p>'+escape(c.recordedAt)+'</p></li>').join('')+'</ul>'+form('portal-comment',path,base+hidden('action','comment')+textarea('comment','Comment',fields.comment??'')+button('Post comment')))})
 }catch(error){
  if(error instanceof ApiError&&error.status===401)return new Response(null,{status:303,headers:{location:'/signin?returnTo='+encodeURIComponent(path),'cache-control':'no-store'}})
  return shell({title:'Shared plan unavailable',portal:true,state:null,current:path,status:error instanceof ApiError?error.status:503,body:section('Access unavailable','<p>This plan is unavailable or your access has stopped. Ask the account owner to review access.</p><p><a href="/portal">Your shared plans</a></p>')})
 }
}
