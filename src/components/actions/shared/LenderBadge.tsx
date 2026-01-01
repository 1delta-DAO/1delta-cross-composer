import { Logo } from '../../common/Logo'

const getLenderUri = (protocol: string) => {
  const lc = protocol.toLowerCase()
  return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/main/lender/${lc}.webp`
}

interface LenderBadgeProps {
  lender?: string
}

export function LenderBadge({ lender }: LenderBadgeProps) {
  if (!lender) return null

  return (
    <div className="absolute -top-1 -right-1 z-10">
      <Logo
        src={getLenderUri(lender)}
        alt={lender}
        size={18}
        fallbackText={lender}
        className="rounded-full border-2 border-base-100 shadow-sm"
      />
    </div>
  )
}
