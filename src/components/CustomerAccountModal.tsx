import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Truck,
  User,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  clearStoredCustomerToken,
  confirmCustomerPinReset,
  CustomerSessionData,
  fetchCustomerSession,
  loginCustomerAccount,
  markCustomerMessagesRead,
  registerCustomerAccount,
  requestCustomerPinReset,
  sendCustomerMessageToAdmin,
  trackGuestOrder,
} from '../services/customerStore';
import { CustomerMessage, CustomerOrder, DeliveryZone, OrderStatus } from '../types/watch';
import { formatBDT } from './TripleTapPrice';

interface CustomerAccountModalProps {
  session: CustomerSessionData | null;
  initialTab?: 'orders' | 'messages' | 'track';
  checkoutGateMessage?: string;
  onClose: () => void;
  onSessionChange: (next: CustomerSessionData | null) => void;
}

type AuthMode = 'signin' | 'register' | 'reset' | 'track';
type PortalTab = 'orders' | 'messages';

const ORDER_STEPS: Array<{ key: OrderStatus; label: string }> = [
  { key: 'Pending', label: 'Pending' },
  { key: 'Verified', label: 'Accepted' },
  { key: 'Shipped', label: 'Shipped' },
  { key: 'Delivered', label: 'Delivered' },
];

function getStatusBannerConfig(order: CustomerOrder) {
  switch (order.status) {
    case 'Verified':
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        badge: 'bg-emerald-600 text-white',
        icon: <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />,
        title: 'Order Approved / Accepted',
        subtitle: 'Your payment & order have been verified by Admin. Preparing for dispatch.',
      };
    case 'Shipped':
      return {
        bg: 'bg-violet-50 border-violet-200 text-violet-900',
        badge: 'bg-violet-600 text-white',
        icon: <Truck size={16} className="text-violet-600 shrink-0" />,
        title: 'Order Shipped — On the Way',
        subtitle: 'Your parcel has been handed over for delivery.',
      };
    case 'Delivered':
      return {
        bg: 'bg-teal-50 border-teal-200 text-teal-900',
        badge: 'bg-teal-600 text-white',
        icon: <PackageCheck size={16} className="text-teal-600 shrink-0" />,
        title: 'Order Delivered',
        subtitle: 'Thank you for shopping with New Chiko Watch & Electronics!',
      };
    case 'Rejected':
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-900',
        badge: 'bg-rose-600 text-white',
        icon: <XCircle size={16} className="text-rose-600 shrink-0" />,
        title: 'Order Rejected',
        subtitle:
          order.notes?.trim() ||
          'This order could not be verified. Please message Admin below if you have questions.',
      };
    default:
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-950',
        badge: 'bg-amber-500 text-white',
        icon: <Clock size={16} className="text-amber-600 shrink-0" />,
        title: 'Pending Verification',
        subtitle: 'Admin is reviewing your order & bKash TrxID. Status updates automatically here.',
      };
  }
}

