import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, ThinkingLevel, Type, type Part } from '@google/genai';
import { getServerConfig } from './src/config/keys.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_DEV_MODE =
  process.env.NODE_ENV !== 'production' &&
  (process.env.NODE_ENV === 'development' ||
    process.env.npm_lifecycle_event === 'dev' ||
    (process.env.K_SERVICE || '').startsWith('ais-dev-') ||
    !fs.existsSync(path.resolve(__dirname, 'dist', 'index.html')));
const PORT = IS_DEV_MODE ? 3000 : Number(process.env.PORT) || 3000;
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

interface StoredPaymentGateway {
  id: 'bkash' | 'nagad' | 'rocket';
  label: string;
  enabled: boolean;
  number: string;
  accountType: 'Personal' | 'Agent' | 'Merchant';
}

interface StoredPaymentSettings {
  gateways: {
    bkash: StoredPaymentGateway;
    nagad: StoredPaymentGateway;
    rocket: StoredPaymentGateway;
  };
  insideCityCharge: number;
  outsideCityCharge: number;
  insideCityLabel: string;
  outsideCityLabel: string;
  requireCodAdvanceDelivery: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  updatedAt: string;
}

interface StoredOrderLineItem {
  watchId: string;
  productName: string;
  brand: string;
  model: string;
  color: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface StoredCustomerOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_zone: 'inside_city' | 'outside_city';
  delivery_charge: number;
  subtotal: number;
  total_amount: number;
  payment_type: 'full_payment' | 'cod_advance';
  payment_gateway: 'bkash' | 'nagad' | 'rocket' | 'cod';
  receiving_number: string;
  sender_number: string;
  trx_id: string;
  paid_amount: number;
  due_amount: number;
  status: 'Pending' | 'Verified' | 'Shipped' | 'Delivered' | 'Rejected';
  items: StoredOrderLineItem[];
  notes: string;
  created_at: string;
}

interface StoredCustomerAccount {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  phone_normalized: string;
  pin_hash: string;
  default_address: string;
  delivery_zone: 'inside_city' | 'outside_city';
  created_at: string;
}

interface StoredCustomerMessage {
  id: string;
  customer_phone_normalized: string;
  customer_name: string;
  order_number: string;
  sender: 'admin' | 'customer';
  body: string;
  read_by_admin: boolean;
  read_by_customer: boolean;
  created_at: string;
}

interface StoredPinResetRequest {
  id: string;
  phone_normalized: string;
  phone: string;
  customer_name: string;
  customer_code: string;
  reset_code: string;
  created_at: string;
  expires_at: string;
}

interface ServerStoreData {
  watches: StoredWatch[];
  memos: StoredMemo[];
  paymentSettings?: StoredPaymentSettings;
  orders?: StoredCustomerOrder[];
  customerAccounts?: StoredCustomerAccount[];
  customerMessages?: StoredCustomerMessage[];
  pinResetRequests?: StoredPinResetRequest[];
}

function normalizePhoneKey(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Normalize Bangladeshi numbers (+88017... / 88017... / 017...) to last 11 digits
  if (digits.length >= 11 && digits.slice(-11).startsWith('01')) {
    return digits.slice(-11);
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `0${digits}`;
  }
  return digits.slice(-15);
}

