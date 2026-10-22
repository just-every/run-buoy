import {writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {d1,query} from './commands.mjs'

export const volume={accounts:10_000,people:500_000,events:50_000_000}
export const synthetic=n=>'synthetic-buoy-'+n
export function accountInput(n,on){return {id:synthetic(n),name:synthetic(n),renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:synthetic(90_000_001),billing:{observedAt:on,reference:synthetic(90_000_002),currency:'USD',totalMinor:10000,creditsMinor:0,allocatedMinor:10000,dueDate:'2027-12-31'},support:{observedAt:on,reference:synthetic(90_000_003),openTickets:0,urgentTickets:0}}}
const literal=value=>"'"+String(value).replaceAll("'","''")+"'"
const range=(start,end)=>`WITH RECURSIVE n(i) AS (SELECT ${start} UNION ALL SELECT i+1 FROM n WHERE i+1<${end})`
const chunked=(total,statement)=>Array.from({length:Math.ceil(total/10000)},(_,index)=>statement(range(index*10000,Math.min(total,(index+1)*10000)))).join('\n')
async function execute(root,name,sql){
 const path=join(root,name+'.sql');await writeFile(path,sql,{mode:0o600})
 await d1(root,['--file',path])
}
export async function seedDirectory(root,on,sourceId,ownerId,baselineAccountId){
 const stamp=on+'T12:00:00.000Z',account=accountInput(0,on)
 await execute(root,'scale-directory',[
  `${range(1,volume.accounts)} INSERT INTO buoy_accounts(id,document,revision,created_at) SELECT 'synthetic-buoy-'||i,json_set(${literal(JSON.stringify(account))},'$.id','synthetic-buoy-'||i,'$.name','synthetic-buoy-'||i),'synthetic-buoy-'||i,${literal(stamp)} FROM n;`,
  chunked(volume.people,cte=>`${cte} INSERT INTO buoy_customer_people(id,kind,name,revision,created_at) SELECT 'synthetic-buoy-'||(1000000+i),'user','synthetic-buoy-'||(1000000+i),'synthetic-buoy-'||(1000000+i),${literal(stamp)} FROM n;`),
  chunked(volume.people,cte=>`${cte} INSERT INTO buoy_customer_memberships(person_id,account_id) SELECT 'synthetic-buoy-'||(1000000+i),CASE WHEN i%${volume.accounts}=0 THEN ${literal(baselineAccountId)} ELSE 'synthetic-buoy-'||(i%${volume.accounts}) END FROM n;`),
  chunked(volume.people,cte=>`${cte} INSERT INTO buoy_usage_mappings(source_id,claim_key,user_id,group_id,account_id,person_id,revision,reviewed_by,reviewed_at) SELECT ${literal(sourceId)},json_array('synthetic-buoy-'||(1000000+i),CASE WHEN i%${volume.accounts}=0 THEN ${literal(baselineAccountId)} ELSE 'synthetic-buoy-'||(i%${volume.accounts}) END),'synthetic-buoy-'||(1000000+i),CASE WHEN i%${volume.accounts}=0 THEN ${literal(baselineAccountId)} ELSE 'synthetic-buoy-'||(i%${volume.accounts}) END,CASE WHEN i%${volume.accounts}=0 THEN ${literal(baselineAccountId)} ELSE 'synthetic-buoy-'||(i%${volume.accounts}) END,'synthetic-buoy-'||(1000000+i),'synthetic-buoy-'||(1000000+i),${literal(ownerId)},${literal(stamp)} FROM n;`)
 ].join('\n'))
}
export async function seedEvents(root,sourceId,on,start,end,baselineAccountId){
 const statements=[]
 // Bounded statements keep each query short; no huge JS array of event objects.
 for(let offset=start;offset<end;offset+=10000){
  const until=Math.min(end,offset+10000)
  statements.push(`${range(offset,until)} INSERT INTO buoy_usage_events(id,source_id,message_id,type,event,user_id,group_id,observed_at,received_at,source_reference,source_system,payload)
 SELECT 'synthetic-buoy-'||(2000000+i),${literal(sourceId)},'synthetic-buoy-'||(2000000+i),'event',${literal(synthetic(90_000_004))},'synthetic-buoy-'||(1000000+i%${volume.people}),CASE WHEN i%${volume.accounts}=0 THEN ${literal(baselineAccountId)} ELSE 'synthetic-buoy-'||(i%${volume.accounts}) END,
 strftime('%Y-%m-%dT%H:%M:%fZ',${literal(on+'T23:59:59Z')},'-'||(i%2592000)||' seconds'),${literal(on+'T23:59:59.000Z')},${literal(synthetic(90_000_005))},'native',
 json_object('messageId','synthetic-buoy-'||(2000000+i),'type','event','event',${literal(synthetic(90_000_004))},'userId','synthetic-buoy-'||(1000000+i%${volume.people}),'groupId',CASE WHEN i%${volume.accounts}=0 THEN ${literal(baselineAccountId)} ELSE 'synthetic-buoy-'||(i%${volume.accounts}) END,'timestamp',strftime('%Y-%m-%dT%H:%M:%fZ',${literal(on+'T23:59:59Z')},'-'||(i%2592000)||' seconds'),'properties',json_object('value',i%100)) FROM n;`)
 }
 await execute(root,'scale-events',statements.join('\n'))
}
export async function inventory(root){
 const [row]=await query(root,`SELECT (SELECT count(*) FROM buoy_accounts) AS accounts,(SELECT count(*) FROM buoy_customer_people WHERE kind='user') AS people,(SELECT count(*) FROM buoy_customer_memberships) AS memberships,(SELECT count(*) FROM buoy_usage_mappings) AS mappings,(SELECT count(*) FROM buoy_usage_events) AS events,(SELECT coalesce(sum(length(CAST(payload AS BLOB))),0) FROM buoy_usage_events) AS payloadBytes,(SELECT coalesce(sum(CAST(substr(message_id,16) AS INTEGER)),0) FROM buoy_usage_events) AS messageSum,(SELECT min(observed_at) FROM buoy_usage_events) AS firstObservedAt,(SELECT max(observed_at) FROM buoy_usage_events) AS lastObservedAt`)
 return row
}
