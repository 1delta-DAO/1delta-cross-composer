import type { Abi, Address } from "viem"

export const SEQUENCE_MARKET_ADDRESS: Address = "0xfdb42A198a932C8D3B506Ffa5e855bC4b348a712"

export const OLDERFALL_ARMORS_ADDRESS: Address = "0x50051304a13eebf1fa62d22858e8f62fac47d91f"

export const SEQUENCE_MARKET_ABI: Abi = [
  {
    inputs: [
      { internalType: "uint256", name: "requestId", type: "uint256" },
      { internalType: "uint256", name: "quantity", type: "uint256" },
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256[]", name: "additionalFees", type: "uint256[]" },
      { internalType: "address[]", name: "additionalFeeRecipients", type: "address[]" },
    ],
    name: "acceptRequest",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "requestId", type: "uint256" }],
    name: "getRequest",
    outputs: [
      {
        components: [
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "bool", name: "isListing", type: "bool" },
          { internalType: "bool", name: "isERC1155", type: "bool" },
          { internalType: "address", name: "tokenContract", type: "address" },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
          { internalType: "uint256", name: "quantity", type: "uint256" },
          { internalType: "uint96", name: "expiry", type: "uint96" },
          { internalType: "address", name: "currency", type: "address" },
          { internalType: "uint256", name: "pricePerToken", type: "uint256" },
        ],
        internalType: "struct ISequenceMarketStorage.Request",
        name: "request",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "requestId", type: "uint256" },
      { internalType: "uint256", name: "quantity", type: "uint256" },
    ],
    name: "isRequestValid",
    outputs: [
      { internalType: "bool", name: "valid", type: "bool" },
      {
        components: [
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "bool", name: "isListing", type: "bool" },
          { internalType: "bool", name: "isERC1155", type: "bool" },
          { internalType: "address", name: "tokenContract", type: "address" },
          { internalType: "uint256", name: "tokenId", type: "uint256" },
          { internalType: "uint256", name: "quantity", type: "uint256" },
          { internalType: "uint96", name: "expiry", type: "uint96" },
          { internalType: "address", name: "currency", type: "address" },
          { internalType: "uint256", name: "pricePerToken", type: "uint256" },
        ],
        internalType: "struct ISequenceMarketStorage.Request",
        name: "request",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as Abi

export type SequenceRequest = {
  creator: Address
  isListing: boolean
  isERC1155: boolean
  tokenContract: Address
  tokenId: bigint
  quantity: bigint
  expiry: bigint
  currency: Address
  pricePerToken: bigint
}

export const SEQUENCE_PROJECT_ACCESS_KEY = import.meta.env.VITE_SEQUENCE_PROJECT_ACCESS_KEY as string | undefined

export const SEQUENCE_PROJECT_ID = import.meta.env.VITE_SEQUENCE_PROJECT_ID as string | undefined

export const SEQUENCE_MARKETPLACE_API_URL = import.meta.env.VITE_SEQUENCE_MARKETPLACE_API_URL as string | undefined

export const SEQUENCE_INDEXER_API_URL = import.meta.env.VITE_SEQUENCE_INDEXER_API_URL as string | undefined
