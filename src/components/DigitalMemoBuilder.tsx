import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DigitalMemo, MemoLineItem, WatchItem } from '../types/watch';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface DigitalMemoBuilderProps {
  watches: WatchItem[];
  initialItems: MemoLineItem[];
  savedMemos: DigitalMemo[];
  onSaveMemo: (memo: DigitalMemo) => Promise<void>;
  onDeleteMemo: (id: string) => Promise<void>;
  onClearDraftItems: () => void;
}

function cleanPriceInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

function cleanQuantityInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

export function DigitalMemoBuilder({
  watches,
  initialItems,
  savedMemos,
  onSaveMemo,
  onDeleteMemo,
  onClearDraftItems,
}: DigitalMemoBuilderProps) {
  const [items, setItems] = useState<MemoLineItem[]>(initialItems);
  const [productQuery, setProductQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DigitalMemo['payment_method']>('Cash');
  const [discountStr, setDiscountStr] = useState<string>('');
  const [notes, setNotes] = useState('Official replacement & service warranty included.');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState('');
  const [saveError, setSaveError] = useState('');

  const [confirmDeleteMemoId, setConfirmDeleteMemoId] = useState<string | null>(null);
  const [deletingMemoId, setDeletingMemoId] = useState<string | null>(null);
  const [deleteMemoError, setDeleteMemoError] = useState('');

  const pickerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialItems.length > 0) {
      setItems((prev) => {
        const merged = [...prev];
        for (const incoming of initialItems) {
          if (!merged.some((m) => m.watchId === incoming.watchId)) {
            merged.push(incoming);
          }
        }
        return merged;
      });
      onClearDraftItems();
    }
  }, [initialItems, onClearDraftItems]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!confirmDeleteMemoId) return;
    const timer = window.setTimeout(() => setConfirmDeleteMemoId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmDeleteMemoId]);

  useEffect(() => {
    if (!justAddedId) return;
    const timer = window.setTimeout(() => setJustAddedId(null), 1100);
    return () => window.clearTimeout(timer);
  }, [justAddedId]);

  // Fast multi-token product filtering designed for thousands of inventory items
  const filteredProducts = useMemo(() => {
    const trimmed = productQuery.trim().toLowerCase();
    if (!trimmed) {
      return watches;
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    return watches.filter((w) => {
      const hay =
        `${w.product_name ?? ''} ${w.brand} ${w.model} ${w.category} ${w.color} ${w.connectivity} ${w.capacity_spec}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [watches, productQuery]);

  const visibleMatches = useMemo(() => filteredProducts.slice(0, 50), [filteredProducts]);

  const invoiceNumber = useMemo(() => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const prefix = `NCE-${ymd}-`;
    const existingSet = new Set(savedMemos.map((m) => m.invoice_number));
    let maxSeq = 100;
    for (const m of savedMemos) {
      if (m.invoice_number.startsWith(prefix)) {
        const suffixNum = Number(m.invoice_number.slice(prefix.length));
        if (Number.isFinite(suffixNum) && suffixNum > maxSeq) {
          maxSeq = suffixNum;
        }
      }
    }
    let candidateSeq = Math.max(101, maxSeq + 1, savedMemos.length + 101);
    while (existingSet.has(`${prefix}${candidateSeq}`)) {
      candidateSeq += 1;
    }
    return `${prefix}${candidateSeq}`;
  }, [savedMemos]);

  const discount = Number(discountStr) || 0;
  const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const handleAddProductToMemo = (product: WatchItem) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.watchId === product.id);
      if (existing) {
        return prev.map((p) =>
          p.watchId === product.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [
        ...prev,
        {
          watchId: product.id,
          brand: product.brand,
          model: product.model,
          color: product.color,
          quantity: 1,
          unitPrice: product.min_selling_price,
          realCost: product.real_buying_price,
        },
      ];
    });
    setJustAddedId(product.id);
    setPickerOpen(false);
  };

  const updateLine = (watchId: string, patch: Partial<MemoLineItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.watchId === watchId ? { ...item, ...patch } : item))
    );
  };

  const removeLine = (watchId: string) => {
    setItems((prev) => prev.filter((item) => item.watchId !== watchId));
  };

  const handleCopySummary = async () => {
    const lines = [
      `NEW CHIKO WATCH & ELECTRONICS — DIGITAL MEMO`,
      `Invoice: ${invoiceNumber}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Customer: ${customerName || 'Walk-in Guest'}${customerPhone ? ` (${customerPhone})` : ''}`,
      `---`,
      ...items.map(
        (i) => `${i.brand} ${i.model} x${i.quantity} — ${formatBDT(i.unitPrice * i.quantity)}`
      ),
      discount > 0 ? `Discount: -${formatBDT(discount)}` : '',
      `Total Paid (${paymentMethod}): ${formatBDT(grandTotal)}`,
      notes ? `Note: ${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSaveMemo = async () => {
    if (items.length === 0) return;
    setSaving(true);
    setSaveError('');
    try {
      const memo: DigitalMemo = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `memo-${Date.now()}`,
        invoice_number: invoiceNumber,
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim(),
        payment_method: paymentMethod,
        discount_amount: discount,
        total_amount: grandTotal,
        notes,
        items,
        created_at: new Date().toISOString(),
      };
      await onSaveMemo(memo);
      setLastSavedInvoice(invoiceNumber);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unable to save digital memo. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistoryMemo = async (id: string) => {
    setDeletingMemoId(id);
    setDeleteMemoError('');
    try {
      await onDeleteMemo(id);
      setConfirmDeleteMemoId(null);
    } catch (err) {
      setDeleteMemoError(
        err instanceof Error ? err.message : 'Unable to delete memo. Please try again.'
      );
    } finally {
      setDeletingMemoId(null);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Builder Controls */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 290, damping: 26 }}
          className="lg:col-span-6 rounded-2xl bg-white border border-zinc-200 p-5 space-y-5 shadow-xs no-print"
        >
          <div>
            <p className="text-xs text-zinc-500 font-semibold tracking-wider uppercase">
              Quick Digital Memo
            </p>
            <h2 className="font-display text-2xl font-semibold text-[#09090B]">
              Branded Receipt Generator
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Tanvir Ahmed"
                className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] focus:outline-none focus:bg-white focus:border-zinc-950 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700">Phone Number</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] font-mono-num focus:outline-none focus:bg-white focus:border-zinc-950 transition-colors"
              />
            </div>
          </div>

          {/* Searchable Product Selector (Optimized for Thousands of Products) */}
          <div className="space-y-1.5 relative" ref={pickerRef}>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="memo-product-search"
                className="text-xs font-medium text-zinc-700"
              >
                Search &amp; Add Product to Bill
              </label>
              <span className="text-[11px] text-zinc-500 font-mono-num">
                {watches.length.toLocaleString('en-IN')} items
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  id="memo-product-search"
                  type="text"
                  value={productQuery}
                  onFocus={() => setPickerOpen(true)}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setPickerOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setPickerOpen(false);
                    } else if (e.key === 'Enter' && visibleMatches.length > 0 && pickerOpen) {
                      e.preventDefault();
                      handleAddProductToMemo(visibleMatches[0]);
                    }
                  }}
                  disabled={watches.length === 0}
                  placeholder={
                    watches.length === 0
                      ? 'No products added yet'
                      : 'Search name, brand, model, or category...'
                  }
                  className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 pl-9 pr-9 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950 disabled:opacity-50 transition-colors"
                />
                {productQuery && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => {
                      setProductQuery('');
                      setPickerOpen(true);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/70 transition-colors cursor-pointer"
                    aria-label="Clear product search"
                  >
                    <X size={14} />
                  </motion.button>
                )}
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                onClick={() => {
                  setPickerOpen((prev) => !prev);
                  if (!pickerOpen) {
                    searchInputRef.current?.focus();
                  }
                }}
                disabled={watches.length === 0}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#09090B] text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 hover:bg-zinc-800 disabled:opacity-40 shrink-0 cursor-pointer shadow-xs"
              >
                <Search size={14} />
                <span>{pickerOpen ? 'Hide' : 'Find'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`}
                />
              </motion.button>
            </div>

            {/* Animated Search Results Dropdown */}
            <AnimatePresence>
              {pickerOpen && watches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.96, rotateX: 12 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97, rotateX: 8 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                  style={{ transformPerspective: 1000, transformOrigin: 'top center' }}
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-2xl bg-white border border-zinc-200 shadow-[0_24px_48px_-12px_rgba(9,9,11,0.28)] overflow-hidden"
                >
                  <div className="px-3.5 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="font-medium">
                      {filteredProducts.length === 0
                        ? 'No matching products'
                        : filteredProducts.length > visibleMatches.length
                        ? `Showing top ${visibleMatches.length} of ${filteredProducts.length.toLocaleString('en-IN')} matches`
                        : `${filteredProducts.length.toLocaleString('en-IN')} matching item(s)`}
                    </span>
                    <span className="hidden sm:inline text-zinc-400">Tap item to add</span>
                  </div>

                  {visibleMatches.length === 0 ? (
                    <div className="p-6 text-center space-y-2">
                      <p className="text-xs font-medium text-zinc-700">
                        No products matched &ldquo;{productQuery}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => setProductQuery('')}
                        className="min-h-[34px] px-3 rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-900 hover:bg-zinc-200 transition-colors cursor-pointer"
                      >
                        Reset Search
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 p-1.5 space-y-0.5">
                      {visibleMatches.map((product, idx) => {
                        const alreadyAdded = items.some((i) => i.watchId === product.id);
                        const isFlashed = justAddedId === product.id;

                        return (
                          <motion.button
                            key={product.id}
                            type="button"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.16,
                              delay: Math.min(idx * 0.015, 0.15),
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            whileHover={{ x: 3, backgroundColor: 'rgba(244,244,245,0.9)' }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleAddProductToMemo(product)}
                            className="w-full text-left rounded-xl p-2 flex items-center gap-3 transition-colors cursor-pointer"
                          >
                            <div className="w-11 h-10 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                              <WatchImage
                                src={product.image_url}
                                alt={product.model}
                                brand={product.brand}
                                model={product.model}
                                category={product.category}
                                iconSize={16}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#09090B] truncate">
                                {product.product_name || `${product.brand} ${product.model}`}
                              </p>
                              <p className="text-[10.5px] text-zinc-500 truncate">
                                {product.brand} · {product.model} · {product.category}
                              </p>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2">
                              <div>
                                <p className="font-mono-num text-xs font-bold text-[#09090B]">
                                  {formatBDT(product.min_selling_price)}
                                </p>
                                <p className="font-mono-num text-[10px] text-zinc-500">
                                  {product.stock_count} left
                                </p>
                              </div>
                              <span
                                className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                                  isFlashed
                                    ? 'bg-emerald-600 text-white'
                                    : alreadyAdded
                                    ? 'bg-zinc-200 text-zinc-900'
                                    : 'bg-[#09090B] text-white'
                                }`}
                              >
                                {isFlashed ? (
                                  <>
                                    <Check size={12} />
                                    <span>Added</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={12} />
                                    <span>{alreadyAdded ? '+1' : 'Add'}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Editable Line Items */}
          {items.length > 0 && (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.div
                    layout
                    key={item.watchId}
                    initial={{ opacity: 0, y: 12, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -28, scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                    className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {item.brand}
                      </p>
                      <p className="text-sm font-semibold text-[#09090B] truncate">
                        {item.model}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity === 0 ? '' : String(item.quantity)}
                        onChange={(e) => {
                          const cleaned = cleanQuantityInput(e.target.value);
                          updateLine(item.watchId, {
                            quantity: cleaned === '' ? 1 : Math.max(1, Number(cleaned)),
                          });
                        }}
                        aria-label="Quantity"
                        className="w-16 min-h-[40px] rounded-lg bg-white border border-zinc-300 px-2 text-center font-mono-num text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.unitPrice === 0 ? '' : String(item.unitPrice)}
                        onChange={(e) => {
                          const cleaned = cleanPriceInput(e.target.value);
                          updateLine(item.watchId, {
                            unitPrice: cleaned === '' ? 0 : Number(cleaned),
                          });
                        }}
                        placeholder="0"
                        aria-label="Agreed Price"
                        className="w-28 min-h-[40px] rounded-lg bg-white border border-zinc-300 px-2.5 text-right font-mono-num text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                      />
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => removeLine(item.watchId)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        aria-label="Remove item"
                      >
                        <Trash2 size={15} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as DigitalMemo['payment_method'])
                }
                className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3 text-sm text-[#09090B] focus:outline-none focus:border-zinc-950"
              >
                <option value="Cash">Cash</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Card">Card</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700">Extra Discount (৳)</label>
              <input
                type="text"
                inputMode="numeric"
                value={discountStr}
                onChange={(e) => setDiscountStr(cleanPriceInput(e.target.value))}
                placeholder="0"
                className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3 font-mono-num text-sm text-[#09090B] focus:outline-none focus:border-zinc-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700">Warranty / Memo Note</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] focus:outline-none focus:border-zinc-950"
            />
          </div>
        </motion.div>

        {/* Right: Printable Luxury Receipt Preview */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 290, damping: 26, delay: 0.04 }}
          className="lg:col-span-6 space-y-4"
        >
          <div className="print-only-sheet rounded-2xl bg-white text-[#09090B] p-6 sm:p-8 shadow-sm border border-zinc-300 space-y-6">
            <div className="flex items-start justify-between border-b border-zinc-200 pb-5">
              <div>
                <h3 className="font-display text-3xl font-bold tracking-tight text-[#09090B]">
                  New Chiko Watch
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Watches, Smart Gadgets &amp; Electronics Boutique
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Digital Memo
                </p>
                <p className="font-mono-num text-sm font-semibold text-[#09090B]">
                  {invoiceNumber}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {new Date().toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-zinc-500 uppercase tracking-wider text-[10px]">
                  Billed To
                </p>
                <p className="font-semibold text-sm text-[#09090B] mt-0.5">
                  {customerName || 'Walk-in Guest'}
                </p>
                {customerPhone && (
                  <p className="font-mono-num text-zinc-600">{customerPhone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-zinc-500 uppercase tracking-wider text-[10px]">
                  Payment Mode
                </p>
                <p className="font-semibold text-sm text-[#09090B] mt-0.5">
                  {paymentMethod}
                </p>
              </div>
            </div>

            <div className="border-t border-b border-zinc-200 py-3">
              {items.length === 0 ? (
                <p className="text-center py-6 text-xs text-zinc-400">
                  Search and select a product on the left to populate this receipt.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-200">
                      <th className="py-2 font-medium">Product</th>
                      <th className="py-2 font-medium text-center">Qty</th>
                      <th className="py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((item) => (
                      <tr key={item.watchId}>
                        <td className="py-2.5 pr-2">
                          <p className="font-semibold text-[#09090B]">
                            {item.brand} {item.model}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {item.color} · {formatBDT(item.unitPrice)} each
                          </p>
                        </td>
                        <td className="py-2.5 text-center font-mono-num">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 text-right font-mono-num font-semibold">
                          {formatBDT(item.unitPrice * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-zinc-600 text-xs">
                <span>Subtotal</span>
                <span className="font-mono-num">{formatBDT(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs">
                  <span>Special Discount</span>
                  <span className="font-mono-num">-{formatBDT(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200">
                <span className="font-semibold text-base">Total Payable</span>
                <motion.span
                  key={grandTotal}
                  initial={{ scale: 1.08, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="font-mono-num text-2xl font-bold text-[#09090B]"
                >
                  {formatBDT(grandTotal)}
                </motion.span>
              </div>
            </div>

            {notes && (
              <p className="text-[11px] text-zinc-600 bg-zinc-100 rounded-xl px-3.5 py-2.5">
                {notes}
              </p>
            )}

            <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Thank you for choosing New Chiko Watch &amp; Electronics</span>
              <span>Signature / Stamp</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 no-print">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              onClick={handleSaveMemo}
              disabled={items.length === 0 || saving}
              className="flex-1 min-h-[46px] rounded-xl bg-[#09090B] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-sm"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <ReceiptText size={17} />}
              <span>{saving ? 'Saving...' : 'Save Memo Record'}</span>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              onClick={handleCopySummary}
              disabled={items.length === 0}
              className="min-h-[46px] px-4 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              {copied ? <Check size={16} className="text-emerald-700" /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              onClick={() => window.print()}
              disabled={items.length === 0}
              className="min-h-[46px] px-4 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>Print</span>
            </motion.button>
          </div>

          {saveError && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-medium text-rose-600 no-print"
            >
              {saveError}
            </motion.p>
          )}

          {lastSavedInvoice && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-medium text-emerald-700 no-print"
            >
              Saved digital memo {lastSavedInvoice}.
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Saved Memos History with Delete + Confirmation & Smooth Exit Animation */}
      {savedMemos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.08 }}
          className="rounded-2xl bg-white border border-zinc-200 p-5 space-y-3 shadow-xs no-print"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#09090B]">Recent Digital Memos</h3>
            <span className="font-mono-num text-xs text-zinc-500">
              {savedMemos.length} saved
            </span>
          </div>

          {deleteMemoError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {deleteMemoError}
            </p>
          )}

          <div className="divide-y divide-zinc-100 overflow-hidden">
            <AnimatePresence initial={false}>
              {savedMemos.slice(0, 12).map((memo) => {
                const isConfirming = confirmDeleteMemoId === memo.id;
                const isDeleting = deletingMemoId === memo.id;

                return (
                  <motion.div
                    layout
                    key={memo.id}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      x: -44,
                      scale: 0.92,
                      height: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                      transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
                    }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs overflow-hidden"
                  >
                    <div className="min-w-0">
                      <p className="font-mono-num font-bold text-[#09090B]">
                        {memo.invoice_number}
                      </p>
                      <p className="text-zinc-600 mt-0.5 truncate">
                        {memo.customer_name} ·{' '}
                        {Array.isArray(memo.items) ? memo.items.length : 0} item(s) ·{' '}
                        {memo.payment_method}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <p className="font-mono-num text-sm font-bold text-[#09090B]">
                        {formatBDT(memo.total_amount)}
                      </p>

                      {isConfirming ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5"
                        >
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            disabled={isDeleting}
                            onClick={() => handleDeleteHistoryMemo(memo.id)}
                            className="min-h-[34px] px-2.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                          >
                            {isDeleting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            <span>{isDeleting ? 'Deleting...' : 'Confirm'}</span>
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteMemoId(null)}
                            className="min-h-[34px] px-2 rounded-lg border border-zinc-200 bg-white text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            Cancel
                          </motion.button>
                        </motion.div>
                      ) : (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.88 }}
                          onClick={() => setConfirmDeleteMemoId(memo.id)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-zinc-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                          aria-label={`Delete memo ${memo.invoice_number}`}
                          title="Delete memo"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
