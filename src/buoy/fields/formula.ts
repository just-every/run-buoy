import { evaluateExpression, type FormulaResult } from './formula/evaluate'
import { fieldReferences, parseFormula, functionNames } from './formula/parser'

export type { FormulaResult } from './formula/evaluate'

/** All field paths, including unselected branches and portfolio aggregate arguments. */
export function formulaReferences(source: string): string[] {
  return [...new Set(fieldReferences(parseFormula(source)))]
}

/** Parse without executing and reject references outside the caller's field schema. */
export function validateFormula(source: string, allowed: string[],hierarchy=false): void {
  if(!hierarchy&&functionNames(parseFormula(source)).some(name=>/^(children|descendants)/.test(name)))throw new Error('Hierarchical functions require account fields.')
  const known = new Set(allowed)
  const unknown = formulaReferences(source).filter(name => !known.has(name))
  if (unknown.length) throw new Error(`Unknown field reference${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`)
}

/** Evaluate against real account snapshots. Missing values never become numeric zero. */
export function evaluateFormula(source: string, values: Record<string, unknown>, portfolio: Record<string, unknown>[]): FormulaResult {
  try {
    return evaluateExpression(parseFormula(source), values, portfolio)
  } catch (error) {
    return {
      value: null,
      explanation: error instanceof Error ? error.message : 'Formula evaluation failed.',
      inputs: {},
    }
  }
}
