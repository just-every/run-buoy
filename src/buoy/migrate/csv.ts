/** RFC 4180 field quoting, including embedded newlines; malformed structure refuses the bundle. */
export function csvRows(text: string): string[][] {
 if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
 const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false
 const endField = () => { row.push(field); field = ''; closed = false }
 const endRow = () => { endField(); rows.push(row); row = [] }
 for (let i=0;i<text.length;i++) {
  const char = text[i]
  if (quoted) {
   if (char === '"') { if (text[i+1] === '"') { field += '"'; i++ } else { quoted = false; closed = true } }
   else field += char
  } else if (char === ',') endField()
  else if (char === '\n' || char === '\r') { if (char === '\r' && text[i+1] === '\n') i++; endRow() }
  else if (closed) throw new Error('Unexpected text after a quoted CSV field.')
  else if (char === '"') { if (field) throw new Error('Quote inside an unquoted CSV field.'); quoted = true }
  else field += char
 }
 if (quoted) throw new Error('Unclosed quoted CSV field.')
 if (field || row.length || closed) endRow()
 if (rows.length < 2 || rows.length > 2001) throw new Error('CSV must contain a header and 1 to 2000 data rows.')
 const header = rows[0]
 if (header.some(name => !name.trim()) || new Set(header).size !== header.length) throw new Error('CSV headers must be nonempty and unique.')
 return rows
}
