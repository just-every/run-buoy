import {evaluateConsumers} from './consumers-model'
import type {Image} from '../segments/snapshot'
/** Peer inputs can change aggregate health without changing this account's
 * revision. Keep the aggregate evidence bound to every prepared playbook. */
export async function aggregateProof(image:Image,accountId:string){
 const rules=image.consumers.filter(r=>r.enabled&&r.health&&r.scope==='segment')
 if(!rules.length)return undefined
 const evidence=evaluateConsumers(rules,accountId,image.adoption)
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(evidence)))
 return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')
}
