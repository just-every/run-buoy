const accountSchema={type:'object',additionalProperties:false,required:['id','name','renewalDate','noticeDays','renewalEvidence','billing','support'],properties:{
 id:{type:'string',pattern:'^[A-Za-z0-9_-]{1,64}$'},name:{type:'string',minLength:1,maxLength:200},renewalDate:{type:'string',format:'date'},noticeDays:{type:'integer',minimum:0,maximum:3650},renewalEvidence:{type:'string',minLength:1,maxLength:500},revision:{type:'string'},
 billing:{oneOf:[{type:'null'},{type:'object',additionalProperties:false,required:['observedAt','reference','currency','totalMinor','creditsMinor','allocatedMinor','dueDate'],properties:{observedAt:{type:'string',format:'date'},reference:{type:'string',maxLength:500},currency:{type:'string',description:'ISO 4217 code; integer minor units follow its exponent.'},totalMinor:{type:'integer',minimum:0},creditsMinor:{type:'integer',minimum:0},allocatedMinor:{type:'integer',minimum:0},dueDate:{type:'string',format:'date'}}}]},
 support:{oneOf:[{type:'null'},{type:'object',additionalProperties:false,required:['observedAt','reference','openTickets','urgentTickets'],properties:{observedAt:{type:'string',format:'date'},reference:{type:'string',maxLength:500},openTickets:{type:'integer',minimum:0},urgentTickets:{type:'integer',minimum:0}}}]}
}}
// Source custody is returned on reads and is never accepted by account writes.
const observationNumber={type:['number','null']}
const migrationHealthSchema={type:'object',readOnly:true,additionalProperties:false,required:['source','sourceId','score','factors','fields'],properties:{
 source:{const:'churnzero'},sourceId:{type:'string',minLength:1,maxLength:200},score:observationNumber,
 factors:{type:'object',minProperties:1,maxProperties:200,additionalProperties:observationNumber},
 fields:{type:'object',additionalProperties:false,required:['score','factors'],properties:{score:{type:'string'},factors:{oneOf:[{type:'string'},{type:'object',additionalProperties:{type:'string'}}]}}}
}}
const migrationJourneysSchema={type:'array',readOnly:true,maxItems:32,items:{type:'object',additionalProperties:false,
 required:['id','source','sourceAccountId','sourceId','name','state','sourceColumn','mapping','definition','steps','unmapped'],properties:{
  id:{type:'string'},source:{const:'churnzero'},sourceAccountId:{type:'string'},sourceId:{type:'string'},name:{type:'string'},state:{const:'paused'},
  sourceColumn:{type:'string'},mapping:{type:'object'},definition:{type:'object'},
  steps:{type:'array',items:{type:'object',required:['sourceId','position','definition'],properties:{sourceId:{type:'string'},position:{type:'integer',minimum:0},definition:{type:'object'}}}},
  unmapped:{type:'array',items:{type:'object',required:['pointer','reason'],properties:{pointer:{type:'string'},reason:{type:'string'}}}},
  structure:{type:'object',required:['schema','description','expectedDays','progress','milestones'],properties:{schema:{const:'churnzero-journey-v1'},description:{type:['string','null']},expectedDays:{type:['integer','null']},progress:{type:'object'},milestones:{type:'array',items:{type:'object'}}}}
 }}}
const accountReadSchema={...accountSchema,properties:{...accountSchema.properties,migrationHealth:migrationHealthSchema,migrationJourneys:migrationJourneysSchema}}
const json=(schema:unknown)=>({'application/json':{schema}})
const error={description:'Request refused; JSON error explains the required repair.',content:json({type:'object',required:['error'],properties:{error:{type:'string'}}})}
const errors={'400':error,'401':error,'403':error,'404':error,'409':error,'413':error,'415':error,'429':{...error,headers:{'Retry-After':{description:'Whole seconds until the next UTC minute.',schema:{type:'integer',minimum:1}}}}}
const write=(update=false)=>({
 security:[{IntegrationToken:[]}],description:'Requires accounts.write and an explicit account ID grant or an all-accounts grant. Requests are atomic with their replay receipt and audit. A replay returns the original ID and revision, even after a later edit.',
 parameters:[...(update?[{name:'id',in:'path',required:true,schema:{type:'string'}}]:[]),{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',pattern:'^[A-Za-z0-9._-]{1,128}$'}}],
 requestBody:{required:true,content:json(update?{...accountSchema,required:[...accountSchema.required,'revision']}:accountSchema)},
 responses:{[update?'200':'201']:{description:'Committed account reference.',content:json({type:'object',required:['id','revision'],properties:{id:{type:'string'},revision:{type:'string'}}})},...errors}
})
export const openapi={openapi:'3.1.0',info:{title:'Buoy integration API',version:'1.0.0',description:'Partial current API: scoped account reads and writes. Events, other record kinds, bulk upsert and outbound webhooks are not implemented.'},servers:[{url:'/api/buoy/v1'}],components:{securitySchemes:{IntegrationToken:{type:'http',scheme:'bearer',description:'Owner-issued server token. No browser Origin or Fetch Metadata permitted.'}},schemas:{Account:accountReadSchema,AccountWrite:accountSchema}},paths:{
 '/accounts':{get:{security:[{IntegrationToken:[]}],description:'Requires accounts.read. Only granted accounts are included; an all-accounts grant includes future accounts, ordered lexically by ID.',parameters:[{name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:50}},{name:'after',in:'query',schema:{type:'string'}}],responses:{'200':{description:'Page of scoped accounts.',content:json({type:'object',properties:{items:{type:'array',items:accountReadSchema},next:{type:['string','null']}}})},...errors}},post:write()},
 '/accounts/{id}':{get:{security:[{IntegrationToken:[]}],parameters:[{name:'id',in:'path',required:true,schema:{type:'string'}}],description:'Requires accounts.read and an explicit account ID grant or an all-accounts grant.',responses:{'200':{description:'Current account snapshot.',content:json(accountReadSchema)},...errors}},put:write(true)}
}}
