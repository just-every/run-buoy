// Links the homepage shares. Every number and date on the page follows the records table in
// desk-buoy/page-s1/STRUCTURE.md ("Records that must agree across screens").
import run from '../run.json'

/** Buoy's hosted demo (live, deploy-demo.json); "Try the demo" opens it. */
export const demo = 'https://demo.run-buoy.com/'
export const repository = run.repository
/** The one line that starts Buoy on someone's computer (the same line /run and the docs give): the installer, then rer dev. */
export const startLine = `curl -fsSL https://runeditrun.com/install.sh | sh -s -- ${run.clone.slice('npx -y @runeditrun/rer '.length)}`
/** The same start for someone who already has Node 22 or later. */
export const npxLine = run.clone
