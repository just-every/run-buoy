// Server ES module. Keep this file and its per-source credential out of browsers.
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
  #url
  #credential
  #fetch

  constructor(options) {
    if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new TypeError('The Buoy server SDK cannot run in a browser. Use the browser SDK with your authenticated relay.')
    if (arguments.length !== 1 || !options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['origin', 'sourceId', 'credential', 'fetch'].includes(key))) {
      throw new TypeError('Server usage requires {origin, sourceId, credential, fetch?}.')
    }
    const { origin, sourceId, credential, fetch: send = globalThis.fetch } = options
    if (typeof origin !== 'string') throw new TypeError('origin must be your Buoy HTTP(S) origin.')
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new TypeError('origin must contain only the Buoy HTTP(S) origin.')
    if (typeof sourceId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(sourceId)) throw new TypeError('sourceId must be a source ID containing letters, digits, hyphens or underscores.')
    if (typeof credential !== 'string' || !credential || /\s/.test(credential)) throw new TypeError('A server-only per-source credential is required.')
    if (typeof send !== 'function') throw new TypeError('A Fetch-compatible implementation is required.')
    this.#url = `${url.origin}/api/buoy/usage/intake/${encodeURIComponent(sourceId)}`
    this.#credential = credential
    this.#fetch = send
  }

  async #send(payload) {
    const body = JSON.stringify(payload)
    if (new TextEncoder().encode(body).byteLength > 256000) throw new RangeError('Usage request exceeds 256 KB (256000 bytes).')
    const response = await this.#fetch(this.#url, {
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { Authorization: `Bearer ${this.#credential}`, 'Content-Type': 'application/json' }, body,
    })
    let data
    try { data = await response.json() }
    catch (cause) { throw new UsageError(`Usage intake returned invalid JSON (${response.status}).`, { status: response.status, cause }) }
    if (!response.ok) throw new UsageError(typeof data?.error === 'string' ? data.error : `Usage intake refused the request (${response.status}).`, { status: response.status, details: data })
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
