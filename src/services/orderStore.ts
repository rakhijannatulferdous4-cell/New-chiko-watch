import {
  CartItem,
  CheckoutPaymentType,
  CustomerOrder,
  DeliveryZone,
  OrderLineItem,
  OrderStatus,
  PaymentGatewayId,
  StorePaymentSettings,
} from '../types/watch';
import { getStoredCustomerToken } from './customerStore';
import { getStoredAdminToken } from './watchStore';

const CART_STORAGE_KEY = 'new_chiko_cart_v1';
const SETTINGS_CACHE_KEY = 'new_chiko_payment_settings_v1';

export const DEFAULT_PAYMENT_SETTINGS: StorePaymentSettings = {
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
};

export function loadLocalCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        Boolean(item && typeof item.watchId === 'string' && Number(item.quantity) > 0)
    );
  } catch {
    return [];
  }
}

export function saveLocalCart(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function loadCachedPaymentSettings(): StorePaymentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return DEFAULT_PAYMENT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StorePaymentSettings>;
    return {
      ...DEFAULT_PAYMENT_SETTINGS,
      ...parsed,
      gateways: {
        bkash: { ...DEFAULT_PAYMENT_SETTINGS.gateways.bkash, ...(parsed.gateways?.bkash || {}) },
        nagad: { ...DEFAULT_PAYMENT_SETTINGS.gateways.nagad, ...(parsed.gateways?.nagad || {}) },
        rocket: { ...DEFAULT_PAYMENT_SETTINGS.gateways.rocket, ...(parsed.gateways?.rocket || {}) },
      },
    };
  } catch {
    return DEFAULT_PAYMENT_SETTINGS;
  }
}

function cachePaymentSettings(settings: StorePaymentSettings): void {
  try {
    // Never cache sensitive Telegram credentials in browser localStorage
    const safeCopy: StorePaymentSettings = {
      ...settings,
      telegramBotToken: '',
      telegramChatId: '',
    };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(safeCopy));
  } catch {
    // ignore
  }
}

export async function fetchStorePaymentSettings(
  adminToken?: string
): Promise<{ settings: StorePaymentSettings; source: 'supabase' | 'server' | 'local' }> {
  try {
    const token = adminToken || '';
    const res = await fetch('/api/store-settings', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.settings) {
      const merged: StorePaymentSettings = {
        ...DEFAULT_PAYMENT_SETTINGS,
        ...json.settings,
        gateways: {
          bkash: {
            ...DEFAULT_PAYMENT_SETTINGS.gateways.bkash,
            ...(json.settings.gateways?.bkash || {}),
          },
          nagad: {
            ...DEFAULT_PAYMENT_SETTINGS.gateways.nagad,
            ...(json.settings.gateways?.nagad || {}),
          },
          rocket: {
            ...DEFAULT_PAYMENT_SETTINGS.gateways.rocket,
            ...(json.settings.gateways?.rocket || {}),
          },
        },
      };
      cachePaymentSettings(merged);
      return {
        settings: merged,
        source: json.source === 'supabase' ? 'supabase' : 'server',
      };
    }
  } catch {
    // fall back to cached settings
  }
  return { settings: loadCachedPaymentSettings(), source: 'local' };
}

export async function saveStorePaymentSettings(
  settings: StorePaymentSettings,
  adminToken?: string
): Promise<{ settings: StorePaymentSettings; source: 'supabase' | 'server' }> {
  const token = adminToken || getStoredAdminToken();
  const res = await fetch('/api/store-settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(settings),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || 'Could not save payment settings.');
  }
  const saved = json.settings as StorePaymentSettings;
  cachePaymentSettings(saved);
  return {
    settings: saved,
    source: json.source === 'supabase' ? 'supabase' : 'server',
  };
}

export async function sendTestTelegramAlert(
  telegramBotToken: string,
  telegramChatId: string,
  adminToken?: string
): Promise<void> {
  const token = adminToken || getStoredAdminToken();
  const res = await fetch('/api/store-settings/test-telegram', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ telegramBotToken, telegramChatId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || 'Telegram test message failed.');
  }
}

export interface SubmitOrderInput {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_zone: DeliveryZone;
  payment_type: CheckoutPaymentType;
  payment_gateway: PaymentGatewayId | 'cod';
  sender_number: string;
  trx_id: string;
  notes?: string;
  items: OrderLineItem[];
}

export async function submitCustomerOrder(
  payload: SubmitOrderInput,
  customerTokenOverride?: string
): Promise<{ order: CustomerOrder; telegramSent: boolean }> {
  const token = customerTokenOverride || getStoredCustomerToken();
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.order) {
    throw new Error(json?.error || 'Could not place your order. Please verify your details.');
  }
  return {
    order: json.order as CustomerOrder,
    telegramSent: Boolean(json.telegramSent),
  };
}

export async function fetchAdminOrders(adminToken?: string): Promise<CustomerOrder[]> {
  const token = adminToken || getStoredAdminToken();
  if (!token) return [];
  try {
    const res = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.orders)) {
      return json.orders as CustomerOrder[];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  adminToken?: string,
  notes?: string
): Promise<CustomerOrder> {
  const token = adminToken || getStoredAdminToken();
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(notes !== undefined ? { status, notes } : { status }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.order) {
    throw new Error(json?.error || `Failed to update order status (HTTP ${res.status}).`);
  }
  return json.order as CustomerOrder;
}

export async function deleteAdminOrder(orderId: string, adminToken?: string): Promise<void> {
  const token = adminToken || getStoredAdminToken();
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Failed to delete order (HTTP ${res.status}).`);
  }
}

