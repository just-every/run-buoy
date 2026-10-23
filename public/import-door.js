// Adapted from Base default-seed/public/import-door.js. One owner-session door
// handles original upload bytes, reviewed plans, native reconciliation and undo.
const element = id => document.getElementById('import-' + id)
const storageKey = 'buoy:import:plan'
let plan, busy = false, settingsLoaded = false
let migrationSource = ''
try { migrationSource = sessionStorage.getItem(storageKey + ':source') || '' } catch {}
const sourceForNamespace = namespace => /^buoy-migrate-(vitally|velaris|csv)-v1$/.exec(namespace)?.[1] || ''
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
function remember(id) { try { if (id) {sessionStorage.setItem(storageKey, id); sessionStorage.setItem(storageKey + ':source',migrationSource)} else sessionStorage.removeItem(storageKey) } catch {} }
function remembered() { try { return sessionStorage.getItem(storageKey) } catch { return null } }
async function request(path, body) {
  const response = await fetch('/api/operator/' + path, {
    credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', ...(path.startsWith('import/') && migrationSource ? {'x-buoy-import-source':migrationSource} : {}) }, body: JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    const error = new Error(data?.error || `Request failed (${response.status}). Reload and try again.`)
    error.data = data
    throw error
  }
  return data
}
const failureMessage = code => ({ import_door_apply_constraint: 'A record did not meet the destination’s rules.', import_door_apply_transient: 'The destination was temporarily unavailable.', import_door_apply_failed: 'The destination could not apply a record.' })[code] || String(code || 'The destination changed or rejected a record.').replaceAll('_', ' ')
const door = (action, body) => request('import/' + action, body)
const notice = text => { element('notice').textContent = text }
function items(id, values) {
  element(id).replaceChildren(...values.map(value => { const li = document.createElement('li'); li.textContent = value; return li }))
}
function summarize(value) {
  return value !== null && typeof value === 'object' ? Object.entries(value).map(([key, item]) => `${key}: ${summarize(item)}`).join(', ') : String(value)
}
const label = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())
function showError(error) {
  element('error').hidden = false
  element('error-message').textContent = failureMessage(error.message)
  // Named source refusals carry a safe reason and location, never source values.
  items('error-details', Object.entries(error.data?.details || {}).map(([key, value]) => `${label(key)}: ${summarize(value)}`))
  element('error').focus()
}
function syncApproval() { element('apply').disabled = busy || !plan || !element('confirmed').checked }
function showPlan(next) {
  plan = next
  remember(next.planId)
  element('review').hidden = false
  element('result').hidden = true
  element('confirmed').checked = false
  element('fingerprint').textContent = next.fingerprint
  element('counts').replaceChildren(...Object.entries({ ...next.summary, ...next.counts }).flatMap(([key, value]) => {
    const term = document.createElement('dt'), detail = document.createElement('dd')
    term.textContent = label(key); detail.textContent = summarize(value)
    return [term, detail]
  }))
  items('differences', Object.entries(next.differences).map(([key, values]) => `${label(key)}: ${values.length}${values.length ? ' · ' + values.map(value => {
    try { const [kind, id] = JSON.parse(value); return `${kind}: ${id}` } catch { return String(value) }
  }).join(', ') : ''}`))
  items('rejections', next.rejected?.length ? next.rejected.map(summarize) : ['No rejected records.'])
  const diagnostics = next.diagnostics || []
  const credentials = diagnostics.filter(item => item.code === 'CREDENTIAL_REMOVED')
  items('credentials', credentials.length ? credentials.map(summarize) : ['No credential removals reported.'])
  const other = diagnostics.filter(item => item.code !== 'CREDENTIAL_REMOVED')
  items('diagnostics', other.length ? other.map(summarize) : ['No other diagnostics reported.'])
  notice('Review the counts, differences, rejections and diagnostics. Nothing has been imported yet.')
}
async function history() {
  const { history: rows } = await request('import-history')
  const host = element('history')
  host.replaceChildren()
  if (!rows.length) { host.textContent = 'No approved imports yet.'; return }
  for (const entry of rows) {
    const section = document.createElement('section'), title = document.createElement('h3'), caption = document.createElement('p'), open = document.createElement('button')
    section.className = 'import-history-entry'
    title.textContent = label(entry.state.replaceAll('_', ' '))
    caption.textContent = `${entry.reviewer === entry.approvalRecordId ? 'Approved via Business by' : 'Approved by'} ${entry.owner} · ${new Date(entry.approvedAt).toLocaleString()}${entry.failureCode ? ' · ' + failureMessage(entry.failureCode) : ''}`
    open.type = 'button'; open.className = 'secondary'; open.textContent = 'Open import'
    open.addEventListener('click', () => { void run(async () => {
      migrationSource = sourceForNamespace(entry.namespace)
      plan = { planId: entry.planId, fingerprint: entry.fingerprint }
      remember(entry.planId)
      element('review').hidden = true; element('result').hidden = true
      await status()
      element('result-title').tabIndex = -1; element('result-title').focus()
    }) })
    section.append(title, caption, open); host.append(section)
  }
}
function showJob(data) {
  if (data.state === 'cancelled') {
    plan = undefined; remember(null)
    element('review').hidden = true; element('result').hidden = true
    notice('Interrupted import cancelled. Upload a new snapshot to begin again.')
    return
  }
  const job = data.job
  plan.jobStarted = true
  if (data.fingerprint) plan.fingerprint = data.fingerprint
  const reversed = ['undone', 'rolled_back', 'reversed', 'erased'].includes(job.state)
  const reversing = ['undoing', 'rolling_back'].includes(job.state)
  element('review').hidden = true
  element('result').hidden = false
  element('reconciliation').hidden = true
  element('result-title').textContent = job.state === 'completed' ? 'Import completed' : reversed ? 'Import undone' : job.state === 'failed' ? 'Import failed' : reversing ? 'Undo in progress' : 'Import in progress'
  element('result-description').textContent = job.state === 'failed'
    ? `This approval cannot be applied again. ${failureMessage(data.failureCode || job.error)} Undo any applied records, then upload and review a new plan.`
    : job.state === 'completed' ? 'The imported accounts are ready to inspect. Reconcile checks the native records. Undo protects later account edits and dependent work.'
    : reversed ? 'The reversal finished. Later native edits remain protected.' : reversing ? 'Continue undo to reverse the next batch.' : 'Progress is saved. Continue import to apply the next batch.'
  element('progress').textContent = typeof job.checkpoint === 'number' && typeof job.total === 'number' ? `${job.checkpoint} of ${job.total} records processed.` : `State: ${job.state.replaceAll('_', ' ')}.`
  element('result-approval').textContent = data.caption || ''
  element('result-fingerprint').textContent = plan.fingerprint || ''
  element('resume').hidden = !['queued', 'applying'].includes(job.state)
  element('reconcile').hidden = job.state !== 'completed'
  element('undo').hidden = reversed
  element('undo').textContent = reversing ? 'Continue undo' : 'Undo import'
}
async function status() {
  const data = await door('status', { planId: plan.planId })
  plan.fingerprint = data.fingerprint
  if (data.job) showJob(data)
  else {
    plan = undefined; remember(null)
    element('review').hidden = true; element('result').hidden = true
    notice('This plan has not been approved. Upload the snapshot again and review its plan before applying.')
  }
}
async function apply() {
  if (!plan?.fingerprint) throw new Error('Review a plan before applying an import.')
  plan.applyRequested = true
  for (let batch = 0; batch < 100; batch++) {
    const data = await door('apply', { planId: plan.planId, reviewedFingerprint: plan.fingerprint })
    showJob(data)
    if (!['queued', 'applying'].includes(data.job.state)) {
      notice(data.job.state === 'completed' ? 'Import completed. Reconcile the native records or choose Undo.' : 'The import stopped. Check its saved status.')
      await history(); return
    }
    notice(`Applying batch ${batch + 1}…`)
  }
  notice('Progress saved. Continue import to apply the next batches.')
}
async function run(action) {
  if (busy) return
  busy = true
  element('error').hidden = true
  const controls = [...document.querySelectorAll('#import-door button, #import-door input')].map(control => [control, control.disabled])
  for (const [control] of controls) control.disabled = true
  try { await action() }
  catch (error) {
    if (plan?.jobStarted || plan?.applyRequested) { try { await status() } catch { /* Keep the original refusal. */ } }
    showError(error)
  } finally {
    busy = false
    for (const [control, disabled] of controls) control.disabled = disabled
    element('settings-fields').disabled = !settingsLoaded
    syncApproval()
  }
}
element('upload').addEventListener('submit', event => {
  event.preventDefault()
  void run(async () => {
    const file = element('bundle').files[0]
    if (!file) throw new Error('Choose an account snapshot JSON file.')
    plan = undefined; remember(null)
    element('review').hidden = true; element('result').hidden = true
    const bytes = new Uint8Array(await file.arrayBuffer())
    const envelope = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
    migrationSource = envelope?.format === 'buoy-migration-v1' ? envelope.source : ''
    if (migrationSource && !['csv','vitally','velaris'].includes(migrationSource)) throw new Error('Unknown migration source.')
    const bundleSha256 = await hash(bytes), totalChunks = Math.ceil(bytes.length / 65536)
    if (!totalChunks) throw new Error('Choose a nonempty account snapshot JSON file.')
    let uploadId
    for (let index = 0; index < totalChunks; index++) {
      const chunk = bytes.slice(index * 65536, (index + 1) * 65536)
      let binary = ''; for (const byte of chunk) binary += String.fromCharCode(byte)
      const result = await door('uploads', { uploadId, name: file.name, bundleSha256, totalBytes: bytes.length, totalChunks, index, chunkSha256: await hash(chunk), base64: btoa(binary) })
      uploadId = result.uploadId
      notice(`Uploaded chunk ${index + 1} of ${totalChunks}.`)
    }
    showPlan(await door('plan', { uploadId, ...(element('catchup').checked ? { catchup: true } : {}) }))
  })
})
element('confirmed').addEventListener('change', syncApproval)
element('approve').addEventListener('submit', event => {
  event.preventDefault()
  if (!element('confirmed').checked) return
  void run(apply)
})
element('resume').addEventListener('click', () => { void run(apply) })
element('status').addEventListener('click', () => { void run(status) })
element('history-refresh').addEventListener('click', () => { void run(history) })
element('reconcile').addEventListener('click', () => { void run(async () => {
  const data = await door('reconcile', { planId: plan.planId })
  element('reconciliation').hidden = false
  element('reconcile-summary').textContent = data.ok ? 'Native records reconcile with this import.' : 'Reconciliation found differences. Inspect these records before continuing.'
  items('reconcile-details', Object.entries(data).filter(([key]) => !['planId', 'fingerprint', 'bundleSha256', 'ok'].includes(key)).map(([key, value]) => `${label(key)}: ${summarize(value)}`))
  notice(data.ok ? 'Reconciliation completed.' : 'Reconciliation found differences. Review the result below.')
}) })
element('undo').addEventListener('click', () => { void run(async () => {
  for (let batch = 0; batch < 100; batch++) {
    const data = await door('undo', { planId: plan.planId }); showJob(data)
    if (data.state === 'cancelled' || ['undone', 'rolled_back'].includes(data.job.state)) { notice('Import undone.'); await history(); return }
    notice(`Undoing batch ${batch + 1}…`)
  }
  notice('Undo progress saved. Choose Continue undo to reverse the next batches.')
}) })
async function settings() {
  const data = await request('import-settings')
  element('enabled').checked = data.enabled
  element('revocations').textContent = data.revokedKids.length ? 'Permanently revoked keys: ' + data.revokedKids.join(', ') : 'No revoked keys.'
  settingsLoaded = true
}
element('settings').addEventListener('submit', event => { event.preventDefault(); void run(async () => {
  const kid = element('revoked-key').value.trim()
  await request('import-settings', { enabled: element('enabled').checked, ...(kid ? { revokedKids: [kid] } : {}) })
  element('revoked-key').value = ''; await settings(); notice('Import settings saved.')
}) })
element('settings-refresh').addEventListener('click', () => { void run(settings) })
void run(async () => {
  const reads = await Promise.allSettled([settings(), history()])
  if (reads[0].status === 'rejected') element('revocations').textContent = 'Import settings could not be loaded. Reload settings to try again.'
  if (reads[1].status === 'rejected') element('history').textContent = 'Import history could not be loaded. Refresh history to try again.'
  const saved = remembered()
  if (saved) { plan = { planId: saved }; await status() }
})
