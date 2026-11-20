import React from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CartItem, DeliveryZone, StorePaymentSettings } from '../types/watch';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  deliveryZone: DeliveryZone;
  paymentSettings: StorePaymentSettings;
  onChangeZone: (zone: DeliveryZone) => void;
  onUpdateQty: (watchId: string, delta: number) => void;
  onRemoveItem: (watchId: string) => void;
  onClearCart: () => void;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  isOpen,
  items,
  deliveryZone,
  paymentSettings,
  onChangeZone,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onClose,
  onProceedToCheckout,
}: CartDrawerProps) {
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryCharge =
    items.length === 0
      ? 0
      : deliveryZone === 'outside_city'
      ? paymentSettings.outsideCityCharge
      : paymentSettings.insideCityCharge;
  const totalPayable = subtotal + deliveryCharge;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cart-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping Cart"
        >
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-full bg-[#FCFBFA] border-l border-stone-200 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-white border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#09090B] text-white flex items-center justify-center">
                  <ShoppingBag size={17} />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-[#09090B] leading-tight">
                    Your Shopping Bag
                  </h2>
                  <p className="text-[11px] text-zinc-500 font-mono-num">
                    {totalCount} {totalCount === 1 ? 'item' : 'items'} selected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[38px] min-w-[38px] rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close cart"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-zinc-400 shadow-2xs">
                    <ShoppingBag size={28} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-[#09090B]">Your bag is empty</h3>
                    <p className="text-xs text-zinc-500 max-w-xs">
                      Tap &ldquo;Add to Cart&rdquo; or &ldquo;Buy Now&rdquo; on any watch or electronics item to order with bKash or Cash on Delivery.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[40px] px-4 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Continue Browsing
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.watchId}
                    className="rounded-xl bg-white border border-zinc-200 p-3 flex gap-3 shadow-2xs"
                  >
                    <div className="w-16 h-16 rounded-lg bg-stone-50 border border-stone-200/80 overflow-hidden shrink-0">
                      <WatchImage
                        src={item.image_url}
                        alt={`${item.brand} ${item.model}`}
                        brand={item.brand}
                        model={item.model}
                        iconSize={18}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">
                            {item.brand} · {item.color}
                          </p>
                          <h4 className="text-xs font-semibold text-[#09090B] line-clamp-1">
                            {item.product_name || item.model}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.watchId)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          aria-label={`Remove ${item.product_name || item.model}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-num text-xs font-bold text-[#09090B]">
                          {formatBDT(item.unitPrice * item.quantity)}
                        </span>
                        <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.watchId, -1)}
                            className="w-7 h-7 rounded flex items-center justify-center text-zinc-700 hover:bg-white hover:text-[#09090B] transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="font-mono-num text-xs font-bold px-2.5 text-[#09090B]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.watchId, 1)}
                            disabled={item.quantity >= item.maxStock}
                            className="w-7 h-7 rounded flex items-center justify-center text-zinc-700 hover:bg-white hover:text-[#09090B] disabled:opacity-35 transition-colors cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Totals & Checkout CTA */}
            {items.length > 0 && (
              <div className="p-4 bg-white border-t border-stone-200 space-y-3.5">
                {/* Quick Delivery Zone Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
                    <Truck size={13} />
                    <span>Delivery Zone</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeZone('inside_city')}
                      className={`min-h-[38px] px-3 rounded-xl border text-left transition-all cursor-pointer ${
                        deliveryZone === 'inside_city'
                          ? 'bg-[#09090B] border-[#09090B] text-white shadow-xs'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      <div className="text-[11px] font-semibold leading-tight">
                        {paymentSettings.insideCityLabel}
                      </div>
                      <div
                        className={`font-mono-num text-[10px] ${
                          deliveryZone === 'inside_city' ? 'text-zinc-300' : 'text-zinc-500'
                        }`}
                      >
                        {formatBDT(paymentSettings.insideCityCharge)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeZone('outside_city')}
                      className={`min-h-[38px] px-3 rounded-xl border text-left transition-all cursor-pointer ${
                        deliveryZone === 'outside_city'
                          ? 'bg-[#09090B] border-[#09090B] text-white shadow-xs'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      <div className="text-[11px] font-semibold leading-tight">
                        {paymentSettings.outsideCityLabel}
                      </div>
                      <div
                        className={`font-mono-num text-[10px] ${
                          deliveryZone === 'outside_city' ? 'text-zinc-300' : 'text-zinc-500'
                        }`}
                      >
                        {formatBDT(paymentSettings.outsideCityCharge)}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span className="font-mono-num font-semibold text-zinc-900">
                      {formatBDT(subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>
                      Delivery (
                      {deliveryZone === 'outside_city'
                        ? paymentSettings.outsideCityLabel
                        : paymentSettings.insideCityLabel}
                      )
                    </span>
                    <span className="font-mono-num font-semibold text-zinc-900">
                      {formatBDT(deliveryCharge)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-bold text-[#09090B]">
                    <span>Total Payable</span>
                    <span className="font-mono-num">{formatBDT(totalPayable)}</span>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={onProceedToCheckout}
                  className="w-full min-h-[46px] rounded-xl bg-[#09090B] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors cursor-pointer shadow-sm"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={16} />
                </motion.button>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
