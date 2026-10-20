import assert from 'node:assert/strict'

// Axe returns a manual review when a visible label is a non-text symbol.
// Resolve only the existing runway's two symbols with independent public-DOM
// assertions. Other elements/rules remain unresolved and keep failing callers.
export async function resolveSymbolicLabelReviews(page,rules){
 const unresolved=[]
 for(const rule of rules){
  if(rule.id!=='label-content-name-mismatch'){unresolved.push(rule);continue}
  const controls=[]
  for(const target of rule.targets){
   if(target.length!==1){controls.push(null);continue}
   const control=page.locator(target[0])
   controls.push(await control.count()===1&&await control.evaluate(element=>element.matches('a.rw-open'))?control:null)
  }
  if(!controls.length||controls.some(control=>!control)){unresolved.push(rule);continue}
  for(const control of controls){
   const expanded=await control.getAttribute('aria-expanded')
   assert.ok(['true','false'].includes(expanded),'A11Y-001 symbolic control exposes its real expansion state')
   const name=control.locator('..').locator('.rw-name'),account=await name.innerText()
   assert.ok(account.trim(),'A11Y-001 symbolic action names a visible account')
   assert.equal((await control.innerText()).trim(),expanded==='true'?'−':'+','A11Y-001 only the declared open/close symbol is a non-text label')
   assert.equal(await control.getAttribute('aria-label'),`${expanded==='true'?'Close':'Open'} ${account} on the runway`,'A11Y-001 symbolic action name matches the visible account and expansion state')
   const accountUrl=new URL(await name.getAttribute('href'),page.url()),actionUrl=new URL(await control.getAttribute('href'),page.url())
   assert.equal(accountUrl.origin,new URL(page.url()).origin)
   assert.match(accountUrl.pathname,/^\/app\/accounts\/[^/]+$/)
   assert.equal(actionUrl.origin,accountUrl.origin)
   assert.ok(actionUrl.pathname==='/app'||actionUrl.pathname===accountUrl.pathname,'A11Y-001 symbolic action stays on its account or runway')
   assert.equal(actionUrl.searchParams.get('open'),expanded==='true'?'none':decodeURIComponent(accountUrl.pathname.split('/').at(-1)),'A11Y-001 the named open/close action points at the same account and intended state')
  }
 }
 return unresolved
}
