import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface TripleTapPriceProps {
  displayBuyingPrice: number;
  realBuyingPrice: number;
  minSellingPrice: number;
  isAdmin: boolean;
  compact?: boolean;
}

export function formatBDT(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-IN')}`;
}

export function TripleTapPrice({
  displayBuyingPrice,
  realBuyingPrice,
  minSellingPrice,
  isAdmin,
  compact = false,
}: TripleTapPriceProps) {
  const [showRealCost, setShowRealCost] = useState(false);
  const showRealCostRef = useRef(false);
  const tapTimesRef = useRef<number[]>([]);
  const hideTimerRef = useRef<number | null>(null);
  const lastTouchEndRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      tapTimesRef.current = [];
      showRealCostRef.current = false;
      setShowRealCost(false);
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [isAdmin]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const registerTap = () => {
    if (!isAdmin) {
      tapTimesRef.current = [];
      showRealCostRef.current = false;
      setShowRealCost(false);
      return;
    }

    const now = Date.now();
    const recent = tapTimesRef.current.filter((t) => now - t <= 600);
    recent.push(now);
    tapTimesRef.current = recent;

    if (recent.length >= 3) {
      tapTimesRef.current = [];
      const next = !showRealCostRef.current;
      showRealCostRef.current = next;
      setShowRealCost(next);

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (next) {
        hideTimerRef.current = window.setTimeout(() => {
          showRealCostRef.current = false;
          setShowRealCost(false);
          hideTimerRef.current = null;
        }, 5000);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAdmin) return;
    e.stopPropagation();
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isAdmin) return;
    e.stopPropagation();
    const start = touchStartRef.current;
    const touch = e.changedTouches[0];
    touchStartRef.current = null;

    if (start && touch) {
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (dx > 16 || dy > 16) {
        return;
      }
    }

    if (e.cancelable) {
      e.preventDefault();
    }
    lastTouchEndRef.current = Date.now();
    registerTap();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isAdmin) return;
    e.stopPropagation();
    if (Date.now() - lastTouchEndRef.current < 450) {
      return;
    }
    registerTap();
  };

  const profit = minSellingPrice - realBuyingPrice;
  const hasTagDiscount = displayBuyingPrice > minSellingPrice;
  const discountPct =
    hasTagDiscount && displayBuyingPrice > 0
      ? Math.round(((displayBuyingPrice - minSellingPrice) / displayBuyingPrice) * 100)
      : 0;

  return (
    <div className="relative">
      {compact ? (
        <div className="space-y-0.5">
          <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
            <span className="font-mono-num text-[15px] sm:text-base font-bold text-[#09090B] tracking-tight">
              {formatBDT(minSellingPrice)}
            </span>
            {hasTagDiscount && (
              <span className="font-mono-num text-[11px] text-zinc-500 line-through">
                {formatBDT(displayBuyingPrice)}
              </span>
            )}
            {discountPct > 0 && (
              <span className="font-mono-num text-[10px] font-semibold text-zinc-900">
                -{discountPct}%
              </span>
            )}
          </div>

          {isAdmin && (
            <button
              type="button"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={handleClick}
              className="text-left flex items-center w-full min-h-[32px] px-1 -mx-1 rounded touch-manipulation select-none cursor-pointer hover:bg-zinc-100 active:bg-zinc-200/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 transition-colors"
              title="Tag Price (Triple-tap for real cost)"
            >
              <span className="text-[11px] text-zinc-500">
                Tag:{' '}
                <span className="font-mono-num line-through text-zinc-500">
                  {formatBDT(displayBuyingPrice)}
                </span>
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {isAdmin ? (
            <button
              type="button"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={handleClick}
              className="text-left flex items-center w-full min-h-[40px] px-2 -mx-2 rounded-lg touch-manipulation select-none cursor-pointer hover:bg-zinc-100 active:bg-zinc-200/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 transition-colors"
              title="Tag Price (Triple-tap for real cost)"
            >
              <span className="text-xs text-zinc-500">
                Tag Price:{' '}
                <span className="font-mono-num line-through decoration-zinc-400 text-zinc-500">
                  {formatBDT(displayBuyingPrice)}
                </span>
              </span>
            </button>
          ) : (
            <div className="py-0.5 select-none">
              <span className="text-xs text-zinc-500">
                Tag Price:{' '}
                <span className="font-mono-num line-through decoration-zinc-400 text-zinc-500">
                  {formatBDT(displayBuyingPrice)}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-semibold text-zinc-900">
              Offer Price:{' '}
              <span className="font-mono-num text-xl font-bold text-[#09090B]">
                {formatBDT(minSellingPrice)}
              </span>
            </span>
            {discountPct > 0 && (
              <span className="font-mono-num text-xs font-semibold text-zinc-900">
                Save {discountPct}%
              </span>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isAdmin && showRealCost && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="mt-2 rounded-lg bg-[#09090B] text-white px-2.5 py-1.5 shadow-lg z-20"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium font-mono-num">
              <Lock size={12} className="shrink-0 text-zinc-300" />
              <span>
                Cost: {formatBDT(realBuyingPrice)} · Profit:{' '}
                <span className={profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {formatBDT(profit)}
                </span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
