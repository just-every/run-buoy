import { HEALTH_INTERPRETATION } from '../health';
import { button, disclosure, escape, field, form, hidden, pathId, section, textarea, valueOf } from './html';
import { canManage, type Account, type Fields, type State } from './types';

interface OutcomeAccount {
  currentInputs: { asOf: string; revision: string; billing: Account['billing']; support: Account['support']; health: Account['health'] };
  accountId: string;
  name: string;
  taskId: string | null;
  runId?:string|null;
  reachedAt: string | null;
  evidence: string | null;
  elapsedHours:number|null;
  status: 'observing' | 'reached' | 'missed';
}
interface OutcomeReport {
  interpretation: string;
  id: string;
  name: string;
  segmentId: string;
  segmentName: string;
  kind: 'healthy' | 'renewed';
  windowDays: number;
  startedAt: string;
  deadline: string;
  enrolled: OutcomeAccount[];
  comparison: OutcomeAccount[];
  rate: number;
  comparisonRate: number;
  meanHours: number | null;
  comparisonMeanHours: number | null;
}
export interface OutcomesPage {
  segments: { id: string; name: string }[];
  reports: OutcomeReport[];
}

const timestamp = (value: string) => `<time datetime="${escape(value)}">${escape(value)}</time>`;
const percentage = (rate: number) => `${escape(new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(100 * rate))}%`;
const elapsed = (hours: number | null) => hours === null ? 'No observed outcomes' : `${escape(new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(hours))} hours`;

function startForm(data: OutcomesPage, fields?: Fields): string {
  const values = fields?.action === 'outcome-start' ? fields : undefined;
  const v = (name: string, initial: unknown = '') => valueOf(values, name, initial);
  return form('outcome-start-form', '/app/outcomes', hidden('action', 'outcome-start') + hidden('operationKey',v('operationKey',crypto.randomUUID()))
    + '<p>First define the outcome and observation window. Then attach existing approved tasks to freeze the enrolled cohort when tracking starts.</p>'
    + `<div class="form-grid">${field('name', 'Outcome report name', v('name'))}`
    + `<label>Segment<select name="segmentId" required><option value="">Choose a segment</option>${data.segments.map(segment => `<option value="${escape(segment.id)}"${v('segmentId') === segment.id ? ' selected' : ''}>${escape(segment.name)}</option>`).join('')}</select></label></div>`
    + '<div class="form-grid"><label>Outcome to observe<select name="kind" required>'
    + `<option value="healthy"${v('kind', 'healthy') === 'healthy' ? ' selected' : ''}>Current evidence becomes healthy</option>`
    + `<option value="renewed"${v('kind') === 'renewed' ? ' selected' : ''}>New approved renewed decision</option></select></label>`
    + field('windowDays', 'Observation window (days, 1–365)', v('windowDays', 30), 'number', true, 'min="1" max="365" step="1"') + '</div>'
    + textarea('taskIds', 'Approved task IDs (comma-separated)', v('taskIds'), true, 'aria-describedby="outcome-cohort-help"')
    + '<p id="outcome-cohort-help">Each enrolled account must currently belong to the chosen segment and have an unsatisfied outcome at baseline. Choose one task per account; duplicate accounts are refused. Other eligible current members of the same segment form the unenrolled comparison group. Both account lists are frozen at tracking start; later segment changes do not rewrite them.</p>'
    + '<p>The UTC observation window starts when tracking starts. The report retains the first observed result timestamp and its evidence. Completing a task does not create a health or renewal outcome.</p>'
    + button('Start outcome tracking'));
}

