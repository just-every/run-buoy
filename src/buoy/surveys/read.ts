import {insist,stmt,type Actor} from '../core'
import {surveyInputs} from './snapshot'
import {SURVEY_INTERPRETATION} from './model'

export async function surveyReader(db:D1Database,actor:Actor){
 insist(actor.kind==='person'&&['owner','admin','member'].includes(actor.role),'Survey responses require a staff session.',403)
 const person=await stmt(db,"SELECT id FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin','member')",actor.id).first()
 insist(person,'Survey responses require an active staff session.',403)
}
export async function surveyState(db:D1Database,actor:Actor,on=new Date().toISOString()){
 await surveyReader(db,actor)
 const data=await surveyInputs(db,on)
 return {on:data.on,accounts:data.accounts,people:data.value.people,responses:data.accounts.flatMap(account=>account.responses),interpretation:SURVEY_INTERPRETATION}
}
