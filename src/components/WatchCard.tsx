import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { WatchItem } from '../types/watch';
import { TripleTapPrice } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface WatchCardProps {
  watch: WatchItem;
  isAdmin: boolean;
  onSelect: (watch: WatchItem) => void;
  onAdjustStock?: (id: string, delta: number) => void;
  onEdit?: (watch: WatchItem) => void;
  onDelete?: (id: string) => void;
}

export function WatchCard({
  watch,
  isAdmin,
  onSelect,
  onAdjustStock,
  onEdit,
  onDelete,
}: WatchCardProps) {
  const outOfStock = watch.stock_count <= 0;

  return (
    <article
      onClick={() => onSelect(watch)}
      className="group relative flex flex-col rounded-xl bg-white border border-zinc-200 overflow-hidden cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-zinc-900/30 hover:shadow-[0_12px_28px_-12px_rgba(9,9,11,0.16)] active:scale-[0.99]"
    >
      {/* Compact Square Marketplace Product Visual */}
      <div className="relative aspect-square w-full bg-[#F4F4F5] overflow-hidden border-b border-zinc-100">
        <WatchImage
          src={watch.image_url}
          alt={`${watch.brand} ${watch.model}`}
          brand={watch.brand}
          model={watch.model}
          category={watch.category}
          className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
        />
        {outOfStock && (
          <span className="absolute top-2 left-2 bg-zinc-950/90 text-white text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded">
            Sold Out
          </span>
        )}
      </div>

      {/* Compact Structured Card Body */}
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3 gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-500 truncate">
            <span className="font-semibold text-zinc-900 uppercase tracking-wider shrink-0">
              {watch.brand}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{watch.category}</span>
          </div>

          <h3 className="text-[13px] sm:text-sm font-semibold text-[#09090B] leading-snug line-clamp-2 min-h-[2.25rem]">
            {watch.product_name || watch.model}
          </h3>

          <p className="text-[11px] text-zinc-500 line-clamp-1">
            {watch.product_name && watch.model && watch.product_name !== watch.model
              ? `${watch.model} · ${watch.color}`
              : `${watch.color} · ${watch.capacity_spec}`}
          </p>
        </div>

        <div className="pt-1.5 border-t border-zinc-100 space-y-1">
          <TripleTapPrice
            displayBuyingPrice={watch.display_buying_price}
            realBuyingPrice={watch.real_buying_price}
            minSellingPrice={watch.min_selling_price}
            isAdmin={isAdmin}
            compact
          />

          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <span
              className={`font-mono-num font-medium ${
                outOfStock
                  ? 'text-rose-600'
                  : watch.stock_count <= 2
                  ? 'text-amber-700'
                  : 'text-zinc-600'
              }`}
            >
              {outOfStock ? 'Out of stock' : `${watch.stock_count} in stock`}
            </span>
            <span className="text-zinc-900 font-medium opacity-80 group-hover:opacity-100 group-hover:underline">
              View
            </span>
          </div>
        </div>

        {isAdmin && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-1.5"
          >
            <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => onAdjustStock?.(watch.id, -1)}
                disabled={watch.stock_count <= 0}
                className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded text-zinc-600 hover:text-zinc-950 hover:bg-white disabled:opacity-35 transition-colors active:scale-95 cursor-pointer"
                aria-label="Decrease stock"
              >
                <Minus size={12} />
              </button>
              <span className="font-mono-num text-[11px] font-semibold px-1.5 text-zinc-950">
                {watch.stock_count}
              </span>
              <button
                type="button"
                onClick={() => onAdjustStock?.(watch.id, 1)}
                className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded text-zinc-600 hover:text-zinc-950 hover:bg-white transition-colors active:scale-95 cursor-pointer"
                aria-label="Increase stock"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit?.(watch)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-900 hover:bg-zinc-100 transition-colors active:scale-95 cursor-pointer"
                aria-label={`Edit ${watch.model}`}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(watch.id)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-zinc-200 text-rose-600 hover:bg-rose-50 transition-colors active:scale-95 cursor-pointer"
                aria-label={`Delete ${watch.model}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
