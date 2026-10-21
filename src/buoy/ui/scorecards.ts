import type {scorecardState,previewScorecard,ScorecardResult,ScorecardConfig} from '../scorecards'
import {escape,section,disclosure,field,hidden,form,button,valueOf,pill} from './html'
import {canManage,type State,type Fields} from './types'
export type ScorecardPage=Awaited<ReturnType<typeof scorecardState>>
export type ScorecardPreview=Awaited<ReturnType<typeof previewScorecard>>
const sourceCurrency=(details:unknown)=>details&&typeof details==='object'&&'currency' in details&&typeof details.currency==='string'?' · currency '+escape(details.currency):''
const select=(name:string,label:string,options:[string,string][],value:unknown,required=false)=>`<label>${escape(label)}<select aria-label="${escape(label)}" name="${escape(name)}"${required?' required':''}>${options.map(([key,text])=>`<option value="${escape(key)}"${key===String(value)?' selected':''}>${escape(text)}</option>`).join('')}</select></label>`
export function scorecardBreakdown(card:Pick<ScorecardResult,'score'|'band'|'configRevision'|'calculatedAt'|'breakdown'|'selectedSegment'>){
 return `<p>${pill(card.band)} · Score ${card.score===null?'unavailable':escape(card.score)+' / 100'}</p><p>Version ${escape(card.configRevision)} · Recalculated ${escape(card.calculatedAt)} UTC.</p>${card.selectedSegment?`<p>Weights selected by segment ${escape(card.selectedSegment.name??card.selectedSegment.id)} (${escape(card.selectedSegment.id)}), revision ${escape(card.selectedSegment.revision)}. Membership was evaluated before aggregate health.</p>`:'<p>Default measure weights apply.</p>'}<ul class="records">${card.breakdown.map(m=>`<li class="record"><h3>${escape(m.name)}</h3><p>${escape(m.field)} · observed value ${m.value===null?'missing':escape(m.value)} · contribution ${m.score===null?'unavailable':escape(m.score)+' / 100'} · weight ${escape(m.effectiveWeight)}.</p><p>Missing treatment: ${escape(m.missingTreatment)}${m.included?' · included in the weighted mean':' · excluded from the weighted mean'}.</p>${m.sources.map(s=>`<p>${escape(s.label)} · ${escape(s.freshness)} · observed ${escape(s.observedAt??'not recorded')} · reference ${escape(s.reference??'not recorded')}${sourceCurrency(s.details)}.</p>`).join('')}</li>`).join('')}</ul>`
}
function configuration(data:ScorecardPage,fields?:Fields):string{
 const saved=data.published?.config,draft=fields?.action==='scorecard'?fields:undefined,val=(key:string,fallback:unknown='')=>valueOf(draft,key,fallback)
 const rows=Math.max(5,saved?.measures.length??0),overrides=Math.max(2,saved?.segments.length??0)
 const measures=Array.from({length:rows},(_,i)=>{const m=saved?.measures[i],prefix='measure'+i
  return disclosure(`Measure ${i+1}`,m?.name??'Choose a real numeric input, bounds, weight and missing-source treatment.',hidden(prefix+'key',val(prefix+'key',m?.key??'measure_'+(i+1)))
   +field(prefix+'name',`Name for measure ${i+1}`,val(prefix+'name',m?.name),'text',false,'maxlength="100"')
   +select(prefix+'field',`Input for measure ${i+1}`,[['','No measure in this row'],...data.fields.map(f=>[f.key,f.name+(f.unit?' · '+f.unit:'')] as [string,string])],val(prefix+'field',m?.field))
   +field(prefix+'min',`Minimum for measure ${i+1}`,val(prefix+'min',m?.min),'number',false,'step="any"')
   +field(prefix+'max',`Maximum for measure ${i+1}`,val(prefix+'max',m?.max),'number',false,'step="any"')
   +field(prefix+'weight',`Weight for measure ${i+1}`,val(prefix+'weight',m?.weight),'number',false,'step="any" min="0"')
   +select(prefix+'direction',`Direction for measure ${i+1}`,[['higher','Higher values score better'],['lower','Lower values score better']],val(prefix+'direction',m?.direction??'higher'))
   +select(prefix+'missing',`Missing input for measure ${i+1}`,[['unknown','Make the score unknown'],['exclude','Exclude and reweight remaining measures']],val(prefix+'missing',m?.missing??'unknown')),'scorecard-measure-'+i,!!draft||!!m)
 }).join('')
 const segments=Array.from({length:overrides},(_,i)=>{const segment=saved?.segments[i]
  return disclosure(`Segment weights ${i+1}`,'First matching layer-1 segment wins; blank weights keep the measure default.',select('weightSegment'+i,`Segment for weights ${i+1}`,[['','No segment override'],...data.segments.map(s=>[s.id,s.name] as [string,string])],val('weightSegment'+i,segment?.segmentId))
   +Array.from({length:rows},(_,j)=>field(`segment${i}weight${j}`,`Segment ${i+1} weight for measure ${j+1}`,val(`segment${i}weight${j}`,saved?.measures[j]?segment?.weights[saved.measures[j].key]:''),'number',false,'step="any" min="0"')).join(''),'scorecard-segment-weights-'+i,!!draft||!!segment)
 }).join('')
 return form('scorecard-editor','/app',hidden('action','scorecard')+hidden('revision',val('revision',data.revision??''))+hidden('measureCount',rows)+hidden('segmentCount',overrides)
  +field('scorecardName','Scorecard name',val('scorecardName',saved?.name),'text',true,'maxlength="100"')
  +field('riskBelow','At risk below (0–100)',val('riskBelow',saved?.bands.riskBelow),'number',true,'step="any" min="0" max="100"')
  +field('healthyAt','Healthy at or above (0–100)',val('healthyAt',saved?.bands.healthyAt),'number',true,'step="any" min="0" max="100"')
  +'<p>Scores between the two bounds are Watch. Each measure scales linearly between its minimum and maximum and is clamped to 0–100. Weights form a weighted mean. Missing inputs either make the score unknown or are excluded with the remaining weights rebalanced. Stale evidence stays labeled; it is not silently refreshed. Billing amounts use the displayed currency’s minor units; no currency conversion is inferred.</p>'
  +measures+segments+'<button type="submit" name="scorecardIntent" value="preview">Preview scorecard</button><button type="submit" name="scorecardIntent" value="publish">Publish scorecard</button>')
}
export function scorecardsPage(data:ScorecardPage,state:State,fields?:Fields,preview?:ScorecardPreview){
 let body=section('Weighted health scorecard',`<p>Preview a scorecard from recorded numeric billing, support, adoption, custom/calculated fields and CSM judgment. Publishing creates an immutable version and recalculates every account. Source changes recalculate before their successful response; the hourly run also refreshes calculation times. Scores describe observations and are not predictions.</p><p>A published card determines the configured health band. An active red CSM judgment and separately configured adoption health measures retain their risk and missing-input effects. Providers and source kinds that do not exist are not invented.</p>${data.published?`<p>Current card: <strong>${escape(data.published.config.name)}</strong> · published ${escape(data.published.publishedAt)} UTC.</p>`:'<p>No weighted scorecard is published. Existing native evidence rules determine health.</p>'}`,'health-scorecard')
 if(canManage(state))body+=disclosure('Configure weighted health','Preview measures and segment weights, then explicitly publish a new version.',configuration(data,fields),'scorecard-configure',fields?.action==='scorecard')
 const historyOptions:[string,string][]=[['','Current account inputs'],...data.history.map(h=>[h.id,(state.accounts.find(a=>a.id===h.accountId)?.name??h.accountId)+' · '+h.calculatedAt+' · '+h.band] as [string,string])]
 if(data.versions.length)body+=disclosure('Preview a retained version','Compare current account inputs or a genuine retained calculation snapshot.',form('scorecard-history-preview','/app',hidden('action','scorecard-history-preview')
  +select('versionId','Scorecard version',data.versions.map(v=>[v.id,v.config.name+' · '+v.publishedAt]),fields?.versionId??data.published?.id,true)
  +select('historyId','Input snapshot',historyOptions,fields?.historyId??'')+button('Preview retained version')),'scorecard-version-preview',fields?.action==='scorecard-history-preview')
 if(preview)body+=section(preview.historical?'Historical scorecard preview':'Current scorecard preview',`<p>${escape(preview.config.name)} · ${escape(preview.versionId)}. Preview does not publish a configuration or apply a health band.</p>${preview.accounts.map(card=>disclosure(state.accounts.find(a=>a.id===card.accountId)?.name??card.accountId,'Preview of recorded evidence',scorecardBreakdown(card),'scorecard-preview-'+card.accountId,true)).join('')}`,'scorecard-preview')
 body+=section('Current weighted health results',data.accounts.length?data.accounts.map(card=>disclosure(state.accounts.find(a=>a.id===card.accountId)?.name??card.accountId,`${card.score===null?'Unknown':card.score+' / 100'} · ${card.band} · ${card.calculatedAt}`,scorecardBreakdown(card)+`<p><a href="/app/accounts/${encodeURIComponent(card.accountId)}#health">Account health and source evidence</a></p>`,'scorecard-result-'+card.accountId)).join(''):'<p>No weighted calculations yet.</p>','scorecard-results')
 return body
}
export function scorecardFormConfig(fields:Fields):ScorecardConfig{
 const number=(key:string)=>{if(fields[key]===undefined||fields[key].trim()==='')throw new Error('Enter a numeric value for '+key+'.');const value=Number(fields[key]);if(!Number.isFinite(value))throw new Error('Enter a finite number for '+key+'.');return value}
 const count=Number(fields.measureCount),segmentCount=Number(fields.segmentCount)
 if(!Number.isInteger(count)||count<1||count>16||!Number.isInteger(segmentCount)||segmentCount<0||segmentCount>50)throw new Error('Reload the scorecard editor before saving.')
 const measures=Array.from({length:count},(_,i)=>({i,prefix:'measure'+i})).filter(({prefix})=>fields[prefix+'field']).map(({prefix})=>({key:fields[prefix+'key'],name:fields[prefix+'name'],field:fields[prefix+'field'],min:number(prefix+'min'),max:number(prefix+'max'),weight:number(prefix+'weight'),direction:fields[prefix+'direction'] as 'higher'|'lower',missing:fields[prefix+'missing'] as 'unknown'|'exclude'}))
 const segments=Array.from({length:segmentCount},(_,i)=>i).filter(i=>fields['weightSegment'+i]).map(i=>({segmentId:fields['weightSegment'+i],weights:Object.fromEntries(Array.from({length:count},(_,j)=>j).filter(j=>fields['measure'+j+'field']&&fields[`segment${i}weight${j}`]?.trim()).map(j=>[fields['measure'+j+'key'],number(`segment${i}weight${j}`)]))}))
 return {name:fields.scorecardName,measures,bands:{riskBelow:number('riskBelow'),healthyAt:number('healthyAt')},segments}
}
