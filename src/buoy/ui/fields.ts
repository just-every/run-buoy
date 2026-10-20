import { button, date, disclosure, escape, field, form, hidden, pathId, section, textarea, valueOf } from './html';
import { canManage, type Fields, type State } from './types';

type FieldType = 'text' | 'number' | 'currency' | 'date' | 'picklist' | 'multi-select' | 'boolean' | 'formula';
interface Definition { key: string; label: string; type: FieldType; options?: string[]; formula?: string }
interface AccountValues {
  id: string; name: string; values: Record<string, unknown>; explanations: Record<string, string>;
}
export interface FieldsPage {
  definitions: Definition[];
  accounts: (AccountValues & { revision: string })[];
  history: { accountId: string; key: string; oldValue: unknown; newValue: unknown; actor: string; source: string; recordedAt: string }[];
}
interface Preview { definition: Definition; accounts: AccountValues[] }

const labels: Record<FieldType, string> = {
  text: 'Text', number: 'Number', currency: 'Currency', date: 'Date', picklist: 'Picklist',
  'multi-select': 'Multi-select', boolean: 'Boolean', formula: 'Formula',
};
const json = (value: unknown) => JSON.stringify(value, null, 2);
const accountLink = (id: string, name: string) => `<a href="/app/accounts/${pathId(id)}">${escape(name)}</a>`;
const timestamp = (value: string) => `<time datetime="${escape(value)}">${escape(value)}</time>`;
const rawValue = (value: unknown) => value === undefined ? 'Not recorded' : `<code>${escape(JSON.stringify(value))}</code>`;

