import {dashboardJourney} from './dashboard-journey.mjs'
import {reportingBrowser} from './reporting-browser.mjs'
import {searchBrowser} from './search-journey.mjs'
import {playBrowser} from './play-browser.mjs'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {forecastJourney} from './forecast-journey.mjs'
import {privacyBrowser} from './privacy-browser.mjs'
import {renewalBrowser} from './renewal-browser.mjs'
import {workspaceBrowser} from './workspace-browser.mjs'
import {hierarchyBrowser} from './hierarchy-browser.mjs'
import {failures,manual} from './a11y-checks.mjs'
const groups={dashboards:[(browser,evidence)=>dashboardJourney({browser,evidence})],forecast:[(browser,evidence)=>forecastJourney({browser,evidence})],'privacy-renewals':[privacyBrowser,renewalBrowser,playBrowser,searchBrowser,reportingBrowser,(browser,evidence)=>forecastJourney({browser,evidence})],reporting:[reportingBrowser],search:[searchBrowser],play:[playBrowser],workspace:[workspaceBrowser],hierarchy:[hierarchyBrowser]},selected=process.argv[2]??'all'
assert.ok(selected==='all'||Object.hasOwn(groups,selected),'Select all or a declared native record journey group.')
const evidence=resolve(process.env.EVIDENCE_DIR??'../evidence/records-'+selected);await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 for(const journey of selected==='all'?[privacyBrowser,renewalBrowser,playBrowser,searchBrowser,reportingBrowser,(browser,evidence)=>forecastJourney({browser,evidence}),workspaceBrowser,hierarchyBrowser]:groups[selected])await journey(browser,evidence)
 assert.deepEqual(failures,[],'Every selected native record state retains inherited accessibility')
 for(const entry of manual)for(const rule of entry.rules)assert.equal(rule.id,'color-contrast','Only painted-background contrast resolution may remain manual')
}finally{await browser.close()}
