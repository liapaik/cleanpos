export default function Nav({ activeTab, setActiveTab, holdCount }) {
  const tabs = [
    { id: 'new-order', label: 'New Order' },
    { id: 'orders', label: 'Orders', badge: holdCount },
    { id: 'customers', label: 'Customers' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'reports', label: 'Reports' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center px-4 z-40 shadow-sm no-print">
      <div className="flex items-center gap-2 mr-6">
        <span className="text-2xl">🧺</span>
        <span className="font-bold text-lg text-gray-800 tracking-tight">
          CleanPOS
        </span>
      </div>
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold leading-none">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
