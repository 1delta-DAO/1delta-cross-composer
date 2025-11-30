export const CALL_PERMIT_ABI = [
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'dispatch',
    inputs: [
      { name: 'from', type: 'address', internalType: 'address' },
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
      { name: 'gaslimit', type: 'uint64', internalType: 'uint64' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'v', type: 'uint8', internalType: 'uint8' },
      { name: 'r', type: 'bytes32', internalType: 'bytes32' },
      { name: 's', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: 'output', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export const BATCH_ABI = [
  {
    type: 'function',
    name: 'batchAll',
    inputs: [
      { name: 'to', type: 'address[]', internalType: 'address[]' },
      { name: 'value', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'callData', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'gasLimit', type: 'uint64[]', internalType: 'uint64[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchSome',
    inputs: [
      { name: 'to', type: 'address[]', internalType: 'address[]' },
      { name: 'value', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'callData', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'gasLimit', type: 'uint64[]', internalType: 'uint64[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchSomeUntilFailure',
    inputs: [
      { name: 'to', type: 'address[]', internalType: 'address[]' },
      { name: 'value', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'callData', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'gasLimit', type: 'uint64[]', internalType: 'uint64[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'SubcallFailed',
    inputs: [{ name: 'index', type: 'uint256', indexed: false, internalType: 'uint256' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SubcallSucceeded',
    inputs: [{ name: 'index', type: 'uint256', indexed: false, internalType: 'uint256' }],
    anonymous: false,
  },
] as const

export const CALLER_ABI = [
  {
    type: 'function',
    name: 'batchCall',
    inputs: [
      { name: 'to', type: 'address[]', internalType: 'address[]' },
      { name: 'value', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'callData', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'gasLimit', type: 'uint64[]', internalType: 'uint64[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'call',
    inputs: [
      { name: 'target', type: 'address', internalType: 'address' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'permitCall',
    inputs: [
      { name: 'from', type: 'address', internalType: 'address' },
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
      { name: 'gaslimit', type: 'uint64', internalType: 'uint64' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'v', type: 'uint8', internalType: 'uint8' },
      { name: 'r', type: 'bytes32', internalType: 'bytes32' },
      { name: 's', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'payable',
  },
] as const

export const MulticallABI = [
  {
    inputs: [],
    name: 'getCurrentBlockTimestamp',
    outputs: [
      {
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'addr',
        type: 'address',
      },
    ],
    name: 'getEthBalance',
    outputs: [
      {
        internalType: 'uint256',
        name: 'balance',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBlockNumber',
    outputs: [
      {
        internalType: 'uint256',
        name: 'blockNumber',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'target',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'gasLimit',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'callData',
            type: 'bytes',
          },
        ],
        internalType: 'struct UniswapInterfaceMulticall.Call[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'multicall',
    outputs: [
      {
        internalType: 'uint256',
        name: 'blockNumber',
        type: 'uint256',
      },
      {
        components: [
          {
            internalType: 'bool',
            name: 'success',
            type: 'bool',
          },
          {
            internalType: 'uint256',
            name: 'gasUsed',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'returnData',
            type: 'bytes',
          },
        ],
        internalType: 'struct UniswapInterfaceMulticall.Result[]',
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export const BalanceFetcherAbi = [
  {
    name: '1delta',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        type: 'bytes',
      },
    ],
    outputs: [
      {
        type: 'bytes',
      },
    ],
  },
  {
    name: 'InvalidInputLength',
    type: 'error',
    inputs: [],
  },
  {
    name: 'NoValue',
    type: 'error',
    inputs: [],
  },
] as const
