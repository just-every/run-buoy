// The run site `rer build --site` writes: the homepage with its Run action,
// /run, /contract from CONTRACT.md, the not-found page and the public files they use. Every Run page
// string and command is in run.json; nothing here reads installation data.
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import run from './run.json'
import { landingHtml } from './landing'
import { docsPages } from './docs'

export function sitePages({ contract }: Partial<SiteContext> = {}): SiteBuild {
  const data: RunData = run
  return {
    pages: [
      { path: '/', html: landingHtml() },
      { path: '/run', html: runPageHtml(identity, data, contract) },
      ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, data, contract) }] : []),
      { path: '/404', html: siteNotFoundHtml(identity, data, contract) },
      ...docsPages(),
    ],
    assets: ['rer-theme.css', 'fonts', 'brand', 'design-assets'],
  }
}
