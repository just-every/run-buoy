import {insist,object} from '../core'

/** Exact raw-category keys; a multi-select is one order-independent combination. */
export function categoryKey(value:unknown):string|null {
 if(typeof value==='string'||typeof value==='boolean')return String(value)
 if(typeof value==='number'&&Number.isFinite(value))return String(value)
 if(Array.isArray(value)&&value.every(item=>typeof item==='string'))return JSON.stringify([...value].sort())
 return null
}

export function categoryValues(input:unknown):Record<string,number> {
 const entries=Object.entries(object(input))
 insist(entries.length>0&&entries.length<=100,'Provide 1–100 explicit category values.')
 for(const [key,value] of entries){
  insist(key.length<=1000&&!/[\u0000-\u001f\u007f-\u009f]/u.test(key),'Category keys must be up to 1000 characters without control characters.')
  insist(typeof value==='number'&&Number.isFinite(value),'Category values must be finite numbers.')
 }
 return Object.fromEntries(entries) as Record<string,number>
}
