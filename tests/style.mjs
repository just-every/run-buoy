// STYLE-001: the built run site and the emitted app in a real browser at 1440
// and 390 pixels. The static site runs on Cloudflare's asset server; the app
// on the emitted Worker with a fake only at the paid mail-provider edge.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { startWorker } from './worker.mjs'

async function startSite() {
 const directory = await mkdtemp(join(tmpdir(), 'buoy-style-'))
 const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r))
 const port = socket.address().port; await new Promise(r => socket.close(r))
 await writeFile(join(directory, 'wrangler.json'), JSON.stringify({ name: 'buoy-style-test', compatibility_date: '2026-09-01', assets: { directory: resolve('dist/site'), not_found_handling: '404-page' } }))
 const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', join(directory, 'wrangler.json'), '--local', '--port', String(port), '--inspector-port', '0'], { stdio: 'ignore', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
 const origin = `http://127.0.0.1:${port}`
 for (let i = 0; i < 240; i++) { try { if ((await fetch(origin)).ok) break } catch {} await new Promise(r => setTimeout(r, 250)) }
 return { origin, async close() { child.kill('SIGTERM'); await new Promise(r => child.exitCode !== null ? r() : child.once('exit', r)); await rm(directory, { recursive: true, force: true }) } }
}

// Everything the acceptance names, measured in the page itself.
const inspect = () => {
 const width = innerWidth, rect = element => element.getBoundingClientRect()
 const visible = element => { const r = rect(element), style = getComputedStyle(element); return r.width > 1 && r.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' }
 const scrolls = element => { for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) if (/(auto|scroll)/.test(getComputedStyle(node).overflowX)) return true; return false }
 const describe = element => element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + (element.className && typeof element.className === 'string' ? '.' + element.className.trim().split(/\s+/).join('.') : '') + ' "' + (element.textContent ?? '').trim().slice(0, 40) + '"'
 const controls = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary')].filter(visible)
 const offscreen = controls.filter(element => !scrolls(element) && (rect(element).left < -1 || rect(element).right > width + 1)).map(describe)
 const clipped = [...document.body.querySelectorAll('*')].filter(element => visible(element) && element.clientWidth > 1 && element.children.length === 0 && (element.textContent ?? '').trim()
  && /(hidden|clip)/.test(getComputedStyle(element).overflowX) && getComputedStyle(element).textOverflow !== 'ellipsis' && element.scrollWidth > element.clientWidth + 1).map(describe)
 const unlabelled = [...document.querySelectorAll('form input:not([type=hidden]):not([type=submit]),form select,form textarea')].filter(visible)
  .filter(field => !(field.labels?.length || field.getAttribute('aria-label') || field.getAttribute('aria-labelledby'))).map(describe)
 const forms = [...document.forms].filter(visible).map(form => { const submit = [...form.querySelectorAll('button:not([type=button]),input[type=submit]')].filter(visible)[0]; return submit ? { submit: !submit.disabled && rect(submit).height >= 24 && rect(submit).right <= width + 1, text: describe(submit) } : { submit: false, text: describe(form) } })
 const marks = [...document.querySelectorAll('img[src="/brand/mark.svg"]')].filter(visible).map(image => image.complete && image.naturalWidth > 0)
 const family = selector => { const element = [...document.querySelectorAll(selector)].find(visible); return element ? getComputedStyle(element).fontFamily : null }
 return { overflow: document.documentElement.scrollWidth - width, controls: controls.length, offscreen, clipped, unlabelled, forms, marks,
  theme: [...document.querySelectorAll('link[rel=stylesheet]')].map(link => new URL(link.href).pathname),
  icons: [...document.querySelectorAll('link[rel~=icon]')].map(link => new URL(link.href).pathname),
  faces: [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/["']/g, '')),
  text: family('p'), heading: family('h1,h2'), code: family('code,pre') }
}

const site = await startSite(), app = await startWorker(), failures = []
let controls = 0, forms = 0
const check = (fn) => { try { fn() } catch (error) { failures.push(error.message) } }
const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
try {
 const call = (path, method, body) => app.request('/api/buoy' + path, { method, body, cookie: app.cookie })
 const today = new Date().toISOString().slice(0, 10)
 assert.equal((await call('/accounts', 'POST', { id: 'harbour', name: 'Harbour Software', renewalDate: '2027-03-31', noticeDays: 30, renewalEvidence: 'Signed order form section 4', billing: { observedAt: today, reference: 'Nectar invoice INV-1042', currency: 'AUD', totalMinor: 120000, creditsMinor: 10000, allocatedMinor: 20000, dueDate: '2026-01-01' }, support: null })).status, 201)
 const cookies = app.cookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: app.origin } })
 const screens = [[site.origin, '/', false], [site.origin, '/run', false], [site.origin, '/docs', false], [app.origin, '/signin', false], [app.origin, '/setup', true], [app.origin, '/app', true], [app.origin, '/app/accounts/harbour', true], [app.origin, '/app/imports', true]]
 for (const width of [1440, 390]) {
  for (const [origin, path, signedIn] of screens) {
   const context = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: true })
   if (signedIn) await context.addCookies(cookies)
   const page = await context.newPage(), fonts = []
   page.on('request', request => { if (request.resourceType() === 'font') fonts.push(request.url()) })
   const response = await page.goto(origin + path, { waitUntil: 'networkidle' })
   const where = `STYLE-001 ${path} at ${width}px`
   assert.equal(response.status(), 200, where)
   await page.evaluate(() => document.fonts.ready)
   const seen = await page.evaluate(inspect)
   controls += seen.controls; forms += seen.forms.length
   check(() => { assert.ok(seen.theme.includes('/rer-theme.css'), `${where} uses the one theme file: ${seen.theme}`) })
   check(() => { assert.ok(fonts.length, `${where} loads its faces`) })
   check(() => { for (const url of fonts) assert.equal(new URL(url).origin, origin, `${where} loads ${url} from the installation`) })
   check(() => { assert.ok(seen.faces.includes('Inter'), `${where} renders Inter`) })
   check(() => { for (const role of ['text', 'heading']) if (seen[role]) assert.match(seen[role], /^Inter\b/, `${where} sets ${role} in Inter`) })
   check(() => { if (seen.code) assert.match(seen.code, /^"?IBM Plex Mono/, `${where} sets commands in IBM Plex Mono`) })
   // App documents link no icon, so the browser shows the installation's /favicon.ico (checked below).
   check(() => { assert.deepEqual(seen.icons.sort(), origin === site.origin ? ['/favicon-32.svg', '/favicon.ico'] : [], `${where} icon links`) })
   // Base's sign-in page shows the product name, not the mark (STYLE-001 Gap).
   check(() => { if (path !== '/signin') assert.ok(seen.marks.length && seen.marks.every(Boolean), `${where} shows the mark`) })
   check(() => { assert.ok(seen.overflow <= 1, `${where} has no horizontal page scroll (${seen.overflow}px)`) })
   check(() => { assert.deepEqual(seen.offscreen, [], `${where} keeps every control on screen`) })
   check(() => { assert.deepEqual(seen.clipped, [], `${where} clips no text`) })
   check(() => { assert.deepEqual(seen.unlabelled, [], `${where} labels every form field`) })
   check(() => { for (const form of seen.forms) assert.ok(form.submit, `${where} form submit is usable: ${form.text}`) })
   await context.close()
  }
 }
 assert.deepEqual(failures, [], 'STYLE-001 every screen at both widths')
 // The 16 and 32 pixel favicon frames, and the forms themselves at phone width.
 for (const origin of [site.origin, app.origin]) {
  const response = origin === app.origin ? await app.request('/favicon.ico') : await fetch(origin + '/favicon.ico')
  assert.equal(response.status, 200, `STYLE-001 ${origin} serves /favicon.ico`)
  const icon = Buffer.from(await response.arrayBuffer())
  assert.deepEqual(Array.from({ length: icon.readUInt16LE(4) }, (_, i) => icon[6 + 16 * i]).sort((a, b) => a - b), [16, 32], 'STYLE-001 favicon.ico carries tuned 16 and 32 pixel frames')
 }
 for (const path of ['/favicon-32.svg', '/brand/mark.svg']) assert.match((await fetch(site.origin + path)).headers.get('content-type') ?? '', /svg/, `STYLE-001 ${path} is served`)
 const phone = await browser.newContext({ viewport: { width: 390, height: 900 }, ignoreHTTPSErrors: true })
 const signin = await phone.newPage(); await signin.goto(app.origin + '/signin')
 await signin.getByLabel(/email/i).first().fill('owner@example.test'); await Promise.all([signin.waitForLoadState('networkidle'), signin.locator('form button[type=submit], form button:not([type])').first().click()])
 assert.match(new URL(signin.url()).search, /notice=sent/, 'STYLE-001 the sign-in form submits at 390 pixels')
 console.log(`STYLE-001 browser journey passed: 8 screens at 1440 and 390 pixels, ${controls} controls and ${forms} forms checked; installation faces, theme, mark and favicons; no clipping; forms usable.`)
 await phone.close()
} finally { await browser.close(); await app.close(); await site.close() }
