// Exercise the emitted run site through Cloudflare's actual static-asset server.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const directory = await mkdtemp(join(tmpdir(), 'buoy-site-'))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const origin = `http://127.0.0.1:${port}`
await writeFile(join(directory, 'wrangler.json'), JSON.stringify({ name: 'buoy-site-test', compatibility_date: '2026-09-01', assets: { directory: resolve('dist/site'), not_found_handling: '404-page' } }))
const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', join(directory, 'wrangler.json'), '--local', '--port', String(port), '--inspector-port', '0'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
let diagnostics = ''
for (const stream of [worker.stdout, worker.stderr]) stream.on('data', chunk => { diagnostics += chunk })
try {
  let ready = false
  for (let attempt = 0; attempt < 240; attempt++) {
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    if (worker.exitCode !== null) break
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready, `Static site became ready: ${diagnostics.slice(-1000)}`)
  const queue = ['/'], checked = new Set(), documents = new Map(), anchors = []
  while (queue.length) {
    const path = queue.shift()
    if (checked.has(path)) continue
    checked.add(path)
    const response = await fetch(origin + path)
    assert.equal(response.status, 200, `Linked resource ${path}`)
    const type = response.headers.get('content-type') ?? ''
    if (!/text\/(html|css)/.test(type)) continue
    const source = await response.text()
    if (type.includes('html')) documents.set(path, source)
    const links = type.includes('html') ? [...source.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&')) : [...source.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map(match => match[1])
    for (const link of links) {
      const url = new URL(link, origin + path)
      if (url.origin !== origin) continue
      assert.ok(!/^\/(?:app|setup|signin|auth)(?:\/|$)/.test(url.pathname), `Run-site link stays public: ${link}`)
      if (url.hash) anchors.push(url)
      queue.push(url.pathname)
    }
  }
  for (const url of anchors) assert.ok(documents.get(url.pathname)?.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Fragment exists: ${url.pathname}${url.hash}`)
  assert.ok(documents.has('/run'), 'Homepage reaches the run instructions')
  assert.ok(documents.has('/docs'), 'Homepage reaches repository documentation')
  assert.ok([...documents.keys()].some(path => path.startsWith('/docs/')), 'Docs navigation reaches the guides')
  // BOUNDARY-005: every provider the code can reach has a section with its data flows and terms.
  const mailCode = await readFile('src/mail.server.mjs', 'utf8')
  const mail = JSON.parse(mailCode.match(/if \(!(\[[^\]]+\])\.includes\(env\.MAIL_PROVIDER\)\)/)[1].replaceAll("'", '"'))
  const mailNames = { resend: 'Resend', sendgrid: 'SendGrid', cloudflare: 'Cloudflare Email' }
  const { PRESETS } = await import(pathToFileURL(resolve('src/modules/operator-auth/identity/oidc/presets.mjs')).href)
  const connectorCode=(await readFile('src/buoy/connectors/stripe.ts','utf8'))+(await readFile('src/buoy/migrate/totango-api.ts','utf8'))
  const aiCode=await readFile('src/buoy/ai/index.ts','utf8')
  const aiNames={anthropic:'Anthropic',openai:'OpenAI'}
  const modelProviders=[...new Set([...aiCode.matchAll(/https:\/\/api\.([a-z]+)\.com/g)].map(match=>aiNames[match[1]]??match[1]))]
  const connectorProviders=[...new Set([...connectorCode.matchAll(/https:\/\/api\.([a-z]+)\.com/g)].map(match=>match[1][0].toUpperCase()+match[1].slice(1)))]
  const providers = [...modelProviders,...connectorProviders, 'Segment', 'Cloudflare', ...mail.map(id => mailNames[id] ?? id), ...Object.values(PRESETS).map(preset => preset.label)]
  const guide = documents.get('/docs/providers') ?? ''
  assert.match(guide, /SOC 2 or similar attestations cover your deployment/, 'BOUNDARY-005: certifications are the deployment\'s')
  for (const name of providers) {
    const section = guide.split(/<h3[^>]*>/).find(part => part.startsWith(`${name}</h3>`))
    assert.ok(section, `BOUNDARY-005: the providers guide has a section for ${name}`)
    for (const label of ['When:', 'Sends:', 'Receives:', 'Terms:']) assert.ok(section.includes(label), `BOUNDARY-005: ${name} lists ${label}`)
    if (name !== 'Auth' && name !== 'Company') assert.match(section.split('Terms:')[1], /href="https:\/\/[^"]+"/, `BOUNDARY-005: ${name} links its provider terms`)
  }
  // The buyer's relay is an incoming door, so it is absent from the provider-origin inventory.
  // Check its served article against the owner's expected responsibilities independently of the Markdown.
  const relay = guide.match(/<h3[^>]*>In-app relay<\/h3>([\s\S]*?)(?=<h[23]\b|$)/)?.[1]
  assert.ok(relay, 'BOUNDARY-005: the built guide explains the buyer-operated in-app relay')
  const relayFields = new Map([...relay.matchAll(/<li><strong>(When|Sends|Receives|Terms):<\/strong>([\s\S]*?)<\/li>/g)]
    .map(([, label, html]) => [label, html.replace(/<[^>]*>/g, '').replaceAll('&#39;', "'").replaceAll('&amp;', '&').replace(/\s+/g, ' ').trim()]))
  const relayExpectations = {
    When: [
      [/browser sends same-origin JSON POST actions to your product server/, 'browser actions stay on the buyer product'],
      [/server authenticates the real product session and current account membership/, 'the product server authenticates current membership'],
      [/separate server-only in-app credential.*Buoy delivery or submit receipts/, 'Buoy requests use a separate server credential'],
      [/browser holds no Buoy credential/, 'no Buoy credential reaches the browser'],
      [/exact administrator-reviewed source.user.group mapping.*existing customer person.*current account membership.segment/, 'targeting uses the exact reviewed source, user and group'],
      [/unknown or conflicting identities receive no targeted content/, 'unreviewed identities receive no targeted content'],
    ],
    Sends: [
      [/relay sends validated user.group identity claims to Buoy, replacing browser-supplied identities/, 'the relay replaces untrusted browser identities'],
      [/campaign ID, delivery ID when mapped, exact message ID and view, completion or dismissal kind/, 'receipts identify the campaign, delivery, message and all three kinds'],
      [/stores receipt observations with source provenance and instants.*attributes only through the reviewed mapping.*advances the mapped account revision/, 'receipt custody preserves provenance and reviewed attribution'],
      [/Buoy makes no outbound call to the relay or a new third-party provider/, 'Buoy never calls a relay provider'],
    ],
    Receives: [
      [/relay receives eligible announcement, banner, checklist or walkthrough content.*plain-text title, body and steps.*campaign and delivery IDs.*returns that content to the product browser/, 'eligible campaign content returns through the relay'],
      [/Receipt submissions receive stored.accepted.duplicate counts or an error/, 'receipt responses distinguish storage, acceptance, duplicates and errors'],
      [/reservation is not a view.*stored receipt is not proof of hosted delivery, provider verification or verified attention/, 'reservations and receipts do not certify delivery or attention'],
    ],
    Terms: [
      [/your buyer-operated server, not a third-party provider with separate provider terms/, 'the relay has no invented third-party terms'],
      [/own hosting and product.source agreements apply/, 'buyer hosting and source agreements still apply'],
      [/operate, authenticate and secure the relay and browser deployment, keep the credential server-side/, 'the buyer secures and deploys the relay'],
      [/copies retained by your product, relay or source as external holders.*erasure in Buoy does not delete those copies/, 'external copies remain the buyer and source responsibility'],
      [/data flows and responsibilities, not legal acceptance or certification/, 'the guide makes no legal or certification claim'],
    ],
  }
  for (const [label, expectations] of Object.entries(relayExpectations)) {
    assert.ok(relayFields.has(label), `BOUNDARY-005: the relay lists ${label}`)
    for (const [pattern, outcome] of expectations) assert.match(relayFields.get(label), pattern, `BOUNDARY-005: ${outcome}`)
  }
  assert.deepEqual([...relay.matchAll(/href="([^"]+)"/g)].map(match => match[1]).sort(), [
    'https://www.cloudflare.com/cloudflare-customer-dpa/', 'https://www.cloudflare.com/terms/',
  ], 'BOUNDARY-005: relay terms link only to the existing deployment host, with no fabricated relay provider')
  assert.equal((await fetch(origin + '/does-not-exist')).status, 404, 'Unknown route is a 404')
  console.log(`Run-site journey passed: ${documents.size} public documents, ${checked.size} linked resources, all fragments resolve`)
} finally {
  worker.kill('SIGTERM')
  await new Promise(resolve => worker.exitCode !== null ? resolve() : worker.once('exit', resolve))
  await rm(directory, { recursive: true, force: true })
}
