// Domain-separated installation encryption. Only ciphertext is persisted;
// the credential table is excluded from installation archives.
const utf8 = new TextEncoder()
const encode = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0))
async function key(secret: string) {
 return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', utf8.encode('buoy:connector:v1\0'+secret)), 'AES-GCM', false, ['encrypt','decrypt'])
}
export async function seal(secret: string, subject: string, value: string) {
 const iv=crypto.getRandomValues(new Uint8Array(12))
 return encode(iv)+'.'+encode(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8.encode(subject)},await key(secret),utf8.encode(value)))
}
export async function unseal(secret: string, subject: string, sealed: string) {
 const [iv,data]=sealed.split('.')
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:utf8.encode(subject)},await key(secret),decode(data)))
}
