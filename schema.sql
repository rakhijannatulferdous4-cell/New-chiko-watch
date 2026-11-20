-- ============================================================
-- NEW CHIKO WATCH & ELECTRONICS — SUPABASE POSTGRESQL SCHEMA
-- Run this SQL inside your Supabase SQL Editor (safe to re-run)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Watches & Electronics Inventory Table
CREATE TABLE IF NOT EXISTS public.watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT DEFAULT '',
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'Midnight Black',
  category TEXT NOT NULL DEFAULT 'Analog Watches',
  connectivity TEXT NOT NULL DEFAULT 'Quartz / Bluetooth',
  capacity_spec TEXT NOT NULL DEFAULT 'Standard',
  -- Three-tier pricing system (in BDT ৳)
  display_buying_price NUMERIC(12, 2) NOT NULL CHECK (display_buying_price >= 0),
  real_buying_price NUMERIC(12, 2) NOT NULL CHECK (real_buying_price >= 0),
  min_selling_price NUMERIC(12, 2) NOT NULL CHECK (min_selling_price >= 0),
  stock_count INTEGER NOT NULL DEFAULT 1 CHECK (stock_count >= 0),
  image_url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing tables safely if created from an earlier version
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT '';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'New Chiko';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'Model';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'Midnight Black';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Analog Watches';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS connectivity TEXT NOT NULL DEFAULT 'Quartz / Bluetooth';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS capacity_spec TEXT NOT NULL DEFAULT 'Standard';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS display_buying_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS real_buying_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS stock_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Indexes for fast search & filtering
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.watches (brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.watches (category);
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON public.watches (min_selling_price);

-- 2. Digital Sales Memos / Invoices Table
CREATE TABLE IF NOT EXISTS public.sales_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT '';
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer';
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'Cash';
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.sales_memos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_watches_updated_at ON public.watches;
CREATE TRIGGER trg_watches_updated_at
  BEFORE UPDATE ON public.watches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Permissions & Row Level Security (RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.watches TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_memos TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public.watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on watches" ON public.watches;
CREATE POLICY "Allow public read on watches"
  ON public.watches FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon write on watches" ON public.watches;
CREATE POLICY "Allow anon write on watches"
  ON public.watches FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on sales_memos" ON public.sales_memos;
CREATE POLICY "Allow all on sales_memos"
  ON public.sales_memos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. E-Commerce Payment & Delivery Settings Table (Single Config Row)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Customer Online Orders Table (Cart / Buy Now + bKash TrxID Verification)
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_zone TEXT NOT NULL DEFAULT 'inside_city',
  delivery_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'full_payment',
  payment_gateway TEXT NOT NULL DEFAULT 'bkash',
  receiving_number TEXT DEFAULT '',
  sender_number TEXT DEFAULT '',
  trx_id TEXT DEFAULT '',
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON public.customer_orders (status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON public.customer_orders (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_settings TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_orders TO anon, authenticated, service_role;

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on store_settings" ON public.store_settings;
CREATE POLICY "Allow all on store_settings"
  ON public.store_settings FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on customer_orders" ON public.customer_orders;
CREATE POLICY "Allow all on customer_orders"
  ON public.customer_orders FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 7. Customer Accounts Table (Phone + PIN Login & Customer ID)
CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  default_address TEXT DEFAULT '',
  delivery_zone TEXT NOT NULL DEFAULT 'inside_city',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_phone ON public.customer_accounts (phone_normalized);

-- 8. Admin <-> Customer Two-Way Messages Table
CREATE TABLE IF NOT EXISTS public.customer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone_normalized TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  order_number TEXT DEFAULT '',
  sender TEXT NOT NULL CHECK (sender IN ('admin', 'customer')),
  body TEXT NOT NULL,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_customer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_messages_phone ON public.customer_messages (customer_phone_normalized, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_accounts TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_messages TO anon, authenticated, service_role;

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on customer_accounts" ON public.customer_accounts;
CREATE POLICY "Allow all on customer_accounts"
  ON public.customer_accounts FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on customer_messages" ON public.customer_messages;
CREATE POLICY "Allow all on customer_messages"
  ON public.customer_messages FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
