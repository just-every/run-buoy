// 08 PORTFOLIO · MON OCT 19, 8:05 AM (page-08): Maya's plain-English question, Buoy's answer with the accounts,
// cited sources (numbered chips link to them) and what it couldn't see, beside a fanned stack of six drafted intros.
import { at, check, copy, cursor, dot, links, sep, spark, stage } from '../parts'

const answer: [string, string, string, number[]][] = [
  ['Kestrel Cold Chain', '$212,000', 'Tue Dec 15', [1, 2]],
  ['Pinecrest Lumber Supply', '$88,500', 'Mon Nov 30', [1]],
  ['Bluegate Imports', '$64,000', 'Thu Dec 31', [3]],
  ['Halvorsen Dairy', '$41,200', 'Mon Nov 16', [1]],
  ['Ozark Valley Feed', '$37,800', 'Tue Dec 1', [1]],
  ['Tri-County Movers', '$22,500', 'Fri Oct 30', [3]],
]
const sources: [string, string][] = [['Salesforce contact roles', '214 renewals read'], ['Calendars', '180 days'], ['Gmail', '12 mailboxes']]
const cite = (k: number) => `<a class="cite" href="#q4-source-${k}" aria-label="Source ${k}: ${sources[k - 1][0]}">${k}</a>`

export function portfolio(): string {
  const tabs = ['Tri-County Movers · CFO', 'Ozark Valley Feed', 'Halvorsen Dairy', 'Bluegate Imports', 'Pinecrest Lumber Supply']
  const body = `<article class="card ask place" style="${at(100, 78, 562)}"><h3 class="ask-title">Ask Buoy</h3><p class="question">Which Q4 renewals have no executive contact?</p>`
    + `<div class="answer"><p class="answer-head">6 renewals, $466,000 ARR:</p><ul>${answer.map(([name, arr, date, refs]) => `<li>${dot('amber')}<p><b>${name}</b> ${sep} ${arr} ${sep} <span class="nowrap">${date}</span></p><span class="cites">${refs.map(cite).join('')}</span></li>`).join('')}</ul>`
    + `<p class="unseen">Could not see: 2 of 14 CSM mailboxes aren't connected; their accounts were checked in Salesforce and calendars only.</p></div>`
    + `<ol class="sources-row">${sources.map(([what, how], i) => `<li id="q4-source-${i + 1}"><span class="cite">${i + 1}</span><p>${what} ${sep}<br>${how}</p></li>`).join('')}</ol></article>`
    + cursor('Maya', at(618, 206))
    + copy('Portfolio · Mon Oct 19, 8:05 am', 'Six Q4 renewals.', 'No executive yet.', "Maya asked in plain English. Buoy answered with the accounts, the records it read and what it couldn't see, then drafted the intros.", at(718, 52, 770))
    + `<div class="intros" role="group" aria-label="Six drafted executive intros">${tabs.map((tab, i) => `<p class="intro-tab place" style="${at(805 + i * 4, 338 + i * 32, 497 + i * 6, i % 2 ? 0.6 : -0.6)}">${dot('grey')}${tab}</p>`).join('')}`
    + `<article class="card draft place" style="${at(815, 500, 615, -1.4)}"><p class="eyebrow">Executive intro ${sep} Draft 1 of 6</p><p class="to"><span>To:</span> <b>COO, Kestrel Cold Chain</b></p><p class="to"><span>Subject:</span> <b>Before your Dec 15 renewal</b></p>`
    + `<p class="draft-body">Since your VP sponsor left in August, I'd like to meet before the Dec 15 renewal to review the year and agree next year's goals.</p>`
    + `<ul class="draft-cites"><li><span class="cite">1</span><span>VP sponsor left in August ${sep} Salesforce roles</span></li><li><span class="cite">2</span><span>No executive meeting in 180 days ${sep} Calendars</span></li></ul>`
    + `<p class="draft-foot"><span>Drafted by Buoy ${sep} 8:07 am</span><span class="send">Send</span></p></article></div>`
    + `<ol class="flow place" style="${at(716, 880, 764)}"><li>${dot('plum')}<span>Drafted for 6 CSMs ${sep} 8:07 am</span></li><li class="done">${dot('green')}<span>6 sent by their CSMs by 4:30 pm ${check}</span></li><li class="done">${dot('green')}<span>5 executive meetings booked by Fri Oct 30 ${check} ${sep} Tri-County Movers renewed Thu Oct 29 ${check}</span></li></ol>`
    + [at(64, 46, 44, -50), at(1368, 112, 40, 20), at(1376, 500, 34, 30), at(694, 870, 32, -80), at(1470, 856, 32, 40)].map(spark).join('')
    + links('portfolio', 1536, 1000, ['M640 344C700 336 748 376 778 424', 'M921 918L946 918', 'M1160 918L1186 918'])
  return stage('portfolio', 1000, 'Six Q4 renewals. No executive yet.', body)
}
