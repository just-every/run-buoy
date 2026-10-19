// 03 HEALTH · MON OCT 5, 9:11 AM (page-03, page-03-390): Cascade's scorecard with every point explained, over 52
// weekly Gainsight points and Buoy's daily points from Thu Oct 1 on one 40–90 axis (BUILD-NOTES "03 health chart").
import { day, label, line, linear, n } from '../chart'
import { at, copy, cursor, dot, pill, sep, spark, stage } from '../parts'

// Imported Gainsight history, Mon Oct 6, 2025 – Mon Sep 28, 2026: 52 weekly scores between 78 and 86, ending 82.
const weekly = [80, 81, 83, 81, 82, 79, 80, 80, 83, 85, 84, 81, 82, 83, 81, 80, 81, 84, 82, 81, 83, 86, 82, 81, 80, 82, 84, 83, 81, 79, 80, 82, 83, 85, 84, 82, 81, 80, 78, 81, 83, 84, 82, 80, 79, 80, 81, 82, 81, 80, 81, 82]
const daily: [number, number][] = [[day(10, 1), 74], [day(10, 2), 66], [day(10, 5), 54]]

const measures = [
  { name: 'Usage', weight: 40, now: 19, was: 30, reason: 'Weekly active users 340 → 211 (−38%) · route exports 0 since <span class="nowrap">Wed Sep 30</span>', source: 'Segment', synced: '9:00 am', note: 'usage: −11' },
  { name: 'Support', weight: 25, now: 9, was: 20, reason: '3 urgent tickets in 5 days: #48213, #48219, #48224', source: 'Zendesk', synced: '9:10 am', note: 'support: −11' },
  { name: 'Relationship', weight: 20, now: 11, was: 17, reason: 'Champion Dana Ruiz left', source: 'Salesforce', synced: '9:08 am', note: 'champion: −6' },
  { name: 'Billing', weight: 15, now: 15, was: 15, reason: 'Paid on time · Oct 1 invoice paid', source: 'Stripe', synced: '9:00 am', note: 'billing fine' },
]

function history({ w, h, phone }: { w: number; h: number; phone: boolean }): string {
  const t = phone ? 13 : 15
  const top = phone ? 26 : 24, bottom = phone ? 196 : 222
  const y = linear(90, 40, top, bottom)
  const [gx0, gx1] = phone ? [48, 196] : [72, 830]
  const [bx0, bx1] = phone ? [220, 330] : [926, 1316]
  const week = linear(0, 51, gx0, gx1), daily0 = phone ? linear(day(10, 1), day(10, 5), bx0, bx1) : linear(day(9, 28), day(10, 5), bx0, bx1)
  const divider = phone ? daily0(day(10, 1)) : (gx1 + bx0) / 2 + 6
  const grid = [90, 80, 70, 60, 50, 40].map(v => `<line x1="${gx0 - 14}" x2="${bx1 + 14}" y1="${y(v)}" y2="${y(v)}" class="${v === 70 || v === 60 ? 'g' : 'gd'}"/><text x="${gx0 - 30}" y="${n(y(v) + t * 0.35)}" text-anchor="end" class="ax">${v}</text>`).join('')
  const weeklyPath = `<path d="${line(weekly.map((v, i) => [week(i), y(v)]))}" class="hist"/>` + weekly.map((v, i) => `<circle cx="${n(week(i))}" cy="${n(y(v))}" r="${phone ? 1.8 : 3.4}" class="hp${i === 51 ? ' last' : ''}"/>`).join('')
  const days = Array.from({ length: 8 }, (_, i) => day(9, 28) + i).filter(d => !phone || d >= day(10, 1))
  const dayTicks = days.map(d => { const date = new Date(d * 86_400_000).getUTCDate(); const text = date === 28 || date === 1 ? label(d, false) : String(date); return `<line x1="${n(daily0(d))}" x2="${n(daily0(d))}" y1="${top}" y2="${bottom}" class="gd"/><text x="${n(daily0(d))}" y="${bottom + t * 1.6}" text-anchor="middle" class="ax">${text}</text>` }).join('')
  const lastX = phone ? week(51) : daily0(day(9, 28))
  const buoy = `<line x1="${n(daily0(day(10, 1)))}" x2="${n(daily0(day(10, 1)))}" y1="${top - (phone ? 14 : 12)}" y2="${bottom}" class="cut"/><text x="${n(daily0(day(10, 1)) + 6)}" y="${top - (phone ? 16 : 2)}" class="cutt">${phone ? `<tspan>Buoy from</tspan><tspan x="${n(daily0(day(10, 1)) + 6)}" dy="${t * 1.1}">Thu Oct 1</tspan>` : 'Buoy from Thu Oct 1'}</text>`
    + `<path d="M${n(daily0(day(10, 1)))} ${y(74)}L${n(daily0(day(10, 2)))} ${y(66)}" class="bl"/><path d="M${n(daily0(day(10, 2)))} ${y(66)}L${n(daily0(day(10, 5)))} ${y(54)}" class="bl fall"/>`
    + daily.map(([d, v]) => `<circle cx="${n(daily0(d))}" cy="${n(y(v))}" r="${phone ? 5 : 6.5}" class="bp${v === 54 ? ' red' : ''}"/><text x="${n(daily0(d) + (v === 54 ? -2 : 8))}" y="${n(y(v) - 12)}" class="bv${v === 54 ? ' red' : ''}"${v === 54 ? ' text-anchor="end"' : ''}>${v}</text>`).join('')
    + (phone ? '' : `<circle cx="${n(lastX)}" cy="${y(82)}" r="6" class="hp last"/><text x="${n(lastX + 8)}" y="${y(82) - 14}" class="bv grey">82</text>`)
  // The end label sits clear above every weekly point under it (its width estimated at 0.6 em a character).
  const endText = `82 · ${phone ? 'Sep 28' : 'Mon Sep 28'}`, endRight = week(51) - (phone ? 2 : 6)
  const covered = weekly.filter((_, i) => week(i) >= endRight - endText.length * t * 0.6 - 4)
  const end = `<text x="${n(endRight)}" y="${n(Math.min(y(82) - 13, y(Math.max(...covered)) - 7))}" text-anchor="end" class="hend">${endText}</text>`
  const caption = phone ? `<text x="${gx0 - 4}" y="${bottom + t * 1.6}" class="ax">Gainsight · weekly</text>` : `<line x1="${n(divider)}" x2="${n(divider)}" y1="${top - 40}" y2="${bottom + 20}" class="split"/>`
  return `<svg class="chart history ${phone ? 'phone-only' : 'desk-only'}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Health on one axis from 40 to 90: 52 weekly Gainsight scores between 78 and 86 from Mon Oct 6, 2025, ending at 82 on Mon Sep 28, 2026; then Buoy's daily scores from Thu Oct 1: 74, 66 on Fri Oct 2 and 54 on Mon Oct 5" style="--t:${t}px">${grid}${dayTicks}${caption}${weeklyPath}${end}${buoy}</svg>`
}

