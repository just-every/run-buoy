// 07 Interlude (page-07, no heading): the mark large over the Q4 renewal band. Three equal month columns, every pin
// placed by its date inside its month, one tag style, unbroken stems ending on amber feet (Cascade's green).
import { n } from '../chart'
import { at, dot, links, mark, spark, stage } from '../parts'

const months = [{ x: 95, days: 31 }, { x: 545, days: 30 }, { x: 995, days: 31 }]
const width = 450, axis = 742
/** x of a Q4 date: month 10, 11 or 12, day 1–31, placed inside its month's equal column. */
const xOf = (month: number, date: number) => { const m = months[month - 10]; return m.x + (date - 1) / m.days * width }

// name, month, day, tag position (x, y, width), stem offset for the two Dec 31 pins.
const pins: [string, number, number, number, number, number, 'amber' | 'green', number][] = [
  ['Tri-County Movers', 10, 30, 398, 505, 218, 'amber', 0],
  ['Halvorsen Dairy', 11, 16, 684, 640, 186, 'amber', 0],
  ['Pinecrest Lumber Supply', 11, 30, 736, 532, 254, 'amber', 0],
  ['Ozark Valley Feed', 12, 1, 955, 404, 198, 'amber', 0],
  ['Kestrel Cold Chain', 12, 15, 1120, 514, 206, 'amber', 0],
  ['Bluegate Imports', 12, 31, 1228, 610, 196, 'amber', -6],
  ['Cascade Freight', 12, 31, 1268, 192, 206, 'green', 6],
]
const weekday = (month: number, date: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(2026, month - 1, date)).getUTCDay()]
const monthName = (month: number) => ['Oct', 'Nov', 'Dec'][month - 10]

function band(): string {
  const rules = months.slice(1).map(m => `<line x1="${m.x}" x2="${m.x}" y1="${axis - 40}" y2="${axis + 112}" class="rule"/>`).join('')
  const ticks = [[10, 15], [11, 15], [12, 15], [12, 31]].map(([m, d]) => `<line x1="${n(xOf(m, d))}" x2="${n(xOf(m, d))}" y1="${axis}" y2="${axis + 12}" class="tick"/><text x="${n(xOf(m, d))}" y="${axis + 46}" text-anchor="middle" class="day">${d}</text>`).join('')
  const labels = [['OCT', 95], ['NOV', 580], ['DEC 2026', 1008]].map(([text, x]) => `<text x="${x}" y="${axis + 46}" class="month">${text}</text>`).join('')
  // About forty unnamed renewals along the band, kept clear of the named pins.
  const named = pins.map(([, m, d, , , , , off]) => xOf(m, d) + off)
  const tones = ['g', 'g', 'a', 'g', 'g', 'r', 'g', 'a', 'g', 'g', 'a', 'g', 'g', 'g', 'a', 'r', 'g']
  const others = Array.from({ length: 46 }, (_, i) => 122 + i * 28.6).filter(x => named.every(p => Math.abs(p - x) > 16)).slice(0, 42)
    .map((x, i) => `<circle cx="${n(x)}" cy="${axis - 22 + (i % 3 === 1 ? 4 : 0)}" r="7.5" class="d ${tones[i % tones.length]}"/>`).join('')
  const stems = pins.map(([, m, d, , y, , tone, off]) => { const x = n(xOf(m, d) + off); return `<line x1="${x}" x2="${x}" y1="${y + 68}" y2="${axis - 14}" class="stem"/><circle cx="${x}" cy="${axis - 12}" r="${tone === 'green' ? 10 : 9}" class="foot ${tone}"/>` }).join('')
  return `<svg class="band desk-only" viewBox="0 0 1536 861" aria-hidden="true"><line x1="95" x2="1445" y1="${axis}" y2="${axis}" class="axis"/>${rules}${ticks}${labels}${others}${stems}</svg>`
}

export function quarter(): string {
  const tags = pins.map(([name, m, d, x, y, w, tone]) => `<li class="q-tag place" style="${at(x, y, w)}">${dot(tone)}<p><b>${name}</b><span>${weekday(m, d)} ${monthName(m)} ${d}${tone === 'green' ? ' · 79' : ''}</span></p></li>`).join('')
  const body = `<div class="card quarter-card place" style="${at(46, 8, 1444)}" aria-hidden="true"></div>`
    + mark('quarter-ring place', at(130, 74, 386))
    + [at(470, 70, 60, 30), at(508, 360, 44, 140), at(64, 236, 40, -100)].map(spark).join('')
    + `<p class="q-total place" style="${at(645, 212, 505)}">Q4 2026 · 214 renewals · $11,482,300 ARR</p>`
    + band()
    + `<ol class="q-tags" aria-label="Q4 renewals with no executive contact, and Cascade Freight">${tags}</ol>`
    + links('quarter', 1536, 861, ['M516 210C760 112 1140 96 1272 188'])
  return stage('quarter', 861, 'Q4 2026 renewals', body, 'interlude')
}
