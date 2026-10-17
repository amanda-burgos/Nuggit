import { actions } from './actions'
import { dailies } from './dailies'
import { dip } from './dip'
import { tenderizer } from './tenderizer'

// Every agent of Nuggit, in the order Ajustes lists them.
export const AGENTS = [dip, actions, tenderizer, dailies]

export { actions, dailies, dip, tenderizer }