function typedValue(definition: Definition, value: unknown): string {
  if (value === null || value === undefined) return 'Not recorded';
  if (definition.type === 'boolean' && typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (definition.type === 'date' && typeof value === 'string') return date(value);
  return typeof value === 'object' ? rawValue(value) : escape(value);
}

function definitionDetails(definition: Definition): string {
  return `<dl><dt>Key</dt><dd><code>${escape(definition.key)}</code></dd><dt>Type</dt><dd>${escape(labels[definition.type])}</dd>`
    + (definition.options ? `<dt>Options</dt><dd>${definition.options.map(option => `<code>${escape(option)}</code>`).join(', ') || 'No options'}</dd>` : '')
    + (definition.type === 'formula' ? `<dt>Formula</dt><dd><code>${escape(definition.formula)}</code></dd>` : '') + '</dl>';
}

function valueList(definitions: Definition[], account: AccountValues): string {
  if (!definitions.length) return '<p>No custom fields defined yet.</p>';
  return `<dl>${definitions.map(definition => `<dt>${escape(definition.label)} <span class="record-meta">(${escape(labels[definition.type])})</span></dt>`
    + `<dd>${typedValue(definition, account.values[definition.key])}`
    + (account.explanations[definition.key] ? `<p>${escape(account.explanations[definition.key])}</p>` : '') + '</dd>').join('')}</dl>`;
}

function definitionForm(values?: Fields): string {
  const mine = values?.action === 'field-definition' ? values : undefined;
  const v = (name: string) => valueOf(mine, name);
  return disclosure('Create a field', 'Define the value type, available choices or formula.',
    form('field-definition', '/app/fields', hidden('action', 'field-definition')
      + `<div class="form-grid">${field('key', 'Field key', v('key'))}${field('label', 'Field label', v('label'))}`
      + `<label>Field type<select name="type" required>${Object.entries(labels).map(([type, label]) => `<option value="${escape(type)}"${v('type') === type ? ' selected' : ''}>${escape(label)}</option>`).join('')}</select></label></div>`
      + textarea('options', 'Options (one per line; picklist and multi-select)', v('options'), false)
      + textarea('formula', 'Formula (formula fields only)', v('formula'), false, 'spellcheck="false"')
      + '<p>Formula values are calculated from account evidence and include an explanation. They cannot be edited as manual values.</p>'
      + button('Create field')), 'create-field', !!mine);
}

function previewForm(values?: Fields, preview?: Preview): string {
  const mine = values?.action === 'field-preview' ? values : undefined;
  return section('Preview a field', '<p>Preview a definition on up to 10 real accounts you can access. Previewing does not save a definition or change account values.</p>'
    + '<p>Enter a JSON object with <code>key</code>, <code>label</code> and <code>type</code>. Include an <code>options</code> array for picklist or multi-select fields, or <code>formula</code> for a formula field.</p>'
    + form('field-preview', '/app/fields', hidden('action', 'field-preview')
      + textarea('definition', 'Field definition (JSON object)', valueOf(mine, 'definition', preview ? json(preview.definition) : ''), true, 'spellcheck="false"')
      + button('Preview field')));
}

function previewResult(data: FieldsPage, preview: Preview): string {
  const definitions = [...data.definitions.filter(definition => definition.key !== preview.definition.key), preview.definition];
  const accounts = preview.accounts.slice(0, 10);
  return section('Unsaved field preview', `<p role="status">Nothing has been saved. Showing ${accounts.length} real account${accounts.length === 1 ? '' : 's'} from your accessible accounts.</p>`
    + `<h3>${escape(preview.definition.label)}</h3>${definitionDetails(preview.definition)}`
    + (accounts.length ? `<ul class="journal">${accounts.map(account => `<li class="record"><h3>${accountLink(account.id, account.name)}</h3>${valueList(definitions, account)}</li>`).join('')}</ul>` : '<p>No accessible accounts are available for preview.</p>'), 'field-preview-result');
}

function valueForm(data: FieldsPage, account: FieldsPage['accounts'][number], values?: Fields): string {
  const manual = data.definitions.filter(definition => definition.type !== 'formula');
  if (!manual.length) return '';
  const mine = values?.action === 'field-values' && values.accountId === account.id ? values : undefined;
  const current = Object.fromEntries(manual.filter(definition => Object.hasOwn(account.values, definition.key)).map(definition => [definition.key, account.values[definition.key]]));
  const v = (name: string, initial: unknown = '') => valueOf(mine, name, initial);
  return disclosure('Edit field values', 'Record manual values with a source reference.',
    form(`field-values-${account.id}`, `/app/fields?account=${pathId(account.id)}`, hidden('action', 'field-values') + hidden('accountId', account.id) + hidden('revision', v('revision', account.revision))
      + '<p>Enter manual fields as a JSON object keyed by field key. Preserve JSON types: numbers, booleans and arrays for multi-select choices. Formula fields are read-only.</p>'
      + `<p>Manual field keys: ${manual.map(definition => `<code>${escape(definition.key)}</code> (${escape(labels[definition.type])})`).join(', ')}.</p>`
      + textarea('values', `Manual field values for ${account.name} (JSON object)`, v('values', json(current)), true, 'spellcheck="false"')
      + field('source', 'Source reference', v('source')) + button('Save field values')),
    `edit-field-values-${account.id}`, !!mine);
}

function history(data: FieldsPage): string {
  const entries = data.history.map(entry => {
    const account = data.accounts.find(item => item.id === entry.accountId);
    const definition = data.definitions.find(item => item.key === entry.key);
    return `<li class="record"><h3>${accountLink(entry.accountId, account?.name ?? entry.accountId)} · ${escape(definition?.label ?? entry.key)}</h3>`
      + `<dl><dt>Field key</dt><dd><code>${escape(entry.key)}</code></dd><dt>Previous value</dt><dd>${rawValue(entry.oldValue)}</dd><dt>New value</dt><dd>${rawValue(entry.newValue)}</dd>`
      + `<dt>Actor</dt><dd>${escape(entry.actor)}</dd><dt>Recorded (UTC)</dt><dd>${timestamp(entry.recordedAt)}</dd><dt>Source reference</dt><dd>${escape(entry.source)}</dd></dl></li>`;
  }).join('');
  return section('Field value history', entries ? `<ol class="journal">${entries}</ol>` : '<p>No field value changes recorded.</p>');
}

export function fieldsPage(data: FieldsPage, state: State, fields?: Fields, preview?: unknown, selectedAccountId?:string): string {
  const manage = canManage(state);
  const result = preview as Preview | undefined;
  const selected=data.accounts.find(a=>a.id===selectedAccountId)??data.accounts[0];
  const selection=`<form method="get" action="/app/fields"><label>Account<select name="account">${data.accounts.map(a=>`<option value="${escape(a.id)}"${a.id===selected?.id?' selected':''}>${escape(a.name)}</option>`).join('')}</select></label>${button('Open account fields')}</form>`;
  const accountData={...data,accounts:selected?[selected]:[],history:data.history.filter(h=>h.accountId===selected?.id)};
  return section('Custom field definitions', '<p>Typed account fields keep manual evidence and calculated values together. Formula explanations show how each calculated value was derived.</p>'
    + (data.definitions.length ? `<ul class="journal">${data.definitions.map(definition => `<li class="record"><h3>${escape(definition.label)}</h3>${definitionDetails(definition)}</li>`).join('')}</ul>` : '<p>No custom fields defined yet.</p>'))
    + (manage ? definitionForm(fields) + previewForm(fields, result) + (result ? previewResult(data, result) : '') : '')
    + section('Account field values', selection + (accountData.accounts.length ? `<ul class="journal">${accountData.accounts.map(account => `<li class="record"><h3>${accountLink(account.id, account.name)}</h3>${valueList(data.definitions, account)}${manage ? valueForm(data, account, fields) : ''}</li>`).join('')}</ul>` : '<p>No accessible accounts.</p>'))
    + history(accountData);
}
