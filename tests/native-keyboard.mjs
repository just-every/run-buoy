import assert from 'node:assert/strict'
import {focused} from './a11y-checks.mjs'

export async function show(page, disclosure) {
 if (await disclosure.evaluate(element => element.open)) return
 await focused(page, disclosure.locator(':scope > summary'), 'Disclosure keyboard focus')
 await page.keyboard.press('Enter')
 assert.ok(await disclosure.evaluate(element => element.open), 'Keyboard opens the disclosure')
}

export async function choose(page, select, value) {
 const choices = await select.locator('option').evaluateAll(options => options.filter(option => !option.disabled).map(option => ({value:option.value,label:option.label})))
 const choice = choices.find(option => option.value === value)
 assert.ok(choice, 'The requested select choice is available')
 await focused(page, select, 'Select keyboard focus')
 // Native type-ahead selects by the option the person reads on either platform.
 if(await select.inputValue() !== value) await page.keyboard.type(choice.label)
 await page.keyboard.press('Tab')
 assert.equal(await select.inputValue(), value, 'Keyboard selection retains the chosen value')
}
