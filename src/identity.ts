// This edition's identity: what its installed Lobby and its run site say.
// The name and color are the ones setup saves in src/branding.json; replace
// the purpose and tagline with the product's own when it has one.
import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
import site from '../deploy-site.json'

export const identity: EditionIdentity = {
  product: branding.name,
  deployment: branding.name,
  purpose: '{deployment} keeps renewal dates, customer health evidence and approved follow-up work.',
  tagline: 'Customer success and renewal decisions backed by billing and support evidence.',
  signInPath: '/signin',
  // The run site `rer deploy --site` publishes (deploy-site.json).
  runSite: `https://${site.domain}`,
  // An installed instance serves the Lobby at /.
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  mark: '/brand/mark.svg',
  fonts: '/fonts/fonts.css',
  accentColor: branding.primaryColor,
}
