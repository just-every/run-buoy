import { apiCall, ApiError } from './actions';
import { button, date, disclosure, escape, field, form, hidden, pathId, section, textarea, valueOf } from './html';
import { canManage, type Api, type Fields, type State } from './types';

type FieldType = 'text' | 'number' | 'currency' | 'date' | 'picklist' | 'multi-select' | 'boolean' | 'formula';
interface Definition { key: string; label: string; type: FieldType; options?: string[]; formula?: string }
interface RecordValues { id: string; kind: 'contact' | 'user'; name: string; values: Record<string, unknown>; explanations: Record<string, string> }
interface CustomerPerson extends RecordValues { accountIds: string[]; revision: string; createdAt: string }
interface AccountPreview { id: string; name: string; revision: string; records: RecordValues[] }
export interface CustomerPeoplePage {
  definitions: Definition[]; records: CustomerPerson[]; accounts: AccountPreview[];
  history: { personId: string; key: string; oldValue: unknown; newValue: unknown; actor: string; source: string; recordedAt: string }[];
  fields: Record<string, string>;
}
export interface CustomerFieldPreview {
  definition: Definition; records: RecordValues[]; accounts: AccountPreview[]; totalRecords: number; totalAccounts: number;
}
const path = '/app/customer-people';
const labels: Record<FieldType, string> = { text: 'Text', number: 'Number', currency: 'Currency', date: 'Date', picklist: 'Picklist', 'multi-select': 'Multi-select', boolean: 'Boolean', formula: 'Formula' };
const json = (value: unknown) => JSON.stringify(value, null, 2);
const raw = (value: unknown) => value === undefined || value === null ? 'Not recorded' : `<code>${escape(JSON.stringify(value))}</code>`;
const personPath = (id: string) => `${path}?person=${pathId(id)}`;
const accountLink = (account: { id: string; name: string }) => `<a href="/app/accounts/${pathId(account.id)}">${escape(account.name)}</a>`;
const action = (id: string, content: string, target = path) => form(id, target, content);

