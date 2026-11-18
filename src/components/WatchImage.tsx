import { useEffect, useState } from 'react';
import {
  BatteryCharging,
  Cable,
  Cpu,
  Headphones,
  PlugZap,
  Speaker,
  Watch,
} from 'lucide-react';
import { ProductCategory } from '../types/watch';

interface WatchImageProps {
  src?: string;
  alt: string;
  brand: string;
  model: string;
  category?: ProductCategory | string;
  className?: string;
  iconSize?: number;
}

function getCategoryIcon(category: string | undefined, size: number) {
  switch (category) {
    case 'Analog Watches':
    case 'Digital Watches':
    case 'Smartwatches':
      return <Watch size={size} strokeWidth={1.35} className="text-zinc-900" />;
    case 'TWS Earbuds':
    case 'Neckbands':
      return <Headphones size={size} strokeWidth={1.35} className="text-zinc-900" />;
    case 'Power Banks':
      return <BatteryCharging size={size} strokeWidth={1.35} className="text-zinc-900" />;
    case 'Chargers & Cables':
      return <PlugZap size={size} strokeWidth={1.35} className="text-zinc-900" />;
    case 'Bluetooth Speakers':
      return <Speaker size={size} strokeWidth={1.35} className="text-zinc-900" />;
    case 'Gadgets & Accessories':
    case 'Accessories':
      return <Cable size={size} strokeWidth={1.35} className="text-zinc-900" />;
    default:
      return <Cpu size={size} strokeWidth={1.35} className="text-zinc-900" />;
  }
}

export function WatchImage({
  src,
  alt,
  brand,
  model,
  category,
  className = '',
  iconSize = 36,
}: WatchImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-[#F8F8FA] via-[#F4F4F5] to-[#EAEAEF] text-zinc-900 select-none overflow-hidden ${className}`}
        aria-label={alt}
      >
        <div className="relative flex flex-col items-center gap-2 px-3 text-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-zinc-200 bg-white flex items-center justify-center shadow-xs">
            {getCategoryIcon(category, iconSize)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] tracking-[0.16em] uppercase text-zinc-700 font-semibold">
              {brand}
            </p>
            <p className="text-[11px] text-zinc-500 line-clamp-1 max-w-[140px]">{model}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover w-full h-full ${className}`}
    />
  );
}
