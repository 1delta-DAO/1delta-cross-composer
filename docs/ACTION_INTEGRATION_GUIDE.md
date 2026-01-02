# Action Integration Guide

This guide explains how to create and register custom actions in the application. Actions are modular components that allow users to perform various operations (swaps, bridges, deposits, etc.) within the destination action selector.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Step-by-Step Guide](#step-by-step-guide)
- [Available Features](#available-features)
- [Context and Props](#context-and-props)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

An action consists of three main components:

1. **Panel Component** - The UI component that users interact with
2. **Icon Component** - The icon displayed in the action selector grid
3. **Action Definition** - Configuration object that registers the action

The system automatically handles:

- Panel rendering and prop passing
- Readiness checks and availability
- Data loading and caching
- Reset functionality via `resetKey` prop

## Quick Start

Here's the minimal code needed to create and register an action:

```typescript
// 1. Create Panel Component
// src/components/actions/myaction/MyActionPanel.tsx
import { useEffect } from "react"
import { useConnection } from "wagmi"
import type { ActionHandler } from "../shared/types"
import type { ActionCall } from "../shared/types"
import type { RawCurrencyAmount } from "../../../types/currency"
import { useTokenLists } from "../../../hooks/useTokenLists"

interface MyActionPanelProps {
  setDestinationInfo?: ActionHandler
  resetKey?: number
}

export function MyActionPanel({ setDestinationInfo, resetKey }: MyActionPanelProps) {
  const { data: tokenLists } = useTokenLists()
  const { address } = useConnection()

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      // Reset panel state
    }
  }, [resetKey])

  return <div>My Action Panel</div>
}

// 2. Create Icon Component
// src/components/actions/myaction/MyActionIcon.tsx
export function MyActionIcon({ className = "" }: { className?: string }) {
  return <svg className={className}>...</svg>
}

// 3. Register Action
// src/components/actions/myaction/registerMyAction.ts
import { registerAction } from "../shared/actionRegistry"
import { MyActionPanel } from "./MyActionPanel"
import { MyActionIcon } from "./MyActionIcon"
import type { ActionDefinition } from "../shared/actionDefinitions"

export function registerMyAction(): void {
  const myAction: ActionDefinition = {
    id: "myaction",
    label: "My Action",
    category: "defi",
    icon: MyActionIcon,
    panel: MyActionPanel,
    priority: 6,
    actionType: "lending",
  }

  registerAction(myAction)
}

// 4. Add to registration file
// src/components/actions/shared/registerActions.ts
import { registerMyAction } from "../myaction/registerMyAction"

export function registerActions(): void {
  // ... existing registrations
  registerMyAction()
}
```

## Step-by-Step Guide

### Step 1: Create the Panel Component

Create a React component that implements the panel interface:

**File**: `src/components/actions/myaction/MyActionPanel.tsx`

```typescript
import { useState, useEffect } from "react"
import { useConnection } from "wagmi"
import type { ActionHandler } from "../shared/types"
import type { ActionCall } from "../shared/types"
import type { RawCurrencyAmount } from "../../../types/currency"
import { useTokenLists } from "../../../hooks/useTokenLists"

interface MyActionPanelProps {
  setDestinationInfo?: ActionHandler
  resetKey?: number
  // Add any custom props your action needs
  customProp?: string
}

export function MyActionPanel({ setDestinationInfo, customProp, resetKey }: MyActionPanelProps) {
  const { data: tokenLists } = useTokenLists()
  const { address } = useConnection()
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setSelectedItem(null)
      // Reset any other state
    }
  }, [resetKey])

  const handleAction = () => {
    if (!setDestinationInfo || !address) return

    // Build your action calls
    const actionCalls: ActionCall[] = [
      // Your encoded calls here
    ]

    // Set destination info
    setDestinationInfo(
      currencyAmount, // RawCurrencyAmount | undefined
      address, // string | undefined (receiver address)
      actionCalls, // ActionCall[]
      "My Action Label", // optional: actionLabel?: string
      "myaction" // optional: actionId?: string
    )
  }

  return (
    <div className="space-y-3">
      {/* Your panel UI here */}
      <button onClick={handleAction}>Execute Action</button>
    </div>
  )
}
```

**Key Requirements:**

- Must accept a `resetKey?: number` prop and watch it in a `useEffect` to reset state when it changes
- Should accept at least `setDestinationInfo` prop
- Should use `useTokenLists()` hook to access token lists data
- Should call `setDestinationInfo` when the user completes an action
- Import types from `../shared/types` and `../../../types/currency` as needed

### Step 2: Create the Icon Component

Create an icon component in the same directory as your panel:

**File**: `src/components/actions/myaction/MyActionIcon.tsx`

```typescript
export function MyActionIcon({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {/* Your SVG path here */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M..." />
    </svg>
  )
}
```

**Requirements:**

- Must accept `className` prop for styling
- Should be an SVG icon (recommended size: 24x24 viewBox)
- Should use `stroke` or `fill` for coloring
- Place the icon file in the same directory as your panel component

### Step 3: Register the Action

Create a registration file and call `registerAction()`:

**File**: `src/components/actions/myaction/registerMyAction.ts`

```typescript
import { registerAction } from '../shared/actionRegistry'
import { MyActionPanel } from './MyActionPanel'
import { MyActionIcon } from './MyActionIcon'
import type { ActionDefinition } from '../shared/actionDefinitions'

export function registerMyAction(): void {
  const myAction: ActionDefinition = {
    id: 'myaction',
    label: 'My Action',
    category: 'defi',
    icon: MyActionIcon,
    panel: MyActionPanel,
    priority: 6,
    actionType: 'lending',
    requiresSrcCurrency: false,
    buildPanelProps: (context) => ({
      setDestinationInfo: context.setDestinationInfo,
      customProp: 'custom value',
    }),
  }

  registerAction(myAction)
}
```

**Then add the registration function** to [registerActions.ts](../src/components/actions/shared/registerActions.ts):

```typescript
import { registerMyAction } from '../myaction/registerMyAction'

export function registerActions(): void {
  registerSwapAction()
  registerBridgeAction()
  registerDepositAction()
  registerStakingAction()
  registerNftAction()
  registerMyAction() // Add your action here
}
```

The `registerActions()` function is automatically called during app initialization in `src/initialize.ts`.

## Available Features

### Required Fields

| Field        | Type             | Description                                                                  |
| ------------ | ---------------- | ---------------------------------------------------------------------------- |
| `id`         | `string`         | Unique identifier for the action (e.g., "swap", "bridge")                    |
| `label`      | `string`         | Display name shown in the action grid                                        |
| `category`   | `ActionCategory` | Category: "all", "defi", "lending", "gaming", or "yield"                     |
| `icon`       | `ComponentType`  | React component for the action icon                                          |
| `panel`      | `ComponentType`  | React component for the action panel                                         |
| `priority`   | `number`         | Lower numbers appear first in collapsed view (top 3 shown)                   |
| `actionType` | `ActionType`     | Type: any string (e.g., "lending", "staking", "game_token", or "buy_ticket") |

### Optional Fields

#### `requiresSrcCurrency?: boolean`

If `true`, the action will only be shown when a source currency is available.

```typescript
{
  requiresSrcCurrency: true,
}
```

#### `params?: ActionParams`

Optional action-specific parameters. Currently supports:

- `lender?: string` - Lender provider identifier (e.g., "MOONWELL") used for displaying lender badges

```typescript
{
  params: {
    lender: 'MOONWELL',
  },
}
```

#### `buildPanelProps?: (context: ActionPanelContext) => Record<string, any>`

Custom function to build props passed to your panel component. If not provided, only common props (`setDestinationInfo`) are passed.

```typescript
{
  buildPanelProps: (context) => ({
    setDestinationInfo: context.setDestinationInfo,
    srcCurrency: context.srcCurrency,
    dstCurrency: context.dstCurrency,
    slippage: context.slippage,
    customData: context.actionData, // Preloaded data from dataLoader
    quotes: context.quotes, // Available quotes (for swap/bridge actions)
    selectedQuoteIndex: context.selectedQuoteIndex,
    setSelectedQuoteIndex: context.setSelectedQuoteIndex,
    requiresExactDestinationAmount: context.requiresExactDestinationAmount,
    destinationInfo: context.destinationInfo,
    isRequoting: context.isRequoting,
  }),
}
```

**Note:** `tokenLists` is not available in `ActionPanelContext`. Use the `useTokenLists()` hook in your panel component to access token data instead.

#### `dataLoader?: (context: ActionLoaderContext) => Promise<any>`

Async function to preload data when actions become available. The loaded data is passed to your panel via `buildPanelProps` as `context.actionData`.

```typescript
{
  dataLoader: async (context) => {
    // Note: context only has srcCurrency and dstCurrency
    const data = await fetchMyData(context.srcCurrency, context.dstCurrency)
    return data
  },
  buildPanelProps: (context) => ({
    // ...
    preloadedData: context.actionData, // Data from dataLoader
  }),
}
```

## Context and Props

### ActionPanelContext

Available in `buildPanelProps`:

```typescript
interface ActionPanelContext {
  setDestinationInfo?: ActionHandler // Callback to set destination
  srcCurrency?: RawCurrency // Source currency (if available)
  dstCurrency?: RawCurrency // Destination currency (if available)
  slippage?: number // Slippage tolerance
  actionData?: any // Preloaded data from dataLoader
  quotes?: Array<{ label: string; trade: GenericTrade }> // Available quotes (for swap/bridge)
  selectedQuoteIndex?: number // Currently selected quote index
  setSelectedQuoteIndex?: (index: number) => void // Function to set selected quote
  requiresExactDestinationAmount?: boolean // Whether exact destination amount is required
  destinationInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string; actionId?: string } // Current destination info
  isRequoting?: boolean // Whether requoting is in progress
}
```

**Note:** `tokenLists` is not available in `ActionPanelContext`. Use the `useTokenLists()` hook in your panel component to access token data instead.

### ActionLoaderContext

Available in `dataLoader`:

```typescript
interface ActionLoaderContext {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
}
```

**Note:** `userAddress`, `tokenLists`, and `chainId` are not available in the loader context. If you need these in your data loader, you'll need to pass them through `buildPanelProps` or access them differently.

## Examples

### Example 1: Simple Action (No Custom Props)

```typescript
import { registerAction } from '../shared/actionRegistry'
import { SimplePanel } from './SimplePanel'
import { SimpleIcon } from './SimpleIcon'
import type { ActionDefinition } from '../shared/actionDefinitions'

export function registerSimpleAction(): void {
  const simpleAction: ActionDefinition = {
    id: 'simple',
    label: 'Simple Action',
    category: 'defi',
    icon: SimpleIcon,
    panel: SimplePanel,
    priority: 7,
    actionType: 'lending',
  }

  registerAction(simpleAction)
}
```

### Example 2: Action with Custom Props

```typescript
registerAction({
  id: 'custom',
  label: 'Custom Action',
  category: 'defi',
  icon: CustomIcon,
  panel: CustomPanel,
  priority: 6,
  actionType: 'lending',
  requiresSrcCurrency: true,
  buildPanelProps: (context) => ({
    setDestinationInfo: context.setDestinationInfo,
    srcCurrency: context.srcCurrency,
    dstCurrency: context.dstCurrency,
    slippage: context.slippage,
  }),
})
```

### Example 3: Action with Data Loading

```typescript
registerAction({
  id: 'dataheavy',
  label: 'Data Heavy Action',
  category: 'gaming',
  icon: DataIcon,
  panel: DataPanel,
  priority: 3,
  actionType: 'game_token',
  dataLoader: async (context) => {
    const listings = await fetchListings(context.srcCurrency, context.dstCurrency)
    return listings
  },
  buildPanelProps: (context) => ({
    setDestinationInfo: context.setDestinationInfo,
    preloadedListings: context.actionData, // Preloaded listings from dataLoader
  }),
})
```

### Example 4: Action with Destination Info

```typescript
registerAction({
  id: 'conditional',
  label: 'Conditional Action',
  category: 'lending',
  icon: ConditionalIcon,
  panel: ConditionalPanel,
  priority: 2,
  actionType: 'lending',
  buildPanelProps: (context) => ({
    setDestinationInfo: context.setDestinationInfo,
    requiresExactDestinationAmount: context.requiresExactDestinationAmount,
    destinationInfo: context.destinationInfo,
    isRequoting: context.isRequoting,
  }),
})
```

### Example 5: Action with Quotes (Swap/Bridge Pattern)

```typescript
registerAction({
  id: 'bridge',
  label: 'Bridge',
  category: 'defi',
  icon: BridgeIcon,
  panel: BridgePanel,
  priority: 3,
  actionType: 'lending',
  requiresSrcCurrency: true,
  buildPanelProps: (context) => ({
    setDestinationInfo: context.setDestinationInfo,
    srcCurrency: context.srcCurrency,
    dstCurrency: context.dstCurrency,
    slippage: context.slippage,
    quotes: context.quotes,
    selectedQuoteIndex: context.selectedQuoteIndex,
    setSelectedQuoteIndex: context.setSelectedQuoteIndex,
  }),
})
```

## Best Practices

### 1. Panel Component Structure

- Always accept a `resetKey?: number` prop and watch it in `useEffect` to reset state when it changes
- Keep panel state local to the component
- Use `useTokenLists()` hook to access token lists data (don't expect `tokenLists` as a prop)
- Call `setDestinationInfo` when user completes an action, optionally providing `actionLabel` and `actionId`
- Handle loading and error states gracefully
- Import types from `../shared/types` and `../../../types/currency` as needed

### 2. Icon Design

- Use consistent 24x24 viewBox
- Prefer stroke-based icons for better theming
- Keep icons simple and recognizable
- Test icons at different sizes

### 3. Action Registration

- Use descriptive, unique action IDs
- Choose appropriate categories
- Set priority based on importance (lower = higher priority)
- Use `buildPanelProps` to pass only needed props

### 4. Data Loading

- Use `dataLoader` for expensive async operations
- Handle errors gracefully (return empty data, not throw)
- Cache data appropriately
- Access loaded data via `context.actionData` in `buildPanelProps`

### 5. Error Handling

- Always check for required props before using them
- Provide user-friendly error messages
- Log errors for debugging
- Gracefully degrade when data is unavailable
- Use `useTokenLists()` hook for token data access instead of expecting it as a prop

### 6. Performance

- Minimize re-renders with proper memoization
- Use `dataLoader` to preload data
- Avoid heavy computations in render
- Optimize icon rendering

## Common Patterns

### Pattern 1: Token Selection Action

```typescript
// Panel that allows selecting a token and amount
// Note: Use useTokenLists() hook in the panel component for token data
buildPanelProps: (context) => ({
  setDestinationInfo: context.setDestinationInfo,
  srcCurrency: context.srcCurrency,
  dstCurrency: context.dstCurrency,
})
```

### Pattern 2: Action with Destination Info

```typescript
// Action that needs destination info and requoting state
buildPanelProps: (context) => ({
  setDestinationInfo: context.setDestinationInfo,
  requiresExactDestinationAmount: context.requiresExactDestinationAmount,
  destinationInfo: context.destinationInfo,
  isRequoting: context.isRequoting,
})
```

### Pattern 3: Action with Slippage

```typescript
// Action that needs slippage tolerance
buildPanelProps: (context) => ({
  setDestinationInfo: context.setDestinationInfo,
  srcCurrency: context.srcCurrency,
  dstCurrency: context.dstCurrency,
  slippage: context.slippage,
})
```

### Pattern 4: Action with Quotes

```typescript
// Action that displays and manages quotes (swap/bridge)
buildPanelProps: (context) => ({
  setDestinationInfo: context.setDestinationInfo,
  srcCurrency: context.srcCurrency,
  dstCurrency: context.dstCurrency,
  slippage: context.slippage,
  quotes: context.quotes,
  selectedQuoteIndex: context.selectedQuoteIndex,
  setSelectedQuoteIndex: context.setSelectedQuoteIndex,
})
```

## Troubleshooting

### Action Not Appearing

- Check that registration function is called
- Verify `requiresSrcCurrency` settings
- Ensure action ID is unique

### Panel Not Resetting

- Verify `resetKey` prop is accepted and watched in `useEffect`
- Check that reset logic runs when `resetKey` changes
- Ensure reset logic properly clears all panel state

### Props Not Available

- Use `buildPanelProps` to pass custom props
- Check `ActionPanelContext` for available data
- Verify props are included in the returned object
- Use `useTokenLists()` hook for token data instead of expecting it as a prop

### Data Not Loading

- Check `dataLoader` error handling
- Verify data is returned (not undefined)
- Access data via `context.actionData` in `buildPanelProps`

## Additional Resources

- See existing actions in `src/components/actions/` for reference:
  - Swap: `src/components/actions/swap/`
  - Bridge: `src/components/actions/bridge/`
  - Deposit: `src/components/actions/lending/deposit/`
  - Staking: `src/components/actions/staking/stella/`
  - NFT: `src/components/actions/nft/olderfall/`
- Check `src/components/actions/shared/actionDefinitions.ts` for type definitions
- Review `src/components/actions/shared/actionRegistry.ts` for registration API
- Review `src/components/actions/shared/registerActions.ts` to see how actions are registered
- Check `src/initialize.ts` to see how `registerActions()` is called during app initialization

## Important Notes

1. **Reset Key**: The `resetKey` prop is automatically managed by the `DestinationActionSelector` component. It combines the parent's `resetKey` with an internal `panelResetKey` to trigger resets when needed.

2. **Token Lists Access**: Use the `useTokenLists()` hook to access token lists in your panel component. The hook returns `{ data, isLoading, error }` where `data` is a `Record<string, Record<string, RawCurrency>>` keyed by chainId and lowercase token address.

3. **Action Registration**: All actions must be registered in `src/components/actions/shared/registerActions.ts` for them to be available in the app.
