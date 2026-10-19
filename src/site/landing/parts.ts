// Drawing parts shared by the homepage's sections. Every section is a stage drawn in the desk's own pixels
// (desk-buoy/page-s1, 1536 wide): `at(x, y, w, r)` places an element at desk coordinates, and the stage scales one
// desk pixel (--u) with the page up to 1536 px. Below 1180 px the stage stacks in reading order (landing CSS).

/** Desk position: left, top and width in desk pixels, and a tilt in degrees. Width and tilt are always written, so a
 * placed part inside a placed card never inherits the card's (custom properties inherit); `none` leaves width auto. */
export const at = (x: number, y: number, w?: number, r = 0) => `--x:${x};--y:${y};--w:${w ?? 'none'};--r:${r}`

export const escape = (value: string) => value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]!))

/** A section stage: `h` is its desk height at 1536. */
export const stage = (id: string, h: number, label: string, body: string, extra = '') =>
  `<section class="stage-wrap ${extra}" id="${id}" aria-label="${escape(label)}"><div class="stage" style="--h:${h}">${body}</div></section>`

/** Stage-and-date eyebrow, two-line heading (black, then the gradient line) and body copy. */
export const copy = (eyebrow: string, first: string, second: string, body: string, style: string, align = '') =>
  `<div class="copy place ${align}" style="${style}"><p class="eyebrow">${eyebrow}</p><h2><span class="l1">${first}</span> <span class="l2">${second}</span></h2><p class="lede">${body}</p></div>`

export type Tone = 'red' | 'green' | 'amber' | 'plum' | 'grey'
export const dot = (tone: Tone) => `<span class="dot ${tone}" aria-hidden="true"></span>`
export const pill = (tone: Tone, text: string, className = '') => `<span class="pill ${tone} ${className}">${tone === 'grey' ? '' : dot(tone)}<span>${text}</span></span>`
export const check = '<span class="tick" aria-hidden="true">✓</span>'
export const sep = '<span class="sep" aria-hidden="true">·</span>'

/** "Maya" (plum) or "Jordan" (turquoise): an arrow on a name pill, decoration only. */
export const cursor = (who: 'Maya' | 'Jordan', style: string, flip = false) =>
  `<span class="cursor ${who.toLowerCase()} place${flip ? ' flip' : ''}" style="${style}" aria-hidden="true"><svg viewBox="0 0 26 30"><path d="M3 2.5 23 15.2l-9.4 1.9L9 26.4z"/></svg><b>${who}</b></span>`

/** A pale yellow handwritten sticky. */
export const sticky = (text: string, style: string, className = '') => `<p class="sticky place ${className}" style="${style}">${text}</p>`

/** Three plum strokes, the hand-drawn "look here" spark. */
export const spark = (style: string) => `<svg class="spark place" style="${style}" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4v10M33 11l-7 7M37 26h-10"/></svg>`

/** The one mark, as an image (public/brand/mark.svg). */
export const mark = (className: string, style = '') => `<img class="${className}" src="/brand/mark.svg" alt=""${style ? ` style="${style}"` : ''}>`

/** Initials disc for a person (no photographs on the page). */
export const initials = (letters: string, tone: 'plum' | 'blue' | 'green' | 'teal' | 'grey' = 'plum') => `<span class="avatar ${tone}" aria-hidden="true">${letters}</span>`

/** Dotted plum connectors over a stage, in desk pixels; `paths` are SVG path data, each ending in an arrowhead. */
export const links = (id: string, w: number, h: number, paths: string[], heads = true) =>
  `<svg class="links" viewBox="0 0 ${w} ${h}" aria-hidden="true">${heads ? `<defs><marker id="head-${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1.5 8 5 1 8.5" fill="none" stroke="#8a2eae" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>` : ''}${paths.map(d => `<path d="${d}"${heads ? ` marker-end="url(#head-${id})"` : ''}/>`).join('')}</svg>`
