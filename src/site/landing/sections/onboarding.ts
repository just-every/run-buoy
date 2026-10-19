// 10 ONBOARDING · MON SEP 14 – FRI OCT 23 (page-10): one two-lane plan on one linear day scale. Every bar ends on
// its date, the 72% marker stands on Wed Oct 14 and the go-live flag on Fri Oct 23 (BUILD-NOTES "10 onboarding plan").
import { day, label, linear, n } from '../chart'
import { at, check, sep, spark, stage } from '../parts'

// Card-local desk pixels: Sep 14 at 186, Fri Oct 23 at 1232.
const x = linear(day(9, 14), day(10, 23), 186, 1232)
const span = (from: number, to: number) => [n(x(from)), n(x(to) - x(from))] as const
const bar = (text: string, from: number, to: number, top: number, className = '') => { const [left, width] = span(from, to); return `<p class="bar place ${className}" style="${at(left, top, width)}"><span>${text}</span> ${check}</p>` }

export function onboarding(): string {
  const weeks = [day(9, 14), day(9, 21), day(9, 28), day(10, 5), day(10, 12), day(10, 19)]
  const guides = [...weeks, day(10, 23)].map(d => `<line x1="${n(x(d))}" x2="${n(x(d))}" y1="104" y2="420" class="guide"/>`).join('')
  const plan = `<svg class="plan-lines desk-only" viewBox="0 0 1406 465" aria-hidden="true">${guides}<line x1="28" x2="1376" y1="252" y2="252" class="lane"/>`
    + `<line x1="${n(x(day(10, 14)))}" x2="${n(x(day(10, 14)))}" y1="112" y2="236" class="marker"/><line x1="${n(x(day(10, 14)))}" x2="${n(x(day(10, 14)) + 9)}" y1="116" y2="116" class="marker solid"/>`
    + `<path d="M${n(x(day(10, 23)))} 196V128" class="pole"/><path d="M${n(x(day(10, 23)) + 2)} 130h34l-10 12 10 12h-34z" class="flagpath"/>`
    + `<path d="M${n(x(day(10, 9)) - 9)} 272l9-9 9 9-9 9z" class="diamond"/><circle cx="${n(x(day(10, 12)))}" cy="272" r="10" class="plum"/><circle cx="${n(x(day(10, 13)))}" cy="272" r="10" class="done"/><path d="M${n(x(day(10, 13)) - 4.5)} 272l3 3 6-6" class="tickmark"/>`
    + `<path d="M${n(x(day(10, 9)))} 284C${n(x(day(10, 9)))} 330 812 304 760 336" class="dots"/><path d="M${n(x(day(10, 12)))} 284L${n(x(day(10, 12)))} 336" class="dots"/><path d="M${n(x(day(10, 13)))} 284C${n(x(day(10, 13)))} 320 1090 318 1110 336" class="dots"/>`
    + `<path d="M1000 276C1030 270 1050 278 1066 290" class="arrow"/></svg>`
  const body = `<div class="copy place" style="${at(104, 52, 720)}"><p class="eyebrow">Onboarding · Mon Sep 14 – Fri Oct 23</p><h2><span class="l1">Live on Friday,</span> <span class="l2">right on the date.</span></h2></div>`
    + `<p class="lede place" style="${at(838, 132, 600)}">Northfield Clinics' onboarding ran on one plan both teams could see. One customer task slipped, the agent nudged it, and go-live held.</p>`
    + `<article class="card plan place" style="${at(66, 296, 1406)}">${plan}`
    + `<header class="plan-head place" style="${at(28, 24, 1350)}"><h3>Northfield Clinics</h3><p>Minneapolis, MN ${sep} Enterprise onboarding template ${sep} 25 tasks (Tidewell 16 ${sep} Northfield 9) ${sep} started Mon Sep 14 when the deal closed in Salesforce ${sep} onboarding lead Owen Price</p></header>`
    + weeks.map(d => `<p class="week place desk-only" style="${at(n(x(d)) - 40, 78, 80)}">${label(d, false)}</p>`).join('') + `<p class="week place desk-only" style="${at(n(x(day(10, 23))) - 70, 78, 100)}">Fri Oct 23</p>`
    + `<h4 class="lane-name place" style="${at(30, 172)}">Tidewell</h4>`
    + `<p class="pct place" style="${at(n(x(day(10, 14))) + 12, 106)}">18 of 25 ${sep} 72% ${sep} on track</p>`
    + `<p class="bar place kick" style="${at(n(x(day(9, 14))), 192, n(x(day(9, 16)) - x(day(9, 14))))}" aria-hidden="true"></p><p class="kick-label place" style="${at(n(x(day(9, 16))) + 8, 198)}">Kickoff ${sep} Wed Sep 16 ${check}</p>`
    + bar(`<b>Clinic and depot data</b> ${sep} Sep 21 – Oct 13`, day(9, 21), day(10, 13), 140)
    + bar(`<b>Carrier integration</b> ${sep} Sep 28 – Oct 14`, day(9, 28), day(10, 14), 192)
    + bar(`<b>Training</b><br>Oct 15 – Oct 21`, day(10, 15), day(10, 21), 166, 'two')
    + `<p class="golive place" style="${at(n(x(day(10, 23))) + 10, 176)}"><b>Go-live</b> ${sep} Fri Oct 23</p>`
    + `<h4 class="lane-name place" style="${at(30, 296)}">Northfield Clinics</h4>`
    + `<p class="route place" style="${at(1070, 262, 326)}">Route templates moved Tue Oct 13 → Wed Oct 14 ${sep} proposed by the agent, accepted by Owen Price ${sep} Go-live unchanged ${check}</p>`
    + `<p class="callout amber place" style="${at(508, 338, 260)}"><span class="mk" aria-hidden="true"></span><span>Confirm pickup windows for 42 clinics ${sep} due Fri Oct 9 ${sep} <b class="overdue">overdue</b></span></p>`
    + `<p class="callout plum place" style="${at(782, 338, 292)}"><span class="mk" aria-hidden="true"></span><span>Agent reminder in the portal and by email ${sep} Mon Oct 12, 9:00 am CT → Grace Lindqvist</span></p>`
    + `<p class="callout done place" style="${at(1090, 338, 240)}"><span class="mk" aria-hidden="true">✓</span><span>Done in the portal Tue Oct 13, 3:40 pm CT ${check}</span></p></article>`
    + `<p class="live place" style="${at(66, 780, 930)}"><span class="check-disc">✓</span><span><b>Live Fri Oct 23</b> ${sep} 25 of 25 ${check} ${sep} 1,206 pickups routed on day one ${sep} time to value 39 days</span></p>`
    + `<article class="card portal place" style="${at(1017, 745, 470)}"><p class="portal-head"><b>Customer portal</b> ${sep} Northfield Clinics ${sep} Onboarding</p><div class="portal-body"><p class="portal-task"><span class="check-disc">✓</span>Confirm pickup windows for 42 clinics</p><p class="portal-note"><span class="avatar plum">GL</span><span><b>Grace Lindqvist</b><br>All 42 windows in. Two clinics changed hours.</span></p></div></article>`
    + spark(at(1380, 406, 34, 50)) + spark(at(984, 756, 30, -80)) + spark(at(1436, 704, 30, 40))
  return stage('onboarding', 951, 'Live on Friday, right on the date.', body)
}
