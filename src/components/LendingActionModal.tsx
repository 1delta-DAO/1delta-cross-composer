import { useState, useEffect, useMemo } from "react"
import type { Abi, Hex, Address } from "viem"
import { formatUnits, toFunctionSelector, parseUnits, parseUnits as parseUnitsFn } from "viem"
import type { DestinationActionConfig } from "../lib/types/destinationAction"
import { useTokenBalance } from "../hooks/balances/useTokenBalance"
import { useBorrowBalance } from "../hooks/balances/useBorrowBalance"
import { useAccountLiquidity } from "../hooks/balances/useAccountLiquidity"
import { SupportedChainId } from "../sdk/types"

type LendingActionModalProps = {
    open: boolean
    onClose: () => void
    actionConfig: DestinationActionConfig | null
    selector: Hex | null
    initialArgs?: any[]
    initialValue?: string
    userAddress?: Address
    chainId?: string
    onConfirm: (config: DestinationActionConfig, selector: Hex, args: any[], value?: string) => void
}

function findFunctionBySelector(abi: Abi, selector: Hex): any {
    const fns = (abi as any[]).filter((it: any) => it?.type === "function")
    const lowerSel = selector.toLowerCase()
    for (const fn of fns) {
        try {
            const sel = toFunctionSelector(fn as any)
            if (sel.toLowerCase() === lowerSel) return fn
        } catch {}
    }
    return fns[0]
}

function formatBalanceWithDecimals(value: string): string {
    const num = parseFloat(value)
    if (isNaN(num)) return value
    
    if (num >= 1) {
        return num.toFixed(4)
    } else {
        return num.toFixed(6)
    }
}

