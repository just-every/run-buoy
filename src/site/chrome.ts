import run from './run.json';

export function siteBrand(prefix: string, size = 28): string {
  return `<a class="${prefix}-brand" href="/"><img src="/brand/mark.svg" width="${size}" height="${size}" alt=""><span>Buoy</span></a>`;
}
export function siteHeader(prefix: string, docs = false): string {
  return `<header class="${prefix}-header">${siteBrand(prefix, docs ? 32 : 28)}<nav aria-label="Site"><a href="/docs"${docs ? ' aria-current="page"' : ''}>Docs</a><a href="/contract">Contract</a><a href="${run.repository}">Source</a></nav></header>`;
}
export function siteFooter(prefix: string): string {
  return `<footer class="${prefix}-footer">${siteBrand(prefix, prefix === 'docs' ? 24 : 28)}<nav aria-label="Footer"><a href="/docs">Docs</a><a href="${run.repository}">Source</a><a href="${run.repository}/blob/main/LICENSE">MIT licence</a></nav></footer>`;
}
