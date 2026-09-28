const divider = `<div style="border-top:1px dashed #999;margin:6px 0;"></div>`
const solidDiv = `<div style="border-top:1px solid #000;margin:6px 0;"></div>`

const itemRowCustomer = (item) => {
  const lineTotal = item.unit_price * item.quantity * (1 - item.bulkPct / 100)
  return `
    <div style="display:flex;justify-content:space-between;font-size:12px;margin:3px 0;">
      <span style="flex:1;">${item.service_name} x${item.quantity}</span>
      <span>$${lineTotal.toFixed(2)}</span>
    </div>
    ${item.bulkPct > 0 ? `<div style="font-size:11px;color:#666;padding-left:8px;">Bulk ${item.bulkPct}% off</div>` : ''}
    ${item.item_note ? `<div style="font-size:11px;color:#555;padding-left:8px;font-style:italic;">↳ ${item.item_note}</div>` : ''}
  `
}

const itemRowShop = (item) => `
  <div style="display:flex;justify-content:space-between;font-size:12px;margin:3px 0;">
    <span style="flex:1;">${item.service_name}</span>
    <span>x${item.quantity}</span>
  </div>
  ${item.item_note ? `<div style="font-size:11px;color:#555;padding-left:8px;font-style:italic;">↳ ${item.item_note}</div>` : ''}
`

const payBox = (paymentStatus, paymentMethod, total) => {
  const isPaid = paymentStatus === 'Paid'
  return isPaid
    ? `<div style="border:2px solid green;padding:6px;text-align:center;font-size:13px;font-weight:bold;color:green;margin:8px 0;">✓ PAID${paymentMethod ? ' · ' + paymentMethod : ''}</div>`
    : `<div style="border:2px solid red;padding:6px;text-align:center;font-size:13px;font-weight:bold;color:red;margin:8px 0;">UNPAID — BALANCE $${total.toFixed(2)}</div>`
}

