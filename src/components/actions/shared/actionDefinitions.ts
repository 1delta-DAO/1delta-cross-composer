import type { ComponentType } from 'react'
import type { RawCurrency, RawCurrencyAmount } from '../../../types/currency'
import type { GenericTrade } from '@1delta/lib-utils'
import { getRegisteredActions } from './actionRegistry'
import type { ActionHandler } from './types'

export type ActionType = string
export type ActionCategory = 'all' | 'defi' | 'lending' | 'gaming' | 'yield'
export type ActionDirection = 'input' | 'destination'

export interface ActionLoaderContext {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
}

export interface InputActionLoaderContext {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
}

export interface ActionPanelContext {
  setDestinationInfo?: ActionHandler
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  slippage?: number
  actionData?: any
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  requiresExactDestinationAmount?: boolean
  destinationInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
  isRequoting?: boolean
}

export interface InputActionPanelContext {
  setInputInfo?: ActionHandler
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  slippage?: number
  actionData?: any
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  inputInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string }
  isRequoting?: boolean
}

export type DataLoader = (context: ActionLoaderContext) => Promise<any>
export type InputDataLoader = (context: InputActionLoaderContext) => Promise<any>
export type PanelPropsBuilder = (
  context: ActionPanelContext | InputActionPanelContext
) => Record<string, any>

export interface ActionDefinition {
  id: ActionType
  label: string
  category: ActionCategory
  icon: ComponentType<{ className?: string }>
  panel: ComponentType<any>
  priority: number
  actionType: ActionType
  actionDirection?: ActionDirection
  requiresSrcCurrency?: boolean
  requiresMarkets?: boolean
  dataLoader?: DataLoader | InputDataLoader
  buildPanelProps?: PanelPropsBuilder

  /** optional checkout summary */
  customSummary?: ComponentType<{
    formattedOutput: string
    dstCurrency?: RawCurrency
    dstChainName?: string
    outputUsd?: number
    destinationActionLabel?: string
  }>
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
export function getActionsByCategory(
  category: ActionCategory,
  srcCurrency?: RawCurrency,
  direction?: ActionDirection
): ActionDefinition[] {
  const actions = getRegisteredActions()
  let filtered = actions

  if (direction) {
    filtered = filtered.filter((action) => (action.actionDirection || 'destination') === direction)
  }

  if (category === 'all') {
    return filtered.filter((action) => !action.requiresSrcCurrency || srcCurrency)
  }
  return filtered.filter(
    (action) => action.category === category && (!action.requiresSrcCurrency || srcCurrency)
  )
}
