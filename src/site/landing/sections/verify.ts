// 05 VERIFY · TUE OCT 6 → WED OCT 14 (page-05, page-05-390): the page's one failure and recovery. The agent's
// finding card (sources as plain caps labels, no logos), the remedy to three owners, and the timeline that closes the
// risk only on Cascade's own data and words.
import { day, line, linear, n } from '../chart'
import { at, check, copy, cursor, initials, links, sep, spark, stage } from '../parts'

// Segment "Route Exported", weekdays Sep 14–29 near the 208 average, then 0 from Wed Sep 30 to Mon Oct 5.
const exportsByDay: [number, number][] = [
  ...[14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 28, 29].map((d, i): [number, number] => [day(9, d), [206, 210, 208, 211, 205, 209, 207, 208, 212, 206, 204, 209][i]]),
  ...[[9, 30], [10, 1], [10, 2], [10, 5]].map(([m, d]): [number, number] => [day(m, d), 0]),
]
function sparkline(w: number, h: number): string {
  const x = linear(day(9, 14), day(10, 5), 2, w - 2), y = linear(0, 230, h - 3, 3)
  const points = exportsByDay.map(([d, v]): [number, number] => [x(d), y(v)])
  const plateau = points.filter((_, i) => exportsByDay[i][1] > 0)
  const area = `M${n(plateau[0][0])} ${h}${line(plateau).replace(/^M/, 'L')}L${n(x(day(9, 30)))} ${h}Z`
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" role="img" aria-label="Route Exported per weekday: about 208 from Sep 14 to Sep 29, then 0 from Wed Sep 30"><path d="${area}" fill="#efe1f8"/><path d="${line(points)}" fill="none" stroke="#8a2eae" stroke-width="2.2" stroke-linejoin="round"/><line x1="0" x2="${w}" y1="${h - 1}" y2="${h - 1}" stroke="#d9dbe4" stroke-dasharray="2 3"/></svg>`
}

const steps: [string, string, string][] = [
  ['red', 'Tue Oct 6 · 8:52 am', `#48213 reopened by Elena Marsh ${sep} 3 tickets linked to ENG-912 ${check}`],
  ['plum', 'Tue Oct 6 · 9:30 am', `ENG-912 moved into sprint 41 by Sam Whitaker ${check}`],
  ['plum', 'Fri Oct 9 · 9:00 am', `Agent chased: ENG-912 in code review ${sep} Jordan's status note to Rob sent ${check}`],
  ['green', 'Mon Oct 12 · 4:40 pm', `Fix merged ${check}`],
  ['green', 'Tue Oct 13 · 6:00 pm', `4.18.2 shipped ${check} ${sep} “tell your customer” tasks for 4 CSMs`],
  ['green', 'Wed Oct 14 · 3:00 pm PT', `212 route exports today (weekday average 208) ${check}`],
  ['green', 'Wed Oct 14 · 3:12 pm PT', 'Rob Tanaka: “Drivers had routes this morning. Thanks for staying on it.”'],
  ['done', 'Wed Oct 14 · 6:15 pm', `Risk resolved ${check} ${sep} confirmed by usage and by Rob Tanaka`],
]

export function verify(): string {
  const source = (name: string, text: string, extra = '') => `<div class="src-row"><dt>${name}</dt><dd><p>${text}</p>${extra}</dd></div>`
  const body = `<article class="card finding place" style="${at(118, 68, 676, -1)}"><h3 class="card-title">Buoy agent ${sep} Tue Oct 6, 7:10 am ${sep} Cascade Freight</h3><dl class="sources">`
    + source('Zendesk', `#48213 ${sep} urgent ${sep} ‘Route exports fail’ ${sep} solved Fri Oct 2, 4:30 pm by Bree Collins ${sep} macro: clear cache and retry`)
    + source('Segment', `Route Exported ${sep} 0 since Wed Sep 30 ${sep} weekday average 208 (Sep 14–25)`, sparkline(170, 40))
    + source('Jira', `ENG-912 ${sep} Route export fails with custom carrier codes after 4.18 ${sep} open ${sep} matches #48213, #48219, #48224`)
    + source('Stripe', `Oct 1 invoice paid ${sep} billing is not the cause`)
    + source('Email', `Tony Alvarez, dispatch lead ${sep} Mon Oct 5, 6:52 am PT: “Still hand-keying routes into our carrier portal.”`)
    + `</dl><p class="verdict"><span class="dot red"></span><span><b>Unresolved</b> ${sep} same cause as ENG-912</span></p>`
    + `<div class="remedy"><h4>Remedy ${sep} three owners</h4><ul>`
    + `<li>${initials('EM', 'plum')}<p><b>Support</b><span>Elena Marsh: reopen #48213 and link all three tickets to ENG-912</span></p></li>`
    + `<li>${initials('SW', 'blue')}<p><b>Engineering</b><span>Sam Whitaker: ENG-912 into this sprint (4 accounts linked ${sep} $391,500 ARR)</span></p></li>`
    + `<li>${initials('JH', 'green')}<p><b>CS</b><span>Jordan Hale: a daily status note to Cascade until exports return</span></p></li>`
    + `</ul><p class="drafted">Drafted by Buoy ${sep} sent by Jordan 8:40 am</p></div></article>`
    + copy('Verify · Tue Oct 6 → Wed Oct 14', 'Marked solved.', 'Proven fixed.', "Zendesk said solved. Cascade's exports still read zero. The agent checked every source, lined up three owners and closed the risk only on Cascade's own data and words.", at(848, 52, 640))
    + `<ol class="timeline place" style="${at(880, 382, 612)}">${steps.map(([tone, when, what]) => `<li class="${tone}"><span class="tl-dot" aria-hidden="true">${tone === 'done' ? '✓' : ''}</span><p><b>${when}</b><span>${what}</span></p></li>`).join('')}</ol>`
    + `<p class="exporting place" style="${at(78, 925, 1382)}"><span class="check-disc">✓</span><span><b>4 of 4 linked accounts exporting again ${check}</b> <span class="sep">·</span> Cascade Freight, Ridgeline Haulers, Bayside Produce, Cold Spring Logistics</span></p>`
    + cursor('Jordan', at(618, 836))
    + [at(74, 60, 40, -30), at(1420, 186, 34, 85), at(86, 514, 34, -90), at(740, 852, 30, 60), at(38, 926, 30, -70), at(1472, 924, 30, 70)].map(spark).join('')
    + links('verify', 1536, 1024, ['M776 524C812 480 806 400 868 378'])
  return stage('verify', 1024, 'Marked solved. Proven fixed.', body)
}
