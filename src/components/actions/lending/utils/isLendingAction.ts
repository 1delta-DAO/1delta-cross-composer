import { DeltaCallType } from '@1delta/lib-utils'
import type { ActionCall } from '../../shared/types'

export function isLendingAction(inputCalls: ActionCall[] = []): boolean {
  return (
    inputCalls.length > 0 && inputCalls.some((call) => call?.callType === DeltaCallType.LENDING)
  )
}