function definitionDetails(definition: Definition): string {
  return `<dl><dt>Key</dt><dd><code>${escape(definition.key)}</code></dd><dt>Type</dt><dd>${escape(labels[definition.type])}</dd>`
    + (definition.options ? `<dt>Options</dt><dd>${definition.options.map(escape).join(', ')}</dd>` : '')
    + (definition.type === 'formula' ? `<dt>Formula</dt><dd><code>${escape(definition.formula)}</code></dd>` : '') + '</dl>';
}
function valueList(definitions: Definition[], record: RecordValues): string {
  if (!definitions.length) return '<p>No customer fields defined yet.</p>';
  return `<dl>${definitions.map(definition => {
    const value = record.values[definition.key];
    const rendered = value === null || value === undefined ? 'Not recorded' : definition.type === 'boolean' ? (value ? 'Yes' : 'No') : definition.type === 'date' && typeof value === 'string' ? date(value) : typeof value === 'object' ? raw(value) : escape(value);
    return `<dt>${escape(definition.label)} <span class="record-meta">(${escape(labels[definition.type])})</span></dt><dd>${rendered}${record.explanations[definition.key] ? `<p>${escape(record.explanations[definition.key])}</p>` : ''}</dd>`;
  }).join('')}</dl>`;
}
function memberships(accounts: AccountPreview[], mine?: Fields, current: string[] = []): string {
  return '<fieldset><legend>Account memberships</legend><p>Select every account this customer belongs to.</p>'
    + accounts.map(account => `<label><input type="checkbox" name="account:${escape(account.id)}"${(mine ? mine['account:' + account.id] === 'on' : current.includes(account.id)) ? ' checked' : ''}>${escape(account.name)}</label>`).join('') + '</fieldset>';
}
function personForm(data: CustomerPeoplePage, person?: CustomerPerson, fields?: Fields): string {
  const mine = fields?.action === 'customer-person-save' && (fields.personId || '') === (person?.id || '') ? fields : undefined;
  const v = (name: string, initial: unknown = '') => valueOf(mine, name, initial);
  const id = person ? `customer-person-${person.id}` : 'customer-person-create';
  return disclosure(person ? 'Edit customer record' : 'Create a contact or user', 'Record a customer and explicit account memberships.',
    action(id, hidden('action', 'customer-person-save') + (person ? hidden('personId', person.id) + hidden('revision', v('revision', person.revision)) : '')
      + `<div class="form-grid">${field('name', 'Customer name', v('name', person?.name))}<label>Record kind<select name="kind" required>${[['contact', 'Contact'], ['user', 'User']].map(([key, label]) => `<option value="${key}"${v('kind', person?.kind ?? 'contact') === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div>`
      + memberships(data.accounts, mine, person?.accountIds)
      + field('source', 'Source reference', v('source')) + button(person ? 'Save customer record' : 'Create customer record'), person ? personPath(person.id) : path),
    person ? `edit-customer-person-${person.id}` : 'create-customer-person', !!mine);
}
function definitionForm(fields?: Fields): string {
  const mine = fields?.action === 'customer-field-definition' ? fields : undefined;
  const v = (name: string) => valueOf(mine, name);
  return disclosure('Create a customer field', 'Typed fields apply to customer contacts and users.', action('customer-field-definition', hidden('action', 'customer-field-definition')
    + `<div class="form-grid">${field('key', 'Field key', v('key'))}${field('label', 'Field label', v('label'))}<label>Field type<select name="type" required>${Object.entries(labels).map(([type, label]) => `<option value="${type}"${v('type') === type ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div>`
    + textarea('options', 'Options (one per line; picklist and multi-select)', v('options'), false)
    + textarea('formula', 'Formula (formula fields only)', v('formula'), false, 'spellcheck="false"')
    + '<p>Use <code>custom.field_key</code> for customer field inputs. Arithmetic, comparisons, lazy <code>if</code>, UTC date differences and explicit portfolio rollups calculate read-only values with explanations. Missing inputs and division by zero produce no value.</p>'
    + button('Create customer field')), 'create-customer-field', !!mine);
}
function previewForm(fields?: Fields): string {
  const mine = fields?.action === 'customer-field-preview' ? fields : undefined;
  return section('Preview a customer field', '<p>Enter a JSON object with <code>key</code>, <code>label</code> and <code>type</code>; include <code>options</code> for choices or <code>formula</code> for calculated fields. Preview evaluates the full customer portfolio and shows up to ten real records and ten real accounts without saving.</p>'
    + action('customer-field-preview', hidden('action', 'customer-field-preview') + textarea('definition', 'Customer field definition (JSON object)', valueOf(mine, 'definition'), true, 'spellcheck="false"') + button('Preview customer field')));
}
function previewResult(data: CustomerPeoplePage, preview: CustomerFieldPreview): string {
  const definitions = [...data.definitions.filter(definition => definition.key !== preview.definition.key), preview.definition];
  return section('Unsaved customer field preview', `<p role="status">Nothing has been saved. Showing ${preview.records.length} of ${preview.totalRecords} real customer records and ${preview.accounts.length} of ${preview.totalAccounts} real accounts.</p>`
    + `<h3>${escape(preview.definition.label)}</h3>${definitionDetails(preview.definition)}`
    + `<h3>Real customer records</h3><ul class="journal">${preview.records.map(record => `<li class="record"><h4>${escape(record.name)} · ${escape(record.kind)}</h4>${valueList(definitions, record)}</li>`).join('')}</ul>`
    + `<h3>Real accounts</h3><ul class="journal" id="customer-preview-accounts">${preview.accounts.map(account => `<li class="record"><h4>${accountLink(account)}</h4>${account.records.length ? account.records.map(record => `<h5>${escape(record.name)} · ${escape(record.kind)}</h5>${valueList(definitions, record)}`).join('') : '<p>No customer memberships recorded.</p>'}</li>`).join('')}</ul>`, 'customer-field-preview-result');
}
function valuesForm(data: CustomerPeoplePage, person: CustomerPerson, fields?: Fields): string {
  const manual = data.definitions.filter(definition => definition.type !== 'formula');
  if (!manual.length) return '';
  const mine = fields?.action === 'customer-field-values' && fields.personId === person.id ? fields : undefined;
  const current = Object.fromEntries(manual.filter(definition => Object.hasOwn(person.values, definition.key)).map(definition => [definition.key, person.values[definition.key]]));
  return disclosure('Edit customer field values', 'Preserve JSON types and record the source.', action(`customer-field-values-${person.id}`, hidden('action', 'customer-field-values') + hidden('personId', person.id) + hidden('revision', valueOf(mine, 'revision', person.revision))
    + '<p>Enter a JSON object keyed by field key. Omitted manual keys clear their values. Formula values are read-only. Use numbers for numeric fields, true/false for booleans, arrays for multi-selects, YYYY-MM-DD dates and <code>{"currency":"USD","amountMinor":100}</code> for currency without conversion.</p>'
    + `<p>Manual fields: ${manual.map(definition => `<code>${escape(definition.key)}</code> (${escape(labels[definition.type])})`).join(', ')}.</p>`
    + textarea('values', `Manual field values for ${person.name} (JSON object)`, valueOf(mine, 'values', json(current)), true, 'spellcheck="false"')
    + field('source', 'Source reference', valueOf(mine, 'source')) + button('Save customer field values'), personPath(person.id)), `edit-customer-field-values-${person.id}`, !!mine);
}
function history(data: CustomerPeoplePage, person: CustomerPerson | undefined): string {
  const rows = data.history.filter(entry => entry.personId === person?.id);
  return section('Customer field history', rows.length ? `<ol class="journal">${rows.map(entry => `<li class="record"><h3>${escape(data.definitions.find(definition => definition.key === entry.key)?.label ?? entry.key)}</h3><dl><dt>Field key</dt><dd><code>${escape(entry.key)}</code></dd><dt>Previous value</dt><dd>${raw(entry.oldValue)}</dd><dt>New value</dt><dd>${raw(entry.newValue)}</dd><dt>Actor</dt><dd>${escape(entry.actor)}</dd><dt>Recorded (UTC)</dt><dd><time datetime="${escape(entry.recordedAt)}">${escape(entry.recordedAt)}</time></dd><dt>Source reference</dt><dd>${escape(entry.source)}</dd></dl></li>`).join('')}</ol>` : '<p>No changes recorded for this customer.</p>', 'customer-field-history');
}
export function customerPeoplePage(data: CustomerPeoplePage, state: State, fields?: Fields, preview?: CustomerFieldPreview, selectedPersonId?: string): string {
  const manage = canManage(state), selected = data.records.find(record => record.id === selectedPersonId) ?? data.records[0];
  const selection = data.records.length ? `<form method="get" action="${path}"><label>Customer record<select name="person">${data.records.map(record => `<option value="${escape(record.id)}"${selected?.id === record.id ? ' selected' : ''}>${escape(record.name)} · ${escape(record.kind)}</option>`).join('')}</select></label>${button('Open customer record')}</form>` : '<p>No customer contacts or users recorded.</p>';
  return section('Customer contacts and users', '<p>Customer records carry explicit account memberships, typed evidence and calculated field explanations. Staff access remains managed in Team.</p>' + selection
    + (selected ? `<article class="record" id="customer-record"><h3>${escape(selected.name)} · ${escape(selected.kind)}</h3><p>Account memberships: ${selected.accountIds.map(id => data.accounts.find(account => account.id === id)).filter((account): account is AccountPreview => !!account).map(accountLink).join(', ') || 'None recorded'}</p>${valueList(data.definitions, selected)}${manage ? personForm(data, selected, fields) + valuesForm(data, selected, fields) : ''}</article>` : ''))
    + (manage ? personForm(data, undefined, fields) : '')
    + section('Customer field definitions', data.definitions.length ? `<ul class="journal">${data.definitions.map(definition => `<li class="record"><h3>${escape(definition.label)}</h3>${definitionDetails(definition)}</li>`).join('')}</ul>` : '<p>No customer fields defined yet.</p>')
    + (manage ? definitionForm(fields) + previewForm(fields) + (preview ? previewResult(data, preview) : '') : '') + history(data, selected)
    + section('Typed segment inputs', '<p>Customer field rules match accounts through their explicitly linked customer records. Numeric comparisons accept fractions; booleans use 1/0 and multi-selects use JSON array text. Pair currency and minor-unit amount conditions. <a href="/app/segments">Open segments</a>.</p><dl>' + Object.entries(data.fields).map(([key, type]) => `<dt><code>${escape(key)}</code></dt><dd>${escape(type)}</dd>`).join('') + '</dl>');
}
export async function mutateCustomerPeople(api: Api, request: Request, fields: Fields): Promise<{ redirect?: string; message?: string; saved?: string; customerFieldPreview?: CustomerFieldPreview }> {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new ApiError('This form must be submitted from this Buoy installation.', 403);
  const send = <T>(url: string, body: unknown, method = 'POST') => apiCall<T>(api, request, '/api/buoy/' + url, method, body);
  const parse = (text: string) => { try { return JSON.parse(text); } catch { throw new ApiError('Enter valid JSON.'); } };
  if (fields.action === 'customer-person-save') {
    const person = await send<{ id: string }>('customer-people' + (fields.personId ? '/' + pathId(fields.personId) : ''), { kind: fields.kind, name: fields.name, accountIds: Object.keys(fields).filter(key => key.startsWith('account:') && fields[key] === 'on').map(key => key.slice(8)), source: fields.source, ...(fields.personId ? { revision: fields.revision } : {}) }, fields.personId ? 'PUT' : 'POST');
    return { redirect: personPath(person.id), message: 'Customer record saved.', saved: fields.personId ? `customer-person-${fields.personId}` : 'customer-person-create' };
  }
  if (fields.action === 'customer-field-preview') return { customerFieldPreview: await send<CustomerFieldPreview>('customer-fields/preview', parse(fields.definition)) };
  if (fields.action === 'customer-field-definition') {
    await send('customer-fields', { key: fields.key, label: fields.label, type: fields.type, ...(['picklist', 'multi-select'].includes(fields.type) ? { options: fields.options.split(/\r?\n/).map(option => option.trim()).filter(Boolean) } : {}), ...(fields.type === 'formula' ? { formula: fields.formula } : {}) });
    return { redirect: path, message: 'Customer field saved.', saved: 'customer-field-definition' };
  }
  if (fields.action === 'customer-field-values') {
    await send('customer-people/' + pathId(fields.personId) + '/fields', { values: parse(fields.values), revision: fields.revision, source: fields.source }, 'PUT');
    return { redirect: personPath(fields.personId), message: 'Customer field values saved.', saved: `customer-field-values-${fields.personId}` };
  }
  throw new ApiError('This customer action is not available.');
}
