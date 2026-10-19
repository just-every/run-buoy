// Chart geometry for the homepage's SVG drawings: every point, marker, bar and pin is placed by its date or value on
// one linear scale, from the records in STRUCTURE.md (desk-buoy/page-s1), never by eye.

/** Day number of a 2026 (or later) calendar date, for linear date scales. */
export const day = (month: number, date: number, year = 2026) => Date.UTC(year, month - 1, date) / 86_400_000

/** A linear scale from [d0, d1] to [r0, r1]. */
export const linear = (d0: number, d1: number, r0: number, r1: number) => (value: number) => r0 + (value - d0) / (d1 - d0) * (r1 - r0)

export const n = (value: number) => Math.round(value * 10) / 10

/** Polyline path through points. */
export const line = (points: [number, number][]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('')

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** US label for a day number: "Mon Oct 5" (weekday computed, so labels and positions cannot disagree). */
export const label = (dayNumber: number, weekday = true) => {
  const date = new Date(dayNumber * 86_400_000)
  return `${weekday ? `${weekdays[date.getUTCDay()]} ` : ''}${months[date.getUTCMonth()]} ${date.getUTCDate()}`
}