const openPrint = (bodyHtml) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        @page { margin: 4mm; size: 80mm auto; }
        body { margin: 0; padding: 0; background: white; }
        .page-break { page-break-after: always; }
      </style>
    </head>
    <body>
      ${bodyHtml}
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function(){ window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `
  const win = window.open('', '_blank', 'width=400,height=600')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ─── Customer copy HTML ───────────────────────────────────────────────────────

function buildCustomerCopy(data) {
  const { ticketNumber, customerName, customerPhone, phoneType, orderDate, pickupDate,
    items, totals, surchargeLabel, discountLabel, shopNotes, paymentStatus, paymentMethod,
    shopName, shopAddress, shopPhone } = data
  const balance = paymentStatus === 'Paid' ? 0 : totals.total
  return `
    <div style="font-family:monospace;width:72mm;font-size:12px;line-height:1.4;">
      <div style="text-align:center;font-weight:bold;font-size:14px;">${shopName}</div>
      ${shopAddress ? `<div style="text-align:center;font-size:11px;">${shopAddress}</div>` : ''}
      ${shopPhone ? `<div style="text-align:center;font-size:11px;">${shopPhone}</div>` : ''}
      ${divider}
      <div style="text-align:center;font-size:22px;font-weight:bold;letter-spacing:1px;">${ticketNumber}</div>
      ${divider}
      <div style="font-size:12px;"><b>Customer:</b> ${customerName}</div>
      <div style="font-size:12px;">${phoneType ? phoneType + ': ' : ''}${customerPhone}</div>
      <div style="font-size:12px;"><b>Order date:</b> ${orderDate}</div>
      <div style="font-size:12px;"><b>Pickup:</b> ${pickupDate}</div>
      ${solidDiv}
      ${items.map(itemRowCustomer).join('')}
      ${solidDiv}
      <div style="display:flex;justify-content:space-between;font-size:12px;"><span>Items</span><span>$${totals.subtotal.toFixed(2)}</span></div>
      ${totals.bulkDiscount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:green;"><span>Bulk discount</span><span>-$${totals.bulkDiscount.toFixed(2)}</span></div>` : ''}
      ${totals.surcharge > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#b45309;"><span>${surchargeLabel || 'Surcharge'}</span><span>+$${totals.surcharge.toFixed(2)}</span></div>` : ''}
      ${totals.manualDiscount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:green;"><span>${discountLabel || 'Discount'}</span><span>-$${totals.manualDiscount.toFixed(2)}</span></div>` : ''}
      ${(totals.bulkDiscount > 0 || totals.surcharge > 0 || totals.manualDiscount > 0) ? `<div style="display:flex;justify-content:space-between;font-size:12px;border-top:1px solid #ccc;padding-top:3px;"><span>Subtotal</span><span>$${totals.taxable.toFixed(2)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:12px;"><span>HST 13%</span><span>$${totals.tax.toFixed(2)}</span></div>
      ${solidDiv}
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;"><span>TOTAL</span><span>$${totals.total.toFixed(2)}</span></div>
      ${solidDiv}
      ${payBox(paymentStatus, paymentMethod, balance)}
      <div style="text-align:center;font-size:11px;margin-top:8px;">Thank you for your business!</div>
    </div>
  `
}

// ─── Shop copy HTML ───────────────────────────────────────────────────────────

function buildShopCopy(data) {
  const { ticketNumber, customerName, customerPhone, pickupDate,
    items, totals, shopNotes, paymentStatus, paymentMethod, shopName, label } = data
  const balance = paymentStatus === 'Paid' ? 0 : totals.total
  return `
    <div style="font-family:monospace;width:72mm;font-size:12px;line-height:1.4;">
      <div style="text-align:center;font-weight:bold;font-size:14px;">${shopName}${label ? ' — ' + label : ' — SHOP'}</div>
      ${divider}
      <div style="text-align:center;font-size:22px;font-weight:bold;letter-spacing:1px;">${ticketNumber}</div>
      ${divider}
      <div style="font-size:12px;"><b>${customerName}</b></div>
      <div style="font-size:12px;">${customerPhone}</div>
      <div style="font-size:12px;"><b>Pickup:</b> ${pickupDate}</div>
      ${solidDiv}
      ${items.map(itemRowShop).join('')}
      ${solidDiv}
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;"><span>TOTAL</span><span>$${totals.total.toFixed(2)}</span></div>
      ${solidDiv}
      ${payBox(paymentStatus, paymentMethod, balance)}
      ${shopNotes ? `${divider}<div style="font-size:12px;font-weight:bold;">메모 (Shop notes):</div><div style="font-size:12px;white-space:pre-wrap;">${shopNotes}</div>` : ''}
    </div>
  `
}

// ─── Item tag HTML ────────────────────────────────────────────────────────────

function singleTag(ticketNumber, customerName, pickupDate, serviceName, itemNote, shopName) {
  return `
    <div style="font-family:monospace;width:72mm;font-size:12px;line-height:1.5;padding:4px 0;">
      <div style="text-align:center;font-size:11px;color:#666;">${shopName}</div>
      ${divider}
      <div style="text-align:center;font-size:26px;font-weight:bold;letter-spacing:2px;">${ticketNumber}</div>
      ${divider}
      <div style="font-size:13px;font-weight:bold;">${serviceName}</div>
      <div style="font-size:12px;color:#444;">${customerName}</div>
      <div style="font-size:11px;color:#666;">Pickup: ${pickupDate}</div>
      ${itemNote ? `<div style="font-size:11px;font-style:italic;color:#555;">↳ ${itemNote}</div>` : ''}
    </div>
  `
}

function garmentTag(ticketNumber, customerName, pickupDate, garmentLabel, groupItems, shopName) {
  const serviceLines = groupItems.map(i =>
    `<div style="font-size:12px;">• ${i.service_name}${i.item_note ? ` <span style="color:#666;font-style:italic;">(${i.item_note})</span>` : ''}</div>`
  ).join('')
  return `
    <div style="font-family:monospace;width:72mm;font-size:12px;line-height:1.5;padding:4px 0;">
      <div style="text-align:center;font-size:11px;color:#666;">${shopName}</div>
      ${divider}
      <div style="text-align:center;font-size:26px;font-weight:bold;letter-spacing:2px;">${ticketNumber}</div>
      ${divider}
      <div style="font-size:14px;font-weight:bold;text-transform:uppercase;">${garmentLabel}</div>
      <div style="font-size:12px;color:#444;">${customerName}</div>
      <div style="font-size:11px;color:#666;">Pickup: ${pickupDate}</div>
      ${solidDiv}
      ${serviceLines}
    </div>
  `
}

function buildItemTags(ticketNumber, customerName, pickupDate, items, shopName) {
  // Alteration items only
  const altItems = items.filter(i => i.service_type === 'alterations')
  if (altItems.length === 0) return ''

  const grouped = {}
  const ungrouped = []
  for (const item of altItems) {
    if (item.garmentId) {
      if (!grouped[item.garmentId]) grouped[item.garmentId] = []
      grouped[item.garmentId].push(item)
    } else {
      ungrouped.push(item)
    }
  }

  const tags = []
  for (const groupItems of Object.values(grouped)) {
    tags.push(garmentTag(ticketNumber, customerName, pickupDate, groupItems[0].category, groupItems, shopName))
  }
  for (const item of ungrouped) {
    for (let i = 0; i < (item.quantity || 1); i++) {
      tags.push(singleTag(ticketNumber, customerName, pickupDate, item.service_name, item.item_note, shopName))
    }
  }

  if (tags.length === 0) return ''
  return tags.map((t, i) => i < tags.length - 1 ? `<div class="page-break">${t}</div>` : t).join('')
}

// ─── Public: single-type orders ───────────────────────────────────────────────

export function printCustomerCopy(data) {
  openPrint(buildCustomerCopy(data))
}

export function printShopCopy(data) {
  openPrint(buildShopCopy(data))
}

export function printItemTags(data) {
  const { ticketNumber, customerName, pickupDate, items, shopName } = data
  const html = buildItemTags(ticketNumber, customerName, pickupDate, items, shopName)
  if (html) openPrint(html)
}

/** Prints customer copy + shop copy together (used for reprints from Orders page) */
export function printTicket(data) {
  openPrint(`
    <div class="page-break">${buildCustomerCopy(data)}</div>
    <div>${buildShopCopy(data)}</div>
  `)
}

// ─── Public: mixed orders (dry cleaning + alterations) ───────────────────────

export function printMixedCustomerCopy(data) {
  const { ticketNumberD, ticketNumberA, itemsDC, itemsALT, ...rest } = data
  const allItems = [...itemsDC, ...itemsALT]
  openPrint(buildCustomerCopy({ ...rest, ticketNumber: `${ticketNumberD} / ${ticketNumberA}`, items: allItems }))
}

export function printMixedShopCopies(data) {
  const { ticketNumberD, ticketNumberA, itemsDC, itemsALT, shopName, ...rest } = data
  const copyD = buildShopCopy({ ...rest, shopName, ticketNumber: ticketNumberD, items: itemsDC, label: 'DRY CLEANING' })
  const copyA = buildShopCopy({ ...rest, shopName, ticketNumber: ticketNumberA, items: itemsALT, label: 'ALTERATIONS' })
  openPrint(`<div class="page-break">${copyD}</div><div>${copyA}</div>`)
}

export function printMixedItemTags(data) {
  const { ticketNumberA, itemsALT, customerName, pickupDate, shopName } = data
  // Only alteration tags — buildItemTags already filters, but pass ALT items directly
  const allTagsHtml = buildItemTags(ticketNumberA, customerName, pickupDate, itemsALT, shopName)
  if (allTagsHtml) openPrint(allTagsHtml)
}

/** Prints customer copy + both shop copies together (used for reprints from Orders page) */
export function printMixedTicket(data) {
  const { ticketNumberD, ticketNumberA, itemsDC, itemsALT, shopName, ...rest } = data
  const allItems = [...itemsDC, ...itemsALT]
  const customerCopy = buildCustomerCopy({ ...rest, shopName, ticketNumber: `${ticketNumberD} / ${ticketNumberA}`, items: allItems })
  const shopCopyD = buildShopCopy({ ...rest, shopName, ticketNumber: ticketNumberD, items: itemsDC, label: 'DRY CLEANING' })
  const shopCopyA = buildShopCopy({ ...rest, shopName, ticketNumber: ticketNumberA, items: itemsALT, label: 'ALTERATIONS' })
  openPrint(`
    <div class="page-break">${customerCopy}</div>
    <div class="page-break">${shopCopyD}</div>
    <div>${shopCopyA}</div>
  `)
}
