import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../utils/calculations'

export default function Customers({ isActive }) {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isActive) fetchCustomers()
  }, [isActive])

  const fetchCustomers = async () => {
    setLoading(true)
    // Get customers with order count and total spent
    const { data: custs } = await supabase
      .from('customers')
      .select('*')
      .order('name')

    if (!custs) { setLoading(false); return }

    // Get order stats per customer
    const { data: orderStats } = await supabase
      .from('orders')
      .select('customer_id, total, payment_status')
      .eq('is_held', false)
      .not('customer_id', 'is', null)

    const statsMap = {}
    ;(orderStats || []).forEach((o) => {
      if (!statsMap[o.customer_id])
        statsMap[o.customer_id] = { count: 0, spent: 0 }
      statsMap[o.customer_id].count++
      if (o.payment_status === 'Paid') statsMap[o.customer_id].spent += o.total
    })

    setCustomers(
      custs.map((c) => ({
        ...c,
        orderCount: statsMap[c.id]?.count ?? 0,
        totalSpent: statsMap[c.id]?.spent ?? 0,
      }))
    )
    setLoading(false)
  }

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.phone.includes(q)
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Customers</h2>
        <div className="text-sm text-gray-400">{filtered.length} customers</div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone…"
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <div>Name</div>
          <div>Phone</div>
          <div className="text-right">Orders</div>
          <div className="text-right">Total Spent</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No customers found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-4 px-4 py-3 hover:bg-gray-50 items-center"
              >
                <div className="font-semibold text-gray-900 text-sm">{c.name}</div>
                <div className="text-sm text-gray-500">
                  <span className="text-xs text-gray-400 mr-1">{c.phone_type}</span>
                  {c.phone}
                </div>
                <div className="text-sm text-right font-medium text-gray-700">
                  {c.orderCount}
                </div>
                <div className="text-sm text-right font-semibold text-gray-900">
                  {fmt(c.totalSpent)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
