import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORY_ORDER = {
  dry_cleaning: ['Suit', 'Shirt', 'Pants', 'Dress', 'Coat / Jacket', 'Skirt', 'Other Items'],
  alterations: ['Suit', 'Shirt', 'Pants', 'Dress', 'Coat / Jacket', 'Skirt', 'General Repairs'],
}

export default function Pricing({ isActive }) {
  const [activeTab, setActiveTab] = useState('dry_cleaning')
  const [services, setServices] = useState([])
  const [collapsed, setCollapsed] = useState({})
  const [editPrices, setEditPrices] = useState({}) // id → string
  const [savedIds, setSavedIds] = useState({}) // id → true
  const [showAddModal, setShowAddModal] = useState(null) // category string
  const [newService, setNewService] = useState({ name: '', price: '' })
  const [deleteConfirm, setDeleteConfirm] = useState(null) // service id
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isActive) fetchServices()
  }, [isActive])

  const fetchServices = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('sort_order')
    setServices(data || [])
    setLoading(false)
  }

  const categories = CATEGORY_ORDER[activeTab] || []

  const getServicesForCategory = (cat) =>
    services.filter(
      (s) => s.service_type === activeTab && s.category === cat && s.is_active
    )

  const toggleCollapse = (cat) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))

  const savePrice = async (service) => {
    const newPrice = parseFloat(editPrices[service.id])
    if (isNaN(newPrice) || newPrice < 0) return
    await supabase
      .from('services')
      .update({ price: newPrice })
      .eq('id', service.id)
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, price: newPrice } : s))
    )
    setSavedIds((prev) => ({ ...prev, [service.id]: true }))
    setTimeout(
      () => setSavedIds((prev) => ({ ...prev, [service.id]: false })),
      2000
    )
  }

  const addService = async () => {
    const { name, price } = newService
    if (!name.trim() || !price) return
    const p = parseFloat(price)
    if (isNaN(p)) return
    const maxSort = Math.max(
      0,
      ...services
        .filter(
          (s) => s.service_type === activeTab && s.category === showAddModal
        )
        .map((s) => s.sort_order)
    )
    const { data } = await supabase
      .from('services')
      .insert({
        service_type: activeTab,
        category: showAddModal,
        name: name.trim(),
        price: p,
        is_active: true,
        sort_order: maxSort + 1,
      })
      .select()
      .single()
    if (data) setServices((prev) => [...prev, data])
    setShowAddModal(null)
    setNewService({ name: '', price: '' })
  }

  const deleteService = async (id) => {
    await supabase.from('services').update({ is_active: false }).eq('id', id)
    setServices((prev) => prev.filter((s) => s.id !== id))
    setDeleteConfirm(null)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Pricing</h2>

      {/* Tab toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {[
          { id: 'dry_cleaning', label: 'Dry Cleaning' },
          { id: 'alterations', label: 'Alterations' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading…</div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catServices = getServicesForCategory(cat)
            const isOpen = !collapsed[cat]
            return (
              <div
                key={cat}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Category header */}
                <button
                  onClick={() => toggleCollapse(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{cat}</span>
                    <span className="text-xs text-gray-400 font-medium">
                      {catServices.length} items
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAddModal(cat)
                        setNewService({ name: '', price: '' })
                      }}
                      className="w-7 h-7 bg-green-100 text-green-700 rounded-lg flex items-center justify-center font-bold text-lg leading-none hover:bg-green-200 transition-colors"
                    >
                      +
                    </button>
                    <span className="text-gray-400 text-sm">
                      {isOpen ? '▾' : '▸'}
                    </span>
                  </div>
                </button>

                {/* Services */}
                {isOpen && (
                  <div className="divide-y divide-gray-100">
                    {catServices.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">
                        No services — click + to add
                      </div>
                    ) : (
                      catServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <div className="flex-1 text-sm font-medium text-gray-800">
                            {service.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-400">$</span>
                            <input
                              type="number"
                              value={
                                editPrices[service.id] !== undefined
                                  ? editPrices[service.id]
                                  : service.price
                              }
                              onChange={(e) =>
                                setEditPrices((prev) => ({
                                  ...prev,
                                  [service.id]: e.target.value,
                                }))
                              }
                              className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <button
                            onClick={() => savePrice(service)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              savedIds[service.id]
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {savedIds[service.id] ? '✓ Saved' : 'Save'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(service.id)}
                            className="text-gray-300 hover:text-red-500 text-lg font-bold leading-none transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-1">Add Service</h3>
            <p className="text-sm text-gray-500 mb-4">
              {showAddModal} ·{' '}
              {activeTab === 'dry_cleaning' ? 'Dry Cleaning' : 'Alterations'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Service Name
                </label>
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) =>
                    setNewService((s) => ({ ...s, name: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Suit jacket – take in"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Price ($)
                </label>
                <input
                  type="number"
                  value={newService.price}
                  onChange={(e) =>
                    setNewService((s) => ({ ...s, price: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowAddModal(null)
                  setNewService({ name: '', price: '' })
                }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addService}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700"
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold mb-2">Remove service?</h3>
            <p className="text-gray-500 text-sm mb-5">
              It will no longer appear in new orders. Existing order items are not affected.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteService(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
