import { FixedSizeList as List, ListChildComponentProps } from "react-window"
import { RelevantTokensBar } from "./RelevantTokens"
import { TokenRow } from "./TokenRow"
import { CommonViewProps } from "./types"

const ROW_HEIGHT = 56 // adjust if your row is taller/shorter
const LIST_HEIGHT = 620 // visible area height

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

    const renderRow = ({ index, style }: ListChildComponentProps) => {
        const { addr, token } = rows[index]

        return (
            <TokenRow
                style={style} // important: let react-window control positioning
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
            <RelevantTokensBar chainId={chainId} chains={chains} relevant={relevant} tokensMap={tokensMap} onChange={onChange} />

            {relevant.length > 0 && <div className="divider my-1" />}

            <div className="w-full">
                <List height={LIST_HEIGHT} itemCount={itemCount} itemSize={ROW_HEIGHT} width="100%">
                    {renderRow}
                </List>
            </div>
        </div>
    )
}
