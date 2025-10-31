import React from "react"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { useChainId, useSwitchChain } from "wagmi"
import { ChainSelector } from "./ChainSelector"
import { TokenSelector } from "./TokenSelector"
import { useChainsRegistry } from "../../hooks/query/useChainsRegistry"
import { useTokenLists } from "../../hooks/query/useTokenLists"
import { useEvmBalances } from "../../hooks/balances/useEvmBalances"
import { useTokenBalance } from "../../hooks/balances/useTokenBalance"
import { useDexscreenerPrices } from "../../hooks/prices/useDexscreenerPrices"
import { buildTokenUrl } from "../../lib/explorer"
import { useDebounce } from "../../hooks/useDebounce"
import DestinationActionSelector from "../../components/DestinationActionSelector"
import type { DestinationActionConfig } from "../../lib/types/destinationAction"
import { encodeFunctionData, type Abi, type Hex } from "viem"
import { getWNative } from "../../lib/data/wrappednatives"
import { useQueryClient } from "@tanstack/react-query"

type Props = {
    userAddress?: Address
}

export function SwapTab({ userAddress }: Props) {
    const { data: chains } = useChainsRegistry()
    const { data: lists } = useTokenLists()
    const currentChainId = useChainId()
    const { switchChain } = useSwitchChain()
    const [srcChainId, setSrcChainId] = React.useState<string | undefined>("8453")
    const [dstChainId, setDstChainId] = React.useState<string | undefined>("1284")
    const [srcToken, setSrcToken] = React.useState<Address | undefined>(undefined)
    const [dstToken, setDstToken] = React.useState<Address | undefined>(undefined)
    const [amount, setAmount] = React.useState("")

    const srcTokensMap = srcChainId ? lists?.[srcChainId] || {} : {}
    const dstTokensMap = dstChainId ? lists?.[dstChainId] || {} : {}
    const srcAddrs = React.useMemo(() => (srcChainId ? (Object.keys(srcTokensMap) as Address[]).slice(0, 300) : []), [srcTokensMap, srcChainId])
    const dstAddrs = React.useMemo(() => (dstChainId ? (Object.keys(dstTokensMap) as Address[]).slice(0, 300) : []), [dstTokensMap, dstChainId])

    // Switch wallet chain when source chain changes
    React.useEffect(() => {
        if (!srcChainId) return
        const srcChainIdNum = Number(srcChainId)
        if (currentChainId !== srcChainIdNum) {
            try {
                switchChain({ chainId: srcChainIdNum })
            } catch (err: unknown) {
                console.warn("Failed to switch chain:", err)
            }
        }
    }, [srcChainId, currentChainId, switchChain])

    // Include zero address for native token balance
    const srcAddressesWithNative = React.useMemo(() => {
        if (!srcChainId || !userAddress) return []
        const addrs = [...srcAddrs]
        if (!addrs.includes(zeroAddress as Address)) {
            addrs.unshift(zeroAddress as Address)
        }
        return addrs
    }, [srcAddrs, srcChainId, userAddress])

    const { data: srcBalances, isLoading: srcBalancesLoading } = useEvmBalances({
        chainId: srcChainId || "",
        userAddress,
        tokenAddresses: srcAddressesWithNative,
    })
    // Include wrapped native address for native token price
    const srcPriceAddresses = React.useMemo(() => {
        const addrs = [...srcAddrs]
        const wNative = srcChainId ? getWNative(srcChainId) : undefined
        if (wNative && !addrs.includes(wNative.address as Address)) {
            addrs.push(wNative.address as Address)
        }
        return addrs
    }, [srcAddrs, srcChainId])

    const { data: srcPrices, isLoading: srcPricesLoading } = useDexscreenerPrices({ chainId: srcChainId || "", addresses: srcPriceAddresses })

    // Include zero address for native token balance (destination)
    const dstAddressesWithNative = React.useMemo(() => {
        if (!dstChainId || !userAddress) return []
        const addrs = [...dstAddrs]
        if (!addrs.includes(zeroAddress as Address)) {
            addrs.unshift(zeroAddress as Address)
        }
        return addrs
    }, [dstAddrs, dstChainId, userAddress])

    const { data: dstBalances, isLoading: dstBalancesLoading } = useEvmBalances({
        chainId: dstChainId || "",
        userAddress,
        tokenAddresses: dstAddressesWithNative,
    })
    // Include wrapped native address for native token price (destination)
    const dstPriceAddresses = React.useMemo(() => {
        const addrs = [...dstAddrs]
        const wNative = dstChainId ? getWNative(dstChainId) : undefined
        if (wNative && !addrs.includes(wNative.address as Address)) {
            addrs.push(wNative.address as Address)
        }
        return addrs
    }, [dstAddrs, dstChainId])

    const { data: dstPrices, isLoading: dstPricesLoading } = useDexscreenerPrices({ chainId: dstChainId || "", addresses: dstPriceAddresses })

    // Fetch individual token balances for selected tokens (ensures balance is available even if not in list)
    const { data: srcTokenBalance, isLoading: srcTokenBalanceLoading } = useTokenBalance({
        chainId: srcChainId || "",
        userAddress,
        tokenAddress: srcToken,
    })

    const { data: dstTokenBalance, isLoading: dstTokenBalanceLoading } = useTokenBalance({
        chainId: dstChainId || "",
        userAddress,
        tokenAddress: dstToken,
    })

    const debouncedAmount = useDebounce(amount, 1000)
    const debouncedSrc = useDebounce([srcChainId, srcToken] as const, 1000)
    const debouncedDst = useDebounce([dstChainId, dstToken] as const, 1000)

    const [quoting, setQuoting] = React.useState(false)
    const [quoteOut, setQuoteOut] = React.useState<string | undefined>(undefined)
    const [quoteParams, setQuoteParams] = React.useState<{ amount: string; sc: string; st: string; dc: string; dt: string } | undefined>(undefined)

    // Quote on input changes (keep prior quote visible while updating)
    React.useEffect(() => {
        const [sc, st] = debouncedSrc
        const [dc, dt] = debouncedDst
        const amountOk = Boolean(debouncedAmount) && Number(debouncedAmount) > 0
        const inputsOk = Boolean(sc && st && dc && dt)
        if (!amountOk || !inputsOk) {
            setQuoteOut(undefined)
            setQuoteParams(undefined)
            setQuoting(false)
            return
        }
        let cancel = false
        setQuoting(true)
        const t = setTimeout(() => {
            if (cancel) return
            setQuoteOut(debouncedAmount)
            setQuoteParams({ amount: debouncedAmount, sc: sc!, st: st!, dc: dc!, dt: dt! })
            setQuoting(false)
        }, 800)
        return () => {
            cancel = true
            clearTimeout(t)
        }
    }, [debouncedAmount, debouncedSrc, debouncedDst])

    // Re-quote every 30s without clearing existing quote
    React.useEffect(() => {
        if (!quoteParams) return
        const h = setInterval(() => {
            setQuoting(true)
            // Placeholder keeps the same output for now
            setTimeout(() => setQuoting(false), 300)
        }, 30000)
        return () => clearInterval(h)
    }, [quoteParams])

    // Preselect token on chain change: native or wrapped native if available
    React.useEffect(() => {
        if (!srcChainId) return
        const native = chains?.[srcChainId]?.data?.nativeCurrency?.symbol
        const force = srcChainId === "8453" ? "USDC" : undefined
        if (srcToken && srcTokensMap[srcToken.toLowerCase()]) return
        const pick = pickPreferredToken(srcTokensMap, force || native)
        if (pick) setSrcToken(pick as Address)
    }, [srcChainId, srcTokensMap, chains, srcToken])
    React.useEffect(() => {
        if (!dstChainId) return
        const native = chains?.[dstChainId]?.data?.nativeCurrency?.symbol
        const force = dstChainId === "1284" ? "GLMR" : dstChainId === srcChainId ? "USDC" : undefined
        if (dstToken && dstTokensMap[dstToken.toLowerCase()]) return
        const pick = pickPreferredToken(dstTokensMap, force || native)
        if (pick) setDstToken(pick as Address)
    }, [dstChainId, dstTokensMap, chains, srcChainId, dstToken])

    const queryClient = useQueryClient()

    type PendingAction = {
        id: string
        config: DestinationActionConfig
        selector: Hex
        args: any[]
    }
    const [actions, setActions] = React.useState<PendingAction[]>([])

    return (
        <div>
            <div role="tablist" className="tabs tabs-lift mb-4">
                <a role="tab" className="tab tab-active">
                    Swap
                </a>
            </div>
            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="font-medium">Source</div>
                    <ChainSelector
                        value={srcChainId}
                        onChange={(cid) => {
                            setSrcChainId(cid)
                            // if dst matches src after change, clear dstToken to enforce difference
                            if (cid === dstChainId && srcToken && dstToken && srcToken.toLowerCase() === dstToken.toLowerCase()) {
                                setDstToken(undefined)
                            }
                        }}
                    />
                    {srcChainId && <TokenSelector chainId={srcChainId} userAddress={userAddress} value={srcToken} onChange={setSrcToken} />}
                    {srcChainId && srcToken && (
                        <SelectedTokenInfo
                            chains={chains}
                            chainId={srcChainId || ""}
                            tokenAddress={srcToken}
                            balance={
                                srcTokenBalance?.value || (srcToken ? srcBalances?.[srcChainId || ""]?.[srcToken.toLowerCase()]?.value : undefined)
                            }
                            price={srcToken && srcChainId ? getTokenPrice(srcChainId, srcToken, srcPrices?.[srcChainId || ""]) : undefined}
                            balanceLoading={srcTokenBalanceLoading || srcBalancesLoading}
                            priceLoading={srcPricesLoading}
                        />
                    )}
                </div>
                <div className="flex justify-center">
                    <button
                        type="button"
                        className="btn btn-circle"
                        onClick={() => {
                            const sc = srcChainId
                            const st = srcToken
                            setSrcChainId(dstChainId)
                            setSrcToken(dstToken)
                            setDstChainId(sc)
                            setDstToken(st)
                        }}
                        aria-label="Swap direction"
                    >
                        ↕
                    </button>
                </div>
                <div className="space-y-2">
                    <div className="font-medium">Destination</div>
                    <ChainSelector
                        value={dstChainId}
                        onChange={(cid) => {
                            setDstChainId(cid)
                            if (cid === srcChainId && srcToken && dstToken && srcToken.toLowerCase() === dstToken.toLowerCase()) {
                                setDstToken(undefined)
                            }
                        }}
                    />
                    {dstChainId && (
                        <TokenSelector
                            chainId={dstChainId}
                            userAddress={userAddress}
                            value={dstToken}
                            onChange={(addr) => {
                                if (srcChainId === dstChainId && srcToken && addr.toLowerCase() === srcToken.toLowerCase()) return
                                setDstToken(addr)
                            }}
                            excludeAddresses={srcChainId === dstChainId && srcToken ? [srcToken] : []}
                        />
                    )}
                    {dstChainId && dstToken && (
                        <SelectedTokenInfo
                            chains={chains}
                            chainId={dstChainId}
                            tokenAddress={dstToken}
                            balance={dstTokenBalance?.value || (dstToken ? dstBalances?.[dstChainId]?.[dstToken.toLowerCase()]?.value : undefined)}
                            price={dstToken && dstChainId ? getTokenPrice(dstChainId, dstToken, dstPrices?.[dstChainId]) : undefined}
                            balanceLoading={dstTokenBalanceLoading || dstBalancesLoading}
                            priceLoading={dstPricesLoading}
                        />
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Amount</span>
                        </label>
                        <input
                            className="input input-bordered w-full"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(filterNumeric(e.target.value))}
                            placeholder="0.0"
                        />
                    </div>
                    <SlippageAndAmount
                        balance={srcTokenBalance?.value || (srcToken ? srcBalances?.[srcChainId || ""]?.[srcToken.toLowerCase()]?.value : undefined)}
                        amount={amount}
                        onAmount={setAmount}
                    />
                </div>
                {quoteOut && (
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <div className="flex items-center justify-between">
                                <div className="font-medium">Quote</div>
                                {quoting && <span className="loading loading-spinner loading-sm" />}
                            </div>
                            <div className="mt-2">
                                <div className="text-sm">
                                    Estimated receive: <span className="font-mono">{quoteOut}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {dstChainId === "1284" && quoteOut && (
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <div className="font-medium mb-3">Moonbeam Actions</div>
                            <DestinationActionSelector
                                onAdd={(config, selector) => {
                                    setActions((arr) => [...arr, { id: Math.random().toString(36).slice(2), config, selector, args: [] }])
                                }}
                            />
                            {actions.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    {actions.map((a, idx) => (
                                        <ActionEditor
                                            key={a.id}
                                            action={a}
                                            canMoveUp={idx > 0}
                                            canMoveDown={idx < actions.length - 1}
                                            onChange={(next) => setActions((arr) => arr.map((x) => (x.id === a.id ? next : x)))}
                                            onRemove={() => setActions((arr) => arr.filter((x) => x.id !== a.id))}
                                            onMoveUp={() =>
                                                setActions((arr) => {
                                                    const copy = [...arr]
                                                    const i = copy.findIndex((x) => x.id === a.id)
                                                    if (i > 0) {
                                                        const tmp = copy[i - 1]
                                                        copy[i - 1] = copy[i]
                                                        copy[i] = tmp
                                                    }
                                                    return copy
                                                })
                                            }
                                            onMoveDown={() =>
                                                setActions((arr) => {
                                                    const copy = [...arr]
                                                    const i = copy.findIndex((x) => x.id === a.id)
                                                    if (i >= 0 && i < copy.length - 1) {
                                                        const tmp = copy[i + 1]
                                                        copy[i + 1] = copy[i]
                                                        copy[i] = tmp
                                                    }
                                                    return copy
                                                })
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {quoteOut && (
                    <ExecuteButton
                        onDone={(hashes) => {
                            // Invalidate all balance queries for src/dst chains and tokens
                            if (srcChainId && userAddress) {
                                queryClient.invalidateQueries({
                                    queryKey: ["balances", srcChainId, userAddress],
                                })
                                queryClient.invalidateQueries({
                                    queryKey: ["tokenBalance", srcChainId, userAddress],
                                })
                            }
                            if (dstChainId && userAddress) {
                                queryClient.invalidateQueries({
                                    queryKey: ["balances", dstChainId, userAddress],
                                })
                                queryClient.invalidateQueries({
                                    queryKey: ["tokenBalance", dstChainId, userAddress],
                                })
                            }
                        }}
                    />
                )}
            </div>
        </div>
    )
}

function filterNumeric(s: string): string {
    // Allow digits and a single dot; mimic numeric validation in Transactions
    s = s.replace(/[^0-9.]/g, "")
    const parts = s.split(".")
    if (parts.length <= 1) return s
    return parts[0] + "." + parts.slice(1).join("").replace(/\./g, "")
}

function ExplorerLink({ chains, chainId, tokenAddress }: { chains?: any; chainId: string; tokenAddress: Address }) {
    const href = chains ? buildTokenUrl(chains, chainId, tokenAddress) : undefined
    if (!href) return null
    return (
        <a href={href} target="_blank" rel="noreferrer" className="link link-primary mt-1 inline-block">
            View on explorer
        </a>
    )
}

function pickPreferredToken(map: Record<string, any>, native?: string): string | undefined {
    const entries = Object.entries(map)
    if (!entries.length) return undefined
    if (native) {
        const found = entries.find(([, t]) => t.symbol?.toUpperCase() === native.toUpperCase())
        if (found) return found[0]
        const wrapped = entries.find(([, t]) => t.symbol?.toUpperCase() === `W${native.toUpperCase()}`)
        if (wrapped) return wrapped[0]
    }
    return entries[0][0]
}

function SlippageAndAmount({ balance, amount, onAmount }: { balance?: string; amount: string; onAmount: (v: string) => void }) {
    const [slip, setSlip] = React.useState(0.3)
    const presets = [0.05, 0.1, 0.3, 1]
    const numericBal = balance ? Number(balance) : 0
    const [pct, setPct] = React.useState(0)
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    Max Slippage: <span className="font-semibold">{slip.toFixed(2)}%</span>
                </div>
                <div className="join">
                    <button className="btn btn-xs join-item" onClick={() => setSlip(0.3)}>
                        Auto
                    </button>
                    {presets.map((p) => (
                        <button key={p} className="btn btn-xs join-item" onClick={() => setSlip(p)}>
                            {p}%
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={pct}
                    onChange={(e) => {
                        const v = Number(e.target.value)
                        setPct(v)
                        if (numericBal > 0) onAmount((numericBal * (v / 100)).toString())
                    }}
                    className="range flex-1"
                />
                <input className="input input-bordered w-24" value={pct} onChange={(e) => setPct(Number(e.target.value) || 0)} />
            </div>
        </div>
    )
}

function ExecuteButton({ onDone }: { onDone: (hashes: { src?: string; dst?: string }) => void }) {
    const [step, setStep] = React.useState<"idle" | "await" | "sending" | "confirmed" | "error">("idle")
    const [srcHash, setSrcHash] = React.useState<string | undefined>()
    const [dstHash, setDstHash] = React.useState<string | undefined>()

    // Only show steps that are relevant (current step and previous steps)
    const shouldShowStep = (stepName: "await" | "sending" | "confirmed") => {
        if (step === "idle") return false
        if (step === "error") return true // Show all steps on error
        if (step === "await") return stepName === "await"
        if (step === "sending") return stepName === "await" || stepName === "sending"
        if (step === "confirmed") return true
        return false
    }

    return (
        <div className="space-y-3">
            {step === "idle" && (
                <button
                    className="btn btn-primary w-full"
                    onClick={async () => {
                        try {
                            setStep("await")
                            await wait(800)
                            setStep("sending")
                            await wait(1200)
                            const h = `0x${Math.random().toString(16).slice(2, 10)}`
                            setSrcHash(h)
                            await wait(1000)
                            setStep("confirmed")
                            onDone({ src: h })
                        } catch {
                            setStep("error")
                        }
                    }}
                >
                    Execute
                </button>
            )}
            {step !== "idle" && (
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        {shouldShowStep("await") && (
                            <Step
                                label="Awaiting user"
                                status={
                                    step === "await"
                                        ? "active"
                                        : step === "error"
                                        ? "error"
                                        : ["sending", "confirmed"].includes(step)
                                        ? "done"
                                        : "idle"
                                }
                            />
                        )}
                        {shouldShowStep("sending") && (
                            <Step
                                label="Sending tx"
                                status={
                                    step === "sending"
                                        ? "active"
                                        : step === "error"
                                        ? "error"
                                        : step === "await"
                                        ? "idle"
                                        : step === "confirmed"
                                        ? "done"
                                        : "idle"
                                }
                            />
                        )}
                        {shouldShowStep("confirmed") && (
                            <Step label="Confirmed" status={step === "confirmed" ? "done" : step === "error" ? "error" : "idle"} />
                        )}
                    </div>
                    {srcHash && (
                        <div className="text-sm">
                            Source tx: <span className="font-mono">{srcHash}</span>
                        </div>
                    )}
                    {dstHash && (
                        <div className="text-sm">
                            Destination tx: <span className="font-mono">{dstHash}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function Step({ label, status }: { label: string; status: "idle" | "active" | "done" | "error" }) {
    const icon = status === "done" ? "✅" : status === "error" ? "❌" : status === "active" ? "⏳" : "•"
    const cls = status === "error" ? "text-error" : status === "done" ? "text-success" : status === "active" ? "text-warning" : ""
    return (
        <div className={`flex items-center gap-1 ${cls}`}>
            <span>{icon}</span>
            <span className="text-sm">{label}</span>
        </div>
    )
}

function wait(ms: number) {
    return new Promise((res) => setTimeout(res, ms))
}

function getTokenPrice(chainId: string, tokenAddress: Address, prices?: Record<string, { usd: number }>): number | undefined {
    if (!prices) return undefined
    // For zero address (native), use wrapped native price
    if (tokenAddress.toLowerCase() === zeroAddress.toLowerCase()) {
        const wNative = getWNative(chainId)
        return wNative ? prices[wNative.address.toLowerCase()]?.usd : undefined
    }
    return prices[tokenAddress.toLowerCase()]?.usd
}

function SelectedTokenInfo({
    chains,
    chainId,
    tokenAddress,
    balance,
    price,
    balanceLoading,
    priceLoading,
}: {
    chains?: any
    chainId: string
    tokenAddress: Address
    balance?: string
    price?: number
    balanceLoading?: boolean
    priceLoading?: boolean
}) {
    const href = chains ? buildTokenUrl(chains, chainId, tokenAddress) : undefined
    const usd = balance && price ? Number(balance) * price : undefined
    return (
        <div className="text-xs mt-1 flex items-center justify-between">
            <div className="opacity-70 flex items-center gap-2">
                Balance: {balanceLoading ? <span className="loading loading-spinner loading-xs" /> : balance ?? "-"}
            </div>
            <div className="flex items-center gap-3">
                {priceLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                ) : usd !== undefined && isFinite(usd) ? (
                    <span>${usd.toFixed(2)}</span>
                ) : null}
                {href && (
                    <a href={href} target="_blank" rel="noreferrer" className="link link-primary">
                        Explorer
                    </a>
                )}
            </div>
        </div>
    )
}

function ActionEditor({
    action,
    onChange,
    onRemove,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
}: {
    action: { id: string; config: DestinationActionConfig; selector: Hex; args: any[] }
    onChange: (a: { id: string; config: DestinationActionConfig; selector: Hex; args: any[] }) => void
    onRemove: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    onMoveUp: () => void
    onMoveDown: () => void
}) {
    const fnAbi = React.useMemo(() => findFunctionBySelector(action.config.abi as Abi, action.selector), [action])
    const [localArgs, setLocalArgs] = React.useState<any[]>(action.args ?? [])
    React.useEffect(() => {
        onChange({ ...action, args: localArgs })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localArgs])
    return (
        <div className="card bg-base-200">
            <div className="card-body gap-2">
                <div className="flex items-center justify-between">
                    <div className="font-medium">{action.config.name}</div>
                    <div className="flex gap-2">
                        {canMoveUp && (
                            <button className="btn btn-xs" onClick={onMoveUp} aria-label="Move up">
                                ↑
                            </button>
                        )}
                        {canMoveDown && (
                            <button className="btn btn-xs" onClick={onMoveDown} aria-label="Move down">
                                ↓
                            </button>
                        )}
                        <button className="btn btn-xs btn-error" onClick={onRemove} aria-label="Remove">
                            Remove
                        </button>
                    </div>
                </div>
                {fnAbi ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {fnAbi.inputs?.map((inp: any, i: number) => (
                            <div className="form-control" key={i}>
                                <label className="label">
                                    <span className="label-text">
                                        {inp.name || `arg${i}`} ({inp.type})
                                    </span>
                                </label>
                                <input
                                    className="input input-bordered"
                                    value={localArgs[i] ?? ""}
                                    onChange={(e) =>
                                        setLocalArgs((arr) => {
                                            const copy = [...arr]
                                            copy[i] = e.target.value
                                            return copy
                                        })
                                    }
                                    placeholder={inp.type}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm opacity-70">No ABI inputs found.</div>
                )}
            </div>
        </div>
    )
}

function findFunctionBySelector(abi: Abi, selector: Hex): any {
    const fns = abi.filter((it: any) => it.type === "function")
    // Fallback to first function in this demo
    return fns[0]
}
