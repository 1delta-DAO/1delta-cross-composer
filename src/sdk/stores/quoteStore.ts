import type { Quote } from '../services/quoteService'

export type QuoteStatus = 'idle' | 'fetching' | 'success' | 'error'

export interface QuoteStateIdle {
  status: 'idle'
}

export interface QuoteStateFetching {
  status: 'fetching'
  key: string
  startedAt: number
}

export interface QuoteStateSuccess {
  status: 'success'
  key: string
  quotes: Quote[]
  fetchedAt: number
  selectedIndex: number
}

export interface QuoteStateError {
  status: 'error'
  key: string
  error: string
}

export type QuoteState =
  | QuoteStateIdle
  | QuoteStateFetching
  | QuoteStateSuccess
  | QuoteStateError

export type QuoteAction =
  | { type: 'FETCH_START'; key: string }
  | { type: 'FETCH_SUCCESS'; key: string; quotes: Quote[] }
  | { type: 'FETCH_ERROR'; key: string; error: string }
  | { type: 'SELECT_QUOTE'; index: number }
  | { type: 'CLEAR' }
  | { type: 'INVALIDATE' }

export const initialQuoteState: QuoteState = { status: 'idle' }

export function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        status: 'fetching',
        key: action.key,
        startedAt: Date.now(),
      }

    case 'FETCH_SUCCESS':
      if (state.status === 'fetching' && state.key !== action.key) {
        return state
      }
      return {
        status: 'success',
        key: action.key,
        quotes: action.quotes,
        fetchedAt: Date.now(),
        selectedIndex: 0,
      }

    case 'FETCH_ERROR':
      if (state.status === 'fetching' && state.key !== action.key) {
        return state
      }
      return {
        status: 'error',
        key: action.key,
        error: action.error,
      }

    case 'SELECT_QUOTE':
      if (state.status !== 'success') return state
      if (action.index < 0 || action.index >= state.quotes.length) return state
      return {
        ...state,
        selectedIndex: action.index,
      }

    case 'CLEAR':
      return initialQuoteState

    case 'INVALIDATE':
      if (state.status === 'success') {
        return {
          ...state,
          fetchedAt: 0,
        }
      }
      return initialQuoteState

    default:
      return state
  }
}

export function isQuoteStale(state: QuoteState, staleTimeMs: number = 30_000): boolean {
  if (state.status !== 'success') return true
  return Date.now() - state.fetchedAt > staleTimeMs
}

export function getSelectedQuote(state: QuoteState): Quote | undefined {
  if (state.status !== 'success') return undefined
  return state.quotes[state.selectedIndex]
}

export function getQuotes(state: QuoteState): Quote[] {
  if (state.status !== 'success') return []
  return state.quotes
}

export function isFetching(state: QuoteState): boolean {
  return state.status === 'fetching'
}

export function hasError(state: QuoteState): boolean {
  return state.status === 'error'
}

export function getError(state: QuoteState): string | undefined {
  if (state.status !== 'error') return undefined
  return state.error
}

