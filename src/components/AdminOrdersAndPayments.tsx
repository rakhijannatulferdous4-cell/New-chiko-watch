import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  KeyRound,
  Loader2,
  MapPin,
  MessageSquare,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import {
  adminDirectResetCustomerPin,
  formatWhatsAppPhone,
  markAdminThreadRead,
  normalizePhoneForMatch,
  sendAdminMessageToCustomer,
} from '../services/customerStore';
import {
  deleteAdminOrder,
  saveStorePaymentSettings,
  sendTestTelegramAlert,
  updateOrderStatus,
} from '../services/orderStore';
import {
  CustomerMessage,
  CustomerOrder,
  OrderStatus,
  PaymentAccountType,
  PaymentGatewayId,
  PinResetRequest,
  StorePaymentSettings,
} from '../types/watch';
import { formatBDT } from './TripleTapPrice';

/* ============================================================================
 * 1. ADMIN ORDERS MANAGEMENT VIEW
 * ============================================================================ */

interface AdminOrdersViewProps {
  orders: CustomerOrder[];
  customerMessages?: CustomerMessage[];
  adminToken: string;
  loading?: boolean;
  onRefreshOrders: () => Promise<void>;
  onOrderUpdated: (updated: CustomerOrder) => void;
  onOrderDeleted?: (orderId: string) => void;
  onMessageSent?: (msg: CustomerMessage) => void;
  onThreadMarkedRead?: (phoneNormalized: string) => void;
  onConvertOrderToMemo?: (order: CustomerOrder) => void;
}

const ORDER_STATUS_FLOW: OrderStatus[] = ['Pending', 'Verified', 'Shipped', 'Delivered'];
const ORDER_FILTER_TABS: Array<'All' | OrderStatus> = [
  'All',
  'Pending',
  'Verified',
  'Shipped',
  'Delivered',
  'Rejected',
];

const REJECT_REASON_PRESETS = [
  'Invalid / Fake TrxID',
  'Amount Mismatch',
  'Duplicate Order',
  'Out of Stock',
];

const STATUS_BADGE_STYLES: Record<OrderStatus, string> = {
  Pending: 'bg-amber-100 text-amber-900 border-amber-200',
  Verified: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  Shipped: 'bg-violet-100 text-violet-900 border-violet-200',
  Delivered: 'bg-teal-100 text-teal-900 border-teal-200',
  Rejected: 'bg-rose-100 text-rose-900 border-rose-200',
};

function cleanWholeNumberInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

function buildOrderPhoneMessageText(order: CustomerOrder): string {
  const statusText =
    order.status === 'Verified'
      ? 'ACCEPTED / VERIFIED'
      : order.status === 'Rejected'
      ? `REJECTED${order.notes ? ` (${order.notes})` : ''}`
      : order.status.toUpperCase();
  return `Assalamu Alaikum ${order.customer_name}, your order ${order.order_number} at New Chiko Watch & Electronics is now ${statusText}. Paid: ${formatBDT(order.paid_amount)} | Due (COD): ${formatBDT(order.due_amount)}. Thank you!`;
}

