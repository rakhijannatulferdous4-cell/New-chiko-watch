import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  PUBLIC_CONFIG,
  isCloudinaryPresetConfigured,
  isSupabaseConfigured,
} from '../config/keys';
import { INITIAL_WATCHES } from '../data/initialWatches';
import { DigitalMemo, ProductCategory, WatchFormInput, WatchItem } from '../types/watch';

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
  if (hint.includes('leather') || hint.includes('steel') || hint.includes('mesh') || hint.includes('quartz') || hint.includes('automatic')) {
    return 'Analog Watches';
  }
  return 'Gadgets & Accessories';
}

function normalizeProduct(row: Record<string, unknown>): WatchItem {
  return {
    id: String(row.id ?? `nc-${Date.now()}`),
    product_name: typeof row.product_name === 'string' ? row.product_name : '',
    brand: String(row.brand ?? ''),
    model: String(row.model ?? ''),
    color: String(row.color ?? 'Black'),
    category: normalizeCategory(row.category ?? row.strap_type, row.movement),
    connectivity: String(row.connectivity ?? row.movement ?? 'Standard'),
    capacity_spec: String(row.capacity_spec ?? row.case_size ?? 'Standard'),
    display_buying_price: Number(row.display_buying_price ?? 0),
    real_buying_price: Number(row.real_buying_price ?? 0),
    min_selling_price: Number(row.min_selling_price ?? 0),
    stock_count: Number(row.stock_count ?? 0),
    image_url: typeof row.image_url === 'string' ? row.image_url : '',
    description: String(row.description ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
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

export async function fetchWatches(): Promise<{ watches: WatchItem[]; source: 'supabase' | 'local' }> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('watches')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        const normalized = data.map((row) => normalizeProduct(row as Record<string, unknown>));
        saveLocalWatches(normalized);
        return { watches: normalized, source: 'supabase' };
      }
    } catch (err) {
      console.warn('Supabase fetch fallback to localStorage:', err);
    }
  }
  return { watches: loadLocalWatches(), source: 'local' };
}

export async function createWatchRecord(
  input: WatchFormInput,
  currentWatches: WatchItem[]
): Promise<WatchItem[]> {
  const newItem: WatchItem = {
    ...input,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `nc-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  const client = getSupabase();
  if (client) {
    try {
      let { data, error } = await client
        .from('watches')
        .insert([input])
        .select()
        .single();
      if (error && 'product_name' in input) {
        const { product_name: _ignored, ...legacyPayload } = input;
        const retry = await client
          .from('watches')
          .insert([legacyPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (!error && data) {
        newItem.id = String(data.id);
        newItem.created_at = String(data.created_at || newItem.created_at);
      }
    } catch (err) {
      console.warn('Supabase insert fallback to localStorage:', err);
    }
  }

  const next = [newItem, ...currentWatches];
  saveLocalWatches(next);
  return next;
}

export async function updateWatchRecord(
  id: string,
  patch: Partial<WatchFormInput>,
  currentWatches: WatchItem[]
): Promise<WatchItem[]> {
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('watches').update(patch).eq('id', id);
      if (error && 'product_name' in patch) {
        const { product_name: _ignored, ...legacyPatch } = patch;
        await client.from('watches').update(legacyPatch).eq('id', id);
      }
    } catch (err) {
      console.warn('Supabase update fallback to localStorage:', err);
    }
  }

  const next = currentWatches.map((w) => (w.id === id ? { ...w, ...patch } : w));
  saveLocalWatches(next);
  return next;
}

export async function deleteWatchRecord(
  id: string,
  currentWatches: WatchItem[]
): Promise<WatchItem[]> {
  const client = getSupabase();
  if (client) {
    try {
      await client.from('watches').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete fallback to localStorage:', err);
    }
  }

  const next = currentWatches.filter((w) => w.id !== id);
  saveLocalWatches(next);
  return next;
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

export async function saveMemoRecord(
  memo: DigitalMemo,
  currentMemos: DigitalMemo[]
): Promise<DigitalMemo[]> {
  const client = getSupabase();
  if (client) {
    try {
      await client.from('sales_memos').insert([
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
      ]);
    } catch (err) {
      console.warn('Supabase memo insert fallback to localStorage:', err);
    }
  }
  const next = [memo, ...currentMemos].slice(0, 50);
  try {
    localStorage.setItem(MEMOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

/**
 * Compress image file to lightweight JPEG data URL for AI vision & local fallback storage
 */
export function compressImageFile(file: File, maxDimension = 900): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
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
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.84);
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
 * otherwise stores compressed Data URL locally so app works 100% offline/locally.
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
      console.warn('Cloudinary upload failed, falling back to local compressed image:', err);
    }
  }

  return {
    imageUrl: compressed.dataUrl,
    base64: compressed.base64,
    mimeType: compressed.mimeType,
    provider: 'local',
  };
}
