import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type, type Part } from '@google/genai';
import { getServerConfig } from './src/config/keys.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const STORE_DIR = path.resolve(__dirname, '.data');
const STORE_FILE = path.join(STORE_DIR, 'store.json');

interface StoredWatch {
  id: string;
  product_name?: string;
  brand: string;
  model: string;
  color: string;
  category: string;
  connectivity: string;
  capacity_spec: string;
  display_buying_price: number;
  real_buying_price: number;
  min_selling_price: number;
  stock_count: number;
  image_url: string;
  description: string;
  created_at: string;
}

interface StoredMemo {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  discount_amount: number;
  total_amount: number;
  notes: string;
  items: unknown[];
  created_at: string;
}

interface ServerStoreData {
  watches: StoredWatch[];
  memos: StoredMemo[];
}

let storeCache: ServerStoreData | null = null;

function readServerStore(): ServerStoreData {
  if (storeCache) return storeCache;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      storeCache = {
        watches: Array.isArray(parsed?.watches) ? parsed.watches : [],
        memos: Array.isArray(parsed?.memos) ? parsed.memos : [],
      };
      return storeCache;
    }
  } catch (err) {
    console.warn('Unable to read .data/store.json, starting empty:', err);
  }
  storeCache = { watches: [], memos: [] };
  return storeCache;
}

function writeServerStore(next: ServerStoreData): void {
  storeCache = next;
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.warn('Unable to persist .data/store.json:', err);
  }
}

function getTokenSecret(): string {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, GEMINI_API_KEY } = getServerConfig();
  return crypto
    .createHash('sha256')
    .update(`new-chiko-watch:${ADMIN_USERNAME}:${ADMIN_PASSWORD}:${GEMINI_API_KEY}`)
    .digest('hex');
}

function createAdminToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(req: Request): { username: string } | null {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.username || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return { username: String(decoded.username) };
  } catch {
    return null;
  }
}

