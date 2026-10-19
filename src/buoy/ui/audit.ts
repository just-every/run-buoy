import { date, escape, field, section } from './html'

/** "Mon Oct 19, 2026, 11:15:04 am": a recorded moment as a US date and its UTC time; the ISO stamp stays in datetime. */
const utc = (value: string) => `${date(value)}, ${escape(new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }).format(new Date(value)).replace(/\s+/g, ' ').toLowerCase())}`

export interface AuditEntry { id: string; actor: string; action: string; subject: string; detail: string; occurredAt: string }
export interface AuditPage { entries: AuditEntry[]; nextOffset: number | null }
export function auditPage(result: AuditPage, query: URLSearchParams): string {
 const filters = `<form method="get" action="/app/audit"><div class="form-grid">${field('actor', 'Actor contains', query.get('actor') ?? '', 'text', false, 'maxlength="200"')}${field('action', 'Action contains', query.get('action') ?? '', 'text', false, 'maxlength="200"')}${field('subject', 'Subject contains', query.get('subject') ?? '', 'text', false, 'maxlength="200"')}${field('since', 'From date (UTC)', query.get('since') ?? '', 'date', false)}${field('until', 'Through date (UTC)', query.get('until') ?? '', 'date', false)}</div><button type="submit">Search audit</button><p><a href="/app/audit">Clear filters</a></p></form>`
 const records = result.entries.map(entry => `<article class="record"><h3>${escape(entry.action)}</h3><dl><dt>Actor</dt><dd>${escape(entry.actor)}</dd><dt>Time (UTC)</dt><dd><time datetime="${escape(entry.occurredAt)}">${utc(entry.occurredAt)}</time></dd><dt>Subject reference</dt><dd>${escape(entry.subject)}</dd></dl>${entry.detail ? `<p>${escape(entry.detail)}</p>` : ''}</article>`).join('')
 const next = new URLSearchParams(query); if (result.nextOffset !== null) next.set('offset', String(result.nextOffset))
 return section('Find recorded actions', '<p>Filters match literal text without regard to case. Date bounds include the whole UTC day. Newest entries appear first, up to 50 per page.</p>' + filters) + section('Audit entries', records || '<p>No recorded actions match these filters.</p>') + (result.nextOffset !== null ? `<p><a href="/app/audit?${escape(next.toString())}">Next entries</a></p>` : '')
}
