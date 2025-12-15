import { ConnectButton } from '@rainbow-me/rainbowkit'

export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted, authenticationStatus }) => {
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
            {/* Account button (balance + address) */}
            <button
              onClick={openAccountModal}
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              {account && account.displayBalance && Number.isFinite(account.displayBalance) && (
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
