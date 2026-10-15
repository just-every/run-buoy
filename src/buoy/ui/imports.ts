import { button, date, details, escape, form, hidden, section, textarea } from './html';
import type { Fields, Job, Preview } from './types';

const jobLabels: Record<string, string> = { queued: 'Queued', completed: 'Import complete', undone: 'Import undone', undoing: 'Undo in progress', applying: 'Applying', failed: 'Failed', rolling_back: 'Rolling back', rolled_back: 'Rolled back' };
const jobLabel = (state: string) => jobLabels[state] ?? state.replaceAll('_', ' ');
export function importsPage(jobs: Job[] | null, values?: Fields, preview?: Preview, erasures?: unknown[]): string {
  const source = values?.source ?? '';
  const previewBody = preview ? `<h3>Dry-run review</h3><p>No accounts have been imported by this preview. Confirm the counts and diagnostics before applying this exact upload.</p>${counts(preview.counts)}${diagnostics(preview.diagnostics)}${details('import-review-details', 'Import review details', preview)}${form('import-apply', '/app/imports', hidden('action', 'import-apply') + hidden('fingerprint', preview.fingerprint) + hidden('operationKey', values?.operationKey || crypto.randomUUID()) + `<textarea name="source" hidden>${escape(source)}</textarea>` + '<p>Apply creates the reviewed account records. This button submits the same source shown in the preview.</p>' + button('Apply reviewed import'))}` : '';
  const list = jobs === null ? '<p>The import journal could not be loaded. Refresh this page to try again.</p>' : jobs.length ? jobs.map((job, index) => `<article class="record"><h3>Import ${index + 1}</h3><p><span class="status">${escape(jobLabel(job.state))}</span>${typeof job.checkpoint === 'number' && typeof job.total === 'number' ? ` · ${escape(job.checkpoint)} of ${escape(job.total)} records processed` : ''}</p>${job.error ? `<p class="error-text">${escape(job.error)}</p>` : ''}${details(`import-${job.id}`, 'Import journal', job)}${!['undone', 'rolled_back', 'reversed', 'erased'].includes(job.state) ? form(`undo-${job.id}`, '/app/imports', hidden('action', 'import-undo') + hidden('id', job.id) + '<p>Undo is refused if account records have changed or gained dependent work. It does not discard those later changes.</p>' + button('Undo this import', true)) : ''}</article>`).join('') : '<p>No import jobs yet. Preview your account upload to begin.</p>';
  const erased = erasures?.length ? section('Erasure journal', `<p>${escape(erasures.length)} erasure receipts recorded.</p>${details('erasure-journal', 'Erasure journal details', erasures)}`) : '';
  return `<p>Import a JSON object containing an accounts array, with between 1 and 50 accounts. Use the account snapshot format documented in <code>fixtures/move-in</code>. Start with your own records.</p>${section('Preview an account upload', form('import-preview', '/app/imports', hidden('action', 'import-preview') + textarea('source', 'Account snapshot JSON', source, true, 'rows="14" spellcheck="false"') + button('Preview import')) + previewBody)}${section('Import journal', list)}${erased}`;
}
function counts(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '<p>Review the import diagnostics in Details.</p>';
  const labels: Record<string, string> = { input: 'Input records', unique: 'Unique records', duplicates: 'Duplicates', mapped: 'Mapped records', unmapped: 'Unmapped records', rejected: 'Rejected records', effects: 'Account changes' };
  return `<dl>${Object.entries(labels).filter(([key]) => key in value).map(([key, label]) => `<dt>${label}</dt><dd>${escape((value as Record<string, unknown>)[key])}</dd>`).join('')}</dl>`;
}
function diagnostics(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return '<p>No diagnostics were reported.</p>';
  return `<ul>${value.map(item => `<li>${escape(item && typeof item === 'object' ? item.message ?? item.code ?? 'Review diagnostic in Details' : item)}</li>`).join('')}</ul>`;
}

export function backupsPage(owner: boolean): string {
  return owner ? section('Export a domain backup', '<p>Stop the local app, then run the export from the checkout root to create an installation archive containing Buoy’s domain records and import custody.</p><pre><code>rer dev --stop\nrer export --output exports/buoy.rer</code></pre><p>Keep the archive private. Restore only into an empty destination checkout:</p><pre><code>rer import --input exports/buoy.rer --yes</code></pre><p>The import command requires an empty destination and explicit confirmation. These commands run in your terminal; opening this page does not create a backup.</p>') : section('Owner backup access', '<p>The owner exports and restores domain backups from the checkout’s command line. Ask the owner when you need an archive or restoration.</p>');
}
