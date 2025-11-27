import type { ComponentType } from 'react'
import type { DestinationActionType } from '../../../lib/types/destinationAction'
import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'
import type { GenericTrade } from '@1delta/lib-utils'
import { getRegisteredActions } from './actionRegistry'
import type { DestinationActionHandler } from './types'

export type ActionType = string
export type ActionCategory = 'all' | 'defi' | 'lending' | 'gaming' | 'yield'

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals: number; address: string; chainId: string }>>

export interface ActionLoaderContext {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  tokenLists?: TokenListsMeta
  chainId?: string
}

export interface ActionPanelContext {
  tokenLists?: TokenListsMeta
  setDestinationInfo?: DestinationActionHandler
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  slippage?: number
  chainId?: string
  actionData?: any
  marketsReady?: boolean
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  requiresExactDestinationAmount?: boolean
  destinationInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
  isRequoting?: boolean
}

export interface ActionReadinessContext {
  marketsReady: boolean
  marketsLoading: boolean
  srcCurrency?: RawCurrency
}

export type DataLoader = (context: ActionLoaderContext) => Promise<any>
export type PanelPropsBuilder = (context: ActionPanelContext) => Record<string, any>
export type ReadinessChecker = (context: ActionReadinessContext) => boolean

export interface ActionDefinition {
  id: ActionType
  label: string
  category: ActionCategory
  icon: ComponentType<{ className?: string }>
  panel: ComponentType<any>
  priority: number
  actionType: DestinationActionType
  requiresSrcCurrency?: boolean
  requiresMarkets?: boolean
  requiresExactDestinationAmount?: boolean
  dataLoader?: DataLoader
  buildPanelProps?: PanelPropsBuilder
  isReady?: ReadinessChecker
}

export { getRegisteredActions }

export const CATEGORIES: { id: ActionCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'defi', label: 'DeFi' },
  { id: 'lending', label: 'Lending' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'yield', label: 'Yield' },
]

// Get actions filtered by category
export function getActionsByCategory(category: ActionCategory, srcCurrency?: RawCurrency): ActionDefinition[] {
  const actions = getRegisteredActions()
  if (category === 'all') {
    return actions.filter((action) => !action.requiresSrcCurrency || srcCurrency)
  }
  return actions.filter((action) => action.category === category && (!action.requiresSrcCurrency || srcCurrency))
}
