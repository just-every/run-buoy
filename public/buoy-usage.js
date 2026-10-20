// Browser ES module. Send only to your product's authenticated, same-origin relay.
const types = new Set(['track', 'identify', 'group', 'event'])

export class UsageError extends Error {
  constructor(message, { status = 0, details, cause } = {}) {
    super(message, { cause })
    this.name = 'UsageError'
    this.status = status
    this.details = details
  }
}

function message(input, type = input?.type) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('A usage message must be an object.')
  if (!types.has(type)) throw new TypeError('Usage type must be track, identify, group or event.')
  if (input.type !== undefined && input.type !== type) throw new TypeError('Usage type does not match the method.')
  return {
    ...input, type,
    messageId: input.messageId === undefined ? crypto.randomUUID() : input.messageId,
    timestamp: input.timestamp === undefined ? new Date().toISOString() : input.timestamp,
  }
}

function batch(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 500) throw new RangeError('A batch contains 1–500 usage messages.')
  return { batch: messages.map(input => message(input)) }
}

export class BuoyUsage {
  #relay

  constructor(options) {
    if (arguments.length !== 1 || !options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'relay')) {
      throw new TypeError('Browser usage accepts only {relay: "/your-authenticated-relay"}; credentials belong on your server.')
    }
    const { relay } = options
    if (typeof relay !== 'string' || !relay.startsWith('/') || relay.startsWith('//') || /[\\?#\s]/.test(relay)) {
      throw new TypeError('relay must be a same-origin absolute path without a query or fragment.')
    }
    const url = new URL(relay, location.origin)
    if (url.origin !== location.origin || /^\/api\/buoy\/usage\/intake(?:\/|$)/.test(url.pathname)) {
      throw new TypeError('Use your product’s authenticated same-origin relay, never the Buoy intake endpoint.')
    }
    this.#relay = url.pathname
  }

  async #send(payload) {
    const body = JSON.stringify(payload)
    if (new TextEncoder().encode(body).byteLength > 256000) throw new RangeError('Usage request exceeds 256 KB (256000 bytes).')
    const response = await fetch(this.#relay, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body,
    })
    let data
    try { data = await response.json() }
    catch (cause) { throw new UsageError(`Usage relay returned invalid JSON (${response.status}).`, { status: response.status, cause }) }
    if (!response.ok) throw new UsageError(typeof data?.error === 'string' ? data.error : `Usage relay refused the request (${response.status}).`, { status: response.status, details: data })
    return data
  }

  async track(input) { return this.#send(message(input, 'track')) }
  async identify(input) { return this.#send(message(input, 'identify')) }
  async group(input) { return this.#send(message(input, 'group')) }
  async event(input) { return this.#send(message(input, 'event')) }
  async batch(messages) { return this.#send(batch(messages)) }
}

export const createUsageClient = options => new BuoyUsage(options)
export default BuoyUsage
