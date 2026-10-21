import type { Expression } from './parser'

type Scalar = number | string | boolean
export type FormulaResult = { value: number | null; explanation: string; inputs: Record<string, unknown> }
const missing = Symbol('missing')

// Own properties only: formulas never traverse prototypes or execute getters.
function readField(record: Record<string, unknown>, path: string): unknown {
  const direct = Object.getOwnPropertyDescriptor(record, path)
  if (direct) return 'value' in direct ? direct.value : missing
  let value: unknown = record
  for (const part of path.split('.')) {
    if (!value || typeof value !== 'object') return missing
    const property = Object.getOwnPropertyDescriptor(value, part)
    if (!property || !('value' in property)) return missing
    value = property.value
  }
  return value
}

function scalar(value: unknown, label: string): Scalar {
  if (value === missing || value === undefined || value === null) throw new Error(`Missing input "${label}".`)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' || typeof value === 'boolean') return value
  throw new Error(`Input "${label}" must be a finite number, string or boolean.`)
}

function numeric(value: Scalar, label: string): number {
  if (typeof value !== 'number') throw new Error(`${label} requires a number; received ${typeof value}.`)
  return value
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Calculation produced a non-finite number.')
  return value
}

function utcDay(value: Scalar): number {
  if (typeof value !== 'string') throw new Error('days requires ISO date strings.')
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value)
  if (!match) throw new Error(`Invalid ISO date "${value}"; use YYYY-MM-DD or an ISO timestamp with a timezone.`)
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const calendar = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day ||
      (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6] ?? 0) > 59))) {
    throw new Error(`Invalid calendar date "${value}".`)
  }
  const instant = Date.parse(value)
  if (!Number.isFinite(instant)) throw new Error(`Invalid ISO date "${value}".`)
  return Math.floor(instant / 86_400_000)
}

function describe(value: unknown): string {
  if (value === missing || value === undefined) return 'missing'
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'string') return JSON.stringify(value)
  return '[non-scalar value]'
}

/** Plain aggregates use the supplied portfolio; children/descendants functions
 * use its explicit native parent links.
 * Currency amounts remain their explicit numeric units; no exchange conversion occurs.
 */
