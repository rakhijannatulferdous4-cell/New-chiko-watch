import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  PUBLIC_CONFIG,
  isCloudinaryPresetConfigured,
  isSupabaseConfigured,
} from '../config/keys';
import { INITIAL_WATCHES } from '../data/initialWatches';
import { DigitalMemo, ProductCategory, WatchFormInput, WatchItem } from '../types/watch';

export const ADMIN_SESSION_KEY = 'new_chiko_admin_session_v1';
const WATCHES_STORAGE_KEY = 'new_chiko_watches_inventory_v2';
const LEGACY_WATCHES_STORAGE_KEY = 'new_chiko_watches_inventory_v1';
const MEMOS_STORAGE_KEY = 'new_chiko_sales_memos_v1';

const VALID_CATEGORIES: ProductCategory[] = [
  'Analog Watches',
  'Digital Watches',
  'Smartwatches',
  'TWS Earbuds',
  'Power Banks',
  'Chargers & Cables',
  'Bluetooth Speakers',
  'Neckbands',
  'Gadgets & Accessories',
];

function generateSafeId(prefix = 'nc'): string {
  const rand = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 8);
  return `${prefix}-${Date.now()}-${rand || 'item'}`.slice(0, 128);
}

function toSafeId(rawId: unknown, prefix = 'nc'): string {
  const candidate = String(rawId ?? '').replace(/[^a-zA-Z0-9_-]/g, '-');
  return candidate.length >= 1 && candidate.length <= 128
    ? candidate
    : generateSafeId(prefix);
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const trimmed = String(val ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function clampPrice(val: unknown): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100000000, Math.round(n * 100) / 100);
}

function clampStock(val: unknown): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1000000, Math.round(n));
}

function toIsoString(val: unknown): string {
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return new Date().toISOString();
}

function normalizeCategory(raw: unknown, strapOrMovement?: unknown): ProductCategory {
  if (typeof raw === 'string') {
    if (VALID_CATEGORIES.includes(raw as ProductCategory)) {
      return raw as ProductCategory;
    }
    if (raw === 'Accessories' || raw === 'Gadgets') {
      return 'Gadgets & Accessories';
    }
  }
  const hint = `${String(raw ?? '')} ${String(strapOrMovement ?? '')}`.toLowerCase();
  if (hint.includes('digital')) return 'Digital Watches';
  if (
    hint.includes('leather') ||
    hint.includes('steel') ||
    hint.includes('mesh') ||
    hint.includes('quartz') ||
    hint.includes('automatic')
  ) {
    return 'Analog Watches';
  }
  return 'Gadgets & Accessories';
}

function normalizeProduct(row: Record<string, unknown>): WatchItem {
  return {
    id: toSafeId(row.id),
    product_name: typeof row.product_name === 'string' ? row.product_name.slice(0, 160) : '',
    brand: clampString(row.brand, 80, 'New Chiko'),
    model: clampString(row.model, 120, 'Model'),
    color: clampString(row.color, 80, 'Black'),
    category: normalizeCategory(row.category ?? row.strap_type, row.movement),
    connectivity: clampString(row.connectivity ?? row.movement, 100, 'Standard'),
    capacity_spec: clampString(row.capacity_spec ?? row.case_size, 100, 'Standard'),
    display_buying_price: clampPrice(row.display_buying_price),
    real_buying_price: clampPrice(row.real_buying_price),
    min_selling_price: clampPrice(row.min_selling_price),
    stock_count: clampStock(row.stock_count),
    image_url:
      typeof row.image_url === 'string' && row.image_url.length <= 800000
        ? row.image_url
        : '',
    description: clampString(row.description, 1200, ''),
    created_at: toIsoString(row.created_at),
  };
}

function sortByNewest(items: WatchItem[]): WatchItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.created_at) || 0;
    const tb = Date.parse(b.created_at) || 0;
    return tb - ta;
  });
}

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(
      PUBLIC_CONFIG.NEXT_PUBLIC_SUPABASE_URL,
      PUBLIC_CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return supabaseClient;
}

