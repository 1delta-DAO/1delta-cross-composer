import { useMemo } from "react"
import {
  aavePools,
  aaveTokens,
  aaveReserves,
  compoundV3Pools,
  compoundV3BaseData,
  compoundV3Reserves,
  compoundV2Pools,
  compoundV2Tokens,
  compoundV2Reserves,
  morphoPools,
  morphoOracles,
  morphoTypeMarkets,
  morphoTypeOracles,
} from "@1delta/data-sdk"

/**
 * Returns a snapshot of lending data maps from @1delta/data-sdk.
 * These are static datasets bundled in the package.
 */
export function useLendingData() {
  return useMemo(() => {
    return {
      aave: {
        pools: aavePools(),
        tokens: aaveTokens(),
        reserves: aaveReserves(),
      },
      compoundV3: {
        pools: compoundV3Pools(),
        baseData: compoundV3BaseData(),
        reserves: compoundV3Reserves(),
      },
      compoundV2: {
        pools: compoundV2Pools(),
        tokens: compoundV2Tokens(),
        reserves: compoundV2Reserves(),
      },
      morpho: {
        pools: morphoPools(),
        oracles: morphoOracles(),
        typeMarkets: morphoTypeMarkets(),
        typeOracles: morphoTypeOracles(),
      },
    }
  }, [])
}
