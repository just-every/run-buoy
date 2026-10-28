import {escape} from './html'
import type {MigrationHealth} from '../migrate/churnzero-health'

const observation=(value:number|null)=>value===null?'Unavailable':escape(value)
export function importedHealth(health:MigrationHealth|undefined){
 if(!health)return ''
 return '<div id="imported-health"><h3>Imported ChurnZero observations</h3><dl><dt>Source ChurnScore</dt><dd data-imported-score>'+observation(health.score)+'</dd>'+
  Object.entries(health.factors).map(([name,value])=>'<dt>'+escape(name)+'</dt><dd data-imported-factor="'+escape(name)+'">'+observation(value)+'</dd>').join('')+
  '</dl><p>Read-only source observations. Importing does not publish a new scorecard or infer weights, bands or an observation date.</p></div>'
}
