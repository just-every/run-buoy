// 02 CASCADE FREIGHT · MON SEP 28 – MON OCT 19 (page-02): copy top-left, the small Cascade card, and Cascade's health
// line on one equal day step with all ten moments pinned on their days (BUILD-NOTES "02 health line").
import { day, label, line, linear, n } from '../chart'
import { at, check, copy, cursor, dot, links, sep, spark, stage, sticky } from '../parts'

const scores: [number, number][] = [[day(9, 28), 82], [day(10, 1), 74], [day(10, 2), 66], [day(10, 5), 54], [day(10, 8), 57], [day(10, 13), 62], [day(10, 14), 70], [day(10, 19), 79]]
const labelled = new Set([day(9, 28), day(10, 1), day(10, 2), day(10, 5), day(10, 14), day(10, 19)])
const events: [number, string, string][] = [[day(9, 29), 'Tue Sep 29 ·', 'release 4.18'], [day(9, 30), 'Wed Sep 30 ·', 'exports fall to 0'], [day(10, 2), 'Fri Oct 2 ·', '#48213 marked solved']]
// The ten moments: number, day, time, what happened, tone (3 is the agent's finding, 10 the resolution).
const moments: [number, number, string, string, string][] = [
  [1, day(10, 5), '9:08 am', 'Dana Ruiz left · Salesforce', 'plum'],
  [2, day(10, 5), '9:12 am', 'Slack alert · Jordan acknowledged 9:20 am', 'plum'],
  [3, day(10, 6), '7:10 am', 'Agent: #48213 says solved · route exports still 0', 'red'],
  [4, day(10, 6), '8:52 am', '#48213 reopened · 3 tickets linked to ENG-912', 'plum'],
  [5, day(10, 6), '10:15 am PT', 'Rob Tanaka books the intro', 'plum'],
  [6, day(10, 8), '2:00 pm', 'New sponsor meeting with Rob', 'plum'],
  [7, day(10, 12), '4:40 pm', 'ENG-912 fix merged', 'plum'],
  [8, day(10, 13), '6:00 pm', 'Fix shipped in 4.18.2', 'plum'],
  [9, day(10, 14), '3:12 pm PT', 'Rob: "Drivers had routes this morning."', 'plum'],
  [10, day(10, 14), '6:15 pm', '212 route exports · risk resolved ✓', 'green'],
]
const valueOn = (d: number) => {
  for (let i = 1; i < scores.length; i++) if (d <= scores[i][0]) { const [d0, v0] = scores[i - 1], [d1, v1] = scores[i]; return v0 + (v1 - v0) * (d - d0) / (d1 - d0) }
  return scores[scores.length - 1][1]
}
const tone = (v: number) => v >= 70 ? '#06c25a' : v >= 60 ? '#fdb80b' : '#f4513f'

