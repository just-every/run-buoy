import { identity } from '../../identity';
import { siteHeader, siteFooter } from '../chrome';
import { icon } from '../../buoy/ui/icons';
import { drawings, heroDrawing } from './drawings';
import styles from './landing.css?raw';

const actions = (demo = false) => `<div class="landing-actions"><a class="primary-pill" href="/run">Run Buoy →</a>${demo ? '<a class="primary-pill" href="https://demo.run-buoy.com/">Try the demo</a>' : ''}<a class="text-link" href="/docs">Read the docs</a></div>`;
const features = [
  { id: 'free', eyebrow: 'FREE', heading: '100% free. Yours to keep.', body: 'Free as in cost and free as in code. MIT licensed, with your data in your own database.', drawing: drawings.free },
  { id: 'health', eyebrow: 'HEALTH', heading: 'Health you can explain.', body: 'Every status names the invoice or ticket behind it. Missing or old evidence stays in view.', drawing: drawings.health },
  { id: 'notice', eyebrow: 'NOTICE DATES', heading: 'The deadline before the date.', body: 'Enter the renewal date and notice period. Buoy shows when you need to act.', drawing: drawings.notice },
  { id: 'decisions', eyebrow: 'DECISIONS', heading: 'Every decision, on record.', body: 'Who approved it, when, and the evidence it rested on. Earlier decisions keep their terms.', drawing: drawings.decisions },
  { id: 'agents', eyebrow: 'AGENTS', heading: 'Agents prepare. Your team decides.', body: 'Give an assistant a scoped credential to list renewals and prepare playbooks. People approve.', drawing: drawings.agents },
  { id: 'move-in', eyebrow: 'MOVE IN', heading: 'Bring your accounts with you.', body: 'Paste account JSON, review the dry run, then apply. Undo while nothing has changed.', drawing: drawings.move },
];
export function landingHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buoy — See every renewal coming</title><meta name="description" content="${identity.tagline}"><link rel="icon" href="/brand/mark.svg"><link rel="stylesheet" href="/rer-theme.css"><style>${styles}</style></head><body class="landing">
  ${siteHeader('landing')}
  <main>
    <section class="landing-hero" id="top"><div class="landing-container"><div class="hero-copy"><h1>See every renewal<br>coming.</h1><p class="subhead">Renewal dates and notice deadlines beside billing and support evidence, with every decision on record.</p><p class="alternative">100% free, open source alternative to <strong>Vitally</strong>, <strong>Planhat</strong> and <strong>ChurnZero</strong></p>${actions(true)}<p class="small-print">Free and open source, MIT licensed.</p></div>${heroDrawing()}</div></section>
    <div class="landing-container features">${features.map((feature, index) => `<section class="feature ${index % 2 ? 'reverse' : ''}" id="${feature.id}"><div class="feature-copy"><p class="eyebrow">${feature.eyebrow}</p><h2>${feature.heading}</h2><p>${feature.body}</p></div><div class="feature-drawing" role="group" aria-label="${feature.heading}">${feature.drawing()}</div></section>`).join('')}</div>
    <section class="included landing-container" id="included"><h2>Also included</h2><ul>${[
      ['people', 'Owner, admin and member roles'], ['coins', 'Six currencies'], ['export', 'Export and restore'],
      ['trash', 'Erase an account'], ['code', 'Works without JavaScript'], ['undo', 'Import journal with undo'],
    ].map(([name, label]) => `<li>${icon(name)}<span>${label}</span></li>`).join('')}</ul></section>
    <section class="landing-close"><div class="landing-container"><h2>See every renewal coming.</h2>${actions()}</div></section>
  </main>${siteFooter('landing')}
  </body></html>`;
}
