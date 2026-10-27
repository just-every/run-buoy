import {configurationSignals} from './ai/configuration-signals'
import type {Bindings} from '../auth.server'
import type {Actor} from './core'
import {generateRenewals} from './renewals'
import {refreshRenewalFields} from './renewals/fields'
import {refreshPeople} from './people'
import {refreshFields} from './fields'
import {recalculateScorecards} from './scorecards'
import {reconcile} from './segments'
import {observeOutcomes} from './outcomes/observe'
import {runPlaybooks,alertFailures} from './play/engine'
import {recordAdoptionAlerts} from './adoption/consumers-alerts'
import {flushNotifications} from './notify-mail'

/** Complete the existing native source-consumer path before returning a write. */
export async function refreshAccountConsumers(env:Bindings,actor:Actor){
 await generateRenewals(env.DB)
 await refreshRenewalFields(env.DB,actor)
 await refreshPeople(env.DB,actor)
 await refreshFields(env.DB,actor)
 await recalculateScorecards(env.DB)
 await reconcile(env.DB,actor)
 await observeOutcomes(env.DB,actor)
 await runPlaybooks(env.DB)
 await alertFailures(env.DB)
 await recordAdoptionAlerts(env.DB)
 await configurationSignals(env.DB)
 await flushNotifications(env)
}
