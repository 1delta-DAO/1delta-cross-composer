import type { Address } from "viem"
import { Logo } from "../common/Logo"
import { getTokenPrice } from "./swapUtils"

type TokenOutputSectionProps = {
    quoteOut?: string
    dstToken?: Address
    dstChainId?: string
    dstTokenBalance?: { value?: string }
    dstPricesMerged?: Record<string, { usd: number }>
    lists?: Record<string, Record<string, any>>
    onTokenClick: () => void
    slippage?: number
    quotes?: Array<{ label: string; trade: any }>
}

export function TokenOutputSection({
    quoteOut,
    dstToken,
    dstChainId,
    dstTokenBalance,
    dstPricesMerged,
    lists,
    onTokenClick,
    slippage,
    quotes,
}: TokenOutputSectionProps) {
    const price = dstToken && dstChainId ? getTokenPrice(dstChainId, dstToken, dstPricesMerged) : undefined
    const usd = price && quoteOut ? Number(quoteOut) * price : undefined

    return (
        <div className="rounded-2xl bg-[#1F1F1F] p-4 shadow ">
            <div className="text-sm opacity-70">Buy</div>
            <div className="flex items-center gap-3 mt-1">
                <div className="text-4xl font-semibold flex-1 text-left">{quoteOut ?? "0"}</div>
                <div>
                    <button className="btn btn-outline rounded-2xl flex items-center gap-2 border-[0.5px]" onClick={onTokenClick}>
                        {dstToken && dstChainId ? (
                            <>
                                <Logo
                                    src={lists?.[dstChainId]?.[dstToken.toLowerCase()]?.logoURI}
                                    alt={lists?.[dstChainId]?.[dstToken.toLowerCase()]?.symbol || "Token"}
                                    size={20}
                                    fallbackText={lists?.[dstChainId]?.[dstToken.toLowerCase()]?.symbol || "T"}
                                />
                                <span>{lists?.[dstChainId]?.[dstToken.toLowerCase()]?.symbol || "Token"}</span>
                            </>
                        ) : (
                            <span>Select token</span>
                        )}
                    </button>
                </div>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
                <div className="opacity-70">{usd !== undefined ? `$${usd.toFixed(2)}` : "$0"}</div>
                <div className="opacity-70">
                    {dstTokenBalance?.value
                        ? `${Number(dstTokenBalance.value).toFixed(4)} ${
                              dstToken && dstChainId ? lists?.[dstChainId]?.[dstToken.toLowerCase()]?.symbol || "" : ""
                          }`
                        : ""}
                </div>
            </div>
            {quotes && quotes.length > 0 && slippage !== undefined && (
                <div className="flex items-center justify-between text-xs mt-1 opacity-60">
                    <span>Max slippage</span>
                    <span>{slippage.toFixed(2)}%</span>
                </div>
            )}
        </div>
    )
}

