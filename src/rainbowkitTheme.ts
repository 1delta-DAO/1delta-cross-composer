// src/rainbowkitTheme.ts
import type { Theme } from "@rainbow-me/rainbowkit"

export const rainbowDaisyTheme: Theme = {
  blurs: {
    modalOverlay: "blur(8px)",
  },
  colors: {
    // Main accent (buttons, selected, etc.)
    accentColor: "hsl(var(--color-primary))",
    accentColorForeground: "hsl(var(--color-primary-content))",

    // Action buttons in modals
    actionButtonBorder: "hsl(var(--color-primary))",
    actionButtonBorderMobile: "hsl(var(--color-primary))",
    actionButtonSecondaryBackground: "hsl(var(--color-base-200))",

    // Close button
    closeButton: "hsl(var(--color-base-content))",
    closeButtonBackground: "hsl(var(--color-base-200))",

    // Connect button
    connectButtonBackground: "hsl(var(--color-base-200))",
    connectButtonBackgroundError: "hsl(var(--color-error))",
    connectButtonInnerBackground: "hsl(var(--color-base-100))",
    connectButtonText: "hsl(var(--color-base-content))",
    connectButtonTextError: "hsl(var(--color-error))",

    // Connection dot
    connectionIndicator: "hsl(var(--color-success))",

    // Download cards
    downloadBottomCardBackground: "hsl(var(--color-base-100))",
    downloadTopCardBackground: "hsl(var(--color-base-200))",

    // Generic colors
    error: "hsl(var(--color-error))",
    generalBorder: "hsl(var(--color-base-300))",
    generalBorderDim: "hsl(var(--color-base-200))",

    menuItemBackground: "hsl(var(--color-base-100))",

    // Backdrop behind modal
    modalBackdrop: "rgba(0,0,0,0.6)",

    // Modal itself
    modalBackground: "var(--color-base-100)",
    modalBorder: "hsl(var(--color-base-300))",
    modalText: "hsl(var(--color-base-content))",
    modalTextDim: "hsl(var(--color-base-300))",
    modalTextSecondary: "hsl(var(--color-base-content))",

    // Profile section
    profileAction: "hsl(var(--color-primary))",
    profileActionHover: "hsl(var(--color-accent))",
    profileForeground: "hsl(var(--color-base-100))",

    selectedOptionBorder: "hsl(var(--color-primary))",

    standby: "hsl(var(--color-warning))",
  },
  fonts: {
    // DaisyUI already sets font-family per theme if you want.
    // This keeps RainbowKit "in sync" visually.
    body: "inherit",
    // or for extra terminal vibes:
    // 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  radii: {
    actionButton: "var(--radius-field)",
    connectButton: "var(--radius-field)",
    menuButton: "var(--radius-field)",
    modal: "var(--radius-box)",
    modalMobile: "var(--radius-box)",
  },
  shadows: {
    connectButton: "0 0 0 1px hsl(var(--color-base-300))",
    dialog: "0 18px 60px rgba(0,0,0,0.45)",
    profileDetailsAction: "0 0 0 1px hsl(var(--color-base-300))",
    selectedOption: "0 0 0 1px hsl(var(--color-primary))",
    selectedWallet: "0 0 0 1px hsl(var(--color-primary))",
    walletLogo: "0 6px 14px rgba(0,0,0,0.35)",
  },
}
