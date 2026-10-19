// The run site's lockup, header and footer, shared by the homepage and the docs (styles in chrome.css).
import run from './run.json';

const brand = () => `<a class="site-brand" href="/"><img src="/brand/mark.svg" width="58" height="58" alt=""><span>Buoy</span></a>`;

export function siteHeader(current?: 'docs'): string {
  return `<div class="chrome-wrap"><header class="site-chrome site-header">${brand()}<nav class="site-nav" aria-label="Site"><a href="/docs"${current === 'docs' ? ' aria-current="page"' : ''}>Docs</a><a href="/contract">Contract</a><a href="${run.repository}">Source</a></nav></header></div>`;
}

export function siteFooter(): string {
  return `<div class="chrome-wrap"><footer class="site-chrome site-footer"><div class="footer-brand">${brand()}<p>Free, open source customer success platform</p></div><nav aria-label="Footer"><a href="/docs">Docs</a><a href="/contract">Contract</a><a href="${run.repository}">Source</a><a href="${run.repository}/blob/main/LICENSE">MIT licensed</a></nav></footer></div>`;
}
