import type { Address } from "viem"
import { ChainSelector } from "../swap/ChainSelector"
import { TokenSelector } from "../swap/TokenSelector"
import { zeroAddress } from "viem"

type Props = {
    open: boolean
    onClose: () => void
    chainId: string | undefined
    onChainChange: (chainId: string) => void
    tokenValue: Address | undefined
    onTokenChange: (address: Address) => void
    query: string
    onQueryChange: (query: string) => void
    userAddress?: Address
    excludeAddresses?: Address[]
}

export function TokenSelectorModal({
    open,
    onClose,
    chainId,
    onChainChange,
    tokenValue,
    onTokenChange,
    query,
    onQueryChange,
    userAddress,
    excludeAddresses,
}: Props) {
    if (!open) return null

    const handleTokenSelect = (addr: Address) => {
        onTokenChange(addr)
        onClose()
    }

    const handleChainChange = (cid: string) => {
        onChainChange(cid)
        onTokenChange(zeroAddress)
    }

    return (
        <div className="modal modal-open" onClick={onClose}>
            <div className="modal-box max-w-2xl h-[90vh] max-h-[90vh] p-0" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold px-4 py-3">Select a token</h3>
                    <button className="btn btn-sm btn-ghost" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="px-4 pb-2">
                    <div className="flex items-center gap-2">
                        <input
                            className="input input-bordered flex-1"
                            placeholder="Search tokens"
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                        />
                        <div className="min-w-40">
                            <ChainSelector value={chainId} onChange={handleChainChange} />
                        </div>
                    </div>
                </div>
                <div className="px-4 pb-4 h-[calc(90vh-110px)] overflow-auto">
                    {chainId && (
                        <TokenSelector
                            chainId={chainId}
                            userAddress={userAddress}
                            value={tokenValue}
                            onChange={handleTokenSelect}
                            excludeAddresses={excludeAddresses}
                            query={query}
                            onQueryChange={onQueryChange}
                            showSearch={false}
                            listMode={true}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