export function CustomerAccountModal({
  session,
  initialTab = 'orders',
  checkoutGateMessage = '',
  onClose,
  onSessionChange,
}: CustomerAccountModalProps) {
  const [authMode, setAuthMode] = useState<AuthMode>(
    initialTab === 'track' ? 'track' : checkoutGateMessage ? 'register' : 'signin'
  );
  const [portalTab, setPortalTab] = useState<PortalTab>(
    initialTab === 'messages' ? 'messages' : 'orders'
  );

  // Sign In state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');

  // Forgot / Reset PIN state
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetPhone, setResetPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regZone, setRegZone] = useState<DeliveryZone>('inside_city');

  // Guest Track Order state
  const [trackOrderNum, setTrackOrderNum] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<CustomerOrder | null>(null);

  // Shared loading / error
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Messaging state
  const [messageBody, setMessageBody] = useState('');
  const [selectedOrderRef, setSelectedOrderRef] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const unreadAdminMessages = useMemo(
    () =>
      (session?.messages || []).filter((m) => m.sender === 'admin' && !m.read_by_customer).length,
    [session?.messages]
  );

  // Auto-refresh customer session every 12s while modal is open and signed in
  useEffect(() => {
    if (!session?.token) return;
    let cancelled = false;
    const poll = async () => {
      const fresh = await fetchCustomerSession(session.token);
      if (!cancelled && fresh) {
        onSessionChange(fresh);
      }
    };
    const timer = window.setInterval(() => {
      void poll();
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.token, onSessionChange]);

  // Mark admin messages as read when opening the Messages tab
  useEffect(() => {
    if (!session?.token || portalTab !== 'messages') return;
    if (unreadAdminMessages > 0) {
      void markCustomerMessagesRead(session.token).then(() => {
        onSessionChange({
          ...session,
          messages: session.messages.map((m) =>
            m.sender === 'admin' ? { ...m, read_by_customer: true } : m
          ),
        });
      });
    }
  }, [portalTab, unreadAdminMessages, session, onSessionChange]);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (portalTab === 'messages') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [portalTab, session?.messages.length]);

  const handleRefresh = async () => {
    if (!session?.token) return;
    setRefreshing(true);
    try {
      const fresh = await fetchCustomerSession(session.token);
      if (fresh) {
        onSessionChange(fresh);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await loginCustomerAccount({
        phone: loginPhone.trim(),
        pin: loginPin.trim(),
      });
      onSessionChange(data);
      setPortalTab('orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!regName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (regPhone.trim().length < 7) {
      setError('Please enter a valid mobile number (e.g. 017XXXXXXXX).');
      return;
    }
    if (regPin.trim().length < 4) {
      setError('Please create a PIN of at least 4 digits/characters.');
      return;
    }
    setBusy(true);
    try {
      const data = await registerCustomerAccount({
        name: regName.trim(),
        phone: regPhone.trim(),
        pin: regPin.trim(),
        default_address: regAddress.trim(),
        delivery_zone: regZone,
      });
      onSessionChange(data);
      setPortalTab('orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setBusy(false);
    }
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTrackedOrder(null);
    if (!trackOrderNum.trim() || !trackPhone.trim()) {
      setError('Please enter both your Order Number and Phone Number.');
      return;
    }
    setBusy(true);
    try {
      const found = await trackGuestOrder(trackOrderNum.trim(), trackPhone.trim());
      setTrackedOrder(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order not found.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccessMsg('');
    if (resetPhone.trim().length < 7) {
      setError('Please enter your registered mobile number.');
      return;
    }
    setBusy(true);
    try {
      const res = await requestCustomerPinReset(resetPhone.trim());
      setResetSuccessMsg(res.message);
      setResetStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request PIN reset.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (resetPhone.trim().length < 7) {
      setError('Please enter your registered mobile number.');
      return;
    }
    if (resetCode.trim().length < 6) {
      setError('Please enter the 6-digit reset code sent by Admin.');
      return;
    }
    if (resetNewPin.trim().length < 4) {
      setError('New PIN must be at least 4 digits/characters.');
      return;
    }
    setBusy(true);
    try {
      const data = await confirmCustomerPinReset({
        phone: resetPhone.trim(),
        reset_code: resetCode.trim(),
        new_pin: resetNewPin.trim(),
      });
      onSessionChange(data);
      setPortalTab('orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset PIN.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    clearStoredCustomerToken();
    onSessionChange(null);
    setError('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token || !messageBody.trim() || sendingMsg) return;
    setSendingMsg(true);
    setError('');
    try {
      const sent: CustomerMessage = await sendCustomerMessageToAdmin(
        messageBody.trim(),
        selectedOrderRef || undefined,
        session.token
      );
      setMessageBody('');
      onSessionChange({
        ...session,
        messages: [...session.messages, sent],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleMessageAboutOrder = (orderNumber: string) => {
    setSelectedOrderRef(orderNumber);
    setPortalTab('messages');
  };

  const renderOrderCard = (order: CustomerOrder, allowMessageButton: boolean) => {
    const banner = getStatusBannerConfig(order);
    const activeStepIdx = ORDER_STEPS.findIndex((s) => s.key === order.status);

    return (
      <div
        key={order.id}
        className="rounded-2xl bg-white border border-zinc-200 p-4 space-y-3.5 shadow-2xs"
      >
        {/* Top Row: Order # + Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-num text-sm font-bold text-[#09090B]">
                {order.order_number}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${banner.badge}`}>
                {order.status === 'Verified' ? 'Accepted' : order.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          {allowMessageButton && (
            <button
              type="button"
              onClick={() => handleMessageAboutOrder(order.order_number)}
              className="min-h-[32px] px-2.5 rounded-lg border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-800 flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare size={12} />
              <span>Message Admin</span>
            </button>
          )}
        </div>

        {/* Crystal-Clear Approval / Rejection Banner */}
        <div className={`rounded-xl border p-3 flex items-start gap-2.5 ${banner.bg}`}>
          <div className="mt-0.5">{banner.icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-bold">{banner.title}</p>
            <p className="text-[11px] opacity-90 leading-relaxed mt-0.5">{banner.subtitle}</p>
          </div>
        </div>

        {/* 4-Step Progress Bar (Hidden if Rejected) */}
        {order.status !== 'Rejected' && (
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            {ORDER_STEPS.map((step, idx) => {
              const reached = activeStepIdx >= idx;
              return (
                <div key={step.key} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      reached ? 'bg-[#09090B]' : 'bg-zinc-200'
                    }`}
                  />
                  <p
                    className={`text-[10px] font-semibold text-center ${
                      reached ? 'text-[#09090B]' : 'text-zinc-400'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Items & Payment Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-xl bg-zinc-50 border border-zinc-200/70 p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
            </p>
            {order.items.map((item, idx) => (
              <div
                key={`${order.id}-${item.watchId}-${idx}`}
                className="flex items-start justify-between gap-2 text-[11.5px]"
              >
                <span className="text-zinc-800 line-clamp-1">
                  {item.productName} × {item.quantity}
                </span>
                <span className="font-mono-num font-semibold text-[#09090B] shrink-0">
                  {formatBDT(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-zinc-50 border border-zinc-200/70 p-3 space-y-1 text-[11.5px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Payment Summary
            </p>
            <div className="flex justify-between">
              <span className="text-zinc-600">Total</span>
              <span className="font-mono-num font-bold text-[#09090B]">
                {formatBDT(order.total_amount)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Paid Now</span>
              <span className="font-mono-num font-bold">{formatBDT(order.paid_amount)}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>Due (COD)</span>
              <span className="font-mono-num font-bold">{formatBDT(order.due_amount)}</span>
            </div>
            {order.trx_id && (
              <div className="flex justify-between pt-1 border-t border-zinc-200/70">
                <span className="text-zinc-500">TrxID</span>
                <span className="font-mono-num font-bold text-[#E2136E]">{order.trx_id}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-5 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Customer Account & Order Portal"
    >
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl md:rounded-2xl bg-[#FCFBFA] border border-zinc-200 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-white border-b border-zinc-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#09090B] text-white flex items-center justify-center shrink-0">
              {session ? <BadgeCheck size={19} /> : <User size={19} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#09090B] truncate">
                  {session ? session.account.name : 'Customer Account & Orders'}
                </h2>
                {session && (
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-white font-mono-num text-[10.5px] font-bold">
                    {session.account.customer_code}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 truncate">
                {session
                  ? `${session.account.phone} · Live Order Status & Direct Admin Chat`
                  : 'Sign in or create a Customer ID to track orders & message Admin'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {session && (
              <>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
                  title="Refresh order status & messages"
                  aria-label="Refresh"
                >
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[36px] px-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-1 cursor-pointer"
                  title="Sign out"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
              aria-label="Close customer portal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!session ? (
          <div className="p-5 overflow-y-auto space-y-4">
            {checkoutGateMessage && (
              <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs text-amber-950 font-medium flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Customer Account Required to Place Order</p>
                  <p className="text-[11.5px] leading-relaxed">{checkoutGateMessage}</p>
                </div>
              </div>
            )}

            {/* Auth / Track Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-200/70 border border-zinc-200">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setError('');
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'signin' || authMode === 'reset'
                    ? 'bg-white text-[#09090B] shadow-xs'
                    : 'text-zinc-600 hover:text-[#09090B]'
                }`}
              >
                <KeyRound size={13} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError('');
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'register'
                    ? 'bg-white text-[#09090B] shadow-xs'
                    : 'text-zinc-600 hover:text-[#09090B]'
                }`}
              >
                <UserPlus size={13} />
                <span>Create ID</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('track');
                  setError('');
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'track'
                    ? 'bg-white text-[#09090B] shadow-xs'
                    : 'text-zinc-600 hover:text-[#09090B]'
                }`}
              >
                <Search size={13} />
                <span>Track Order</span>
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {authMode === 'signin' && (
              <form onSubmit={handleSignIn} className="rounded-2xl bg-white border border-zinc-200 p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold text-[#09090B]">
                    Sign In with Your Phone &amp; PIN
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Check if your orders are Approved or Rejected, view full order history, and message Admin directly.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                    <Phone size={13} className="text-zinc-400" /> Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <KeyRound size={13} className="text-zinc-400" /> Account PIN
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetPhone(loginPhone);
                        setResetStep('request');
                        setResetSuccessMsg('');
                        setError('');
                        setAuthMode('reset');
                      }}
                      className="text-[11.5px] font-semibold text-rose-700 hover:underline cursor-pointer"
                    >
                      Forgot PIN?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value)}
                    placeholder="Enter your 4+ digit PIN"
                    className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-xl bg-[#09090B] text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>Sign In to My Account</span>
                </button>

                <p className="text-[11.5px] text-center text-zinc-500">
                  New customer?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                    }}
                    className="font-semibold text-[#09090B] underline cursor-pointer"
                  >
                    Create your Customer ID
                  </button>{' '}
                  — past orders placed with your phone link automatically!
                </p>
              </form>
            )}

            {authMode === 'reset' && (
              <div className="rounded-2xl bg-white border border-zinc-200 p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-[#09090B]">
                      Forgot PIN? Reset Your Account PIN
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Step 1: Request a 6-digit reset code from Admin. Step 2: Enter the code Admin sends to your phone/WhatsApp and set a new PIN.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setError('');
                    }}
                    className="text-xs font-semibold text-zinc-600 hover:text-[#09090B] underline shrink-0 cursor-pointer"
                  >
                    Back
                  </button>
                </div>

                {resetSuccessMsg && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 leading-relaxed flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{resetSuccessMsg}</span>
                  </div>
                )}

                {resetStep === 'request' ? (
                  <form onSubmit={handleRequestPinReset} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                        <Phone size={13} className="text-zinc-400" /> Registered Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full min-h-[44px] rounded-xl bg-[#09090B] text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                      <span>Request 6-Digit Reset Code from Admin</span>
                    </button>
                    <p className="text-[11.5px] text-center text-zinc-500">
                      Already received the 6-digit code from Admin?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setResetStep('confirm');
                          setError('');
                        }}
                        className="font-semibold text-[#09090B] underline cursor-pointer"
                      >
                        Enter Reset Code
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmPinReset} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700">
                        Registered Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700">
                          6-Digit Reset Code *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          maxLength={6}
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g. 482910"
                          className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num font-bold tracking-widest text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700">
                          New PIN (4+ digits) *
                        </label>
                        <input
                          type="password"
                          required
                          minLength={4}
                          value={resetNewPin}
                          onChange={(e) => setResetNewPin(e.target.value)}
                          placeholder="Enter new PIN"
                          className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      <span>Set New PIN &amp; Sign In</span>
                    </button>
                    <p className="text-[11.5px] text-center text-zinc-500">
                      Need a fresh code?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setResetStep('request');
                          setError('');
                        }}
                        className="font-semibold text-[#09090B] underline cursor-pointer"
                      >
                        Request Again
                      </button>
                    </p>
                  </form>
                )}
              </div>
            )}

            {authMode === 'register' && (
              <form onSubmit={handleRegister} className="rounded-2xl bg-white border border-zinc-200 p-5 space-y-3.5">
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold text-[#09090B]">
                    Create Your Customer ID
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Use the same phone number you ordered with — all past &amp; future orders will appear in your history automatically.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <User size={13} className="text-zinc-400" /> Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Tanvir Ahmed"
                      className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <Phone size={13} className="text-zinc-400" /> Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <KeyRound size={13} className="text-zinc-400" /> Create PIN (4+ digits) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value)}
                      placeholder="e.g. 1234"
                      className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                      <Truck size={13} className="text-zinc-400" /> Default Zone
                    </label>
                    <select
                      value={regZone}
                      onChange={(e) => setRegZone(e.target.value as DeliveryZone)}
                      className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3 text-sm text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                    >
                      <option value="inside_city">Inside City</option>
                      <option value="outside_city">Outside City</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                    <MapPin size={13} className="text-zinc-400" /> Default Delivery Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="House, Road, Area, District (auto-fills checkout)"
                    className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-xl bg-[#09090B] text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  <span>Create Customer ID &amp; Enter</span>
                </button>
              </form>
            )}

            {authMode === 'track' && (
              <div className="space-y-4">
                <form
                  onSubmit={handleTrackOrder}
                  className="rounded-2xl bg-white border border-zinc-200 p-5 space-y-3.5"
                >
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-[#09090B]">
                      Quick Guest Order Status Check
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Enter your Order Number and Phone Number to instantly check if your order is Accepted, Shipped, Delivered, or Rejected.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700">Order Number *</label>
                      <input
                        type="text"
                        required
                        value={trackOrderNum}
                        onChange={(e) => setTrackOrderNum(e.target.value.toUpperCase())}
                        placeholder="e.g. NCW-261120-1234"
                        className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num uppercase text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={trackPhone}
                        onChange={(e) => setTrackPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[44px] rounded-xl bg-[#09090B] text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    <span>Check Order Status</span>
                  </button>
                </form>

                {trackedOrder && renderOrderCard(trackedOrder, false)}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Logged-in Portal Navigation Tabs */}
            <div className="px-5 pt-3 pb-2 bg-white border-b border-zinc-200 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPortalTab('orders')}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    portalTab === 'orders'
                      ? 'bg-[#09090B] text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  <Package size={14} />
                  <span>My Order History ({session.orders.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPortalTab('messages')}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    portalTab === 'messages'
                      ? 'bg-[#09090B] text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  <MessageSquare size={14} />
                  <span>Messages with Admin</span>
                  {unreadAdminMessages > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-mono-num text-[10px] font-bold animate-pulse">
                      {unreadAdminMessages}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Logged-in Body */}
            {portalTab === 'orders' ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                {session.orders.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-zinc-200 p-10 text-center space-y-2">
                    <Package size={28} className="mx-auto text-zinc-400" />
                    <h3 className="text-sm font-bold text-[#09090B]">No orders yet</h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Any order you place using{' '}
                      <span className="font-mono-num font-semibold text-zinc-800">
                        {session.account.phone}
                      </span>{' '}
                      will show up here with live Accepted / Shipped / Delivered / Rejected updates.
                    </p>
                  </div>
                ) : (
                  session.orders.map((order) => renderOrderCard(order, true))
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Chat Messages List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {session.messages.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-zinc-200 p-8 text-center space-y-2">
                      <MessageSquare size={26} className="mx-auto text-zinc-400" />
                      <h3 className="text-sm font-bold text-[#09090B]">
                        Direct Inbox with Store Admin
                      </h3>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        Order acceptance/rejection alerts and personal messages from Admin appear here. Send a message below anytime!
                      </p>
                    </div>
                  ) : (
                    session.messages.map((msg) => {
                      const isCustomer = msg.sender === 'customer';
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs space-y-1 shadow-2xs ${
                              isCustomer
                                ? 'bg-[#09090B] text-white rounded-br-sm'
                                : 'bg-white border border-zinc-200 text-[#09090B] rounded-bl-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] opacity-75">
                              <span className="font-bold">
                                {isCustomer ? 'You' : 'Store Admin'}
                              </span>
                              {msg.order_number && (
                                <span className="font-mono-num font-semibold">
                                  #{msg.order_number}
                                </span>
                              )}
                            </div>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                            <p className="text-[9.5px] opacity-60 text-right">
                              {new Date(msg.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Compose Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3.5 bg-white border-t border-zinc-200 space-y-2 shrink-0"
                >
                  {error && (
                    <p className="text-[11px] text-rose-600 font-medium px-1">{error}</p>
                  )}
                  {session.orders.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-semibold text-zinc-500 shrink-0">
                        Regarding:
                      </span>
                      <select
                        value={selectedOrderRef}
                        onChange={(e) => setSelectedOrderRef(e.target.value)}
                        className="flex-1 min-h-[30px] rounded-lg bg-zinc-50 border border-zinc-200 px-2 text-[11px] font-mono-num text-zinc-800 focus:outline-none focus:border-zinc-900"
                      >
                        <option value="">General Inquiry</option>
                        {session.orders.map((o) => (
                          <option key={o.id} value={o.order_number}>
                            {o.order_number} ({o.status === 'Verified' ? 'Accepted' : o.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Write a message to Admin..."
                      className="flex-1 min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-xs text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                    />
                    <button
                      type="submit"
                      disabled={sendingMsg || !messageBody.trim()}
                      className="min-h-[42px] px-4 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-45 flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {sendingMsg ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Send</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
