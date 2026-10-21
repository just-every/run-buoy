// Browser ES module. The host product authenticates every request at its relay.
const kinds = new Set(['announcement', 'banner', 'checklist', 'walkthrough'])
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200

function relayPath(relay) {
  if (typeof relay !== 'string' || !relay.startsWith('/') || relay.startsWith('//') || /[\\%?#\s]/.test(relay)) {
    throw new TypeError('relay must be a same-origin absolute path without a query or fragment.')
  }
  const url = new URL(relay, location.origin)
  if (url.origin !== location.origin || /^\/api\/buoy(?:\/|$)/.test(url.pathname)) throw new TypeError('Use your product’s authenticated same-origin relay.')
  return url.pathname
}

function messagesFrom(data) {
  if (!data || !Array.isArray(data.messages) || data.messages.some(message => !message || typeof message !== 'object'
    || !validId(message.id) || !validId(message.deliveryId) || !kinds.has(message.kind)
    || typeof message.title !== 'string' || typeof message.body !== 'string'
    || !Array.isArray(message.steps) || message.steps.some(step => typeof step !== 'string')
    || (['checklist', 'walkthrough'].includes(message.kind) && message.steps.length === 0))) {
    throw new Error('In-app delivery returned an invalid response.')
  }
  return data.messages
}

function showError(container, message) {
  const alert = container.ownerDocument.createElement('p')
  alert.setAttribute('role', 'alert')
  alert.textContent = message
  container.append(alert)
}

async function post(relay, payload) {
  let response
  try {
    response = await fetch(relay, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
  } catch { throw new Error('In-app service is unavailable.') }
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to see in-app messages.' : 'In-app request was refused.')
  try { return await response.json() } catch { throw new Error('In-app service returned invalid JSON.') }
}

async function sendReceipt(relay, message, kind) {
  const receipt = await post(relay, { action: 'receipt', campaignId: message.id, deliveryId: message.deliveryId, kind, messageId: crypto.randomUUID() })
  for (const key of ['received', 'accepted', 'duplicates', 'stored']) {
    if (!Number.isSafeInteger(receipt?.[key]) || receipt[key] < 0) throw new Error('In-app receipt was not confirmed.')
  }
  if (receipt.accepted + receipt.duplicates < 1) throw new Error('In-app receipt was not accepted.')
}

function renderMessage(container, relay, message) {
  const document = container.ownerDocument
  const element = (tag, text) => {
    const node = document.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }
  const section = element('section')
  const title = element('h2', message.title)
  title.id = `buoy-inapp-${crypto.randomUUID()}`
  section.setAttribute('aria-labelledby', title.id)
  section.append(title, element('p', message.body))
  const controls = []
  let viewed = false
  let busy = false
  let finished = false
  let ready = () => true
  const complete = element('button', 'Complete')
  complete.type = 'button'
  const dismiss = element('button', 'Dismiss')
  dismiss.type = 'button'
  const update = () => {
    for (const control of controls) control.disabled = !viewed || busy || finished
    complete.disabled = !viewed || busy || finished || !ready()
  }
  const finish = async kind => {
    if (!viewed || busy || finished || (kind === 'completion' && !ready())) return
    busy = true
    update()
    try {
      await sendReceipt(relay, message, kind)
      finished = true
      section.remove()
    } catch (error) { showError(section, error.message) }
    finally { busy = false; update() }
  }
  if (message.kind === 'checklist') {
    const list = element('ul')
    const checkboxes = message.steps.map(step => {
      const item = element('li')
      const label = element('label')
      const checkbox = element('input')
      checkbox.type = 'checkbox'
      checkbox.addEventListener('change', update)
      label.append(checkbox, document.createTextNode(` ${step}`))
      item.append(label)
      list.append(item)
      controls.push(checkbox)
      return checkbox
    })
    ready = () => checkboxes.every(checkbox => checkbox.checked)
    section.append(list)
  } else if (message.kind === 'walkthrough') {
    const progress = element('p')
    progress.setAttribute('role', 'status')
    const list = element('ol')
    const steps = message.steps.map(step => element('li', step))
    list.append(...steps)
    const next = element('button', 'Next')
    next.type = 'button'
    controls.push(next)
    let current = 0
    const advance = () => {
      steps.forEach((step, index) => { step.hidden = index !== current; step.setAttribute('aria-current', index === current ? 'step' : 'false') })
      list.start = current + 1
      progress.textContent = `Step ${current + 1} of ${steps.length}`
      next.hidden = current === steps.length - 1
      complete.hidden = current !== steps.length - 1
      update()
    }
    ready = () => current === steps.length - 1
    next.addEventListener('click', () => {
      if (!viewed || busy || finished || current >= steps.length - 1) return
      current += 1
      advance()
      if (current === steps.length - 1) complete.focus()
    })
    section.append(progress, list, next)
    advance()
  }
  controls.push(complete, dismiss)
  complete.addEventListener('click', () => { void finish('completion') })
  dismiss.addEventListener('click', () => { void finish('dismissal') })
  section.append(complete, dismiss)
  update()
  container.append(section)
  return sendReceipt(relay, message, 'view').then(() => { viewed = true; update() }).catch(error => { showError(section, error.message) })
}

export function createBuoyInapp(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['relay', 'container'].includes(key))) {
    throw new TypeError('In-app messages accept only {relay, container}; credentials belong on your server.')
  }
  const relay = relayPath(options.relay)
  const { container } = options
  if (!container || container.nodeType !== 1 || !container.ownerDocument || typeof container.replaceChildren !== 'function') throw new TypeError('container must be a DOM element.')
  let refreshing
  const refresh = () => {
    if (refreshing) return refreshing
    refreshing = (async () => {
      container.setAttribute('aria-busy', 'true')
      try {
        const messages = messagesFrom(await post(relay, { action: 'deliver' }))
        container.replaceChildren()
        await Promise.all(messages.map(message => renderMessage(container, relay, message)))
      } catch (error) { showError(container, error.message) }
      finally { container.removeAttribute('aria-busy'); refreshing = undefined }
    })()
    return refreshing
  }
  return { refresh }
}

export default createBuoyInapp
