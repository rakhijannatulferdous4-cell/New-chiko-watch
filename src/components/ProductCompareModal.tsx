import React from 'react';
import { Scale, X } from 'lucide-react';
import { motion } from 'motion/react';
import { WatchItem } from '../types/watch';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface ProductCompareModalProps {
  watches: WatchItem[];
  onClose: () => void;
  onSelectWatch: (watch: WatchItem) => void;
  onRemoveSaved: (id: string) => void;
}

export function ProductCompareModal({
  watches,
  onClose,
  onSelectWatch,
  onRemoveSaved,
}: ProductCompareModalProps) {
  const items = watches.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Compare Saved Products"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-4xl max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl bg-white border border-zinc-200 shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5">
            <Scale size={18} className="text-[#09090B]" />
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#09090B]">
                Side-by-Side Comparison
              </h2>
              <p className="text-xs text-zinc-500">
                Comparing {items.length} shortlisted products
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-950 cursor-pointer"
            aria-label="Close comparison"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-x-auto">
          <div
            className={`grid gap-4 min-w-[560px] ${
              items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {items.map((w) => {
              const savings = Math.max(0, w.display_buying_price - w.min_selling_price);
              const savingsPct =
                w.display_buying_price > 0
                  ? Math.round((savings / w.display_buying_price) * 100)
                  : 0;
              return (
                <div
                  key={w.id}
                  className="rounded-xl border border-zinc-200 bg-[#FCFBFA] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[5/4] bg-white border-b border-zinc-200/80 relative">
                      <WatchImage
                        src={w.image_url}
                        alt={`${w.brand} ${w.model}`}
                        brand={w.brand}
                        model={w.model}
                        category={w.category}
                        iconSize={28}
                      />
                    </div>
                    <div className="p-4 space-y-3 text-xs">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          {w.brand} · {w.category}
                        </p>
                        <h3 className="text-sm font-semibold text-[#09090B] mt-0.5 line-clamp-2">
                          {w.product_name || w.model}
                        </h3>
                      </div>

                      <div className="py-2.5 border-y border-zinc-200/80 space-y-0.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-zinc-500">Offer Price</span>
                          <span className="font-mono-num text-base font-bold text-[#09090B]">
                            {formatBDT(w.min_selling_price)}
                          </span>
                        </div>
                        {savings > 0 && (
                          <div className="flex items-baseline justify-between text-[11px]">
                            <span className="text-zinc-400 line-through font-mono-num">
                              Tag {formatBDT(w.display_buying_price)}
                            </span>
                            <span className="text-emerald-700 font-semibold font-mono-num">
                              Save {savingsPct}%
                            </span>
                          </div>
                        )}
                      </div>

                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between gap-2">
                          <dt className="text-zinc-500">Model</dt>
                          <dd className="font-medium text-zinc-900 text-right">{w.model}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-zinc-500">Color</dt>
                          <dd className="font-medium text-zinc-900 text-right">{w.color}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-zinc-500">Spec</dt>
                          <dd className="font-medium text-zinc-900 text-right font-mono-num">
                            {w.capacity_spec}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-zinc-500">Interface</dt>
                          <dd className="font-medium text-zinc-900 text-right">{w.connectivity}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-zinc-500">Stock</dt>
                          <dd
                            className={`font-semibold font-mono-num ${
                              w.stock_count > 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {w.stock_count > 0 ? `${w.stock_count} available` : 'Out of stock'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="p-3 pt-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectWatch(w);
                      }}
                      className="flex-1 min-h-[38px] rounded-lg bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSaved(w.id)}
                      className="min-h-[38px] px-3 rounded-lg border border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