function sanitizeStoredWatch(raw: Record<string, unknown>, existing?: StoredWatch): StoredWatch {
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim().slice(0, 128)
      : existing?.id || `nc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const toNum = (val: unknown, fallback = 0) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.min(100000000, Math.round(n * 100) / 100) : fallback;
  };
  const toStock = (val: unknown, fallback = 0) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.min(1000000, Math.round(n)) : fallback;
  };

  return {
    id,
    product_name:
      typeof raw.product_name === 'string'
        ? raw.product_name.trim().slice(0, 160)
        : existing?.product_name || '',
    brand: String(raw.brand ?? existing?.brand ?? 'New Chiko').trim().slice(0, 80) || 'New Chiko',
    model: String(raw.model ?? existing?.model ?? 'Model').trim().slice(0, 120) || 'Model',
    color: String(raw.color ?? existing?.color ?? 'Black').trim().slice(0, 80) || 'Black',
    category:
      String(raw.category ?? existing?.category ?? 'Gadgets & Accessories').trim().slice(0, 80) ||
      'Gadgets & Accessories',
    connectivity:
      String(raw.connectivity ?? existing?.connectivity ?? 'Standard').trim().slice(0, 100) ||
      'Standard',
    capacity_spec:
      String(raw.capacity_spec ?? existing?.capacity_spec ?? 'Standard').trim().slice(0, 100) ||
      'Standard',
    display_buying_price: toNum(raw.display_buying_price, existing?.display_buying_price ?? 0),
    real_buying_price: toNum(raw.real_buying_price, existing?.real_buying_price ?? 0),
    min_selling_price: toNum(raw.min_selling_price, existing?.min_selling_price ?? 0),
    stock_count: toStock(raw.stock_count, existing?.stock_count ?? 1),
    image_url:
      typeof raw.image_url === 'string'
        ? raw.image_url.slice(0, 800000)
        : existing?.image_url || '',
    description:
      typeof raw.description === 'string'
        ? raw.description.trim().slice(0, 1200)
        : existing?.description || '',
    created_at:
      typeof raw.created_at === 'string' && raw.created_at.trim()
        ? raw.created_at
        : existing?.created_at || new Date().toISOString(),
  };
}

function toPublicWatch(w: StoredWatch, includeCost: boolean): StoredWatch {
  return includeCost ? w : { ...w, real_buying_price: 0 };
}

let serverSupabaseClient: SupabaseClient | null = null;
let cachedSupabaseSignature = '';

function getServerSupabase(): SupabaseClient | null {
  const { SUPABASE_URL, SUPABASE_KEY } = getServerConfig();
  if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_URL.startsWith('http')) {
    return null;
  }
  const sig = `${SUPABASE_URL}::${SUPABASE_KEY}`;
  if (!serverSupabaseClient || cachedSupabaseSignature !== sig) {
    serverSupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
    cachedSupabaseSignature = sig;
  }
  return serverSupabaseClient;
}

function buildSupabaseWatchInsert(w: StoredWatch) {
  return {
    product_name: w.product_name || '',
    brand: w.brand,
    model: w.model,
    color: w.color,
    category: w.category,
    connectivity: w.connectivity,
    capacity_spec: w.capacity_spec,
    display_buying_price: w.display_buying_price,
    real_buying_price: w.real_buying_price,
    min_selling_price: w.min_selling_price,
    stock_count: w.stock_count,
    image_url: w.image_url || '',
    description: w.description || '',
  };
}

function createGeminiClient(): GoogleGenAI {
  const { GEMINI_API_KEY } = getServerConfig();
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Gemini AI is not configured yet. Please add your GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatFriendlyAiError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = raw.trim();

  if (!trimmed) return fallback;

  let extracted = trimmed;
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      if (parsed?.error?.message && typeof parsed.error.message === 'string') {
        extracted = parsed.error.message;
      } else if (parsed?.message && typeof parsed.message === 'string') {
        extracted = parsed.message;
      }
    } catch {
      // Keep original string if not JSON
    }
  }

  const lower = extracted.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return 'Your Gemini API key appears invalid. Please check it in Settings > Secrets.';
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return 'Gemini API access was denied. Please verify your API key permissions in Settings > Secrets.';
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return 'The AI assistant is temporarily busy due to rate limits. Please try again in a moment.';
  }
  if (lower.includes('not configured')) {
    return extracted;
  }

  return fallback;
}

interface CatalogItemSummary {
  id: string;
  name: string;
  brand: string;
  model: string;
  color: string;
  category: string;
  connectivity: string;
  capacity_spec: string;
  min_selling_price: number;
  stock_count: number;
  description: string;
  image_url: string;
}

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  if (!url.startsWith('data:image/')) return null;
  const commaIdx = url.indexOf(',');
  if (commaIdx === -1) return null;
  const header = url.slice(5, commaIdx);
  const mimeType = header.split(';')[0] || 'image/jpeg';
  const data = url.slice(commaIdx + 1);
  if (!data) return null;
  return { mimeType, data };
}

function resolveMatchedWatchId(rawId: string, catalog: CatalogItemSummary[]): string | null {
  if (!rawId) return null;
  const exact = catalog.find((item) => item.id === rawId);
  if (exact) return exact.id;

  const normalized = rawId.trim().toLowerCase();
  const fuzzy = catalog.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.model.toLowerCase() === normalized ||
      item.name.toLowerCase() === normalized ||
      item.name.toLowerCase().includes(normalized) ||
      normalized.includes(item.model.toLowerCase())
  );
  return fuzzy ? fuzzy.id : null;
}

function computeSemanticFallbackMatches(
  detected: { brand?: string; category?: string; color?: string; features?: string },
  catalog: CatalogItemSummary[]
) {
  const tokens = `${detected.brand ?? ''} ${detected.category ?? ''} ${detected.color ?? ''} ${detected.features ?? ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);

  const scored = catalog.map((item) => {
    const haystack = `${item.brand} ${item.model} ${item.category} ${item.color} ${item.connectivity} ${item.capacity_spec} ${item.description}`.toLowerCase();
    let hits = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) hits += 1;
    }
    const categoryBoost =
      detected.category &&
      item.category.toLowerCase().includes(detected.category.toLowerCase())
        ? 28
        : 0;
    const brandBoost =
      detected.brand && item.brand.toLowerCase().includes(detected.brand.toLowerCase())
        ? 32
        : 0;
    const score = Math.min(95, Math.max(30, 30 + hits * 12 + categoryBoost + brandBoost));
    return {
      watchId: item.id,
      matchPercentage: score,
      reason: `Closest inventory match in ${item.category} (${item.brand} ${item.model}).`,
    };
  });

  return scored.sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, 5);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'new-chiko-watch',
      supabaseConfigured: Boolean(getServerSupabase()),
    });
  });

  // Admin Login Verification (Standard Username & Password -> signed session token)
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    const { ADMIN_USERNAME, ADMIN_PASSWORD } = getServerConfig();

    if (
      typeof username === 'string' &&
      typeof password === 'string' &&
      username.trim() === ADMIN_USERNAME &&
      password === ADMIN_PASSWORD
    ) {
      const token = createAdminToken(ADMIN_USERNAME);
      return res.json({ ok: true, username: ADMIN_USERNAME, token });
    }

    return res.status(401).json({
      ok: false,
      error: 'Invalid admin username or password.',
    });
  });

  app.get('/api/admin/verify', (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false });
    }
    return res.json({ ok: true, username: admin.username });
  });

  // Shared Public Products Store (Supabase primary, server store fallback)
  app.get('/api/products', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    const supabase = getServerSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('watches')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase GET /api/products error:', error.message);
        return res.status(502).json({
          ok: false,
          source: 'supabase',
          error: `Supabase query failed: ${error.message}`,
        });
      }
      const rows = (Array.isArray(data) ? data : []).map((r) =>
        toPublicWatch(sanitizeStoredWatch(r as Record<string, unknown>), Boolean(admin))
      );
      return res.json({ ok: true, source: 'supabase', watches: rows });
    }

    const store = readServerStore();
    return res.json({
      ok: true,
      source: 'server',
      watches: store.watches.map((w) => toPublicWatch(w, Boolean(admin))),
    });
  });

  app.post('/api/products', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin login required to add products.' });
    }
    const input = (req.body ?? {}) as Record<string, unknown>;
    const watch = sanitizeStoredWatch(input);

    const supabase = getServerSupabase();
    if (supabase) {
      const payload = buildSupabaseWatchInsert(watch);
      let { data, error } = await supabase
        .from('watches')
        .insert([payload])
        .select()
        .single();
      if (error && error.message.includes('product_name')) {
        const { product_name: _ignored, ...legacyPayload } = payload;
        const retry = await supabase
          .from('watches')
          .insert([legacyPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error || !data) {
        return res.status(502).json({
          ok: false,
          error: `Failed to save product to Supabase: ${error?.message || 'Unknown error'}. Make sure you ran schema.sql in Supabase.`,
        });
      }
      const saved = sanitizeStoredWatch(data as Record<string, unknown>);
      return res.status(201).json({ ok: true, source: 'supabase', watch: saved });
    }

    const store = readServerStore();
    const nextWatches = [watch, ...store.watches.filter((w) => w.id !== watch.id)];
    writeServerStore({ ...store, watches: nextWatches });
    return res.status(201).json({ ok: true, source: 'server', watch, watches: nextWatches });
  });

  app.post('/api/products/sync', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin login required to sync products.' });
    }
    const incoming = Array.isArray(req.body?.watches) ? req.body.watches : [];

    const supabase = getServerSupabase();
    if (supabase) {
      const { data: existingRows, error: fetchErr } = await supabase
        .from('watches')
        .select('brand,model,created_at');
      if (fetchErr) {
        return res.status(502).json({
          ok: false,
          error: `Supabase sync read failed: ${fetchErr.message}`,
        });
      }
      const existingKeys = new Set(
        Array.isArray(existingRows)
          ? existingRows.map((r) => `${r.brand}::${r.model}::${r.created_at}`)
          : []
      );
      const toInsert = [];
      for (const raw of incoming) {
        if (!raw || typeof raw !== 'object') continue;
        const sanitized = sanitizeStoredWatch(raw as Record<string, unknown>);
        const key = `${sanitized.brand}::${sanitized.model}::${sanitized.created_at}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          toInsert.push(buildSupabaseWatchInsert(sanitized));
        }
      }
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('watches').insert(toInsert);
        if (insertErr) {
          return res.status(502).json({
            ok: false,
            error: `Supabase sync insert failed: ${insertErr.message}`,
          });
        }
      }
      return res.json({ ok: true, source: 'supabase', added: toInsert.length });
    }

    const store = readServerStore();
    const existingIds = new Set(store.watches.map((w) => w.id));
    let added = 0;
    const toAdd: StoredWatch[] = [];
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') continue;
      const sanitized = sanitizeStoredWatch(raw as Record<string, unknown>);
      if (!existingIds.has(sanitized.id)) {
        existingIds.add(sanitized.id);
        toAdd.push(sanitized);
        added += 1;
      }
    }
    const nextWatches = [...toAdd, ...store.watches];
    if (added > 0) {
      writeServerStore({ ...store, watches: nextWatches });
    }
    return res.json({ ok: true, source: 'server', added, watches: nextWatches });
  });

  app.put('/api/products/:id', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin login required to update products.' });
    }
    const id = req.params.id;
    const patch = (req.body ?? {}) as Record<string, unknown>;

    const supabase = getServerSupabase();
    if (supabase) {
      const allowedPatch: Record<string, unknown> = {};
      const fields = [
        'product_name',
        'brand',
        'model',
        'color',
        'category',
        'connectivity',
        'capacity_spec',
        'display_buying_price',
        'real_buying_price',
        'min_selling_price',
        'stock_count',
        'image_url',
        'description',
      ];
      for (const f of fields) {
        if (f in patch) allowedPatch[f] = patch[f];
      }
      let { data, error } = await supabase
        .from('watches')
        .update(allowedPatch)
        .eq('id', id)
        .select()
        .single();
      if (error && 'product_name' in allowedPatch && error.message.includes('product_name')) {
        const { product_name: _ignored, ...legacyPatch } = allowedPatch;
        const retry = await supabase
          .from('watches')
          .update(legacyPatch)
          .eq('id', id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        return res.status(502).json({
          ok: false,
          error: `Failed to update product in Supabase: ${error.message}`,
        });
      }
      const saved = data ? sanitizeStoredWatch(data as Record<string, unknown>) : null;
      return res.json({ ok: true, source: 'supabase', watch: saved });
    }

    const store = readServerStore();
    const existing = store.watches.find((w) => w.id === id);
    if (!existing) {
      const created = sanitizeStoredWatch({ ...patch, id });
      const nextWatches = [created, ...store.watches];
      writeServerStore({ ...store, watches: nextWatches });
      return res.json({ ok: true, source: 'server', watch: created, watches: nextWatches });
    }
    const updated = sanitizeStoredWatch({ ...existing, ...patch, id }, existing);
    const nextWatches = store.watches.map((w) => (w.id === id ? updated : w));
    writeServerStore({ ...store, watches: nextWatches });
    return res.json({ ok: true, source: 'server', watch: updated, watches: nextWatches });
  });

  app.delete('/api/products/:id', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin login required to delete products.' });
    }
    const id = req.params.id;

    const supabase = getServerSupabase();
    if (supabase) {
      const { error } = await supabase.from('watches').delete().eq('id', id);
      if (error) {
        return res.status(502).json({
          ok: false,
          error: `Failed to delete product from Supabase: ${error.message}`,
        });
      }
      return res.json({ ok: true, source: 'supabase' });
    }

    const store = readServerStore();
    const nextWatches = store.watches.filter((w) => w.id !== id);
    writeServerStore({ ...store, watches: nextWatches });
    return res.json({ ok: true, source: 'server', watches: nextWatches });
  });

  // Sales Memos Endpoints (Supabase primary, server store fallback)
  app.get('/api/memos', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.json({ ok: true, memos: [] });
    }
    const supabase = getServerSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('sales_memos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && Array.isArray(data)) {
        return res.json({ ok: true, source: 'supabase', memos: data });
      }
    }
    const store = readServerStore();
    return res.json({ ok: true, source: 'server', memos: store.memos });
  });

  app.post('/api/memos', async (req: Request, res: Response) => {
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const memo: StoredMemo = {
      id:
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id.trim().slice(0, 128)
          : `memo-${Date.now()}`,
      invoice_number: String(raw.invoice_number ?? `NCE-${Date.now()}`).slice(0, 64),
      customer_name: String(raw.customer_name ?? 'Walk-in Customer').slice(0, 120),
      customer_phone: String(raw.customer_phone ?? '').slice(0, 32),
      payment_method: String(raw.payment_method ?? 'Cash').slice(0, 20),
      discount_amount: Number(raw.discount_amount) || 0,
      total_amount: Number(raw.total_amount) || 0,
      notes: String(raw.notes ?? '').slice(0, 500),
      items: Array.isArray(raw.items) ? raw.items.slice(0, 50) : [],
      created_at:
        typeof raw.created_at === 'string' && raw.created_at.trim()
          ? raw.created_at
          : new Date().toISOString(),
    };

    const supabase = getServerSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('sales_memos')
        .insert([
          {
            invoice_number: memo.invoice_number,
            customer_name: memo.customer_name,
            customer_phone: memo.customer_phone,
            payment_method: memo.payment_method,
            discount_amount: memo.discount_amount,
            total_amount: memo.total_amount,
            notes: memo.notes,
            items: memo.items,
          },
        ])
        .select()
        .single();
      if (!error && data) {
        return res.status(201).json({ ok: true, source: 'supabase', memo: data });
      }
    }

    const store = readServerStore();
    const nextMemos = [memo, ...store.memos.filter((m) => m.id !== memo.id)].slice(0, 100);
    writeServerStore({ ...store, memos: nextMemos });
    return res.status(201).json({ ok: true, source: 'server', memo, memos: nextMemos });
  });

  // Chiko Lens: Visual + Semantic Search against Full Inventory (v1beta)
  app.post('/api/gemini/visual-search', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, watches } = req.body ?? {};
      if (!imageBase64 || !Array.isArray(watches)) {
        return res.status(400).json({ error: 'Please upload a product photo to search.' });
      }

      const ai = createGeminiClient();

      const catalogSummary: CatalogItemSummary[] = watches.map((w: Record<string, unknown>) => {
        const rawImage = typeof w.image_url === 'string' ? w.image_url : '';
        const brand = String(w.brand ?? '');
        const model = String(w.model ?? '');
        const productName = String(w.product_name ?? '').trim();
        return {
          id: String(w.id ?? ''),
          name: productName || `${brand} ${model}`.trim(),
          brand,
          model,
          color: String(w.color ?? ''),
          category: String(w.category ?? w.strap_type ?? 'Gadgets & Accessories'),
          connectivity: String(w.connectivity ?? w.movement ?? ''),
          capacity_spec: String(w.capacity_spec ?? w.case_size ?? ''),
          min_selling_price: Number(w.min_selling_price ?? 0),
          stock_count: Number(w.stock_count ?? 0),
          description: String(w.description ?? ''),
          image_url: rawImage.startsWith('http')
            ? rawImage
            : rawImage.startsWith('data:image/')
            ? 'attached_reference_photo'
            : '',
        };
      });

      // Build multimodal parts: query photo first, plus up to 6 stored inventory photos for true visual comparison
      const parts: Part[] = [
        {
          text: 'CUSTOMER QUERY PHOTO (identify this item and match against our inventory):',
        },
        {
          inlineData: {
            mimeType: typeof mimeType === 'string' ? mimeType : 'image/jpeg',
            data: imageBase64,
          },
        },
      ];

      if (catalogSummary.length > 0) {
        let attachedImages = 0;
        for (const rawItem of watches as Array<Record<string, unknown>>) {
          if (attachedImages >= 6) break;
          const imgStr = typeof rawItem.image_url === 'string' ? rawItem.image_url : '';
          const parsedData = parseDataUrl(imgStr);
          if (parsedData) {
            parts.push({
              text: `INVENTORY REFERENCE PHOTO for id="${String(rawItem.id)}" (${String(rawItem.brand)} ${String(rawItem.model)}):`,
            });
            parts.push({
              inlineData: {
                mimeType: parsedData.mimeType,
                data: parsedData.data,
              },
            });
            attachedImages += 1;
          }
        }

        parts.push({
          text: `You are the visual and semantic product matcher for "New Chiko Watch & Electronics" (selling Analog Watches, Digital Watches, Smartwatches, TWS Earbuds, Power Banks, Chargers & Cables, Bluetooth Speakers, Neckbands, and Gadgets & Accessories).
1. Identify the product in the CUSTOMER QUERY PHOTO (likely brand, category, color, and key features).
2. Visually compare the CUSTOMER QUERY PHOTO against any INVENTORY REFERENCE PHOTOS above AND semantically compare against EVERY item in the Full Store Inventory JSON below.
3. Match items even if lighting, angle, or model naming differs slightly.
4. ALWAYS return up to 5 closest matching products from our inventory ranked from highest to lowest matchPercentage (1 to 100), using the EXACT "id" string from the JSON as "watchId".
5. NEVER return an empty matches array or say "not found" when the inventory has items.

Full Store Inventory JSON:
${JSON.stringify(catalogSummary)}`,
        });
      } else {
        parts.push({
          text: `Identify the watch or electronics product in the CUSTOMER QUERY PHOTO (brand, category, color, and key features). Because the store inventory is currently empty, return matches: [].`,
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedProduct: {
                type: Type.OBJECT,
                properties: {
                  brand: { type: Type.STRING },
                  category: { type: Type.STRING },
                  color: { type: Type.STRING },
                  features: { type: Type.STRING },
                },
                required: ['brand', 'category', 'color', 'features'],
              },
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    watchId: { type: Type.STRING },
                    matchPercentage: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                  },
                  required: ['watchId', 'matchPercentage', 'reason'],
                },
              },
            },
            required: ['detectedProduct', 'matches'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const detectedProduct = parsed.detectedProduct ?? {
        brand: 'Watch / Electronics',
        category: 'Gadgets & Accessories',
        color: 'Black',
        features: 'Consumer watch or electronics item',
      };

      const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : [];
      const validMatchesMap = new Map<
        string,
        { watchId: string; matchPercentage: number; reason: string }
      >();

      for (const m of rawMatches) {
        const resolvedId = resolveMatchedWatchId(String(m?.watchId ?? ''), catalogSummary);
        if (resolvedId && !validMatchesMap.has(resolvedId)) {
          validMatchesMap.set(resolvedId, {
            watchId: resolvedId,
            matchPercentage: Math.max(1, Math.min(100, Number(m?.matchPercentage ?? 55))),
            reason: String(m?.reason ?? 'Visually and semantically similar item in stock.'),
          });
        }
      }

      let finalMatches = Array.from(validMatchesMap.values()).sort(
        (a, b) => b.matchPercentage - a.matchPercentage
      );

      // Guarantee closest-match results whenever inventory has items
      if (catalogSummary.length > 0 && finalMatches.length === 0) {
        finalMatches = computeSemanticFallbackMatches(detectedProduct, catalogSummary);
      }

      return res.json({
        detectedProduct,
        matches: finalMatches,
      });
    } catch (error) {
      console.error('Chiko Lens error:', error);
      return res.status(500).json({
        error: formatFriendlyAiError(
          error,
          'Chiko Lens could not analyze this image right now. Please try another photo.'
        ),
      });
    }
  });

  // AI Auto-Fill for Admin Add Product form (Supports both Watches & Electronics, v1beta)
  app.post('/api/gemini/autofill', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, imageUrl } = req.body ?? {};
      let resolvedBase64 = typeof imageBase64 === 'string' ? imageBase64 : '';
      let resolvedMime = typeof mimeType === 'string' && mimeType ? mimeType : 'image/jpeg';

      if (!resolvedBase64 && typeof imageUrl === 'string' && imageUrl.trim()) {
        const parsedData = parseDataUrl(imageUrl.trim());
        if (parsedData) {
          resolvedBase64 = parsedData.data;
          resolvedMime = parsedData.mimeType;
        } else if (/^https?:\/\//i.test(imageUrl.trim())) {
          const imgRes = await fetch(imageUrl.trim());
          if (imgRes.ok) {
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            const arrayBuf = await imgRes.arrayBuffer();
            resolvedBase64 = Buffer.from(arrayBuf).toString('base64');
            resolvedMime = contentType.split(';')[0] || 'image/jpeg';
          }
        }
      }

      if (!resolvedBase64) {
        return res.status(400).json({ error: 'Please upload or capture a product photo first.' });
      }

      const ai = createGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: resolvedMime,
                data: resolvedBase64,
              },
            },
            {
              text: `Analyze this product image for "New Chiko Watch & Electronics" (which sells traditional Analog Watches, Digital Watches, Smartwatches, TWS Earbuds, Power Banks, Chargers & Cables, Bluetooth Speakers, Neckbands, and Gadgets & Accessories).
Carefully inspect visible markings, dial/screen, strap or casing material, ports, buttons, and color, and return JSON with:
- product_name: Attractive retail product title (e.g. "Casio Edifice Slim Sapphire Steel Watch", "Oraimo FreePods 4 ANC Earbuds", "Anker PowerCore 20,000mAh Power Bank")
- brand: Exact or likely brand name visible (e.g. "Casio", "Seiko", "Rolex", "Apple", "Samsung", "Oraimo", "Anker", "JBL", "Xiaomi", or "Generic" if unbranded)
- model: Specific model number or model name (e.g. "EFR-S108D", "Watch Ultra 2", "OTW-330", "A1287")
- category: MUST be strictly one of: "Analog Watches", "Digital Watches", "Smartwatches", "TWS Earbuds", "Power Banks", "Chargers & Cables", "Bluetooth Speakers", "Neckbands", "Gadgets & Accessories"
- color: Dominant visible color and finish (e.g. "Midnight Black Dial · Brushed Silver Steel", "Matte White", "Champagne Gold / Brown Leather")
- connectivity: Movement/strap style for watches (e.g. "Japanese Quartz · Stainless Steel") OR wireless/port interface for electronics (e.g. "Bluetooth 5.3 · USB-C")
- capacity_spec: Case size/rating for watches (e.g. "40mm · 5ATM Water Resistant") OR power/battery spec for electronics (e.g. "20,000mAh · 22.5W Fast Charge")
- description: Short, attractive 1-2 sentence customer description highlighting visible features, strap/build style, and color. Do NOT invent or mention any prices or stock counts.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              product_name: { type: Type.STRING },
              brand: { type: Type.STRING },
              model: { type: Type.STRING },
              category: { type: Type.STRING },
              color: { type: Type.STRING },
              connectivity: { type: Type.STRING },
              capacity_spec: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: [
              'product_name',
              'brand',
              'model',
              'category',
              'color',
              'connectivity',
              'capacity_spec',
              'description',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (error) {
      console.error('AI Auto-Fill error:', error);
      return res.status(500).json({
        error: formatFriendlyAiError(
          error,
          'Could not auto-fill product details from this image. You can fill in the fields manually.'
        ),
      });
    }
  });

  // Smart Shop Chatbot (Bangla, Banglish, English — Watches & Electronics, v1beta)
  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    try {
      const { message, history, watches } = req.body ?? {};
      if (!message || !Array.isArray(watches)) {
        return res.status(400).json({ error: 'Please type a message to ask the concierge.' });
      }

      const ai = createGeminiClient();

      // Strictly exclude real_buying_price from customer-facing AI context
      const publicCatalog = watches.map((w: Record<string, unknown>) => ({
        id: w.id,
        brand: w.brand,
        model: w.model,
        color: w.color,
        category: w.category ?? w.strap_type,
        connectivity: w.connectivity ?? w.movement,
        capacity_spec: w.capacity_spec ?? w.case_size,
        tag_price_bdt: w.display_buying_price,
        offer_price_bdt: w.min_selling_price,
        stock_count: w.stock_count,
        description: w.description,
      }));

      const conversationContext = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h: { role: string; text: string }) => `${h.role}: ${h.text}`)
            .join('\n')
        : '';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${conversationContext ? `Recent conversation:\n${conversationContext}\n\n` : ''}Customer message: ${message}`,
        config: {
          systemInstruction: `You are the polite, knowledgeable sales concierge at "New Chiko Watch & Electronics", selling both traditional/digital watches AND electronics (Smartwatches, TWS Earbuds, Power Banks, Chargers, Cables, Bluetooth Speakers, Neckbands, and Gadgets).
