// 06 PLAYBOOK · MON OCT 5 – THU OCT 15 (page-06): copy top-right over a staircase of the Champion change playbook,
// the stakeholder map and the Zoom summary with cited lines, joined by dotted connectors.
import { at, check, copy, cursor, initials, links, sep, spark, stage, sticky } from '../parts'

const steps: [string, string][] = [
  ['Mark Dana Ruiz departed', `roles updated ${sep} Mon Oct 5, 9:31 am`],
  ['Map the new sponsor', `agent proposal Tue Oct 6, 8:05 am ${sep} Rob Tanaka confirmed by Jordan 8:40 am`],
  ['New sponsor intro', `booking link sent 9:02 am ${sep} Rob booked Thu Oct 8, 11:00 am PT (2:00 pm ET)`],
  ['Re-confirm the success plan', `Rob confirmed 2 of 2 goals in the customer portal, Thu Oct 15, 10:20 am PT`],
]

export function playbook(): string {
  const body = `<article class="card playbook-card place" style="${at(63, 35, 558)}"><h3 class="card-title">Playbook: Champion change</h3><p class="card-sub">4 steps ${sep} started Mon Oct 5, 9:31 am ${sep} owner Jordan Hale</p>`
    + `<ol class="pb-steps">${steps.map(([what, detail]) => `<li><span class="check-disc">✓</span><p><b>${what}</b> ${sep} ${detail}</p></li>`).join('')}</ol>`
    + `<p class="outcome"><span class="check-disc">✓</span><span>Outcome reached ${sep} new sponsor engaged ${sep} <span class="green">Thu Oct 15</span></span></p></article>`
    + copy('Playbook · Mon Oct 5 – Thu Oct 15', 'Champion gone.', 'New sponsor by Thursday.', "The champion-change playbook found who already worked with Tidewell, booked the intro and brought back the meeting's commitments.", at(760, 55, 715), 'eyebrow-right step')
    + `<article class="card people place" style="${at(452, 480, 558)}"><h3 class="card-title">Cascade Freight ${sep} stakeholders</h3><ul>`
    + `<li>${initials('DR', 'grey')}<p><span class="name"><s>Dana Ruiz</s> ${sep} Director of Transportation ${sep} Champion</span><span>departed Mon Oct 5 ${sep} Salesforce</span></p></li>`
    + `<li class="proposed">${initials('RT', 'plum')}<p><span class="name"><b>Rob Tanaka</b> ${sep} VP Operations</span><span>proposed sponsor ${sep} on 11 email threads and 2 meetings since June ${sep} cc'd on #48213</span></p></li>`
    + `<li>${initials('LP', 'blue')}<p><span class="name"><b>Linda Park</b> ${sep} CFO ${sep} Economic buyer</span><span>last meeting Wed Jan 14, 2026</span></p></li>`
    + `<li>${initials('TA', 'teal')}<p><span class="name"><b>Tony Alvarez</b> ${sep} Dispatch lead ${sep} Admin</span><span>filed #48213</span></p></li></ul></article>`
    + sticky('Rob was on the ticket all along!', at(1014, 520, 132, -12), 'rob-sticky')
    + `<article class="card zoom place" style="${at(925, 703, 557)}"><header class="zoom-head">${initials('RT', 'plum')}<div><h3 class="card-title">Zoom ${sep} Thu Oct 8, 2:00–2:30 pm</h3><p class="card-sub">Rob Tanaka, Jordan Hale ${sep} summary with cited lines</p></div></header><ul class="cited">`
    + `<li class="quote"><span>“Exports have to be back before our holiday peak.”</span><span class="stamp">04:12</span></li>`
    + `<li class="ok"><span><b>Proposed task:</b> Daily ENG-912 status to Rob until fixed ${sep} <span class="green">accepted by Jordan ${check}</span></span></li>`
    + `<li class="warn"><span><b>Risk mention:</b> “We're looking at a backup routing tool.” <span class="nowrap"><span class="stamp">17:40</span> ${sep}</span> flagged as competitor risk</span></li>`
    + `<li class="ok"><span><b>Proposed plan update:</b> <b>Goal 1</b> route exports automated for all 6 depots (measured in Segment) ${sep} <b>Goal 2</b> dispatch planning under 30 minutes a day (confirmed by Rob) ${sep} <span class="green">accepted ${check}</span></span></li></ul></article>`
    + cursor('Maya', at(60, 398))
    + cursor('Jordan', at(1080, 640))
    + spark(at(36, 392, 30, -60)) + spark(at(1070, 470, 30, 40)) + spark(at(1094, 594, 26, 100))
    + links('playbook', 1536, 1073, ['M300 412C300 500 330 558 440 558', 'M755 818C755 872 800 880 912 880'])
  return stage('playbook', 1073, 'Champion gone. New sponsor by Thursday.', body)
}
