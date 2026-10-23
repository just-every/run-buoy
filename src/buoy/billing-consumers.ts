import {generateRenewals} from './renewals'
import type {Bindings} from '../auth.server'
import {recalculateScorecards} from './scorecards'
import {scheduledSegments} from './segments'
import {flushNotifications} from './notify-mail'
import {recordHealthAlerts} from './notify'
import {runPlaybooks} from './play/engine'

/** Provider delivery finishes with the same downstream work as a staff source
 * refresh. No session or agent authority is invented for a signed event. */
export async function refreshBillingConsumers(env:Bindings){
 await generateRenewals(env.DB)
 await recalculateScorecards(env.DB)
 await scheduledSegments(env.DB,new Date())
 await runPlaybooks(env.DB)
 await recordHealthAlerts(env.DB)
 await flushNotifications(env)
}