function hashCustomerPin(pin: string): string {
  const salt = crypto.randomBytes(12).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyCustomerPin(pin: string, storedHash: string): boolean {
  try {
    const parts = String(storedHash || '').split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const [salt, expectedHex] = parts;
    const actualBuf = crypto.scryptSync(pin, salt, 32);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

function createCustomerToken(accountId: string, phoneNormalized: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: accountId,
      phone: phoneNormalized,
      role: 'customer',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(`cust:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyCustomerToken(req: Request): { id: string; phoneNormalized: string } | null {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(`cust:${payload}`)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      decoded?.role !== 'customer' ||
      typeof decoded?.sub !== 'string' ||
      typeof decoded?.phone !== 'string' ||
      typeof decoded?.exp !== 'number' ||
      decoded.exp < Date.now()
    ) {
      return null;
    }
    return { id: decoded.sub, phoneNormalized: decoded.phone };
  } catch {
    return null;
  }
}

function toPublicCustomerAccount(acc: StoredCustomerAccount) {
  return {
    id: acc.id,
    customer_code: acc.customer_code,
    name: acc.name,
    phone: acc.phone,
    phone_normalized: acc.phone_normalized,
    default_address: acc.default_address || '',
    delivery_zone: acc.delivery_zone === 'outside_city' ? 'outside_city' : 'inside_city',
    created_at: acc.created_at,
  };
}

function getDefaultPaymentSettings(): StoredPaymentSettings {
  return {
    gateways: {
      bkash: {
        id: 'bkash',
        label: 'bKash',
        enabled: true,
        number: '01700-000000',
        accountType: 'Personal',
      },
      nagad: {
        id: 'nagad',
        label: 'Nagad',
        enabled: false,
        number: '',
        accountType: 'Personal',
      },
      rocket: {
        id: 'rocket',
        label: 'Rocket',
        enabled: false,
        number: '',
        accountType: 'Personal',
      },
    },
    insideCityCharge: 60,
    outsideCityCharge: 120,
    insideCityLabel: 'Inside City',
    outsideCityLabel: 'Outside City',
    requireCodAdvanceDelivery: true,
    telegramBotToken: '',
    telegramChatId: '',
    updatedAt: new Date().toISOString(),
  };
}

function sanitizePaymentSettings(
  raw: Record<string, unknown> | undefined,
  existing?: StoredPaymentSettings
): StoredPaymentSettings {
  const base = existing || getDefaultPaymentSettings();
  const rawGateways = (raw?.gateways && typeof raw.gateways === 'object'
    ? raw.gateways
    : {}) as Record<string, Record<string, unknown> | undefined>;

  const sanitizeGateway = (
    id: 'bkash' | 'nagad' | 'rocket',
    label: string
  ): StoredPaymentGateway => {
    const g = rawGateways[id];
    const prev = base.gateways[id];
    const acct = g?.accountType;
    const validAcct: 'Personal' | 'Agent' | 'Merchant' =
      acct === 'Personal' || acct === 'Agent' || acct === 'Merchant'
        ? acct
        : prev.accountType;
    return {
      id,
      label,
      enabled: typeof g?.enabled === 'boolean' ? g.enabled : prev.enabled,
      number:
        typeof g?.number === 'string'
          ? g.number.trim().slice(0, 32)
          : prev.number,
      accountType: validAcct,
    };
  };

  const toCharge = (val: unknown, fallback: number) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.min(50000, Math.round(n)) : fallback;
  };

  return {
    gateways: {
      bkash: sanitizeGateway('bkash', 'bKash'),
      nagad: sanitizeGateway('nagad', 'Nagad'),
      rocket: sanitizeGateway('rocket', 'Rocket'),
    },
    insideCityCharge: toCharge(raw?.insideCityCharge, base.insideCityCharge),
    outsideCityCharge: toCharge(raw?.outsideCityCharge, base.outsideCityCharge),
    insideCityLabel:
      typeof raw?.insideCityLabel === 'string' && raw.insideCityLabel.trim()
        ? raw.insideCityLabel.trim().slice(0, 48)
        : base.insideCityLabel,
    outsideCityLabel:
      typeof raw?.outsideCityLabel === 'string' && raw.outsideCityLabel.trim()
        ? raw.outsideCityLabel.trim().slice(0, 48)
        : base.outsideCityLabel,
    requireCodAdvanceDelivery:
      typeof raw?.requireCodAdvanceDelivery === 'boolean'
        ? raw.requireCodAdvanceDelivery
        : base.requireCodAdvanceDelivery,
    telegramBotToken:
      typeof raw?.telegramBotToken === 'string'
        ? raw.telegramBotToken.trim().slice(0, 180)
        : base.telegramBotToken,
    telegramChatId:
      typeof raw?.telegramChatId === 'string'
        ? raw.telegramChatId.trim().slice(0, 80)
        : base.telegramChatId,
    updatedAt: new Date().toISOString(),
  };
}

function toPublicPaymentSettings(settings: StoredPaymentSettings): StoredPaymentSettings {
  return {
    ...settings,
    telegramBotToken: '',
    telegramChatId: '',
  };
}

function escapeTelegramHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  htmlMessage: string
): Promise<{ sent: boolean; error?: string }> {
  const token = botToken.trim();
  const chat = chatId.trim();
  if (!token || !chat) {
    return { sent: false, error: 'Telegram Bot Token or Chat ID is not configured.' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: htmlMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || !json.ok) {
      return {
        sent: false,
        error: json.description || `Telegram API returned HTTP ${res.status}`,
      };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : 'Failed to reach Telegram API',
    };
  }
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
        paymentSettings: parsed?.paymentSettings
          ? sanitizePaymentSettings(parsed.paymentSettings as Record<string, unknown>)
          : getDefaultPaymentSettings(),
        orders: Array.isArray(parsed?.orders) ? parsed.orders : [],
        customerAccounts: Array.isArray(parsed?.customerAccounts) ? parsed.customerAccounts : [],
        customerMessages: Array.isArray(parsed?.customerMessages) ? parsed.customerMessages : [],
        pinResetRequests: Array.isArray(parsed?.pinResetRequests) ? parsed.pinResetRequests : [],
      };
      return storeCache;
    }
  } catch (err) {
    console.warn('Unable to read .data/store.json, starting empty:', err);
  }
  storeCache = {
    watches: [],
    memos: [],
    paymentSettings: getDefaultPaymentSettings(),
    orders: [],
    customerAccounts: [],
    customerMessages: [],
    pinResetRequests: [],
  };
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
      String(
        raw.category ?? raw.strap_type ?? existing?.category ?? 'Gadgets & Accessories'
      )
        .trim()
        .slice(0, 80) || 'Gadgets & Accessories',
    connectivity:
      String(raw.connectivity ?? raw.movement ?? existing?.connectivity ?? 'Standard')
        .trim()
        .slice(0, 100) || 'Standard',
    capacity_spec:
      String(raw.capacity_spec ?? raw.case_size ?? existing?.capacity_spec ?? 'Standard')
        .trim()
        .slice(0, 100) || 'Standard',
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

function buildSupabaseLegacyWatchInsert(w: StoredWatch) {
  return {
    brand: w.brand,
    model: w.model,
    color: w.color,
    strap_type: w.category,
    movement: w.connectivity,
    case_size: w.capacity_spec,
    display_buying_price: w.display_buying_price,
    real_buying_price: w.real_buying_price,
    min_selling_price: w.min_selling_price,
    stock_count: w.stock_count,
    image_url: w.image_url || '',
    description: w.description || '',
  };
}

function isMissingColumnError(msg: string | undefined): boolean {
  if (!msg) return false;
  return (
    msg.includes('product_name') ||
    msg.includes('capacity_spec') ||
    msg.includes('connectivity') ||
    msg.includes('category')
  );
}

function createGeminiClient(timeoutMs = 18000): GoogleGenAI {
  const { GEMINI_API_KEY } = getServerConfig();
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Gemini AI is not configured yet. Please add your GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      timeout: timeoutMs,
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

function extractHttpStatus(err: unknown): number {
  const status = Number((err as { status?: unknown })?.status);
  if (Number.isInteger(status) && status >= 400 && status < 600) return status;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (msg.includes('AI_TIMEOUT')) return 504;
  if (msg.includes('"code":429') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
  if (msg.includes('"code":403') || msg.includes('PERMISSION_DENIED')) return 403;
  if (msg.includes('"code":400') || msg.includes('API_KEY_INVALID')) return 400;
  return 500;
}

function withHardTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI_TIMEOUT_${ms}MS`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function generateWithFallbackModel(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
  timeoutMs = 9500
) {
  // Prioritize gemini-3.1-flash-lite (native ThinkingLevel.MINIMAL, ~1-2s latency),
  // fall back to gemini-4-hydrogen (ThinkingLevel.LOW), then one fast retry on flash-lite.
  const attempts: Array<{ model: string; timeout: number }> = [
    { model: 'gemini-3.1-flash-lite', timeout: timeoutMs },
    { model: 'gemini-4-hydrogen', timeout: Math.max(10500, timeoutMs) },
    { model: 'gemini-3.1-flash-lite', timeout: 7500 },
  ];
  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const { model, timeout: perModelTimeout } = attempts[i];
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    const { thinkingConfig: existingThinking, ...baseConfig } = params.config ?? {};
    const mergedConfig =
      model === 'gemini-3.1-flash-lite'
        ? {
            ...baseConfig,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          }
        : {
            ...baseConfig,
            // gemini-4-hydrogen supports LOW/MEDIUM/HIGH/XHIGH (MINIMAL returns 400)
            thinkingConfig:
              existingThinking && existingThinking.thinkingLevel !== ThinkingLevel.MINIMAL
                ? existingThinking
                : { thinkingLevel: ThinkingLevel.LOW },
          };
    try {
      return await withHardTimeout(
        ai.models.generateContent({
          model,
          ...params,
          config: mergedConfig,
        }),
        perModelTimeout
      );
    } catch (err) {
      lastError = err;
      const code = extractHttpStatus(err);
      const msg = err instanceof Error ? err.message : String(err ?? '');
      console.warn(`[Gemini] Attempt ${i + 1} (${model}) failed (status=${code}): ${msg.slice(0, 180)}`);
      if (code !== 400 && code !== 429 && code !== 404 && code !== 503 && code !== 504) {
        throw err;
      }
    }
  }
  throw lastError;
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

  // Cloudinary 25GB Cloud Media Status & Server-Side Signed/Unsigned Upload
  const optimizeCloudinaryUrl = (secureUrl: string): string => {
    if (!secureUrl || !secureUrl.includes('/image/upload/')) return secureUrl;
    if (secureUrl.includes('/image/upload/f_auto')) return secureUrl;
    return secureUrl.replace('/image/upload/', '/image/upload/f_auto,q_auto:good,w_900,c_limit/');
  };

  let cachedCloudUsage: { fetchedAt: number; data: Record<string, unknown> | null } = {
    fetchedAt: 0,
    data: null,
  };

  app.get('/api/cloudinary/status', async (req: Request, res: Response) => {
    const cfg = getServerConfig();
    const hasSigned = Boolean(
      cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_API_KEY && cfg.CLOUDINARY_API_SECRET
    );
    const hasUnsigned = Boolean(cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_UPLOAD_PRESET);
    const mode = hasSigned ? 'signed' : hasUnsigned ? 'unsigned' : 'unconfigured';

    let usage: Record<string, unknown> | null = null;
    if (hasSigned) {
      const forceRefresh = req.query.refresh === '1';
      if (!forceRefresh && cachedCloudUsage.data && Date.now() - cachedCloudUsage.fetchedAt < 60_000) {
        usage = cachedCloudUsage.data;
      } else {
        try {
          const auth = Buffer.from(`${cfg.CLOUDINARY_API_KEY}:${cfg.CLOUDINARY_API_SECRET}`).toString('base64');
          const usageRes = await fetch(
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.CLOUDINARY_CLOUD_NAME)}/usage`,
            { headers: { Authorization: `Basic ${auth}` } }
          );
          if (usageRes.ok) {
            const raw = (await usageRes.json()) as {
              plan?: string;
              credits?: { usage?: number; limit?: number; used_percent?: number };
              storage?: { usage?: number; credits_usage?: number };
              bandwidth?: { usage?: number; credits_usage?: number };
              resources?: number;
              objects?: { usage?: number };
            };
            const storageBytes = Number(raw.storage?.usage) || 0;
            const bandwidthBytes = Number(raw.bandwidth?.usage) || 0;
            const creditsLimit = Number(raw.credits?.limit) || 25;
            const creditsUsed = Number(raw.credits?.usage) || 0;
            usage = {
              plan: raw.plan || 'Free',
              creditsUsed: Math.round(creditsUsed * 1000) / 1000,
              creditsLimit,
              usedPercent: Number(raw.credits?.used_percent) || 0,
              storageBytes,
              storageMB: Math.round((storageBytes / (1024 * 1024)) * 100) / 100,
              maxStorageGB: creditsLimit, // 1 credit = 1 GB managed storage on Cloudinary Free/Plus
              bandwidthMB: Math.round((bandwidthBytes / (1024 * 1024)) * 100) / 100,
              resources: Number(raw.resources ?? raw.objects?.usage ?? 0),
            };
            cachedCloudUsage = { fetchedAt: Date.now(), data: usage };
          }
        } catch {
          usage = cachedCloudUsage.data;
        }
      }
    }

    return res.json({
      ok: true,
      configured: hasSigned || hasUnsigned,
      mode,
      cloudName: cfg.CLOUDINARY_CLOUD_NAME || 'zxamensn',
      folder: 'new-chiko-watch',
      hasApiKey: Boolean(cfg.CLOUDINARY_API_KEY),
      hasUploadPreset: Boolean(cfg.CLOUDINARY_UPLOAD_PRESET),
      usage,
    });
  });

  app.post('/api/cloudinary/upload', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin login required to upload media.' });
    }

    const { imageDataUrl, folder } = (req.body ?? {}) as {
      imageDataUrl?: string;
      folder?: string;
    };
    if (
      typeof imageDataUrl !== 'string' ||
      (!imageDataUrl.startsWith('data:image/') && !/^https?:\/\//i.test(imageDataUrl))
    ) {
      return res.status(400).json({ ok: false, error: 'Valid image data URL is required.' });
    }

    const cfg = getServerConfig();
    const cloudName = cfg.CLOUDINARY_CLOUD_NAME;
    const targetFolder =
      typeof folder === 'string' && /^[a-zA-Z0-9_/-]{1,64}$/.test(folder.trim())
        ? folder.trim()
        : 'new-chiko-watch';
    const hasSigned = Boolean(cloudName && cfg.CLOUDINARY_API_KEY && cfg.CLOUDINARY_API_SECRET);
    const hasUnsigned = Boolean(cloudName && cfg.CLOUDINARY_UPLOAD_PRESET);

    if (!hasSigned && !hasUnsigned) {
      return res.status(503).json({
        ok: false,
        configured: false,
        error:
          'Cloudinary credentials not configured yet. Add CLOUDINARY_URL (or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET or CLOUDINARY_UPLOAD_PRESET) in Settings > Secrets.',
      });
    }

    try {
      const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
      const bodyParams = new URLSearchParams();
      bodyParams.append('file', imageDataUrl);

      if (hasSigned) {
        const timestamp = Math.floor(Date.now() / 1000);
        const paramsToSign = `folder=${targetFolder}&timestamp=${timestamp}`;
        const signature = crypto
          .createHash('sha1')
          .update(`${paramsToSign}${cfg.CLOUDINARY_API_SECRET}`)
          .digest('hex');
        bodyParams.append('api_key', cfg.CLOUDINARY_API_KEY);
        bodyParams.append('timestamp', String(timestamp));
        bodyParams.append('folder', targetFolder);
        bodyParams.append('signature', signature);
      } else {
        bodyParams.append('upload_preset', cfg.CLOUDINARY_UPLOAD_PRESET);
        bodyParams.append('folder', targetFolder);
      }

      const uploadRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
      });
      const json = (await uploadRes.json().catch(() => ({}))) as {
        secure_url?: string;
        public_id?: string;
        bytes?: number;
        width?: number;
        height?: number;
        format?: string;
        error?: { message?: string };
      };

      if (!uploadRes.ok || !json.secure_url) {
        const rawErr = json.error?.message || '';
        const friendlyErr = /whitelisted for unsigned/i.test(rawErr)
          ? 'Your Cloudinary preset is currently in Signed mode. Either add CLOUDINARY_URL in Settings → Secrets for automatic Signed uploads (recommended), OR open Cloudinary Dashboard → Settings → Upload → Upload Presets and switch that preset to "Unsigned".'
          : rawErr || 'Cloudinary rejected the upload. Check your Cloudinary Secrets.';
        return res.status(uploadRes.status >= 400 ? uploadRes.status : 502).json({
          ok: false,
          configured: true,
          error: friendlyErr,
        });
      }

      return res.json({
        ok: true,
        provider: 'cloudinary',
        mode: hasSigned ? 'signed' : 'unsigned',
        imageUrl: optimizeCloudinaryUrl(json.secure_url),
        rawUrl: json.secure_url,
        publicId: json.public_id || '',
        bytes: json.bytes || 0,
        format: json.format || 'jpg',
      });
    } catch (err) {
      console.error('Cloudinary server upload error:', err);
      return res.status(502).json({
        ok: false,
        configured: true,
        error: 'Could not reach Cloudinary right now. Please try again.',
      });
    }
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
        const { product_name: _ignored, ...noNamePayload } = payload;
        const retry = await supabase
          .from('watches')
          .insert([noNamePayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error && isMissingColumnError(error.message)) {
        const legacyPayload = buildSupabaseLegacyWatchInsert(watch);
        const retryLegacy = await supabase
          .from('watches')
          .insert([legacyPayload])
          .select()
          .single();
        data = retryLegacy.data;
        error = retryLegacy.error;
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
      const sanitizedList: StoredWatch[] = [];
      for (const raw of incoming) {
        if (!raw || typeof raw !== 'object') continue;
        const sanitized = sanitizeStoredWatch(raw as Record<string, unknown>);
        const key = `${sanitized.brand}::${sanitized.model}::${sanitized.created_at}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          sanitizedList.push(sanitized);
        }
      }
      if (sanitizedList.length > 0) {
        const toInsert = sanitizedList.map(buildSupabaseWatchInsert);
        let { error: insertErr } = await supabase.from('watches').insert(toInsert);
        if (insertErr && isMissingColumnError(insertErr.message)) {
          const legacyInsert = sanitizedList.map(buildSupabaseLegacyWatchInsert);
          const retry = await supabase.from('watches').insert(legacyInsert);
          insertErr = retry.error;
        }
        if (insertErr) {
          return res.status(502).json({
            ok: false,
            error: `Supabase sync insert failed: ${insertErr.message}`,
          });
        }
      }
      return res.json({ ok: true, source: 'supabase', added: sanitizedList.length });
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
        const { product_name: _ignored, ...noNamePatch } = allowedPatch;
        const retry = await supabase
          .from('watches')
          .update(noNamePatch)
          .eq('id', id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error && isMissingColumnError(error.message)) {
        const legacyPatch: Record<string, unknown> = { ...allowedPatch };
        delete legacyPatch.product_name;
        if ('category' in legacyPatch) {
          legacyPatch.strap_type = legacyPatch.category;
          delete legacyPatch.category;
        }
        if ('connectivity' in legacyPatch) {
          legacyPatch.movement = legacyPatch.connectivity;
          delete legacyPatch.connectivity;
        }
        if ('capacity_spec' in legacyPatch) {
          legacyPatch.case_size = legacyPatch.capacity_spec;
          delete legacyPatch.capacity_spec;
        }
        const retryLegacy = await supabase
          .from('watches')
          .update(legacyPatch)
          .eq('id', id)
          .select()
          .single();
        data = retryLegacy.data;
        error = retryLegacy.error;
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
      return res.status(401).json({ ok: false, error: 'Staff login required to view sales memos.' });
    }
    const supabase = getServerSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('sales_memos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        return res.status(502).json({
          ok: false,
          source: 'supabase',
          error: `Supabase memos query failed: ${error.message}`,
        });
      }
      return res.json({ ok: true, source: 'supabase', memos: Array.isArray(data) ? data : [] });
    }
    const store = readServerStore();
    return res.json({ ok: true, source: 'server', memos: store.memos });
  });

  app.post('/api/memos', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required to create sales memos.' });
    }
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
      if (error || !data) {
        return res.status(502).json({
          ok: false,
          source: 'supabase',
          error: `Failed to save memo to Supabase: ${error?.message || 'Unknown error'}`,
        });
      }
      return res.status(201).json({ ok: true, source: 'supabase', memo: data });
    }

    const store = readServerStore();
    const nextMemos = [memo, ...store.memos.filter((m) => m.id !== memo.id)].slice(0, 100);
    writeServerStore({ ...store, memos: nextMemos });
    return res.status(201).json({ ok: true, source: 'server', memo, memos: nextMemos });
  });

  app.delete('/api/memos/:id', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required to delete sales memos.' });
    }
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: 'Memo ID is required.' });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const supabase = getServerSupabase();
    if (supabase) {
      if (isUuid) {
        const { error } = await supabase.from('sales_memos').delete().eq('id', id);
        if (error) {
          return res.status(502).json({
            ok: false,
            source: 'supabase',
            error: `Failed to delete memo from Supabase: ${error.message}`,
          });
        }
      }
      return res.json({ ok: true, source: 'supabase' });
    }

    const store = readServerStore();
    const nextMemos = store.memos.filter((m) => m.id !== id);
    writeServerStore({ ...store, memos: nextMemos });
    return res.json({ ok: true, source: 'server', memos: nextMemos });
  });

  // =========================================================================
  // E-Commerce Payment Settings, Customer Orders & Instant Telegram Alerts
  // =========================================================================

  async function loadActivePaymentSettings(): Promise<{
    settings: StoredPaymentSettings;
    source: 'supabase' | 'server';
  }> {
    const store = readServerStore();
    const fallback = store.paymentSettings || getDefaultPaymentSettings();
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('store_settings')
          .select('config, updated_at')
          .eq('id', 'default')
          .maybeSingle();
        if (!error && data?.config && typeof data.config === 'object') {
          const sanitized = sanitizePaymentSettings(
            data.config as Record<string, unknown>,
            fallback
          );
          if (typeof data.updated_at === 'string') {
            sanitized.updatedAt = data.updated_at;
          }
          writeServerStore({ ...store, paymentSettings: sanitized });
          return { settings: sanitized, source: 'supabase' };
        }
      } catch {
        // Table not yet created in Supabase; safely use server store
      }
    }
    return { settings: fallback, source: 'server' };
  }

  app.get('/api/store-settings', async (req: Request, res: Response) => {
    const isAdmin = Boolean(verifyAdminToken(req));
    const { settings, source } = await loadActivePaymentSettings();
    return res.json({
      ok: true,
      source,
      settings: isAdmin ? settings : toPublicPaymentSettings(settings),
    });
  });

  app.put('/api/store-settings', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required to update settings.' });
    }
    const { settings: current } = await loadActivePaymentSettings();
    const nextSettings = sanitizePaymentSettings(
      (req.body ?? {}) as Record<string, unknown>,
      current
    );

    const store = readServerStore();
    writeServerStore({ ...store, paymentSettings: nextSettings });

    let source: 'supabase' | 'server' = 'server';
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('store_settings').upsert(
          [
            {
              id: 'default',
              config: nextSettings,
              updated_at: nextSettings.updatedAt,
            },
          ],
          { onConflict: 'id' }
        );
        if (!error) {
          source = 'supabase';
        }
      } catch {
        // Fallback already saved in .data/store.json
      }
    }

    return res.json({ ok: true, source, settings: nextSettings });
  });

  app.post('/api/store-settings/test-telegram', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required.' });
    }
    const { settings } = await loadActivePaymentSettings();
    const token =
      typeof req.body?.telegramBotToken === 'string' && req.body.telegramBotToken.trim()
        ? req.body.telegramBotToken.trim()
        : settings.telegramBotToken;
    const chatId =
      typeof req.body?.telegramChatId === 'string' && req.body.telegramChatId.trim()
        ? req.body.telegramChatId.trim()
        : settings.telegramChatId;

    const testHtml = [
      '<b>✅ New Chiko Watch — Telegram Order Alerts Active!</b>',
      '',
      'Your store is connected. New customer orders with bKash TrxID &amp; COD advance payments will appear here instantly.',
      `<i>Tested at ${escapeTelegramHtml(new Date().toLocaleString())}</i>`,
    ].join('\n');

    const result = await sendTelegramMessage(token, chatId, testHtml);
    if (!result.sent) {
      return res.status(400).json({ ok: false, error: result.error || 'Telegram test failed.' });
    }
    return res.json({ ok: true });
  });

  app.get('/api/orders', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required to view orders.' });
    }

    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('customer_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (!error && Array.isArray(data)) {
          const orders = data.map((row) => ({
            ...(row as unknown as StoredCustomerOrder),
            items: Array.isArray((row as Record<string, unknown>).items)
              ? ((row as Record<string, unknown>).items as StoredOrderLineItem[])
              : [],
          }));
          return res.json({ ok: true, source: 'supabase', orders });
        }
      } catch {
        // Fall through to local server store
      }
    }

    const store = readServerStore();
    return res.json({ ok: true, source: 'server', orders: store.orders || [] });
  });

  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      // Strictly require a verified Customer Account before accepting any order
      const customerAuth = verifyCustomerToken(req);
      if (!customerAuth) {
        return res.status(401).json({
          ok: false,
          code: 'ACCOUNT_REQUIRED',
          error: 'Order place korar age apnar Customer Account create ba Sign In korun.',
        });
      }
      const verifiedAccount = await findCustomerAccountByPhone(customerAuth.phoneNormalized);
      if (!verifiedAccount) {
        return res.status(401).json({
          ok: false,
          code: 'ACCOUNT_REQUIRED',
          error: 'Customer account pawa jayni. Doya kore abar Sign In ba Account create korun.',
        });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const customerName =
        String(body.customer_name ?? verifiedAccount.name ?? '').trim().slice(0, 120) ||
        verifiedAccount.name;
      // Bind phone to the verified customer account so order history & status updates always stay synced
      const customerPhone = verifiedAccount.phone;
      const deliveryAddress = String(body.delivery_address ?? '').trim().slice(0, 500);
      const deliveryZone: 'inside_city' | 'outside_city' =
        body.delivery_zone === 'outside_city' ? 'outside_city' : 'inside_city';
      const paymentType: 'full_payment' | 'cod_advance' =
        body.payment_type === 'cod_advance' ? 'cod_advance' : 'full_payment';

      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (!customerName || !customerPhone || !deliveryAddress) {
        return res.status(400).json({
          ok: false,
          error: 'Please enter your Name and Full Delivery Address.',
        });
      }
      if (rawItems.length === 0) {
        return res.status(400).json({ ok: false, error: 'Your cart is empty.' });
      }

      const items: StoredOrderLineItem[] = rawItems.slice(0, 40).map((it) => {
        const row = (it ?? {}) as Record<string, unknown>;
        const qty = Math.max(1, Math.min(99, Math.round(Number(row.quantity) || 1)));
        const unitPrice = Math.max(0, Math.round((Number(row.unitPrice) || 0) * 100) / 100);
        return {
          watchId: String(row.watchId ?? '').slice(0, 128),
          productName: String(row.productName ?? row.model ?? 'Product').trim().slice(0, 160),
          brand: String(row.brand ?? 'New Chiko').trim().slice(0, 80),
          model: String(row.model ?? '').trim().slice(0, 120),
          color: String(row.color ?? '').trim().slice(0, 80),
          imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl.slice(0, 800000) : '',
          quantity: qty,
          unitPrice,
          lineTotal: Math.round(unitPrice * qty * 100) / 100,
        };
      });

      const { settings } = await loadActivePaymentSettings();
      const deliveryCharge =
        deliveryZone === 'outside_city' ? settings.outsideCityCharge : settings.insideCityCharge;
      const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
      const totalAmount = Math.round((subtotal + deliveryCharge) * 100) / 100;

      const needsAdvancePayment =
        paymentType === 'full_payment' || settings.requireCodAdvanceDelivery;

      const requestedGw = String(body.payment_gateway ?? 'bkash');
      const gatewayKey: 'bkash' | 'nagad' | 'rocket' =
        requestedGw === 'nagad' || requestedGw === 'rocket' ? requestedGw : 'bkash';
      const activeGw = settings.gateways[gatewayKey];

      const senderNumber = String(body.sender_number ?? '').trim().slice(0, 32);
      const trxId = String(body.trx_id ?? '').trim().toUpperCase().slice(0, 64);

      if (needsAdvancePayment) {
        if (!senderNumber || senderNumber.length < 6) {
          return res.status(400).json({
            ok: false,
            error: `Please enter your sender ${activeGw.label} number.`,
          });
        }
        if (!trxId || trxId.length < 4) {
          return res.status(400).json({
            ok: false,
            error: `Please enter a valid ${activeGw.label} Transaction ID (TrxID).`,
          });
        }
      }

      const paidAmount =
        paymentType === 'full_payment'
          ? totalAmount
          : settings.requireCodAdvanceDelivery
          ? deliveryCharge
          : 0;
      const dueAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

      const now = new Date();
      const orderNum = `NCW-${String(now.getFullYear()).slice(-2)}${String(
        now.getMonth() + 1
      ).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const orderRecord: StoredCustomerOrder = {
        id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        order_number: orderNum,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        delivery_zone: deliveryZone,
        delivery_charge: deliveryCharge,
        subtotal,
        total_amount: totalAmount,
        payment_type: paymentType,
        payment_gateway: needsAdvancePayment ? gatewayKey : 'cod',
        receiving_number: needsAdvancePayment ? activeGw.number : '',
        sender_number: needsAdvancePayment ? senderNumber : '',
        trx_id: needsAdvancePayment ? trxId : '',
        paid_amount: paidAmount,
        due_amount: dueAmount,
        status: 'Pending',
        items,
        notes: String(body.notes ?? '').trim().slice(0, 300),
        created_at: now.toISOString(),
      };

      let savedOrder = orderRecord;
      let source: 'supabase' | 'server' = 'server';

      const supabase = getServerSupabase();
      if (supabase) {
        try {
          const { id: _localId, ...insertPayload } = orderRecord;
          const { data, error } = await supabase
            .from('customer_orders')
            .insert([insertPayload])
            .select()
            .single();
          if (!error && data) {
            savedOrder = {
              ...(data as unknown as StoredCustomerOrder),
              items: Array.isArray((data as Record<string, unknown>).items)
                ? ((data as Record<string, unknown>).items as StoredOrderLineItem[])
                : orderRecord.items,
            };
            source = 'supabase';
          }
        } catch {
          // Fall back to server store below
        }
      }

      if (source !== 'supabase') {
        const store = readServerStore();
        const nextOrders = [savedOrder, ...(store.orders || [])].slice(0, 300);
        writeServerStore({ ...store, orders: nextOrders });
      }

      // Immediately dispatch formatted Telegram Bot alert if configured
      let telegramSent = false;
      if (settings.telegramBotToken && settings.telegramChatId) {
        const paymentBadge =
          savedOrder.payment_type === 'full_payment'
            ? `FULL PAID (${activeGw.label})`
            : settings.requireCodAdvanceDelivery
            ? `COD - DELIVERY ADVANCE PAID (${activeGw.label})`
            : 'CASH ON DELIVERY';

        const zoneLabel =
          savedOrder.delivery_zone === 'outside_city'
            ? settings.outsideCityLabel
            : settings.insideCityLabel;

        const itemsLines = savedOrder.items
          .map(
            (i, idx) =>
              `${idx + 1}. ${escapeTelegramHtml(i.productName)} (${escapeTelegramHtml(
                i.brand
              )}) × ${i.quantity} — ৳${i.lineTotal.toLocaleString('en-BD')}`
          )
          .join('\n');

        const tgHtml = [
          `<b>🛍️ NEW ORDER — ${escapeTelegramHtml(savedOrder.order_number)}</b>`,
          `<b>Payment:</b> ${escapeTelegramHtml(paymentBadge)}`,
          '',
          `<b>👤 Customer:</b> ${escapeTelegramHtml(savedOrder.customer_name)} (<code>${escapeTelegramHtml(
            verifiedAccount.customer_code
          )}</code>)`,
          `<b>📞 Phone:</b> ${escapeTelegramHtml(savedOrder.customer_phone)}`,
          `<b>📍 Address:</b> ${escapeTelegramHtml(savedOrder.delivery_address)} (${escapeTelegramHtml(
            zoneLabel
          )})`,
          '',
          `<b>📦 Items:</b>`,
          itemsLines,
          '',
          `<b>💵 Subtotal:</b> ৳${savedOrder.subtotal.toLocaleString('en-BD')}`,
          `<b>🚚 Delivery:</b> ৳${savedOrder.delivery_charge.toLocaleString('en-BD')}`,
          `<b>✅ Paid Now:</b> ৳${savedOrder.paid_amount.toLocaleString('en-BD')}`,
          `<b>⏳ Due on Delivery:</b> ৳${savedOrder.due_amount.toLocaleString('en-BD')}`,
          savedOrder.trx_id
            ? `<b>🧾 ${escapeTelegramHtml(activeGw.label)} TrxID:</b> <code>${escapeTelegramHtml(
                savedOrder.trx_id
              )}</code>\n<b>📲 Sender:</b> ${escapeTelegramHtml(savedOrder.sender_number)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

        const tgResult = await sendTelegramMessage(
          settings.telegramBotToken,
          settings.telegramChatId,
          tgHtml
        );
        telegramSent = tgResult.sent;
      }

      return res.status(201).json({
        ok: true,
        source,
        order: savedOrder,
        telegramSent,
      });
    } catch (err) {
      console.error('Order submission error:', err);
      return res.status(500).json({
        ok: false,
        error: 'Unable to submit your order right now. Please try again.',
      });
    }
  });

  async function appendCustomerMessage(input: {
    customer_phone_normalized: string;
    customer_name: string;
    order_number?: string;
    sender: 'admin' | 'customer';
    body: string;
  }): Promise<StoredCustomerMessage> {
    const record: StoredCustomerMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customer_phone_normalized: input.customer_phone_normalized,
      customer_name: input.customer_name.slice(0, 120),
      order_number: (input.order_number || '').slice(0, 64),
      sender: input.sender,
      body: input.body.trim().slice(0, 1000),
      read_by_admin: input.sender === 'admin',
      read_by_customer: input.sender === 'customer',
      created_at: new Date().toISOString(),
    };

    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { id: _localId, ...insertPayload } = record;
        const { data, error } = await supabase
          .from('customer_messages')
          .insert([insertPayload])
          .select()
          .single();
        if (!error && data) {
          return data as unknown as StoredCustomerMessage;
        }
      } catch {
        // Fallback to server store below
      }
    }

    const store = readServerStore();
    const nextMessages = [record, ...(store.customerMessages || [])].slice(0, 1000);
    writeServerStore({ ...store, customerMessages: nextMessages });
    return record;
  }

  async function loadAllOrdersForLookup(): Promise<StoredCustomerOrder[]> {
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('customer_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300);
        if (!error && Array.isArray(data)) {
          return data.map((row) => ({
            ...(row as unknown as StoredCustomerOrder),
            items: Array.isArray((row as Record<string, unknown>).items)
              ? ((row as Record<string, unknown>).items as StoredOrderLineItem[])
              : [],
          }));
        }
      } catch {
        // Fall through to local store
      }
    }
    return readServerStore().orders || [];
  }

  async function loadAllCustomerMessages(): Promise<StoredCustomerMessage[]> {
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('customer_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(600);
        if (!error && Array.isArray(data)) {
          return data as unknown as StoredCustomerMessage[];
        }
      } catch {
        // Fall through to local store
      }
    }
    const list = readServerStore().customerMessages || [];
    return [...list].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  }

  async function findCustomerAccountByPhone(
    phoneNormalized: string
  ): Promise<StoredCustomerAccount | null> {
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('phone_normalized', phoneNormalized)
          .maybeSingle();
        if (!error && data) {
          return data as unknown as StoredCustomerAccount;
        }
      } catch {
        // Fall through
      }
    }
    const local = (readServerStore().customerAccounts || []).find(
      (a) => a.phone_normalized === phoneNormalized
    );
    return local || null;
  }

  async function handleOrderStatusUpdate(req: Request, res: Response) {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required.' });
    }
    const id = req.params.id;
    const status = req.body?.status;
    const noteProvided = typeof req.body?.notes === 'string';
    const nextNote = noteProvided ? String(req.body.notes).trim().slice(0, 300) : undefined;
    if (
      status !== 'Pending' &&
      status !== 'Verified' &&
      status !== 'Shipped' &&
      status !== 'Delivered' &&
      status !== 'Rejected'
    ) {
      return res.status(400).json({ ok: false, error: 'Invalid order status.' });
    }

    const updatePayload: Record<string, unknown> = { status };
    if (noteProvided) {
      updatePayload.notes = nextNote;
    }

    let updatedOrder: StoredCustomerOrder | null = null;
    let source: 'supabase' | 'server' = 'server';

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const supabase = getServerSupabase();
    if (supabase && isUuid) {
      try {
        const { data, error } = await supabase
          .from('customer_orders')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) {
          updatedOrder = {
            ...(data as unknown as StoredCustomerOrder),
            items: Array.isArray((data as Record<string, unknown>).items)
              ? ((data as Record<string, unknown>).items as StoredOrderLineItem[])
              : [],
          };
          source = 'supabase';
        } else if (error) {
          return res.status(502).json({
            ok: false,
            error: `Supabase order update failed: ${error.message}`,
          });
        }
      } catch (err) {
        return res.status(502).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Supabase order update failed.',
        });
      }
    }

    if (!updatedOrder) {
      const store = readServerStore();
      const nextOrders = (store.orders || []).map((o) => {
        if (o.id === id) {
          updatedOrder = {
            ...o,
            status,
            ...(noteProvided ? { notes: nextNote || '' } : {}),
          };
          return updatedOrder;
        }
        return o;
      });
      if (!updatedOrder) {
        return res.status(404).json({ ok: false, error: 'Order not found.' });
      }
      writeServerStore({ ...store, orders: nextOrders });
    }

    // Automatically post a clean status notification to the customer's Account Inbox
    const phoneKey = normalizePhoneKey(updatedOrder.customer_phone);
    if (phoneKey && status !== 'Pending') {
      let autoText = '';
      if (status === 'Verified') {
        autoText = `✅ Order ${updatedOrder.order_number} has been ACCEPTED! Your payment is verified and we are preparing your parcel.`;
      } else if (status === 'Rejected') {
        const reasonDetail = nextNote ? ` (${nextNote})` : '';
        autoText = `❌ Order ${updatedOrder.order_number} was REJECTED${reasonDetail}. Please reply here if you need help or submitted the wrong TrxID.`;
      } else if (status === 'Shipped') {
        autoText = `🚚 Order ${updatedOrder.order_number} has been SHIPPED! Due on delivery: ৳${Number(
          updatedOrder.due_amount || 0
        ).toLocaleString('en-BD')}.`;
      } else if (status === 'Delivered') {
        autoText = `🎉 Order ${updatedOrder.order_number} has been DELIVERED. Thank you for shopping with New Chiko Watch & Electronics!`;
      }
      if (autoText) {
        await appendCustomerMessage({
          customer_phone_normalized: phoneKey,
          customer_name: updatedOrder.customer_name,
          order_number: updatedOrder.order_number,
          sender: 'admin',
          body: autoText,
        });
      }
    }

    return res.json({ ok: true, source, order: updatedOrder });
  }

  app.patch('/api/orders/:id/status', handleOrderStatusUpdate);
  app.post('/api/orders/:id/status', handleOrderStatusUpdate);

  // =========================================================================
  // Customer Accounts (ID System), Order History & Two-Way Messaging
  // =========================================================================

  app.post('/api/customer/register', async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.name ?? '').trim().slice(0, 120);
      const phoneRaw = String(req.body?.phone ?? '').trim().slice(0, 32);
      const pin = String(req.body?.pin ?? '').trim();
      const defaultAddress = String(req.body?.default_address ?? '').trim().slice(0, 500);
      const deliveryZone: 'inside_city' | 'outside_city' =
        req.body?.delivery_zone === 'outside_city' ? 'outside_city' : 'inside_city';

      const phoneNorm = normalizePhoneKey(phoneRaw);
      if (!name || name.length < 2) {
        return res.status(400).json({ ok: false, error: 'Please enter your full name.' });
      }
      if (!phoneNorm || phoneNorm.length < 7) {
        return res.status(400).json({ ok: false, error: 'Please enter a valid mobile number.' });
      }
      if (pin.length < 4 || pin.length > 20) {
        return res
          .status(400)
          .json({ ok: false, error: 'Please choose a 4 to 20 character PIN or password.' });
      }

      const existing = await findCustomerAccountByPhone(phoneNorm);
      if (existing) {
        return res.status(409).json({
          ok: false,
          error: 'An account with this phone number already exists. Please sign in instead.',
        });
      }

      const customerCode = `CID-${Math.floor(10000 + Math.random() * 90000)}`;
      const accountRecord: StoredCustomerAccount = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        customer_code: customerCode,
        name,
        phone: phoneRaw,
        phone_normalized: phoneNorm,
        pin_hash: hashCustomerPin(pin),
        default_address: defaultAddress,
        delivery_zone: deliveryZone,
        created_at: new Date().toISOString(),
      };

      let saved = accountRecord;
      const supabase = getServerSupabase();
      let savedToSupabase = false;
      if (supabase) {
        try {
          const { id: _localId, ...insertPayload } = accountRecord;
          const { data, error } = await supabase
            .from('customer_accounts')
            .insert([insertPayload])
            .select()
            .single();
          if (!error && data) {
            saved = data as unknown as StoredCustomerAccount;
            savedToSupabase = true;
          }
        } catch {
          // Fall back to server store
        }
      }
      if (!savedToSupabase) {
        const store = readServerStore();
        writeServerStore({
          ...store,
          customerAccounts: [saved, ...(store.customerAccounts || [])],
        });
      }

      const token = createCustomerToken(saved.id, saved.phone_normalized);
      const [allOrders, allMessages] = await Promise.all([
        loadAllOrdersForLookup(),
        loadAllCustomerMessages(),
      ]);
      const orders = allOrders.filter((o) => normalizePhoneKey(o.customer_phone) === phoneNorm);
      const messages = allMessages.filter((m) => m.customer_phone_normalized === phoneNorm);

      return res.status(201).json({
        ok: true,
        token,
        account: toPublicCustomerAccount(saved),
        orders,
        messages,
      });
    } catch (err) {
      console.error('Customer register error:', err);
      return res.status(500).json({ ok: false, error: 'Unable to create account right now.' });
    }
  });

  app.post('/api/customer/login', async (req: Request, res: Response) => {
    try {
      const phoneRaw = String(req.body?.phone ?? '').trim();
      const pin = String(req.body?.pin ?? '').trim();
      const phoneNorm = normalizePhoneKey(phoneRaw);

      if (!phoneNorm || !pin) {
        return res
          .status(400)
          .json({ ok: false, error: 'Please enter both your phone number and PIN.' });
      }

      const account = await findCustomerAccountByPhone(phoneNorm);
      if (!account || !verifyCustomerPin(pin, account.pin_hash)) {
        return res
          .status(401)
          .json({ ok: false, error: 'Invalid phone number or PIN. Please try again.' });
      }

      const token = createCustomerToken(account.id, account.phone_normalized);
      const [allOrders, allMessages] = await Promise.all([
        loadAllOrdersForLookup(),
        loadAllCustomerMessages(),
      ]);
      const orders = allOrders.filter((o) => normalizePhoneKey(o.customer_phone) === phoneNorm);
      const messages = allMessages.filter((m) => m.customer_phone_normalized === phoneNorm);

      return res.json({
        ok: true,
        token,
        account: toPublicCustomerAccount(account),
        orders,
        messages,
      });
    } catch (err) {
      console.error('Customer login error:', err);
      return res.status(500).json({ ok: false, error: 'Unable to sign in right now.' });
    }
  });

  app.get('/api/customer/me', async (req: Request, res: Response) => {
    const auth = verifyCustomerToken(req);
    if (!auth) {
      return res.status(401).json({ ok: false, error: 'Customer session expired.' });
    }
    const account = await findCustomerAccountByPhone(auth.phoneNormalized);
    if (!account) {
      return res.status(401).json({ ok: false, error: 'Account not found.' });
    }
    const [allOrders, allMessages] = await Promise.all([
      loadAllOrdersForLookup(),
      loadAllCustomerMessages(),
    ]);
    const orders = allOrders.filter(
      (o) => normalizePhoneKey(o.customer_phone) === auth.phoneNormalized
    );
    const messages = allMessages.filter(
      (m) => m.customer_phone_normalized === auth.phoneNormalized
    );
    return res.json({
      ok: true,
      account: toPublicCustomerAccount(account),
      orders,
      messages,
    });
  });

  app.post('/api/customer/track', async (req: Request, res: Response) => {
    const orderNumber = String(req.body?.order_number ?? '').trim().toUpperCase();
    const phoneNorm = normalizePhoneKey(String(req.body?.phone ?? ''));
    if (!orderNumber || !phoneNorm) {
      return res.status(400).json({
        ok: false,
        error: 'Enter both your Order Number (e.g. NCW-...) and Phone Number.',
      });
    }
    const allOrders = await loadAllOrdersForLookup();
    const match = allOrders.find(
      (o) =>
        o.order_number.toUpperCase() === orderNumber &&
        normalizePhoneKey(o.customer_phone) === phoneNorm
    );
    if (!match) {
      return res.status(404).json({
        ok: false,
        error: 'No order matched that Order Number and Phone Number.',
      });
    }
    return res.json({ ok: true, order: match });
  });

  app.post('/api/customer/messages', async (req: Request, res: Response) => {
    const auth = verifyCustomerToken(req);
    if (!auth) {
      return res.status(401).json({ ok: false, error: 'Please sign in to message Admin.' });
    }
    const body = String(req.body?.body ?? '').trim();
    const orderNumber = String(req.body?.order_number ?? '').trim().slice(0, 64);
    if (!body) {
      return res.status(400).json({ ok: false, error: 'Please write a message first.' });
    }
    const account = await findCustomerAccountByPhone(auth.phoneNormalized);
    const customerName = account?.name || auth.phoneNormalized;

    const saved = await appendCustomerMessage({
      customer_phone_normalized: auth.phoneNormalized,
      customer_name: customerName,
      order_number: orderNumber,
      sender: 'customer',
      body,
    });

    // Notify Admin on Telegram if configured
    const { settings } = await loadActivePaymentSettings();
    if (settings.telegramBotToken && settings.telegramChatId) {
      const tgText = [
        `<b>💬 NEW CUSTOMER MESSAGE</b>`,
        `<b>👤 From:</b> ${escapeTelegramHtml(customerName)} (${escapeTelegramHtml(
          account?.phone || auth.phoneNormalized
        )})`,
        account?.customer_code
          ? `<b>🆔 Customer ID:</b> <code>${escapeTelegramHtml(account.customer_code)}</code>`
          : '',
        orderNumber ? `<b>📦 Order:</b> ${escapeTelegramHtml(orderNumber)}` : '',
        '',
        escapeTelegramHtml(body),
      ]
        .filter(Boolean)
        .join('\n');
      void sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, tgText);
    }

    return res.status(201).json({ ok: true, message: saved });
  });

  app.post('/api/customer/messages/read', async (req: Request, res: Response) => {
    const auth = verifyCustomerToken(req);
    if (!auth) {
      return res.status(401).json({ ok: false, error: 'Sign in required.' });
    }
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        await supabase
          .from('customer_messages')
          .update({ read_by_customer: true })
          .eq('customer_phone_normalized', auth.phoneNormalized)
          .eq('sender', 'admin');
      } catch {
        // ignore
      }
    }
    const store = readServerStore();
    if (store.customerMessages?.length) {
      const updated = store.customerMessages.map((m) =>
        m.customer_phone_normalized === auth.phoneNormalized && m.sender === 'admin'
          ? { ...m, read_by_customer: true }
          : m
      );
      writeServerStore({ ...store, customerMessages: updated });
    }
    return res.json({ ok: true });
  });

  app.get('/api/admin/messages', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required.' });
    }
    const messages = await loadAllCustomerMessages();
    return res.json({ ok: true, messages });
  });

  app.post('/api/admin/messages', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required.' });
    }
    const phoneNorm = normalizePhoneKey(String(req.body?.customer_phone ?? ''));
    const customerName = String(req.body?.customer_name ?? 'Customer').trim().slice(0, 120);
    const orderNumber = String(req.body?.order_number ?? '').trim().slice(0, 64);
    const body = String(req.body?.body ?? '').trim();

    if (!phoneNorm || !body) {
      return res
        .status(400)
        .json({ ok: false, error: 'Customer phone and message text are required.' });
    }

    const saved = await appendCustomerMessage({
      customer_phone_normalized: phoneNorm,
      customer_name: customerName,
      order_number: orderNumber,
      sender: 'admin',
      body,
    });

    // Also mark customer's previous messages in this thread as read by admin
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        await supabase
          .from('customer_messages')
          .update({ read_by_admin: true })
          .eq('customer_phone_normalized', phoneNorm)
          .eq('sender', 'customer');
      } catch {
        // ignore
      }
    }
    const store = readServerStore();
    if (store.customerMessages?.length) {
      const updated = store.customerMessages.map((m) =>
        m.customer_phone_normalized === phoneNorm && m.sender === 'customer'
          ? { ...m, read_by_admin: true }
          : m
      );
      writeServerStore({ ...store, customerMessages: updated });
    }

    return res.status(201).json({ ok: true, message: saved });
  });

  app.post('/api/admin/messages/read', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required.' });
    }
    const phoneNorm = normalizePhoneKey(String(req.body?.customer_phone ?? ''));
    if (!phoneNorm) return res.json({ ok: true });

    const supabase = getServerSupabase();
    if (supabase) {
      try {
        await supabase
          .from('customer_messages')
          .update({ read_by_admin: true })
          .eq('customer_phone_normalized', phoneNorm)
          .eq('sender', 'customer');
      } catch {
        // ignore
      }
    }
    const store = readServerStore();
    if (store.customerMessages?.length) {
      const updated = store.customerMessages.map((m) =>
        m.customer_phone_normalized === phoneNorm && m.sender === 'customer'
          ? { ...m, read_by_admin: true }
          : m
      );
      writeServerStore({ ...store, customerMessages: updated });
    }
    return res.json({ ok: true });
  });

  async function updateCustomerPinHash(phoneNorm: string, newPinHash: string): Promise<boolean> {
    let updated = false;
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('customer_accounts')
          .update({ pin_hash: newPinHash })
          .eq('phone_normalized', phoneNorm)
          .select('id');
        if (!error && Array.isArray(data) && data.length > 0) {
          updated = true;
        }
      } catch {
        // fall through to local store
      }
    }
    const store = readServerStore();
    if (store.customerAccounts?.some((a) => a.phone_normalized === phoneNorm)) {
      const nextAccounts = store.customerAccounts.map((a) =>
        a.phone_normalized === phoneNorm ? { ...a, pin_hash: newPinHash } : a
      );
      writeServerStore({ ...store, customerAccounts: nextAccounts });
      updated = true;
    }
    return updated;
  }

  function getActivePinResetRequests(): StoredPinResetRequest[] {
    const store = readServerStore();
    const nowMs = Date.now();
    const active = (store.pinResetRequests || []).filter(
      (r) => new Date(r.expires_at).getTime() > nowMs
    );
    if (active.length !== (store.pinResetRequests || []).length) {
      writeServerStore({ ...store, pinResetRequests: active });
    }
    return active;
  }

  // Customer Forgot PIN Step 1: Request 6-digit Reset Code (sent to Admin Telegram + Admin Panel)
  app.post('/api/customer/forgot-pin', async (req: Request, res: Response) => {
    try {
      const phoneRaw = String(req.body?.phone ?? '').trim();
      const phoneNorm = normalizePhoneKey(phoneRaw);
      if (!phoneNorm || phoneNorm.length < 7) {
        return res.status(400).json({ ok: false, error: 'Please enter your registered phone number.' });
      }
      const account = await findCustomerAccountByPhone(phoneNorm);
      if (!account) {
        return res.status(404).json({
          ok: false,
          error: 'Ei phone number diye kono account pawa jayni. Notun Customer ID create korun.',
        });
      }

      const resetCode = String(crypto.randomInt(100000, 999999));
      const now = Date.now();
      const requestRecord: StoredPinResetRequest = {
        id: `pinr-${now}-${Math.random().toString(36).slice(2, 6)}`,
        phone_normalized: phoneNorm,
        phone: account.phone,
        customer_name: account.name,
        customer_code: account.customer_code,
        reset_code: resetCode,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + 30 * 60 * 1000).toISOString(),
      };

      const active = getActivePinResetRequests().filter((r) => r.phone_normalized !== phoneNorm);
      const store = readServerStore();
      writeServerStore({
        ...store,
        pinResetRequests: [requestRecord, ...active].slice(0, 50),
      });

      // Notify Admin via Telegram Bot immediately with the 6-digit code
      const { settings } = await loadActivePaymentSettings();
      if (settings.telegramBotToken && settings.telegramChatId) {
        const tgHtml = [
          `<b>🔐 CUSTOMER PIN RESET REQUEST</b>`,
          `<b>👤 Customer:</b> ${escapeTelegramHtml(account.name)} (<code>${escapeTelegramHtml(
            account.customer_code
          )}</code>)`,
          `<b>📞 Phone:</b> ${escapeTelegramHtml(account.phone)}`,
          `<b>🔑 6-Digit Reset Code:</b> <code>${resetCode}</code>`,
          `<i>Valid for 30 minutes. Send this code to the customer's phone via WhatsApp/SMS after verifying them.</i>`,
        ].join('\n');
        void sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, tgHtml);
      }

      return res.json({
        ok: true,
        customer_code: account.customer_code,
        expires_in_minutes: 30,
        message:
          'PIN reset request Admin er kache pathano hoyeche! Admin apnar phone/WhatsApp e 6-digit reset code pathabe — oi code diye notun PIN set korun.',
      });
    } catch (err) {
      console.error('Forgot PIN error:', err);
      return res.status(500).json({ ok: false, error: 'Could not process PIN reset request.' });
    }
  });

  // Customer Forgot PIN Step 2: Verify 6-digit Reset Code + Set New PIN & Auto Sign-In
  app.post('/api/customer/reset-pin', async (req: Request, res: Response) => {
    try {
      const phoneNorm = normalizePhoneKey(String(req.body?.phone ?? ''));
      const resetCode = String(req.body?.reset_code ?? '').replace(/\s+/g, '').trim();
      const newPin = String(req.body?.new_pin ?? '').trim();

      if (!phoneNorm || !resetCode) {
        return res
          .status(400)
          .json({ ok: false, error: 'Phone number and 6-digit reset code are required.' });
      }
      if (newPin.length < 4 || newPin.length > 20) {
        return res
          .status(400)
          .json({ ok: false, error: 'New PIN must be 4 to 20 characters long.' });
      }

      const active = getActivePinResetRequests();
      const match = active.find(
        (r) => r.phone_normalized === phoneNorm && r.reset_code === resetCode
      );
      if (!match) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid or expired 6-digit reset code. Please check the code from Admin or request a new one.',
        });
      }

      const account = await findCustomerAccountByPhone(phoneNorm);
      if (!account) {
        return res.status(404).json({ ok: false, error: 'Customer account not found.' });
      }

      const newHash = hashCustomerPin(newPin);
      const updated = await updateCustomerPinHash(phoneNorm, newHash);
      if (!updated) {
        return res.status(500).json({ ok: false, error: 'Could not update PIN right now.' });
      }

      // Consume the reset code so it cannot be reused
      const store = readServerStore();
      writeServerStore({
        ...store,
        pinResetRequests: (store.pinResetRequests || []).filter(
          (r) => r.phone_normalized !== phoneNorm
        ),
      });

      const token = createCustomerToken(account.id, account.phone_normalized);
      const [allOrders, allMessages] = await Promise.all([
        loadAllOrdersForLookup(),
        loadAllCustomerMessages(),
      ]);
      const orders = allOrders.filter((o) => normalizePhoneKey(o.customer_phone) === phoneNorm);
      const messages = allMessages.filter((m) => m.customer_phone_normalized === phoneNorm);

      return res.json({
        ok: true,
        token,
        account: toPublicCustomerAccount(account),
        orders,
        messages,
      });
    } catch (err) {
      console.error('Reset PIN error:', err);
      return res.status(500).json({ ok: false, error: 'Unable to reset PIN right now.' });
    }
  });

  // Admin: Fetch active customer PIN reset requests
  app.get('/api/admin/pin-resets', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required.' });
    }
    return res.json({ ok: true, requests: getActivePinResetRequests() });
  });

  // Admin: Directly set a temporary new PIN for any customer account
  app.post('/api/admin/customer/reset-pin', async (req: Request, res: Response) => {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Staff login required.' });
    }
    const phoneNorm = normalizePhoneKey(String(req.body?.customer_phone ?? ''));
    const newPin = String(req.body?.new_pin ?? '').trim();
    if (!phoneNorm) {
      return res.status(400).json({ ok: false, error: 'Valid customer phone number is required.' });
    }
    if (newPin.length < 4 || newPin.length > 20) {
      return res.status(400).json({ ok: false, error: 'New PIN must be 4 to 20 characters.' });
    }
    const account = await findCustomerAccountByPhone(phoneNorm);
    if (!account) {
      return res.status(404).json({
        ok: false,
        error: 'Ei phone number e kono registered Customer Account nei.',
      });
    }
    const ok = await updateCustomerPinHash(phoneNorm, hashCustomerPin(newPin));
    if (!ok) {
      return res.status(500).json({ ok: false, error: 'Failed to update customer PIN.' });
    }
    // Clear any pending reset code for this phone
    const store = readServerStore();
    writeServerStore({
      ...store,
      pinResetRequests: (store.pinResetRequests || []).filter(
        (r) => r.phone_normalized !== phoneNorm
      ),
    });

    return res.json({
      ok: true,
      customer_code: account.customer_code,
      customer_name: account.name,
      phone: account.phone,
      new_pin: newPin,
    });
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

      const dominantColor =
        typeof req.body?.dominantColor === 'string' && req.body.dominantColor.trim()
          ? req.body.dominantColor.trim()
          : 'Black';

      if (catalogSummary.length > 0) {
        parts.push({
          text: `You are the visual and semantic product matcher for "New Chiko Watch & Electronics".
1. Inspect the CUSTOMER QUERY PHOTO carefully (visible brand text, model code, category, color, material, and key features).
2. Match semantically and visually against EVERY item in the Full Store Inventory JSON below.
3. Return up to 5 closest matching products from our inventory ranked from highest to lowest matchPercentage (1 to 100), using the EXACT "id" string as "watchId".

Full Store Inventory JSON:
${JSON.stringify(catalogSummary)}`,
        });
      } else {
        parts.push({
          text: `Identify the watch or electronics product in the CUSTOMER QUERY PHOTO (brand, category, color, and key features). Because the store inventory is currently empty, return matches: [].`,
        });
      }

      const response = await generateWithFallbackModel(
        ai,
        {
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
        },
        10000
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const detectedProduct = parsed.detectedProduct ?? {
        brand: 'Watch / Electronics',
        category: 'Gadgets & Accessories',
        color: dominantColor,
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

      if (catalogSummary.length > 0 && finalMatches.length === 0) {
        finalMatches = computeSemanticFallbackMatches(detectedProduct, catalogSummary);
      }

      return res.json({
        detectedProduct,
        matches: finalMatches,
      });
    } catch (error) {
      const status = extractHttpStatus(error);
      console.error('Chiko Lens error:', status, error instanceof Error ? error.message.slice(0, 200) : error);
      return res.status(status).json({
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

      const response = await generateWithFallbackModel(ai, {
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
      const status = extractHttpStatus(error);
      if (status === 429) {
        console.warn('AI Auto-Fill rate limit reached (429).');
      } else {
        console.error('AI Auto-Fill error:', error);
      }
      return res.status(status).json({
        error: formatFriendlyAiError(
          error,
          'Could not auto-fill product details from this image. You can fill in the fields manually.'
        ),
      });
    }
  });

  // Smart Shop Chatbot (Bangla, Banglish, English — Watches & Electronics, low-latency Gemini)
  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    try {
      const { message, history, watches } = req.body ?? {};
      if (!message || !Array.isArray(watches)) {
        return res.status(400).json({ error: 'Please type a message to ask the concierge.' });
      }

      const ai = createGeminiClient(11000);

      // Strictly exclude real_buying_price from customer-facing AI context
      const publicCatalog = watches.slice(0, 40).map((w: Record<string, unknown>) => ({
        id: String(w.id ?? ''),
        product_name: String(w.product_name ?? ''),
        brand: String(w.brand ?? ''),
        model: String(w.model ?? ''),
        color: String(w.color ?? ''),
        category: String(w.category ?? w.strap_type ?? ''),
        connectivity: String(w.connectivity ?? w.movement ?? ''),
        capacity_spec: String(w.capacity_spec ?? w.case_size ?? ''),
        tag_price_bdt: Number(w.display_buying_price) || 0,
        offer_price_bdt: Number(w.min_selling_price) || 0,
        stock_count: Number(w.stock_count) || 0,
        description: String(w.description ?? '').slice(0, 140),
      }));

      const conversationContext = Array.isArray(history)
        ? history
            .slice(-4)
            .map((h: { role: string; text: string }) => `${h.role}: ${String(h.text ?? '').slice(0, 180)}`)
            .join('\n')
        : '';

      const response = await generateWithFallbackModel(
        ai,
        {
          contents: `${conversationContext ? `Recent conversation:\n${conversationContext}\n\n` : ''}Customer message: ${String(message).slice(0, 400)}`,
          config: {
            systemInstruction: `You are the polite, fast sales concierge at "New Chiko Watch & Electronics", selling watches and electronics (Smartwatches, TWS Earbuds, Power Banks, Chargers, Bluetooth Speakers, Vapes/Pods, Bottles, and Gadgets).
- Reply in the exact language/style the customer uses: Bangla (বাংলা), Banglish (e.g. "vape ache?", "2000 takar niche ki ase?"), or English.
- Only recommend items from Store Catalog JSON. Use offer_price_bdt (৳) as the selling price. Never invent items or mention wholesale cost.
- Return matching item "id" values in recommendedWatchIds (up to 4).
- Keep replies short (1-3 sentences), friendly, and crisp for mobile shoppers.

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
        },
        8500
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const validIds = new Set(publicCatalog.map((c) => c.id));
      const recommendedWatchIds = Array.isArray(parsed.recommendedWatchIds)
        ? parsed.recommendedWatchIds
            .filter((id: unknown): id is string => typeof id === 'string' && validIds.has(id))
            .slice(0, 4)
        : [];
      return res.json({
        reply: typeof parsed.reply === 'string' && parsed.reply.trim()
          ? parsed.reply.trim()
          : 'Here are the matching items from our store:',
        recommendedWatchIds,
      });
    } catch (error) {
      const status = extractHttpStatus(error);
      console.error('Shop Chatbot error:', status, error instanceof Error ? error.message.slice(0, 200) : error);
      return res.status(status).json({
        error: formatFriendlyAiError(
          error,
          'The shop concierge is temporarily unavailable. Please try again in a moment.'
        ),
      });
    }
  });

  // Read-only Showcase Helpers (CORS-safe image proxy + Google Search grounded full-body product lookup; zero cloud storage writes)
  const isSafeExternalUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
      const host = parsed.hostname.toLowerCase();
      if (
        !host ||
        host === 'localhost' ||
        host === '::1' ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^0\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const detectImageMimeFromMagic = (buf: Buffer): string | null => {
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  };

  const fetchVerifiedImageBytes = async (
    candidateUrl: string,
    timeoutMs = 5000
  ): Promise<{ contentType: string; buffer: Buffer } | null> => {
    if (!isSafeExternalUrl(candidateUrl)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetch(candidateUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!upstream.ok) return null;
      const ct = (upstream.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('svg') || ct.includes('text/html')) return null;
      const arr = await upstream.arrayBuffer();
      if (arr.byteLength < 3500 || arr.byteLength > 5 * 1024 * 1024) return null;
      const buf = Buffer.from(arr);
      const magicMime = detectImageMimeFromMagic(buf);
      if (ct.startsWith('image/')) {
        return { contentType: ct.split(';')[0] || magicMime || 'image/jpeg', buffer: buf };
      }
      if (magicMime) {
        return { contentType: magicMime, buffer: buf };
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const extractOgImagesFromPage = async (pageUrl: string, depth = 0): Promise<string[]> => {
    if (!isSafeExternalUrl(pageUrl) || depth > 1) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5800);
    try {
      const pageRes = await fetch(pageUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!pageRes.ok) return [];
      const finalUrl = pageRes.url || pageUrl;
      const ct = (pageRes.headers.get('content-type') || '').toLowerCase();
      if (ct.startsWith('image/') && !ct.includes('svg')) {
        return [finalUrl];
      }
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return [];
      const html = (await pageRes.text()).slice(0, 320000);

      // Follow meta-refresh redirects if a search redirect link uses HTML refresh
      if (depth === 0) {
        const refreshMatch = html.match(
          /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'\s>]+)["']/i
        );
        if (refreshMatch?.[1]) {
          try {
            const target = new URL(refreshMatch[1].trim(), finalUrl).toString();
            return extractOgImagesFromPage(target, 1);
          } catch {
            // ignore
          }
        }
      }

      const found: string[] = [];
      const addResolved = (raw: string) => {
        const clean = raw.trim().replace(/&amp;/g, '&');
        if (!clean || clean.startsWith('data:') || /\.svg(?:\?|$)/i.test(clean)) return;
        if (/(favicon|sprite|pixel|tracking|logo-small|avatar|badge|placeholder)/i.test(clean)) return;
        try {
          const abs = new URL(clean, finalUrl).toString();
          if (isSafeExternalUrl(abs)) found.push(abs);
        } catch {
          // skip invalid
        }
      };

      const metaMatches = html.matchAll(
        /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]*>/gi
      );
      for (const m of metaMatches) {
        addResolved(m[1] || m[2] || '');
      }

      const linkMatches = html.matchAll(
        /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/gi
      );
      for (const m of linkMatches) {
        addResolved(m[1] || '');
      }

      const jsonLdImages = html.matchAll(/"image"\s*:\s*(?:\[\s*)?"(https?:\/\/[^"]+)"/gi);
      for (const m of jsonLdImages) {
        addResolved(m[1] || '');
      }

      const imgTagMatches = html.matchAll(
        /<img[^>]+(?:data-zoom-image|data-large_image|data-src|src)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*>/gi
      );
      for (const m of imgTagMatches) {
        addResolved(m[1] || '');
        if (found.length >= 10) break;
      }

      return Array.from(new Set(found)).slice(0, 6);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  };

  const fetchBingImageUrls = async (query: string): Promise<string[]> => {
    const cleanQ = query.trim();
    if (!cleanQ) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const searchUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(
        cleanQ
      )}&first=1&count=12`;
      const res = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const matches = html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/gi);
      const urls: string[] = [];
      for (const m of matches) {
        const candidate = (m[1] || '').replace(/\\u002f/gi, '/').trim();
        if (
          candidate &&
          isSafeExternalUrl(candidate) &&
          !/(alamy|shutterstock|istockphoto|dreamstime|123rf|depositphotos|gettyimages)/i.test(
            candidate
          )
        ) {
          urls.push(candidate);
        }
      }
      return Array.from(new Set(urls)).slice(0, 10);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  };

  app.get('/api/showcase/proxy-image', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const img = await fetchVerifiedImageBytes(rawUrl, 5500);
    if (!img) {
      return res.status(404).json({ error: 'Unable to load product image.' });
    }
    res.setHeader('Content-Type', img.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(img.buffer);
  });

  // Read-only Gemini Vision + Metadata Inspector: separates device body from retail boxes AND returns universal animation/background config for any product
  app.post('/api/showcase/subject-box', async (req: Request, res: Response) => {
    try {
      const {
        imageUrl,
        productName,
        brand,
        model,
        category,
        color,
        description,
        capacitySpec,
        connectivity,
      } = req.body ?? {};

      let resolvedBase64 = '';
      let resolvedMime = 'image/jpeg';
      if (typeof imageUrl === 'string' && imageUrl.trim()) {
        const parsedData = parseDataUrl(imageUrl.trim());
        if (parsedData) {
          resolvedBase64 = parsedData.data;
          resolvedMime = parsedData.mimeType;
        } else if (isSafeExternalUrl(imageUrl.trim())) {
          const fetched = await fetchVerifiedImageBytes(imageUrl.trim(), 4500);
          if (fetched) {
            resolvedBase64 = fetched.buffer.toString('base64');
            resolvedMime = fetched.contentType;
          }
        }
      }

      const defaultQuery = [brand, model, productName].filter(Boolean).join(' ').trim();
      const label = [brand, model, productName, category, color, capacitySpec, connectivity]
        .filter(Boolean)
        .join(' · ');

      const parts: Part[] = [];
      if (resolvedBase64) {
        parts.push({
          inlineData: {
            mimeType: resolvedMime,
            data: resolvedBase64,
          },
        });
      }
      parts.push({
        text: `Inspect this product${resolvedBase64 ? ' photo and' : ''} metadata for "New Chiko Watch & Electronics":
Product: ${label}
Description: ${String(description || '').slice(0, 320)}

1. Packaging vs Device Body Isolation${resolvedBase64 ? ' (look closely at the photo)' : ' (no image provided, set needsWebImage=true)'}:
- hasExposedDevice: true ONLY if the actual physical device itself is clearly visible outside sealed cardboard packaging; false if closed retail box/packaging or no image.
- isPackagingOrBox: true if retail box/packaging or cluttered shelf/hand/desk surrounds or dominates the photo.
- needsWebImage: true if no image is available OR if a clean out-of-box studio photo would show the actual device body much more cleanly than a boxed/hand-held/blurry photo.
- ymin, xmin, ymax, xmax: integers 0..1000 tightly bounding ONLY the actual physical product body itself (excluding retail cardboard box, packaging sleeve, hands, desk). If no image or only a full-frame box, return 0,0,1000,1000.
- searchQuery: concise search query for a clean out-of-box studio product photo (e.g. "${defaultQuery || 'wireless electronic gadget'} studio").

2. Universal Real-World Animation & Animated Background Profile:
Classify accurately based on what this product actually is in real life:
- productType: MUST be one of "vapor" (vapes, pod kits, humidifiers, diffusers), "power" (power banks, wall chargers, charging cables, adapters), "audio" (bluetooth speakers, earbuds, neckbands, headphones), "light" (flashlights, lamps, ring lights, lanterns), "fan" (mini fans, desk/neck/cooling fans), "watch" (analog watches, digital watches, smartwatches), "camera" (cameras, webcams, gimbals, drones), or "gadget" (any other electronic/smart accessory).
- subVariant: one of "pod_vape", "mist_diffuser", "fan", "flashlight", "lamp", "powerbank", "charger", "cable", "analog", "digital", "smartwatch", "earbuds", "neckband", "speaker", "camera", "gadget".
- backgroundMood: MUST match the productType's real-world environment: "energy_flow" (power), "vapor_mist" (vapor), "sonic_pulse" (audio), "light_beam" (light), "airflow_breeze" (fan), "horology_luxury" (watch), "optics_bokeh" (camera), or "cyber_aurora" (gadget).
- realWorldObject: 2-4 word clear hardware title (e.g., "Fast Charge Power Bank", "Pod Vapor System", "Portable Bluetooth Speaker").
- accentHex: bright glowing #RRGGBB hex matching the product's authentic LED/brand vibe (must be bright/vibrant on dark studio backgrounds).
- secondaryHex: bright complementary #RRGGBB hex.
- activeLabel: 3-5 words describing active power/effect (e.g., "Super-Fast Charge Surge", "Smooth Vapor Plumes Active", "Bass Waves & Beat Active").
- idleLabel: 3-5 words ready label.
- featureTag: 2-3 word key spec/trait.`,
      });

      const ai = createGeminiClient();
      const response = await generateWithFallbackModel(ai, {
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasExposedDevice: { type: Type.BOOLEAN },
              isPackagingOrBox: { type: Type.BOOLEAN },
              needsWebImage: { type: Type.BOOLEAN },
              ymin: { type: Type.INTEGER },
              xmin: { type: Type.INTEGER },
              ymax: { type: Type.INTEGER },
              xmax: { type: Type.INTEGER },
              searchQuery: { type: Type.STRING },
              productType: { type: Type.STRING },
              subVariant: { type: Type.STRING },
              backgroundMood: { type: Type.STRING },
              realWorldObject: { type: Type.STRING },
              accentHex: { type: Type.STRING },
              secondaryHex: { type: Type.STRING },
              activeLabel: { type: Type.STRING },
              idleLabel: { type: Type.STRING },
              featureTag: { type: Type.STRING },
            },
            required: [
              'hasExposedDevice',
              'isPackagingOrBox',
              'needsWebImage',
              'ymin',
              'xmin',
              'ymax',
              'xmax',
              'searchQuery',
              'productType',
              'subVariant',
              'backgroundMood',
              'realWorldObject',
              'accentHex',
              'secondaryHex',
              'activeLabel',
              'idleLabel',
              'featureTag',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;

      const ymin = Math.max(0, Math.min(950, Number(parsed.ymin ?? 0)));
      const xmin = Math.max(0, Math.min(950, Number(parsed.xmin ?? 0)));
      const ymax = Math.max(ymin + 40, Math.min(1000, Number(parsed.ymax ?? 1000)));
      const xmax = Math.max(xmin + 40, Math.min(1000, Number(parsed.xmax ?? 1000)));
      const isUsefulCrop = Boolean(resolvedBase64) && (xmax - xmin < 970 || ymax - ymin < 970);

      return res.json({
        hasExposedDevice: resolvedBase64 ? Boolean(parsed.hasExposedDevice) : false,
        isPackagingOrBox: Boolean(parsed.isPackagingOrBox),
        needsWebImage: resolvedBase64 ? Boolean(parsed.needsWebImage) : true,
        deviceBox: isUsefulCrop ? { ymin, xmin, ymax, xmax } : null,
        searchQuery:
          typeof parsed.searchQuery === 'string' && parsed.searchQuery.trim()
            ? parsed.searchQuery.trim()
            : defaultQuery,
        productType: typeof parsed.productType === 'string' ? parsed.productType.trim().toLowerCase() : '',
        subVariant: typeof parsed.subVariant === 'string' ? parsed.subVariant.trim().toLowerCase() : '',
        backgroundMood:
          typeof parsed.backgroundMood === 'string' ? parsed.backgroundMood.trim().toLowerCase() : '',
        realWorldObject: typeof parsed.realWorldObject === 'string' ? parsed.realWorldObject.trim() : '',
        accentHex: typeof parsed.accentHex === 'string' ? parsed.accentHex.trim() : '',
        secondaryHex: typeof parsed.secondaryHex === 'string' ? parsed.secondaryHex.trim() : '',
        activeLabel: typeof parsed.activeLabel === 'string' ? parsed.activeLabel.trim() : '',
        idleLabel: typeof parsed.idleLabel === 'string' ? parsed.idleLabel.trim() : '',
        featureTag: typeof parsed.featureTag === 'string' ? parsed.featureTag.trim() : '',
      });
    } catch {
      return res.json({
        hasExposedDevice: true,
        isPackagingOrBox: false,
        needsWebImage: false,
        deviceBox: null,
        searchQuery: '',
      });
    }
  });

  app.post('/api/showcase/lookup-image', async (req: Request, res: Response) => {
    try {
      const { productName, brand, model, category, color, customQuery } = req.body ?? {};
      const cleanBrand =
        typeof brand === 'string' && brand.trim() && brand.trim().toLowerCase() !== 'generic'
          ? brand.trim()
          : '';
      const cleanModel = typeof model === 'string' ? model.trim() : '';
      const cleanName = typeof productName === 'string' ? productName.trim() : '';

      const baseQuery =
        typeof customQuery === 'string' && customQuery.trim()
          ? customQuery.trim()
          : [cleanBrand, cleanModel, cleanName || category, color]
              .filter((s) => typeof s === 'string' && s.trim())
              .join(' ')
              .trim();

      if (!baseQuery) {
        return res.json({ imageUrl: null, candidateUrls: [], sourceTitle: '' });
      }

      const verifiedCandidates: string[] = [];
      const addVerifiedBatch = async (urls: string[], limit = 6) => {
        const subset = Array.from(new Set(urls))
          .filter((u) => !verifiedCandidates.includes(u))
          .slice(0, limit);
        if (!subset.length) return;
        const checks = await Promise.all(
          subset.map(async (u) => ({ url: u, ok: await fetchVerifiedImageBytes(u, 3600) }))
        );
        for (const c of checks) {
          if (c.ok && !verifiedCandidates.includes(c.url)) {
            verifiedCandidates.push(c.url);
          }
        }
      };

      // 1. Primary visual search for clean out-of-box studio product image
      const compactModelQuery = [cleanBrand, cleanModel || cleanName, category || '']
        .filter(Boolean)
        .join(' ')
        .trim();
      const bingUrls = await fetchBingImageUrls(`${compactModelQuery || baseQuery} product`);
      await addVerifiedBatch(bingUrls, 6);

      if (verifiedCandidates.length === 0) {
        const bingBroadUrls = await fetchBingImageUrls(baseQuery);
        await addVerifiedBatch(bingBroadUrls, 6);
      }

      // 2. Gemini Google Search Grounding (if primary yielded < 2 candidates)
      if (verifiedCandidates.length < 2) {
        const directImgUrls: string[] = [];
        const pageUrls: Array<{ uri: string; title: string }> = [];
        try {
          const ai = createGeminiClient();
          const response = await generateWithFallbackModel(ai, {
            contents: `Search the web for the product "${baseQuery}". Find pages or direct studio product photo URLs (.jpg, .png, .webp) showing the device itself clearly.`,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });

          const textUrls = (response.text || '').match(/https?:\/\/[^\s"'<>)\]]+/gi) || [];
          for (const u of textUrls) {
            const clean = u.replace(/[.,;)]+$/, '');
            if (/\.(png|jpe?g|webp)(?:\?|$)/i.test(clean)) {
              directImgUrls.push(clean);
            } else {
              pageUrls.push({ uri: clean, title: baseQuery });
            }
          }

          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const chunk of chunks) {
              const uri = chunk?.web?.uri;
              const title = chunk?.web?.title || baseQuery;
              if (typeof uri === 'string' && uri.startsWith('http')) {
                if (/\.(png|jpe?g|webp)(?:\?|$)/i.test(uri)) {
                  directImgUrls.push(uri);
                } else {
                  pageUrls.push({ uri, title });
                }
              }
            }
          }

          await addVerifiedBatch(directImgUrls, 4);
          if (verifiedCandidates.length === 0) {
            for (const page of pageUrls.slice(0, 3)) {
              const ogCandidates = await extractOgImagesFromPage(page.uri);
              await addVerifiedBatch(ogCandidates, 3);
              if (verifiedCandidates.length >= 2) break;
            }
          }
        } catch {
          // ignore Gemini search errors cleanly
        }
      }

      // 3. Fallback: Wikimedia Commons & Wikipedia exact product search
      if (verifiedCandidates.length === 0) {
        try {
          const shortQuery = [cleanBrand, cleanModel].filter(Boolean).join(' ').trim() || baseQuery;
          const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
            shortQuery
          )}&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url|mime&iiurlwidth=720&format=json&origin=*`;
          const cRes = await fetch(commonsUrl, {
            headers: { 'User-Agent': 'NewChikoWatchShowcase/1.0' },
          });
          if (cRes.ok) {
            const cData = (await cRes.json()) as {
              query?: {
                pages?: Record<
                  string,
                  {
                    imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string }>;
                  }
                >;
              };
            };
            const wikiImgs: string[] = [];
            for (const p of Object.values(cData?.query?.pages || {})) {
              const info = p.imageinfo?.[0];
              const imgSrc = info?.thumburl || info?.url;
              if (imgSrc && (!info?.mime || /image\/(jpeg|png|webp)/i.test(info.mime))) {
                wikiImgs.push(imgSrc);
              }
            }
            await addVerifiedBatch(wikiImgs, 3);
          }
        } catch {
          // ignore
        }
      }

      return res.json({
        imageUrl: verifiedCandidates[0] || null,
        candidateUrls: verifiedCandidates.slice(0, 4),
        sourceTitle: baseQuery,
      });
    } catch (error) {
      const status = extractHttpStatus(error);
      console.warn('Showcase image lookup error:', status);
      return res.json({ imageUrl: null, candidateUrls: [], sourceTitle: '' });
    }
  });

  // Helper: fetch real live online search text snippets (Bing/DuckDuckGo) with zero API quota limits
  const fetchLiveWebSearchSnippets = async (query: string): Promise<string> => {
    if (!query.trim()) return '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(ddgUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
      });
      if (res.ok) {
        const html = await res.text();
        const plain = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        if (plain.length > 80) {
          return plain.slice(0, 2600);
        }
      }
    } catch {
      // fall through to Bing web search
    } finally {
      clearTimeout(timer);
    }

    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 4500);
    try {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      const res2 = await fetch(bingUrl, {
        signal: controller2.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
      });
      if (!res2.ok) return '';
      const html = await res2.text();
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2600);
    } catch {
      return '';
    } finally {
      clearTimeout(timer2);
    }
  };

  const classifyActionKindFromOnlineText = (
    combinedText: string,
    categoryText: string
  ): {
    actionKind: 'vapor' | 'liquid' | 'power' | 'audio' | 'fan' | 'light' | 'watch' | 'universal';
    verifiedProductType: string;
  } => {
    const text = combinedText.toLowerCase();
    const cat = categoryText.toLowerCase();

    // Strictly check Vape / Pod / Humidifier FIRST (never hijacked by 1000mAh or Type-C!)
    if (
      /\b(vape|vaping|pod\s*kit|pod\s*system|disposable\s*vape|pre[\s-]*filled\s*pod|prelled\s*pod|puffs?|e-cig|e-cigarette|e-liquid|nicotine|nic\s*salt|salt\s*nic|mesh\s*coil|oxva|xlim|voopoo|uwell|caliburn|vaporesso|xros|elf\s*bar|elfbar|vozol|d-breath|waka|iget|geek\s*bar|lost\s*mary|relx|shisha|hookah|humidifier|aroma\s*diffuser)\b/.test(
        text
      )
    ) {
      return { actionKind: 'vapor', verifiedProductType: 'Vape / Pod Vapor Device' };
    }

    if (
      /\b(water\s*bottle|insulated\s*bottle|thermos|vacuum\s*flask|tumbler|stanley\s*quencher|hydro\s*flask|sipper|perfume|eau\s*de\s*parfum|cologne|attar|body\s*mist|spray\s*bottle)\b/.test(
        text
      )
    ) {
      return { actionKind: 'liquid', verifiedProductType: 'Bottle / Liquid Vessel' };
    }

    if (
      /\b(bluetooth\s*speaker|wireless\s*speaker|portable\s*speaker|soundbar|subwoofer|ktx-\d+|jbl\s*(flip|charge|go|clip)|tws|earbuds?|earphones?|airpods?|headphones?|neckband|microphone)\b/.test(
        text
      ) ||
      cat.includes('speaker') ||
      cat.includes('earbud') ||
      cat.includes('neckband')
    ) {
      return { actionKind: 'audio', verifiedProductType: 'Wireless Audio Device' };
    }

    if (
      /\b(mini\s*fan|portable\s*fan|neck\s*fan|desk\s*fan|cooling\s*fan|handheld\s*fan|air\s*cooler|hair\s*dryer)\b/.test(
        text
      )
    ) {
      return { actionKind: 'fan', verifiedProductType: 'Cooling / Airflow Fan' };
    }

    if (
      /\b(flashlight|torch\s*light|desk\s*lamp|table\s*lamp|ring\s*light|led\s*lamp|lantern|night\s*light|headlamp|spotlight)\b/.test(
        text
      )
    ) {
      return { actionKind: 'light', verifiedProductType: 'Lighting Device' };
    }

    if (
      /\b(wristwatch|analog\s*watch|digital\s*watch|smartwatch|smart\s*watch|chronograph|quartz\s*watch|automatic\s*watch|rolex|casio|g-shock|seiko|tissot|fossil|omega|citizen)\b/.test(
        text
      ) ||
      cat.includes('watch')
    ) {
      return { actionKind: 'watch', verifiedProductType: 'Signature Timepiece' };
    }

    if (
      /\b(power\s*bank|powerbank|wall\s*charger|fast\s*charger|gan\s*charger|charging\s*adapter|power\s*adapter|charging\s*cable|magsafe\s*battery|portable\s*charger)\b/.test(
        text
      ) ||
      cat.includes('power bank') ||
      cat.includes('charger')
    ) {
      return { actionKind: 'power', verifiedProductType: 'Fast Charging Power Bank / Charger' };
    }

    return { actionKind: 'universal', verifiedProductType: 'Smart Lifestyle Product' };
  };

  // Online Web Search + Vision Product Identifier: searches the internet for exact model/product first so vapes never get misclassified as chargers/power banks
  app.post('/api/showcase/identify-product', async (req: Request, res: Response) => {
    try {
      const {
        imageUrl,
        productName,
        brand,
        model,
        category,
        color,
        description,
        capacitySpec,
        connectivity,
      } = req.body ?? {};

      const querySubject = [brand, model, productName]
        .filter((s) => typeof s === 'string' && s.trim() && s.trim().toLowerCase() !== 'generic')
        .join(' ')
        .trim();
      const fullLabel = [brand, model, productName, category, color, capacitySpec, connectivity]
        .filter((s) => typeof s === 'string' && s.trim())
        .join(' · ');

      // 1. Run live online web search FIRST for exact real-world product context
      const onlineSnippets = await fetchLiveWebSearchSnippets(
        querySubject || String(productName || model || '')
      );

      // 2. Try Gemini Google Search Grounding + Vision refinement when available
      try {
        let resolvedBase64 = '';
        let resolvedMime = 'image/jpeg';
        if (typeof imageUrl === 'string' && imageUrl.trim()) {
          const parsedData = parseDataUrl(imageUrl.trim());
          if (parsedData) {
            resolvedBase64 = parsedData.data;
            resolvedMime = parsedData.mimeType;
          } else if (isSafeExternalUrl(imageUrl.trim())) {
            const fetched = await fetchVerifiedImageBytes(imageUrl.trim(), 3500);
            if (fetched) {
              resolvedBase64 = fetched.buffer.toString('base64');
              resolvedMime = fetched.contentType;
            }
          }
        }

        const parts: Part[] = [];
        if (resolvedBase64) {
          parts.push({
            inlineData: {
              mimeType: resolvedMime,
              data: resolvedBase64,
            },
          });
        }

        parts.push({
          text: `You are a product specialist for "New Chiko Watch & Electronics".
Inspect the online search snippets AND product photo/details below to accurately identify what "${querySubject || fullLabel}" really is.
Product details: ${fullLabel}
Description: ${String(description || '').slice(0, 320)}
Online search snippets: ${onlineSnippets.slice(0, 1400) || '(none)'}

CRITICAL RULES:
- Any vape, pod kit, disposable puff bar, e-cigarette, humidifier, or aroma diffuser MUST be "vapor" — NEVER "power", even if it mentions "1000mAh" or "Type-C"!
- Any water bottle, thermos, tumbler, flask, mug, perfume, or spray MUST be "liquid".
- Any speaker, earbuds, neckband, or headphones MUST be "audio" — NEVER "power".
- Only classify as "power" if its primary purpose is charging other devices (power bank, wall charger, charging cable, adapter).
- Mini fan / air cooler / hair dryer -> "fan".
- Flashlight / lamp / ring light / lantern -> "light".
- Analog / digital / smartwatch -> "watch".
- Everything else -> "universal".

Return ONLY raw JSON:
{"actionKind":"vapor"|"liquid"|"power"|"audio"|"fan"|"light"|"watch"|"universal","verifiedProductType":"2-5 word real type","title":"2-3 word studio title","activeLabel":"2-4 word active label","tap2Prompt":"short tap prompt"}`,
        });

        const ai = createGeminiClient();
        const response = await generateWithFallbackModel(ai, {
          contents: { parts },
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        const rawText = (response.text || '').trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
          const validKinds = new Set([
            'vapor',
            'liquid',
            'power',
            'audio',
            'fan',
            'light',
            'watch',
            'universal',
          ]);
          const rawKind =
            typeof parsed.actionKind === 'string' ? parsed.actionKind.trim().toLowerCase() : '';
          if (validKinds.has(rawKind)) {
            return res.json({
              verified: true,
              source: 'gemini-online',
              actionKind: rawKind,
              verifiedProductType:
                typeof parsed.verifiedProductType === 'string'
                  ? parsed.verifiedProductType.trim().slice(0, 80)
                  : '',
              title: typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 40) : '',
              activeLabel:
                typeof parsed.activeLabel === 'string'
                  ? parsed.activeLabel.trim().slice(0, 48)
                  : '',
              tap2Prompt:
                typeof parsed.tap2Prompt === 'string' ? parsed.tap2Prompt.trim().slice(0, 56) : '',
            });
          }
        }
      } catch (aiErr) {
        console.warn('Gemini online search fallback to live web snippets:', extractHttpStatus(aiErr));
      }

      // 3. Always-on Live Web Search Classification Fallback (0 API quota dependency!)
      const webClassification = classifyActionKindFromOnlineText(
        `${fullLabel} ${String(description || '')} ${onlineSnippets}`,
        String(category || '')
      );
      return res.json({
        verified: true,
        source: onlineSnippets ? 'live-web-search' : 'metadata-rules',
        actionKind: webClassification.actionKind,
        verifiedProductType: webClassification.verifiedProductType,
        title: '',
        activeLabel: '',
        tap2Prompt: '',
      });
    } catch (error) {
      const status = extractHttpStatus(error);
      console.warn('Online product identification error:', status);
      return res.json({ verified: false });
    }
  });

  const isProduction = !IS_DEV_MODE;

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
