-- ============================================================
-- CleanPOS — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- CUSTOMERS
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone_type text not null default 'Cell', -- 'Cell' or 'Home'
  created_at timestamptz default now()
);

-- ORDERS
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  customer_id uuid references customers(id),
  customer_name text,
  customer_phone text,
  status text not null default 'Pending',      -- Pending | Ready | Picked up
  payment_status text not null default 'Unpaid', -- Unpaid | Paid
  payment_method text,                           -- Cash | Debit | Credit
  subtotal numeric not null default 0,
  bulk_discount numeric not null default 0,
  surcharge numeric not null default 0,
  surcharge_label text,
  manual_discount numeric not null default 0,
  manual_discount_label text,
  tax numeric not null default 0,
  total numeric not null default 0,
  pickup_date date not null,
  shop_notes text,
  is_held boolean default false,
  order_date date not null default current_date,
  created_at timestamptz default now()
);

-- ORDER ITEMS
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  service_name text not null,
  category text not null,
  service_type text not null,  -- 'dry_cleaning' | 'alterations'
  unit_price numeric not null,
  quantity integer not null default 1,
  bulk_discount_pct numeric not null default 0,
  line_total numeric not null,
  item_note text,
  garment_group integer  -- groups items on the same physical garment (for alteration tags)
);

-- Migration (run once if DB already exists):
-- ALTER TABLE order_items ADD COLUMN IF NOT EXISTS garment_group integer;

-- SERVICES
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  service_type text not null,   -- 'dry_cleaning' | 'alterations'
  category text not null,
  name text not null,
  price numeric not null,
  is_active boolean default true,
  sort_order integer default 0
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table services enable row level security;

-- Allow all operations for authenticated users
create policy "Authenticated users can manage customers"
  on customers for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage orders"
  on orders for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage order_items"
  on order_items for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage services"
  on services for all to authenticated using (true) with check (true);

-- ============================================================
-- SEED DATA — Services
-- ============================================================

insert into services (service_type, category, name, price, sort_order) values
-- DRY CLEANING — Suit
('dry_cleaning', 'Suit', 'Suit 2pc', 25, 1),
('dry_cleaning', 'Suit', 'Suit 3pc', 29, 2),
('dry_cleaning', 'Suit', 'Suit jacket only', 16, 3),
('dry_cleaning', 'Suit', 'Suit pants only', 10, 4),
-- DRY CLEANING — Shirt
('dry_cleaning', 'Shirt', 'Shirt – Regular', 8, 1),
('dry_cleaning', 'Shirt', 'Shirt – Linen', 11, 2),
('dry_cleaning', 'Shirt', 'Shirt – Silk', 14, 3),
('dry_cleaning', 'Shirt', 'Shirt – Dress', 9, 4),
-- DRY CLEANING — Pants
('dry_cleaning', 'Pants', 'Pants – Regular', 10, 1),
('dry_cleaning', 'Pants', 'Pants – Dress', 12, 2),
('dry_cleaning', 'Pants', 'Pants – Jeans', 11, 3),
('dry_cleaning', 'Pants', 'Pants – Linen', 13, 4),
-- DRY CLEANING — Dress
('dry_cleaning', 'Dress', 'Dress – Casual', 14, 1),
('dry_cleaning', 'Dress', 'Dress – Evening', 20, 2),
('dry_cleaning', 'Dress', 'Dress – Gown', 30, 3),
('dry_cleaning', 'Dress', 'Dress – Silk', 24, 4),
-- DRY CLEANING — Coat / Jacket
('dry_cleaning', 'Coat / Jacket', 'Winter coat', 24, 1),
('dry_cleaning', 'Coat / Jacket', 'Leather jacket', 28, 2),
('dry_cleaning', 'Coat / Jacket', 'Blazer', 16, 3),
('dry_cleaning', 'Coat / Jacket', 'Raincoat', 18, 4),
-- DRY CLEANING — Skirt
('dry_cleaning', 'Skirt', 'Skirt – Regular', 10, 1),
('dry_cleaning', 'Skirt', 'Skirt – Pleated', 13, 2),
('dry_cleaning', 'Skirt', 'Skirt – Long', 12, 3),
-- DRY CLEANING — Other Items
('dry_cleaning', 'Other Items', 'Tie', 6, 1),
('dry_cleaning', 'Other Items', 'Scarf', 7, 2),
('dry_cleaning', 'Other Items', 'Sweater', 12, 3),
('dry_cleaning', 'Other Items', 'Vest', 9, 4),
('dry_cleaning', 'Other Items', 'Blouse', 10, 5),

-- ALTERATIONS — Suit
('alterations', 'Suit', 'Suit jacket – take in', 35, 1),
('alterations', 'Suit', 'Suit jacket – let out', 35, 2),
('alterations', 'Suit', 'Suit pants – hem', 14, 3),
('alterations', 'Suit', 'Suit pants – waist', 20, 4),
('alterations', 'Suit', 'Suit sleeve shorten', 22, 5),
-- ALTERATIONS — Shirt
('alterations', 'Shirt', 'Shirt – body taper', 18, 1),
('alterations', 'Shirt', 'Shirt – sleeve shorten', 14, 2),
('alterations', 'Shirt', 'Shirt – collar repair', 12, 3),
('alterations', 'Shirt', 'Shirt – hem shorten', 12, 4),
-- ALTERATIONS — Pants
('alterations', 'Pants', 'Pants – hem', 14, 1),
('alterations', 'Pants', 'Pants – waist take in', 20, 2),
('alterations', 'Pants', 'Pants – waist let out', 20, 3),
('alterations', 'Pants', 'Pants – taper', 18, 4),
('alterations', 'Pants', 'Pants – crotch repair', 16, 5),
-- ALTERATIONS — Dress
('alterations', 'Dress', 'Dress – hem', 18, 1),
('alterations', 'Dress', 'Dress – take in', 25, 2),
('alterations', 'Dress', 'Dress – let out', 25, 3),
('alterations', 'Dress', 'Dress – zipper replace', 22, 4),
('alterations', 'Dress', 'Dress – strap repair', 14, 5),
-- ALTERATIONS — Coat / Jacket
('alterations', 'Coat / Jacket', 'Coat – shorten', 35, 1),
('alterations', 'Coat / Jacket', 'Coat – lining replace', 40, 2),
('alterations', 'Coat / Jacket', 'Coat – zipper replace', 28, 3),
('alterations', 'Coat / Jacket', 'Blazer – take in', 30, 4),
-- ALTERATIONS — Skirt
('alterations', 'Skirt', 'Skirt – hem', 14, 1),
('alterations', 'Skirt', 'Skirt – waist take in', 18, 2),
('alterations', 'Skirt', 'Skirt – zipper replace', 20, 3),
-- ALTERATIONS — General Repairs
('alterations', 'General Repairs', 'Button replace', 6, 1),
('alterations', 'General Repairs', 'Patch / repair', 12, 2),
('alterations', 'General Repairs', 'Seam repair', 10, 3),
('alterations', 'General Repairs', 'Lining repair', 18, 4),
('alterations', 'General Repairs', 'Pocket repair', 14, 5);
