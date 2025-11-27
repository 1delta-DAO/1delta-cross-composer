import type { Abi, Address } from 'viem'

export const SEQUENCE_MARKET_ADDRESS: Address = '0xfdb42A198a932C8D3B506Ffa5e855bC4b348a712'

export const OLDERFALL_COLLECTIONS: Record<string, Address[]> = {
  '137': [
    '0x50051304a13eebf1fa62d22858e8f62fac47d91f',
    '0x918da69d9abde0a93906c9f64d821193e9731c1f',
    '0x4c605d861f86038ec42dd5863e9cede5a181550e',
    '0x96fc7d0d7d1b39eeefec13f8fcc351d1bc3bdd51',
    '0x7341fc272731ae2d86b32e47382daf3b723a5724',
  ],
  '1284': ['0x502042347a577732704b8a16570d808ebbbb58d6'],
}

export const SEQUENCE_MARKET_ABI: Abi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'requestId', type: 'uint256' },
      { internalType: 'uint256', name: 'quantity', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
      { internalType: 'uint256[]', name: 'additionalFees', type: 'uint256[]' },
      { internalType: 'address[]', name: 'additionalFeeRecipients', type: 'address[]' },
    ],
    name: 'acceptRequest',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'requestId', type: 'uint256' }],
    name: 'getRequest',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'bool', name: 'isListing', type: 'bool' },
          { internalType: 'bool', name: 'isERC1155', type: 'bool' },
          { internalType: 'address', name: 'tokenContract', type: 'address' },
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
          { internalType: 'uint256', name: 'quantity', type: 'uint256' },
          { internalType: 'uint96', name: 'expiry', type: 'uint96' },
          { internalType: 'address', name: 'currency', type: 'address' },
          { internalType: 'uint256', name: 'pricePerToken', type: 'uint256' },
        ],
        internalType: 'struct ISequenceMarketStorage.Request',
        name: 'request',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'requestId', type: 'uint256' },
      { internalType: 'uint256', name: 'quantity', type: 'uint256' },
    ],
    name: 'isRequestValid',
    outputs: [
      { internalType: 'bool', name: 'valid', type: 'bool' },
      {
        components: [
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'bool', name: 'isListing', type: 'bool' },
          { internalType: 'bool', name: 'isERC1155', type: 'bool' },
          { internalType: 'address', name: 'tokenContract', type: 'address' },
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
          { internalType: 'uint256', name: 'quantity', type: 'uint256' },
          { internalType: 'uint96', name: 'expiry', type: 'uint96' },
          { internalType: 'address', name: 'currency', type: 'address' },
          { internalType: 'uint256', name: 'pricePerToken', type: 'uint256' },
        ],
        internalType: 'struct ISequenceMarketStorage.Request',
        name: 'request',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as Abi

export const SEQUENCE_PROJECT_ACCESS_KEY = import.meta.env.VITE_SEQUENCE_PROJECT_ACCESS_KEY as
  | string
  | undefined

export const SEQUENCE_PROJECT_ID = import.meta.env.VITE_SEQUENCE_PROJECT_ID as string | undefined

export const SEQUENCE_MARKETPLACE_API_URL = 'https://marketplace-api.sequence.app'
