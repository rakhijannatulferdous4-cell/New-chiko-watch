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

  return (
    <div className="relative">
      <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
        {isAdmin ? (
          <button
            type="button"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
            className="text-left flex items-center w-full min-h-[44px] px-1.5 -mx-1.5 rounded-lg touch-manipulation select-none cursor-pointer active:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF37]/60 transition-colors"
            title="Tag Price"
          >
            <span className="text-xs text-[#9CA3AF]">
              Tag Price:{' '}
              <span className="font-mono-num line-through decoration-[#9CA3AF]/60 text-[#A1A1AA]">
                {formatBDT(displayBuyingPrice)}
              </span>
            </span>
          </button>
        ) : (
          <div className="py-1 select-none">
            <span className="text-xs text-[#9CA3AF]">
              Tag Price:{' '}
              <span className="font-mono-num line-through decoration-[#9CA3AF]/60 text-[#A1A1AA]">
                {formatBDT(displayBuyingPrice)}
              </span>
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-2">
          <span className={compact ? 'text-sm font-semibold text-[#F8F9FA]' : 'text-base font-semibold text-[#F8F9FA]'}>
            Offer Price:{' '}
            <span className="font-mono-num text-[#D4AF37]">
              {formatBDT(minSellingPrice)}
            </span>
          </span>
        </div>
      </div>

      <AnimatePresence>
        {isAdmin && showRealCost && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="mt-2 rounded-xl bg-[#0A0A0C]/95 backdrop-blur-md border border-[#D4AF37]/50 px-3 py-2 shadow-xl shadow-black/60 z-20"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#D4AF37] font-mono-num">
              <Lock size={13} className="shrink-0" />
              <span>
                Real Cost: {formatBDT(realBuyingPrice)} | Profit:{' '}
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
