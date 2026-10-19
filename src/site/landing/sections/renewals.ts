// 11 RENEWALS AND RETENTION · MON OCT 19 – TUE NOV 17 (page-11): the signed renewal record verified in Salesforce
// and Stripe, overlapping the Q3 retention statement that reconciles to Stripe to the cent.
import { at, check, copy, cursor, dot, links, sep, stage, sticky } from '../parts'

const ledger: [string, string, string][] = [
  ['Starting ARR', '1,635 accounts active Oct 1, 2025', '$31,406,218.40'],
  ['+ Expansion', '212 accounts', '$5,654,270.00'],
  ['− Contraction', '44 accounts', '$622,463.20'],
  ['− Churn', '31 accounts', '$1,262,480.00'],
]

export function renewals(): string {
  const body = copy('Renewals and retention · Mon Oct 19 – Tue Nov 17', 'Signed in DocuSign.', 'Matched to Stripe.', 'Linda Park signed, and the agent checked the renewal landed in Salesforce and Stripe. Every retention figure ties back to Stripe, with 0 exceptions.', at(113, 42, 1000))
    + `<article class="card doc renewal place" style="${at(113, 334, 677)}"><h3 class="card-title">Renewal ${sep} Cascade Freight ${sep} $148,000</h3><p class="card-sub">term ends Thu Dec 31 ${sep} notice Mon Nov 30 (§4.2, confirmed terms)</p>`
    + `<section class="doc-part"><h4>Readiness <span>${sep} agent ${sep} Mon Oct 19</span></h4><ul class="ready"><li>Champion replaced: Rob Tanaka ${check}</li><li>Risk resolved Wed Oct 14 ${check}</li><li>Success-plan goals 2 of 2 confirmed ${check}</li><li>Economic buyer Linda Park: last met Wed Jan 14 → meeting booked Thu Oct 29</li></ul></section>`
    + `<section class="doc-part"><h4>Forecast</h4><p class="forecast"><span class="pill red">At risk <span>Mon Oct 5</span></span><span class="arrow" aria-hidden="true">→</span><span class="pill amber">Likely <span>Thu Oct 15</span></span><span class="arrow" aria-hidden="true">→</span><span class="pill green">Commit <span>Mon Oct 26</span></span></p><p class="by">by Maya Okafor</p></section>`
    + `<section class="doc-part"><h4>Records</h4><ol class="records"><li class="grey">Thu Oct 29 ${sep} Linda Park and Rob Tanaka met Jordan and Chris ${sep} renewal quote $148,000 for Fri Jan 1 – Fri Dec 31, 2027 sent from Salesforce</li><li>Tue Nov 17, 1:22 pm PT ${sep} signed in DocuSign by Linda Park, CFO ${check}</li><li>Verified by the agent ${sep} Tue Nov 17, 4:40 pm: Salesforce renewal Closed Won ${sep} $148,000 ${check} ${sep} Stripe subscription renews Fri Jan 1, 2027 ${sep} $148,000 ${check}</li></ol></section>`
    + `<p class="renewed-row">${dot('green')}<span><b>Renewed</b> ${sep} recorded by Maya Okafor ${check}</span></p></article>`
    + `<article class="card doc retention place" style="${at(782, 356, 640)}"><h3 class="card-title">Q3 2026 ${sep} trailing 12 months</h3><p class="card-sub">Oct 1, 2025 – Sep 30, 2026 ${sep} source: Stripe</p>`
    + `<table class="ledger"><tbody>${ledger.map(([what, who, amount]) => `<tr><th scope="row">${what} <span>${sep} ${who}</span></th><td>${amount}</td></tr>`).join('')}<tr class="end"><th scope="row">= Ending ARR of the cohort</th><td>$35,175,545.20</td></tr></tbody></table>`
    + `<div class="rates"><p><span>NRR</span><b>112.0%</b></p><p><span>GRR</span><b>94.0%</b></p></div><p class="new-logos">New logos excluded ${sep} 246 accounts ${sep} $2,614,300.00</p>`
    + `<p class="match">${dot('green')}<span>Stripe export $35,175,545.20 = Buoy $35,175,545.20 ${check} ${sep} 0 exceptions</span></p>`
    + `<p class="drill">${dot('plum')}<span><b>Cascade Freight</b> ${sep} $132,000.00 → +$16,000.00 expansion, Thu Mar 12, 2026 (2 depots added) → $148,000.00 ${sep} <span class="u">invoice links</span></span></p></article>`
    + sticky('Board deck done by 10!', at(1324, 648, 156, -8), 'board-sticky')
    + cursor('Maya', at(1430, 752))
    + links('renewals', 1536, 992, ['M808 892C784 900 764 894 744 880'])
  return stage('renewals', 992, 'Signed in DocuSign. Matched to Stripe.', body)
}
