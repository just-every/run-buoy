import assert from 'node:assert/strict'
import { csvRows } from '../src/buoy/migrate/csv.ts'

// Expectations come from seeded accounts and observations, not report arithmetic.
export function assertOutcomeRows(report, expected) {
 for (const cohort of ['enrolled', 'comparison']) {
  const wanted = expected.filter(row => row.cohort === cohort), actual = report[cohort]
  assert.equal(actual.length, wanted.length)
  assert.equal(new Set(actual.map(row => row.accountId)).size, wanted.length)
  assert.deepEqual(actual.map(row => row.accountId).sort(), wanted.map(row => row.accountId).sort())
  for (const row of wanted) {
   const found = actual.find(item => item.accountId === row.accountId)
   for (const key of ['name', 'status', 'reachedAt', 'elapsedHours', 'evidence']) assert.equal(found[key], row[key], `${cohort} ${row.accountId} ${key}`)
  }
  const reached = wanted.filter(row => row.reachedAt)
  const mean = reached.length ? reached.reduce((sum, row) => sum + row.elapsedHours, 0) / reached.length : null
  assert.equal(report[cohort === 'enrolled' ? 'rate' : 'comparisonRate'], reached.length / wanted.length)
  assert.equal(report[cohort === 'enrolled' ? 'meanHours' : 'comparisonMeanHours'], mean)
 }
}

export function assertOutcomeCsv(text, expected, report) {
 const [header, ...rows] = csvRows(text)
 const columns = ['Cohort', 'Account id', 'Account', 'Status', 'First observed UTC', 'Elapsed hours', 'Evidence', 'Current inputs (not outcome snapshot)', 'Interpretation']
 assert.deepEqual([...header].sort(), [...columns].sort(), 'CSV exports every outcome field')
 assert.equal(rows.length, expected.length, 'CSV has no missing or extra accounts')
 const records = rows.map(row => {
  assert.equal(row.length, header.length)
  return Object.fromEntries(header.map((key, index) => [key, row[index]]))
 })
 assert.equal(new Set(records.map(row => row['Account id'])).size, expected.length, 'CSV has no duplicate accounts')
 assert.deepEqual(records.map(row => row['Account id']).sort(), expected.map(row => row.accountId).sort())
 for (const row of expected) {
  const found = records.find(item => item['Account id'] === row.accountId)
  assert.deepEqual(columns.slice(0, 7).map(key => found[key]), [row.cohort, row.accountId, row.name, row.status, row.reachedAt ?? '', row.elapsedHours === null ? '' : String(row.elapsedHours), row.evidence ?? ''], `CSV reconciles ${row.accountId}`)
  const publicRow = report[row.cohort].find(item => item.accountId === row.accountId)
  assert.deepEqual(JSON.parse(found[columns[7]]), publicRow.currentInputs, 'CSV current inputs match the public report')
  assert.equal(found.Interpretation, report.interpretation)
 }
}
