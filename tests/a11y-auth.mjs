// A11Y-001: the shipped entry screens, ordinary sign-in and first-run keyboard flow.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startWorker } from './worker.mjs'
import { focused, type, submit, scan } from './a11y-checks.mjs'

export async function authJourney(browser) {
 for (const width of [1440, 390]) {
  const app = await startWorker({ completeSetup: false })
  try {
   const context = await browser.newContext({ viewport: { width, height: 1000 }, ignoreHTTPSErrors: true })
   try {
    const page = await context.newPage()
    const capture = async state => { await mkdir('../screens', {recursive:true}); await page.screenshot({path:`../screens/a11y-${state}-${width}.png`,fullPage:true}) }
    await page.goto(app.origin, { waitUntil: 'networkidle' })
    await scan(page, `Lobby ${width}`)
    await capture('lobby')
    await focused(page, page.getByRole('link', { name: /sign in/i }).first(), `Lobby sign-in link ${width}`)
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.keyboard.press('Enter')])
    await type(page, page.getByRole('textbox', { name: /email/i }), 'owner@example.test')
    await scan(page, `Sign-in ${width}`)
    await capture('signin')
    await submit(page, page.locator('form').getByRole('button'))
    assert.match(new URL(page.url()).search, /notice=sent/, 'A11Y-001 keyboard submits an ordinary sign-in request')
    await scan(page, `Sign-in requested ${width}`)
    const mail = app.mails.findLast(message => message.to.includes('owner@example.test'))
    assert.ok(mail, 'A11Y-001 ordinary sign-in reaches the configured mail edge')
    const link = new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'))
    assert.equal(link.origin, app.origin)
    await page.goto(link.href, {waitUntil:'networkidle'})
    await scan(page, `Sign-in confirmation ${width}`)
    await capture('confirm')
    await submit(page, page.locator('form').getByRole('button'))
    const session = await page.request.get(app.origin + '/auth/session')
    assert.equal(session.status(), 200, 'A11Y-001 keyboard confirmation establishes a native session')
    assert.equal((await session.json()).operator.email, 'owner@example.test')
    await page.goto(app.origin + '/setup', { waitUntil: 'networkidle' })
    await scan(page, `First-run setup ${width}`)
    await capture('setup')
    const confirmation = page.getByRole('checkbox')
    await focused(page, confirmation, `Setup confirmation ${width}`)
    await page.keyboard.press('Space')
    assert.ok(await confirmation.isChecked(), 'A11Y-001 keyboard checks owner confirmation')
    await submit(page, page.getByRole('button', { name: 'Finish setup' }))
    assert.equal(new URL(page.url()).pathname, '/app', 'A11Y-001 keyboard finishes setup and enters the product')
   } finally { await context.close() }
  } finally { await app.close() }
 }
}
