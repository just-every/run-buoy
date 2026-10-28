import assert from 'node:assert/strict'
import {focused} from './a11y-checks.mjs'

export async function show(page, disclosure) {
 if (await disclosure.evaluate(element => element.open)) return
 await focused(page, disclosure.locator(':scope > summary'), 'Disclosure keyboard focus')
 await page.keyboard.press('Enter')
 assert.ok(await disclosure.evaluate(element => element.open), 'Keyboard opens the disclosure')
}

export async function choose(page, select, value) {
 const values = await select.locator('option').evaluateAll(options => options.filter(option => !option.disabled).map(option => option.value))
 const index = values.indexOf(value)
 assert.ok(index >= 0, 'The requested select choice is available')
 await focused(page, select, 'Select keyboard focus')
 const current = values.indexOf(await select.inputValue())
 assert.ok(current >= 0, 'The current select choice is available')
 for (let step = 0; step < Math.abs(index - current); step++) await page.keyboard.press(index > current ? 'ArrowDown' : 'ArrowUp')
 await page.keyboard.press('Tab')
 assert.equal(await select.inputValue(), value, 'Keyboard selection retains the chosen value')
}