/** The health line for one width: `w` × `h` viewBox, plot from x0 to x1, y from 90 (top) to 40 (bottom), type size `t`. */
function healthLine({ w, h, x0, x1, top, bottom, t, phone }: { w: number; h: number; x0: number; x1: number; top: number; bottom: number; t: number; phone: boolean }): string {
  const x = linear(day(9, 28), day(10, 19), x0, x1), y = linear(90, 40, top, bottom)
  const r = phone ? 10 : 13, gap = r * 2 + 2
  const bands = `<rect x="${x0 - 30}" y="${y(90)}" width="${x1 - x0 + 60}" height="${y(70) - y(90)}" fill="#f2fbf5"/><rect x="${x0 - 30}" y="${y(70)}" width="${x1 - x0 + 60}" height="${y(60) - y(70)}" fill="#fef8e8"/><rect x="${x0 - 30}" y="${y(60)}" width="${x1 - x0 + 60}" height="${y(40) - y(60)}" fill="#fef1f1"/>`
  const grid = [90, 80, 70, 60, 50, 40].map(v => `<line x1="${x0 - 30}" x2="${x1 + 30}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${x0 - (phone ? 34 : 42)}" y="${y(v) + t * 0.35}" text-anchor="end" class="ax">${v}</text>`).join('')
  const days = Array.from({ length: 22 }, (_, i) => day(9, 28) + i)
  const ticks = days.map(d => {
    const monday = new Date(d * 86_400_000).getUTCDay() === 1
    const text = phone ? (monday ? `<text x="${n(x(d))}" y="${bottom + t * 1.9}" text-anchor="middle" class="ax">${label(d, false)}</text>` : '') : `<text x="${n(x(d))}" y="${bottom + t * 1.7}" text-anchor="middle" class="ax">${new Date(d * 86_400_000).getUTCDate()}</text>${monday ? `<text x="${n(x(d))}" y="${bottom + t * 3.4}" text-anchor="middle" class="mon">${label(d)}</text>` : ''}`
    return `<line x1="${n(x(d))}" x2="${n(x(d))}" y1="${y(90)}" y2="${y(40)}" class="${monday ? 'gm' : 'gd'}"/>${text}`
  }).join('')
  const path = `<path d="${line(scores.map(([d, v]) => [x(d), y(v)]))}" class="ln"/>`
  const eventMarks = events.map(([d, a, b], i) => {
    const px = x(d), py = y(valueOn(d)), ly = phone ? 0 : [126, 168, 186][i], lx = px + [-26, 4, 6][i]
    return `<path d="M${n(px)} ${n(py - 6)}l6 6-6 6-6-6z" class="ev"/>` + (phone ? '' : `<line x1="${n(px)}" x2="${n(px)}" y1="${n(py + 8)}" y2="${n(ly - t)}" class="evs"/><text x="${n(lx)}" y="${n(ly)}" class="evt"><tspan>${a}</tspan><tspan x="${n(lx)}" dy="${t * 1.2}">${b}</tspan></text>`)
  }).join('')
  const points = scores.map(([d, v], i) => {
    const big = i === 0 || d === day(10, 5) || d === day(10, 14) || d === day(10, 19)
    const fill = d === day(10, 5) ? '#f4513f' : v >= 70 && i !== 1 ? '#06c25a' : '#8a2eae'
    return `<circle cx="${n(x(d))}" cy="${n(y(v))}" r="${big ? r * 0.72 : r * 0.58}" fill="${fill}" stroke="#fff" stroke-width="2.5"/>`
      + (labelled.has(d) ? (phone && d === day(10, 5) ? `<text x="${n(x(d) - r - 2)}" y="${n(y(v) + t * 0.35)}" text-anchor="end" class="pv red">${v}</text>` : `<text x="${n(x(d))}" y="${n(y(v) - r - 6)}" text-anchor="middle" class="pv${d === day(10, 5) ? ' red' : ''}">${v}</text>`) : '')
  }).join('')
  // Markers on their days: below the line, except Tue Oct 6 (3, 4, 5), stacked above it beside the low point. At phone
  // width a day is narrower than a marker, so each marker takes the first spot on its day that keeps it clear of the
  // markers already placed, the line, its points, their values and the plot's edges.
  const stacks = new Map<number, number>()
  const placed: [number, number][] = []
  const segments = scores.slice(1).map(([d, v], i) => [x(scores[i][0]), y(scores[i][1]), x(d), y(v)])
  const toSegment = (px: number, py: number, [ax, ay, bx, by]: number[]) => { const dx = bx - ax, dy = by - ay, k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - k * dx, py - ay - k * dy) }
  const values = scores.filter(([d]) => labelled.has(d) && !(phone && d === day(10, 5))).map(([d, v]) => [x(d), y(v) - r - 6 - t * 0.4])
  const clear = (px: number, py: number) => py - r >= top - 6 && py + r <= bottom - 3
    && placed.every(([a, b]) => Math.hypot(a - px, b - py) >= gap) && segments.every(s => toSegment(px, py, s) >= r + 3)
    && scores.every(([d, v]) => Math.hypot(x(d) - px, y(v) - py) >= r + 8) && values.every(([a, b]) => Math.abs(a - px) >= r + t || Math.abs(b - py) >= r + t * 0.6)
  const spot = (d: number, above: boolean) => {
    const px = x(d), py = y(valueOn(d))
    for (const side of above ? [-1, 1] : [1, -1]) for (let k = 0; k < 6; k++) for (const dx of [0, -(r + 1), r + 1]) {
      const cy = py + side * (r + 12 + k * gap)
      if (clear(px + dx, cy)) return [px + dx, cy]
    }
    throw new Error(`No clear spot for the marker on day ${d}`)
  }
  const markers = moments.map(([num, d, , , kind]) => {
    const k = stacks.get(d) ?? 0; stacks.set(d, k + 1)
    const above = d === day(10, 6)
    const [px, py] = phone ? spot(d, above) : [x(d), y(valueOn(d)) + (above ? -(r + 12) - k * gap : r + 12 + k * gap)]
    placed.push([px, py])
    return `<circle cx="${n(px)}" cy="${n(py)}" r="${r}" class="mk ${kind}"/><text x="${n(px)}" y="${n(py + t * 0.36)}" text-anchor="middle" class="mkt">${num}</text>`
  }).join('')
  return `<svg class="chart health-line ${phone ? 'phone-only' : 'desk-only'}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Cascade Freight health by day, Mon Sep 28 to Mon Oct 19: 82, 74 on Oct 1, 66 on Oct 2, 54 on Mon Oct 5, 57 on Oct 8, 62 on Oct 13, 70 on Oct 14 and 79 on Mon Oct 19" style="--t:${t}px">${bands}${grid}${ticks}${path}${eventMarks}${markers}${points}</svg>`
}