- Fluently understand and reply in the same language/style the customer uses: Bangla (বাংলা), Banglish (Romanized Bengali like "Casio er 2000 takar niche ki ghori ache?" or "2000 takar moddhe TWS earbuds ache?"), or English.
- Only recommend products from the provided Store Catalog JSON below. Use offer_price_bdt (৳) as the selling price and mention tag_price_bdt if helpful.
- If the Store Catalog JSON is empty ([]), politely let the customer know that new watches and electronics items are being added shortly and invite them to check back soon.
- NEVER invent products not in the catalog, and NEVER mention wholesale/buying cost.
- If matching products exist, include their exact "id" values in recommendedWatchIds (up to 4). If none match the exact budget/brand, gently say so and suggest the closest available alternatives if appropriate.
- Keep replies concise, warm, and clear for mobile shoppers.

Store Catalog JSON:
${JSON.stringify(publicCatalog)}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              recommendedWatchIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['reply', 'recommendedWatchIds'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (error) {
      console.error('Shop Chatbot error:', error);
      return res.status(500).json({
        error: formatFriendlyAiError(
          error,
          'The shop concierge is temporarily unavailable. Please try again in a moment.'
        ),
      });
    }
  });

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE || process.env.K_REVISION);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`New Chiko Watch & Electronics server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start New Chiko Watch & Electronics server:', err);
  process.exit(1);
});
