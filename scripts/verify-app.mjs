import {spawnSync} from 'node:child_process'
import {accessSync} from 'node:fs'

// The default CLI door still runs the complete wall. Verify's parallel jobs
// partition these same tests and share the production build in CI.
const suites={
 plans:['test:plans','test:plans-browser'],
 permissions:['test:roles','test:roles-browser','test:billing'],
 http:['test:ai','test:migrate','test:site','test:flows:core','test:governance','test:connections','test:email-link'],
 records:['test:records'],
 volume:['test:volume'],
 'ai-browser':['test:ai-browser'],
 'reporting-browser':['test:reviews-browser','test:dashboards-browser'],
 'records-browser':['test:customer-people-browser','test:privacy-renewal-browser'],
 'workspace-browser':['test:workspace-browser'],
 'hierarchy-browser':['test:hierarchy-browser'],
 adoption:['test:adoption'],
 health:['test:health'],
 'adoption-consumers':['test:adoption-consumers'],
 'adoption-aggregates':['test:adoption-aggregates'],
 browser:['test:style','test:notifications','test:teams','test:segments','test:outcomes'],
 'accessibility-browser':['test:runway-keyboard','test:a11y'],
 'settings-browser':['test:integration-browser','test:trust-browser','test:governance-browser','test:fields-browser','test:connections-browser'],
 'intake-browser':['test:usage-browser','test:adoption-browser','test:inapp-browser','test:boundary'],
 archive:['test:portable'],
}
const selected=process.env.BUOY_VERIFY_SUITE??'all'
const names=selected==='all'?Object.keys(suites):selected.split(',')
if(names.some(name=>!Object.hasOwn(suites,name))||new Set(names).size!==names.length)throw new Error('Unknown or duplicate Buoy verification suite.')
const tests=names.flatMap(name=>suites[name])
const prebuilt=process.env.BUOY_VERIFY_PREBUILT==='true'
if(prebuilt){
 if(process.env.CI!=='true')throw new Error('Prebuilt verification is only available in CI.')
 for(const path of ['dist/server/wrangler.json','dist/client','dist/site'])accessSync(path)
}
for(const command of [...(prebuilt?[]:['build','build:site','typecheck']),...tests]){
 const child=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['run',command],{stdio:'inherit',env:process.env,shell:process.platform==='win32'})
 if(child.error)throw child.error
 if(child.status!==0)process.exit(child.status??1)
}
