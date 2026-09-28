import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, friendlyDate, localDateStr } from '../utils/calculations'
import { printTicket, printMixedTicket } from '../components/PrintTicket'

const SHOP_NAME = 'CleanPOS Dry Cleaning & Alterations'
const SHOP_ADDRESS = 'Toronto, ON'

export default function Orders({ holdCount, onResumeOrder, onHoldCountChange, isActive }) {
  const [orders, setOrders] = useState([])
  const [heldOrders, setHeldOrders] = useState([])
  const [activeMainTab, setActiveMainTab] = useState('orders')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortMode, setSortMode] = useState('order_date')
  const [selectedDate, setSelectedDate] = useState(localDateStr(new Date()))
const [searchQuery, setSearchQuery] = useState('')
  const [showPayModal, setShowPayModal] = useState(null) // order
  const [showCustomerModal, setShowCustomerModal] = useState(null) // customer + orders
  const [showEditCustomer, setShowEditCustomer] = useState(null) // customer
  const [editForm, setEditForm] = useState({ name: '', phone_type: 'Cell', phone: '' })
  const [customerOrders, setCustomerOrders] = useState([])
  const [discardConfirm, setDiscardConfirm] = useState(null) // held order id
  const [deleteConfirm, setDeleteConfirm] = useState(null) // order id
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isActive) {
      fetchOrders()
      fetchHeldOrders()
    }
  }, [isActive])

  const fetchOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('is_held', false)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const fetchHeldOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('is_held', true)
      .order('created_at', { ascending: false })
    setHeldOrders(data || [])
  }

  const refresh = () => {
    fetchOrders()
    fetchHeldOrders()
    onHoldCountChange()
  }

