import assert from 'node:assert/strict'

// The CLI supplies a fresh native claim. Complete the ordinary first-run form
// using its resulting session before returning that same session response.
export default async function initialize({request, origin, claim, displayName, returnTo}) {
 const bootstrap = await request(new URL(claim.path, origin).href, {
  method: 'POST', redirect: 'manual', headers: {Origin: origin, 'Content-Type': 'application/json'},
  body: JSON.stringify({token: claim.token, displayName, returnTo}),
 })
 assert.equal(bootstrap.status, 303, 'Native owner claim issues its session')
 const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
 assert.ok(cookie, 'Native owner claim has a session cookie')
 const setup = await request(new URL('/setup', origin).href, {
  method: 'POST', redirect: 'manual', headers: {Origin: origin, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded'},
  body: 'confirm=yes',
 })
 assert.equal(setup.status, 303, 'Owner completes the native first-run form')
 await setup.body?.cancel()
 return bootstrap
}
