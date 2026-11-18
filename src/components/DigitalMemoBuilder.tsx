import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus, Printer, ReceiptText, Trash2 } from 'lucide-react';
import { DigitalMemo, MemoLineItem, WatchItem } from '../types/watch';
import { formatBDT } from './TripleTapPrice';

interface DigitalMemoBuilderProps {
  watches: WatchItem[];
  initialItems: MemoLineItem[];
  savedMemos: DigitalMemo[];
  onSaveMemo: (memo: DigitalMemo) => Promise<void>;
  onClearDraftItems: () => void;
}

function cleanPriceInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '').replace(/^0+/, '');
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
  onClearDraftItems,
}: DigitalMemoBuilderProps) {
  const [items, setItems] = useState<MemoLineItem[]>(initialItems);
  const [selectedWatchId, setSelectedWatchId] = useState<string>(watches[0]?.id || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DigitalMemo['payment_method']>('Cash');
  const [discountStr, setDiscountStr] = useState<string>('');
  const [notes, setNotes] = useState('Official replacement & service warranty included.');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState('');

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
    if (!selectedWatchId && watches.length > 0) {
      setSelectedWatchId(watches[0].id);
    }
  }, [watches, selectedWatchId]);

  const invoiceNumber = useMemo(() => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return `NCE-${ymd}-${String(savedMemos.length + 101)}`;
  }, [savedMemos.length]);

  const discount = Number(discountStr) || 0;
  const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const handleAddWatchLine = () => {
    const product = watches.find((w) => w.id === selectedWatchId);
    if (!product) return;
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Builder Controls */}
        <div className="lg:col-span-6 rounded-3xl bg-[#121216]/90 border border-white/[0.08] p-5 space-y-5 no-print">
          <div>
            <p className="text-xs text-[#D4AF37] font-medium tracking-wider uppercase">
              Quick Digital Memo
            </p>
            <h2 className="font-display text-2xl font-semibold text-[#F8F9FA]">
              Branded Receipt Generator
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-[#D1D5DB]">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Tanvir Ahmed"
                className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#D1D5DB]">Phone Number</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] font-mono-num focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* Add Product Line */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#D1D5DB]">Add Electronics Product to Bill</label>
            <div className="flex gap-2">
              <select
                value={selectedWatchId}
                onChange={(e) => setSelectedWatchId(e.target.value)}
                disabled={watches.length === 0}
                className="flex-1 min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3 text-sm text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
              >
                {watches.length === 0 ? (
                  <option value="">No products added yet</option>
                ) : (
                  watches.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.brand} {w.model} ({formatBDT(w.min_selling_price)})
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={handleAddWatchLine}
                disabled={watches.length === 0}
                className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0A0A0C] font-semibold text-sm flex items-center gap-1.5 hover:bg-[#E5C158] disabled:opacity-40 shrink-0 cursor-pointer"
              >
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Editable Line Items */}
          {items.length > 0 && (
            <div className="space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.watchId}
                  className="rounded-2xl bg-[#0A0A0C] border border-white/[0.08] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-[#D4AF37]">{item.brand}</p>
                    <p className="text-sm font-medium text-[#F8F9FA] truncate">
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
                      className="w-16 min-h-[40px] rounded-lg bg-[#141418] border border-white/[0.1] px-2 text-center font-mono-num text-xs text-[#F8F9FA]"
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
                      className="w-28 min-h-[40px] rounded-lg bg-[#141418] border border-white/[0.1] px-2.5 text-right font-mono-num text-xs text-[#F8F9FA]"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(item.watchId)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-500/10"
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-[#D1D5DB]">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as DigitalMemo['payment_method'])
                }
                className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3 text-sm text-[#F8F9FA]"
              >
                <option value="Cash">Cash</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Card">Card</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#D1D5DB]">Extra Discount (৳)</label>
              <input
                type="text"
                inputMode="numeric"
                value={discountStr}
                onChange={(e) => setDiscountStr(cleanPriceInput(e.target.value))}
                placeholder="0"
                className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3 font-mono-num text-sm text-[#F8F9FA]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#D1D5DB]">Warranty / Memo Note</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA]"
            />
          </div>
        </div>

        {/* Right: Printable Luxury Receipt Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="print-only-sheet rounded-3xl bg-[#F8F9FA] text-[#0A0A0C] p-6 sm:p-8 shadow-2xl border border-[#D4AF37]/40 space-y-6">
            <div className="flex items-start justify-between border-b border-zinc-200 pb-5">
              <div>
                <h3 className="font-display text-3xl font-bold tracking-tight text-[#0A0A0C]">
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
                <p className="font-mono-num text-sm font-semibold text-[#0A0A0C]">
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
                <p className="font-semibold text-sm text-[#0A0A0C] mt-0.5">
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
                <p className="font-semibold text-sm text-[#0A0A0C] mt-0.5">
                  {paymentMethod}
                </p>
              </div>
            </div>

            <div className="border-t border-b border-zinc-200 py-3">
              {items.length === 0 ? (
                <p className="text-center py-6 text-xs text-zinc-400">
                  Select a product on the left to populate this receipt.
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
                          <p className="font-semibold text-[#0A0A0C]">
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
                <span className="font-mono-num text-2xl font-bold text-[#0A0A0C]">
                  {formatBDT(grandTotal)}
                </span>
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
            <button
              type="button"
              onClick={handleSaveMemo}
              disabled={items.length === 0 || saving}
              className="flex-1 min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0A0A0C] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E5C158] disabled:opacity-40 cursor-pointer"
            >
              <ReceiptText size={17} />
              <span>{saving ? 'Saving...' : 'Save Memo Record'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              disabled={items.length === 0}
              className="min-h-[48px] px-4 rounded-xl border border-white/[0.14] text-sm font-medium text-[#F8F9FA] hover:bg-white/[0.06] disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={items.length === 0}
              className="min-h-[48px] px-4 rounded-xl border border-white/[0.14] text-sm font-medium text-[#F8F9FA] hover:bg-white/[0.06] disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>
          </div>

          {lastSavedInvoice && (
            <p className="text-xs text-emerald-400 no-print">
              Saved digital memo {lastSavedInvoice}.
            </p>
          )}
        </div>
      </div>

      {/* Saved Memos History */}
      {savedMemos.length > 0 && (
        <div className="rounded-3xl bg-[#121216]/85 border border-white/[0.08] p-5 space-y-3 no-print">
          <h3 className="text-sm font-semibold text-[#F8F9FA]">Recent Digital Memos</h3>
          <div className="divide-y divide-white/[0.06]">
            {savedMemos.slice(0, 6).map((memo) => (
              <div
                key={memo.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-mono-num font-semibold text-[#D4AF37]">
                    {memo.invoice_number}
                  </p>
                  <p className="text-[#D1D5DB] mt-0.5">
                    {memo.customer_name} · {memo.items.length} item(s) · {memo.payment_method}
                  </p>
                </div>
                <p className="font-mono-num text-sm font-semibold text-[#F8F9FA]">
                  {formatBDT(memo.total_amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
