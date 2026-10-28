// Fake only the external OIDC provider; Buoy's link, JWT and session doors run unchanged.
import assert from 'node:assert/strict'
import {generateKeyPairSync,createPublicKey,createHash,sign,verify,randomBytes} from 'node:crypto'

const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
export function portalIdentityEdge(instant){
 const issuer='https://portal-idp.example.test',clientId='synthetic-buoy-portal-client',kid='synthetic-buoy-portal-signing'
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk={...publicKey.export({format:'jwk'}),kid,alg:'ES256',use:'sig'}
 const codes=new Map();let clientKeys=[],tokenCalls=0
 const jwt=claims=>{const value=encode({alg:'ES256',kid,typ:'JWT'})+'.'+encode(claims);return value+'.'+sign('sha256',Buffer.from(value),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}
 const edge={issuer,clientId,bindings:()=>({INSTALLATION_KEY:randomBytes(32).toString('hex')}),
  async fetch(request){
   const url=new URL(request.url);assert.equal(url.origin,issuer)
   if(url.pathname==='/.well-known/openid-configuration')return Response.json({issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],response_modes_supported:['query'],grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256'],id_token_signing_alg_values_supported:['ES256'],token_endpoint_auth_methods_supported:['private_key_jwt'],token_endpoint_auth_signing_alg_values_supported:['ES256'],authorization_response_iss_parameter_supported:true,rer_interfaces:['oidc-provider@1.0.0']})
   if(url.pathname==='/.well-known/rer-provider')return Response.json({issuer,interface:'oidc-provider@1',version:1,initiate:issuer+'/link/initiate',redeem:issuer+'/link/redeem',deregister:issuer+'/link/deregister'})
   if(url.pathname==='/link/redeem'){
    const input=await request.json();assert.equal(input.code,'synthetic-buoy-portal-link-code');assert.ok(input.origin&&input.callback&&input.sector_id)
    return Response.json({issuer,interface:'oidc-provider@1',origin:input.origin,callback:input.callback,sector_id:input.sector_id,client_id:clientId})
   }
   if(url.pathname==='/jwks')return Response.json({keys:[jwk]})
   if(url.pathname==='/token'){
    const form=new URLSearchParams(await request.text()),transaction=codes.get(form.get('code'));assert.ok(transaction,'Authorization code is fresh and belongs to a started transaction');codes.delete(form.get('code'))
    assert.equal(form.get('grant_type'),'authorization_code');assert.equal(form.get('redirect_uri'),transaction.redirectUri);assert.equal(form.get('client_id'),clientId)
    assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),transaction.challenge)
    const [header,payload,signature]=form.get('client_assertion').split('.'),metadata=JSON.parse(Buffer.from(header,'base64url')),claims=JSON.parse(Buffer.from(payload,'base64url'))
    assert.ok(verify('sha256',Buffer.from(header+'.'+payload),{key:createPublicKey({key:clientKeys.find(key=>key.kid===metadata.kid),format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),'The actual linked application signs its token exchange')
    assert.equal(claims.iss,clientId);assert.equal(claims.sub,clientId);assert.equal(claims.aud,issuer+'/token')
    tokenCalls++;const seconds=Math.floor(instant/1000)
    return Response.json({id_token:jwt({iss:issuer,sub:transaction.subject,aud:clientId,iat:seconds,exp:seconds+300,nonce:transaction.nonce,email:transaction.email,email_verified:true,email_verified_at:seconds})})
   }
   if(url.pathname==='/link/deregister')return Response.json({deregistered:true})
   assert.fail('Unexpected identity provider path: '+url.pathname)
  },
  async link(app){
   await ownerProof(app,'providers:relink')
   let response=await app.request('/auth/dependencies/relink',{cookie:app.cookie,method:'POST',body:{issuer,interface:'oidc-provider@1'}});assert.ok(response.ok,await response.clone().text())
   response=await app.request('/.well-known/rer-link/jwks/oidc-provider@1');assert.equal(response.status,200);clientKeys=(await response.json()).keys
   response=await app.request('/.well-known/rer-link/callback',{method:'POST',body:{issuer,interface:'oidc-provider@1',code:'synthetic-buoy-portal-link-code'}});assert.ok(response.ok,await response.clone().text());assert.equal((await response.json()).linked,true)
   response=await app.request('/auth/settings/identity',{cookie:app.cookie,method:'POST',body:{idpSignIn:true}});assert.equal(response.status,200,await response.clone().text())
  },
  async signIn(app,email,subject){
   const start=await app.request('/auth/oidc/auth/start',{method:'POST',body:{returnTo:'/portal'}});assert.equal(start.status,303,await start.clone().text())
   const authorization=new URL(start.headers.get('location')),code='synthetic-buoy-'+randomBytes(16).toString('hex')
   assert.equal(authorization.origin,issuer);assert.equal(authorization.searchParams.get('client_id'),clientId)
   codes.set(code,{email,subject,nonce:authorization.searchParams.get('nonce'),challenge:authorization.searchParams.get('code_challenge'),redirectUri:authorization.searchParams.get('redirect_uri')})
   const binding=cookies(start),path='/auth/oidc/auth/callback?'+new URLSearchParams({code,state:authorization.searchParams.get('state'),iss:issuer})
   return app.request(path,{cookie:binding})
  },
  get tokenCalls(){return tokenCalls}
 }
 return edge
}
export const cookies=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
export async function ownerProof(app,action){
 const response=await app.request('/auth/step-up',{cookie:app.cookie,method:'POST',body:{action}});assert.equal(response.status,202)
 const message=app.mails.findLast(value=>value.to.includes(['owner','example.test'].join('@'))),link=new URL(message.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'))
 const confirmed=await app.request('/auth/confirm',{cookie:app.cookie,method:'POST',body:{token:link.searchParams.get('token')}});assert.equal(confirmed.status,303)
}
