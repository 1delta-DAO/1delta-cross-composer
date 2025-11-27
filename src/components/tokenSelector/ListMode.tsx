import { List, type RowComponentProps } from 'react-window'
import { RelevantTokensBar } from './RelevantTokens'
import { TokenRow } from './TokenRow'
import { CommonViewProps } from './types'

const ROW_HEIGHT = 56
const LIST_HEIGHT = 620

export function TokenSelectorListMode({
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
  onChange,
}: CommonViewProps) {
  const itemCount = rows.length

  const renderRow = ({ index, style }: RowComponentProps) => {
    const { addr, token } = rows[index]

    return (
      <TokenRow
        style={style}
        addr={addr}
        token={token}
        chainId={chainId}
        chains={chains}
        balances={balances}
        prices={prices}
        balancesLoading={balancesLoading}
        pricesLoading={pricesLoading}
        userAddress={userAddress}
        onClick={() => onChange(addr)}
      />
    )
  }

  return (
    <div className="w-full">
      <RelevantTokensBar
        chainId={chainId}
        chains={chains}
        relevant={relevant}
        tokensMap={tokensMap}
        onChange={onChange}
      />

      {relevant.length > 0 && <div className="divider my-1" />}

      <div className="w-full">
        <List
          defaultHeight={LIST_HEIGHT}
          rowCount={itemCount}
          rowHeight={ROW_HEIGHT}
          rowComponent={renderRow}
          rowProps={{} as any}
          style={{ width: '100%', height: LIST_HEIGHT }}
        />
      </div>
    </div>
  )
}
