interface RouteSectionProps {
  route: string
}

export function RouteSection({ route }: RouteSectionProps) {
  return (
    <div className="pt-2 border-t border-base-300">
      <div className="text-xs opacity-60">Route: {route}</div>
    </div>
  )
}
