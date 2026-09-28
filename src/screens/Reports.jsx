import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../utils/calculations'

export default function Reports({ isActive }) {
  const [period, setPeriod] = useState('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isActive) fetchOrders()
  }, [isActive, period, currentDate])

  const getDateRange = () => {
    const d = new Date(currentDate)
    d.setHours(0, 0, 0, 0)
    if (period === 'day') {
      const start = localStr(d)
      const end = localStr(d)
      return { start, end }
    }
    if (period === 'week') {
      const day = d.getDay()
      const mon = new Date(d)
      mon.setDate(d.getDate() - ((day + 6) % 7))
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      return { start: localStr(mon), end: localStr(sun) }
    }
    // month
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start: localStr(start), end: localStr(end) }
  }

  const localStr = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const fetchOrders = async () => {
    setLoading(true)
    const { start, end } = getDateRange()
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('is_held', false)
      .gte('order_date', start)
      .lte('order_date', end)
      .order('order_date', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const shiftPeriod = (dir) => {
    const d = new Date(currentDate)
    if (period === 'day') d.setDate(d.getDate() + dir)
    else if (period === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrentDate(d)
  }

  const getPeriodLabel = () => {
    if (period === 'day') {
      return currentDate.toLocaleDateString('en-CA', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    if (period === 'week') {
      const { start, end } = getDateRange()
      const s = new Date(start + 'T12:00:00')
      const e = new Date(end + 'T12:00:00')
      const sf = s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
      const ef = e.toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      return `${sf} – ${ef}`
    }
    return currentDate.toLocaleDateString('en-CA', {
      month: 'long',
      year: 'numeric',
    })
  }

  // Metrics
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const collected = orders
    .filter((o) => o.payment_status === 'Paid')
    .reduce((s, o) => s + (o.total || 0), 0)
  const outstanding = orders
    .filter((o) => o.payment_status === 'Unpaid')
    .reduce((s, o) => s + (o.total || 0), 0)

  // Payment breakdown
  const payBreakdown = ['Cash', 'Debit', 'Credit', 'Unpaid'].map((method) => {
    const isUnpaid = method === 'Unpaid'
    const filtered = orders.filter((o) =>
      isUnpaid
        ? o.payment_status === 'Unpaid'
        : o.payment_method === method && o.payment_status === 'Paid'
    )
    const amount = filtered.reduce((s, o) => s + (o.total || 0), 0)
    return { method, amount, count: filtered.length }
  })

  const maxPayAmt = Math.max(...payBreakdown.map((p) => p.amount), 1)

  const unpaidOrders = orders.filter((o) => o.payment_status === 'Unpaid')

  const metricCards = [
    {
      label: 'Revenue',
      value: fmt(totalRevenue),
      sub: `incl. HST`,
      color: 'text-gray-900',
    },
    {
      label: 'Orders',
      value: orders.length,
      sub: `total`,
      color: 'text-blue-600',
    },
    {
      label: 'Collected',
      value: fmt(collected),
      sub: `paid`,
      color: 'text-green-600',
    },
    {
      label: 'Outstanding',
      value: fmt(outstanding),
      sub: `unpaid`,
      color: 'text-red-600',
    },
  ]

  const payColors = {
    Cash: 'bg-blue-500',
    Debit: 'bg-purple-500',
    Credit: 'bg-orange-500',
    Unpaid: 'bg-red-400',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Reports</h2>

      {/* Period tabs + navigator */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {['day', 'week', 'month'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors ${
                period === p
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'day' ? 'Day' : p === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => shiftPeriod(-1)}
            className="w-8 h-8 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[180px] text-center">
            {getPeriodLabel()}
          </span>
          <button
            onClick={() => shiftPeriod(1)}
            className="w-8 h-8 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600"
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {metricCards.map((card) => (
              <div
                key={card.label}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
              >
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {card.label}
                </div>
                <div className={`text-xl font-bold ${card.color}`}>
                  {card.value}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Two-column */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Payment breakdown */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">
                Payment breakdown
              </h3>
              <div className="space-y-3">
                {payBreakdown.map((p) => (
                  <div key={p.method}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${payColors[p.method]}`}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {p.method}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-800">
                        {fmt(p.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${payColors[p.method]}`}
                        style={{
                          width: `${(p.amount / maxPayAmt) * 100}%`,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unpaid orders */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">Unpaid orders</h3>
              {unpaidOrders.length === 0 ? (
                <div className="text-center text-green-600 font-semibold py-4">
                  No unpaid orders ✓
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {unpaidOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono text-gray-600 text-xs">
                        {o.ticket_number}
                      </span>
                      <span className="text-gray-500 truncate mx-2 flex-1">
                        {o.customer_name || 'Walk-in'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {o.order_date}
                      </span>
                      <span className="font-bold text-red-600 ml-2">
                        ${o.total?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Orders table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-800">Orders</h3>
            </div>
            {orders.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No orders in this period
              </div>
            ) : (
              <>
                <div className="grid grid-cols-6 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <div>Ticket</div>
                  <div>Customer</div>
                  <div>Items</div>
                  <div className="text-right">Total</div>
                  <div className="text-center">Payment</div>
                  <div className="text-center">Status</div>
                </div>
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="grid grid-cols-6 px-4 py-2.5 items-center hover:bg-gray-50"
                    >
                      <div className="font-mono text-xs text-gray-700">
                        {o.ticket_number}
                      </div>
                      <div className="text-sm text-gray-700 truncate">
                        {o.customer_name || 'Walk-in'}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {(o.order_items || []).length} item
                        {(o.order_items || []).length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-sm font-semibold text-right">
                        ${o.total?.toFixed(2)}
                      </div>
                      <div className="text-center">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            o.payment_status === 'Paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {o.payment_status === 'Paid'
                            ? `✓ ${o.payment_method}`
                            : 'Unpaid'}
                        </span>
                      </div>
                      <div className="text-center">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            o.status === 'Picked up'
                              ? 'bg-gray-100 text-gray-600'
                              : o.status === 'Ready'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
