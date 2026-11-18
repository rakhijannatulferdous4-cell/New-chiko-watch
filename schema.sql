-- ============================================================
-- NEW CHIKO WATCH & ELECTRONICS — SUPABASE POSTGRESQL SCHEMA
-- Run this SQL inside your Supabase SQL Editor to set up tables
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

-- 4. Row Level Security (RLS)
ALTER TABLE public.watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on watches"
  ON public.watches FOR SELECT
  USING (true);

CREATE POLICY "Allow anon write on watches"
  ON public.watches FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on sales_memos"
  ON public.sales_memos FOR ALL
  USING (true)
  WITH CHECK (true);
