// 04 ALERT · MON OCT 5, 9:12 AM (page-04): one "54 · At risk" chip on dotted connectors to the Buoy panel on the
// Salesforce account page, the Slack #cs-alerts message and the Buoy panel beside the Zendesk ticket. Both Buoy
// messages in Slack carry the mark as the app avatar; ARR shows only as the $100k–$250k band outside Buoy.
import { at, check, copy, cursor, dot, initials, links, mark, sep, spark, stage } from '../parts'

const panel = (rows: string[]) => `<div class="buoy-panel"><p class="panel-name">Buoy</p><dl>${rows.join('')}</dl></div>`
const row = (name: string, value = '') => value ? `<div><dt>${name}</dt><dd>${value}</dd></div>` : `<div class="solo"><dt>${name}</dt></div>`
const risk = `${dot('red')}54 ${sep} At risk`

export function alert(): string {
  const body = copy('Alert · Mon Oct 5, 9:12 am', 'One alert,', 'everywhere you work.', 'The drop reached Slack within a minute. Sales saw the same health in Salesforce, and support saw it beside the ticket in Zendesk.', at(0, 46, 1536), 'center')
    + `<p class="pill red alert-chip place" style="${at(678, 346)}">${dot('red')}<span>54 ${sep} At risk</span></p>`
    + `<article class="card surface place" style="${at(55, 462, 440, -2.2)}"><h3 class="card-title">Salesforce ${sep} Account ${sep} Cascade Freight</h3><p class="card-sub">as AE Chris Novak sees it</p>${panel([row('Health', risk), row('Champion left'), row('Weekly active users', '−38%'), row('3 urgent tickets'), row('CSM', 'Jordan Hale'), row('Renewal', 'Thu Dec 31'), row('ARR', '$100k–$250k')])}</article>`
    + `<article class="card slack place" style="${at(507, 440, 525)}"><h3 class="channel"># cs-alerts</h3>`
    + `<div class="msg">${mark('msg-avatar')}<div><p class="msg-head"><b>Buoy</b><span class="app">APP</span><span class="time">9:12 am</span></p><p>Cascade Freight dropped to 54 ${sep} At risk ${sep} champion Dana Ruiz left ${sep} weekly active users −38% ${sep} 3 urgent tickets ${sep} renews Thu Dec 31 ${sep} $148,000</p>`
    + `<p class="msg-actions" aria-label="Message actions"><span>Acknowledge</span><span>Snooze</span><span>Open in Buoy</span></p><p class="acked"><span class="check-disc">✓</span><span>Acknowledged by Jordan Hale ${sep} 9:20 am ${check}</span></p></div></div>`
    + `<div class="msg">${initials('JH', 'plum')}<div><p class="msg-head"><b>Jordan Hale</b></p><p class="mono lookup">/buoy Cascade Freight</p></div></div>`
    + `<div class="msg tight">${mark('msg-avatar')}<div><p class="msg-head"><b>Buoy</b></p><p>Health 54 ${sep} At risk ${sep} owner Jordan Hale ${sep} renews Thu Dec 31 ${sep} $148,000 ${sep} suggested playbook: Champion change</p></div></div></article>`
    + `<article class="card surface place" style="${at(1040, 466, 445, 2.4)}"><h3 class="card-title">Zendesk ${sep} Ticket #48224 ${sep} Carrier portal export failing</h3><p class="card-sub">as support agent Bree Collins sees it</p>${panel([row('Health', risk), row('Top reason: champion left'), row('Tier', 'Enterprise'), row('CSM', 'Jordan Hale'), row('ARR', '$100k–$250k'), row('Renews', 'Thu Dec 31')])}</article>`
    + cursor('Jordan', at(704, 628))
    + spark(at(1462, 420, 30, 60))
    + links('alert', 1536, 973, ['M678 376C470 392 300 404 284 452', 'M770 398L770 430', 'M862 376C1080 392 1250 404 1265 458'])
  return stage('alert', 973, 'One alert, everywhere you work.', body)
}