const getOrderCountForDate = (dateStr) => {
    const field = sortMode === 'order_date' ? 'order_date' : 'pickup_date'
    return orders.filter((o) => o[field] === dateStr).length
  }

  // Filter + search logic
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'All' && o.status !== statusFilter) return false
    const field = sortMode === 'order_date' ? 'order_date' : 'pickup_date'
    if (o[field] !== selectedDate) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        o.ticket_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q)
      )
    }
    return true
  })

  // Group by date
  const groupedOrders = (() => {
    const groups = {}
    filteredOrders.forEach((o) => {
      const field = sortMode === 'order_date' ? 'order_date' : 'pickup_date'
      const key = o[field] || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(o)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  })()

  const markAsPaid = async (order, method) => {
    await supabase
      .from('orders')
      .update({ payment_status: 'Paid', payment_method: method })
      .eq('id', order.id)
    refresh()
    setShowPayModal(null)
  }

  const markStatus = async (order, status) => {
    await supabase.from('orders').update({ status }).eq('id', order.id)
    refresh()
  }

  const openCustomerModal = async (order) => {
    if (!order.customer_id) return
    const { data: cust } = await supabase
      .from('customers')
      .select('*')
      .eq('id', order.customer_id)
      .single()
    if (!cust) return
    const { data: custOrders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_id', cust.id)
      .eq('is_held', false)
      .order('created_at', { ascending: false })
    const totalSpent = (custOrders || []).reduce(
      (s, o) => s + (o.payment_status === 'Paid' ? o.total : 0),
      0
    )
    setCustomerOrders(custOrders || [])
    setShowCustomerModal({ ...cust, totalSpent, orderCount: (custOrders || []).length })
  }

  const saveEditCustomer = async () => {
    if (!showEditCustomer) return
    const { name, phone_type, phone } = editForm
    await supabase
      .from('customers')
      .update({ name, phone_type, phone })
      .eq('id', showEditCustomer.id)
    setShowCustomerModal((prev) => prev ? { ...prev, name, phone_type, phone } : null)
    setShowEditCustomer(null)
    refresh()
  }

  const resumeHeldOrder = (order) => {
    onResumeOrder(order)
  }

  const discardHeld = async (id) => {
    await supabase.from('orders').delete().eq('id', id)
    refresh()
    setDiscardConfirm(null)
  }

  const deleteOrder = async (id) => {
    await supabase.from('order_items').delete().eq('order_id', id)
    await supabase.from('orders').delete().eq('id', id)
    refresh()
    setDeleteConfirm(null)
  }

  const handlePrint = (order) => {
    const totals = {
      subtotal: order.subtotal,
      bulkDiscount: order.bulk_discount,
      surcharge: order.surcharge,
      manualDiscount: order.manual_discount,
      taxable: order.subtotal - order.bulk_discount + order.surcharge - order.manual_discount,
      tax: order.tax,
      total: order.total,
    }
    const mappedItems = (order.order_items || []).map((i) => ({
      ...i,
      bulkPct: i.bulk_discount_pct,
      lineTotal: i.line_total,
      garmentId: i.garment_group || null,
    }))
    const isMixed = order.ticket_number?.includes('/')
    if (isMixed) {
      const [ticketNumberD, ticketNumberA] = order.ticket_number.split('/').map((s) => s.trim())
      printMixedTicket({
        ticketNumberD,
        ticketNumberA,
        customerName: order.customer_name || 'Walk-in',
        customerPhone: order.customer_phone || '',
        phoneType: '',
        orderDate: order.order_date,
        pickupDate: order.pickup_date,
        itemsDC: mappedItems.filter((i) => i.service_type === 'dry_cleaning'),
        itemsALT: mappedItems.filter((i) => i.service_type === 'alterations'),
        totals,
        surchargeLabel: order.surcharge_label,
        discountLabel: order.manual_discount_label,
        shopNotes: order.shop_notes,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        shopName: SHOP_NAME,
        shopAddress: SHOP_ADDRESS,
        shopPhone: '',
      })
      return
    }
    printTicket({
      ticketNumber: order.ticket_number,
      customerName: order.customer_name || 'Walk-in',
      customerPhone: order.customer_phone || '',
      phoneType: '',
      orderDate: order.order_date,
      pickupDate: order.pickup_date,
      items: mappedItems,
      totals,
      surchargeLabel: order.surcharge_label,
      discountLabel: order.manual_discount_label,
      shopNotes: order.shop_notes,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      shopName: SHOP_NAME,
      shopAddress: SHOP_ADDRESS,
      shopPhone: '',
    })
  }

  const statusPill = (status) => {
    const styles = {
      Pending: 'bg-yellow-100 text-yellow-800',
      Ready: 'bg-blue-100 text-blue-800',
      'Picked up': 'bg-gray-100 text-gray-600',
    }
    return (
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}
      >
        {status}
      </span>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Main tabs */}
      <div className="bg-white border-b border-gray-200 px-4 pt-4 flex-shrink-0">
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setActiveMainTab('orders')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeMainTab === 'orders'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveMainTab('held')}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeMainTab === 'held'
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            On Hold
            {holdCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {holdCount}
              </span>
            )}
          </button>
        </div>

        {activeMainTab === 'orders' && (
          <>
            {/* Status filters */}
            <div className="flex gap-1 mb-3">
              {['All', 'Pending', 'Ready', 'Picked up'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === s
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {s}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Sort:</span>
                <button
                  onClick={() =>
                    setSortMode((m) =>
                      m === 'order_date' ? 'pickup_date' : 'order_date'
                    )
                  }
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {sortMode === 'order_date' ? 'Order date' : 'Pickup date'} ↕
                </button>
              </div>
            </div>

            {/* Date selector */}
            {(() => {
              const today = localDateStr(new Date())
              const tomorrow = localDateStr(new Date(Date.now() + 86400000))
              const isToday = selectedDate === today
              const isTomorrow = selectedDate === tomorrow
              const isOther = !isToday && !isTomorrow
              const selectedD = new Date(selectedDate + 'T12:00:00')
              const selectedLabel = selectedD.toLocaleDateString('en-CA', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              })
              return (
                <div className="flex items-center gap-2 mb-3">
                  {['Today', 'Tomorrow'].map((label) => {
                    const dateStr = label === 'Today' ? today : tomorrow
                    const isSelected = selectedDate === dateStr
                    const cnt = getOrderCountForDate(dateStr)
                    return (
                      <button
                        key={label}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {label}{cnt > 0 && <span className={`ml-1 ${isSelected ? 'opacity-80' : 'text-blue-600'}`}>· {cnt}</span>}
                      </button>
                    )
                  })}
                  <div className="relative">
                    <button
                      onClick={() => document.getElementById('date-jump-input').showPicker()}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        isOther
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                      }`}
                      title="Pick a date"
                    >
                      {isOther ? selectedLabel : '📅 Pick date'}
                    </button>
                    <input
                      id="date-jump-input"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value) }}
                      className="absolute opacity-0 pointer-events-none w-0 h-0"
                    />
                  </div>
                </div>
              )
            })()}

            {/* Search */}
            <div className="mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, customer name or phone…"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeMainTab === 'held' ? (
          // Held orders
          heldOrders.length === 0 ? (
            <div className="text-center text-gray-400 mt-12">
              <div className="text-4xl mb-3">⏸</div>
              <div>No held orders</div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-3">
              {heldOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">
                          {order.ticket_number}
                        </span>
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                          ⏸ On Hold
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleTimeString('en-CA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        {order.customer_name || 'Walk-in'}{' '}
                        {order.customer_phone && `· ${order.customer_phone}`}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {(order.order_items || []).map((i) => i.service_name).join(', ')}
                      </div>
                      <div className="text-sm font-bold mt-1">
                        ${order.total?.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Pickup: {order.pickup_date}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => resumeHeldOrder(order)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => setDiscardConfirm(order.id)}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="text-center text-gray-400 mt-12">Loading…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center text-gray-400 mt-12">
            <div className="text-4xl mb-3">📋</div>
            <div>No orders for this date</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {groupedOrders.map(([dateKey, dayOrders]) => (
              <div key={dateKey}>
                <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">
                  {friendlyDate(dateKey)}
                </h3>
                <div className="space-y-3">
                  {dayOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onMarkPaid={() => setShowPayModal(order)}
                      onMarkStatus={markStatus}
                      onOpenCustomer={() => openCustomerModal(order)}
                      onPrint={() => handlePrint(order)}
                      onDelete={() => setDeleteConfirm(order.id)}
                      statusPill={statusPill}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pay modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-1">Mark as Paid</h3>
            <p className="text-gray-500 text-sm mb-5">
              {showPayModal.ticket_number} · ${showPayModal.total?.toFixed(2)}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'Debit', 'Credit'].map((method) => (
                <button
                  key={method}
                  onClick={() => markAsPaid(showPayModal, method)}
                  className="py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 text-sm"
                >
                  {method}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPayModal(null)}
              className="w-full mt-3 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Customer detail modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {showCustomerModal.name}
              </h3>
              <div className="text-sm text-gray-500 mt-0.5">
                {showCustomerModal.phone_type} · {showCustomerModal.phone}
              </div>
              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {showCustomerModal.orderCount}
                  </div>
                  <div className="text-xs text-gray-400">Total orders</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {fmt(showCustomerModal.totalSpent)}
                  </div>
                  <div className="text-xs text-gray-400">Total spent</div>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto border-t border-gray-100 pt-3 space-y-2">
              {customerOrders.map((o) => (
                <div
                  key={o.id}
                  className="text-sm flex justify-between items-center py-1"
                >
                  <span className="text-gray-700 font-medium">
                    {o.ticket_number}
                  </span>
                  <span className="text-gray-400">{o.order_date}</span>
                  <span className="font-bold">${o.total?.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 border-t border-gray-100 pt-4">
              <button
                onClick={() => {
                  setShowCustomerModal(null)
                  onResumeOrder({ customer_id: showCustomerModal.id, customer_name: showCustomerModal.name, customer_phone: showCustomerModal.phone, phone_type: showCustomerModal.phone_type, ticket_number: '', order_items: [] })
                }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
              >
                + New Order
              </button>
              <button
                onClick={() => {
                  setShowEditCustomer(showCustomerModal)
                  setEditForm({ name: showCustomerModal.name, phone_type: showCustomerModal.phone_type, phone: showCustomerModal.phone })
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
              >
                Edit info
              </button>
              <button
                onClick={() => setShowCustomerModal(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit customer modal */}
      {showEditCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">Edit Customer</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Phone Type
                </label>
                <div className="flex gap-2">
                  {['Cell', 'Home'].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setEditForm((f) => ({ ...f, phone_type: type }))
                      }
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        editForm.phone_type === type
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowEditCustomer(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditCustomer}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete order confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold mb-2">Delete this order?</h3>
            <p className="text-gray-500 text-sm mb-5">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteOrder(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard confirm */}
      {discardConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold mb-2">Discard held order?</h3>
            <p className="text-gray-500 text-sm mb-5">
              This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDiscardConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => discardHeld(discardConfirm)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, onMarkPaid, onMarkStatus, onOpenCustomer, onPrint, onDelete, statusPill }) {
  const isPaid = order.payment_status === 'Paid'
  const balance = isPaid ? 0 : order.total

  const nextStatus =
    order.status === 'Pending'
      ? 'Ready'
      : order.status === 'Ready'
      ? 'Picked up'
      : null

  const hasItemNotes = (order.order_items || []).some((i) => i.item_note)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex">
        {/* Left content */}
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-gray-900 font-mono">
              {order.ticket_number}
            </span>
            {statusPill(order.status)}
            {isPaid ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                ✓ Paid · {order.payment_method}
              </span>
            ) : (
              <button
                onClick={onMarkPaid}
                className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold hover:bg-red-200 transition-colors"
              >
                Unpaid — tap to pay
              </button>
            )}
            {hasItemNotes && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                📝 Notes
              </span>
            )}
          </div>

          {order.customer_name ? (
            <button
              onClick={onOpenCustomer}
              className="text-sm text-green-600 underline font-semibold hover:text-green-800 text-left"
            >
              {order.customer_name}
            </button>
          ) : (
            <span className="text-sm text-gray-400">Walk-in</span>
          )}

          {order.customer_phone && (
            <div className="text-xs text-gray-400 mt-0.5">
              {order.customer_phone}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-1.5">
            {(order.order_items || []).map((i) => i.service_name).join(', ')}
          </div>

          <div className="text-xs text-gray-400 mt-1">
            Pickup: <span className="font-mono">{order.pickup_date}</span>
          </div>
        </div>

        {/* Right action column */}
        <div className="border-l border-gray-100 flex flex-col items-center justify-center px-4 gap-3 min-w-[130px]">
          <div className="text-center">
            <div className="text-xs text-gray-400 font-medium">Balance</div>
            <div
              className={`text-lg font-bold ${
                isPaid ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPaid ? '$0.00' : `$${balance.toFixed(2)}`}
            </div>
          </div>
          <div className="w-full h-px bg-gray-100" />
          {nextStatus && (
            <button
              onClick={() => onMarkStatus(order, nextStatus)}
              className="w-full py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700"
            >
              Mark as {nextStatus}
            </button>
          )}
          <button
            onClick={onPrint}
            className="w-full py-2 border border-gray-300 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50"
          >
            Print ticket
          </button>
          <button
            onClick={onDelete}
            className="w-full py-2 border border-red-300 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
