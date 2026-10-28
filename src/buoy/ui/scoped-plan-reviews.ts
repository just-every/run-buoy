import {apiCall,ApiError,mutate} from './actions'
import {button,escape,field,form,hidden,section,textarea} from './html'
import {shell} from './shell'
import type {Api,Fields} from './types'
import type {ProjectedState} from '../roles'
import type {ReviewsPage} from './reviews'

export async function retainedReviewsPage(request:Request,api:Api,state:ProjectedState){
 const url=new URL(request.url),path='/app/reviews'
 let fields:Fields|undefined,error:string|undefined,status=200
 try{
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)throw new ApiError('Submit this form from this installation.',403)
   fields=Object.fromEntries([...await request.formData()].map(([k,v])=>[k,String(v)]))
   if(fields.action!=='review-edit')throw new ApiError('Only retained commentary can be edited here.',403)
   await mutate(api,request,path,fields)
   return new Response(null,{status:303,headers:{location:path+'?review='+encodeURIComponent(fields.id),'cache-control':'no-store'}})
  }
 }catch(caught){status=caught instanceof ApiError?caught.status:400;error=caught instanceof Error?caught.message:'Review could not be saved.'}
 try{
  const selected=fields?.id??url.searchParams.get('review'),data=await apiCall<ReviewsPage>(api,request,'/api/buoy/reviews'+(selected?'?id='+encodeURIComponent(selected):'')),review=data.selected
  let body=section('Retained business reviews','<p>Current account and field permissions apply to every retained capture.</p><ul>'+data.reviews.map(r=>'<li><a href="'+path+'?review='+encodeURIComponent(r.id)+'">'+escape(r.document.name)+'</a></li>').join('')+'</ul>')
  if(review)body+=form('review-edit',path,hidden('action','review-edit')+hidden('id',review.id)+hidden('revision',review.revision)+review.document.slides.map((slide,i)=>section(slide.title,field('title:'+i,'Slide '+(i+1)+' title',fields?.['title:'+i]??slide.title)+textarea('commentary:'+i,'Slide '+(i+1)+' commentary',fields?.['commentary:'+i]??slide.commentary,false)+'<ul>'+slide.facts.map(f=>'<li>'+escape(f.label)+': '+escape(f.value)+' · '+escape(f.source)+'</li>').join('')+'</ul>')).join('')+button('Save slide edits'))
  return shell({title:'Retained business reviews',body,state,current:path,status,error})
 }catch(caught){return shell({title:'Review unavailable',body:section('Review unavailable','<p>Your current scope does not include this retained review.</p>'),state,current:path,status:caught instanceof ApiError?caught.status:503})}
}
