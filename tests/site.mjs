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
  const connectorCode=await readFile('src/buoy/connectors/stripe.ts','utf8')
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
  assert.equal((await fetch(origin + '/does-not-exist')).status, 404, 'Unknown route is a 404')
  console.log(`Run-site journey passed: ${documents.size} public documents, ${checked.size} linked resources, all fragments resolve`)
} finally {
  worker.kill('SIGTERM')
  await new Promise(resolve => worker.exitCode !== null ? resolve() : worker.once('exit', resolve))
  await rm(directory, { recursive: true, force: true })
}
