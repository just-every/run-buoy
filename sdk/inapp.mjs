// Server ES module. Keep the dedicated in-app credential on the product server.
const receiptKinds = new Set(['view', 'completion', 'dismissal'])
const messageKinds = new Set(['announcement', 'banner', 'checklist', 'walkthrough'])
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const object = value => value && typeof value === 'object' && !Array.isArray(value)

export class InappError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message)
    this.name = 'InappError'
    this.status = status
  }
}

function identity(input) {
  if (!object(input) || !validId(input.userId) || (input.groupId !== undefined && !validId(input.groupId))) {
    throw new TypeError('A trusted userId and optional groupId are required.')
  }
  return { userId: input.userId, ...(input.groupId === undefined ? {} : { groupId: input.groupId }) }
}

function receipt(input) {
  const trusted = identity(input)
  if (!validId(input.campaignId) || !validId(input.messageId) || !receiptKinds.has(input.kind) || (input.deliveryId !== undefined && !validId(input.deliveryId))) {
    throw new TypeError('A receipt requires campaignId, messageId, kind and an optional deliveryId.')
  }
  return { ...trusted, campaignId: input.campaignId, messageId: input.messageId, kind: input.kind,
    ...(input.deliveryId === undefined ? {} : { deliveryId: input.deliveryId }) }
}

function result(data, action, status) {
  if (action === 'deliver') {
    if (!object(data) || !Array.isArray(data.messages) || data.messages.some(message => !object(message)
      || !validId(message.id) || !validId(message.deliveryId) || !messageKinds.has(message.kind)
      || typeof message.title !== 'string' || typeof message.body !== 'string'
      || !Array.isArray(message.steps) || message.steps.some(step => typeof step !== 'string')
      || (['checklist', 'walkthrough'].includes(message.kind) && message.steps.length === 0))) {
      throw new InappError('In-app delivery returned an invalid response.', { status })
    }
    return { messages: data.messages.map(({ id, kind, title, body, steps, deliveryId }) => ({ id, kind, title, body, steps, deliveryId })) }
  }
  const safe = {}
  for (const key of ['received', 'accepted', 'duplicates', 'stored']) {
    if (!Number.isSafeInteger(data?.[key]) || data[key] < 0) throw new InappError('In-app receipts returned an invalid response.', { status })
    safe[key] = data[key]
  }
  return safe
}

export class BuoyInapp {
  #origin
  #sourceId
  #credential
  #fetch

  constructor(options) {
    if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new TypeError('The in-app server SDK cannot run in a browser. Use your authenticated product relay.')
    if (arguments.length !== 1 || !object(options) || Object.keys(options).some(key => !['origin', 'sourceId', 'credential', 'fetch'].includes(key))) {
      throw new TypeError('Server in-app delivery requires {origin, sourceId, credential, fetch?}.')
    }
    const { origin, sourceId, credential, fetch: send = globalThis.fetch } = options
    let url
    try { url = typeof origin === 'string' ? new URL(origin) : null } catch { /* Report a safe configuration error below. */ }
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new TypeError('origin must contain only the Buoy HTTP(S) origin.')
    }
    if (typeof sourceId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(sourceId)) throw new TypeError('sourceId must be a source ID containing letters, digits, hyphens or underscores.')
    if (typeof credential !== 'string' || !/^buoy_inapp_[a-f0-9]{64}$/.test(credential)) throw new TypeError('A dedicated server-only in-app credential is required.')
    if (typeof send !== 'function') throw new TypeError('A Fetch-compatible implementation is required.')
    this.#origin = url.origin
    this.#sourceId = sourceId
    this.#credential = credential
    this.#fetch = send
  }

  async #send(action, payload) {
    const body = JSON.stringify(payload)
    if (new TextEncoder().encode(body).byteLength > 256000) throw new RangeError('In-app request exceeds 256000 bytes.')
    let response
    try {
      response = await this.#fetch(`${this.#origin}/api/buoy/inapp/${action === 'deliver' ? 'deliver' : 'receipts'}/${encodeURIComponent(this.#sourceId)}`, {
        method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { Authorization: `Bearer ${this.#credential}`, 'Content-Type': 'application/json' }, body,
      })
    } catch { throw new InappError('In-app delivery is unavailable.') }
    if (!response.ok) throw new InappError('In-app request was refused.', { status: response.status })
    let data
    try { data = await response.json() } catch { throw new InappError('In-app service returned invalid JSON.', { status: response.status }) }
    return result(data, action, response.status)
  }

  async deliver(input) { return this.#send('deliver', identity(input)) }
  async receipt(input) { return this.#send('receipt', receipt(input)) }
}

export const createInappClient = options => new BuoyInapp(options)
export default BuoyInapp
