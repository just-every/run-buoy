// Exercise the emitted run site through Cloudflare's actual static-asset server.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir, mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Lexer } from 'marked'
import { chromium } from '@playwright/test'

const normalize = text => text.replace(/\s+/g, ' ').trim()
const textOf = tokens => tokens.map(token => token.tokens ? textOf(token.tokens) : token.text ?? '').join('')

// Read the canonical Markdown, never docsPages or the emitted article, for the
// expected content. Lexing preserves structure without using the site's renderer.
function guideContent(source) {
  const content = { headings: [], paragraphs: [], items: [], commands: [], code: [], links: [] }
  function walk(tokens) {
    for (const token of tokens) {
      if (token.type === 'heading') content.headings.push({ level: token.depth, text: normalize(textOf(token.tokens)) })
      if (token.type === 'paragraph') content.paragraphs.push(normalize(textOf(token.tokens)))
      if (token.type === 'list_item') content.items.push(normalize(textOf(token.tokens)))
      if (token.type === 'code') content.commands.push(token.text.trimEnd())
      if (token.type === 'codespan') content.code.push(normalize(token.text))
      if (token.type === 'link') content.links.push({ text: normalize(textOf(token.tokens)), href: token.href })
      if (token.tokens) walk(token.tokens)
      if (token.items) walk(token.items)
    }
  }
  walk(Lexer.lex(source))
  return content
}

async function checkGuides(origin, documents) {
  // Imports define the full owner-guide inventory, including the overview. A
  // dropped page must fail even if the remaining navigation still crawls cleanly.
  const renderer = await readFile('src/site/docs.ts', 'utf8')
  const sources = [...renderer.matchAll(/from '\.\.\/\.\.\/docs\/([^']+\.md)\?raw'/g)].map(match => match[1])
  assert.ok(sources.length, 'Owner guides have canonical Markdown sources')
  const guides = sources.map(file => ({ file, path: file === 'index.md' ? '/docs' : `/docs/${file.slice(0, -3)}` }))
  const emitted = ['/docs', ...(await readdir('dist/site/docs')).filter(file => file.endsWith('.html')).map(file => `/docs/${file.slice(0, -5)}`)]
  assert.deepEqual(emitted.sort(), guides.map(guide => guide.path).sort(), 'Every owner guide is emitted exactly once')
  const browser = await chromium.launch({ headless: true, ...(process.env.BUOY_CHROMIUM_PATH ? { executablePath: process.env.BUOY_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const page = await context.newPage()
    for (const guide of guides) {
      assert.ok(documents.has(guide.path), `Navigation reaches owner guide ${guide.path}`)
      const expected = guideContent(await readFile(`docs/${guide.file}`, 'utf8'))
      assert.ok(expected.headings.length && expected.paragraphs.length, `${guide.path} has an article to read`)
      assert.equal((await page.goto(origin + guide.path)).status(), 200, `Open owner guide ${guide.path}`)
      assert.equal(await page.locator('main article.docs-article').count(), 1, `${guide.path} has one article body`)
      const actual = await page.locator('main article.docs-article').evaluate(article => {
        const normalize = text => text.replace(/\s+/g, ' ').trim()
        const elements = selector => [...article.querySelectorAll(selector)]
        return {
          headings: elements('h1,h2,h3,h4,h5,h6').map(node => ({ level: Number(node.tagName.slice(1)), text: normalize(node.innerText) })),
          paragraphs: elements('p').map(node => normalize(node.innerText)),
          items: elements('li').map(node => normalize(node.innerText)),
          commands: elements('pre code').map(node => node.textContent.trimEnd()),
          code: elements(':not(pre) > code').map(node => normalize(node.innerText)),
          links: elements('a').map(node => ({ text: normalize(node.innerText), href: node.getAttribute('href') })),
          visible: article.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) && elements('h1,h2,h3,h4,h5,h6,p,li,pre,code,a').every(node => node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })),
        }
      })
      assert.ok(actual.visible, `${guide.path} article content is visible`)
      for (const field of Object.keys(expected)) assert.deepEqual(actual[field], expected[field], `${guide.path} renders its own ${field} from Markdown`)
      if (process.env.BUOY_SITE_SCREEN_DIR) {
        await mkdir(process.env.BUOY_SITE_SCREEN_DIR, { recursive: true })
        await page.screenshot({ path: join(process.env.BUOY_SITE_SCREEN_DIR, `${guide.file.slice(0, -3)}-1440.png`), fullPage: true })
      }
    }
    // Release captures are separate from the single-width content assertions.
    if (process.env.BUOY_SITE_SCREEN_DIR) {
      await page.setViewportSize({ width: 390, height: 900 })
      for (const guide of guides) {
        await page.goto(origin + guide.path)
        await page.screenshot({ path: join(process.env.BUOY_SITE_SCREEN_DIR, `${guide.file.slice(0, -3)}-390.png`), fullPage: true })
      }
    }
    console.log(`Owner-guide content passed: ${guides.length} articles, with headings, paragraphs, list items, commands, inline code and links`)
  } finally { await context.close(); await browser.close() }
}

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
  await checkGuides(origin, documents)
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
  assert.equal((await fetch(origin + '/does-not-exist')).status, 404, 'Unknown route is a 404')
  console.log(`Run-site journey passed: ${documents.size} public documents, ${checked.size} linked resources, all fragments resolve`)
} finally {
  worker.kill('SIGTERM')
  await new Promise(resolve => worker.exitCode !== null ? resolve() : worker.once('exit', resolve))
  await rm(directory, { recursive: true, force: true })
}
