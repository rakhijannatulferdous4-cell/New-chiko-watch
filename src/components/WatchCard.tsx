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
      className="group relative flex flex-col rounded-2xl bg-[#121216]/85 backdrop-blur-md border border-white/[0.08] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37]/40 hover:shadow-2xl hover:shadow-black/50"
    >
      {/* Product Imagery / Electronics Icon Fallback (4:3 uniform aspect) */}
      <div className="relative aspect-[4/3] w-full bg-[#0E0E12] overflow-hidden border-b border-white/[0.06]">
        <WatchImage
          src={watch.image_url}
          alt={`${watch.brand} ${watch.model}`}
          brand={watch.brand}
          model={watch.model}
          category={watch.category}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C]/65 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-medium">
          <span className="text-[#F8F9FA]/85 tracking-wide truncate">
            {watch.capacity_spec} · {watch.connectivity}
          </span>
          <span
            className={`font-mono-num shrink-0 ${
              outOfStock
                ? 'text-rose-400'
                : watch.stock_count <= 2
                ? 'text-amber-300'
                : 'text-emerald-400'
            }`}
          >
            {outOfStock ? 'Sold Out' : `${watch.stock_count} in stock`}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
            <span className="text-[#D4AF37] font-medium">{watch.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{watch.category}</span>
          </div>
          <h3 className="text-base font-semibold text-[#F8F9FA] leading-snug line-clamp-1">
            {watch.product_name || watch.model}
          </h3>
          <p className="text-xs text-[#9CA3AF] line-clamp-1">
            {watch.product_name && watch.model && watch.product_name !== watch.model
              ? `${watch.model} · ${watch.color}`
              : watch.color}
          </p>
        </div>

        <div className="pt-2 border-t border-white/[0.06]">
          <TripleTapPrice
            displayBuyingPrice={watch.display_buying_price}
            realBuyingPrice={watch.real_buying_price}
            minSellingPrice={watch.min_selling_price}
            isAdmin={isAdmin}
            compact
          />
        </div>

        {isAdmin && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-1 bg-[#0A0A0C] border border-white/[0.08] rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => onAdjustStock?.(watch.id, -1)}
                disabled={watch.stock_count <= 0}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#A1A1AA] hover:text-[#F8F9FA] hover:bg-white/[0.06] disabled:opacity-35 transition-colors"
                aria-label="Decrease stock"
              >
                <Minus size={14} />
              </button>
              <span className="font-mono-num text-xs px-2 text-[#F8F9FA]">
                {watch.stock_count}
              </span>
              <button
                type="button"
                onClick={() => onAdjustStock?.(watch.id, 1)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#A1A1AA] hover:text-[#F8F9FA] hover:bg-white/[0.06] transition-colors"
                aria-label="Increase stock"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit?.(watch)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-white/[0.08] text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                aria-label={`Edit ${watch.model}`}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(watch.id)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-white/[0.08] text-rose-400 hover:bg-rose-500/10 transition-colors"
                aria-label={`Delete ${watch.model}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
