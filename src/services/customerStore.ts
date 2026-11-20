import {
  CustomerAccount,
  CustomerMessage,
  CustomerOrder,
  DeliveryZone,
  PinResetRequest,
} from '../types/watch';
import { getStoredAdminToken } from './watchStore';

export const CUSTOMER_SESSION_KEY = 'new_chiko_customer_session_v1';

export interface CustomerSessionData {
  token: string;
  account: CustomerAccount;
  orders: CustomerOrder[];
  messages: CustomerMessage[];
}

export function normalizePhoneForMatch(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 11 && digits.slice(-11).startsWith('01')) {
    return digits.slice(-11);
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `0${digits}`;
  }
  return digits.slice(-15);
}

export function formatWhatsAppPhone(raw: string): string {
  const norm = normalizePhoneForMatch(raw);
  if (norm.length === 11 && norm.startsWith('01')) {
    return `88${norm}`;
  }
  return raw.replace(/\D/g, '');
}

export function getStoredCustomerToken(): string {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
}

export function saveStoredCustomerToken(token: string): void {
  try {
    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify({ token }));
  } catch {
    // ignore storage quota errors
  }
}

export function clearStoredCustomerToken(): void {
  try {
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
  } catch {
    // ignore
  }
}

export async function registerCustomerAccount(input: {
  name: string;
  phone: string;
  pin: string;
  default_address?: string;
  delivery_zone?: DeliveryZone;
}): Promise<CustomerSessionData> {
  const res = await fetch('/api/customer/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.token || !json?.account) {
    throw new Error(json?.error || 'Could not create customer account.');
  }
  saveStoredCustomerToken(json.token);
  return {
    token: json.token as string,
    account: json.account as CustomerAccount,
    orders: Array.isArray(json.orders) ? (json.orders as CustomerOrder[]) : [],
    messages: Array.isArray(json.messages) ? (json.messages as CustomerMessage[]) : [],
  };
}

export async function loginCustomerAccount(input: {
  phone: string;
  pin: string;
}): Promise<CustomerSessionData> {
  const res = await fetch('/api/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.token || !json?.account) {
    throw new Error(json?.error || 'Invalid phone number or PIN.');
  }
  saveStoredCustomerToken(json.token);
  return {
    token: json.token as string,
    account: json.account as CustomerAccount,
    orders: Array.isArray(json.orders) ? (json.orders as CustomerOrder[]) : [],
    messages: Array.isArray(json.messages) ? (json.messages as CustomerMessage[]) : [],
  };
}

export async function fetchCustomerSession(
  tokenOverride?: string
): Promise<CustomerSessionData | null> {
  const token = tokenOverride || getStoredCustomerToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/customer/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearStoredCustomerToken();
      return null;
    }
    if (!res.ok || !json?.account) return null;
    return {
      token,
      account: json.account as CustomerAccount,
      orders: Array.isArray(json.orders) ? (json.orders as CustomerOrder[]) : [],
      messages: Array.isArray(json.messages) ? (json.messages as CustomerMessage[]) : [],
    };
  } catch {
    return null;
  }
}

export async function trackGuestOrder(
  orderNumber: string,
  phone: string
): Promise<CustomerOrder> {
  const res = await fetch('/api/customer/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: orderNumber, phone }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.order) {
    throw new Error(json?.error || 'Order not found.');
  }
  return json.order as CustomerOrder;
}

export async function sendCustomerMessageToAdmin(
  body: string,
  orderNumber?: string,
  tokenOverride?: string
): Promise<CustomerMessage> {
  const token = tokenOverride || getStoredCustomerToken();
  const res = await fetch('/api/customer/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ body, order_number: orderNumber || '' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.message) {
    throw new Error(json?.error || 'Failed to send message.');
  }
  return json.message as CustomerMessage;
}

export async function markCustomerMessagesRead(tokenOverride?: string): Promise<void> {
  const token = tokenOverride || getStoredCustomerToken();
  if (!token) return;
  try {
    await fetch('/api/customer/messages/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore
  }
}

export async function fetchAdminCustomerMessages(
  adminToken?: string
): Promise<CustomerMessage[]> {
  const token = adminToken || getStoredAdminToken();
  if (!token) return [];
  try {
    const res = await fetch('/api/admin/messages', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.messages)) {
      return json.messages as CustomerMessage[];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function sendAdminMessageToCustomer(input: {
  customer_phone: string;
  customer_name: string;
  order_number?: string;
  body: string;
  adminToken?: string;
}): Promise<CustomerMessage> {
  const token = input.adminToken || getStoredAdminToken();
  const res = await fetch('/api/admin/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      customer_phone: input.customer_phone,
      customer_name: input.customer_name,
      order_number: input.order_number || '',
      body: input.body,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.message) {
    throw new Error(json?.error || 'Could not send message to customer.');
  }
  return json.message as CustomerMessage;
}

export async function markAdminThreadRead(
  customerPhone: string,
  adminToken?: string
): Promise<void> {
  const token = adminToken || getStoredAdminToken();
  if (!token) return;
  try {
    await fetch('/api/admin/messages/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ customer_phone: customerPhone }),
    });
  } catch {
    // ignore
  }
}

export async function requestCustomerPinReset(phone: string): Promise<{
  customer_code: string;
  expires_in_minutes: number;
  message: string;
}> {
  const res = await fetch('/api/customer/forgot-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || 'Could not request PIN reset.');
  }
  return {
    customer_code: String(json.customer_code || ''),
    expires_in_minutes: Number(json.expires_in_minutes) || 30,
    message: String(json.message || 'PIN reset code requested.'),
  };
}

export async function confirmCustomerPinReset(input: {
  phone: string;
  reset_code: string;
  new_pin: string;
}): Promise<CustomerSessionData> {
  const res = await fetch('/api/customer/reset-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.token || !json?.account) {
    throw new Error(json?.error || 'Invalid or expired reset code.');
  }
  saveStoredCustomerToken(json.token);
  return {
    token: json.token as string,
    account: json.account as CustomerAccount,
    orders: Array.isArray(json.orders) ? (json.orders as CustomerOrder[]) : [],
    messages: Array.isArray(json.messages) ? (json.messages as CustomerMessage[]) : [],
  };
}

export async function fetchAdminPinResets(adminToken?: string): Promise<PinResetRequest[]> {
  const token = adminToken || getStoredAdminToken();
  if (!token) return [];
  try {
    const res = await fetch('/api/admin/pin-resets', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.requests)) {
      return json.requests as PinResetRequest[];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function adminDirectResetCustomerPin(input: {
  customer_phone: string;
  new_pin: string;
  adminToken?: string;
}): Promise<{
  customer_code: string;
  customer_name: string;
  phone: string;
  new_pin: string;
}> {
  const token = input.adminToken || getStoredAdminToken();
  const res = await fetch('/api/admin/customer/reset-pin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      customer_phone: input.customer_phone,
      new_pin: input.new_pin,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || 'Could not reset customer PIN.');
  }
  return {
    customer_code: String(json.customer_code || ''),
    customer_name: String(json.customer_name || ''),
    phone: String(json.phone || input.customer_phone),
    new_pin: String(json.new_pin || input.new_pin),
  };
}

