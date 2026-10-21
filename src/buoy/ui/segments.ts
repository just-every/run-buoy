import { HEALTH_INTERPRETATION } from '../health';
import { button, disclosure, escape, field, form, hidden, pathId, pill, section, textarea, valueOf } from './html';
import { canManage, type Fields, type State } from './types';

export interface SegmentView {
  id: string; name: string; mode: 'dynamic' | 'static';
  rules: { match: 'all' | 'any'; conditions: { field: string; op: string; value?: unknown }[] };
  accountIds: string[]; tier: string | null; stage: string | null;
  playbook: { title: string; dueDays: number } | null; revision: string;
  members: { accountId: string; name: string; health: string; assessment: State['accounts'][number]['health']; tier: string | null; stage: string | null; enteredAt: string }[];
  history: { accountId: string; enteredAt: string; exitedAt: string | null; proposalId: string | null }[];
}
export interface SegmentsPage { tiers:string[]; fields: Record<string, 'text' | 'number'>; segments: SegmentView[] }

type Choice = readonly [string, string];
const tierChoices=(data:SegmentsPage):Choice[]=>data.tiers.map(name=>[name,name]);
const stages: Choice[] = [['onboarding', 'Onboarding'], ['adoption', 'Adoption'], ['expansion', 'Expansion'], ['renewal', 'Renewal'], ['churned', 'Churned']];
const select = (name: string, label: string, choices: Choice[], chosen: unknown, required = false) =>
  `<label>${escape(label)}<select name="${escape(name)}"${required ? ' required' : ''}>${choices.map(([value, text]) => `<option value="${escape(value)}"${chosen === value ? ' selected' : ''}>${escape(text)}</option>`).join('')}</select></label>`;
const accountLink = (id: string, name: string) => `<a href="/app/accounts/${pathId(id)}">${escape(name)}</a>`;
const timestamp = (value: string) => `<time datetime="${escape(value)}">${escape(value)}</time>`;

function ruleHelp(data: SegmentsPage): string {
  return '<p>Dynamic segments evaluate account evidence. Static segments use the account IDs you enter. Conditions are a JSON array of objects with <code>field</code>, <code>op</code>, and <code>value</code>. Use a JSON number for a number field and a JSON string for a text field; <code>is-missing</code> needs no value.</p>'
    + '<p>Operators: <code>eq</code>, <code>ne</code>, <code>gt</code>, <code>gte</code>, <code>lt</code>, <code>lte</code>, <code>contains</code>, <code>is-missing</code>. Missing or unknown evidence does not compare, including with <code>ne</code>; use <code>is-missing</code> to match it.</p>'
    + '<p>Adoption fields use the current UTC report windows through today, and the same reviewed mappings and current definitions as the adoption report. Ratios and elapsed seconds accept decimals; missing denominators only match is-missing. Related-person conditions in an all-rule must match one person. Segment aggregates are not rule inputs.</p>'
    + '<p>Invoice amounts are integer native currency minor units, never ARR. Pair a money condition with its currency field in an “all” rule so amounts in different currencies are not mixed.</p>'
    + `<dl>${Object.entries(data.fields).map(([name, type]) => `<dt><code>${escape(name)}</code></dt><dd>${escape(type)}</dd>`).join('')}</dl>`;
}

function segmentForm(data:SegmentsPage,segment: SegmentView | undefined, values?: Fields): string {
  const mine = values?.action === 'segment-save' && (values.segmentId || '') === (segment?.id || '');
  const v = (name: string, initial: unknown = '') => valueOf(mine ? values : undefined, name, initial);
  const id = segment ? `segment-edit-${segment.id}` : 'segment-create';
  return form(id, '/app/segments', hidden('action', 'segment-save')
    + (segment ? hidden('segmentId', segment.id) + hidden('revision', v('revision', segment.revision)) : '')
    + `<div class="form-grid">${field('name', 'Segment name', v('name', segment?.name))}${select('mode', 'Membership mode', [['dynamic', 'Dynamic rules'], ['static', 'Static account list']], v('mode', segment?.mode ?? 'dynamic'), true)}${select('match', 'Match conditions', [['all', 'All conditions'], ['any', 'Any condition']], v('match', segment?.rules.match ?? 'all'), true)}</div>`
    + textarea('conditions', 'Rule conditions (JSON array; dynamic mode)', v('conditions', JSON.stringify(segment?.rules.conditions ?? [], null, 2)), true, 'spellcheck="false"')
    + textarea('accountIds', 'Account IDs (comma-separated; static mode)', v('accountIds', segment?.accountIds.join(', ') ?? ''), false)
    + `<div class="form-grid">${select('tier', 'Rule tier (optional)', [['', 'No tier classification'], ...tierChoices(data)], v('tier', segment?.tier ?? ''))}${select('stage', 'Rule stage (optional)', [['', 'No stage classification'], ...stages], v('stage', segment?.stage ?? ''))}</div>`
    + `<div class="form-grid">${field('playbookTitle', 'Entry playbook title (optional)', v('playbookTitle', segment?.playbook?.title), 'text', false)}${field('dueDays', 'Playbook due in days', v('dueDays', segment?.playbook?.dueDays ?? 7), 'number', true, 'min="0" step="1"')}</div>`
    + '<p>Segment entry prepares one task proposal. Human approval is required: an owner or administrator approves the proposal on the account before a task is created.</p>'
    + button(segment ? 'Save segment' : 'Create segment'));
}

