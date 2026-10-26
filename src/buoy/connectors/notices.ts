import {stmt} from '../core'
/** In-app notices only. Provider failures authorize no outbound message. */
export function connectionNotice(db:D1Database,connectionId:string,source:string,at:string){
 return stmt(db,`INSERT OR IGNORE INTO buoy_connection_notices(id,connection_id,person_id,source,title,body,created_at)
  SELECT lower(hex(randomblob(16))),c.id,o.id,?,'Reconnect Stripe source','Stripe source is disconnected or failed. Retained dependent evidence has reduced confidence; review its connection.',?
  FROM buoy_connections c JOIN oa_operators o ON o.status='active' AND o.role IN ('owner','admin') WHERE c.id=?`,source,at,connectionId)
}