function cohort(title: string, accounts: OutcomeAccount[], rate: number, meanHours: number | null): string {
  const reached = accounts.filter(account => account.status === 'reached').length;
  const records = accounts.map(account => `<li class="record"><h3><a href="/app/accounts/${pathId(account.accountId)}">${escape(account.name)}</a></h3>`
    + `<dl><dt>Status</dt><dd>${escape({ observing: 'Observing', reached: 'Reached', missed: 'Missed' }[account.status])}</dd>`
    + `<dt>Attached task</dt><dd>${account.taskId ? `<a href="/app/accounts/${pathId(account.accountId)}#tasks">Task ${escape(account.taskId)}</a>` : account.runId?`<a href="/app/accounts/${pathId(account.accountId)}#playbooks">Playbook run ${escape(account.runId)}</a>`:'No attached task'}</dd>`
    + `<dt>First observed outcome (UTC)</dt><dd>${account.reachedAt ? timestamp(account.reachedAt) : 'No observed outcomes'}</dd>`
    + `<dt>Elapsed UTC hours</dt><dd>${elapsed(account.elapsedHours)}</dd>`
    + `<dt>Outcome evidence</dt><dd>${account.evidence ? escape(account.evidence) : 'No observed evidence'}</dd><dt>Current inputs (not the baseline or outcome snapshot)</dt><dd>As of ${escape(account.currentInputs.asOf)}. Billing: ${account.currentInputs.billing ? `${escape(account.currentInputs.billing.reference)} observed ${escape(account.currentInputs.billing.observedAt)}` : 'missing'}. Support: ${account.currentInputs.support ? `${escape(account.currentInputs.support.reference)} observed ${escape(account.currentInputs.support.observedAt)}` : 'missing'}. ${escape(account.currentInputs.health.reasons.join('; '))}</dd></dl></li>`).join('');
  return `<h3>${escape(title)}</h3><dl><dt>Accounts</dt><dd>${accounts.length}</dd><dt>Reached outcome</dt><dd>${reached} of ${accounts.length} · ${percentage(rate)}</dd><dt>Mean elapsed UTC hours among reached accounts</dt><dd>${elapsed(meanHours)}</dd></dl>`
    + (records ? `<ul class="journal">${records}</ul>` : '<p>No accounts in this frozen cohort.</p>');
}

function reportView(report: OutcomeReport, index: number): string {
  const definition = report.kind === 'healthy'
    ? 'Healthy: current account evidence is healthy. Task completion alone does not satisfy this outcome.'
    : 'Renewed: a new approved renewal decision records “renewed” during the tracking window. Task completion alone does not satisfy this outcome.';
  return section(report.name, `<p>${escape(definition)}</p>`
    + `<dl><dt>Segment at tracking start</dt><dd><a href="/app/segments#segment-${pathId(report.segmentId)}">${escape(report.segmentName)}</a></dd>`
    + `<dt>Tracking started (UTC)</dt><dd>${timestamp(report.startedAt)}</dd><dt>Observation window</dt><dd>${report.windowDays} days</dd>`
    + `<dt>Deadline (UTC)</dt><dd>${timestamp(report.deadline)}</dd></dl>`
    + '<p>Enrolled and unenrolled comparison accounts belonged to the same segment and had unsatisfied outcomes when tracking started. These account lists stay frozen. Reached means the outcome was first observed within the UTC window; observing means the window is still open; missed means it closed without an observed outcome.</p>'
    + `<p>${escape(report.interpretation)}</p>`
    + `<p><a href="/api/buoy/outcomes/${pathId(report.id)}/report.csv">Download outcome report (CSV)</a></p>`
    + cohort('Enrolled accounts', report.enrolled, report.rate, report.meanHours)
    + cohort('Unenrolled comparison accounts', report.comparison, report.comparisonRate, report.comparisonMeanHours), `outcome-report-${index}`);
}

export function outcomesPage(data: OutcomesPage, state: State, fields?: Fields): string {
  return section('Playbook outcomes', `<p>${escape(HEALTH_INTERPRETATION)}</p>` + '<p>Compare observed account outcomes for accounts with approved tasks against unenrolled accounts from the same segment. Each report defines an outcome before attaching its frozen task cohort.</p><p>A healthy outcome requires current healthy evidence; a renewed outcome requires a new approved renewed decision. Reports preserve the first observed timestamp and evidence during the UTC window. Task completion never invents an outcome.</p><p>Rates are the percentage of each frozen cohort that reached the outcome. Mean elapsed UTC hours includes only reached accounts. Hours and percentages display rounded to two decimal places; CSV preserves calculation precision. Observational comparisons do not establish causation.</p>')
    + (data.reports.length ? data.reports.map(reportView).join('') : '<p>No outcome tracking reports yet.</p>')
    + (canManage(state) ? (data.segments.length ? disclosure('Start outcome tracking', 'Define an outcome, then attach approved tasks from a segment.', startForm(data, fields), 'outcome-start-panel', fields?.action === 'outcome-start') : section('Start outcome tracking', '<p>Create a segment before starting outcome tracking. <a href="/app/segments">Open segments</a>.</p>')) : '');
}
