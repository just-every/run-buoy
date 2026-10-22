import {fieldValue,type Definition} from '../fields/model'
import {changes} from '../fields'
import {insist,stmt,type Actor} from '../core'
import type {Image} from '../segments/snapshot'
export function checkedValues(definitions:Definition[],input:Record<string,unknown>){
 return Object.fromEntries(Object.entries(input).map(([key,value])=>{const field=definitions.find(d=>d.key===key);insist(field&&field.type!=='formula','Choose existing writable custom fields.');return [key,fieldValue(field,value)]}))
}
export function fieldWrites(db:D1Database,actor:Actor,image:Image,accountId:string,input:Record<string,unknown>,reference:string){
 const before=image.custom.accounts.find(a=>a.id===accountId);insist(before,'Account not found.',404)
 const values={...before.manual,...checkedValues(image.custom.definitions,input)},next={...image.custom,accounts:image.custom.accounts.map(a=>a.id===accountId?{...a,manual:values}:a)}
 return [stmt(db,'INSERT INTO buoy_field_values(account_id,document) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET document=excluded.document',accountId,JSON.stringify(values)),...changes(db,actor,next,'Approved playbook step: '+reference,accountId)]
}
export function fieldDiff(image:Image,accountId:string,input:Record<string,unknown>){
 const before=image.custom.accounts.find(a=>a.id===accountId)?.manual??{}
 return Object.fromEntries(Object.entries(input).map(([key,value])=>[key,{before:before[key]??null,after:value}]))
}
