import assert from 'node:assert/strict'

// Only the disposable installation's authenticated HTTP doors are available.
export function personApi({request, origin, cookie}) {
 return async (path, method = 'GET', body, status = 200) => {
  const response = await request(new URL('/api/buoy' + path, origin).href, {
   method, redirect: 'manual', headers: {Origin: origin, Cookie: cookie, 'Content-Type': 'application/json'},
   ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  })
  assert.equal(response.status, status, `Native ${method} ${path} returned HTTP ${response.status}`)
  return response.json()
 }
}
