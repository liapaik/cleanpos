import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  calculateOrderTotals,
  getBulkDiscountPct,
  getSurchargeLabel,
  getDiscountLabel,
  formatPickupDate,
  getDefaultPickupDate,
  getNextTicketNumbers,
  SURCHARGE_OPTIONS,
  DISCOUNT_OPTIONS,
} from '../utils/calculations'
import {
  printTicket, printMixedTicket,
  printCustomerCopy, printShopCopy, printItemTags,
  printMixedCustomerCopy, printMixedShopCopies, printMixedItemTags,
} from '../components/PrintTicket'

const CATEGORIES = {
  dry_cleaning: [
    { id: 'Suit', label: 'Suit', icon: '🤵' },
    { id: 'Shirt', label: 'Shirt', icon: '👕' },
    { id: 'Pants', label: 'Pants', icon: '👖' },
    { id: 'Dress', label: 'Dress', icon: '👗' },
    { id: 'Coat / Jacket', label: 'Coat / Jacket', icon: '🧥' },
    { id: 'Skirt', label: 'Skirt', icon: '🪡' },
    { id: 'Other Items', label: 'Other Items', icon: '📦' },
  ],
  alterations: [
    { id: 'Suit', label: 'Suit', icon: '🤵' },
    { id: 'Shirt', label: 'Shirt', icon: '👕' },
    { id: 'Pants', label: 'Pants', icon: '👖' },
    { id: 'Dress', label: 'Dress', icon: '👗' },
    { id: 'Coat / Jacket', label: 'Coat / Jacket', icon: '🧥' },
    { id: 'Skirt', label: 'Skirt', icon: '🪡' },
    { id: 'General Repairs', label: 'General Repairs', icon: '🔧' },
  ],
}

const SHOP_NAME = 'CleanPOS Dry Cleaning & Alterations'
const SHOP_ADDRESS = 'Toronto, ON'
const SHOP_PHONE = ''

