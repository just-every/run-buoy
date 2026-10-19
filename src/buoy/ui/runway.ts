import { band } from './band';
import { day, escape, money, pathId, pill } from './html';
import type { Account, State } from './types';

// The renewal runway: accounts as lanes on one time axis, each running to its
// renewal flag with its health along the lane (solid to today, dashed ahead as
// the evidence projects it). Positions are percentages of the axis, written as
// one generated stylesheet the shell hashes into its CSP (no inline styles).
const DAY = 86_400_000;
const ms = (value: string) => Date.parse(value.slice(0, 10));
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
function addMonths(value: string, months: number): string {
  const time = new Date(ms(monthStart(value)));
  time.setUTCMonth(time.getUTCMonth() + months, 1);
  return iso(time.getTime());
}
const later = (a: string, b: string) => a > b ? a : b;

export interface Axis { start: string; end: string; today: string }
/** From the first of this month (or up to two months back for a renewal already passed)
 * to the month after the last renewal: at least six months, at most eighteen. */
export function axisFor(accounts: Account[], today: string): Axis {
  const dates = [today, ...accounts.map(account => account.renewalDate)].sort();
  const start = monthStart(later(dates[0], addMonths(today, -2)));
  let end = later(addMonths(dates.at(-1)!, 1), addMonths(today, 6));
  if (end > addMonths(start, 18)) end = addMonths(start, 18);
  return { start, end, today };
}
/** "Q4 + Q1": the calendar quarters the axis covers. */
export function quarters(axis: Axis): string {
  const seen: string[] = [];
  for (let month = axis.start; month < axis.end; month = addMonths(month, 1)) {
    const quarter = `Q${Math.ceil(Number(month.slice(5, 7)) / 3)}`;
    if (!seen.includes(quarter)) seen.push(quarter);
  }
  return seen.join(' + ');
}

/** Generated placement rules: each positioned element gets its own class. */
export class Sheet {
  private rules: string[] = [];
  private count = 0;
  constructor(private axis: Axis) {}
  at(value: string): number {
    const span = ms(this.axis.end) - ms(this.axis.start);
    return Math.min(1, Math.max(0, (ms(value) - ms(this.axis.start)) / span)) * 100;
  }
  rule(body: string): string {
    const name = `x${this.count++}`;
    this.rules.push(`.rw .${name}{${body}}`);
    return name;
  }
  place(from: string, to?: string): string {
    const left = this.at(from);
    return this.rule(`left:${left.toFixed(3)}%${to ? `;width:${(this.at(to) - left).toFixed(3)}%` : ''}`);
  }
  get css(): string { return this.rules.join(''); }
}

