import React, { useState, useCallback, useEffect } from "react"
import { useAccount, useChainId, useSwitchChain } from "wagmi"
import { type Address } from "viem"
import { usePermitBatch } from "../sdk/hooks/usePermitBatch"
import { useDebounce } from "../hooks/useDebounce"
import { isValidAddress, isEmptyAddress } from "../utils/addressValidation"
import { isValidDecimal, formatDecimalInput } from "../utils/inputValidation"
import { fetchDecimals } from "../sdk/utils/tokenUtils"
import { DEFAULT_DECIMALS, XCUSDT_ADDRESS, XCUSDC_ADDRESS, GLMR_ADDRESS } from "../lib/consts"
import { BatchTransactionFormProps, Operation, ERC20Operation, ArbitraryCallOperation } from "../lib/types"

const MOONBEAM_CHAIN_ID = 1284

export default function BatchTransactionForm({ onTransactionExecuted }: BatchTransactionFormProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { executeSelfTransmit, createBatchCalls, isLoading, error } = usePermitBatch()

  const [operations, setOperations] = useState<Operation[]>([])

  const [deadline, setDeadline] = useState(3600)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [rawTokenAddresses, setRawTokenAddresses] = useState<Record<string, string>>({})

  const [tokenErrors, setTokenErrors] = useState<Record<string, string>>({})

  const [inputErrors, setInputErrors] = useState<Record<string, string>>({})

  const debouncedTokenAddresses = useDebounce(rawTokenAddresses, 500)

  const [localDecimalsCache, setLocalDecimalsCache] = useState<Record<Address, number>>({})
  const [localLoadingDecimals, setLocalLoadingDecimals] = useState<Set<Address>>(new Set())

  const fetchDecimalsWrapper = useCallback(
    async (tokenAddress: Address): Promise<number | null> => {
      return fetchDecimals(tokenAddress, String(chainId), localDecimalsCache, localLoadingDecimals, setLocalDecimalsCache, setLocalLoadingDecimals)
    },
    [chainId, localDecimalsCache, localLoadingDecimals],
  )

  const addERC20Operation = useCallback(() => {
    const newId = Date.now().toString()
    const newOperation: ERC20Operation = {
      id: newId,
      operationType: "erc20",
      type: "approve",
      tokenAddress: "" as Address,
      to: "" as Address,
      amount: "",
      decimals: 18,
    }

    setOperations((prev) => [...prev, newOperation])
  }, [])

  const addArbitraryCallOperation = useCallback(() => {
    const newId = Date.now().toString()
    const newOperation: ArbitraryCallOperation = {
      id: newId,
      operationType: "arbitrary",
      target: "" as Address,
      calldata: "",
      value: "",
    }

    setOperations((prev) => [...prev, newOperation])
  }, [])

  const removeOperation = useCallback((id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id))
    setRawTokenAddresses((prev) => {
      const { [id]: removed, ...rest } = prev
      return rest
    })
    setTokenErrors((prev) => {
      const { [id]: removed, ...rest } = prev
      return rest
    })
    setInputErrors((prev) => {
      const newErrors = { ...prev }
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`${id}-`)) {
          delete newErrors[key]
        }
      })
      return newErrors
    })
  }, [])

  const updateOperation = useCallback((id: string, field: string, value: string | number) => {
    setOperations((prev) => prev.map((op) => (op.id === id ? { ...op, [field]: value } : op)))
  }, [])

  const updateDecimalInput = useCallback((id: string, field: string, value: string) => {
    const formattedValue = formatDecimalInput(value)

    const isValid = isValidDecimal(formattedValue)

    setInputErrors((prev) => {
      const newErrors = { ...prev }
      const errorKey = `${id}-${field}`

      if (!isValid) {
        newErrors[errorKey] = "Please enter a valid decimal number (e.g., 1.5 or 0.1)"
      } else {
        delete newErrors[errorKey]
      }

      return newErrors
    })

    setOperations((prev) => prev.map((op) => (op.id === id ? { ...op, [field]: formattedValue } : op)))
  }, [])

  const updateRawTokenAddress = useCallback((id: string, value: string) => {
    setRawTokenAddresses((prev) => ({
      ...prev,
      [id]: value,
    }))
  }, [])

  const setTokenAddress = useCallback((id: string, tokenAddress: Address) => {
    setRawTokenAddresses((prev) => ({
      ...prev,
      [id]: tokenAddress,
    }))

    setOperations((prev) =>
      prev.map((op) =>
        op.id === id && op.operationType === "erc20"
          ? {
              ...op,
              tokenAddress,
              decimals: DEFAULT_DECIMALS[tokenAddress] || (op as ERC20Operation).decimals,
            }
          : op,
      ),
    )
  }, [])

  useEffect(() => {
    Object.entries(debouncedTokenAddresses).forEach(([id, address]) => {
      setTokenErrors((prev) => {
        const { [id]: removed, ...rest } = prev
        return rest
      })

      if (isEmptyAddress(address) || !isValidAddress(address)) {
        return
      }

      const validAddress = address as Address

      setOperations((prev) => prev.map((op) => (op.id === id && op.operationType === "erc20" ? { ...op, tokenAddress: validAddress } : op)))
    })
  }, [debouncedTokenAddresses])

  useEffect(() => {
    const operationsToUpdate = operations.filter(
      (operation) =>
        operation.operationType === "erc20" &&
        operation.tokenAddress &&
        !localDecimalsCache[operation.tokenAddress] &&
        !localLoadingDecimals.has(operation.tokenAddress),
    )

    if (operationsToUpdate.length === 0) return

    operationsToUpdate.forEach((operation) => {
      if (operation.operationType === "erc20") {
        if (DEFAULT_DECIMALS[operation.tokenAddress]) {
          setOperations((prev) => prev.map((op) => (op.id === operation.id ? { ...op, decimals: DEFAULT_DECIMALS[operation.tokenAddress] } : op)))
        } else {
          fetchDecimalsWrapper(operation.tokenAddress)
            .then((decimals) => {
              if (decimals !== null) {
                setOperations((prev) => prev.map((op) => (op.id === operation.id ? { ...op, decimals } : op)))
              } else {
                setTokenErrors((prev) => ({
                  ...prev,
                  [operation.id]: "Failed to fetch token decimals. Address may not be a valid ERC20 token.",
                }))
              }
            })
            .catch((err) => {
              console.error(`Error fetching decimals for operation ${operation.id}:`, err)
              setTokenErrors((prev) => ({
                ...prev,
                [operation.id]: "Error fetching token decimals. Please check the address.",
              }))
            })
        }
      }
    })
  }, [operations.length, localDecimalsCache, localLoadingDecimals, fetchDecimalsWrapper])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!address || operations.length === 0) {
        return
      }

      setIsSubmitting(true)

      try {
        const calls = createBatchCalls(operations)
        const deadlineBigInt = BigInt(Math.floor(Date.now() / 1000) + deadline)

        const result = await executeSelfTransmit({
          from: address,
          calls,
          deadline: deadlineBigInt,
        })

        if (result.error) {
          console.error("Self-transmit error:", result.error)
          return
        }

        if (result.hash && onTransactionExecuted) {
          onTransactionExecuted(result.hash)
        }
      } catch (err) {
        console.error("Transaction failed:", err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [address, operations, deadline, createBatchCalls, executeSelfTransmit, onTransactionExecuted],
  )

  const isMoonbeam = chainId === MOONBEAM_CHAIN_ID

  return (
    <>
      {!isMoonbeam && (
        <div className="alert alert-warning mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-bold">Wrong Network</h3>
            <div className="text-sm">The transaction tab is specifically designed for Moonbeam network. Please switch to Moonbeam to continue.</div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => switchChain({ chainId: MOONBEAM_CHAIN_ID })}>
            Switch to Moonbeam
          </button>
        </div>
      )}
      <div className="card bg-base-100 shadow-2xl">
        <div className="card-body">
          <div className="flex items-center justify-between mb-6">
            <h2 className="card-title text-2xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Batch Transaction
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Deadline (seconds from now)</span>
              </label>
              <input
                type="number"
                value={deadline}
                onChange={(e) => setDeadline(Number(e.target.value))}
                className="input input-bordered w-full"
                min="60"
                max="86400"
              />
              <label className="label">
                <span className="label-text-alt">Transaction will expire after this time</span>
              </label>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Operations</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={addERC20Operation} className="btn btn-primary btn-sm">
                    <span className="text-2xl">+</span>
                    Add ERC20
                  </button>
                  <button type="button" onClick={addArbitraryCallOperation} className="btn btn-secondary btn-sm">
                    <span className="text-2xl">+</span>
                    Add Arbitrary Call
                  </button>
                </div>
              </div>

              {operations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <svg className="w-16 h-16 mx-auto text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-base-content/70 mb-2">No operations added yet</h3>
                  <p className="text-base-content/50 mb-6">Add ERC20 operations or arbitrary calls to create your batch transaction</p>
                  <div className="flex gap-2 justify-center">
                    <button type="button" onClick={addERC20Operation} className="btn btn-primary btn-sm">
                      <span className="text-2xl">+</span>
                      Add ERC20
                    </button>
                    <button type="button" onClick={addArbitraryCallOperation} className="btn btn-secondary btn-sm">
                      <span className="text-2xl">+</span>
                      Add Arbitrary Call
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {operations.map((operation, index) => (
                    <div key={operation.id} className="card bg-base-200 shadow-md">
                      <div className="card-body p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-primary">Operation {index + 1}</h4>
                            <div className={`badge ${operation.operationType === "erc20" ? "badge-primary" : "badge-secondary"}`}>
                              {operation.operationType === "erc20" ? "ERC20" : "Arbitrary Call"}
                            </div>
                          </div>
                          <button type="button" onClick={() => removeOperation(operation.id)} className="btn  btn-error btn-sm">
                            🗑️
                          </button>
                        </div>
                        {operation.operationType === "erc20" ? (
                          <>
                            <div className="form-control mb-4">
                              <label className="label">
                                <span className="label-text font-medium">Action</span>
                              </label>
                              <select
                                value={(operation as ERC20Operation).type}
                                onChange={(e) => updateOperation(operation.id, "type", e.target.value)}
                                className="select select-bordered w-full"
                              >
                                <option value="approve">Approve</option>
                                <option value="transfer">Transfer</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="form-control col-span-2">
                                <label className="label">
                                  <span className="label-text font-medium">Token Address</span>
                                </label>
                                <input
                                  type="text"
                                  value={rawTokenAddresses[operation.id] || (operation as ERC20Operation).tokenAddress}
                                  onChange={(e) => updateRawTokenAddress(operation.id, e.target.value)}
                                  placeholder="0x1234567890123456789012345678901234567890"
                                  className={`input input-bordered w-full ${
                                    rawTokenAddresses[operation.id] &&
                                    !isEmptyAddress(rawTokenAddresses[operation.id]) &&
                                    !isValidAddress(rawTokenAddresses[operation.id])
                                      ? "input-error"
                                      : ""
                                  }`}
                                />
                                {rawTokenAddresses[operation.id] &&
                                  !isEmptyAddress(rawTokenAddresses[operation.id]) &&
                                  !isValidAddress(rawTokenAddresses[operation.id]) && (
                                    <label className="label">
                                      <span className="label-text-alt text-error">Invalid Ethereum address</span>
                                    </label>
                                  )}
                                {tokenErrors[operation.id] && (
                                  <label className="label">
                                    <span className="label-text-alt text-error">{tokenErrors[operation.id]}</span>
                                  </label>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setTokenAddress(operation.id, XCUSDT_ADDRESS)}
                                    className="btn btn-outline btn-sm"
                                  >
                                    USDT
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTokenAddress(operation.id, XCUSDC_ADDRESS)}
                                    className="btn btn-outline btn-sm"
                                  >
                                    USDC
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTokenAddress(operation.id, GLMR_ADDRESS)}
                                    className="btn btn-outline btn-sm"
                                  >
                                    GLMR
                                  </button>
                                </div>
                              </div>
                              <div className="form-control">
                                <label className="label">
                                  <span className="label-text font-medium">Decimals</span>
                                </label>
                                {localLoadingDecimals.has((operation as ERC20Operation).tokenAddress) ? (
                                  <div className="input input-bordered w-full flex items-center justify-center h-12">
                                    <span className="text-sm me-4">Loading...</span>
                                    <span className="loading loading-ball loading-xs"></span>
                                  </div>
                                ) : tokenErrors[operation.id] ? (
                                  <div className="input input-bordered w-full bg-error/10 border-error">
                                    <span className="text-error text-sm">Error</span>
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    value={(operation as ERC20Operation).decimals}
                                    readOnly
                                    min="0"
                                    max="18"
                                    className="input input-bordered w-full bg-base-200"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="form-control col-span-2">
                                <label className="label">
                                  <span className="label-text font-medium">To Address</span>
                                </label>
                                <input
                                  type="text"
                                  value={(operation as ERC20Operation).to}
                                  onChange={(e) => updateOperation(operation.id, "to", e.target.value)}
                                  placeholder="0x1234567890123456789012345678901234567890"
                                  className="input input-bordered w-full"
                                />
                              </div>

                              <div className="form-control">
                                <label className="label">
                                  <span className="label-text font-medium">Amount</span>
                                </label>
                                <input
                                  type="text"
                                  value={(operation as ERC20Operation).amount}
                                  onChange={(e) => updateDecimalInput(operation.id, "amount", e.target.value)}
                                  placeholder="1.5"
                                  className={`input input-bordered w-full ${inputErrors[`${operation.id}-amount`] ? "input-error" : ""}`}
                                />
                                {inputErrors[`${operation.id}-amount`] && (
                                  <label className="label">
                                    <span className="label-text-alt text-error">{inputErrors[`${operation.id}-amount`]}</span>
                                  </label>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="form-control col-span-2">
                                <label className="label">
                                  <span className="label-text font-medium">Target Address *</span>
                                </label>
                                <input
                                  type="text"
                                  value={(operation as ArbitraryCallOperation).target}
                                  onChange={(e) => updateOperation(operation.id, "target", e.target.value)}
                                  placeholder="0x1234567890123456789012345678901234567890"
                                  className="input input-bordered w-full"
                                />
                              </div>

                              <div className="form-control">
                                <label className="label">
                                  <span className="label-text font-medium">Value (ETH)</span>
                                </label>
                                <input
                                  type="text"
                                  value={(operation as ArbitraryCallOperation).value || ""}
                                  onChange={(e) => updateDecimalInput(operation.id, "value", e.target.value)}
                                  placeholder="0.1"
                                  className={`input input-bordered w-full ${inputErrors[`${operation.id}-value`] ? "input-error" : ""}`}
                                />
                                {inputErrors[`${operation.id}-value`] && (
                                  <label className="label">
                                    <span className="label-text-alt text-error">{inputErrors[`${operation.id}-value`]}</span>
                                  </label>
                                )}
                              </div>
                            </div>

                            <div className="form-control">
                              <label className="label">
                                <span className="label-text font-medium">Calldata (hex)</span>
                              </label>
                              <textarea
                                value={(operation as ArbitraryCallOperation).calldata || ""}
                                onChange={(e) => updateOperation(operation.id, "calldata", e.target.value)}
                                placeholder="0x1234567890abcdef..."
                                className="textarea textarea-bordered w-full h-20"
                              />
                              <label className="label">
                                <span className="label-text-alt">Optional: Raw calldata to send to the target contract</span>
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="alert alert-error">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {isLoading || isSubmitting ? (
              <div className="flex flex-row items-center gap-2">
                <span className="text-s">Processing...</span>
                <span className="loading loading-dots loading-xs"></span>
              </div>
            ) : (
              <div className="card-actions justify-end">
                <button
                  type="submit"
                  disabled={isLoading || isSubmitting || !address || operations.length === 0 || !isMoonbeam}
                  className={`btn btn-primary btn-lg w-full min-h-[3rem] ${isLoading || isSubmitting ? "loading" : ""}`}
                >
                  {!isMoonbeam ? (
                    "Please switch to Moonbeam network"
                  ) : operations.length === 0 ? (
                    "Add operations to continue"
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Execute Transaction
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  )
}
