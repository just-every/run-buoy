// 01 Hero (desk-buoy/hero-1536.png, page-01): the centred promise over the smiling ring, split from At risk to
// Renewed. The desk header (0–96) is the shared site header; this stage starts below it, so desk y = stage y + 96.
import { at, check, cursor, dot, links, mark, sep, spark, stage, sticky } from '../parts'
import { demo } from '../records'

const y = (deskY: number) => deskY - 96

const left = [
  `<article class="card hero-card risk place" style="${at(95, y(507), 368, -3.4)}"><p class="card-line">${dot('red')}<b>Cascade Freight ${sep} $148,000 ARR ${sep} health 82 → 54</b></p><ul class="hero-reasons"><li>Weekly active users −38% ${sep} Segment</li><li>3 urgent tickets ${sep} Zendesk</li><li>Champion left ${sep} Salesforce</li></ul></article>`,
  `<article class="card hero-card risk place" style="${at(124, y(668), 414, -3.2)}"><p class="card-line">${dot('red')}<span><b>Slack #cs-alerts</b> ${sep} Cascade Freight dropped to 54 ${sep} champion Dana Ruiz left ${sep} <span class="nowrap">Mon Oct 5</span> ${sep} acknowledged by Jordan</span></p></article>`,
  `<article class="card hero-card exception place" style="${at(218, y(797), 352, -4)}"><span class="pill red solid">exception</span><p>Ticket #48213 marked solved ${sep} route exports still 0 → Reopened ${sep} linked to <span class="nowrap">ENG-912</span> ${sep} fix shipped <span class="nowrap">Tue Oct 13</span></p></article>`,
]
const right = [
  `<article class="card hero-card place" style="${at(1012, y(536), 410)}"><p class="card-line">${dot('green')}<span>Usage back: 212 exports <span class="nowrap">Wed Oct 14</span> ${check} ${sep} risk resolved</span></p></article>`,
  `<article class="card hero-card place" style="${at(993, y(664), 393)}"><p class="card-line">${dot('green')}<span><b>Renewal</b> ${sep} Cascade Freight ${sep} $148,000 ${sep} <span class="nowrap">Thu Dec 31</span> ${sep} Commit</span></p></article>`,
  `<article class="card hero-card place" style="${at(993, y(801), 368)}"><p class="card-line">${dot('green')}<span>Q3 NRR 112% ${sep} GRR 94% ${sep} reconciles to Stripe to the cent ${check}</span></p></article>`,
]

export function hero(): string {
  const body = `<div class="hero-copy place" style="${at(0, y(104), 1536)}">`
    + `<h1><span class="l1">Spot the risk.</span> <span class="l2">Save the renewal.</span></h1>`
    + `<p class="hero-sub">Buoy joins CRM, billing, support and usage data for every account, explains its health, runs your playbooks and reconciles renewals to billing.</p>`
    + `<p class="hero-alt">100% free, open source alternative to <b>Gainsight</b>, <b>ChurnZero</b> and <b>Totango</b></p>`
    + `<div class="actions"><a class="run-pill" href="/run">Run Buoy <span aria-hidden="true">→</span></a><a class="text-link" href="${demo}">Try the demo</a><a class="text-link" href="/docs">Read the docs</a></div></div>`
    + `<div class="hero-collage" role="group" aria-label="Cascade Freight, from at risk to renewed">`
    + `<p class="hand hero-label risk place" style="${at(170, y(467))}">At risk</p>${left.join('')}`
    + `${mark('hero-ring place', at(622, y(563), 262))}`
    + `<p class="hand hero-label renewed place" style="${at(1211, y(467))}">Renewed</p>${right.join('')}`
    + sticky('Cascade renews by Dec&nbsp;31!', at(1372, y(706), 148, -9), 'hero-sticky')
    + `</div>`
    + cursor('Maya', at(132, y(774)))
    + cursor('Jordan', at(1338, y(866)))
    + [at(128, y(478), 30, -78), at(48, y(548), 34, -112), at(80, y(722), 34, -100), at(170, y(880), 34, -105), at(790, y(520), 48, -10), at(1428, y(560), 36, 75), at(1376, y(470), 34, 82), at(1404, y(860), 30, 70), at(1492, y(694), 32, 66)].map(spark).join('')
    + links('hero', 1536, 928, [
      `M466 ${y(566)}C540 ${y(548)} 598 ${y(574)} 618 ${y(626)}`,
      `M530 ${y(725)}C566 ${y(722)} 588 ${y(712)} 606 ${y(702)}`,
      `M576 ${y(860)}C606 ${y(848)} 628 ${y(824)} 642 ${y(796)}`,
      `M887 ${y(642)}C918 ${y(608)} 958 ${y(582)} 1003 ${y(576)}`,
      `M898 ${y(708)}C930 ${y(700)} 958 ${y(704)} 980 ${y(712)}`,
      `M886 ${y(792)}C910 ${y(822)} 940 ${y(848)} 977 ${y(852)}`,
    ]).replace('</svg>', `<path class="solid" d="M1404 ${y(674)}C1432 ${y(670)} 1452 ${y(686)} 1454 ${y(712)}" marker-end="url(#head-hero)"/></svg>`)
  return stage('top', 928, 'Spot the risk. Save the renewal.', body, 'hero')
}