export function account(): string {
  const scoreChip = (tn: 'green' | 'red', v: number, when: string) => `<li class="score ${tn}">${dot(tn)}<b>${v}</b><span>${when}</span></li>`
  const body = copy('Cascade Freight · Mon Sep 28 – Mon Oct 19', 'Cascade slipped to 54.', 'Back to 79 in two weeks.', 'One account, one bad week, one renewal kept. Buoy saw it first and stayed on it until Cascade\'s own data said it was over.', at(85, 50, 860), 'narrow-lede')
    + `<article class="card cascade-card place" style="${at(968, 84, 506, 3)}"><h3>Cascade Freight</h3><p class="card-sub">Enterprise ${sep} $148,000 ARR ${sep} CSM Jordan Hale</p><ol class="scores">${scoreChip('green', 82, 'Mon Sep 28')}<li class="arrow" aria-hidden="true">→</li>${scoreChip('red', 54, 'Mon Oct 5')}<li class="arrow" aria-hidden="true">→</li>${scoreChip('green', 79, 'Mon Oct 19')}</ol></article>`
    + `<article class="card line-card place" style="${at(43, 352, 1452)}"><div class="line-head"><p class="legend"><span>${dot('green')}Healthy 70+</span><span class="sep">·</span><span>${dot('amber')}Watch 60–69</span><span class="sep">·</span><span>${dot('red')}At risk below 60</span></p><p class="pill green commit"><span>Mon Oct 26 ${sep} renewal $148,000 ${sep} <b>Commit →</b></span></p></div>`
    + healthLine({ w: 1452, h: 322, x0: 107, x1: 1389, top: 20, bottom: 240, t: 15.5, phone: false })
    + healthLine({ w: 340, h: 262, x0: 56, x1: 322, top: 34, bottom: 214, t: 13, phone: true })
    + `<ol class="moments">${moments.map(([num, d, time, what, kind]) => `<li><span class="mk-num ${kind}">${num}</span><p><b>${label(d)} ${sep} ${time}</b><span>${what.replace(' ✓', ` ${check}`)}</span></p></li>`).join('')}</ol></article>`
    + sticky('Caught in week one!', at(420, 432, 138, -6), 'week-one')
    + cursor('Maya', at(1435, 494))
    + spark(at(918, 80, 40, -20)) + spark(at(1470, 278, 36, 110)) + spark(at(1452, 436, 34, 40))
    + links('cascade', 1536, 990, []).replace('</svg>', '<path class="solid" d="M520 520C540 548 552 572 564 592" marker-end="url(#head-cascade)"/></svg>')
  return stage('cascade', 990, "Cascade slipped to 54. Back to 79 in two weeks.", body)
}