export function health(): string {
  const rows = measures.map(m => `<tr><th scope="row">${m.name}</th><td class="num">${m.weight}</td><td class="num now${m.now < m.was ? ' down' : ''}">${m.now}</td><td class="num">${m.was}</td><td class="sum phone-only"><b>${m.now} of ${m.weight}</b> ${sep} was ${m.was}</td><td class="note phone-only hand">${m.note}</td><td class="reason">${m.reason}</td><td class="src">${m.source} ${sep} <span class="nowrap">synced ${m.synced}</span></td></tr>`).join('')
  const body = copy('Health · Mon Oct 5, 9:11 am', 'Down 28 points.', 'Every point explained.', 'Health is your scorecard, weighted your way. Each measure names its source and how fresh it is, so 54 reads as three causes, not a color.', at(100, 84, 552), 'step')
    + `<article class="card score-card place" style="${at(665, 22, 792)}"><header class="score-head"><h3>Cascade Freight</h3>${pill('red', '54 · At risk', 'risk-pill')}<p class="was">was 82 on Mon Sep 28</p><p class="card-sub">Enterprise ${sep} CSM Jordan Hale ${sep} $148,000 ARR ${sep} renews Thu Dec 31</p></header>`
    + `<table class="measures"><thead><tr><th scope="col">Measure</th><th scope="col">Weight</th><th scope="col">Now</th><th scope="col">Was</th><th scope="col" class="reason">Reason</th><th scope="col" class="src">Source</th></tr></thead><tbody>${rows}</tbody></table>`
    + `<p class="total"><b>54 of 100</b><span class="lead-sep"> ${sep}</span> was 82 ${sep} recalculated 9:11 am, 3 minutes after the Salesforce change</p></article>`
    + measures.map((m, i) => `<p class="hand margin-note place" style="${at(1384, [178, 242, 302, 362][i])}" aria-hidden="true"><svg viewBox="0 0 34 14"><path d="M33 7H3m6-5L2 7l7 5"/></svg>${m.note}</p>`).join('')
    + cursor('Jordan', at(1172, 50))
    + `<article class="card trend-card place" style="${at(80, 532, 1377)}"><div class="trend-heads desk-only"><p><b>Gainsight history</b> ${sep} weekly ${sep} Mon Oct 6, 2025 – Mon Sep 28, 2026</p><p><b>Buoy</b> ${sep} daily</p></div>${history({ w: 1377, h: 262, phone: false })}${history({ w: 340, h: 240, phone: true })}`
    + `<div class="trend-foot"><p class="legend"><span>${dot('green')}Healthy 70+</span><span>${dot('amber')}Watch 60–69</span><span>${dot('red')}At risk below 60</span></p><p class="scorecard"><b>Scorecard:</b> Enterprise v3 ${sep} Usage 40 ${sep} Support 25 ${sep} Relationship 20 ${sep} Billing 15</p></div></article>`
    + spark(at(40, 470, 30, -40))
  return stage('health', 939, 'Down 28 points. Every point explained.', body)
}