export function AdminOrdersView({
  orders,
  customerMessages = [],
  adminToken,
  loading = false,
  onRefreshOrders,
  onOrderUpdated,
  onOrderDeleted,
  onMessageSent,
  onThreadMarkedRead,
  onConvertOrderToMemo,
}: AdminOrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);
  const [copiedTrx, setCopiedTrx] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Invalid / Fake TrxID');
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [openChatOrderId, setOpenChatOrderId] = useState<string | null>(null);
  const [orderChatDraft, setOrderChatDraft] = useState('');
  const [sendingOrderMsg, setSendingOrderMsg] = useState(false);

  useEffect(() => {
    if (!confirmDeleteOrderId) return;
    const timer = window.setTimeout(() => setConfirmDeleteOrderId(null), 4500);
    return () => window.clearTimeout(timer);
  }, [confirmDeleteOrderId]);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'Rejected');
    const pending = orders.filter((o) => o.status === 'Pending').length;
    const verified = orders.filter((o) => o.status === 'Verified').length;
    const shipped = orders.filter((o) => o.status === 'Shipped').length;
    const delivered = orders.filter((o) => o.status === 'Delivered').length;
    const rejected = orders.filter((o) => o.status === 'Rejected').length;
    const totalPaid = activeOrders.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0);
    const totalDue = activeOrders.reduce((sum, o) => sum + (Number(o.due_amount) || 0), 0);
    return { pending, verified, shipped, delivered, rejected, totalPaid, totalDue };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.delivery_address} ${o.trx_id} ${o.sender_number}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orders, statusFilter, searchQuery]);

  const handleStatusChange = async (
    order: CustomerOrder,
    nextStatus: OrderStatus,
    noteOverride?: string
  ) => {
    if (order.status === nextStatus && noteOverride === undefined) return;
    setBusyOrderId(order.id);
    setActionError('');
    setActionNotice('');
    try {
      const updated = await updateOrderStatus(order.id, nextStatus, adminToken, noteOverride);
      onOrderUpdated(updated);
      if (rejectingOrderId === order.id) {
        setRejectingOrderId(null);
      }
      setActionNotice(
        `Order ${order.order_number} marked as ${
          nextStatus === 'Verified' ? 'Accepted / Verified' : nextStatus
        }. Customer account notification sent automatically.`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update order status. Please try again.';
      setActionError(msg);
      console.error('Status update failed:', err);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleDeleteOrder = async (order: CustomerOrder) => {
    if (deletingOrderId) return;
    setDeletingOrderId(order.id);
    setActionError('');
    setActionNotice('');
    try {
      await deleteAdminOrder(order.id, adminToken);
      setConfirmDeleteOrderId(null);
      if (rejectingOrderId === order.id) setRejectingOrderId(null);
      if (openChatOrderId === order.id) setOpenChatOrderId(null);
      onOrderDeleted?.(order.id);
      setActionNotice(`Order ${order.order_number} permanently deleted.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete order. Please try again.'
      );
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleToggleOrderChat = (order: CustomerOrder) => {
    const nextId = openChatOrderId === order.id ? null : order.id;
    setOpenChatOrderId(nextId);
    setOrderChatDraft('');
    if (nextId) {
      const phoneKey = normalizePhoneForMatch(order.customer_phone);
      const hasUnread = customerMessages.some(
        (m) =>
          m.customer_phone_normalized === phoneKey &&
          m.sender === 'customer' &&
          !m.read_by_admin
      );
      if (hasUnread) {
        void markAdminThreadRead(order.customer_phone, adminToken).then(() => {
          onThreadMarkedRead?.(phoneKey);
        });
      }
    }
  };

  const handleSendOrderChat = async (e: React.FormEvent, order: CustomerOrder) => {
    e.preventDefault();
    if (!orderChatDraft.trim() || sendingOrderMsg) return;
    setSendingOrderMsg(true);
    setActionError('');
    try {
      const msg = await sendAdminMessageToCustomer({
        customer_phone: order.customer_phone,
        customer_name: order.customer_name,
        order_number: order.order_number,
        body: orderChatDraft.trim(),
        adminToken,
      });
      setOrderChatDraft('');
      onMessageSent?.(msg);
      onThreadMarkedRead?.(normalizePhoneForMatch(order.customer_phone));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send message to customer.');
    } finally {
      setSendingOrderMsg(false);
    }
  };

  const handleCopyTrx = async (trx: string) => {
    try {
      await navigator.clipboard.writeText(trx);
      setCopiedTrx(trx);
      window.setTimeout(() => setCopiedTrx(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setActionError('');
    try {
      await onRefreshOrders();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-xl bg-rose-50 border border-rose-300 px-4 py-3 text-xs text-rose-800 font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            onClick={() => setActionError('')}
            className="p-1 rounded-md hover:bg-rose-100 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {actionNotice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800 font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
            <span>{actionNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setActionNotice('')}
            className="p-1 rounded-md hover:bg-emerald-100 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X size={13} />
          </button>
        </div>
      )}
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Pending Verification</span>
            <Clock size={15} className="text-amber-600" />
          </div>
          <p className="font-mono-num text-2xl font-bold text-[#09090B] mt-1.5">{stats.pending}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Awaiting TrxID check</p>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Total Orders</span>
            <PackageCheck size={15} className="text-zinc-900" />
          </div>
          <p className="font-mono-num text-2xl font-bold text-[#09090B] mt-1.5">{orders.length}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {stats.verified} Verified · {stats.shipped} Shipped · {stats.delivered} Delivered
          </p>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Advance / Paid</span>
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
          <p className="font-mono-num text-xl font-bold text-emerald-700 mt-1.5">
            {formatBDT(stats.totalPaid)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Via bKash / Mobile Banking</p>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>COD Due Amount</span>
            <Truck size={15} className="text-zinc-700" />
          </div>
          <p className="font-mono-num text-xl font-bold text-[#09090B] mt-1.5">
            {formatBDT(stats.totalDue)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Collectible on delivery</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, Customer Name, Phone, or bKash TrxID..."
              className="w-full min-h-[40px] rounded-xl bg-zinc-50 border border-zinc-200 pl-9 pr-3 text-xs text-[#09090B] focus:outline-none focus:bg-white focus:border-zinc-950"
            />
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="min-h-[40px] px-3.5 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 hover:bg-zinc-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh Orders</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {ORDER_FILTER_TABS.map((tab) => {
            const count =
              tab === 'All' ? orders.length : orders.filter((o) => o.status === tab).length;
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? tab === 'Rejected'
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#09090B] text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {tab === 'Verified' ? 'Accepted' : tab} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      {loading && orders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-zinc-200 p-10 text-center text-xs text-zinc-500">
          Loading incoming orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-zinc-200 p-10 text-center space-y-2">
          <PackageCheck size={28} className="mx-auto text-zinc-400" />
          <h3 className="text-sm font-semibold text-[#09090B]">No orders found</h3>
          <p className="text-xs text-zinc-500">
            New customer orders from &ldquo;Add to Cart&rdquo; or &ldquo;Buy Now&rdquo; will appear here in real time with sound alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isFullPaid = order.payment_type === 'full_payment';
            const paymentBadgeText = isFullPaid
              ? 'FULL PAID'
              : order.paid_amount > 0
              ? 'COD - DELIVERY PAID'
              : 'CASH ON DELIVERY';
            const gwLabel =
              order.payment_gateway === 'bkash'
                ? 'bKash'
                : order.payment_gateway === 'nagad'
                ? 'Nagad'
                : order.payment_gateway === 'rocket'
                ? 'Rocket'
                : 'COD';

            const isRejected = order.status === 'Rejected';
            const isPending = order.status === 'Pending';
            const isRejectBoxOpen = rejectingOrderId === order.id;
            const phoneKey = normalizePhoneForMatch(order.customer_phone);
            const orderThread = customerMessages.filter(
              (m) => m.customer_phone_normalized === phoneKey
            );
            const unreadFromCustomer = orderThread.filter(
              (m) => m.sender === 'customer' && !m.read_by_admin
            ).length;
            const isChatOpen = openChatOrderId === order.id;
            const quickPhoneText = encodeURIComponent(buildOrderPhoneMessageText(order));
            const waPhone = formatWhatsAppPhone(order.customer_phone);

            return (
              <div
                key={order.id}
                className={`rounded-2xl bg-white border p-4 sm:p-5 shadow-2xs space-y-4 ${
                  isRejected ? 'border-rose-200 bg-rose-50/20' : 'border-zinc-200'
                }`}
              >
                {/* Top Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-sm font-bold text-[#09090B]">
                        {order.order_number}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-bold tracking-wide ${
                          isFullPaid
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {paymentBadgeText}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-bold border ${
                          STATUS_BADGE_STYLES[order.status]
                        }`}
                      >
                        {order.status === 'Verified' ? 'Accepted / Verified' : order.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Placed {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* 1-Click Status Progression Bar */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ORDER_STATUS_FLOW.map((st) => {
                      const active = order.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => handleStatusChange(order, st)}
                          className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                            active
                              ? 'bg-[#09090B] text-white shadow-xs'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          {st === 'Verified' ? 'Accept' : st}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={busyOrderId === order.id}
                      onClick={() => {
                        if (isRejected) return;
                        setRejectReason('Invalid / Fake TrxID');
                        setRejectingOrderId(isRejectBoxOpen ? null : order.id);
                      }}
                      className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                        isRejected || isRejectBoxOpen
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <XCircle size={12} />
                      <span>{isRejected ? 'Rejected' : 'Reject'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleOrderChat(order)}
                      className={`min-h-[32px] px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        isChatOpen
                          ? 'bg-[#09090B] border-[#09090B] text-white'
                          : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50'
                      }`}
                      title="Message customer inside their account"
                    >
                      <MessageSquare size={12} />
                      <span>Chat</span>
                      {unreadFromCustomer > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono-num text-[9.5px] font-bold">
                          {unreadFromCustomer}
                        </span>
                      )}
                    </button>
                    {onConvertOrderToMemo && !isRejected && (
                      <button
                        type="button"
                        onClick={() => onConvertOrderToMemo(order)}
                        className="min-h-[32px] px-2.5 rounded-lg border border-zinc-300 bg-white text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                        title="Open in Digital Memo Builder"
                      >
                        <ReceiptText size={12} />
                        <span>Memo</span>
                      </button>
                    )}
                    {confirmDeleteOrderId === order.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={deletingOrderId === order.id}
                          onClick={() => void handleDeleteOrder(order)}
                          className="min-h-[32px] px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                          aria-label={`Confirm delete order ${order.order_number}`}
                        >
                          {deletingOrderId === order.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          <span>Confirm Delete</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingOrderId === order.id}
                          onClick={() => setConfirmDeleteOrderId(null)}
                          className="min-h-[32px] px-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 text-[11px] font-semibold hover:bg-zinc-50 cursor-pointer"
                          aria-label="Cancel delete order"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busyOrderId === order.id || deletingOrderId === order.id}
                        onClick={() => setConfirmDeleteOrderId(order.id)}
                        className="min-h-[32px] px-2.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                        title="Delete order from list"
                        aria-label={`Delete order ${order.order_number}`}
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Prominent Top-of-Card Reject Order Confirmation Panel (immediately visible) */}
                {isRejectBoxOpen && !isRejected && (
                  <div className="rounded-xl bg-rose-50 border-2 border-rose-300 p-3.5 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                        <XCircle size={15} className="text-rose-600" />
                        Confirm Reject Order ({order.order_number})
                      </p>
                      <button
                        type="button"
                        onClick={() => setRejectingOrderId(null)}
                        className="p-1 rounded-md text-rose-700 hover:bg-rose-100 cursor-pointer"
                        aria-label="Close reject box"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Select or type a reason below. The customer will immediately see &ldquo;Order Rejected&rdquo; with this reason in their account inbox.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {REJECT_REASON_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRejectReason(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                            rejectReason === preset
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'bg-white border-rose-200 text-rose-800 hover:bg-rose-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        className="flex-1 min-h-[38px] rounded-lg bg-white border border-rose-300 px-3 text-xs text-[#09090B] focus:outline-none focus:border-rose-600"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() =>
                            handleStatusChange(
                              order,
                              'Rejected',
                              rejectReason.trim()
                                ? `Rejected: ${rejectReason.trim()}`
                                : 'Rejected by Admin'
                            )
                          }
                          className="min-h-[38px] px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {busyOrderId === order.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <XCircle size={14} />
                          )}
                          <span>Confirm Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingOrderId(null)}
                          className="min-h-[38px] px-3 rounded-lg border border-zinc-300 bg-white text-zinc-700 text-xs font-semibold hover:bg-zinc-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                  {/* Customer Info */}
                  <div className="lg:col-span-4 rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Customer &amp; Delivery
                    </p>
                    <p className="font-bold text-sm text-[#09090B]">{order.customer_name}</p>
                    <p className="font-mono-num text-zinc-800 flex items-center gap-1.5">
                      <Phone size={12} className="text-zinc-400" /> {order.customer_phone}
                    </p>
                    <p className="text-zinc-700 flex items-start gap-1.5 leading-relaxed">
                      <MapPin size={12} className="text-zinc-400 shrink-0 mt-0.5" />
                      <span>{order.delivery_address}</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 pt-0.5">
                      Zone:{' '}
                      <strong className="text-zinc-800">
                        {order.delivery_zone === 'outside_city' ? 'Outside City' : 'Inside City'}
                      </strong>{' '}
                      ({formatBDT(order.delivery_charge)})
                    </p>
                    {order.notes && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1">
                        Note: {order.notes}
                      </p>
                    )}

                    {/* 1-Click Phone & Account Messaging Shortcuts */}
                    <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-200/70">
                      {waPhone && (
                        <a
                          href={`https://wa.me/${waPhone}?text=${quickPhoneText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[30px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <Smartphone size={11} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      <a
                        href={`sms:${order.customer_phone}?body=${quickPhoneText}`}
                        className="min-h-[30px] px-2.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-[10.5px] font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <Phone size={11} />
                        <span>SMS</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleToggleOrderChat(order)}
                        className="min-h-[30px] px-2.5 rounded-lg bg-[#09090B] hover:bg-zinc-800 text-white text-[10.5px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <MessageSquare size={11} />
                        <span>Account Msg{orderThread.length > 0 ? ` (${orderThread.length})` : ''}</span>
                      </button>
                    </div>
                  </div>

                  {/* Ordered Items */}
                  <div className="lg:col-span-4 rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Ordered Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${order.id}-${item.watchId}-${idx}`}
                          className="flex items-start justify-between gap-2 pb-1.5 border-b border-zinc-200/60 last:border-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[#09090B] line-clamp-1">
                              {item.productName}
                            </p>
                            <p className="text-[10.5px] text-zinc-500">
                              {item.brand} · {item.color} × {item.quantity}
                            </p>
                          </div>
                          <span className="font-mono-num font-semibold text-zinc-900 shrink-0">
                            {formatBDT(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment & TrxID Verification */}
                  <div className="lg:col-span-4 rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Payment &amp; TrxID Verification
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white border border-zinc-200 p-2">
                        <span className="text-[10px] text-zinc-500 block">Paid Now</span>
                        <span className="font-mono-num text-sm font-bold text-emerald-700">
                          {formatBDT(order.paid_amount)}
                        </span>
                      </div>
                      <div className="rounded-lg bg-white border border-zinc-200 p-2">
                        <span className="text-[10px] text-zinc-500 block">Due (COD)</span>
                        <span className="font-mono-num text-sm font-bold text-amber-800">
                          {formatBDT(order.due_amount)}
                        </span>
                      </div>
                    </div>

                    {order.trx_id ? (
                      <div className="rounded-lg bg-white border border-zinc-200 p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-semibold text-zinc-500">
                            {gwLabel} TrxID
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyTrx(order.trx_id)}
                            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#09090B] hover:opacity-75 cursor-pointer"
                          >
                            {copiedTrx === order.trx_id ? (
                              <>
                                <Check size={11} className="text-emerald-600" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={11} /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <p className="font-mono-num text-sm font-bold text-[#E2136E] tracking-wide">
                          {order.trx_id}
                        </p>
                        <p className="text-[11px] text-zinc-600 font-mono-num">
                          Sender: <strong>{order.sender_number}</strong>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-500">
                        Pure Cash on Delivery — no advance TrxID submitted.
                      </p>
                    )}

                    {/* Prominent Accept / Reject Decision Bar for TrxID Verification */}
                    {isPending && !isRejectBoxOpen && (
                      <div className="pt-1 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => handleStatusChange(order, 'Verified')}
                          className="min-h-[38px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 size={14} />
                          <span>Accept Order</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => {
                            setRejectReason('Invalid / Fake TrxID');
                            setRejectingOrderId(order.id);
                          }}
                          className="min-h-[38px] px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          <XCircle size={14} />
                          <span>Reject Order</span>
                        </button>
                      </div>
                    )}

                    {isRejected && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-rose-800">
                          Order Rejected
                        </span>
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => handleStatusChange(order, 'Verified', '')}
                          className="min-h-[30px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          Restore &amp; Accept
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Two-Way Customer Account Chat Thread */}
                {isChatOpen && (
                  <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-2">
                      <p className="text-xs font-bold text-[#09090B] flex items-center gap-1.5">
                        <MessageSquare size={14} />
                        Account Messages with {order.customer_name} ({order.customer_phone})
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenChatOrderId(null)}
                        className="p-1 rounded-md text-zinc-500 hover:bg-zinc-200 cursor-pointer"
                        aria-label="Close chat"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {orderThread.length === 0 ? (
                        <p className="text-[11px] text-zinc-500 text-center py-3">
                          No messages yet. Send a message below — it appears immediately in the customer&apos;s account inbox.
                        </p>
                      ) : (
                        orderThread.map((msg) => {
                          const isAdminMsg = msg.sender === 'admin';
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isAdminMsg ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs space-y-0.5 ${
                                  isAdminMsg
                                    ? 'bg-[#09090B] text-white'
                                    : 'bg-white border border-zinc-200 text-[#09090B]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-[10px] opacity-75">
                                  <span className="font-bold">
                                    {isAdminMsg ? 'Admin (You)' : msg.customer_name}
                                  </span>
                                  {msg.order_number && (
                                    <span className="font-mono-num">#{msg.order_number}</span>
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
                    </div>

                    <form onSubmit={(e) => handleSendOrderChat(e, order)} className="flex gap-2">
                      <input
                        type="text"
                        value={orderChatDraft}
                        onChange={(e) => setOrderChatDraft(e.target.value)}
                        placeholder={`Send account message to ${order.customer_name}...`}
                        className="flex-1 min-h-[38px] rounded-lg bg-white border border-zinc-300 px-3 text-xs text-[#09090B] focus:outline-none focus:border-[#09090B]"
                      />
                      <button
                        type="submit"
                        disabled={sendingOrderMsg || !orderChatDraft.trim()}
                        className="min-h-[38px] px-3.5 rounded-lg bg-[#09090B] hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 shrink-0"
                      >
                        {sendingOrderMsg ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        <span>Send</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 2. ADMIN PAYMENT & DELIVERY SETTINGS VIEW
 * ============================================================================ */

interface AdminPaymentSettingsViewProps {
  settings: StorePaymentSettings;
  adminToken: string;
  onSettingsSaved: (next: StorePaymentSettings) => void;
}

const ACCOUNT_TYPES: PaymentAccountType[] = ['Personal', 'Agent', 'Merchant'];

export function AdminPaymentSettingsView({
  settings,
  adminToken,
  onSettingsSaved,
}: AdminPaymentSettingsViewProps) {
  const [draft, setDraft] = useState<StorePaymentSettings>(settings);
  const [insideChargeStr, setInsideChargeStr] = useState<string>(
    settings.insideCityCharge ? String(settings.insideCityCharge) : ''
  );
  const [outsideChargeStr, setOutsideChargeStr] = useState<string>(
    settings.outsideCityCharge ? String(settings.outsideCityCharge) : ''
  );
  const [saving, setSaving] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setDraft(settings);
    setInsideChargeStr(settings.insideCityCharge ? String(settings.insideCityCharge) : '');
    setOutsideChargeStr(settings.outsideCityCharge ? String(settings.outsideCityCharge) : '');
  }, [settings]);

  const updateGateway = (
    id: PaymentGatewayId,
    patch: Partial<StorePaymentSettings['gateways']['bkash']>
  ) => {
    setDraft((prev) => ({
      ...prev,
      gateways: {
        ...prev.gateways,
        [id]: {
          ...prev.gateways[id],
          ...patch,
        },
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      const payloadToSave: StorePaymentSettings = {
        ...draft,
        insideCityCharge: Math.max(0, Number(insideChargeStr) || 0),
        outsideCityCharge: Math.max(0, Number(outsideChargeStr) || 0),
      };
      const { settings: saved, source } = await saveStorePaymentSettings(payloadToSave, adminToken);
      onSettingsSaved(saved);
      setStatusMessage({
        type: 'success',
        text: `Payment, delivery & Telegram settings saved (${
          source === 'supabase' ? 'Supabase Cloud' : 'Live Server Config'
        }). Changes are active on checkout immediately.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTg(true);
    setStatusMessage(null);
    try {
      await sendTestTelegramAlert(draft.telegramBotToken, draft.telegramChatId, adminToken);
      setStatusMessage({
        type: 'success',
        text: 'Test alert sent to your Telegram Bot! Check your Telegram chat now.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Telegram test failed.',
      });
    } finally {
      setTestingTg(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {statusMessage && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-medium border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Section A: Modular Mobile Banking Payment Gateways */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-[#09090B] flex items-center gap-2">
              <CreditCard size={18} /> Payment Methods &amp; Receiving Accounts
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Toggle bKash, Nagad, or Rocket on/off anytime. Customers see active numbers with 1-click Copy at checkout.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {(['bkash', 'nagad', 'rocket'] as PaymentGatewayId[]).map((gwId) => {
            const gw = draft.gateways[gwId];
            return (
              <div
                key={gwId}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  gw.enabled
                    ? 'bg-white border-zinc-300 shadow-2xs'
                    : 'bg-zinc-50/70 border-zinc-200 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      gwId === 'bkash'
                        ? 'bg-[#E2136E] text-white'
                        : gwId === 'nagad'
                        ? 'bg-[#ED1C24] text-white'
                        : 'bg-[#8C3494] text-white'
                    }`}
                  >
                    {gw.label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gw.enabled}
                    onClick={() => updateGateway(gwId, { enabled: !gw.enabled })}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                      gw.enabled ? 'bg-emerald-600' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        gw.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600">
                    Receiving {gw.label} Number
                  </label>
                  <input
                    type="text"
                    value={gw.number}
                    onChange={(e) => updateGateway(gwId, { number: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    className="w-full min-h-[38px] rounded-lg bg-zinc-50 border border-zinc-300 px-3 text-xs font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600">Account Type</label>
                  <div className="grid grid-cols-3 gap-1">
                    {ACCOUNT_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateGateway(gwId, { accountType: type })}
                        className={`min-h-[32px] rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          gw.accountType === type
                            ? 'bg-[#09090B] border-[#09090B] text-white'
                            : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section B: Delivery Charges & COD Policy */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-2xs space-y-4">
        <h3 className="font-display text-lg font-bold text-[#09090B] flex items-center gap-2">
          <Truck size={18} /> Delivery Charges &amp; Cash on Delivery Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 space-y-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-600">Zone 1 Label</label>
              <input
                type="text"
                value={draft.insideCityLabel}
                onChange={(e) => setDraft((p) => ({ ...p, insideCityLabel: e.target.value }))}
                className="w-full min-h-[38px] rounded-lg bg-white border border-zinc-300 px-3 text-xs text-[#09090B] focus:outline-none focus:border-[#09090B]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-600">
                Inside City Charge (BDT ৳)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={insideChargeStr}
                  onChange={(e) => {
                    const cleaned = cleanWholeNumberInput(e.target.value);
                    setInsideChargeStr(cleaned);
                    setDraft((p) => ({ ...p, insideCityCharge: Number(cleaned) || 0 }));
                  }}
                  placeholder="0"
                  className="w-full min-h-[40px] rounded-lg bg-white border border-zinc-300 pl-3 pr-9 text-sm font-mono-num font-bold text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:border-[#09090B]"
                />
                {insideChargeStr !== '' && (
                  <button
                    type="button"
                    onClick={() => {
                      setInsideChargeStr('');
                      setDraft((p) => ({ ...p, insideCityCharge: 0 }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
                    aria-label="Clear inside city charge"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 space-y-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-600">Zone 2 Label</label>
              <input
                type="text"
                value={draft.outsideCityLabel}
                onChange={(e) => setDraft((p) => ({ ...p, outsideCityLabel: e.target.value }))}
                className="w-full min-h-[38px] rounded-lg bg-white border border-zinc-300 px-3 text-xs text-[#09090B] focus:outline-none focus:border-[#09090B]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-600">
                Outside City Charge (BDT ৳)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={outsideChargeStr}
                  onChange={(e) => {
                    const cleaned = cleanWholeNumberInput(e.target.value);
                    setOutsideChargeStr(cleaned);
                    setDraft((p) => ({ ...p, outsideCityCharge: Number(cleaned) || 0 }));
                  }}
                  placeholder="0"
                  className="w-full min-h-[40px] rounded-lg bg-white border border-zinc-300 pl-3 pr-9 text-sm font-mono-num font-bold text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:border-[#09090B]"
                />
                {outsideChargeStr !== '' && (
                  <button
                    type="button"
                    onClick={() => {
                      setOutsideChargeStr('');
                      setDraft((p) => ({ ...p, outsideCityCharge: 0 }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
                    aria-label="Clear outside city charge"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mandatory Advance Delivery Charge Toggle */}
        <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-amber-700" />
              Mandatory Advance Delivery Charge for Cash on Delivery (COD)
            </p>
            <p className="text-[11px] text-amber-900/80">
              When ON, COD customers must pay the delivery charge in advance via bKash/active gateway and enter TrxID to prevent fake orders.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.requireCodAdvanceDelivery}
            onClick={() =>
              setDraft((p) => ({
                ...p,
                requireCodAdvanceDelivery: !p.requireCodAdvanceDelivery,
              }))
            }
            className={`relative w-12 h-6 rounded-full shrink-0 transition-colors cursor-pointer ${
              draft.requireCodAdvanceDelivery ? 'bg-[#09090B]' : 'bg-zinc-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                draft.requireCodAdvanceDelivery ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Section C: Instant Telegram Order Alerts */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-2xs space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[#09090B] flex items-center gap-2">
            <Bell size={18} /> Instant Telegram Order Notifications
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Receive an instant Telegram message with Customer Name, Phone, Address, Paid/Due Amount, and bKash TrxID the moment an order is placed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-700">Telegram Bot Token</label>
            <input
              type="password"
              value={draft.telegramBotToken}
              onChange={(e) => setDraft((p) => ({ ...p, telegramBotToken: e.target.value }))}
              placeholder="123456789:ABCdefGHIjklMNO..."
              className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-xs font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
            />
            <p className="text-[10.5px] text-zinc-500">Create a bot via @BotFather on Telegram.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-700">Telegram Chat ID</label>
            <input
              type="text"
              value={draft.telegramChatId}
              onChange={(e) => setDraft((p) => ({ ...p, telegramChatId: e.target.value }))}
              placeholder="e.g. 582910421 or -1001234567890"
              className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-xs font-mono-num text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
            />
            <p className="text-[10.5px] text-zinc-500">
              Get your Chat ID from @userinfobot (start your bot first).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <button
            type="button"
            disabled={testingTg || !draft.telegramBotToken.trim() || !draft.telegramChatId.trim()}
            onClick={handleTestTelegram}
            className="min-h-[42px] px-4 rounded-xl border border-zinc-300 bg-white text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-45 flex items-center gap-2 cursor-pointer"
          >
            {testingTg ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>Send Test Telegram Alert</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-6 rounded-xl bg-[#09090B] text-white text-xs sm:text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Save Payment &amp; Delivery Settings</span>
          </button>
        </div>
      </div>
    </form>
  );
}

/* ============================================================================
 * 3. ADMIN CUSTOMER MESSAGES INBOX VIEW
 * ============================================================================ */

interface AdminMessagesInboxViewProps {
  messages: CustomerMessage[];
  orders: CustomerOrder[];
  pinResetRequests?: PinResetRequest[];
  adminToken: string;
  onRefreshMessages: () => Promise<void>;
  onRefreshPinResets?: () => Promise<void>;
  onMessageSent: (msg: CustomerMessage) => void;
  onThreadMarkedRead: (phoneNormalized: string) => void;
}

interface CustomerThreadSummary {
  phoneKey: string;
  displayPhone: string;
  customerName: string;
  messages: CustomerMessage[];
  orders: CustomerOrder[];
  unreadCount: number;
  lastActivity: string;
  lastPreview: string;
}

export function AdminMessagesInboxView({
  messages,
  orders,
  pinResetRequests = [],
  adminToken,
  onRefreshMessages,
  onRefreshPinResets,
  onMessageSent,
  onThreadMarkedRead,
}: AdminMessagesInboxViewProps) {
  const [selectedPhoneKey, setSelectedPhoneKey] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [copiedResetId, setCopiedResetId] = useState<string | null>(null);
  const [showDirectReset, setShowDirectReset] = useState(false);
  const [directResetPin, setDirectResetPin] = useState('');
  const [resettingPin, setResettingPin] = useState(false);
  const [directResetResult, setDirectResetResult] = useState<{
    phone: string;
    name: string;
    pin: string;
  } | null>(null);

  const threads = useMemo<CustomerThreadSummary[]>(() => {
    const map = new Map<string, CustomerThreadSummary>();

    for (const msg of messages) {
      const key = msg.customer_phone_normalized;
      if (!key) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          phoneKey: key,
          displayPhone: key,
          customerName: msg.customer_name || 'Customer',
          messages: [],
          orders: [],
          unreadCount: 0,
          lastActivity: msg.created_at,
          lastPreview: msg.body,
        };
        map.set(key, entry);
      }
      entry.messages.push(msg);
      if (msg.customer_name && entry.customerName === 'Customer') {
        entry.customerName = msg.customer_name;
      }
      if (msg.sender === 'customer' && !msg.read_by_admin) {
        entry.unreadCount += 1;
      }
      if (msg.created_at >= entry.lastActivity) {
        entry.lastActivity = msg.created_at;
        entry.lastPreview = msg.body;
      }
    }

    for (const ord of orders) {
      const key = normalizePhoneForMatch(ord.customer_phone);
      if (!key) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          phoneKey: key,
          displayPhone: ord.customer_phone,
          customerName: ord.customer_name || 'Customer',
          messages: [],
          orders: [],
          unreadCount: 0,
          lastActivity: ord.created_at,
          lastPreview: `Order ${ord.order_number} (${ord.status === 'Verified' ? 'Accepted' : ord.status})`,
        };
        map.set(key, entry);
      }
      entry.displayPhone = ord.customer_phone || entry.displayPhone;
      if (ord.customer_name) entry.customerName = ord.customer_name;
      entry.orders.push(ord);
    }

    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((t) => {
        if (!q) return true;
        return `${t.customerName} ${t.displayPhone} ${t.phoneKey} ${t.lastPreview}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
        return b.lastActivity.localeCompare(a.lastActivity);
      });
  }, [messages, orders, search]);

  useEffect(() => {
    if (!selectedPhoneKey && threads.length > 0) {
      setSelectedPhoneKey(threads[0].phoneKey);
    }
  }, [threads, selectedPhoneKey]);

  const activeThread = useMemo(
    () => threads.find((t) => t.phoneKey === selectedPhoneKey) || threads[0] || null,
    [threads, selectedPhoneKey]
  );

  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    void markAdminThreadRead(activeThread.phoneKey, adminToken).then(() => {
      onThreadMarkedRead(activeThread.phoneKey);
    });
  }, [activeThread?.phoneKey, activeThread?.unreadCount, adminToken, onThreadMarkedRead]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyText.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const sent = await sendAdminMessageToCustomer({
        customer_phone: activeThread.displayPhone,
        customer_name: activeThread.customerName,
        order_number: orderRef || undefined,
        body: replyText.trim(),
        adminToken,
      });
      setReplyText('');
      onMessageSent(sent);
      onThreadMarkedRead(activeThread.phoneKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([onRefreshMessages(), onRefreshPinResets?.()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedResetId(id);
      window.setTimeout(() => setCopiedResetId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleDirectPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || directResetPin.trim().length < 4 || resettingPin) return;
    setResettingPin(true);
    setError('');
    setDirectResetResult(null);
    try {
      const res = await adminDirectResetCustomerPin({
        customer_phone: activeThread.displayPhone,
        new_pin: directResetPin.trim(),
        adminToken,
      });
      setDirectResetResult({
        phone: res.phone,
        name: res.customer_name,
        pin: res.new_pin,
      });
      setDirectResetPin('');
      await onRefreshPinResets?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset PIN.');
    } finally {
      setResettingPin(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pending Customer Forgot-PIN Reset Requests */}
      {pinResetRequests.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <KeyRound size={16} className="text-amber-700" />
                Pending Customer PIN Reset Requests ({pinResetRequests.length})
              </h3>
              <p className="text-[11px] text-amber-900/80">
                Customer requested a PIN reset. Send the 6-digit code to their verified phone via WhatsApp or SMS so they can set a new PIN.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {pinResetRequests.map((reqItem) => {
              const wa = formatWhatsAppPhone(reqItem.phone);
              const shareText = encodeURIComponent(
                `Assalamu Alaikum ${reqItem.customer_name}, apnar New Chiko Watch account (${reqItem.customer_code}) er PIN Reset Code holo: ${reqItem.reset_code} (30 minute valid). Account -> Sign In -> Forgot PIN e giye ei code diye notun PIN set korun.`
              );
              return (
                <div
                  key={reqItem.id}
                  className="rounded-xl bg-white border border-amber-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-[#09090B]">
                        {reqItem.customer_name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono-num text-[10px] font-bold">
                        {reqItem.customer_code}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono-num text-zinc-600">{reqItem.phone}</p>
                    <p className="text-xs text-zinc-700 pt-0.5">
                      Reset Code:{' '}
                      <strong className="font-mono-num text-base tracking-widest text-rose-700">
                        {reqItem.reset_code}
                      </strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(reqItem.id, reqItem.reset_code)}
                      className="min-h-[32px] px-2.5 rounded-lg border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedResetId === reqItem.id ? (
                        <>
                          <Check size={12} className="text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </button>
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${shareText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[32px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Smartphone size={12} />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <a
                      href={`sms:${reqItem.phone}?body=${shareText}`}
                      className="min-h-[32px] px-2.5 rounded-lg bg-[#09090B] hover:bg-zinc-800 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <Phone size={12} />
                      <span>SMS</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Customer Conversations List */}
      <div className="lg:col-span-4 rounded-2xl bg-white border border-zinc-200 p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-[#09090B] flex items-center gap-2">
            <MessageSquare size={17} /> Customer Inbox
          </h3>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="min-h-[34px] px-2.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name or phone..."
            className="w-full min-h-[38px] rounded-xl bg-zinc-50 border border-zinc-200 pl-8 pr-3 text-xs text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
          />
        </div>

        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
          {threads.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">
              No customer conversations yet. When customers place orders or message you from their account, threads appear here.
            </p>
          ) : (
            threads.map((t) => {
              const selected = activeThread?.phoneKey === t.phoneKey;
              return (
                <button
                  key={t.phoneKey}
                  type="button"
                  onClick={() => {
                    setSelectedPhoneKey(t.phoneKey);
                    setOrderRef('');
                    setError('');
                  }}
                  className={`w-full text-left rounded-xl p-3 border transition-all cursor-pointer space-y-1 ${
                    selected
                      ? 'bg-[#09090B] border-[#09090B] text-white'
                      : 'bg-zinc-50 border-zinc-200 text-[#09090B] hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold truncate">{t.customerName}</span>
                    {t.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-mono-num text-[10px] font-bold">
                        {t.unreadCount} new
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] font-mono-num ${
                      selected ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {t.displayPhone} · {t.orders.length} order{t.orders.length === 1 ? '' : 's'}
                  </p>
                  <p
                    className={`text-[11px] line-clamp-1 ${
                      selected ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    {t.lastPreview}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Active Conversation Pane */}
      <div className="lg:col-span-8 rounded-2xl bg-white border border-zinc-200 flex flex-col min-h-[480px] max-h-[620px] shadow-2xs overflow-hidden">
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 text-zinc-500">
            <MessageSquare size={28} className="text-zinc-300" />
            <p className="text-sm font-semibold text-[#09090B]">Select a customer conversation</p>
            <p className="text-xs max-w-sm">
              Read messages from customers and send direct updates straight to their account inbox or phone.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="px-4 py-3.5 bg-zinc-50 border-b border-zinc-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-[#09090B]">{activeThread.customerName}</h4>
                  <p className="text-[11px] font-mono-num text-zinc-600">
                    {activeThread.displayPhone} · {activeThread.orders.length} linked order(s)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectReset((v) => !v);
                      setDirectResetResult(null);
                      setError('');
                    }}
                    className={`min-h-[32px] px-2.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                      showDirectReset
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    <KeyRound size={12} />
                    <span>Reset PIN</span>
                  </button>
                  {formatWhatsAppPhone(activeThread.displayPhone) && (
                    <a
                      href={`https://wa.me/${formatWhatsAppPhone(activeThread.displayPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[32px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5"
                    >
                      <Smartphone size={12} />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  <a
                    href={`sms:${activeThread.displayPhone}`}
                    className="min-h-[32px] px-3 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-[11px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Phone size={12} />
                    <span>SMS</span>
                  </a>
                </div>
              </div>

              {showDirectReset && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <form onSubmit={handleDirectPinReset} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={directResetPin}
                      onChange={(e) => setDirectResetPin(e.target.value)}
                      placeholder="Set temporary new PIN (e.g. 4829)..."
                      minLength={4}
                      className="flex-1 min-w-[180px] min-h-[34px] rounded-lg bg-white border border-amber-300 px-3 text-xs font-mono-num text-[#09090B] focus:outline-none focus:border-amber-700"
                    />
                    <button
                      type="submit"
                      disabled={resettingPin || directResetPin.trim().length < 4}
                      className="min-h-[34px] px-3.5 rounded-lg bg-[#09090B] hover:bg-zinc-800 text-white text-xs font-semibold disabled:opacity-45 cursor-pointer"
                    >
                      {resettingPin ? 'Updating...' : 'Set Temporary PIN'}
                    </button>
                  </form>
                  {directResetResult && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        PIN updated for <strong>{directResetResult.name}</strong>! New PIN:{' '}
                        <strong className="font-mono-num">{directResetResult.pin}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {formatWhatsAppPhone(directResetResult.phone) && (
                          <a
                            href={`https://wa.me/${formatWhatsAppPhone(
                              directResetResult.phone
                            )}?text=${encodeURIComponent(
                              `Assalamu Alaikum ${directResetResult.name}, apnar New Chiko Watch account er new PIN set kora hoyeche: ${directResetResult.pin}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold text-[10.5px]"
                          >
                            Send on WhatsApp
                          </a>
                        )}
                        <a
                          href={`sms:${directResetResult.phone}?body=${encodeURIComponent(
                            `Assalamu Alaikum ${directResetResult.name}, apnar New Chiko Watch account er new PIN: ${directResetResult.pin}`
                          )}`}
                          className="px-2 py-1 rounded bg-zinc-900 text-white font-semibold text-[10.5px]"
                        >
                          Send SMS
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#FCFBFA]">
              {activeThread.messages.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-500">
                  No messages exchanged yet. Send a message below — {activeThread.customerName} will see it inside their Account inbox.
                </div>
              ) : (
                activeThread.messages.map((msg) => {
                  const isAdminMsg = msg.sender === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdminMsg ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs space-y-1 shadow-2xs ${
                          isAdminMsg
                            ? 'bg-[#09090B] text-white rounded-br-sm'
                            : 'bg-white border border-zinc-200 text-[#09090B] rounded-bl-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] opacity-75">
                          <span className="font-bold">
                            {isAdminMsg ? 'Admin (You)' : msg.customer_name}
                          </span>
                          {msg.order_number && (
                            <span className="font-mono-num font-semibold">#{msg.order_number}</span>
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
            </div>

            {/* Reply Composer */}
            <form onSubmit={handleSend} className="p-3.5 bg-white border-t border-zinc-200 space-y-2">
              {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
              {activeThread.orders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-semibold text-zinc-500 shrink-0">
                    Tag Order:
                  </span>
                  <select
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    className="flex-1 min-h-[30px] rounded-lg bg-zinc-50 border border-zinc-200 px-2 text-[11px] font-mono-num text-zinc-800 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="">General Message</option>
                    {activeThread.orders.map((o) => (
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
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${activeThread.customerName}'s account...`}
                  className="flex-1 min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-xs text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="min-h-[42px] px-4 rounded-xl bg-[#09090B] hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 shrink-0"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Send</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
    </div>
  );
}
