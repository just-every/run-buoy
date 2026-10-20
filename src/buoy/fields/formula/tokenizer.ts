export type Token = { kind: 'number' | 'string' | 'identifier' | 'symbol' | 'end'; text: string; value?: number | string; position: number }

export function tokenize(source: string): Token[] {
  if (source.length > 4096) throw new Error('Formula exceeds 4096 characters.')
  if (!source.trim()) throw new Error('Enter a formula.')
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const position = index
    const character = source[index]
    if (/\s/.test(character)) { index++; continue }
    if (character === '"' || character === "'") {
      const quote = character
      let value = ''
      let closed = false
      index++
      while (index < source.length) {
        const next = source[index++]
        if (next === quote) { closed = true; break }
        if (next === '\\') {
          const escaped = source[index++]
          const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'" }
          if (!Object.hasOwn(escapes, escaped)) throw new Error(`Unsupported string escape at character ${index}.`)
          value += escapes[escaped]
        } else {
          value += next
        }
      }
      if (!closed) throw new Error(`Unclosed string at character ${position + 1}.`)
      tokens.push({ kind: 'string', text: source.slice(position, index), value, position })
    } else {
      const remaining = source.slice(index)
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(remaining)
      const identifier = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(remaining)
      if (number) {
        const value = Number(number[0])
        if (!Number.isFinite(value)) throw new Error(`Non-finite number at character ${position + 1}.`)
        tokens.push({ kind: 'number', text: number[0], value, position })
        index += number[0].length
      } else if (identifier) {
        tokens.push({ kind: 'identifier', text: identifier[0], position })
        index += identifier[0].length
      } else {
        const symbol = /^(?:==|!=|<=|>=|[+\-*/<>(),])/.exec(remaining)
        if (!symbol) throw new Error(`Unexpected character at position ${position + 1}.`)
        tokens.push({ kind: 'symbol', text: symbol[0], position })
        index += symbol[0].length
      }
    }
    if (tokens.length > 1024) throw new Error('Formula exceeds 1024 tokens.')
  }
  tokens.push({ kind: 'end', text: '', position: source.length })
  return tokens
}
