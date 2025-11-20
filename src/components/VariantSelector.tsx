type Tab = "swap" | "transactions"

interface TabSelectorProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function TabSelector({ activeTab, onTabChange }: TabSelectorProps) {
  return (
    <div role="tablist" className="tabs tabs-lifted tabs-lg w-full mb-8">
      <button
        role="tab"
        className={`tab transition-all ${activeTab === "swap" ? "tab-active [--tab-bg:theme(colors.base-100)] font-semibold" : "text-base-content/60 hover:text-base-content"}`}
        onClick={() => onTabChange("swap")}
        aria-selected={activeTab === "swap"}
      >
        Swap
      </button>
      <button
        role="tab"
        className={`tab transition-all ${activeTab === "transactions" ? "tab-active [--tab-bg:theme(colors.base-100)] font-semibold" : "text-base-content/60 hover:text-base-content"}`}
        onClick={() => onTabChange("transactions")}
        aria-selected={activeTab === "transactions"}
      >
        Transactions
      </button>
    </div>
  )
}
