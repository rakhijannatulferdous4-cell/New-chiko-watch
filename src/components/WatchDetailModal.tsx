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
      ? { label: 'Loss Alert — Below Wholesale Cost', tone: 'text-rose-400' }
      : customerOffer < watch.min_selling_price
      ? { label: 'Below Floor — Tight Margin', tone: 'text-amber-300' }
      : { label: 'Healthy Deal — Above Minimum Floor', tone: 'text-emerald-400' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${watch.brand} ${watch.model} details`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-[#121216] border border-white/[0.1] shadow-2xl"
      >
        {/* Mobile drag handle */}
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div>
            <p className="text-xs text-[#D4AF37] font-medium tracking-wider uppercase">
              {watch.brand}
              {watch.product_name && watch.model && watch.product_name !== watch.model
                ? ` · ${watch.model}`
                : ''}
            </p>
            <h2 className="font-display text-2xl font-semibold text-[#F8F9FA]">
              {watch.product_name || watch.model}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.05] text-[#A1A1AA] hover:text-[#F8F9FA] hover:bg-white/[0.1] transition-colors"
            aria-label="Close product details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 md:p-6">
          {/* Left: Product Showcase */}
          <div className="space-y-4">
            <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-[#0A0A0C] border border-white/[0.08]">
              <WatchImage
                src={watch.image_url}
                alt={`${watch.brand} ${watch.model}`}
                brand={watch.brand}
                model={watch.model}
                category={watch.category}
                iconSize={56}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#0A0A0C]/70 border border-white/[0.06] p-3">
                <p className="text-[#9CA3AF]">Category</p>
                <p className="mt-0.5 font-medium text-[#F8F9FA]">{watch.category}</p>
              </div>
              <div className="rounded-xl bg-[#0A0A0C]/70 border border-white/[0.06] p-3">
                <p className="text-[#9CA3AF]">Connectivity</p>
                <p className="mt-0.5 font-medium text-[#F8F9FA]">{watch.connectivity}</p>
              </div>
              <div className="rounded-xl bg-[#0A0A0C]/70 border border-white/[0.06] p-3">
                <p className="text-[#9CA3AF]">Spec / Capacity</p>
                <p className="mt-0.5 font-medium text-[#F8F9FA] font-mono-num">
                  {watch.capacity_spec}
                </p>
              </div>
              <div className="rounded-xl bg-[#0A0A0C]/70 border border-white/[0.06] p-3">
                <p className="text-[#9CA3AF]">Availability</p>
                <p
                  className={`mt-0.5 font-medium font-mono-num ${
                    watch.stock_count > 0 ? 'text-emerald-400' : 'text-rose-400'
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
              <div className="text-xs text-[#A1A1AA] flex items-center gap-2">
                <span>{watch.color}</span>
              </div>

              <p className="text-sm text-[#D1D5DB] leading-relaxed">
                {watch.description ||
                  'Genuine electronics product curated by New Chiko Electronics.'}
              </p>

              <div className="rounded-2xl bg-[#0A0A0C]/80 border border-white/[0.08] p-4">
                <TripleTapPrice
                  displayBuyingPrice={watch.display_buying_price}
                  realBuyingPrice={watch.real_buying_price}
                  minSellingPrice={watch.min_selling_price}
                  isAdmin={isAdmin}
                />
              </div>

              {/* Bargaining Profit Calculator (Admin mode) */}
              {isAdmin && (
                <div className="rounded-2xl bg-[#0A0A0C]/90 border border-[#D4AF37]/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#D4AF37]">
                      <Calculator size={15} />
                      <span>Bargaining Profit Calculator</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBargainTool((v) => !v)}
                      className="text-xs text-[#9CA3AF] hover:text-[#F8F9FA]"
                    >
                      {showBargainTool ? 'Hide' : 'Open'}
                    </button>
                  </div>

                  {showBargainTool && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="bargain-price"
                          className="text-xs text-[#A1A1AA] whitespace-nowrap"
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
                          className="w-32 rounded-xl bg-[#16161B] border border-white/[0.12] px-3 py-2 text-right font-mono-num text-sm text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>

                      <input
                        type="range"
                        min={Math.max(0, Math.round(watch.real_buying_price * 0.7))}
                        max={Math.max(100, Math.round(watch.display_buying_price * 1.05))}
                        step={50}
                        value={customerOffer}
                        onChange={(e) => setCustomerOfferStr(String(Number(e.target.value)))}
                        className="w-full accent-[#D4AF37]"
                        aria-label="Customer offer slider"
                      />

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-[#141418] p-2.5 border border-white/[0.05]">
                          <p className="text-[11px] text-[#9CA3AF] flex items-center justify-center gap-1">
                            <Lock size={10} /> Real Cost
                          </p>
                          <p className="font-mono-num text-xs font-semibold text-[#F8F9FA] mt-0.5">
                            {formatBDT(watch.real_buying_price)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#141418] p-2.5 border border-white/[0.05]">
                          <p className="text-[11px] text-[#9CA3AF]">Net Profit</p>
                          <p
                            className={`font-mono-num text-xs font-semibold mt-0.5 ${
                              netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatBDT(netProfit)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#141418] p-2.5 border border-white/[0.05]">
                          <p className="text-[11px] text-[#9CA3AF]">Margin</p>
                          <p className="font-mono-num text-xs font-semibold text-[#D4AF37] mt-0.5">
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

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onAddToMemo(watch, isAdmin ? customerOffer : watch.min_selling_price);
                  onClose();
                }}
                disabled={watch.stock_count <= 0}
                className="flex-1 min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0A0A0C] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E5C158] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ReceiptText size={17} />
                <span>Create Digital Memo</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] px-5 rounded-xl border border-white/[0.12] text-sm font-medium text-[#F8F9FA] hover:bg-white/[0.05] transition-colors cursor-pointer"
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
