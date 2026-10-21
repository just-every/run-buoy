import { majorAmount, minorUnitDigits } from '../currencies';
import type { Fields } from './types';

export function escape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export const pathId = (id: string) => encodeURIComponent(id);
export const hidden = (name: string, value: unknown) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;
const parse = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
const usDate = (value: string | null, options: Intl.DateTimeFormatOptions) => {
  if (!value) return 'Not recorded';
  const parsed = parse(value);
  return Number.isNaN(parsed.getTime()) ? escape(value) : escape(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(parsed).replace(/,(?= \w{3} )/, '').replaceAll(' ', '\u00a0'));
};
/** "Thu, Dec 31, 2026": calendar dates are UTC dates, as the domain stores them; a date never breaks across lines. */
export const date = (value: string | null) => usDate(value, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
/** "Thu Dec 31": the runway's own dates, whose year the axis carries. */
export const day = (value: string | null) => usDate(value, { weekday: 'short', month: 'short', day: 'numeric' });
/** "7:14 am" in the operator's Eastern day, for recorded moments. */
export const clock = (value: string) => escape(new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(value)).replace(/\s+/g, ' ').toLowerCase());
/** "$148,000": whole units when there are no minor units, with each currency's ISO 4217 exponent (DATA-001).
 * A code without a minor unit stays in minor units. */
export function money(minor: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  if (digits === undefined) return `${escape(minor)} minor units (${escape(currency)})`;
  const whole = minor % 10 ** digits === 0;
  return escape(new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: whole ? 0 : digits }).format(Number(majorAmount(minor, currency))));
}
export const healthLabel = (status: string) => status === 'at-risk' ? 'At risk' : status === 'healthy' ? 'Healthy' : status==='watch'?'Watch':'Unknown';
const glyph: Record<string, string> = { healthy: '✓', 'at-risk': '!', unknown: '?',watch:'•' };
/** The health band as an always-labelled pill: a coloured disc, then the band's name. */
export const pill = (status: string) => `<span class="pill ${escape(status)}"><i aria-hidden="true">${glyph[status] ?? '?'}</i>${healthLabel(status)}</span>`;
/** A heavy title followed by "· fact" items. Each separator rides at the start of its own fact, in the gap before it,
 * so a line never ends with "·"; the title line clips the one hanging past its left edge when a fact starts a line. */
export const titleLine = (heading: string, facts: string[], strong: number[] = [], lead = '', tone = '') => `<div class="title-line${tone ? ` ${tone}` : ''}"><h1>${heading}</h1>${lead}${facts.map((fact, index) => `<span class="fact${strong.includes(index) ? ' strong' : ''}"><span class="dot" aria-hidden="true">·</span>${fact}</span>`).join('')}</div>`;
export function field(name: string, label: string, value: unknown = '', type = 'text', required = true, extra = ''): string {
  return `<label>${escape(label)}<input name="${escape(name)}" type="${escape(type)}" value="${escape(value)}"${required ? ' required' : ''} ${extra}></label>`;
}
export const textarea = (name: string, label: string, value: unknown = '', required = true, extra = '') => `<label>${escape(label)}<textarea name="${escape(name)}" rows="4"${required ? ' required' : ''} ${extra}>${escape(value)}</textarea></label>`;
export const form = (id: string, action: string, content: string) => `<form id="${escape(id)}" method="post" data-draft action="${escape(action)}">${content}</form>`;
export const button = (label: string, danger = false) => `<button type="submit"${danger ? ' class="danger"' : ''}>${escape(label)}</button>`;
export const details = (id: string, title: string, data: unknown) => `<button class="secondary details-button" type="button" data-open="${escape(id)}">Details<span class="sr-only">: ${escape(title)}</span></button><dialog id="${escape(id)}" aria-labelledby="${escape(id)}-heading"><h2 id="${escape(id)}-heading">${escape(title)}</h2><pre>${escape(JSON.stringify(data, null, 2))}</pre><button type="button" data-close>Close details</button></dialog>`;
export const section = (title: string, body: string, id = '') => `<section class="panel"${id ? ` id="${escape(id)}"` : ''}><h2>${escape(title)}</h2>${body}</section>`;
/** A form card that stays closed until it is asked for (its link, its fragment or its own error). */
export const disclosure = (title: string, hint: string, body: string, id: string, open = false, tone = '') => `<details class="panel disclosure${tone ? ` ${tone}` : ''}" id="${escape(id)}"${open ? ' open' : ''}><summary><span class="disclosure-title">${escape(title)}</span><span class="disclosure-hint">${escape(hint)}</span></summary><div class="disclosure-body">${body}</div></details>`;
export const valueOf = (values: Fields | undefined, name: string, fallback: unknown = '') => values && name in values ? values[name] : fallback;
/** A choice of active people by display name, for owners, managers and cover. */
export const personSelect = (name: string, label: string, people: { id: string; displayName: string }[], chosen: unknown, prompt: string, required = true) => `<label>${escape(label)}<select aria-label="${escape(label)}" name="${escape(name)}"${required ? ' required' : ''}><option value="">${escape(prompt)}</option>${people.map(person => `<option value="${escape(person.id)}"${chosen === person.id ? ' selected' : ''}>${escape(person.displayName)}</option>`).join('')}</select></label>`;