export function LendingActionModal({
    open,
    onClose,
    actionConfig,
    selector,
    initialArgs,
    initialValue,
    userAddress,
    chainId,
    onConfirm,
}: LendingActionModalProps) {
    const [args, setArgs] = useState<any[]>([])
    const [value, setValue] = useState<string>("")

    const fnAbi = useMemo(() => {
        if (!actionConfig || !selector) return null
        return findFunctionBySelector(actionConfig.abi as Abi, selector)
    }, [actionConfig, selector])

    // Determine which token balance to fetch - always compute these values
    const isWithdraw = useMemo(() => actionConfig?.name?.startsWith("Withdraw") || false, [actionConfig?.name])
    const isDeposit = useMemo(() => actionConfig?.name?.startsWith("Deposit") || false, [actionConfig?.name])
    const isRepay = useMemo(() => actionConfig?.name?.startsWith("Repay") || false, [actionConfig?.name])
    const isBorrow = useMemo(() => actionConfig?.name?.startsWith("Borrow") || false, [actionConfig?.name])
    
    // For withdraw: fetch mToken balance (actionConfig.address is the mToken)
    // For deposit/repay: fetch underlying token balance
    const balanceTokenAddress = useMemo(() => {
        if (!actionConfig) return undefined
        if (isWithdraw) {
            return actionConfig.address as Address
        } else if (isDeposit || isRepay) {
            return (actionConfig.meta as any)?.underlying as Address | undefined
        }
        return undefined
    }, [actionConfig, isWithdraw, isDeposit, isRepay])

    // Always call hooks unconditionally - use enabled prop to control execution
    const { data: tokenBalance, isLoading: balanceLoading } = useTokenBalance({
        chainId: chainId || SupportedChainId.MOONBEAM,
        userAddress,
        tokenAddress: balanceTokenAddress,
    })

    // For repay: fetch borrow balance (debt) - always call hook
    const repayMTokenAddress = useMemo(() => {
        return isRepay && actionConfig ? (actionConfig.address as Address | undefined) : undefined
    }, [isRepay, actionConfig])
    
    const { data: borrowBalance } = useBorrowBalance({
        chainId: chainId || SupportedChainId.MOONBEAM,
        userAddress,
        mTokenAddress: repayMTokenAddress,
    })

    // For borrow: fetch account liquidity to check if user has enough collateral - always call hook
    const { data: accountLiquidity } = useAccountLiquidity({
        chainId: chainId || SupportedChainId.MOONBEAM,
        userAddress,
    })

    // Get the amount input index (usually 0 for lending actions)
    const amountInputIndex = useMemo(() => {
        if (!fnAbi) return -1
        const inputs = fnAbi.inputs || []
        // Find the first uint256 input (usually the amount)
        return inputs.findIndex((inp: any) => inp.type === "uint256")
    }, [fnAbi])

    useEffect(() => {
        if (open && fnAbi) {
            // If editing, use existing args, otherwise initialize with empty strings
            if (initialArgs && initialArgs.length > 0) {
                // Pre-fill with existing args, pad with empty strings if needed
                const paddedArgs = [...initialArgs]
                while (paddedArgs.length < (fnAbi.inputs?.length || 0)) {
                    paddedArgs.push("")
                }
                setArgs(paddedArgs.slice(0, fnAbi.inputs?.length || 0))
            } else {
                setArgs(new Array(fnAbi.inputs?.length || 0).fill(""))
            }
            setValue(initialValue || "")
        } else if (!open) {
            // Reset when modal closes
            setArgs([])
            setValue("")
        }
    }, [open, fnAbi, initialArgs, initialValue])

    // Format balance for display - MUST be called before early return
    const displayBalance = useMemo(() => {
        if (!actionConfig) return null
        
        // For repay: show borrow balance (debt)
        if (isRepay && borrowBalance?.raw) {
            const decimals = (actionConfig.meta as any)?.decimals || 18
            try {
                const fullFormatted = formatUnits(BigInt(borrowBalance.raw), decimals)
                const formatted = formatBalanceWithDecimals(fullFormatted)
                const symbol = (actionConfig.meta as any)?.symbol || ""
                return { formatted, symbol, raw: borrowBalance.raw, isDebt: true }
            } catch {
                return null
            }
        }
        
        // For withdraw/deposit: show token balance
        if (tokenBalance?.raw) {
            const decimals = (actionConfig.meta as any)?.decimals || 18
            try {
                const fullFormatted = formatUnits(BigInt(tokenBalance.raw), decimals)
                const formatted = formatBalanceWithDecimals(fullFormatted)
                const symbol = (actionConfig.meta as any)?.symbol || ""
                return { formatted, symbol, raw: tokenBalance.raw, isDebt: false }
            } catch {
                return null
            }
        }
        
        return null
    }, [tokenBalance, borrowBalance, actionConfig, isRepay])

    // Check if user can borrow (has enough liquidity) - MUST be called before early return
    const canBorrow = useMemo(() => {
        if (!isBorrow || !accountLiquidity) return null
        // liquidity > 0 means user has available collateral to borrow
        return accountLiquidity.liquidity > 0n
    }, [isBorrow, accountLiquidity])

    // Check if user has debt to repay - MUST be called before early return
    const hasDebt = useMemo(() => {
        if (!isRepay || !borrowBalance) return null
        return BigInt(borrowBalance.raw) > 0n
    }, [isRepay, borrowBalance])

    // Check if entered amount exceeds available balance/debt - MUST be called before early return
    const exceedsBalance = useMemo(() => {
        if (amountInputIndex < 0 || !args[amountInputIndex]) return false
        
        try {
            const enteredAmount = BigInt(String(args[amountInputIndex]))
            
            // For repay: compare with borrow balance (debt)
            if (isRepay && borrowBalance?.raw) {
                return enteredAmount > BigInt(borrowBalance.raw)
            }
            
            // For deposit/withdraw: compare with token balance
            if ((isDeposit || isWithdraw) && tokenBalance?.raw) {
                return enteredAmount > BigInt(tokenBalance.raw)
            }
            
            return false
        } catch {
            return false
        }
    }, [args, amountInputIndex, isRepay, isDeposit, isWithdraw, borrowBalance, tokenBalance])

    // Early return after ALL hooks are called
    if (!open || !actionConfig || !selector) return null

    const handleConfirm = () => {
        onConfirm(actionConfig, selector, args, value)
        onClose()
    }

    const handleMaxClick = () => {
        if (amountInputIndex < 0) return
        
        const newArgs = [...args]
        // For repay: use borrow balance (debt)
        // For withdraw: use mToken balance
        // For deposit: use underlying token balance
        if (isRepay && borrowBalance?.raw) {
            newArgs[amountInputIndex] = borrowBalance.raw
        } else if (tokenBalance?.raw) {
            newArgs[amountInputIndex] = tokenBalance.raw
        }
        setArgs(newArgs)
    }

    const inputCount = (fnAbi?.inputs?.length || 0) + (fnAbi?.stateMutability === "payable" ? 1 : 0)
    const useSingleColumn = inputCount === 1

    return (
        <div className={`modal ${open ? "modal-open" : ""}`} onClick={onClose}>
            <div className="modal-box max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">{actionConfig.name}</h3>
                    <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
                        ✕
                    </button>
                </div>
                {actionConfig.description && (
                    <div className="text-sm opacity-70 mb-4">{actionConfig.description}</div>
                )}
                {fnAbi ? (
                    <div className="space-y-4">
                        <div className={useSingleColumn ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
                            {fnAbi.inputs?.map((inp: any, i: number) => {
                                const isAmountInput = i === amountInputIndex && inp.type === "uint256"
                                const showMaxButton = isAmountInput && (
                                    (isRepay && borrowBalance?.raw && BigInt(borrowBalance.raw) > 0n) ||
                                    (!isRepay && displayBalance && BigInt(displayBalance.raw) > 0n)
                                )
                                
                                return (
                                    <div className="form-control" key={i}>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="label py-0">
                                                <span className="label-text text-sm font-medium">
                                                    {inp.name || `arg${i}`} <span className="opacity-60">({inp.type})</span>
                                                </span>
                                            </label>
                                            {isAmountInput && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {displayBalance && (
                                                        <span className={`text-xs ${displayBalance.isDebt ? "text-warning" : "opacity-70"}`}>
                                                            {displayBalance.isDebt ? "Debt: " : "Balance: "}
                                                            {displayBalance.formatted} {displayBalance.symbol}
                                                        </span>
                                                    )}
                                                    {isBorrow && canBorrow !== null && (
                                                        <span className={`text-xs ${canBorrow ? "text-success" : "text-error"}`}>
                                                            {canBorrow ? "✓ Can borrow" : "✗ Insufficient collateral"}
                                                        </span>
                                                    )}
                                                    {isRepay && hasDebt !== null && !hasDebt && (
                                                        <span className="text-xs text-warning">
                                                            No debt to repay
                                                        </span>
                                                    )}
                                                    {showMaxButton && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-ghost"
                                                            onClick={handleMaxClick}
                                                        >
                                                            Max
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            className={`input input-bordered w-full ${isAmountInput && exceedsBalance ? "input-warning" : ""}`}
                                            value={args[i] ?? ""}
                                            onChange={(e) => {
                                                const newArgs = [...args]
                                                newArgs[i] = e.target.value
                                                setArgs(newArgs)
                                            }}
                                            placeholder={inp.type}
                                        />
                                        {isAmountInput && exceedsBalance && (
                                            <span className="label-text-alt text-warning mt-1 flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                Amount exceeds available {isRepay ? "debt" : "balance"}
                                            </span>
                                        )}
                                        {actionConfig.group === "lending" &&
                                            inp.type === "uint256" &&
                                            (() => {
                                                const dec = (actionConfig as any).meta?.decimals
                                                const raw = args[i]
                                                if (!dec || raw === undefined || raw === "") return null
                                                try {
                                                    const bn = BigInt(String(raw))
                                                    const fullHuman = formatUnits(bn, dec)
                                                    const human = formatBalanceWithDecimals(fullHuman)
                                                    const sym = (actionConfig as any).meta?.symbol || ""
                                                    return (
                                                        <span className="label-text-alt opacity-70 mt-1">
                                                            {human} {sym}
                                                        </span>
                                                    )
                                                } catch {
                                                    return null
                                                }
                                            })()}
                                    </div>
                                )
                            })}
                            {fnAbi?.stateMutability === "payable" && (
                                <div className="form-control">
                                    <label className="label py-1">
                                        <span className="label-text text-sm font-medium">Value (ETH)</span>
                                    </label>
                                    <input
                                        className="input input-bordered w-full"
                                        inputMode="decimal"
                                        placeholder="0"
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t border-base-300">
                            <button className="btn btn-ghost btn-sm" onClick={onClose}>
                                Cancel
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handleConfirm}>
                                {initialArgs ? "Update Action" : "Add Action"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm opacity-70">No ABI inputs found.</div>
                )}
            </div>
        </div>
    )
}

