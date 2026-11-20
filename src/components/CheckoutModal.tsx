import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { submitCustomerOrder } from '../services/orderStore';
import {
  CartItem,
  CheckoutPaymentType,
  CustomerAccount,
  CustomerOrder,
  DeliveryZone,
  PaymentGatewayId,
  StorePaymentSettings,
} from '../types/watch';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface CheckoutModalProps {
  items: CartItem[];
  initialZone: DeliveryZone;
  paymentSettings: StorePaymentSettings;
  isBuyNow?: boolean;
  customerAccount?: CustomerAccount | null;
  onOpenCustomerAccount?: () => void;
  onClose: () => void;
  onOrderSuccess: (order: CustomerOrder) => void;
}

const GATEWAY_ACCENTS: Record<
  PaymentGatewayId,
  { badge: string; border: string; bg: string; button: string }
> = {
  bkash: {
    badge: 'bg-[#E2136E] text-white',
    border: 'border-[#E2136E]/35',
    bg: 'bg-[#FDF2F7]',
    button: 'bg-[#E2136E] hover:bg-[#c81061] text-white',
  },
  nagad: {
    badge: 'bg-[#ED1C24] text-white',
    border: 'border-orange-300',
    bg: 'bg-orange-50/70',
    button: 'bg-[#ED1C24] hover:bg-red-700 text-white',
  },
  rocket: {
    badge: 'bg-[#8C3494] text-white',
    border: 'border-purple-300',
    bg: 'bg-purple-50/70',
    button: 'bg-[#8C3494] hover:bg-purple-800 text-white',
  },
};

