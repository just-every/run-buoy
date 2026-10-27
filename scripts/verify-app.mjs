import {spawnSync} from 'node:child_process'

// The default CLI door still runs the complete wall. Verify's parallel jobs
// partition these same tests so archive restore has its full execution window.
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
 'settings-browser':['test:integration-browser','test:governance-browser','test:fields-browser','test:connections-browser'],
 'intake-browser':['test:usage-browser','test:adoption-browser','test:inapp-browser','test:boundary'],
 archive:['test:portable'],
}
const selected=process.env.BUOY_VERIFY_SUITE??'all'
if(selected!=='all'&&!Object.hasOwn(suites,selected))throw new Error('Unknown Buoy verification suite.')
const tests=selected==='all'?Object.values(suites).flat():suites[selected]
for(const command of ['build','build:site','typecheck',...tests]){
 const child=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['run',command],{stdio:'inherit',env:process.env,shell:process.platform==='win32'})
 if(child.error)throw child.error
 if(child.status!==0)process.exit(child.status??1)
}