function classification(data:SegmentsPage,state: State, values?: Fields): string {
  const mine = values?.action === 'segment-classify';
  const v = (name: string, initial = '') => valueOf(mine ? values : undefined, name, initial);
  return section('Manual account classification', '<p>A manual tier or stage takes priority over segment rules. Choose “Return to segment rules” to clear that override, or “Explicitly unset” to keep the classification empty.</p>'
    + form('segment-classify', '/app/segments', hidden('action', 'segment-classify')
      + select('accountId', 'Account', [['', 'Choose an account'], ...state.accounts.map(account => [account.id, account.name] as Choice)], v('accountId'), true)
      + `<div class="form-grid">${select('tier', 'Manual tier', [['__rules__', 'Return to segment rules'], ['', 'Explicitly unset'], ...tierChoices(data)], v('tier', '__rules__'))}${select('stage', 'Manual stage', [['__rules__', 'Return to segment rules'], ['', 'Explicitly unset'], ...stages], v('stage', '__rules__'))}</div>`
      + button('Save account classification')));
}

function report(data:SegmentsPage,segment: SegmentView, state: State, values?: Fields): string {
  const members = segment.members;
  const counts = ['at-risk', 'healthy', 'unknown'].map(status => `${members.filter(member => member.health === status).length} ${status === 'at-risk' ? 'at risk' : status}`).join(' · ');
  const records = members.map(member => `<li class="record"><h3>${accountLink(member.accountId, member.name)}</h3><p>${pill(member.health)}</p><ul class="reasons">${member.assessment.reasons.map(reason => `<li>${escape(reason)}</li>`).join('')}</ul><dl><dt>Tier</dt><dd>${escape(member.tier ?? 'Unset')}</dd><dt>Stage</dt><dd>${escape(member.stage ?? 'Unset')}</dd><dt>Entered (UTC)</dt><dd>${timestamp(member.enteredAt)}</dd></dl></li>`).join('');
  const history = segment.history.map(interval => {
    const name = state.accounts.find(account => account.id === interval.accountId)?.name ?? interval.accountId;
    return `<li class="record">${accountLink(interval.accountId, name)}<dl><dt>Entered (UTC)</dt><dd>${timestamp(interval.enteredAt)}</dd><dt>Exited (UTC)</dt><dd>${interval.exitedAt ? timestamp(interval.exitedAt) : 'Current member'}</dd><dt>Entry proposal</dt><dd>${interval.proposalId ? `<a href="/app/accounts/${pathId(interval.accountId)}">Proposal ${escape(interval.proposalId)}</a>` : 'No proposal prepared'}</dd></dl></li>`;
  }).join('');
  const edit = canManage(state) ? disclosure('Edit segment', 'Change membership rules, classification or entry playbook.', segmentForm(data,segment, values), `edit-segment-${segment.id}`, values?.action === 'segment-save' && values.segmentId === segment.id) : '';
  return section(segment.name, `<p>${escape(segment.mode)} membership · ${members.length} members · ${counts}</p><p>Rule tier: ${escape(segment.tier ?? 'Unset')} · Rule stage: ${escape(segment.stage ?? 'Unset')}. Account reports show each account’s effective classification.</p>`
    + `<p><a href="/api/buoy/segments/${pathId(segment.id)}/report.csv">Download full segment report (CSV)</a></p>`
    + (records ? `<ul class="journal">${records}</ul>` : '<p>No accounts match this report.</p>')
    + disclosure('Membership history', 'Timestamped membership intervals and entry proposals.', history ? `<ul class="journal">${history}</ul>` : '<p>No membership changes recorded.</p>', `segment-history-${segment.id}`)
    + edit, `segment-${segment.id}`);
}

export function segmentsPage(data: SegmentsPage, state: State, fields?: Fields): string {
  return section('Segment reports', `<p>${escape(HEALTH_INTERPRETATION)}</p>` + '<p>Membership reports show current health, tier and stage. Rule classifications use the first matching segment in stable creation order; manual account overrides take priority.</p>')
    + (data.segments.length ? data.segments.map(segment => report(data,segment, state, fields)).join('') : '<p>No segments created yet.</p>')
    + (canManage(state) ? disclosure('Create a segment', 'Choose dynamic rules or a static account list.', segmentForm(data,undefined, fields), 'create-segment', fields?.action === 'segment-save' && !fields.id)
      + section('Service tier names', '<p>Define your own service tiers. Names in use by an account or segment must be reclassified before removal.</p>'+form('segment-tiers','/app/segments',hidden('action','segment-tiers')+textarea('tiers','Tier names (one per line)',fields?.action==='segment-tiers'?fields.tiers:data.tiers.join('\n'))+button('Save tier names'))) + section('Supported rule fields', ruleHelp(data)) + classification(data,state, fields) : '');
}
