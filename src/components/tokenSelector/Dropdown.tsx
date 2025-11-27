import { Logo } from '../common/Logo'
import { RelevantTokensBar } from './RelevantTokens'
import { TokenRow } from './TokenRow'
import { CommonViewProps } from './types'

type DropdownProps = CommonViewProps & {
  dropdownRef: React.RefObject<HTMLDivElement>
  open: boolean
  setOpen: (v: boolean) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  showSearch: boolean
  listsLoading: boolean
  selected: any
}

export function TokenSelectorDropdownMode({
  dropdownRef,
  open,
  setOpen,
  chainId,
  chains,
  relevant,
  rows,
  tokensMap,
  balances,
  prices,
  balancesLoading,
  pricesLoading,
  userAddress,
  searchQuery,
  setSearchQuery,
  showSearch,
  listsLoading,
  selected,
  onChange,
}: DropdownProps) {
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="btn btn-outline w-full flex items-center gap-2"
        onClick={() => setOpen(!open)}
      >
        <Logo
          src={selected?.logoURI}
          alt={selected?.symbol || 'Token'}
          fallbackText={selected?.symbol || 'T'}
        />
        <span className="truncate">
          {selected?.symbol || (listsLoading ? 'Loading tokens...' : 'Select token')}
        </span>
        <span className="ml-auto tab">▼</span>
      </button>

      {open && (
        <div className="mt-2 p-2 rounded-box border border-base-300 bg-base-100 shadow-xl absolute z-20 w-full">
          <RelevantTokensBar
            chainId={chainId}
            chains={chains}
            relevant={relevant}
            tokensMap={tokensMap}
            onChange={(addr) => {
              onChange(addr)
              setOpen(false)
            }}
          />

          <div className="divider my-1" />

          {showSearch && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tokens"
              className="input input-bordered w-full mb-2"
            />
          )}

          <div className="max-h-72 overflow-auto">
            {rows.map(({ addr, token }) => (
              <TokenRow
                key={addr}
                addr={addr}
                token={token}
                chainId={chainId}
                chains={chains}
                balances={balances}
                prices={prices}
                balancesLoading={balancesLoading}
                pricesLoading={pricesLoading}
                userAddress={userAddress}
                onClick={() => {
                  onChange(addr)
                  setOpen(false)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
