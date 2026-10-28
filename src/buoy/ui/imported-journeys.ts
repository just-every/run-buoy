import {escape} from './html'
import type {PausedJourneyDraft} from '../migrate/churnzero-journeys'

const duration=(days:number|null)=>days===null?'Unavailable':String(days)+' days'
export function importedJourneys(drafts:PausedJourneyDraft[]|undefined){
 if(!drafts?.length)return ''
 return '<div id="imported-journeys"><h3>Paused imported journeys</h3><p>Review data only. These journeys cannot create tasks, send messages or run automatically.</p>'+drafts.map(draft=>
  '<article class="record"><div class="record-head"><h4>'+escape(draft.name)+'</h4><span class="status paused">Paused</span></div><p>ChurnZero source journey '+escape(draft.sourceId)+'</p>'+
  (draft.structure?'<p>Expected duration: '+duration(draft.structure.expectedDays)+'</p><ol>'+draft.structure.milestones.map(milestone=>
   '<li><strong>'+escape(milestone.name)+'</strong><p>Expected duration: '+duration(milestone.expectedDays)+'</p>'+
   '<p>Team task templates: '+(milestone.tasks.map(step=>escape(step.name)).join(', ')||'None supplied')+'</p>'+
   '<p>Customer achievement templates: '+(milestone.achievements.map(step=>escape(step.name)).join(', ')||'None supplied')+'</p></li>').join('')+'</ol>':'<p>Step semantics are unmapped. Review the original definition in Account source details.</p>')+
  '<p>'+escape(draft.unmapped.length)+' source elements remain unmapped. Original definitions and reasons are retained in the reviewed import.</p></article>').join('')+'</div>'
}
