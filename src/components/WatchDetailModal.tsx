import { useEffect, useState } from 'react';
import { Calculator, Lock, ReceiptText, X } from 'lucide-react';
import { motion } from 'motion/react';
import { WatchItem } from '../types/watch';
import { TripleTapPrice, formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface WatchDetailModalProps {
  watch: WatchItem;
  isAdmin: boolean;
  onClose: () => void;
  onAddToMemo: (watch: WatchItem, agreedPrice?: number) => void;
}

function cleanIntegerInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

export function WatchDetailModal({
  watch,
  isAdmin,
  onClose,
  onAddToMemo,
}: WatchDetailModalProps) {
  const [customerOfferStr, setCustomerOfferStr] = useState<string>(
    String(watch.min_selling_price)
  );
  const [showBargainTool, setShowBargainTool] = useState<boolean>(isAdmin);

  useEffect(() => {
    setCustomerOfferStr(String(watch.min_selling_price));
    setShowBargainTool(isAdmin);
  }, [watch, isAdmin]);

  const customerOffer = Number(customerOfferStr) || 0;
  const netProfit = customerOffer - watch.real_buying_price;
  const marginPct =
    customerOffer > 0 ? Math.round((netProfit / customerOffer) * 1000) / 10 : 0;

  const dealStatus =
    customerOffer < watch.real_buying_price
      ? { label: 'Loss Alert — Below Wholesale Cost', tone: 'text-rose-600' }
      : customerOffer < watch.min_selling_price
      ? { label: 'Below Floor — Tight Margin', tone: 'text-amber-700' }
      : { label: 'Healthy Deal — Above Minimum Floor', tone: 'text-emerald-700' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-xs p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${watch.brand} ${watch.model} details`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-2xl bg-white border border-zinc-200 shadow-2xl"
      >
        {/* Mobile drag handle */}
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-zinc-300" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <div>
            <p className="text-xs text-zinc-600 font-semibold tracking-wider uppercase">
              {watch.brand}
              {watch.product_name && watch.model && watch.product_name !== watch.model
                ? ` · ${watch.model}`
                : ''}
            </p>
            <h2 className="font-display text-2xl font-semibold text-[#09090B]">
              {watch.product_name || watch.model}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 transition-colors active:scale-95 cursor-pointer"
            aria-label="Close product details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 md:p-6">
          {/* Left: Product Showcase */}
          <div className="space-y-4">
            <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#F4F4F5] border border-zinc-200">
              <WatchImage
                src={watch.image_url}
                alt={`${watch.brand} ${watch.model}`}
                brand={watch.brand}
                model={watch.model}
                category={watch.category}
                iconSize={52}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                <p className="text-zinc-500">Category</p>
                <p className="mt-0.5 font-semibold text-zinc-900">{watch.category}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                <p className="text-zinc-500">Connectivity</p>
                <p className="mt-0.5 font-semibold text-zinc-900">{watch.connectivity}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                <p className="text-zinc-500">Spec / Capacity</p>
                <p className="mt-0.5 font-semibold text-zinc-900 font-mono-num">
                  {watch.capacity_spec}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                <p className="text-zinc-500">Availability</p>
                <p
                  className={`mt-0.5 font-semibold font-mono-num ${
                    watch.stock_count > 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {watch.stock_count > 0 ? `${watch.stock_count} Units` : 'Out of Stock'}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Pricing, Story & Bargaining Profit Calculator */}
          <div className="flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="text-xs text-zinc-600 flex items-center gap-2 font-medium">
                <span>Color / Finish: {watch.color}</span>
              </div>

              <p className="text-sm text-zinc-700 leading-relaxed">
                {watch.description ||
                  'Genuine timepiece and electronics product curated by New Chiko Watch & Electronics.'}
              </p>

              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4">
                <TripleTapPrice
                  displayBuyingPrice={watch.display_buying_price}
                  realBuyingPrice={watch.real_buying_price}
                  minSellingPrice={watch.min_selling_price}
                  isAdmin={isAdmin}
                />
              </div>

              {/* Bargaining Profit Calculator (Admin mode) */}
              {isAdmin && (
                <div className="rounded-xl bg-zinc-50 border border-zinc-300 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-950">
                      <Calculator size={15} />
                      <span>Bargaining Profit Calculator</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBargainTool((v) => !v)}
                      className="text-xs text-zinc-600 hover:text-zinc-950 font-medium cursor-pointer"
                    >
                      {showBargainTool ? 'Hide' : 'Open'}
                    </button>
                  </div>

                  {showBargainTool && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="bargain-price"
                          className="text-xs text-zinc-600 whitespace-nowrap"
                        >
                          Customer Offer (৳)
                        </label>
                        <input
                          id="bargain-price"
                          type="text"
                          inputMode="numeric"
                          value={customerOfferStr}
                          onChange={(e) => setCustomerOfferStr(cleanIntegerInput(e.target.value))}
                          placeholder="0"
                          className="w-32 rounded-lg bg-white border border-zinc-300 px-3 py-2 text-right font-mono-num text-sm text-zinc-950 focus:outline-none focus:border-zinc-950"
                        />
                      </div>

                      <input
                        type="range"
                        min={Math.max(0, Math.round(watch.real_buying_price * 0.7))}
                        max={Math.max(100, Math.round(watch.display_buying_price * 1.05))}
                        step={50}
                        value={customerOffer}
                        onChange={(e) => setCustomerOfferStr(String(Number(e.target.value)))}
                        className="w-full accent-zinc-950"
                        aria-label="Customer offer slider"
                      />

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white p-2.5 border border-zinc-200">
                          <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1">
                            <Lock size={10} /> Real Cost
                          </p>
                          <p className="font-mono-num text-xs font-semibold text-zinc-950 mt-0.5">
                            {formatBDT(watch.real_buying_price)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 border border-zinc-200">
                          <p className="text-[11px] text-zinc-500">Net Profit</p>
                          <p
                            className={`font-mono-num text-xs font-semibold mt-0.5 ${
                              netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {formatBDT(netProfit)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 border border-zinc-200">
                          <p className="text-[11px] text-zinc-500">Margin</p>
                          <p className="font-mono-num text-xs font-semibold text-zinc-950 mt-0.5">
                            {marginPct}%
                          </p>
                        </div>
                      </div>

                      <p className={`text-xs font-medium ${dealStatus.tone}`}>
                        {dealStatus.label}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onAddToMemo(watch, customerOffer);
                    onClose();
                  }}
                  disabled={watch.stock_count <= 0}
                  className="flex-1 min-h-[46px] rounded-xl bg-[#09090B] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-40 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <ReceiptText size={17} />
                  <span>Create Digital Memo</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-h-[46px] px-5 rounded-xl border border-zinc-300 text-sm font-medium text-zinc-900 hover:bg-zinc-100 transition-all active:scale-[0.98] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
