import React, { useEffect, useState } from 'react';
import { Check, Heart, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { WatchItem } from '../types/watch';
import { TripleTapPrice } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface WatchCardProps {
  watch: WatchItem;
  isAdmin: boolean;
  index?: number;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
  onSelect: (watch: WatchItem) => void;
  onAdjustStock?: (id: string, delta: number) => void;
  onEdit?: (watch: WatchItem) => void;
  onDelete?: (id: string) => void;
}

export function WatchCard({
  watch,
  isAdmin,
  index = 0,
  isSaved = false,
  onToggleSave,
  onSelect,
  onAdjustStock,
  onEdit,
  onDelete,
}: WatchCardProps) {
  const outOfStock = watch.stock_count <= 0;
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = window.setTimeout(() => setConfirmDelete(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmDelete]);

  // High-impact GPU-composited 3D tilt & depth tracking (desktop mouse + mobile touch)
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const activeDepth = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, { stiffness: 300, damping: 18, mass: 0.42 });
  const rotateY = useSpring(rawRotateY, { stiffness: 300, damping: 18, mass: 0.42 });
  const smoothDepth = useSpring(activeDepth, { stiffness: 320, damping: 20 });

  const imageZ = useTransform(smoothDepth, [0, 1], [0, 32]);
  const textZ = useTransform(smoothDepth, [0, 1], [0, 18]);
  const priceZ = useTransform(smoothDepth, [0, 1], [0, 26]);
  const glareOpacity = useTransform(smoothDepth, [0, 1], [0, 0.96]);

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.75), rgba(255,255,255,0.22) 34%, rgba(255,255,255,0) 70%)`;

  const applyTiltFromEvent = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    rawRotateX.set((0.5 - py) * 28);
    rawRotateY.set((px - 0.5) * 28);
    glareX.set(px * 100);
    glareY.set(py * 100);
    activeDepth.set(1);
  };

  const resetTilt = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
    glareX.set(50);
    glareY.set(50);
    activeDepth.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 42, rotateX: 28, rotateY: -10, scale: 0.82 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 245,
        damping: 19,
        delay: Math.min(index * 0.045, 0.36),
      }}
      style={{ perspective: 1000 }}
      className="h-full"
    >
      <motion.article
        onClick={() => onSelect(watch)}
        onPointerDown={applyTiltFromEvent}
        onPointerMove={applyTiltFromEvent}
        onPointerLeave={resetTilt}
        onPointerUp={resetTilt}
        onPointerCancel={resetTilt}
        whileHover={{ y: -8, scale: 1.03 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          touchAction: 'pan-y',
        }}
        className="group relative h-full flex flex-col rounded-xl bg-white border border-zinc-200 overflow-visible cursor-pointer transition-[box-shadow,border-color] duration-200 hover:border-zinc-900/50 hover:shadow-[0_22px_38px_-14px_rgba(9,9,11,0.32)] will-change-transform"
      >
        {/* Compact 5:4 3D Floating Visual Frame */}
        <motion.div
          style={{ z: imageZ, transformStyle: 'preserve-3d' }}
          className="relative aspect-[5/4] w-full rounded-t-xl bg-[radial-gradient(circle_at_50%_36%,#FFFFFF_0%,#F6F4EF_64%,#ECE8E0_100%)] overflow-hidden border-b border-stone-200/70"
        >
          <WatchImage
            src={watch.image_url}
            alt={`${watch.brand} ${watch.model}`}
            brand={watch.brand}
            model={watch.model}
            category={watch.category}
            iconSize={24}
            className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 card-luxury-sheen"
          />
          <motion.div
            aria-hidden="true"
            style={{ background: glareBackground, opacity: glareOpacity }}
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
          />
          {outOfStock && (
            <span
              style={{ transform: 'translateZ(20px)' }}
              className="absolute top-1.5 left-1.5 bg-zinc-950/90 text-white text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded shadow-sm"
            >
              Sold Out
            </span>
          )}
          {onToggleSave && (
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(watch.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              whileTap={{ scale: 0.78 }}
              style={{ transform: 'translateZ(22px)' }}
              className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer ${
                isSaved
                  ? 'bg-white/95 text-rose-600 shadow-xs opacity-100'
                  : 'bg-white/75 text-zinc-500 hover:text-zinc-950 opacity-85 sm:opacity-0 sm:group-hover:opacity-100'
              }`}
              aria-label={isSaved ? 'Remove from saved shortlist' : 'Save to shortlist'}
              title={isSaved ? 'Saved' : 'Save item'}
            >
              <Heart size={13} className={isSaved ? 'fill-rose-600' : ''} />
            </motion.button>
          )}
        </motion.div>

        {/* Compact Structured Card Body with 3D Pop-Out Depth */}
        <div
          style={{ transformStyle: 'preserve-3d' }}
          className="flex flex-1 flex-col justify-between p-2 sm:p-2.5 gap-1"
        >
          <motion.div style={{ z: textZ }} className="space-y-0.5">
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-zinc-500 truncate">
              <span className="font-semibold text-zinc-900 uppercase tracking-wider shrink-0">
                {watch.brand}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{watch.category}</span>
            </div>

            <h3 className="text-[11.5px] sm:text-[13px] font-semibold text-[#09090B] leading-tight line-clamp-2 min-h-[1.85rem]">
              {watch.product_name || watch.model}
            </h3>

            <p className="text-[9.5px] sm:text-[10.5px] text-zinc-500 line-clamp-1">
              {watch.product_name && watch.model && watch.product_name !== watch.model
                ? `${watch.model} · ${watch.color}`
                : `${watch.color} · ${watch.capacity_spec}`}
            </p>
          </motion.div>

          <motion.div style={{ z: priceZ }} className="pt-1 border-t border-zinc-100 space-y-0.5">
            <TripleTapPrice
              displayBuyingPrice={watch.display_buying_price}
              realBuyingPrice={watch.real_buying_price}
              minSellingPrice={watch.min_selling_price}
              isAdmin={isAdmin}
              compact
            />

            <div className="flex items-center justify-between text-[9.5px] sm:text-[10.5px] pt-0.5">
              <span
                className={`font-mono-num font-medium ${
                  outOfStock
                    ? 'text-rose-600'
                    : watch.stock_count <= 2
                    ? 'text-amber-700'
                    : 'text-zinc-600'
                }`}
              >
                {outOfStock ? 'Out of stock' : `${watch.stock_count} left`}
              </span>
              <span className="text-zinc-900 font-semibold opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform">
                View →
              </span>
            </div>
          </motion.div>

          {isAdmin && (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="pt-1 border-t border-zinc-100 flex items-center justify-between gap-1"
            >
              <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => onAdjustStock?.(watch.id, -1)}
                  disabled={watch.stock_count <= 0}
                  className="min-h-[26px] min-w-[26px] flex items-center justify-center rounded text-zinc-600 hover:text-zinc-950 hover:bg-white disabled:opacity-35 transition-transform active:scale-75 cursor-pointer"
                  aria-label="Decrease stock"
                >
                  <Minus size={11} />
                </button>
                <span className="font-mono-num text-[10.5px] font-semibold px-1 text-zinc-950">
                  {watch.stock_count}
                </span>
                <button
                  type="button"
                  onClick={() => onAdjustStock?.(watch.id, 1)}
                  className="min-h-[26px] min-w-[26px] flex items-center justify-center rounded text-zinc-600 hover:text-zinc-950 hover:bg-white transition-transform active:scale-75 cursor-pointer"
                  aria-label="Increase stock"
                >
                  <Plus size={11} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                {confirmDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDelete(false);
                        onDelete?.(watch.id);
                      }}
                      className="min-h-[28px] px-1.5 flex items-center justify-center gap-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-semibold transition-transform active:scale-90 cursor-pointer"
                      aria-label={`Confirm delete ${watch.model}`}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-transform active:scale-75 cursor-pointer"
                      aria-label="Cancel delete"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit?.(watch)}
                      className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-900 hover:bg-zinc-100 transition-transform active:scale-75 cursor-pointer"
                      aria-label={`Edit ${watch.model}`}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg border border-zinc-200 text-rose-600 hover:bg-rose-50 transition-transform active:scale-75 cursor-pointer"
                      aria-label={`Delete ${watch.model}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}
