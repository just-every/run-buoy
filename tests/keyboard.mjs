import assert from 'node:assert/strict'

export const failures = []
export async function check(label, action) {
 try { await action() } catch (error) { failures.push(`${label}: ${error.message}`) }
}

// Reach controls with actual sequential keyboard navigation, never locator.focus().
async function tabTo(page, target) {
 assert.equal(await target.count(), 1, 'Keyboard target is unique')
 const limit = await page.locator('a[href],button,input,select,textarea,summary,[tabindex]').count() + 8
 for (let step = 0; step < limit; step++) {
  if (await target.evaluate(element => element === document.activeElement)) return
  await page.keyboard.press('Tab')
 }
 assert.fail(`Keyboard could not reach ${await target.evaluate(element => element.outerHTML.slice(0, 180))}`)
}
export async function focused(page, target, label) {
 assert.equal(await target.count(), 1, 'Keyboard target is unique')
 if (await target.evaluate(element => element === document.activeElement)) await page.keyboard.press('Tab')
 const restingShadow = await target.evaluate(element => getComputedStyle(element).boxShadow)
 await tabTo(page, target)
 await check(label, async () => {
  const state = await target.evaluate((element, restingShadow) => {
   const style = getComputedStyle(element), rect = element.getBoundingClientRect()
   const x = Math.max(0, Math.min(innerWidth - 1, rect.x + rect.width / 2))
   const y = Math.max(0, Math.min(innerHeight - 1, rect.y + rect.height / 2))
   const top = document.elementFromPoint(x, y)
   return { control: element.tagName + '#' + element.id + '[name=' + (element.getAttribute('name') || element.getAttribute('aria-label') || '') + ']', width: innerWidth, rect: {left:rect.left, top:rect.top, width:rect.width, height:rect.height}, covering: top && {tag:top.tagName,id:top.id,class:typeof top.className === 'string' ? top.className : ''}, keyboardFocus: element.matches(':focus-visible'), ring: (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || (style.boxShadow !== 'none' && style.boxShadow !== restingShadow),
    visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
    obscured: !top || !(element === top || element.contains(top) || top.contains(element)) }
  }, restingShadow)
  assert.ok(state.keyboardFocus && state.ring, 'Focused control has a visible outline or shadow')
  assert.ok(state.visible && !state.obscured, 'Focused control is visible and unobscured: ' + JSON.stringify(state))
 })
}
