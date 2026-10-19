// Links the homepage shares. Every number and date on the page follows the records table in
// desk-buoy/page-s1/STRUCTURE.md ("Records that must agree across screens").
import run from '../run.json'

/** Buoy's hosted demo (live, deploy-demo.json); "Try the demo" opens it. */
export const demo = 'https://demo.run-buoy.com/'
export const repository = run.repository
/** The one line that starts Buoy on someone's computer (the same line /run, the docs and the README give). */
export const startLine = run.clone
