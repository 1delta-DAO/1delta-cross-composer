import { ConnectButton } from '@rainbow-me/rainbowkit'

export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
        authenticationStatus,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated')

        if (!connected) {
          return (
            <button type="button" className="btn btn-primary btn-sm" onClick={openConnectModal}>
              Connect Wallet
            </button>
          )
        }

        return (
          <div className="flex items-center gap-2" aria-hidden={!ready}>
            {/* Chain switcher */}
            {chain && (
              <button
                onClick={openChainModal}
                type="button"
                className="btn btn-ghost btn-sm border border-base-300 flex items-center gap-2"
              >
                {chain.hasIcon && chain.iconUrl && (
                  <span className="w-4 h-4 rounded-full overflow-hidden">
                    <img
                      alt={chain.name ?? 'Chain icon'}
                      src={chain.iconUrl}
                      className="w-full h-full object-cover"
                    />
                  </span>
                )}
                <span className="text-xs">{chain.name}</span>
              </button>
            )}

            {/* Account button (balance + address) */}
            <button
              onClick={openAccountModal}
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              {account?.displayBalance && (
                <span className="text-xs font-mono">{account.displayBalance}</span>
              )}
              <span className="text-xs font-mono">{account?.displayName}</span>
            </button>
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
