import { themeFrame } from '../../base/theme-frame';
import { fontHead } from '../../base/font-head';
import branding from '../../branding.json';
import { escape } from './html';
import { browserScript } from './browser';
import type { State } from './types';

let scriptHash: Promise<string> | undefined;
export async function shell(title: string, body: string, state: State | null, current: string, status = 200, error?: string, success?: string): Promise<Response> {
  const frame = await themeFrame({ href: '/rer-theme.css', productName: 'Buoy', accentColor: branding.primaryColor });
  if (error) {
    const invalid = error.match(/(?:accounts\[\d+\]\.|account\.)([A-Za-z.]+)/)?.[1]
      ?? (/valid JSON|accounts array|upload must/i.test(error) ? 'source' : /type the account name/i.test(error) ? 'confirmation' : undefined);
    if (invalid) body = body.replace(/<(input|select|textarea)\b[^>]*>/g, tag => tag.includes(`name="${invalid}"`) ? tag.replace(/>$/, ' aria-invalid="true" aria-describedby="form-error">') : tag);
  }
  scriptHash ??= crypto.subtle.digest('SHA-256', new TextEncoder().encode(browserScript)).then(buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))));
  const navigation = [['/app', 'Accounts'], ['/app/imports', 'Imports'], ['/app/backups', 'Backups']].map(([href, label]) => `<a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return new Response(`<!doctype html><html lang="en" class="rer-themed"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Buoy</title>${frame.head}${fontHead}<link rel="stylesheet" href="/buoy.css"></head><body><div class="buoy-shell"><header class="app-header"><a class="brand-link" href="/app">${frame.brand}</a>${state ? `<p>${escape(state.operator.displayName)} · ${escape(state.operator.role)}</p>` : ''}</header><nav aria-label="Main">${navigation}<a href="/app?intro=show#first-use">First use</a></nav><main id="work"><h1>${escape(title)}</h1>${error ? `<div class="notice error" role="alert" id="form-error" data-form-error><h2>We couldn’t save this change</h2><p>${escape(error)}</p><p>Your entered values are below. Review them and try again.</p><p><a href="${escape(current)}">Reload the current records</a></p></div>` : ''}${success ? `<p class="notice" role="status">${escape(success)}</p>` : ''}${body}</main><footer><p>Buoy keeps renewal evidence, approved work and recorded decisions together.</p></footer></div><script>${browserScript}</script></body></html>`, {
    status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'strict-origin', 'x-content-type-options': 'nosniff', 'content-security-policy': `default-src 'none'; ${frame.policy}; script-src 'sha256-${await scriptHash}'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` },
  });
}
