import { useState } from 'react';
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
      return <Watch size={size} strokeWidth={1.35} className="text-[#D4AF37]" />;
    case 'TWS Earbuds':
    case 'Neckbands':
      return <Headphones size={size} strokeWidth={1.35} className="text-[#D4AF37]" />;
    case 'Power Banks':
      return <BatteryCharging size={size} strokeWidth={1.35} className="text-[#D4AF37]" />;
    case 'Chargers & Cables':
      return <PlugZap size={size} strokeWidth={1.35} className="text-[#D4AF37]" />;
    case 'Bluetooth Speakers':
      return <Speaker size={size} strokeWidth={1.35} className="text-[#D4AF37]" />;
    case 'Gadgets & Accessories':
    case 'Accessories':
      return <Cable size={size} strokeWidth={1.35} className="text-[#D4AF37]" />;
    default:
      return <Cpu size={size} strokeWidth={1.35} className="text-[#D4AF37]" />;
  }
}

export function WatchImage({
  src,
  alt,
  brand,
  model,
  category,
  className = '',
  iconSize = 44,
}: WatchImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center bg-gradient-to-br from-[#16161B] via-[#0F0F13] to-[#0A0A0C] text-[#D4AF37]/80 select-none overflow-hidden ${className}`}
        aria-label={alt}
      >
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 42%, rgba(212, 175, 55, 0.22), transparent 64%)',
          }}
        />
        <div className="relative flex flex-col items-center gap-2.5 px-4 text-center">
          <div className="w-16 h-16 rounded-full border border-[#D4AF37]/25 bg-[#0A0A0C]/70 flex items-center justify-center shadow-inner">
            {getCategoryIcon(category, iconSize)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] tracking-[0.18em] uppercase text-[#D4AF37]/80 font-medium">
              {brand}
            </p>
            <p className="text-xs text-[#F8F9FA]/60 line-clamp-1 max-w-[180px]">{model}</p>
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