export function getStoredAdminToken(): string {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
}

function buildAuthHeaders(tokenOverride?: string): Record<string, string> {
  const token = tokenOverride || getStoredAdminToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function loadLocalWatches(): WatchItem[] {
  try {
    localStorage.removeItem(LEGACY_WATCHES_STORAGE_KEY);
    const raw = localStorage.getItem(WATCHES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify(INITIAL_WATCHES));
      return INITIAL_WATCHES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeProduct(item as Record<string, unknown>));
    }
    localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify(INITIAL_WATCHES));
    return INITIAL_WATCHES;
  } catch {
    return INITIAL_WATCHES;
  }
}

export function saveLocalWatches(watches: WatchItem[]): void {
  try {
    localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify(watches));
  } catch (err) {
    console.warn('Unable to save products to localStorage:', err);
  }
}

export async function fetchWatches(adminToken?: string): Promise<{
  watches: WatchItem[];
  source: 'supabase' | 'server' | 'local';
  error?: string;
}> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('watches')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        const normalized = sortByNewest(
          data.map((row) => normalizeProduct(row as Record<string, unknown>))
        );
        saveLocalWatches(normalized);
        return { watches: normalized, source: 'supabase' };
      }
      if (error) {
        return {
          watches: loadLocalWatches(),
          source: 'supabase',
          error: `Supabase query failed: ${error.message}. Run schema.sql in your Supabase SQL Editor.`,
        };
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to server store:', err);
    }
  }

  try {
    const token = adminToken || getStoredAdminToken();
    const res = await fetch('/api/products', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.watches)) {
      const normalized = sortByNewest(
        json.watches.map((row: Record<string, unknown>) => normalizeProduct(row))
      );
      if (normalized.length > 0) {
        saveLocalWatches(normalized);
      }
      const source = json.source === 'supabase' ? 'supabase' : 'server';
      return { watches: normalized, source };
    }
    if (!res.ok && json?.source === 'supabase') {
      return {
        watches: loadLocalWatches(),
        source: 'supabase',
        error: String(
          json.error ||
            'Supabase table not found. Please run schema.sql in your Supabase SQL Editor.'
        ),
      };
    }
  } catch (err) {
    console.warn('Server store fetch fallback to localStorage:', err);
  }

  return { watches: loadLocalWatches(), source: 'local' };
}

function isMissingSchemaColumnError(msg: string | undefined): boolean {
  if (!msg) return false;
  return (
    msg.includes('product_name') ||
    msg.includes('capacity_spec') ||
    msg.includes('connectivity') ||
    msg.includes('category')
  );
}

function toLegacyWatchPayload(input: Partial<WatchFormInput>): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...input };
  delete legacy.product_name;
  if ('category' in legacy) {
    legacy.strap_type = legacy.category;
    delete legacy.category;
  }
  if ('connectivity' in legacy) {
    legacy.movement = legacy.connectivity;
    delete legacy.connectivity;
  }
  if ('capacity_spec' in legacy) {
    legacy.case_size = legacy.capacity_spec;
    delete legacy.capacity_spec;
  }
  return legacy;
}

