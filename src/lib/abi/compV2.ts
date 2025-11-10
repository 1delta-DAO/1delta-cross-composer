export const VenusLensAbi = [
    {
        inputs: [
            { internalType: "bool", name: "timeBased_", type: "bool" },
            { internalType: "uint256", name: "blocksPerYear_", type: "uint256" },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    { inputs: [], name: "InvalidBlocksPerYear", type: "error" },
    { inputs: [], name: "InvalidTimeBasedConfiguration", type: "error" },
    {
        inputs: [],
        name: "blocksOrSecondsPerYear",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "address", name: "poolRegistryAddress", type: "address" }],
        name: "getAllPools",
        outputs: [
            {
                components: [
                    { internalType: "string", name: "name", type: "string" },
                    { internalType: "address", name: "creator", type: "address" },
                    { internalType: "address", name: "comptroller", type: "address" },
                    { internalType: "uint256", name: "blockPosted", type: "uint256" },
                    { internalType: "uint256", name: "timestampPosted", type: "uint256" },
                    { internalType: "string", name: "category", type: "string" },
                    { internalType: "string", name: "logoURL", type: "string" },
                    { internalType: "string", name: "description", type: "string" },
                    { internalType: "address", name: "priceOracle", type: "address" },
                    { internalType: "uint256", name: "closeFactor", type: "uint256" },
                    {
                        internalType: "uint256",
                        name: "liquidationIncentive",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "minLiquidatableCollateral",
                        type: "uint256",
                    },
                    {
                        components: [
                            { internalType: "address", name: "vToken", type: "address" },
                            {
                                internalType: "uint256",
                                name: "exchangeRateCurrent",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "supplyRatePerBlockOrTimestamp",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "borrowRatePerBlockOrTimestamp",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "reserveFactorMantissa",
                                type: "uint256",
                            },
                            { internalType: "uint256", name: "supplyCaps", type: "uint256" },
                            { internalType: "uint256", name: "borrowCaps", type: "uint256" },
                            {
                                internalType: "uint256",
                                name: "totalBorrows",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "totalReserves",
                                type: "uint256",
                            },
                            { internalType: "uint256", name: "totalSupply", type: "uint256" },
                            { internalType: "uint256", name: "totalCash", type: "uint256" },
                            { internalType: "bool", name: "isListed", type: "bool" },
                            {
                                internalType: "uint256",
                                name: "collateralFactorMantissa",
                                type: "uint256",
                            },
                            {
                                internalType: "address",
                                name: "underlyingAssetAddress",
                                type: "address",
                            },
                            {
                                internalType: "uint256",
                                name: "vTokenDecimals",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "underlyingDecimals",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "pausedActions",
                                type: "uint256",
                            },
                        ],
                        internalType: "struct PoolLens.VTokenMetadata[]",
                        name: "vTokens",
                        type: "tuple[]",
                    },
                ],
                internalType: "struct PoolLens.PoolData[]",
                name: "",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getBlockNumberOrTimestamp",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { internalType: "address", name: "account", type: "address" },
            { internalType: "address", name: "comptrollerAddress", type: "address" },
        ],
        name: "getPendingRewards",
        outputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "distributorAddress",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "rewardTokenAddress",
                        type: "address",
                    },
                    { internalType: "uint256", name: "totalRewards", type: "uint256" },
                    {
                        components: [
                            {
                                internalType: "address",
                                name: "vTokenAddress",
                                type: "address",
                            },
                            { internalType: "uint256", name: "amount", type: "uint256" },
                        ],
                        internalType: "struct PoolLens.PendingReward[]",
                        name: "pendingRewards",
                        type: "tuple[]",
                    },
                ],
                internalType: "struct PoolLens.RewardSummary[]",
                name: "",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "address", name: "comptrollerAddress", type: "address" }],
        name: "getPoolBadDebt",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "comptroller", type: "address" },
                    { internalType: "uint256", name: "totalBadDebtUsd", type: "uint256" },
                    {
                        components: [
                            {
                                internalType: "address",
                                name: "vTokenAddress",
                                type: "address",
                            },
                            { internalType: "uint256", name: "badDebtUsd", type: "uint256" },
                        ],
                        internalType: "struct PoolLens.BadDebt[]",
                        name: "badDebts",
                        type: "tuple[]",
                    },
                ],
                internalType: "struct PoolLens.BadDebtSummary",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { internalType: "address", name: "poolRegistryAddress", type: "address" },
            { internalType: "address", name: "comptroller", type: "address" },
        ],
        name: "getPoolByComptroller",
        outputs: [
            {
                components: [
                    { internalType: "string", name: "name", type: "string" },
                    { internalType: "address", name: "creator", type: "address" },
                    { internalType: "address", name: "comptroller", type: "address" },
                    { internalType: "uint256", name: "blockPosted", type: "uint256" },
                    { internalType: "uint256", name: "timestampPosted", type: "uint256" },
                    { internalType: "string", name: "category", type: "string" },
                    { internalType: "string", name: "logoURL", type: "string" },
                    { internalType: "string", name: "description", type: "string" },
                    { internalType: "address", name: "priceOracle", type: "address" },
                    { internalType: "uint256", name: "closeFactor", type: "uint256" },
                    {
                        internalType: "uint256",
                        name: "liquidationIncentive",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "minLiquidatableCollateral",
                        type: "uint256",
                    },
                    {
                        components: [
                            { internalType: "address", name: "vToken", type: "address" },
                            {
                                internalType: "uint256",
                                name: "exchangeRateCurrent",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "supplyRatePerBlockOrTimestamp",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "borrowRatePerBlockOrTimestamp",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "reserveFactorMantissa",
                                type: "uint256",
                            },
                            { internalType: "uint256", name: "supplyCaps", type: "uint256" },
                            { internalType: "uint256", name: "borrowCaps", type: "uint256" },
                            {
                                internalType: "uint256",
                                name: "totalBorrows",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "totalReserves",
                                type: "uint256",
                            },
                            { internalType: "uint256", name: "totalSupply", type: "uint256" },
                            { internalType: "uint256", name: "totalCash", type: "uint256" },
                            { internalType: "bool", name: "isListed", type: "bool" },
                            {
                                internalType: "uint256",
                                name: "collateralFactorMantissa",
                                type: "uint256",
                            },
                            {
                                internalType: "address",
                                name: "underlyingAssetAddress",
                                type: "address",
                            },
                            {
                                internalType: "uint256",
                                name: "vTokenDecimals",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "underlyingDecimals",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "pausedActions",
                                type: "uint256",
                            },
                        ],
                        internalType: "struct PoolLens.VTokenMetadata[]",
                        name: "vTokens",
                        type: "tuple[]",
                    },
                ],
                internalType: "struct PoolLens.PoolData",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { internalType: "address", name: "poolRegistryAddress", type: "address" },
            {
                components: [
                    { internalType: "string", name: "name", type: "string" },
                    { internalType: "address", name: "creator", type: "address" },
                    { internalType: "address", name: "comptroller", type: "address" },
                    { internalType: "uint256", name: "blockPosted", type: "uint256" },
                    { internalType: "uint256", name: "timestampPosted", type: "uint256" },
                ],
                internalType: "struct PoolRegistryInterface.VenusPool",
                name: "venusPool",
                type: "tuple",
            },
        ],
        name: "getPoolDataFromVenusPool",
        outputs: [
            {
                components: [
                    { internalType: "string", name: "name", type: "string" },
                    { internalType: "address", name: "creator", type: "address" },
                    { internalType: "address", name: "comptroller", type: "address" },
                    { internalType: "uint256", name: "blockPosted", type: "uint256" },
                    { internalType: "uint256", name: "timestampPosted", type: "uint256" },
                    { internalType: "string", name: "category", type: "string" },
                    { internalType: "string", name: "logoURL", type: "string" },
                    { internalType: "string", name: "description", type: "string" },
                    { internalType: "address", name: "priceOracle", type: "address" },
                    { internalType: "uint256", name: "closeFactor", type: "uint256" },
                    {
                        internalType: "uint256",
                        name: "liquidationIncentive",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "minLiquidatableCollateral",
                        type: "uint256",
                    },
                    {
                        components: [
                            { internalType: "address", name: "vToken", type: "address" },
                            {
                                internalType: "uint256",
                                name: "exchangeRateCurrent",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "supplyRatePerBlockOrTimestamp",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "borrowRatePerBlockOrTimestamp",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "reserveFactorMantissa",
                                type: "uint256",
                            },
                            { internalType: "uint256", name: "supplyCaps", type: "uint256" },
                            { internalType: "uint256", name: "borrowCaps", type: "uint256" },
                            {
                                internalType: "uint256",
                                name: "totalBorrows",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "totalReserves",
                                type: "uint256",
                            },
                            { internalType: "uint256", name: "totalSupply", type: "uint256" },
                            { internalType: "uint256", name: "totalCash", type: "uint256" },
                            { internalType: "bool", name: "isListed", type: "bool" },
                            {
                                internalType: "uint256",
                                name: "collateralFactorMantissa",
                                type: "uint256",
                            },
                            {
                                internalType: "address",
                                name: "underlyingAssetAddress",
                                type: "address",
                            },
                            {
                                internalType: "uint256",
                                name: "vTokenDecimals",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "underlyingDecimals",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "pausedActions",
                                type: "uint256",
                            },
                        ],
                        internalType: "struct PoolLens.VTokenMetadata[]",
                        name: "vTokens",
                        type: "tuple[]",
                    },
                ],
                internalType: "struct PoolLens.PoolData",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { internalType: "address", name: "poolRegistryAddress", type: "address" },
            { internalType: "address", name: "asset", type: "address" },
        ],
        name: "getPoolsSupportedByAsset",
        outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { internalType: "address", name: "poolRegistryAddress", type: "address" },
            { internalType: "address", name: "comptroller", type: "address" },
            { internalType: "address", name: "asset", type: "address" },
        ],
        name: "getVTokenForAsset",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "isTimeBased",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { internalType: "contract VToken", name: "vToken", type: "address" },
            { internalType: "address", name: "account", type: "address" },
        ],
        name: "vTokenBalances",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "vToken", type: "address" },
                    { internalType: "uint256", name: "balanceOf", type: "uint256" },
                    {
                        internalType: "uint256",
                        name: "borrowBalanceCurrent",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "balanceOfUnderlying",
                        type: "uint256",
                    },
                    { internalType: "uint256", name: "tokenBalance", type: "uint256" },
                    { internalType: "uint256", name: "tokenAllowance", type: "uint256" },
                ],
                internalType: "struct PoolLens.VTokenBalances",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { internalType: "contract VToken[]", name: "vTokens", type: "address[]" },
            { internalType: "address", name: "account", type: "address" },
        ],
        name: "vTokenBalancesAll",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "vToken", type: "address" },
                    { internalType: "uint256", name: "balanceOf", type: "uint256" },
                    {
                        internalType: "uint256",
                        name: "borrowBalanceCurrent",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "balanceOfUnderlying",
                        type: "uint256",
                    },
                    { internalType: "uint256", name: "tokenBalance", type: "uint256" },
                    { internalType: "uint256", name: "tokenAllowance", type: "uint256" },
                ],
                internalType: "struct PoolLens.VTokenBalances[]",
                name: "",
                type: "tuple[]",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [{ internalType: "contract VToken", name: "vToken", type: "address" }],
        name: "vTokenMetadata",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "vToken", type: "address" },
                    {
                        internalType: "uint256",
                        name: "exchangeRateCurrent",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "supplyRatePerBlockOrTimestamp",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "borrowRatePerBlockOrTimestamp",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "reserveFactorMantissa",
                        type: "uint256",
                    },
                    { internalType: "uint256", name: "supplyCaps", type: "uint256" },
                    { internalType: "uint256", name: "borrowCaps", type: "uint256" },
                    { internalType: "uint256", name: "totalBorrows", type: "uint256" },
                    { internalType: "uint256", name: "totalReserves", type: "uint256" },
                    { internalType: "uint256", name: "totalSupply", type: "uint256" },
                    { internalType: "uint256", name: "totalCash", type: "uint256" },
                    { internalType: "bool", name: "isListed", type: "bool" },
                    {
                        internalType: "uint256",
                        name: "collateralFactorMantissa",
                        type: "uint256",
                    },
                    {
                        internalType: "address",
                        name: "underlyingAssetAddress",
                        type: "address",
                    },
                    { internalType: "uint256", name: "vTokenDecimals", type: "uint256" },
                    {
                        internalType: "uint256",
                        name: "underlyingDecimals",
                        type: "uint256",
                    },
                    { internalType: "uint256", name: "pausedActions", type: "uint256" },
                ],
                internalType: "struct PoolLens.VTokenMetadata",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "contract VToken[]", name: "vTokens", type: "address[]" }],
        name: "vTokenMetadataAll",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "vToken", type: "address" },
                    {
                        internalType: "uint256",
                        name: "exchangeRateCurrent",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "supplyRatePerBlockOrTimestamp",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "borrowRatePerBlockOrTimestamp",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "reserveFactorMantissa",
                        type: "uint256",
                    },
                    { internalType: "uint256", name: "supplyCaps", type: "uint256" },
                    { internalType: "uint256", name: "borrowCaps", type: "uint256" },
                    { internalType: "uint256", name: "totalBorrows", type: "uint256" },
                    { internalType: "uint256", name: "totalReserves", type: "uint256" },
                    { internalType: "uint256", name: "totalSupply", type: "uint256" },
                    { internalType: "uint256", name: "totalCash", type: "uint256" },
                    { internalType: "bool", name: "isListed", type: "bool" },
                    {
                        internalType: "uint256",
                        name: "collateralFactorMantissa",
                        type: "uint256",
                    },
                    {
                        internalType: "address",
                        name: "underlyingAssetAddress",
                        type: "address",
                    },
                    { internalType: "uint256", name: "vTokenDecimals", type: "uint256" },
                    {
                        internalType: "uint256",
                        name: "underlyingDecimals",
                        type: "uint256",
                    },
                    { internalType: "uint256", name: "pausedActions", type: "uint256" },
                ],
                internalType: "struct PoolLens.VTokenMetadata[]",
                name: "",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "contract VToken", name: "vToken", type: "address" }],
        name: "vTokenUnderlyingPrice",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "vToken", type: "address" },
                    { internalType: "uint256", name: "underlyingPrice", type: "uint256" },
                ],
                internalType: "struct PoolLens.VTokenUnderlyingPrice",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "contract VToken[]", name: "vTokens", type: "address[]" }],
        name: "vTokenUnderlyingPriceAll",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "vToken", type: "address" },
                    { internalType: "uint256", name: "underlyingPrice", type: "uint256" },
                ],
                internalType: "struct PoolLens.VTokenUnderlyingPrice[]",
                name: "",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    // MONWELL MARKETS
    {
        inputs: [
            {
                internalType: "contract MToken",
                name: "_mToken",
                type: "address",
            },
        ],
        name: "getMarketInfo",
        outputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "market",
                        type: "address",
                    },
                    {
                        internalType: "bool",
                        name: "isListed",
                        type: "bool",
                    },
                    {
                        internalType: "uint256",
                        name: "borrowCap",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "supplyCap",
                        type: "uint256",
                    },
                    {
                        internalType: "bool",
                        name: "mintPaused",
                        type: "bool",
                    },
                    {
                        internalType: "bool",
                        name: "borrowPaused",
                        type: "bool",
                    },
                    {
                        internalType: "uint256",
                        name: "collateralFactor",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "underlyingPrice",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "totalSupply",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "totalBorrows",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "totalReserves",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "cash",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "exchangeRate",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "borrowIndex",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "reserveFactor",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "borrowRate",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "supplyRate",
                        type: "uint256",
                    },
                    {
                        components: [
                            {
                                internalType: "address",
                                name: "token",
                                type: "address",
                            },
                            {
                                internalType: "uint256",
                                name: "supplyIncentivesPerSec",
                                type: "uint256",
                            },
                            {
                                internalType: "uint256",
                                name: "borrowIncentivesPerSec",
                                type: "uint256",
                            },
                        ],
                        internalType: "struct BaseMoonwellViews.MarketIncentives[]",
                        name: "incentives",
                        type: "tuple[]",
                    },
                ],
                internalType: "struct BaseMoonwellViews.Market",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const

export const ComptrollerV2Abi = [
    {
        inputs: [],
        name: "getAllMarkets",
        outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "address[]", name: "cTokens", type: "address[]" }],
        name: "enterMarkets",
        outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const
