// 13 Closing (page-13): the hero's sticky now checked, the mark, and the signed renewal card on dotted connectors,
// then the free-and-open-source line and the two actions. The set-type footer follows (chrome.ts).
import { at, cursor, dot, links, mark, sep, spark, stage, sticky } from '../parts'

export function closing(): string {
  const body = sticky('Cascade renews by Dec&nbsp;31! <span class="done-check" aria-hidden="true">✓</span>', at(222, 84, 230, -8), 'closing-sticky')
    + mark('closing-ring place', at(622, 92, 206))
    + `<article class="card closing-card place" style="${at(963, 138, 482)}"><p>${dot('green')}<b>Renewal ${sep} Cascade Freight ${sep} $148,000</b></p><p class="signed">signed Tue Nov 17 ✓ ${sep} renews Fri Jan 1, 2027</p></article>`
    + cursor('Maya', at(216, 258)) + cursor('Jordan', at(1334, 238))
    + spark(at(178, 98, 34, -70)) + spark(at(800, 64, 40, 20))
    + `<div class="closing copy-close place" style="${at(0, 372, 1536)}"><h2><span class="l1">Cascade renewed.</span> <span class="l2">Six weeks early.</span></h2><p class="free">100% free and open source. MIT licensed.</p><div class="actions"><a class="run-pill" href="/run">Run Buoy <span aria-hidden="true">→</span></a><a class="text-link" href="/docs">Read the docs</a></div></div>`
    + links('closing', 1536, 780, ['M456 196L606 196', 'M846 196L948 196'])
  return stage('closing', 780, 'Cascade renewed. Six weeks early.', body)
}
