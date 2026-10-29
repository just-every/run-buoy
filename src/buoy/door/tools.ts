import type {Bindings} from '../../auth.server'
import {readTools} from './reads'
import {preparationTools} from './preparations'
import {experimentTools} from './experiments'
export const buoyTools=(env:Bindings)=>[...readTools(env),...preparationTools(env),...experimentTools(env)]
