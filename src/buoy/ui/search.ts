import type {search} from '../search'
import {button,escape,field,section} from './html'
export type SearchPage=Awaited<ReturnType<typeof search>>
export function searchPage(query:URLSearchParams,data?:SearchPage,error?:string){
 const q=query.get('q')??'',limit=query.get('limit')??'50'
 const form='<form id="customer-search" method="get" action="/app/search" role="search">'+field('q','Search customer records',q,'search',true,'maxlength="200" aria-describedby="search-scope"')+'<label>Results per page<select name="limit" aria-label="Results per page">'+['10','50','100'].map(n=>'<option value="'+n+'"'+(limit===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+button('Search records')+'</form>'
 let body=section('Find customer records','<p id="search-scope">Search current accounts, customer contacts and users, approved tasks, native timeline entries and renewal opportunities. Enter a name, domain, email, native or recorded external ID, or literal text. Search uses the same access as reading these records.</p>'+form,'search-controls')
 if(error)return body+section('Search unavailable','<p role="alert">'+escape(error)+'</p><p>Review your search above and try again. <a href="/app/search">Clear search</a></p>','search-results')
 if(!data)return body+section('Start a search','<p>Enter customer text above to find matching current records.</p>','search-results')
 const labels={account:'Account',contact:'Customer contact',user:'Customer user',task:'Task',activity:'Timeline entry',renewal:'Renewal opportunity'}
 body+=section('Search results','<p role="status">'+data.results.length+' matching '+(data.results.length===1?'record':'records')+' on this page for “'+escape(data.query)+'”.</p>'+(data.results.length?'<ul class="journal">'+data.results.map(r=>'<li class="record"><p>'+labels[r.kind]+'</p><h3><a href="'+escape(r.href)+'">'+escape(r.title)+'</a></h3><p>'+escape(r.excerpt)+'</p><p>Record ID: '+escape(r.id)+'</p></li>').join('')+'</ul>':'<p>No matching current records. Try a different name, email, reference or phrase.</p>')+(data.nextCursor?'<p><a href="/app/search?'+escape(new URLSearchParams({q:data.query,limit,cursor:data.nextCursor}).toString())+'">Next search results</a></p>':'')+'<p><a href="/app/search">Clear search</a></p>','search-results')
 return body
}
