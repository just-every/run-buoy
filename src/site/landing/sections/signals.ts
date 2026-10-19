// 09 SIGNALS · MON OCT 12 – WED OCT 21 (page-09): Juniper Labs filling its 250 seats on Monday ticks with 240 on
// Wed Oct 21, and the Q4 survey's 183 / 90 / 39 bar drawn to scale with the Harbor Point detractor called back.
import { day, label, line, linear, n } from '../chart'
import { at, check, copy, cursor, dot, initials, sep, spark, stage } from '../parts'

const seats: [number, number][] = [[day(9, 7), 204], [day(9, 14), 207], [day(9, 21), 211], [day(9, 28), 215], [day(10, 5), 219], [day(10, 12), 226], [day(10, 19), 235], [day(10, 21), 240]]
const mondays = seats.slice(0, 7).map(([d]) => d)

function seatsChart({ w, h, t, phone }: { w: number; h: number; t: number; phone: boolean }): string {
  const x = linear(day(9, 7), day(10, 21), phone ? 46 : 74, w - (phone ? 30 : 62)), y = linear(200, 250, h - 34, 34)
  const axes = `<line x1="${x(day(9, 7)) - 14}" x2="${x(day(9, 7)) - 14}" y1="${y(250)}" y2="${y(200)}" class="ax-line"/><line x1="${x(day(9, 7)) - 14}" x2="${w - 10}" y1="${y(200)}" y2="${y(200)}" class="ax-line"/>`
    + [200, 250].map(v => `<text x="${x(day(9, 7)) - 22}" y="${n(y(v) + t * 0.35)}" text-anchor="end" class="ax">${v}</text>`).join('')
    + `<line x1="${x(day(9, 7)) - 14}" x2="${w - 10}" y1="${y(225)}" y2="${y(225)}" class="ninety"/><text x="${x(day(9, 7)) - 22}" y="${n(y(225) + t * 0.35)}" text-anchor="end" class="ax">${phone ? '225' : '225 · 90%'}</text>`
    + mondays.filter((_, i) => !phone || i % 2 === 0).map(d => `<line x1="${n(x(d))}" x2="${n(x(d))}" y1="${y(200)}" y2="${y(200) + 6}" class="ax-line"/><text x="${n(x(d))}" y="${y(200) + t * 1.6}" text-anchor="middle" class="ax">${label(d, false)}</text>`).join('')
  const path = `<path d="${line(seats.map(([d, v]) => [x(d), y(v)]))}" class="seat-line"/>`
  const points = seats.map(([d, v], i) => { const last = i === seats.length - 1; return `<circle cx="${n(x(d))}" cy="${n(y(v))}" r="${last ? 6 : 5}" class="${last ? 'sp green' : 'sp'}"/>${!phone || [0, 5, 7].includes(i) ? `<text x="${n(x(d) + (last ? (phone ? 4 : 8) : 0))}" y="${n(y(v) + (i === 6 && !phone ? 24 : -12))}" text-anchor="${last ? 'end' : 'middle'}" class="sv">${v}${last && !phone ? ' · Wed Oct 21' : ''}</text>` : ''}` }).join('')
  const flag = `<path d="M${n(x(day(10, 12)) - 26)} ${n(y(226) - 6)}v-22l14 6-14 6" class="flag"/>`
  return `<svg class="chart seats ${phone ? 'phone-only' : 'desk-only'}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Seats used of 250 each Monday from Sep 7: 204, 207, 211, 215, 219, then 226 on Mon Oct 12 above the 225 seat, 90% line, 235 on Mon Oct 19 and 240 on Wed Oct 21" style="--t:${t}px">${axes}${path}${flag}${points}</svg>`
}

export function signals(): string {
  const total = 312, parts: [number, string, string][] = [[183, 'promoters', 'pro'], [90, 'passives', 'pas'], [39, 'detractors', 'det']]
  const body = copy('Signals · Mon Oct 12 – Wed Oct 21', 'Growth spotted.', 'Detractor called.', 'Signals cut both ways. Juniper Labs filled its seats and an expansion opened; one unhappy NPS reply started a playbook within a minute.', at(0, 42, 1536), 'center')
    + `<article class="card signal juniper place" style="${at(68, 348, 720, -1.8)}"><h3 class="big-title">Juniper Labs</h3><p class="card-sub">Austin, TX ${sep} CSM Nina Castillo</p><p class="chart-title"><b>Seats used of 250</b> ${sep} weekly</p>`
    + `<div class="seats-wrap"><p class="signal-chip">Signal: utilization above 90% → Nina Castillo</p>${seatsChart({ w: 640, h: 230, t: 14.5, phone: false })}${seatsChart({ w: 340, h: 210, t: 13, phone: true })}</div>`
    + `<p class="adopt"><span class="people-icon" aria-hidden="true"></span><span><b>New team adopting:</b> Returns ${sep} 31 new users since Thu Oct 1 ${sep} Segment</span></p>`
    + `<p class="expansion"><span class="check-disc">✓</span><span><b>96% of 250 seats used ${sep} expansion opened in Salesforce ${sep} +$36,000 ARR</b> ${sep} Wed Oct 21 ${sep} AE Chris Novak ${sep} CS-sourced</span></p>`
    + `<p class="said">${initials('NC', 'plum')}<span>“Their returns team joined; they asked for 50 more seats.”</span></p></article>`
    + `<article class="card signal survey place" style="${at(813, 348, 657, 1.8)}"><h3 class="big-title">Q4 relationship survey</h3><p class="card-sub">Thu Oct 1 – Fri Oct 16</p><p class="survey-sum">Sent 1,140 ${sep} 312 responses (27%) ${sep} NPS +46</p>`
    + `<div class="nps" role="img" aria-label="183 promoters, 90 passives and 39 detractors of 312 responses">${parts.map(([k, , c]) => `<span class="${c}" style="width:${(k / total * 100).toFixed(2)}%"></span>`).join('')}</div>`
    + `<p class="nps-labels" aria-hidden="true">${parts.map(([k, word, c]) => `<span class="${c}">${k} ${word}</span>`).join('')}</p>`
    + `<div class="detractor"><p>${dot('red')}<span><b>New detractor</b> ${sep} Harbor Point Distribution ${sep} Savannah, GA ${sep} score 3 ${sep} Thu Oct 15, 2:48 pm</span></p><p class="quote">“Our Monday report lands after the 7 am standup.”</p></div>`
    + `<ol class="callback"><li><b>Playbook:</b> Detractor follow-up ${sep} started 2:49 pm ${check}</li><li><b>Theo Grant</b> called Fri Oct 16, 10:00 am ${check}</li><li>Report moved to 6:00 am ET ${check}</li><li class="done">Mon Oct 19: “Report was there at 6.” ${check}</li></ol>`
    + `<p class="throttle">Throttle: no contact is surveyed twice within 90 days</p></article>`
    + cursor('Maya', at(1356, 612))
    + spark(at(742, 318, 48, 0))
  return stage('signals', 999, 'Growth spotted. Detractor called.', body)
}
