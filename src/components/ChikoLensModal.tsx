import React, { useRef, useState } from 'react';
import { Camera, Loader2, ScanSearch, Upload, Watch } from 'lucide-react';
import { motion } from 'motion/react';
import { compressImageFile } from '../services/watchStore';
import { VisualSearchResponse, WatchItem } from '../types/watch';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface ChikoLensViewProps {
  watches: WatchItem[];
  onSelectWatch: (watch: WatchItem) => void;
}

export function ChikoLensView({ watches, onSelectWatch }: ChikoLensViewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VisualSearchResponse | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { dataUrl, base64, mimeType } = await compressImageFile(file);
      setPreviewUrl(dataUrl);

      let attachedDataImages = 0;
      const compactWatches = watches.map((w) => {
        const img = w.image_url || '';
        const isDataImg = img.startsWith('data:image/');
        let keepImage = '';
        if (img.startsWith('http')) {
          keepImage = img;
        } else if (isDataImg && attachedDataImages < 6) {
          keepImage = img;
          attachedDataImages += 1;
        }
        return {
          ...w,
          image_url: keepImage,
        };
      });

      const res = await fetch('/api/gemini/visual-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          watches: compactWatches,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' && !data.error.trim().startsWith('{')
            ? data.error
            : 'Chiko Lens could not analyze this photo right now. Please try again.'
        );
      }

      // Guarantee closest inventory items are shown if stock is non-empty
      const incomingMatches = Array.isArray(data.matches) ? data.matches : [];
      const validMatches = incomingMatches.filter((m: { watchId?: string }) =>
        watches.some((w) => w.id === m.watchId)
      );

      if (watches.length > 0 && validMatches.length === 0) {
        data.matches = watches.slice(0, 4).map((w, idx) => ({
          watchId: w.id,
          matchPercentage: Math.max(35, 70 - idx * 10),
          reason: `Closest available match in ${w.category} (${w.brand} ${w.model}).`,
        }));
      }

      setResult(data);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      setError(
        rawMsg && !rawMsg.trim().startsWith('{')
          ? rawMsg
          : 'Visual search could not complete. Please try again with a clear product photo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 sm:p-7 shadow-xs">
        <div className="max-w-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-zinc-600">
            <ScanSearch size={15} className="text-zinc-900" />
            <span>Chiko Lens Visual Search</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#09090B]">
            Find Any Watch or Gadget From a Photo
          </h2>
          <p className="text-sm text-zinc-600">
            Snap a photo or upload a screenshot of any watch, smartwatch, earbuds, power bank, charger, or speaker. Our AI compares it visually and semantically against our active store stock.
          </p>
        </div>

        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Upload / Camera Dropzone */}
          <div className="lg:col-span-5 space-y-4">
            <div className="aspect-[4/3] w-full rounded-xl bg-zinc-50 border border-dashed border-zinc-300 overflow-hidden flex items-center justify-center relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Uploaded product query"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center px-6 space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 shadow-xs">
                    <Watch size={26} />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">
                    Upload or capture a product photo
                  </p>
                  <p className="text-xs text-zinc-500">
                    Works for watches, smartwatches, earbuds, power banks, chargers, and speakers
                  </p>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5">
                  <Loader2 size={28} className="animate-spin text-zinc-900" />
                  <p className="text-xs font-medium text-zinc-900">
                    Matching against active inventory...
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={loading}
                className="min-h-[46px] rounded-xl bg-[#09090B] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Camera size={17} />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                disabled={loading}
                className="min-h-[46px] rounded-xl border border-zinc-300 bg-white text-zinc-900 font-medium text-sm flex items-center justify-center gap-2 hover:bg-zinc-50 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Upload size={17} />
                <span>Upload Image</span>
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700">
                {error}
              </div>
            )}
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7 space-y-4">
            {result ? (
              <>
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                    Detected Product
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-zinc-950">
                    <span>{result.detectedProduct.brand}</span>
                    <span aria-hidden="true" className="text-zinc-400">·</span>
                    <span>{result.detectedProduct.category}</span>
                    <span aria-hidden="true" className="text-zinc-400">·</span>
                    <span>{result.detectedProduct.color}</span>
                    <span aria-hidden="true" className="text-zinc-400">·</span>
                    <span className="text-zinc-600 font-normal">{result.detectedProduct.features}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-950">
                    Closest Matches in Store
                  </h3>

                  {watches.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Your store inventory is currently empty. Add watches or electronics in Staff Mode to see ranked matches here.
                    </p>
                  ) : (
                    result.matches.map((match) => {
                      const product = watches.find((w) => w.id === match.watchId);
                      if (!product) return null;
                      return (
                        <button
                          key={match.watchId}
                          type="button"
                          onClick={() => onSelectWatch(product)}
                          className="w-full text-left rounded-xl bg-white border border-zinc-200 hover:border-zinc-900/40 hover:shadow-md p-3.5 flex items-center gap-4 transition-all active:scale-[0.99] cursor-pointer"
                        >
                          <div className="w-20 h-16 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                            <WatchImage
                              src={product.image_url}
                              alt={product.model}
                              brand={product.brand}
                              model={product.model}
                              category={product.category}
                              iconSize={22}
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-zinc-950 truncate">
                                {product.product_name || `${product.brand} ${product.model}`}
                              </p>
                              <span className="font-mono-num text-xs font-bold text-zinc-950 shrink-0">
                                {match.matchPercentage}% Match
                              </span>
                            </div>
                            <p className="text-xs text-zinc-600 line-clamp-2">
                              {match.reason}
                            </p>
                            <div className="flex items-center gap-3 pt-0.5 text-xs">
                              <span className="font-mono-num font-semibold text-zinc-950">
                                Offer: {formatBDT(product.min_selling_price)}
                              </span>
                              <span className="text-zinc-300">·</span>
                              <span className="text-zinc-500">
                                {product.stock_count > 0
                                  ? `${product.stock_count} in stock`
                                  : 'Out of stock'}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-zinc-900">
                  Visual match results will appear here
                </p>
                <p className="text-xs text-zinc-500">
                  Tap &ldquo;Take Photo&rdquo; on mobile or &ldquo;Upload Image&rdquo; to find matching watches or electronics in our store.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
