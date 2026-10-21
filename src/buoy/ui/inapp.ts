import { apiCall, ApiError } from './actions';
import { button, disclosure, escape, field, form, hidden, pathId, section, textarea, valueOf } from './html';
import { canManage, type Api, type Fields, type State } from './types';

type CampaignKind = 'announcement' | 'banner' | 'checklist' | 'walkthrough';
interface Campaign {
  id: string; sourceId: string; segmentId: string; kind: CampaignKind;
  title: string; body: string; steps: string[]; maxViews: number; windowHours: number; enabled: boolean;
}
interface Credential {
  id: string; sourceId: string; label: string; creatorId: string; createdAt: string;
  lastUsedAt: string | null; revokedAt: string | null; scope: string[];
}
export interface InappCredential { credential: Credential; secret: string }
export interface InappPage {
  campaigns: Campaign[];
  sources: { id: string; name: string }[];
  segments: { id: string; name: string }[];
  credentials: Credential[];
  receipts?: { campaignId: string; kind: string; personId: string; accountId: string; observedAt: string }[];
}
interface InappMutationResult {
  redirect?: string; message?: string; saved?: string; inappCredential?: InappCredential;
}

const kinds: [CampaignKind, string][] = [
  ['announcement', 'Announcement'], ['banner', 'Banner'], ['checklist', 'Checklist'], ['walkthrough', 'Walkthrough'],
];
const timestamp = (value: string | null) => value
  ? `<time datetime="${escape(value)}">${escape(value)}</time>` : 'Not recorded';
const text = (value: string) => escape(value).replace(/\r?\n/g, '<br>');
const select = (name: string, label: string, choices: { id: string; name: string }[], chosen: unknown) =>
  `<label>${escape(label)}<select name="${escape(name)}" required><option value="">Choose one</option>${choices.map(choice => `<option value="${escape(choice.id)}"${chosen === choice.id ? ' selected' : ''}>${escape(choice.name)}</option>`).join('')}</select></label>`;

function campaignForm(data: InappPage, fields?: Fields): string {
  const values = fields?.action === 'inapp-campaign' ? fields : undefined;
  const v = (name: string, initial: unknown = '') => valueOf(values, name, initial);
  return form('inapp-campaign', '/app/inapp', hidden('action', 'inapp-campaign')
    + `<div class="form-grid">${select('sourceId', 'Product source', data.sources, v('sourceId'))}${select('segmentId', 'Account segment', data.segments, v('segmentId'))}</div>`
    + `<label>Campaign format<select name="kind" required>${kinds.map(([kind, label]) => `<option value="${kind}"${v('kind', 'announcement') === kind ? ' selected' : ''}>${label}</option>`).join('')}</select></label>`
    + field('title', 'Title (plain text)', v('title'))
    + textarea('body', 'Body (plain text)', v('body'))
    + textarea('steps', 'Steps (one plain-text step per line)', v('steps'), false, 'aria-describedby="inapp-steps-help"')
    + '<p id="inapp-steps-help">Provide steps for a checklist or walkthrough. HTML and scripts are displayed as text.</p>'
    + `<div class="form-grid">${field('maxViews', 'Maximum views per person in the window', v('maxViews', 1), 'number', true, 'min="1" step="1"')}${field('windowHours', 'Rolling window (UTC hours, 1–8760)', v('windowHours', 24), 'number', true, 'min="1" max="8760" step="1"')}</div>`
    + `<label class="check"><input type="checkbox" name="enabled"${v('enabled') === 'on' ? ' checked' : ''}>Enable campaign</label>`
    + '<p>An enabled campaign is eligible only for reviewed customer people in the selected source and current account segment. Creating it does not send a message or record a view.</p>'
    + button('Create campaign'));
}