const tints = ['plum', 'teal', 'blue', 'green', 'amber'];
const tint = (id: string) => tints[[...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % tints.length];
const initials = (name: string) => name.split(/\s+/).filter(word => /^[A-Za-z0-9]/.test(word)).slice(0, 2).map(word => word[0].toUpperCase()).join('');

function lane(account: Account, sheet: Sheet, axis: Axis, open: boolean, openHref: string): string {
  const today = axis.today, href = `/app/accounts/${pathId(account.id)}`;
  const seen = [account.billing?.observedAt, account.support?.observedAt].filter((value): value is string => !!value).map(value => value.slice(0, 10)).sort().at(-1);
  const marks: string[] = [];
  if (seen && account.renewalDate > axis.start) marks.push(`<i class="rw-seen ${account.health.status} ${sheet.place(later(seen, axis.start), today < account.renewalDate ? today : account.renewalDate)}"></i>`);
  account.outlook.forEach((segment, index) => {
    const to = account.outlook[index + 1]?.from ?? account.renewalDate;
    if (to > today) marks.push(`<i class="rw-ahead ${segment.status} ${sheet.place(later(segment.from, today), to)}"></i>`);
  });
  const inNotice = account.noticeDate < today && account.renewalDate >= today;
  const notice = sheet.place(account.noticeDate);
  marks.push(`<i class="rw-notice ${notice}" aria-hidden="true"></i><span class="rw-days ${notice}">${inNotice ? 'In notice' : `${escape(account.noticeDays)}d notice`}</span>`);
  const flag = sheet.place(account.renewalDate);
  marks.push(`<i class="rw-flag ${account.health.status} ${flag}" aria-hidden="true"></i><span class="rw-date ${flag}">${day(account.renewalDate)}</span>`);
  const label = `${escape(account.name)}: renews ${day(account.renewalDate)}, notice ${day(account.noticeDate)}`;
  return `<div class="rw-row"><div class="rw-who"><span class="rw-initials ${tint(account.id)}" aria-hidden="true">${escape(initials(account.name))}</span><a class="rw-name" href="${href}">${escape(account.name)}</a><span class="rw-money">${account.billing ? money(account.billing.totalMinor, account.billing.currency) : '<span class="rw-none">No invoice</span>'}</span>${pill(account.health.status)}<a class="rw-open" href="${openHref}" aria-expanded="${open}" aria-label="${open ? 'Close' : 'Open'} ${escape(account.name)} on the runway">${open ? '−' : '+'}</a></div><div class="rw-track" role="img" aria-label="${label}"><div class="rw-axis">${marks.join('')}</div></div></div>`;
}

function header(axis: Axis, sheet: Sheet, count: number): string {
  const months: string[] = [], weeks: string[] = [];
  for (let month = axis.start; month < axis.end; month = addMonths(month, 1)) {
    const name = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(ms(month))).toUpperCase();
    months.push(`<span class="rw-month ${sheet.place(month, addMonths(month, 1))}">${escape(name)}</span>`);
  }
  // Week ticks fall on Mondays, labelled with the day of the month under its month.
  let monday = ms(axis.start);
  while (new Date(monday).getUTCDay() !== 1) monday += DAY;
  for (; monday < ms(axis.end); monday += 7 * DAY) weeks.push(`<span class="rw-week ${sheet.place(iso(monday))}">${new Date(monday).getUTCDate()}</span>`);
  const today = sheet.place(axis.today);
  return `<div class="rw-head"><div class="rw-cols"><span>Account (${count})</span><span>Invoice</span><span>Health</span></div><div class="rw-scale"><div class="rw-axis"><p class="rw-today ${today}"><strong>Today</strong> ${day(axis.today)}</p>${months.join('')}${weeks.join('')}</div></div></div>`;
}

export interface RunwayView { html: string; css: string }
/** `open` names the one account expanded in place; by default the first at risk. */
export function runway(state: State, accounts: Account[], today: string, open: string | null | undefined, self = '/app', empty = ''): RunwayView {
  const axis = axisFor(accounts, today), sheet = new Sheet(axis);
  const openId = open === undefined ? accounts.find(account => account.health.status === 'at-risk')?.id : open;
  const rule = sheet.place(today);
  const lanes = accounts.map(account => {
    const isOpen = account.id === openId;
    const toggle = `${self}?open=${isOpen ? 'none' : encodeURIComponent(account.id)}#lane-${pathId(account.id)}`;
    const inNotice = account.noticeDate < today && account.renewalDate >= today;
    return `<li class="rw-lane ${account.health.status}${isOpen ? ' is-open' : ''}${inNotice ? ' in-notice' : ''}" id="lane-${escape(account.id)}">${lane(account, sheet, axis, isOpen, toggle)}${isOpen ? band(state, account, sheet, today) : ''}</li>`;
  }).join('');
  const html = `<section class="rw" id="accounts" aria-label="Renewal runway"><div class="rw-scroll" data-scroll-x tabindex="0" aria-label="Runway, scrolls sideways"><div class="rw-inner">${header(axis, sheet, accounts.length)}<div class="rw-body"><div class="rw-rules" aria-hidden="true"><div class="rw-axis"><i class="rw-rule ${rule}"></i></div></div>${accounts.length ? `<ol class="rw-lanes">${lanes}</ol>` : empty}</div></div></div></section>`;
  return { html, css: sheet.css };
}

