import { themeFrame } from '../../base/theme-frame';
import { fontHead } from '../../base/font-head';
import branding from '../../branding.json';
import { escape } from './html';
import { browserScript } from './browser';
import { canManage, type State } from './types';

export interface ShellPage {
  title: string; body: string; state: State | null; current: string;
  /** The heading row's left side; defaults to the title as the page's h1. */
  head?: string;
  /** Generated placement rules (the runway's), hashed into the CSP like the script. */
  style?: string;
  status?: number; error?: string; success?: string; backToAccounts?: boolean; importDoor?: boolean;
}

const sha = async (text: string) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))));
let scriptHash: Promise<string> | undefined;
const views = [['/app', 'Accounts'], ['/app/imports', 'Imports'], ['/app/backups', 'Backups'], ['/app/notifications', 'Inbox'], ['/app/segments','Segments'], ['/app/outcomes','Outcomes'], ['/app/fields','Fields']] as const;

export async function shell(page: ShellPage): Promise<Response> {
  const { title, state, current, status = 200, error, success, style } = page;
  let body = page.body;
  const frame = await themeFrame({ href: '/rer-theme.css', productName: 'Buoy', accentColor: branding.primaryColor });
  if (error) {
    const invalid = error.match(/(?:accounts\[\d+\]\.|account\.)([A-Za-z.]+)/)?.[1]
      ?? (/valid JSON|accounts array|upload must/i.test(error) ? 'source' : /type the account name/i.test(error) ? 'confirmation' : undefined);
    if (invalid) body = body.replace(/<(input|select|textarea)\b[^>]*>/g, tag => tag.includes(`name="${invalid}"`) ? tag.replace(/>$/, ' aria-invalid="true" aria-describedby="form-error">') : tag);
  }
  scriptHash ??= sha(browserScript);
  const styleHash = style ? ` 'sha256-${await sha(style)}'` : '';
  const chips = [...views.filter(([href]) => href !== '/app/imports' || state?.operator.role === 'owner'), ...(state && canManage(state) ? [['/app/team', 'Team'] as const, ['/app/audit', 'Audit'] as const] : [])].map(([href, label]) => `<a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const who = state ? `${state.operator.displayName} · ${state.operator.role}` : '';
  const initials = state ? state.operator.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('') : '';
  const operator = state ? `<p class="operator" title="${escape(who)}"><span class="operator-initials" aria-hidden="true">${escape(initials)}</span><span class="sr-only">Signed in as ${escape(who)}</span></p>` : '';
  const notices = `${error ? `<div class="notice error" role="alert" id="form-error" data-form-error><h2>We couldn’t save this change</h2><p>${escape(error)}</p><p>Your entered values are below. Review them and try again.</p><p><a href="${escape(current)}">Reload the current records</a></p></div>` : ''}${success ? `<p class="notice" role="status">${escape(success)}</p>` : ''}`;
  const document = `<!doctype html><html lang="en-US" class="rer-themed"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Buoy</title>${frame.head}${fontHead}<link rel="stylesheet" href="/buoy.css"><link rel="stylesheet" href="/buoy-runway.css">${style ? `<style>${style}</style>` : ''}</head><body class="buoy-app"><div class="buoy-shell"><header class="app-bar"><a class="brand-link" href="/app">${frame.brand}</a></header><main id="work"><div class="head-row"><div class="page-head">${page.backToAccounts ? '<p class="back-link"><a href="/app">← Back to accounts</a></p>' : ''}${page.head ?? `<h1>${escape(title)}</h1>`}</div><div class="controls"><nav class="views" aria-label="Main" data-scroll-x>${chips}</nav>${operator}</div></div>${notices}${body}</main><footer class="app-footer"><p>Buoy keeps renewal evidence, approved work and recorded decisions together.</p></footer></div><script>${browserScript}</script>${page.importDoor ? '<script type="module" src="/import-door.js"></script>' : ''}</body></html>`;
  return new Response(document, {
    status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'strict-origin', 'x-content-type-options': 'nosniff', 'content-security-policy': `default-src 'none'; ${frame.policy.replace("style-src 'self'", `style-src 'self'${styleHash}`)}; script-src 'sha256-${await scriptHash}'${page.importDoor ? " 'self'; connect-src 'self'" : ''}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` },
  });
}
