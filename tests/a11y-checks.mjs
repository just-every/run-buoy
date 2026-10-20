import assert from 'node:assert/strict'
import { contrast } from './a11y-contrast.mjs'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8')

import { failures, check, focused } from './keyboard.mjs'
export { failures, check, focused }
export const manual = []
export let scans = 0

export async function type(page, field, value) {
 await focused(page, field, 'Text field keyboard focus')
 await page.keyboard.press('ControlOrMeta+A')
 await page.keyboard.type(value)
}
export async function submit(page, button) {
 await focused(page, button, 'Submit keyboard focus')
 await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.keyboard.press('Enter')])
}
export async function openForms(page) {
 // Scan controls inside the actual native disclosures, rather than only their summaries.
 while (await page.locator('details:not([open]) > summary:visible').count()) {
  const summary = page.locator('details:not([open]) > summary:visible').first()
  await focused(page, summary, 'Disclosure keyboard focus')
  await page.keyboard.press('Enter')
 }
}

export async function scan(page, label) {
 await page.evaluate(() => document.fonts.ready)
 await check(`${label} reflow`, async () => {
  const inspect = () => {
   const visible = element => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
   const scrollContainer = element => { for (let p = element.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true; return false }
   const controls = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary')].filter(visible)
   return { overflow: document.documentElement.scrollWidth - innerWidth,
    outside: controls.filter(element => { const r = element.getBoundingClientRect(); return !scrollContainer(element) && (r.left < -1 || r.right > innerWidth + 1) }).map(element => element.outerHTML.slice(0, 140)) }
  }
  const initial = page.viewportSize()
  try {
   for (const width of [...new Set([initial.width, 320])]) {
    await page.setViewportSize({ width, height: initial.height })
    const result = await page.evaluate(inspect)
    assert.ok(result.overflow <= 1, `No horizontal page scroll at ${width}px (${result.overflow}px)`)
    assert.deepEqual(result.outside, [], `Controls remain reachable at ${width}px`)
   }
  } finally { await page.setViewportSize(initial) }
 })
 await check(`${label} text alternatives`, async () => {
  const alternatives = await page.evaluate(() => ({
   pills: [...document.querySelectorAll('.pill')].map(element => element.textContent.trim()),
   lanes: [...document.querySelectorAll('.rw-lane')].map(element => ({ name: element.querySelector('.rw-name')?.textContent,
    description: element.querySelector('.rw-track > .sr-only')?.textContent,
    markers: [...element.querySelectorAll('.rw-turn')].map(marker => marker.getAttribute('aria-label')) })),
   charts: [...document.querySelectorAll('canvas,svg[role=img],[role=img]')].map(element => ({
    name: element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim(),
    description: element.getAttribute('aria-describedby')?.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() }))
  }))
  for (const pill of alternatives.pills) assert.match(pill, /At risk|Healthy|Unknown/, 'Health color has a text label')
  if(alternatives.lanes.length) { const table=page.getByRole('table',{name:'Renewal runway data',exact:true}); assert.equal(await table.count(),1,'A11Y-001 runway has a semantic text table'); assert.equal(await table.locator('tbody tr').count(),alternatives.lanes.length,'A11Y-001 table covers every account lane') }
  for (const toggle of await page.locator('.rw-open').all()) {
   const expanded = await toggle.getAttribute('aria-expanded')
   assert.ok(['true', 'false'].includes(expanded), 'A11Y-001 expansion state is accessible')
   const account = await toggle.locator('..').locator('.rw-name').innerText()
   assert.equal(await toggle.getAttribute('aria-label'), `${expanded === 'true' ? 'Close' : 'Open'} ${account} on the runway`, 'A11Y-001 symbolic plus/minus controls name their account and action')
   assert.equal((await toggle.innerText()).trim(), expanded === 'true' ? '−' : '+', 'A11Y-001 the visible symbol matches the named expansion action')
  }
  for (const lane of alternatives.lanes) {
   assert.ok(lane.description?.includes(lane.name), 'Runway names the account in its text alternative')
   assert.match(lane.description, /At risk|Healthy|Unknown/)
   assert.match(lane.description, /renews .*notice /, 'Renewal and notice dates have a text alternative')
   for (const marker of lane.markers) assert.ok(marker?.includes(lane.name) && marker.includes('health would read'), 'Projected changes describe their date, account and effect')
  }
  for (const chart of alternatives.charts) assert.ok(chart.name && chart.description, 'A data graphic has an accessible name and text explanation')
 })
 // evaluate runs in the browser without adding a production script or bypassing auth.
 await check(`${label} computed contrast`, () => contrast(page))
 await page.evaluate(axeSource)
 const result = await page.evaluate(async () => {
  const report = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
  return { violations: report.violations.map(rule => ({ id: rule.id, impact: rule.impact,
   nodes: rule.nodes.map(node => ({ target: node.target, reason: node.failureSummary })) })),
   incomplete: report.incomplete.map(rule => ({ id: rule.id, targets: rule.nodes.map(node => node.target) })) }
 })
 scans++
 await mkdir('../screens', { recursive: true })
 await page.screenshot({ path: `../screens/scan-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.png`, fullPage: true, mask: [page.getByRole('textbox', { name: 'Agent credential', exact: true })] })
 if (result.violations.length) failures.push(`${label} axe: ${JSON.stringify(result.violations)}`)
 if (result.incomplete.length) manual.push({ screen: label, rules: result.incomplete })
}