export default function NewOrder({
  holdCount,
  resumeOrder,
  setResumeOrder,
  onHoldCountChange,
}) {
  // Customer
  const [customer, setCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone_type: 'Cell',
    phone: '',
  })
  const searchRef = useRef(null)

  // Services
  const [activeServiceTab, setActiveServiceTab] = useState('dry_cleaning')
  const [serviceDepth, setServiceDepth] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [services, setServices] = useState([])

  // Order
  const [orderItems, setOrderItems] = useState([])
  const [surchargeType, setSurchargeType] = useState(null)
  const [discountType, setDiscountType] = useState(null)
  const [pickupDate, setPickupDate] = useState(getDefaultPickupDate())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [shopNotes, setShopNotes] = useState('')
  const [nextTickets, setNextTickets] = useState({ d: 'D001', a: 'A001' })
  const [resumedTicketDisplay, setResumedTicketDisplay] = useState(null)
  const [editingNote, setEditingNote] = useState(null)
  const [tempNote, setTempNote] = useState('')
  const [editingPrice, setEditingPrice] = useState(null)
  const [tempPrice, setTempPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [resumedOrderId, setResumedOrderId] = useState(null)
  const [pendingPrint, setPendingPrint] = useState(null) // { isMixed, data }
  const [heldOrders, setHeldOrders] = useState([])
  const [showHeldPanel, setShowHeldPanel] = useState(false)

  useEffect(() => {
    fetchNextTickets()
    fetchServices()
    fetchHeldOrders()
  }, [])

  useEffect(() => {
    fetchHeldOrders()
  }, [holdCount])

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (resumeOrder) {
      loadResumedOrder(resumeOrder)
      setResumeOrder(null)
    }
  }, [resumeOrder])

  const fetchNextTickets = async () => {
    const nums = await getNextTicketNumbers(supabase)
    setNextTickets(nums)
  }

  const fetchHeldOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('is_held', true)
      .order('created_at', { ascending: false })
    setHeldOrders(data || [])
  }

  const discardHeld = async (id) => {
    await supabase.from('orders').delete().eq('id', id)
    onHoldCountChange()
  }

  const fetchServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    setServices(data || [])
  }

  const loadResumedOrder = (order) => {
    if (order.customer_id) {
      setCustomer({
        id: order.customer_id,
        name: order.customer_name,
        phone: order.customer_phone,
        phone_type: order.phone_type || 'Cell',
        order_count: 0,
      })
    }
    setOrderItems(
      (order.order_items || []).map((item, idx) => ({
        id: Date.now() + idx,
        service_name: item.service_name,
        category: item.category,
        service_type: item.service_type,
        unit_price: item.unit_price,
        quantity: item.quantity,
        item_note: item.item_note || '',
        garmentId: item.garment_group || null,
      }))
    )
    setResumedTicketDisplay(order.ticket_number)
    setResumedOrderId(order.id)
    const sMap = { 'Today 30%': 'today', 'Next Day 20%': 'nextday' }
    setSurchargeType(sMap[order.surcharge_label] || null)
    const dMap = {
      'Senior 10%': 'senior',
      'Loyalty 13%': 'loyalty',
      'New Customer 5%': 'newcustomer',
    }
    setDiscountType(dMap[order.manual_discount_label] || null)
    if (order.pickup_date)
      setPickupDate(new Date(order.pickup_date + 'T12:00:00'))
    setShopNotes(order.shop_notes || '')
  }

  const searchCustomers = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(10)
    setSearchResults(data || [])
    setShowDropdown(true)
  }

  const handleCustomerSearch = (value) => {
    setCustomerSearch(value)
    searchCustomers(value)
  }

  const selectCustomer = async (c) => {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', c.id)
      .eq('is_held', false)
    setCustomer({ ...c, order_count: count ?? 0 })
    setCustomerSearch('')
    setShowDropdown(false)
  }

  const addCustomer = async () => {
    const { name, phone_type, phone } = newCustomerForm
    if (!name.trim() || !phone.trim()) return
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: name.trim(), phone_type, phone: phone.trim() })
      .select()
      .single()
    if (!error && data) {
      setCustomer({ ...data, order_count: 0 })
      setShowAddCustomer(false)
      setNewCustomerForm({ name: '', phone_type: 'Cell', phone: '' })
      setCustomerSearch('')
    }
  }

  const getCategoryServices = () =>
    services.filter(
      (s) =>
        s.service_type === activeServiceTab && s.category === selectedCategory
    )

  const getCategoryCount = (catId) =>
    services.filter(
      (s) => s.service_type === activeServiceTab && s.category === catId
    ).length

  const addItemToOrder = (service) => {
    setOrderItems((prev) => {
      const existing = prev.find(
        (i) =>
          i.service_name === service.name &&
          i.service_type === service.service_type &&
          i.category === service.category
      )
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          id: Date.now(),
          service_name: service.name,
          category: service.category,
          service_type: service.service_type,
          unit_price: service.price,
          quantity: 1,
          item_note: '',
          garmentId: null,
        },
      ]
    })
  }

  const updateQty = (id, qty) => {
    if (qty < 1) {
      setOrderItems((prev) => prev.filter((i) => i.id !== id))
      return
    }
    setOrderItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
    )
  }

  const removeItem = (id) => setOrderItems((prev) => prev.filter((i) => i.id !== id))

  const updateItemNote = (id, note) =>
    setOrderItems((prev) => prev.map((i) => (i.id === id ? { ...i, item_note: note } : i)))

  const updateItemPrice = (id, price) => {
    const p = parseFloat(price)
    if (isNaN(p) || p < 0) return
    setOrderItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, unit_price: p } : i))
    )
  }

  const updateGarmentId = (id, garmentId) =>
    setOrderItems((prev) => prev.map((i) => (i.id === id ? { ...i, garmentId } : i)))

  const clearOrder = () => {
    setCustomer(null)
    setCustomerSearch('')
    setOrderItems([])
    setSurchargeType(null)
    setDiscountType(null)
    setPickupDate(getDefaultPickupDate())
    setShopNotes('')
    setEditingNote(null)
    setEditingPrice(null)
    setResumedOrderId(null)
    setResumedTicketDisplay(null)
    fetchNextTickets()
  }

  const totals = calculateOrderTotals(orderItems, surchargeType, discountType)

  const hasDC = orderItems.some((i) => i.service_type === 'dry_cleaning')
  const hasALT = orderItems.some((i) => i.service_type === 'alterations')
  const ticketDisplay = resumedTicketDisplay || (
    hasDC && hasALT
      ? `${nextTickets.d} / ${nextTickets.a}`
      : hasALT
      ? nextTickets.a
      : nextTickets.d
  )

  const buildOrderPayload = (isHeld) => ({
    ticket_number: ticketDisplay,
    customer_id: customer?.id || null,
    customer_name: customer?.name || null,
    customer_phone: customer?.phone || null,
    status: 'Pending',
    payment_status: 'Unpaid',
    subtotal: totals.subtotal,
    bulk_discount: totals.bulkDiscount,
    surcharge: totals.surcharge,
    surcharge_label: getSurchargeLabel(surchargeType),
    manual_discount: totals.manualDiscount,
    manual_discount_label: getDiscountLabel(discountType),
    tax: totals.tax,
    total: totals.total,
    pickup_date: pickupDate.toISOString().split('T')[0],
    shop_notes: shopNotes || null,
    is_held: isHeld,
    order_date: new Date().toISOString().split('T')[0],
  })

  const buildItemsPayload = (orderId) =>
    orderItems.map((item) => {
      const bulkPct = getBulkDiscountPct(item.quantity)
      const lineTotal = item.unit_price * item.quantity * (1 - bulkPct / 100)
      return {
        order_id: orderId,
        service_name: item.service_name,
        category: item.category,
        service_type: item.service_type,
        unit_price: item.unit_price,
        quantity: item.quantity,
        bulk_discount_pct: bulkPct,
        line_total: lineTotal,
        item_note: item.item_note || null,
        garment_group: item.garmentId || null,
      }
    })

  const holdOrder = async () => {
    if (orderItems.length === 0) return
    setSaving(true)
    try {
      // If resuming a held order, update it; otherwise insert
      if (resumedOrderId) {
        await supabase
          .from('order_items')
          .delete()
          .eq('order_id', resumedOrderId)
        await supabase
          .from('orders')
          .update({ ...buildOrderPayload(true) })
          .eq('id', resumedOrderId)
        await supabase
          .from('order_items')
          .insert(buildItemsPayload(resumedOrderId))
      } else {
        const { data: order, error } = await supabase
          .from('orders')
          .insert(buildOrderPayload(true))
          .select()
          .single()
        if (!error && order) {
          await supabase.from('order_items').insert(buildItemsPayload(order.id))
        }
      }
      onHoldCountChange()
      clearOrder()
    } finally {
      setSaving(false)
    }
  }

  const createOrder = async () => {
    if (orderItems.length === 0) return
    setSaving(true)
    try {
      let orderId

      if (resumedOrderId) {
        await supabase
          .from('order_items')
          .delete()
          .eq('order_id', resumedOrderId)
        await supabase
          .from('orders')
          .update({ ...buildOrderPayload(false) })
          .eq('id', resumedOrderId)
        await supabase
          .from('order_items')
          .insert(buildItemsPayload(resumedOrderId))
        orderId = resumedOrderId
        onHoldCountChange()
      } else {
        const { data: order, error } = await supabase
          .from('orders')
          .insert(buildOrderPayload(false))
          .select()
          .single()
        if (error || !order) return
        await supabase.from('order_items').insert(buildItemsPayload(order.id))
        orderId = order.id
      }

      // Build print data and print
      const mappedItems = orderItems.map((item) => ({
        ...item,
        bulkPct: getBulkDiscountPct(item.quantity),
        lineTotal: item.unit_price * item.quantity * (1 - getBulkDiscountPct(item.quantity) / 100),
      }))
      const commonPrintFields = {
        customerName: customer?.name || 'Walk-in',
        customerPhone: customer?.phone || '',
        phoneType: customer?.phone_type || '',
        orderDate: new Date().toLocaleDateString('en-CA'),
        pickupDate: formatPickupDate(pickupDate),
        totals,
        surchargeLabel: getSurchargeLabel(surchargeType),
        discountLabel: getDiscountLabel(discountType),
        shopNotes,
        paymentStatus: 'Unpaid',
        shopName: SHOP_NAME,
        shopAddress: SHOP_ADDRESS,
        shopPhone: SHOP_PHONE,
      }

      const isMixed = hasDC && hasALT
      const printData = isMixed
        ? {
            ...commonPrintFields,
            ticketNumberD: nextTickets.d,
            ticketNumberA: nextTickets.a,
            itemsDC: mappedItems.filter((i) => i.service_type === 'dry_cleaning'),
            itemsALT: mappedItems.filter((i) => i.service_type === 'alterations'),
          }
        : { ...commonPrintFields, ticketNumber: ticketDisplay, items: mappedItems }

      clearOrder()
      setPendingPrint({ isMixed, data: printData })
    } finally {
      setSaving(false)
    }
  }

  const bulkItems = orderItems.filter((i) => getBulkDiscountPct(i.quantity) > 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {holdCount > 0 && (
        <div className="no-print flex-shrink-0">
          <button
            onClick={() => setShowHeldPanel((v) => !v)}
            className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm font-medium flex items-center gap-2 hover:bg-amber-100 transition-colors"
          >
            <span>⏸</span>
            <span className="flex-1 text-left">
              {holdCount} order{holdCount > 1 ? 's' : ''} on hold
            </span>
            <span className="text-amber-600 text-xs">{showHeldPanel ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showHeldPanel && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
              {heldOrders.map((order) => (
                <div key={order.id} className="bg-white border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{order.ticket_number}</span>
                      <span className="text-xs text-gray-500">{order.customer_name || 'Walk-in'}</span>
                      {order.customer_phone && (
                        <span className="text-xs text-gray-400">· {order.customer_phone}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {(order.order_items || []).map((i) => i.service_name).join(', ')}
                    </div>
                    <div className="text-sm font-bold text-gray-800 mt-0.5">${order.total?.toFixed(2)}</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        setShowHeldPanel(false)
                        const o = order
                        loadResumedOrder(o)
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => discardHeld(order.id)}
                      className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL ── */}
        <div className="w-[350px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
          {/* Customer */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Customer
            </h3>

            {customer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">
                    {customer.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {customer.phone_type} · {customer.phone}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {customer.order_count} orders
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCustomer(null)
                    setCustomerSearch('')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 mt-0.5"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative" ref={searchRef}>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  onFocus={() => customerSearch && setShowDropdown(true)}
                  placeholder="Search name or phone…"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 z-20 max-h-64 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-sm text-gray-900">
                          {c.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {c.phone_type} · {c.phone}
                        </div>
                      </button>
                    ))}
                    {customerSearch.trim() && (
                      <button
                        onClick={() => {
                          setShowAddCustomer(true)
                          setNewCustomerForm((f) => ({
                            ...f,
                            name: customerSearch,
                          }))
                          setShowDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2.5 text-blue-600 text-sm font-medium hover:bg-blue-50"
                      >
                        + Add &ldquo;{customerSearch}&rdquo; as new customer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Services */}
          <div className="p-4">
            {/* Tab toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
              {['dry_cleaning', 'alterations'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveServiceTab(tab)
                    setServiceDepth(1)
                    setSelectedCategory(null)
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeServiceTab === tab
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'dry_cleaning' ? 'Dry Cleaning' : 'Alterations'}
                </button>
              ))}
            </div>

            {serviceDepth === 1 ? (
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES[activeServiceTab].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id)
                      setServiceDepth(2)
                    }}
                    className="bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl p-3 text-left transition-colors"
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-sm font-semibold text-gray-800 leading-tight">
                      {cat.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {getCategoryCount(cat.id)} services
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => {
                    setServiceDepth(1)
                    setSelectedCategory(null)
                  }}
                  className="flex items-center gap-1 text-sm text-blue-600 font-medium mb-3 hover:underline"
                >
                  ← {selectedCategory}
                </button>
                <div className="flex flex-col gap-1.5">
                  {getCategoryServices().map((service) => (
                    <button
                      key={service.id}
                      onClick={() => addItemToOrder(service)}
                      className="w-full flex items-center justify-between bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl px-3 py-2.5 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-800 text-left">
                        {service.name}
                      </span>
                      <span className="text-sm font-bold text-gray-600 ml-2 flex-shrink-0">
                        ${service.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Current Order</h2>
              <span className="bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full tracking-wide">
                {ticketDisplay}
              </span>
            </div>

            {/* Items */}
            {orderItems.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center mb-4">
                <div className="text-4xl mb-3">🧺</div>
                <div className="text-gray-400 text-sm">
                  Select services from the left panel to add items
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl mb-4 overflow-hidden divide-y divide-gray-100">
                {orderItems.map((item) => {
                  const bulkPct = getBulkDiscountPct(item.quantity)
                  const lineTotal =
                    item.unit_price * item.quantity * (1 - bulkPct / 100)
                  const groupColors = {
                    1: '#3b82f6', 2: '#10b981', 3: '#8b5cf6', 4: '#f97316', 5: '#ec4899',
                  }
                  const borderColor = item.garmentId ? groupColors[item.garmentId] : 'transparent'
                  return (
                    <div key={item.id} style={{ borderLeft: `4px solid ${borderColor}` }}>
                      <div className="flex items-center gap-2 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {item.service_name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-400">
                              {item.service_type === 'dry_cleaning' ? 'DC' : 'ALT'}
                            </span>
                            {bulkPct > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                                Bulk {bulkPct}% off
                              </span>
                            )}
                            <select
                              value={item.garmentId || ''}
                              onChange={(e) => updateGarmentId(item.id, e.target.value ? parseInt(e.target.value) : null)}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-500 bg-white"
                              title="Garment group"
                            >
                              <option value="">no group</option>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>G{n}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Qty */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => updateQty(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 flex items-center justify-center text-base hover:bg-gray-100 font-bold"
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-sm font-bold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 flex items-center justify-center text-base hover:bg-gray-100 font-bold"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="text-sm font-bold text-gray-800 w-16 text-right">
                            ${lineTotal.toFixed(2)}
                          </div>
                          {/* Price edit */}
                          <button
                            onClick={() => {
                              if (editingPrice === item.id) {
                                setEditingPrice(null)
                              } else {
                                setEditingPrice(item.id)
                                setTempPrice(String(item.unit_price))
                                setEditingNote(null)
                              }
                            }}
                            className={`text-xs font-semibold flex-shrink-0 px-1.5 py-0.5 rounded ${
                              editingPrice === item.id
                                ? 'bg-gray-200 text-gray-700'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                            title="Edit price"
                          >
                            Edit
                          </button>
                        </div>

                        {/* Note */}
                        <button
                          onClick={() => {
                            if (editingNote === item.id) {
                              updateItemNote(item.id, tempNote)
                              setEditingNote(null)
                            } else {
                              setEditingNote(item.id)
                              setTempNote(item.item_note || '')
                              setEditingPrice(null)
                            }
                          }}
                          className={`text-xs font-semibold flex-shrink-0 px-1.5 py-0.5 rounded ${
                            item.item_note || editingNote === item.id
                              ? 'text-amber-600 bg-amber-50'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title="Add note"
                        >
                          Note
                        </button>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-gray-300 hover:text-red-500 text-lg font-bold flex-shrink-0 leading-none"
                        >
                          ×
                        </button>

                      </div>

                      {/* Note editor */}
                      {editingNote === item.id && (
                        <div className="px-4 pb-3 pt-2 bg-amber-50 border-t border-amber-100">
                          <div className="text-xs text-amber-700 font-semibold mb-1.5">
                            Item note · English only · printed on both copies
                          </div>
                          <textarea
                            value={tempNote}
                            onChange={(e) => setTempNote(e.target.value)}
                            onBlur={() => {
                              updateItemNote(item.id, tempNote)
                              setEditingNote(null)
                            }}
                            placeholder="e.g. Handle with care, button loose…"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                            rows={2}
                            autoFocus
                          />
                        </div>
                      )}

                      {/* Price editor */}
                      {editingPrice === item.id && (
                        <div className="px-4 pb-3 pt-2 bg-gray-50 border-t border-gray-100">
                          <div className="flex justify-end gap-2">
                            <input
                              type="number"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(e.target.value)}
                              className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              step="0.01"
                              min="0"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                updateItemPrice(item.id, tempPrice)
                                setEditingPrice(null)
                              }}
                              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-xl hover:bg-blue-700 font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingPrice(null)}
                              className="text-gray-500 text-sm px-3 py-1.5 rounded-xl hover:bg-gray-100 border border-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline note display */}
                      {item.item_note && editingNote !== item.id && (
                        <div className="px-4 pb-2.5 bg-amber-50 border-t border-amber-100">
                          <span className="text-xs text-amber-700 italic">
                            ↳ {item.item_note}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Bulk discount banner */}
            {bulkItems.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-4 text-sm text-green-800">
                <span className="font-bold">Bulk discount applied: </span>
                {bulkItems.map((item, i) => (
                  <span key={item.id}>
                    {item.service_name} ({getBulkDiscountPct(item.quantity)}%
                    off, qty {item.quantity})
                    {i < bulkItems.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Surcharge */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                Surcharge
              </div>
              <div className="flex gap-2">
                {SURCHARGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setSurchargeType((prev) =>
                        prev === opt.id ? null : opt.id
                      )
                    }
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                      surchargeType === opt.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                Discount
              </div>
              <div className="flex flex-wrap gap-2">
                {DISCOUNT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setDiscountType((prev) =>
                        prev === opt.id ? null : opt.id
                      )
                    }
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                      discountType === opt.id
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Items</span>
                  <span className="font-medium">
                    ${totals.subtotal.toFixed(2)}
                  </span>
                </div>
                {totals.bulkDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Bulk discount</span>
                    <span>−${totals.bulkDiscount.toFixed(2)}</span>
                  </div>
                )}
                {totals.surcharge > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>
                      Surcharge (
                      {surchargeType === 'today' ? '30%' : '20%'})
                    </span>
                    <span>+${totals.surcharge.toFixed(2)}</span>
                  </div>
                )}
                {totals.manualDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>−${totals.manualDiscount.toFixed(2)}</span>
                  </div>
                )}
                {(totals.bulkDiscount > 0 || totals.surcharge > 0 || totals.manualDiscount > 0) && (
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium">${totals.taxable.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">HST 13%</span>
                  <span className="font-medium">${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2.5 mt-2.5">
                  <span>Total</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Pickup date */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                    Pickup Date
                  </div>
                  <div className="text-sm font-bold text-gray-900 font-mono">
                    {formatPickupDate(pickupDate)}
                  </div>
                </div>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="text-sm text-blue-600 font-semibold hover:underline"
                >
                  Change
                </button>
              </div>
              {showDatePicker && (
                <div className="mt-3">
                  <input
                    type="date"
                    value={pickupDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const d = new Date(e.target.value + 'T12:00:00')
                      setPickupDate(d)
                      setShowDatePicker(false)
                    }}
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>

            {/* Shop notes */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  메모 (Shop notes)
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                  한국어
                </span>
              </div>
              <textarea
                value={shopNotes}
                onChange={(e) => setShopNotes(e.target.value)}
                placeholder="메모를 입력하세요…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pb-8">
              <button
                onClick={clearOrder}
                className="px-5 py-3 border border-gray-300 rounded-2xl text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={holdOrder}
                disabled={orderItems.length === 0 || saving}
                className="flex-1 py-3 border-2 border-amber-400 text-amber-700 rounded-2xl font-bold hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ⏸ Hold
              </button>
              <button
                onClick={createOrder}
                disabled={orderItems.length === 0 || saving}
                className="flex-[2] py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {saving ? 'Saving…' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print confirmation modal */}
      {pendingPrint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">🖨️</div>
              <h3 className="text-lg font-bold">Order created!</h3>
              <p className="text-gray-500 text-sm mt-1">Select what to print</p>
            </div>
            <div className="space-y-2 mb-4">
              {[
                {
                  label: 'Customer Receipt',
                  sub: 'Full breakdown for the customer',
                  fn: () => pendingPrint.isMixed
                    ? printMixedCustomerCopy(pendingPrint.data)
                    : printCustomerCopy(pendingPrint.data),
                },
                {
                  label: pendingPrint.isMixed ? 'Shop Copies (D + A)' : 'Shop Copy',
                  sub: 'Items list for the shop',
                  fn: () => pendingPrint.isMixed
                    ? printMixedShopCopies(pendingPrint.data)
                    : printShopCopy(pendingPrint.data),
                },
                {
                  label: 'Item Tags',
                  sub: 'One tag per garment',
                  fn: () => pendingPrint.isMixed
                    ? printMixedItemTags(pendingPrint.data)
                    : printItemTags(pendingPrint.data),
                },
              ].map(({ label, sub, fn }) => (
                <button
                  key={label}
                  onClick={fn}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{label}</div>
                    <div className="text-xs text-gray-400">{sub}</div>
                  </div>
                  <span className="text-blue-600 text-sm font-semibold ml-3">Print</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingPrint(null)}
              className="w-full py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Add New Customer
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newCustomerForm.name}
                  onChange={(e) =>
                    setNewCustomerForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Customer name"
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
                        setNewCustomerForm((f) => ({
                          ...f,
                          phone_type: type,
                        }))
                      }
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        newCustomerForm.phone_type === type
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
                  value={newCustomerForm.phone}
                  onChange={(e) =>
                    setNewCustomerForm((f) => ({
                      ...f,
                      phone: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 416-555-1234"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowAddCustomer(false)
                  setNewCustomerForm({ name: '', phone_type: 'Cell', phone: '' })
                }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addCustomer}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