export function evaluateExpression(expression: Expression, values: Record<string, unknown>, portfolio: Record<string, unknown>[]): FormulaResult {
  const inputs: Record<string, unknown> = Object.create(null)
  const evidence: string[] = []
  const aggregate = (name: string, path: string): number => {
    if (portfolio.length > 10_000) throw new Error('Portfolio exceeds the 10000-account formula limit.')
    let records=portfolio
    const hierarchical=/^(children|descendants)(Sum|Avg|Count)$/.exec(name)
    const operation=hierarchical?hierarchical[2].toLowerCase():name
    if(hierarchical){
      if(!Object.hasOwn(values,'__parentId'))throw new Error('Hierarchical functions require account records.')
      const current=readField(values,'id'),parents=new Set([current]),selected=new Set<unknown>()
      do{let added=false;for(const record of portfolio)if(parents.has(readField(record,'__parentId'))&&!selected.has(readField(record,'id'))){selected.add(readField(record,'id'));if(hierarchical[1]==='descendants'){parents.add(readField(record,'id'));added=true}}if(!added)break}while(true)
      records=portfolio.filter(record=>selected.has(readField(record,'id')))
      const currencyPath=path.endsWith('.amountMinor')?path.replace(/\.amountMinor$/,'.currency'):path.startsWith('billing.')&&path.endsWith('Minor')?'billing.currency':null
      if(currencyPath){const currencies=records.map(record=>readField(record,currencyPath));if(currencies.some(value=>typeof value!=='string'))throw new Error('Missing currency for hierarchical money rollup.');if(new Set(currencies).size>1)throw new Error('Hierarchical money rollups refuse mixed currencies; no conversion occurs.')}
    }
    const cohort = records.map((account, index) => {
      const value = readField(account, path)
      const id = readField(account, 'id')
      const accountName = readField(account, 'name')
      return {
        index,
        ...(typeof id === 'string' ? { accountId: id } : {}),
        ...(typeof accountName === 'string' ? { accountName } : {}),
        value: value === missing || value === undefined ? null : value,
        missing: value === missing || value === undefined || value === null,
      }
    })
    const key = `${name}(${path})`
    inputs[`${hierarchical?hierarchical[1]:'portfolio'}.${key}`] = cohort
    evidence.push(`${hierarchical?hierarchical[1]:'Portfolio'} ${key}: [${cohort.map(item => `${item.accountId ?? item.accountName ?? `row ${item.index + 1}`}=${item.missing ? 'missing' : describe(item.value)}`).join(', ')}].`)
    if (operation === 'count') return cohort.filter(item => !item.missing).length
    if (!cohort.length){if(hierarchical&&operation==='sum')return 0;throw new Error(`Portfolio ${key} has no accounts.`)}
    let total = 0
    for (const item of cohort) {
      if (item.missing) throw new Error(`Missing input "${path}" for portfolio account ${item.accountId ?? item.accountName ?? item.index + 1}.`)
      total = finite(total + numeric(scalar(item.value, path), `${key} for portfolio account ${item.accountId ?? item.accountName ?? item.index + 1}`))
    }
    return operation === 'avg' ? finite(total / cohort.length) : total
  }
  const evaluate = (node: Expression): Scalar => {
    if (node.kind === 'literal') return node.value
    if (node.kind === 'field') {
      const value = readField(values, node.name)
      inputs[node.name] = value === missing || value === undefined ? null : value
      evidence.push(`${node.name}=${describe(value)}.`)
      return scalar(value, node.name)
    }
    if (node.kind === 'unary') {
      const value = numeric(evaluate(node.operand), 'Unary arithmetic')
      return node.operator === '-' ? -value : value
    }
    if (node.kind === 'call') {
      if (node.name === 'if') {
        const condition = evaluate(node.args[0])
        if (typeof condition !== 'boolean') throw new Error('if requires a boolean condition.')
        evidence.push(`if selected the ${condition ? 'then' : 'else'} branch.`)
        return evaluate(node.args[condition ? 1 : 2])
      }
      if (node.name === 'days') return utcDay(evaluate(node.args[0])) - utcDay(evaluate(node.args[1]))
      const field = node.args[0]
      if (field.kind !== 'field') throw new Error(`${node.name} requires a direct field reference.`)
      return aggregate(node.name, field.name)
    }
    const left = evaluate(node.left), right = evaluate(node.right)
    if (['+', '-', '*', '/'].includes(node.operator)) {
      const a = numeric(left, 'Arithmetic'), b = numeric(right, 'Arithmetic')
      if (node.operator === '/' && b === 0) throw new Error('Cannot divide by zero.')
      if (node.operator === '+') return finite(a + b)
      if (node.operator === '-') return finite(a - b)
      if (node.operator === '*') return finite(a * b)
      return finite(a / b)
    }
    if (typeof left !== typeof right) throw new Error('Comparisons require values of the same type.')
    if (node.operator === '==') return left === right
    if (node.operator === '!=') return left !== right
    if (typeof left === 'number' && typeof right === 'number') {
      if (node.operator === '<') return left < right
      if (node.operator === '<=') return left <= right
      if (node.operator === '>') return left > right
      return left >= right
    }
    if (typeof left === 'string' && typeof right === 'string') {
      if (node.operator === '<') return left < right
      if (node.operator === '<=') return left <= right
      if (node.operator === '>') return left > right
      return left >= right
    }
    throw new Error('Ordered comparisons require numbers or strings.')
  }
  try {
    const value = evaluate(expression)
    if (typeof value !== 'number') throw new Error('A formula must return a number; booleans may only be used as conditions.')
    finite(value)
    return { value, explanation: `Result: ${value}. ${evidence.join(' ')}`.trim(), inputs }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Formula evaluation failed.'
    return { value: null, explanation: `${message} ${evidence.join(' ')}`.trim(), inputs }
  }
}
