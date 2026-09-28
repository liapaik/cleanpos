export const getBulkDiscountPct = (qty) => {
  if (qty >= 10) return 10
  if (qty >= 5) return 5
  return 0
}

export const SURCHARGE_OPTIONS = [
  { id: 'today', label: 'Today 30%', rate: 0.30 },
  { id: 'nextday', label: 'Next Day 20%', rate: 0.20 },
]

export const DISCOUNT_OPTIONS = [
  { id: 'loyalty', label: 'Loyalty 10%', rate: 0.10 },
  { id: 'newcustomer', label: 'New Customer 5%', rate: 0.05 },
]

export const getSurchargeRate = (type) =>
  SURCHARGE_OPTIONS.find((s) => s.id === type)?.rate ?? 0

export const getSurchargeLabel = (type) =>
  SURCHARGE_OPTIONS.find((s) => s.id === type)?.label ?? null

export const getDiscountRate = (type) =>
  DISCOUNT_OPTIONS.find((d) => d.id === type)?.rate ?? 0

export const getDiscountLabel = (type) =>
  DISCOUNT_OPTIONS.find((d) => d.id === type)?.label ?? null

export const calculateOrderTotals = (items, surchargeType, discountType) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )

  const bulkDiscount = items.reduce((sum, item) => {
    const pct = getBulkDiscountPct(item.quantity)
    return sum + (item.unit_price * item.quantity * pct) / 100
  }, 0)

  const afterBulk = subtotal - bulkDiscount

  const surchargeRate = getSurchargeRate(surchargeType)
  const surcharge = afterBulk * surchargeRate

  const discountRate = getDiscountRate(discountType)
  const manualDiscount = (afterBulk + surcharge) * discountRate

  const taxable = afterBulk + surcharge - manualDiscount
  const tax = taxable * 0.13
  const total = taxable + tax

  return {
    subtotal,
    bulkDiscount,
    surcharge,
    manualDiscount,
    taxable,
    tax,
    total,
  }
}

export const fmt = (amount) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount ?? 0)

export const formatPickupDate = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const dayAbbr = days[d.getDay()]
  return `${y}-${m}-${day}-${dayAbbr}`
}

export const getDefaultPickupDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}

export const getNextTicketNumbers = async (supabase) => {
  const { data } = await supabase
    .from('orders')
    .select('ticket_number')

  let dMax = 0, aMax = 0
  for (const row of (data || [])) {
    const dm = row.ticket_number?.match(/D(\d+)/)
    const am = row.ticket_number?.match(/A(\d+)/)
    if (dm) dMax = Math.max(dMax, parseInt(dm[1], 10))
    if (am) aMax = Math.max(aMax, parseInt(am[1], 10))
  }

  return {
    d: `D${String(dMax + 1).padStart(3, '0')}`,
    a: `A${String(aMax + 1).padStart(3, '0')}`,
  }
}

export const localDateStr = (d) => {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const friendlyDate = (dateStr) => {
  const today = localDateStr(new Date())
  const yesterday = localDateStr(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