export async function createWatchRecord(
  input: WatchFormInput,
  currentWatches: WatchItem[],
  adminToken?: string
): Promise<{
  watches: WatchItem[];
  syncedToCloud: boolean;
  source: 'supabase' | 'server' | 'local';
}> {
  const id = generateSafeId('nc');
  const nowIso = new Date().toISOString();
  const newItem: WatchItem = normalizeProduct({
    ...input,
    id,
    created_at: nowIso,
  });

  const client = getSupabase();
  if (client) {
    try {
      let { data, error } = await client
        .from('watches')
        .insert([input])
        .select()
        .single();
      if (error && 'product_name' in input && error.message.includes('product_name')) {
        const { product_name: _ignored, ...noNamePayload } = input;
        const retry = await client
          .from('watches')
          .insert([noNamePayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error && isMissingSchemaColumnError(error.message)) {
        const retryLegacy = await client
          .from('watches')
          .insert([toLegacyWatchPayload(input)])
          .select()
          .single();
        data = retryLegacy.data;
        error = retryLegacy.error;
      }
      if (!error && data) {
        const saved = normalizeProduct(data as Record<string, unknown>);
        const next = [saved, ...currentWatches.filter((w) => w.id !== saved.id)];
        saveLocalWatches(next);
        return { watches: next, syncedToCloud: true, source: 'supabase' };
      }
      if (error) {
        throw new Error(
          `Supabase could not save this product: ${error.message}. Make sure schema.sql tables & RLS policies are created in Supabase.`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Supabase could not save')) {
        throw err;
      }
      console.warn('Supabase insert failed, trying server store:', err);
    }
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: buildAuthHeaders(adminToken),
      body: JSON.stringify(newItem),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.watch) {
      const saved = normalizeProduct(json.watch as Record<string, unknown>);
      const next = [saved, ...currentWatches.filter((w) => w.id !== saved.id)];
      saveLocalWatches(next);
      const source = json.source === 'supabase' ? 'supabase' : 'server';
      return { watches: next, syncedToCloud: true, source };
    }
    if (res.status === 401) {
      throw new Error('Your admin session expired. Please sign in again with Username & Password.');
    }
    if (res.status >= 500 && json?.error) {
      throw new Error(String(json.error));
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('session expired') || err.message.includes('Supabase'))
    ) {
      throw err;
    }
    console.warn('Server store save fallback to localStorage:', err);
  }

  const next = [newItem, ...currentWatches];
  saveLocalWatches(next);
  return { watches: next, syncedToCloud: false, source: 'local' };
}

export async function updateWatchRecord(
  id: string,
  patch: Partial<WatchFormInput>,
  currentWatches: WatchItem[],
  adminToken?: string
): Promise<{
  watches: WatchItem[];
  syncedToCloud: boolean;
  source: 'supabase' | 'server' | 'local';
}> {
  const existing = currentWatches.find((w) => w.id === id);
  const mergedItem: WatchItem = normalizeProduct({
    ...(existing ?? {}),
    ...patch,
    id,
  });

  const client = getSupabase();
  if (client) {
    try {
      let { error } = await client.from('watches').update(patch).eq('id', id);
      if (error && 'product_name' in patch && error.message.includes('product_name')) {
        const { product_name: _ignored, ...noNamePatch } = patch;
        const retry = await client.from('watches').update(noNamePatch).eq('id', id);
        error = retry.error;
      }
      if (error && isMissingSchemaColumnError(error.message)) {
        const retryLegacy = await client
          .from('watches')
          .update(toLegacyWatchPayload(patch))
          .eq('id', id);
        error = retryLegacy.error;
      }
      if (!error) {
        const next = currentWatches.map((w) => (w.id === id ? mergedItem : w));
        saveLocalWatches(next);
        return { watches: next, syncedToCloud: true, source: 'supabase' };
      }
      throw new Error(`Supabase update failed: ${error.message}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Supabase update failed')) {
        throw err;
      }
      console.warn('Supabase update failed, trying server store:', err);
    }
  }

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: buildAuthHeaders(adminToken),
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const saved = json.watch
        ? normalizeProduct(json.watch as Record<string, unknown>)
        : mergedItem;
      const next = currentWatches.map((w) => (w.id === id ? saved : w));
      saveLocalWatches(next);
      const source = json.source === 'supabase' ? 'supabase' : 'server';
      return { watches: next, syncedToCloud: true, source };
    }
    if (res.status === 401) {
      throw new Error('Your admin session expired. Please sign in again with Username & Password.');
    }
    if (res.status >= 500 && json?.error) {
      throw new Error(String(json.error));
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('session expired') || err.message.includes('Supabase'))
    ) {
      throw err;
    }
    console.warn('Server store update fallback to localStorage:', err);
  }

  const next = currentWatches.map((w) => (w.id === id ? mergedItem : w));
  saveLocalWatches(next);
  return { watches: next, syncedToCloud: false, source: 'local' };
}

export async function deleteWatchRecord(
  id: string,
  currentWatches: WatchItem[],
  adminToken?: string
): Promise<{
  watches: WatchItem[];
  syncedToCloud: boolean;
}> {
  let synced = false;
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('watches').delete().eq('id', id);
      if (!error) synced = true;
    } catch (err) {
      console.warn('Supabase delete fallback:', err);
    }
  }

  if (!synced) {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(adminToken),
      });
      if (res.ok) {
        synced = true;
      }
    } catch (err) {
      console.warn('Server store delete fallback:', err);
    }
  }

  const next = currentWatches.filter((w) => w.id !== id);
  saveLocalWatches(next);
  return { watches: next, syncedToCloud: synced };
}

/**
 * Automatically uploads any pre-existing localStorage products up to Supabase or
 * the shared backend server when an Admin logs in with Username & Password.
 */
export async function syncLocalWatchesToCloud(
  localWatches: WatchItem[],
  adminToken?: string
): Promise<number> {
  if (localWatches.length === 0) return 0;

  const client = getSupabase();
  if (client) {
    try {
      const { data: existingRows } = await client
        .from('watches')
        .select('brand,model,created_at');
      const existingKeys = new Set(
        Array.isArray(existingRows)
          ? existingRows.map((r) => `${r.brand}::${r.model}::${r.created_at}`)
          : []
      );
      const missing = localWatches.filter(
        (w) => !existingKeys.has(`${w.brand}::${w.model}::${w.created_at}`)
      );
      if (missing.length > 0) {
        const payloads = missing.map(({ id: _id, created_at: _c, ...rest }) => rest);
        let { error } = await client.from('watches').insert(payloads);
        if (error && isMissingSchemaColumnError(error.message)) {
          const legacyPayloads = payloads.map((p) => toLegacyWatchPayload(p));
          const retry = await client.from('watches').insert(legacyPayloads);
          error = retry.error;
        }
        if (!error) return missing.length;
      }
      return 0;
    } catch (err) {
      console.warn('Supabase local sync failed:', err);
    }
  }

  try {
    const res = await fetch('/api/products/sync', {
      method: 'POST',
      headers: buildAuthHeaders(adminToken),
      body: JSON.stringify({ watches: localWatches }),
    });
    if (res.ok) {
      const json = await res.json();
      return Number(json.added) || 0;
    }
  } catch (err) {
    console.warn('Server local sync failed:', err);
  }
  return 0;
}

export function loadLocalMemos(): DigitalMemo[] {
  try {
    const raw = localStorage.getItem(MEMOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function fetchAdminMemos(adminToken?: string): Promise<DigitalMemo[]> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('sales_memos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && Array.isArray(data)) {
        const memos = data as DigitalMemo[];
        try {
          localStorage.setItem(MEMOS_STORAGE_KEY, JSON.stringify(memos));
        } catch {
          // ignore
        }
        return memos;
      }
    } catch {
      // fall through
    }
  }

  try {
    const token = adminToken || getStoredAdminToken();
    if (token) {
      const res = await fetch('/api/memos', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.memos)) {
          return json.memos as DigitalMemo[];
        }
      }
    }
  } catch {
    // fall back to local memos
  }

  return loadLocalMemos();
}

export async function saveMemoRecord(
  memo: DigitalMemo,
  currentMemos: DigitalMemo[],
  adminToken?: string
): Promise<DigitalMemo[]> {
  const token = adminToken || getStoredAdminToken();
  if (!token) {
    throw new Error('Staff login required to create sales memos.');
  }

  const safeMemoId = toSafeId(memo.id, 'memo');
  const boundedItems = memo.items.slice(0, 50);
  const normalizedMemo: DigitalMemo = {
    ...memo,
    id: safeMemoId,
    customer_name: clampString(memo.customer_name, 120, 'Walk-in Customer'),
    customer_phone: clampString(memo.customer_phone, 32, ''),
    invoice_number: clampString(memo.invoice_number, 64, `NCE-${Date.now()}`),
    discount_amount: clampPrice(memo.discount_amount),
    total_amount: clampPrice(memo.total_amount),
    notes: clampString(memo.notes, 500, ''),
    items: boundedItems,
  };

  let savedToSupabase = false;
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('sales_memos').insert([
        {
          invoice_number: normalizedMemo.invoice_number,
          customer_name: normalizedMemo.customer_name,
          customer_phone: normalizedMemo.customer_phone,
          payment_method: normalizedMemo.payment_method,
          discount_amount: normalizedMemo.discount_amount,
          total_amount: normalizedMemo.total_amount,
          notes: normalizedMemo.notes,
          items: normalizedMemo.items,
        },
      ]);
      if (!error) savedToSupabase = true;
    } catch (err) {
      console.warn('Supabase memo insert fallback:', err);
    }
  }

  if (!savedToSupabase) {
    try {
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(normalizedMemo),
      });
      if (res.status === 401) {
        throw new Error('Staff login expired. Please sign in again to save memos.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Staff login')) {
        throw err;
      }
      // keep local copy
    }
  }

  const next = [normalizedMemo, ...currentMemos].slice(0, 50);
  try {
    localStorage.setItem(MEMOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

/**
 * Compress image file to lightweight JPEG data URL (< 420KB) for AI vision & DB/server storage.
 */
export function compressImageFile(
  file: File,
  maxDimension = 760
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const mimeType = 'image/jpeg';
        const attempts: Array<{ dim: number; quality: number }> = [
          { dim: maxDimension, quality: 0.78 },
          { dim: maxDimension, quality: 0.6 },
          { dim: 540, quality: 0.55 },
          { dim: 400, quality: 0.48 },
        ];

        let dataUrl = '';
        for (const attempt of attempts) {
          const scale = Math.min(1, attempt.dim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          dataUrl = canvas.toDataURL(mimeType, attempt.quality);
          if (dataUrl.length <= 420000) {
            break;
          }
        }

        const base64 = dataUrl.split(',')[1] || '';
        resolve({ dataUrl, base64, mimeType });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads photo to Cloudinary when unsigned preset is configured;
 * otherwise stores compressed Data URL (< 420KB) so it saves cleanly in Supabase/server store.
 */
export async function uploadWatchPhoto(file: File): Promise<{
  imageUrl: string;
  base64: string;
  mimeType: string;
  provider: 'cloudinary' | 'local';
}> {
  const compressed = await compressImageFile(file);

  if (isCloudinaryPresetConfigured) {
    try {
      const formData = new FormData();
      formData.append('file', compressed.dataUrl);
      formData.append('upload_preset', PUBLIC_CONFIG.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
      const endpoint = `https://api.cloudinary.com/v1_1/${PUBLIC_CONFIG.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      if (res.ok) {
        const json = await res.json();
        if (json.secure_url) {
          return {
            imageUrl: json.secure_url,
            base64: compressed.base64,
            mimeType: compressed.mimeType,
            provider: 'cloudinary',
          };
        }
      }
    } catch (err) {
      console.warn('Cloudinary upload failed, falling back to compressed image:', err);
    }
  }

  return {
    imageUrl: compressed.dataUrl,
    base64: compressed.base64,
    mimeType: compressed.mimeType,
    provider: 'local',
  };
}
