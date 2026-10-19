// The run site's homepage: the owner-approved desk page (desk-buoy/page-s1, screens 01–13) in order, every card,
// chart and drawing real HTML, CSS and SVG. Visual authority: desk-buoy/README.md and page-s1/STRUCTURE.md.
import { siteHead } from '../head'
import { siteFooter, siteHeader } from '../chrome'
import chrome from '../chrome.css?raw'
import base from './landing.css?raw'
import { hero } from './sections/hero'
import heroStyle from './sections/hero.css?raw'
import { account } from './sections/account'
import accountStyle from './sections/account.css?raw'
import { health } from './sections/health'
import healthStyle from './sections/health.css?raw'
import { alert } from './sections/alert'
import alertStyle from './sections/alert.css?raw'
import { verify } from './sections/verify'
import verifyStyle from './sections/verify.css?raw'
import { playbook } from './sections/playbook'
import playbookStyle from './sections/playbook.css?raw'
import { quarter } from './sections/quarter'
import quarterStyle from './sections/quarter.css?raw'
import { portfolio } from './sections/portfolio'
import portfolioStyle from './sections/portfolio.css?raw'
import { signals } from './sections/signals'
import signalsStyle from './sections/signals.css?raw'
import { onboarding } from './sections/onboarding'
import onboardingStyle from './sections/onboarding.css?raw'
import { renewals } from './sections/renewals'
import renewalsStyle from './sections/renewals.css?raw'
import { cutover } from './sections/cutover'
import cutoverStyle from './sections/cutover.css?raw'
import { closing } from './sections/closing'
import closingStyle from './sections/closing.css?raw'

const sections = [hero, account, health, alert, verify, playbook, quarter, portfolio, signals, onboarding, renewals, cutover, closing]
const styles = [chrome, base, heroStyle, accountStyle, healthStyle, alertStyle, verifyStyle, playbookStyle, quarterStyle, portfolioStyle, signalsStyle, onboardingStyle, renewalsStyle, cutoverStyle, closingStyle]

/** Dates ("Thu Mar 12, 2026", "Mon Oct 19"), times ("9:00 am CT"), durations ("39 days") and counts ("1 of 6") are
 * single tokens: their spaces never break. */
const tokens = [
  /\b(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) )?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(?:, \d{4})?\b/g,
  /\b\d{1,2}(?::\d\d)? (?:am|pm)(?: (?:PT|CT|ET|MT))?\b/g,
  /\b\d[\d,.]* (?:days?|weeks?|months?|hours?|minutes?|points?)\b/g,
  /\b\d+ of \d+\b/g,
]
const keepTokens = (text: string) => tokens.reduce((out, pattern) => out.replace(pattern, token => token.replace(/ /g, '\u00a0')), text)

/** Separators, arrows and range dashes stay on the line of the word before them (no line starts with one), a
 * dash-joined token (a time range, a score band, a money band) or an ID ("ENG-912") never breaks at its dash, a check
 * mark stays with the word before it, and dates, times, durations and counts never break inside. Styles are left alone. */
export const keepSeparators = (html: string) => html.split(/(<style>[\s\S]*?<\/style>)/).map(part => part.startsWith('<style>') ? part
  : part.replace(/>[^<]+</g, text => keepTokens(text).replace(/ ([·→–—])/g, '\u00a0$1').replace(/[^\s>]+–[^\s<]+|\b[A-Z]{2,}-\d+\b/g, token => `<span class="nowrap">${token}</span>`)).replace(/ <span class="(sep|tick)"/g, '\u00a0<span class="$1"')).join('')

export function landingHtml(): string {
  return keepSeparators(siteHead({
    title: 'Buoy · Spot the risk. Save the renewal.',
    description: 'Buoy joins CRM, billing, support and usage data for every account, explains its health, runs your playbooks and reconciles renewals to billing. Free and open source.',
    path: '/',
    style: styles.join('\n'),
  }) + `<body class="landing buoy-paper"><a class="skip" href="#main">Skip to content</a>${siteHeader()}<main id="main">${sections.map(section => section()).join('')}</main>${siteFooter()}</body></html>`)
}