export function CheckoutModal({
  items,
  initialZone,
  paymentSettings,
  isBuyNow = false,
  customerAccount = null,
  onOpenCustomerAccount,
  onClose,
  onOrderSuccess,
}: CheckoutModalProps) {
  const activeGateways = useMemo(() => {
    const list = (['bkash', 'nagad', 'rocket'] as PaymentGatewayId[])
      .map((id) => paymentSettings.gateways[id])
      .filter((g) => g.enabled);
    return list.length > 0 ? list : [paymentSettings.gateways.bkash];
  }, [paymentSettings]);

  const [customerName, setCustomerName] = useState(customerAccount?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customerAccount?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState(customerAccount?.default_address || '');
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone>(
    customerAccount?.delivery_zone || initialZone
  );
  const [paymentType, setPaymentType] = useState<CheckoutPaymentType>('full_payment');
  const [selectedGatewayId, setSelectedGatewayId] = useState<PaymentGatewayId>(
    activeGateways[0]?.id || 'bkash'
  );
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [notes, setNotes] = useState('');

  const [copiedNumber, setCopiedNumber] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    if (!activeGateways.some((g) => g.id === selectedGatewayId)) {
      setSelectedGatewayId(activeGateways[0]?.id || 'bkash');
    }
  }, [activeGateways, selectedGatewayId]);

  useEffect(() => {
    if (customerAccount) {
      setCustomerName((prev) => prev || customerAccount.name);
      setCustomerPhone(customerAccount.phone);
      setDeliveryAddress((prev) => prev || customerAccount.default_address || '');
    }
  }, [customerAccount]);

  const activeGateway =
    activeGateways.find((g) => g.id === selectedGatewayId) || activeGateways[0];
  const gwTheme = GATEWAY_ACCENTS[activeGateway.id];

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const deliveryCharge =
    deliveryZone === 'outside_city'
      ? paymentSettings.outsideCityCharge
      : paymentSettings.insideCityCharge;
  const totalPayable = subtotal + deliveryCharge;

  const requiresGatewayPayment =
    paymentType === 'full_payment' || paymentSettings.requireCodAdvanceDelivery;

  const payNowAmount =
    paymentType === 'full_payment'
      ? totalPayable
      : paymentSettings.requireCodAdvanceDelivery
      ? deliveryCharge
      : 0;
  const dueOnDeliveryAmount = Math.max(0, totalPayable - payNowAmount);

  const handleCopyNumber = async () => {
    const num = activeGateway.number?.trim();
    if (!num) return;
    try {
      await navigator.clipboard.writeText(num);
      setCopiedNumber(true);
      window.setTimeout(() => setCopiedNumber(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerAccount) {
      setError('Order place korar age apnar Customer Account create ba Sign In korun.');
      return;
    }
    if (!customerName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (customerPhone.trim().length < 7) {
      setError('Please enter a valid contact phone number.');
      return;
    }
    if (deliveryAddress.trim().length < 6) {
      setError('Please enter your complete delivery address.');
      return;
    }
    if (requiresGatewayPayment) {
      if (senderNumber.trim().length < 6) {
        setError(`Please enter your Sender ${activeGateway.label} Number.`);
        return;
      }
      if (trxId.trim().length < 4) {
        setError(`Please enter the ${activeGateway.label} Transaction ID (TrxID).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const { order } = await submitCustomerOrder({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        delivery_zone: deliveryZone,
        payment_type: paymentType,
        payment_gateway: requiresGatewayPayment ? activeGateway.id : 'cod',
        sender_number: requiresGatewayPayment ? senderNumber.trim() : '',
        trx_id: requiresGatewayPayment ? trxId.trim().toUpperCase() : '',
        notes: notes.trim(),
        items: items.map((item) => ({
          watchId: item.watchId,
          productName: item.product_name || item.model,
          brand: item.brand,
          model: item.model,
          color: item.color,
          imageUrl: item.image_url,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice * item.quantity,
        })),
      });
      setConfirmedOrder(order);
      onOrderSuccess(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to confirm order. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
      aria-label="Checkout"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-3xl max-h-[93vh] overflow-y-auto rounded-t-3xl md:rounded-2xl bg-[#FCFBFA] border border-zinc-200 shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 bg-white/95 backdrop-blur-md border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#09090B] text-white flex items-center justify-center">
              {confirmedOrder ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[#09090B] leading-tight">
                {confirmedOrder
                  ? 'Order Confirmed!'
                  : isBuyNow
                  ? 'Express Buy Now Checkout'
                  : 'Secure Order Checkout'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {confirmedOrder
                  ? `Reference #${confirmedOrder.order_number}`
                  : 'Fast bKash / Mobile Banking TrxID verification & COD delivery'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close checkout"
          >
            <X size={18} />
          </button>
        </div>

        {confirmedOrder ? (
          <div className="p-6 space-y-5">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-display text-xl font-bold text-emerald-950">
                Thank you, {confirmedOrder.customer_name}!
              </h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                Your order <span className="font-mono-num font-bold">{confirmedOrder.order_number}</span> has been received. Our team will verify your payment and call{' '}
                <span className="font-mono-num font-semibold">{confirmedOrder.customer_phone}</span> shortly.
              </p>
              <div className="pt-1 flex justify-center">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-bold tracking-wide ${
                    confirmedOrder.payment_type === 'full_payment'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {confirmedOrder.payment_type === 'full_payment'
                    ? 'FULL PAID — VERIFICATION PENDING'
                    : confirmedOrder.paid_amount > 0
                    ? 'COD — DELIVERY ADVANCE PAID'
                    : 'CASH ON DELIVERY CONFIRMED'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white border border-zinc-200 p-4 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Delivery Details
                </p>
                <p className="font-semibold text-[#09090B]">{confirmedOrder.customer_name}</p>
                <p className="font-mono-num text-zinc-700">{confirmedOrder.customer_phone}</p>
                <p className="text-zinc-600 leading-relaxed">{confirmedOrder.delivery_address}</p>
                <p className="text-[11px] text-zinc-500">
                  Zone:{' '}
                  {confirmedOrder.delivery_zone === 'outside_city'
                    ? paymentSettings.outsideCityLabel
                    : paymentSettings.insideCityLabel}
                </p>
              </div>

              <div className="rounded-xl bg-white border border-zinc-200 p-4 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Payment Summary
                </p>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Total Order</span>
                  <span className="font-mono-num font-semibold">
                    {formatBDT(confirmedOrder.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Paid Now</span>
                  <span className="font-mono-num font-bold">
                    {formatBDT(confirmedOrder.paid_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>Due on Delivery (COD)</span>
                  <span className="font-mono-num font-bold">
                    {formatBDT(confirmedOrder.due_amount)}
                  </span>
                </div>
                {confirmedOrder.trx_id && (
                  <div className="pt-1.5 border-t border-zinc-100 flex justify-between">
                    <span className="text-zinc-500">TrxID</span>
                    <span className="font-mono-num font-bold text-[#09090B]">
                      {confirmedOrder.trx_id}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {onOpenCustomerAccount && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCustomerAccount();
                  }}
                  className="w-full min-h-[46px] rounded-xl border border-zinc-300 bg-white text-[#09090B] font-semibold text-sm hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  {customerAccount ? 'Track Status in My Account' : 'Create Customer ID & Track'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`w-full min-h-[46px] rounded-xl bg-[#09090B] text-white font-semibold text-sm hover:bg-zinc-800 transition-colors cursor-pointer ${
                  onOpenCustomerAccount ? '' : 'sm:col-span-2'
                }`}
              >
                Done &amp; Return to Store
              </button>
            </div>
          </div>
        ) : !customerAccount ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#09090B] text-white flex items-center justify-center shadow-sm">
              <ShieldCheck size={26} />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="font-display text-xl font-bold text-[#09090B]">
                Customer Account Required
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Order confirm korar age apnar Customer Account create ba Sign In korun. Account khulle apni live order Approve/Reject status, full Order History, ar direct Admin chat paben.
              </p>
            </div>
            {onOpenCustomerAccount && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomerAccount();
                }}
                className="min-h-[46px] px-6 rounded-xl bg-[#09090B] text-white text-sm font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Create Customer ID / Sign In
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 flex items-center gap-2 font-medium">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Order Items Compact Preview */}
            <div className="rounded-2xl bg-white border border-zinc-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <ShoppingBag size={13} /> Order Summary ({items.reduce((s, i) => s + i.quantity, 0)} items)
                </span>
                <span className="font-mono-num text-sm font-bold text-[#09090B]">
                  {formatBDT(totalPayable)}
                </span>
              </div>
              <div className="divide-y divide-zinc-100 max-h-40 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.watchId} className="py-2 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-stone-50 border border-stone-200 overflow-hidden shrink-0">
                      <WatchImage
                        src={item.image_url}
                        alt={item.model}
                        brand={item.brand}
                        model={item.model}
                        iconSize={15}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#09090B] truncate">
                        {item.product_name || item.model}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {item.brand} · {item.color} · Qty {item.quantity}
                      </p>
                    </div>
                    <span className="font-mono-num text-xs font-semibold text-[#09090B] shrink-0">
                      {formatBDT(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Customer Information & Delivery Zone */}
            <div className="rounded-2xl bg-white border border-zinc-200 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  1. Delivery Information
                </h3>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 text-white font-mono-num text-[10.5px] font-bold">
                  Verified ID: {customerAccount.customer_code}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                    <User size={13} className="text-zinc-400" /> Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Tanvir Ahmed"
                    className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                    <Phone size={13} className="text-zinc-400" /> Account Phone Number (Verified)
                  </label>
                  <input
                    type="tel"
                    required
                    readOnly
                    value={customerPhone}
                    className="w-full min-h-[42px] rounded-xl bg-zinc-100 border border-zinc-300 px-3.5 text-sm font-mono-num font-semibold text-zinc-700 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                  <MapPin size={13} className="text-zinc-400" /> Full Delivery Address *
                </label>
                <textarea
                  rows={2}
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House, Road, Area, Thana / District"
                  className="w-full rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 py-2.5 text-sm text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                  <Truck size={13} className="text-zinc-400" /> Select Delivery Zone
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryZone('inside_city')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      deliveryZone === 'inside_city'
                        ? 'bg-[#09090B] border-[#09090B] text-white shadow-xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {paymentSettings.insideCityLabel}
                      </span>
                      <span className="font-mono-num text-xs font-bold">
                        {formatBDT(paymentSettings.insideCityCharge)}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryZone('outside_city')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      deliveryZone === 'outside_city'
                        ? 'bg-[#09090B] border-[#09090B] text-white shadow-xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {paymentSettings.outsideCityLabel}
                      </span>
                      <span className="font-mono-num text-xs font-bold">
                        {formatBDT(paymentSettings.outsideCityCharge)}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Payment Method & TrxID Verification */}
            <div className="rounded-2xl bg-white border border-zinc-200 p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                2. Choose Payment Option
              </h3>

              {/* Option 1 vs Option 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentType('full_payment')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                    paymentType === 'full_payment'
                      ? 'bg-zinc-950 border-zinc-950 text-white shadow-sm'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <CreditCard size={14} /> Full Payment ({activeGateway.label})
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        paymentType === 'full_payment'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      0 Due
                    </span>
                  </div>
                  <p
                    className={`text-[11px] ${
                      paymentType === 'full_payment' ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    Pay full{' '}
                    <span className="font-mono-num font-semibold">
                      {formatBDT(totalPayable)}
                    </span>{' '}
                    now via {activeGateway.label}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('cod_advance')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                    paymentType === 'cod_advance'
                      ? 'bg-zinc-950 border-zinc-950 text-white shadow-sm'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Wallet size={14} /> Cash on Delivery
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        paymentType === 'cod_advance'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {paymentSettings.requireCodAdvanceDelivery ? 'Delivery Advance' : 'Pay Later'}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] ${
                      paymentType === 'cod_advance' ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {paymentSettings.requireCodAdvanceDelivery
                      ? `Pay only ${formatBDT(deliveryCharge)} delivery now · ${formatBDT(
                          subtotal
                        )} COD`
                      : `Pay full ${formatBDT(totalPayable)} in cash on delivery`}
                  </p>
                </button>
              </div>

              {/* Modular Gateway Selector (shows when multiple gateways like bKash/Nagad/Rocket are active) */}
              {requiresGatewayPayment && activeGateways.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-zinc-500 mr-1">
                    Mobile Banking:
                  </span>
                  {activeGateways.map((gw) => {
                    const active = gw.id === activeGateway.id;
                    return (
                      <button
                        key={gw.id}
                        type="button"
                        onClick={() => setSelectedGatewayId(gw.id)}
                        className={`min-h-[34px] px-3.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? `${GATEWAY_ACCENTS[gw.id].badge} border-transparent shadow-xs`
                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400'
                        }`}
                      >
                        {gw.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Gateway Payment Instruction Card + TrxID Fields */}
              {requiresGatewayPayment ? (
                <div className={`rounded-2xl border p-4 space-y-3.5 ${gwTheme.bg} ${gwTheme.border}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${gwTheme.badge}`}
                      >
                        {activeGateway.label}
                      </span>
                      <span className="text-xs font-semibold text-zinc-800">
                        {activeGateway.accountType} Account
                      </span>
                    </div>
                    <span className="text-xs font-bold text-zinc-900">
                      {activeGateway.accountType === 'Merchant'
                        ? 'Use "Payment"'
                        : activeGateway.accountType === 'Agent'
                        ? 'Use "Cash Out"'
                        : 'Use "Send Money"'}
                    </span>
                  </div>

                  {paymentType === 'cod_advance' && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11.5px] text-amber-950 leading-relaxed">
                      <strong>Cash on Delivery Policy:</strong> To confirm COD, please pay only the{' '}
                      <strong className="font-mono-num">{formatBDT(deliveryCharge)}</strong> delivery charge in advance via {activeGateway.label}. The remaining product price (
                      <strong className="font-mono-num">{formatBDT(subtotal)}</strong>) stays{' '}
                      <strong>Due on Delivery (COD)</strong>.
                    </div>
                  )}

                  {/* Receiving Number + 1-Click Copy */}
                  <div className="rounded-xl bg-white border border-zinc-200 p-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Receiving {activeGateway.label} Number ({activeGateway.accountType})
                      </p>
                      <p className="font-mono-num text-lg font-bold text-[#09090B] tracking-wide mt-0.5">
                        {activeGateway.number || 'Not configured by Admin'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyNumber}
                      disabled={!activeGateway.number}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${gwTheme.button}`}
                    >
                      {copiedNumber ? (
                        <>
                          <Check size={14} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Number</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Exact Amount to Send Right Now */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-white border border-zinc-200 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Pay Now via {activeGateway.label}
                      </p>
                      <p className="font-mono-num text-base font-bold text-emerald-700 mt-0.5">
                        {formatBDT(payNowAmount)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-zinc-200 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Due on Delivery (COD)
                      </p>
                      <p className="font-mono-num text-base font-bold text-[#09090B] mt-0.5">
                        {formatBDT(dueOnDeliveryAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Sender Number & TrxID Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-800">
                        Your Sender {activeGateway.label} Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={senderNumber}
                        onChange={(e) => setSenderNumber(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full min-h-[42px] rounded-xl bg-white border border-zinc-300 px-3.5 text-sm font-mono-num text-[#09090B] focus:outline-none focus:border-[#09090B]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-800">
                        {activeGateway.label} Transaction ID (TrxID) *
                      </label>
                      <input
                        type="text"
                        required
                        value={trxId}
                        onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                        placeholder="e.g. BI74K92LMN"
                        className="w-full min-h-[42px] rounded-xl bg-white border border-zinc-300 px-3.5 text-sm font-mono-num uppercase text-[#09090B] focus:outline-none focus:border-[#09090B]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-1">
                  <p className="font-semibold">No advance payment required</p>
                  <p>
                    Total payable in cash upon delivery:{' '}
                    <strong className="font-mono-num">{formatBDT(totalPayable)}</strong>
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600">
                  Order Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred delivery time or special instructions..."
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 text-xs text-[#09090B] focus:outline-none focus:bg-white focus:border-[#09090B]"
                />
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="text-xs text-zinc-600 w-full sm:w-auto">
                <div>
                  Pay Now:{' '}
                  <strong className="font-mono-num text-emerald-700">
                    {formatBDT(payNowAmount)}
                  </strong>{' '}
                  · Due on Delivery:{' '}
                  <strong className="font-mono-num text-[#09090B]">
                    {formatBDT(dueOnDeliveryAmount)}
                  </strong>
                </div>
              </div>
              <motion.button
                type="submit"
                disabled={submitting}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto min-h-[48px] px-7 rounded-xl bg-[#09090B] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Confirming Order...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={17} />
                    <span>Confirm Order</span>
                  </>
                )}
              </motion.button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
