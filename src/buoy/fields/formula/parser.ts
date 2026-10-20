import { tokenize, type Token } from './tokenizer'

export type Expression =
  | { kind: 'literal'; value: number | string | boolean }
  | { kind: 'field'; name: string }
  | { kind: 'unary'; operator: string; operand: Expression }
  | { kind: 'binary'; operator: string; left: Expression; right: Expression }
  | { kind: 'call'; name: string; args: Expression[] }

const precedence: Record<string, number> = { '==': 1, '!=': 1, '<': 1, '<=': 1, '>': 1, '>=': 1, '+': 2, '-': 2, '*': 3, '/': 3 }
const arity: Record<string, number> = { if: 3, days: 2, sum: 1, avg: 1, count: 1 }
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])

export function parseFormula(source: string): Expression {
  const tokens = tokenize(source)
  let cursor = 0
  let nodes = 0
  const current = (): Token => tokens[cursor]
  const fail = (message: string): never => { throw new Error(`${message} At character ${current().position + 1}.`) }
  const accept = (text: string): boolean => {
    if (current().text !== text) return false
    cursor++
    return true
  }
  const expect = (text: string) => { if (!accept(text)) fail(`Expected "${text}".`) }
  const node = (expression: Expression): Expression => {
    if (++nodes > 256) fail('Formula exceeds 256 expression nodes.')
    return expression
  }
  const expression = (minimum: number, depth: number): Expression => {
    if (depth > 32) fail('Formula exceeds 32 nesting levels.')
    const token = current()
    let left: Expression
    if (accept('(')) {
      left = expression(0, depth + 1)
      expect(')')
    } else if (token.text === '+' || token.text === '-') {
      cursor++
      left = node({ kind: 'unary', operator: token.text, operand: expression(4, depth + 1) })
    } else if (token.kind === 'number' || token.kind === 'string') {
      cursor++
      left = node({ kind: 'literal', value: token.value! })
    } else if (token.kind === 'identifier') {
      cursor++
      if (token.text.split('.').some(part => forbidden.has(part))) fail('This field path is not allowed.')
      if (accept('(')) {
        if (!Object.hasOwn(arity, token.text)) fail(`Unknown function "${token.text}".`)
        const args: Expression[] = []
        if (!accept(')')) {
          do { args.push(expression(0, depth + 1)) } while (accept(','))
          expect(')')
        }
        if (args.length !== arity[token.text]) fail(`${token.text} requires ${arity[token.text]} arguments.`)
        if (['sum', 'avg', 'count'].includes(token.text) && args[0].kind !== 'field') fail(`${token.text} requires a direct field reference.`)
        left = node({ kind: 'call', name: token.text, args })
      } else if (token.text === 'true' || token.text === 'false') {
        left = node({ kind: 'literal', value: token.text === 'true' })
      } else {
        left = node({ kind: 'field', name: token.text })
      }
    } else {
      return fail('Expected a number, string, boolean, field or function.')
    }
    while (Object.hasOwn(precedence, current().text) && precedence[current().text] >= minimum) {
      const operator = current().text
      cursor++
      const right = expression(precedence[operator] + 1, depth + 1)
      left = node({ kind: 'binary', operator, left, right })
    }
    return left
  }
  const result = expression(0, 0)
  if (current().kind !== 'end') fail('Unexpected token.')
  return result
}

export function fieldReferences(expression: Expression): string[] {
  if (expression.kind === 'field') return [expression.name]
  if (expression.kind === 'unary') return fieldReferences(expression.operand)
  if (expression.kind === 'binary') return [...fieldReferences(expression.left), ...fieldReferences(expression.right)]
  if (expression.kind === 'call') return expression.args.flatMap(fieldReferences)
  return []
}
