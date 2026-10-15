const badge = (label: string, kind: string) => `<span class="badge ${kind}">${label}</span>`;
const check = '<span class="check" aria-hidden="true">✓</span>';
const pill = (text: string) => `<span class="draw-pill" aria-hidden="true">${text}</span>`;
const card = (body: string, className = '') => `<div class="drawing-card ${className}">${body}</div>`;
const rows = (items: [string, string][]) => `<dl>${items.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
export const riskCard = () => card(`<div class="draw-heading"><strong>Harbour Studio</strong>${badge('At risk', 'risk')}</div><p>Notice deadline <b>Dec 16, 2026</b></p><p>AUD 800.00 overdue in INV-1001.</p>`);
export const approvalCard = () => card(`<div class="draw-heading"><strong>Call about INV-1001</strong></div>${pill('Approve and create task')}`);
export const renewedCard = () => card(`<p class="renewed-evidence">${check}<span>Evidence: Signed order R-17</span></p>`);
export function heroDrawing(): string {
  return `<div class="renewal-story" role="group" aria-label="Buoy's renewal work in three steps">${[['See the risk', riskCard()], ['Approve', approvalCard()], ['Renewed', renewedCard()]].map(([title, body], index) => `<div class="story-step"><h2><span aria-hidden="true">${index + 1}</span>${title}</h2>${body}<div class="reflection" aria-hidden="true">${body}</div></div>`).join('')}</div>`;
}
export const drawings = {
  free: () => card('<h3>MIT License</h3><p>Buoy</p><div class="license-lines"><p>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files.</p><p>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p><p>THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND.</p></div>', 'license-card'),
  health: () => card(`<div class="health-rows">${[
    ['Harbour Studio', 'At risk', 'risk', 'AUD 800.00 overdue in INV-1001.'],
    ['Northwind Labs', 'Healthy', 'healthy', 'Current billing and support snapshots show no defined risk signal.'],
    ['Kestrel Analytics', 'Unknown', 'unknown', 'Billing evidence is older than 30 days.'],
  ].map(([name, label, kind, reason]) => `<div><div class="draw-heading"><strong>${name}</strong>${badge(label, kind)}</div><p>${reason}</p></div>`).join('')}</div>`),
  notice: () => card(rows([['Renewal date', 'Jan 15, 2027'], ['Notice period', '30 days'], ['Notice deadline', 'Dec 16, 2026']])),
  decisions: () => card(`<h3 class="decision-title">${check}Renewed</h3><p class="draw-ink">Customer accepted another year</p><p class="draw-ink">Evidence: Signed order R-17</p><p class="draw-small">Recorded by Sam Lee on Oct 15, 2026</p>`),
  agents: () => card(`<h3>Call about INV-1001</h3><p>Prepared by Renewal assistant</p>${pill('Approve and create task')}`),
  move: () => card(`<h3>Dry-run review</h3>${rows([['Input records', '42'], ['Unique records', '42'], ['Duplicates', '0']])}${pill('Apply reviewed import')}`),
};
