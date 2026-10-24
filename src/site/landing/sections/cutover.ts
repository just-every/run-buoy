// 12 CUTOVER · THU OCT 1, 12:00 AM (page-12): the Salesforce cutover plan Buoy's move-in runs (four fields
// Gainsight wrote, now written by Buoy on the same scales), the one-line start in a small terminal and the import
// chip strip. The terminal shows only the start line and a plain comment, never rer output or local addresses.
import { at, check, copy, cursor, links, sep, spark, stage } from '../parts'
import { npxLine, startLine } from '../records'

// Words stay whole when a line wraps, and the installer's `install.sh | sh` stays together.
const words = (line: string) => line.split(/(\S*install\.sh \| sh|\S+)/).map(part => {
  const pipe = /^(.*\/)(install\.sh \| sh)$/.exec(part)
  return pipe ? `<span class="nowrap">${pipe[1]}</span><wbr><span class="nowrap">${pipe[2]}</span>` : part.trim() ? `<span class="nowrap">${part}</span>` : part
}).join('')

const fields: [string, string, string][] = [
  ['Health Score', '0–100, same scale', '3 reports · 1 dashboard'],
  ['Health Color', '<span class="map green">70+ → Green</span><span class="map amber">60–69 → Yellow</span><span class="map red">below 60 → Red</span>', '2 reports · 2 dashboards'],
  ['CSM', '14 CSMs, user to user', '2 reports'],
  ['Lifecycle Stage', '5 stages, picklist to picklist', '1 report · 1 dashboard'],
]
const brought = ['1,850 companies', '52 weeks of health', '21,406 contacts', '6,912 tasks', '38 playbooks', '412 success plans', '9,370 NPS responses', '214,880 activities', '2 custom objects']

export function cutover(): string {
  const body = copy('Cutover · Thu Oct 1, 12:00 am', 'Same Salesforce fields,', 'now written by Buoy.', "At midnight on Oct 1 Buoy took over the four Salesforce fields Gainsight wrote, on the same scales. Tidewell's 4 reports and 2 dashboards never went blank.", at(75, 62, 840), 'narrow-lede')
    + `<figure class="terminal place" style="${at(936, 70, 540, 2.4)}"><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span><pre aria-label="Start Buoy on your computer"><code><span class="prompt" aria-hidden="true">$ </span>${words(startLine)}\n<span class="comment"># ${words(`Already have Node 22 or later? ${npxLine}`)}</span></code></pre></figure>`
    + `<p class="also place" style="${at(980, 290, 470, 2.4)}">Also moves in from ChurnZero, Totango, Planhat, Vitally and Velaris.</p>`
    + `<article class="card cutover-plan place" style="${at(205, 368, 1262, -1.4)}"><h3 class="plan-title">Salesforce cutover plan</h3><p class="card-sub">4 fields ${sep} from Salesforce field history ${sep} switched Thu Oct 1, 12:00 am</p>`
    + `<table class="fields"><thead><tr><th scope="col">Field</th><th scope="col">Was written by</th><th scope="col">Now written by</th><th scope="col">Mapping</th><th scope="col">Read by</th></tr></thead><tbody>${fields.map(([field, mapping, readBy]) => `<tr><th scope="row">${field}</th><td><s>Gainsight</s></td><td><span class="by-buoy">Buoy</span></td><td class="mapping">${mapping}</td><td>${readBy}</td></tr>`).join('')}</tbody></table>`
    + `<p class="parallel">Parallel run Sat Sep 12 – Wed Sep 30: Buoy wrote shadow fields only ${sep} deltas Mon Sep 21 and Wed Sep 30 ${sep} 0 duplicates</p>`
    + `<p class="returning">4 reports and 2 dashboards returning values for all 1,850 accounts ${check}</p></article>`
    + cursor('Maya', at(874, 820))
    + `<div class="brought place" style="${at(52, 920, 1432)}"><p>Also brought over from Gainsight ${sep}</p><ul>${brought.map(item => `<li>${item} ${check}</li>`).join('')}</ul></div>`
    + spark(at(1404, 44, 44, 20)) + spark(at(136, 452, 44, -70))
    + links('cutover', 1536, 1040, ['M962 214C952 280 900 320 850 362'])
  return stage('cutover', 1040, 'Same Salesforce fields, now written by Buoy.', body)
}