function campaignList(data: InappPage, fields?: Fields): string {
  if (!data.campaigns.length) return section('Campaigns', '<p>No in-app campaigns created.</p>');
  return section('Campaigns', `<ul class="records">${data.campaigns.map(campaign => {
    const toggle = form(`inapp-toggle-${campaign.id}`, '/app/inapp', hidden('action', 'inapp-toggle')
      + hidden('id', campaign.id)
      + hidden('enabled', fields?.action === 'inapp-toggle' && fields.id === campaign.id ? fields.enabled : String(!campaign.enabled))
      + button(`${campaign.enabled ? 'Disable' : 'Enable'} ${campaign.title}`));
    return `<li class="record"><h3>${escape(campaign.title)}</h3><p>${escape(campaign.enabled ? 'Enabled' : 'Disabled')} · ${escape(kinds.find(([kind]) => kind === campaign.kind)?.[1] ?? campaign.kind)}</p>`
      + `<p>Source: ${escape(data.sources.find(source => source.id === campaign.sourceId)?.name ?? campaign.sourceId)} · Segment: ${escape(data.segments.find(segment => segment.id === campaign.segmentId)?.name ?? campaign.segmentId)}</p>`
      + `<p>${text(campaign.body)}</p>`
      + (campaign.steps.length ? `<ol>${campaign.steps.map(step => `<li>${text(step)}</li>`).join('')}</ol>` : '')
      + `<p>At most ${escape(campaign.maxViews)} views per reviewed person in ${escape(campaign.windowHours)} rolling UTC hours.</p>`
      + toggle + '</li>';
  }).join('')}</ul>`);
}

function credentialSections(data: InappPage, fields?: Fields, issued?: InappCredential): string {
  const sourceName = (id: string) => data.sources.find(source => source.id === id)?.name ?? id;
  let body = issued ? section('Save this in-app server credential now', '<p>This secret is shown once. Store it in your product server’s secret store before leaving this page.</p>'
    + `<label>In-app credential<input value="${escape(issued.secret)}" readonly autocomplete="off" spellcheck="false" data-secret></label>`
    + `<p>Source: ${escape(sourceName(issued.credential.sourceId))} · Scope: ${escape(issued.credential.scope.join(', '))}</p>`) : '';
  const values = fields?.action === 'inapp-credential' ? fields : undefined;
  if (data.sources.length) body += disclosure('Issue in-app server credential', 'Keep the credential on your authenticated product relay server.',
    form('inapp-credential', '/app/inapp', hidden('action', 'inapp-credential')
      + select('sourceId', 'Product source', data.sources, valueOf(values, 'sourceId'))
      + field('label', 'Credential label', valueOf(values, 'label'))
      + '<p>Scope is inapp only. Usage ingestion and staff access require separate authority.</p>'
      + button('Issue in-app credential')), 'inapp-issue', Boolean(values));
  return body + section('In-app credentials', data.credentials.length ? `<ul class="records">${data.credentials.map(credential =>
    `<li class="record"><h3>${escape(credential.label)}</h3><p>${escape(sourceName(credential.sourceId))} · ${credential.revokedAt ? 'Revoked' : 'Active'} · ${escape(credential.scope.join(', '))}</p>`
    + `<dl><dt>Creator</dt><dd>${escape(credential.creatorId)}</dd><dt>Created (UTC)</dt><dd>${timestamp(credential.createdAt)}</dd><dt>Last use (UTC)</dt><dd>${timestamp(credential.lastUsedAt)}</dd>`
    + (credential.revokedAt ? `<dt>Revoked (UTC)</dt><dd>${timestamp(credential.revokedAt)}</dd>` : '') + '</dl>'
    + (credential.revokedAt ? '' : form(`inapp-revoke-${credential.id}`, '/app/inapp', hidden('action', 'inapp-revoke') + hidden('id', credential.id) + button(`Revoke ${credential.label}`, true))) + '</li>'
  ).join('')}</ul>` : '<p>No in-app server credentials issued.</p>');
}

