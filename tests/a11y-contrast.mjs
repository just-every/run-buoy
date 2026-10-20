import assert from 'node:assert/strict'

// Axe cannot resolve text over CSS grid/gradient backgrounds. Check the actual
// computed foreground against the painted background colours, including alpha
// layers and gradient interpolation. Decorative/hidden text is not a label.
export async function contrast(page) {
 const findings = await page.evaluate(() => {
  const rgba = value => {
   if (value === 'transparent') return [0, 0, 0, 0]
   const values = value.match(/[\d.]+/g)?.map(Number)
   if (!values || values.length < 3) throw new Error('Unsupported computed colour')
   if (value.startsWith('color(srgb ')) return [...values.slice(0, 3).map(v => v * 255), values[3] ?? 1]
   if (!value.startsWith('rgb')) throw new Error('Unsupported computed colour space')
   return [...values.slice(0, 3), values[3] ?? 1]
  }
  const mix = (a, b, fraction) => {
   const alpha = a[3] * (1 - fraction) + b[3] * fraction
   return [...a.slice(0, 3).map((value, channel) => alpha ? (value * a[3] * (1 - fraction) + b[channel] * b[3] * fraction) / alpha : 0), alpha]
  }
  const over = (front, back) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]))
  const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
   .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  const backgrounds = (element, rects) => {
   const chain = []; for (let p = element; p; p = p.parentElement) chain.unshift(p)
   let colours = [[255, 255, 255]]
   for (const p of chain) {
    const style = getComputedStyle(p)
    colours = colours.map(back => over(rgba(style.backgroundColor), back))
    if (style.backgroundImage === 'none') continue
    // Native select chevrons occupy the padded edge, outside its text area.
    if (p.matches('select') && parseFloat(style.paddingRight) >= 40) continue
    if (!style.backgroundImage.includes('gradient(')) throw new Error('Text background needs manual image inspection')
    const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)|color\(srgb [^)]+\)/g)].map(match => rgba(match[0]))
    if (stops.length < 2) throw new Error('Gradient has no resolved colour stops')
    let samples = [...stops]
    if (style.backgroundImage.startsWith('linear-gradient(') && (style.backgroundImage.match(/gradient\(/g) || []).length === 1 && !/\)\s*-?[\d.]+(?:%|px)/.test(style.backgroundImage)) {
     // A chrome gradient's end colour is outside its padded label. Measure
     // the background under the text, not a colour at the far edge of a chip.
     const direction = style.backgroundImage.match(/linear-gradient\(([^,]+),/)[1].trim()
     const angles = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 }
     if (!direction.endsWith('deg') && !(direction in angles) && !/^(?:rgba?|color)\(/.test(direction)) throw new Error('Unsupported gradient direction')
     const angle = direction.endsWith('deg') ? parseFloat(direction) : (angles[direction] ?? 180)
     const radians = angle * Math.PI / 180, dx = Math.sin(radians), dy = -Math.cos(radians)
     const box = p.getBoundingClientRect(), length = Math.abs(box.width * dx) + Math.abs(box.height * dy)
     const progress = (x, y) => Math.max(0, Math.min(1, 0.5 + ((x - box.x - box.width / 2) * dx + (y - box.y - box.height / 2) * dy) / length))
     samples = rects.flatMap(rect => [[rect.left, rect.top], [rect.right, rect.top], [rect.left, rect.bottom], [rect.right, rect.bottom]])
      .map(([x, y]) => {
       const position = progress(x, y) * (stops.length - 1), left = Math.min(stops.length - 2, Math.floor(position)), fraction = position - left
       return mix(stops[left], stops[left + 1], fraction)
      })
    } else {
     for (let i = 1; i < stops.length; i++) for (let step = 1; step < 10; step++) {
      samples.push(mix(stops[i - 1], stops[i], step / 10))
     }
    }
    colours = colours.flatMap(back => samples.map(front => over(front, back)))
    // Repeated transparent grid stops need only one identical painted colour.
    colours = [...new Map(colours.map(value => [value.map(v => v.toFixed(3)).join(','), value])).values()]
   }
   return colours
  }
  const failures = [], checked = new Set(), modal = document.querySelector('dialog[open]')
  const inspect = (element, rects) => {
   if (checked.has(element) || element.closest('[aria-hidden="true"],[inert],:disabled') || (modal && !modal.contains(element))) return
   const style = getComputedStyle(element)
   if (style.visibility !== 'visible' || !rects.some(r => r.width > 2 && r.height > 2)) return
   for (let p = element; p; p = p.parentElement) {
    const hidden = getComputedStyle(p)
    if (hidden.clipPath === 'inset(50%)' || /^rect\(0px,? 0px,? 0px,? 0px\)$/.test(hidden.clip)) return
   }
   let opacity = 1
   for (let p = element; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity)
   if (opacity === 0) return
   checked.add(element)
   const foreground = rgba(style.color); foreground[3] *= opacity
   const size = parseFloat(style.fontSize), weight = Number(style.fontWeight)
   const minimum = size >= 24 || (size >= 18.6667 && weight >= 700) ? 3 : 4.5
   const worst = Math.min(...backgrounds(element, rects).map(back => ratio(over(foreground, back), back)))
   if (worst < minimum) failures.push({ tag: element.tagName, class: element.className, foreground: style.color, ratio: worst, minimum })
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
   const node = walker.currentNode
   if (!node.textContent.trim() || node.parentElement.closest('script,style,option')) continue
   const range = document.createRange(); range.selectNodeContents(node)
   inspect(node.parentElement, [...range.getClientRects()])
  }
  for (const field of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]),textarea,select')) inspect(field, [field.getBoundingClientRect()])
  return { checked: checked.size, failures }
 })
 assert.ok(findings.checked > 0, 'A11Y-001 checks rendered text contrast')
 assert.deepEqual(findings.failures, [], 'A11Y-001 computed text contrast over grid and gradient backgrounds')
}
