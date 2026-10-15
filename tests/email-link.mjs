import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queued=await queuedEntrypoint(import.meta.url,'verify:email-link');if(queued!==null)process.exit(queued);
// Real email-link flow against the emitted app; only Resend is a test double.
import assert from 'node:assert/strict'
import { startWorker } from './worker.mjs'
const worker = await startWorker()
try {
 const cookie = await worker.signIn('owner@example.test')
 const response = await worker.request('/auth/session', { cookie })
 assert.equal(response.status, 200)
 assert.equal((await response.json()).operator.email, 'owner@example.test')
 assert.equal((await worker.request('/__dev/outbox')).status, 404)
 assert.ok(worker.mails.length)
 console.log('Email-link sign-in passed: provider-edge mail, confirmation and native session; no development outbox.')
} finally { await worker.close() }