function receiptList(data: InappPage, state: State): string {
  return section('Observed campaign receipts', '<p>These are recorded render, completion and dismissal observations. A campaign fetch, stored campaign or reservation is not a view. See <a href="/app/customer-people">customer timelines</a> for person evidence.</p>'
    + (data.receipts === undefined ? '' : data.receipts.length ? `<ul class="journal">${data.receipts.map(receipt => `<li class="record"><h3>${escape(data.campaigns.find(campaign => campaign.id === receipt.campaignId)?.title ?? receipt.campaignId)}</h3>`
      + `<p>${escape(receipt.kind)} · Customer person ${escape(receipt.personId)} · <a href="/app/accounts/${pathId(receipt.accountId)}">${escape(state.accounts.find(account => account.id === receipt.accountId)?.name ?? receipt.accountId)}</a></p>`
      + `<p>Observed (UTC): ${timestamp(receipt.observedAt)}</p></li>`).join('')}</ul>` : '<p>No observed campaign receipts.</p>'));
}

export function inappPage(data: InappPage, state: State, fields?: Fields, issued?: InappCredential): string {
  if (!canManage(state)) return section('In-app campaigns', '<p>Only an owner or administrator can manage in-app campaigns and credentials.</p>');
  return section('In-app campaigns', '<p>Author plain-text announcements, banners, checklists and walkthroughs for your product. Your product hosts the browser renderer and authenticated server relay; saving content here does not provide hosted delivery.</p>'
    + '<p>Keep in-app credentials on the server. The browser snippet grants no authority. Your product must authenticate its real session and validate account membership before the relay supplies trusted identities. Unknown, conflicting or unreviewed identities receive no targeted content.</p>'
    + '<p>Frequency caps apply per reviewed person and campaign over rolling UTC hours. The server counts observed view receipts plus pending five-minute reservations to prevent concurrent requests exceeding the cap. An unused reservation expires without becoming a view. Completion or dismissal ends that campaign for that person.</p>'
    + '<p><a href="/app/usage">Configure product sources and review exact identity mappings</a> · <a href="/app/customer-people">Customer people and timelines</a> · <a href="/app/segments">Account segments</a></p>')
    + credentialSections(data, fields, issued)
    + (data.sources.length && data.segments.length ? disclosure('Create an in-app campaign', 'Select a source and account segment, author content and set a frequency cap.', campaignForm(data, fields), 'inapp-create', fields?.action === 'inapp-campaign')
      : section('Create an in-app campaign', '<p>Add a <a href="/app/usage">product source</a> and an <a href="/app/segments">account segment</a> before creating a campaign.</p>'))
    + campaignList(data, fields) + receiptList(data, state);
}

export async function mutateInapp(api: Api, request: Request, fields: Fields): Promise<InappMutationResult> {
  const send = <T>(path: string, body: unknown, method = 'POST') => apiCall<T>(api, request, '/api/buoy/inapp' + path, method, body);
  if (fields.action === 'inapp-campaign') {
    await send('/campaigns', {
      sourceId: fields.sourceId, segmentId: fields.segmentId, kind: fields.kind, title: fields.title, body: fields.body,
      steps: (fields.steps ?? '').split(/\r?\n/).map(step => step.trim()).filter(Boolean),
      maxViews: Number(fields.maxViews), windowHours: Number(fields.windowHours), enabled: fields.enabled === 'on',
    });
    return { redirect: '/app/inapp', message: 'In-app campaign created.', saved: 'inapp-campaign' };
  }
  if (fields.action === 'inapp-toggle') {
    if (!['true', 'false'].includes(fields.enabled)) throw new ApiError('Choose whether to enable or disable the campaign.');
    await send('/campaigns/' + pathId(fields.id), { enabled: fields.enabled === 'true' }, 'PUT');
    return { redirect: '/app/inapp', message: fields.enabled === 'true' ? 'In-app campaign enabled.' : 'In-app campaign disabled.', saved: `inapp-toggle-${fields.id}` };
  }
  if (fields.action === 'inapp-credential') return { inappCredential: await send<InappCredential>('/credentials', { sourceId: fields.sourceId, label: fields.label }), saved: 'inapp-credential' };
  if (fields.action === 'inapp-revoke') {
    await send('/credentials/' + pathId(fields.id), {}, 'DELETE');
    return { redirect: '/app/inapp', message: 'In-app credential revoked.', saved: `inapp-revoke-${fields.id}` };
  }
  throw new ApiError('This in-app action is not supported.');
}
