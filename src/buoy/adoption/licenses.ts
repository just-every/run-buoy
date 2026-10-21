import { accountAudit } from '../audit-records'
import { authority, date, guard, id, insist, now, requirePerson, stmt, text, type Actor } from '../core'

export async function savePersonLicense(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(key=>['accountId','personId','licensed','reference','observedAt','staleDays'].includes(key)),'Unsupported person license property.')
 const accountId=text(input.accountId,'Account ID',200),personId=text(input.personId,'Customer person ID',200),licensed=input.licensed
 insist(licensed===null||typeof licensed==='boolean','Licensed must be true, false, or null to clear.')
 const updatedAt=now(),staleDays=input.staleDays??30
 insist(Number.isInteger(staleDays)&&Number(staleDays)>=1&&Number(staleDays)<=365,'License evidence staleness must be 1–365 whole days.')
 const evidence=licensed===null?null:{sourceSystem:'manual' as const,reference:text(input.reference,'License evidence reference',1000),observedAt:date(input.observedAt,'License observation date'),staleDays:Number(staleDays)}
 const snapshot={licensed,cleared:licensed===null,sourceSystem:'manual',reference:evidence?.reference??null,observedAt:evidence?.observedAt??null,staleDays:evidence?.staleDays??null,updatedAt}
 const missing={licensed:null,cleared:true,sourceSystem:'manual',reference:null,observedAt:null,staleDays:null,updatedAt:null}
 await db.batch([authority(db,actor,true),
  guard(db,'EXISTS(SELECT 1 FROM buoy_customer_memberships WHERE person_id=? AND account_id=?)',personId,accountId),
  // Capture the prior row inside the guarded transaction, before replacing or clearing it.
  stmt(db,`INSERT INTO buoy_adoption_person_license_history(id,account_id,person_id,document,recorded_by,recorded_at)
   SELECT ?,?,?,json_object('oldValue',json(COALESCE((
    SELECT json_object('licensed',json(CASE licensed WHEN 1 THEN 'true' ELSE 'false' END),'cleared',json('false'),
     'sourceSystem',source_system,'reference',reference,'observedAt',observed_at,'staleDays',stale_days,'updatedAt',updated_at)
    FROM buoy_adoption_person_licenses WHERE account_id=? AND person_id=?
   ),?)),'newValue',json(?)),?,?`,id(),accountId,personId,accountId,personId,JSON.stringify(missing),JSON.stringify(snapshot),`person:${actor.id}`,updatedAt),
  licensed===null?stmt(db,'DELETE FROM buoy_adoption_person_licenses WHERE account_id=? AND person_id=?',accountId,personId):
   stmt(db,`INSERT INTO buoy_adoption_person_licenses(account_id,person_id,licensed,source_system,reference,observed_at,stale_days,updated_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(account_id,person_id) DO UPDATE SET licensed=excluded.licensed,source_system=excluded.source_system,reference=excluded.reference,observed_at=excluded.observed_at,stale_days=excluded.stale_days,updated_at=excluded.updated_at`,accountId,personId,licensed?1:0,evidence!.sourceSystem,evidence!.reference,evidence!.observedAt,evidence!.staleDays,updatedAt),
  stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id IN (SELECT account_id FROM buoy_customer_memberships WHERE person_id=?)',personId),
  ...accountAudit(db,actor,accountId,'adoption.person-license-saved'),stmt(db,'DELETE FROM buoy_assertions')])
 return {accountId,personId,...snapshot}
}
