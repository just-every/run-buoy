// The <head> of the run site's own pages (homepage and docs): title, description, the share card, the tuned
// favicons (rer freezes public/favicon.ico, favicon-32.svg and apple-touch-icon.png into iconHead), the brand face
// preloaded and the theme. Base's /run, /contract and 404 write their own heads with the same icons and theme.
import { iconHead } from '../base/icon-head'
import { identity } from '../identity'
import { escape } from './landing/parts'

export const socialImage = `${identity.runSite}/site/og.jpg`

export function siteHead({ title, description, path, style }: { title: string; description: string; path: string; style: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#ffffff">`
    + `<meta property="og:type" content="website"><meta property="og:site_name" content="Buoy"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">`
    + `<meta property="og:url" content="${identity.runSite}${path}"><meta property="og:image" content="${socialImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`
    + `${iconHead}<link rel="preload" href="/fonts/inter/inter-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>`
    + `<link rel="stylesheet" href="${identity.theme}"><style>${style}</style></head>`
}
