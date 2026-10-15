import type { Fields } from './types';

export function escape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export const pathId = (id: string) => encodeURIComponent(id);
export const hidden = (name: string, value: unknown) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;
export const date = (value: string | null) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? escape(value) : escape(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed));
};
export function field(name: string, label: string, value: unknown = '', type = 'text', required = true, extra = ''): string {
  return `<label>${escape(label)}<input name="${escape(name)}" type="${escape(type)}" value="${escape(value)}"${required ? ' required' : ''} ${extra}></label>`;
}
export const textarea = (name: string, label: string, value: unknown = '', required = true, extra = '') => `<label>${escape(label)}<textarea name="${escape(name)}" rows="4"${required ? ' required' : ''} ${extra}>${escape(value)}</textarea></label>`;
export const form = (id: string, action: string, content: string) => `<form id="${escape(id)}" method="post" data-draft action="${escape(action)}">${content}</form>`;
export const button = (label: string, danger = false) => `<button type="submit"${danger ? ' class="danger"' : ''}>${escape(label)}</button>`;
export const details = (id: string, title: string, data: unknown) => `<button class="secondary details-button" type="button" data-open="${escape(id)}">Details<span class="sr-only">: ${escape(title)}</span></button><dialog id="${escape(id)}" aria-labelledby="${escape(id)}-heading"><h2 id="${escape(id)}-heading">${escape(title)}</h2><pre>${escape(JSON.stringify(data, null, 2))}</pre><button type="button" data-close>Close details</button></dialog>`;
export const section = (title: string, body: string, id = '') => `<section class="panel"${id ? ` id="${escape(id)}"` : ''}><h2>${escape(title)}</h2>${body}</section>`;
export const valueOf = (values: Fields | undefined, name: string, fallback: unknown = '') => values && name in values ? values[name] : fallback;
