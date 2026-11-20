import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Check,
  Cloud,
  CloudUpload,
  Download,
  FileSpreadsheet,
  FileUp,
  HardDrive,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  clearMotionProfileCache,
  prewarmProductMotionOnline,
} from '../services/cinemaMotionEngine';
import {
  CloudinaryStatusInfo,
  uploadDataUrlToCloudinary,
} from '../services/watchStore';
import { DigitalMemo, ProductCategory, WatchFormInput, WatchItem } from '../types/watch';
import { formatBDT } from './TripleTapPrice';

const VALID_CATEGORIES: ProductCategory[] = [
  'Analog Watches',
  'Digital Watches',
  'Smartwatches',
  'TWS Earbuds',
  'Power Banks',
  'Chargers & Cables',
  'Bluetooth Speakers',
  'Neckbands',
  'Gadgets & Accessories',
];

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deterministic crisp SVG barcode graphic derived from product SKU / model */
export function ProductBarcodeSvg({ code }: { code: string }) {
  const clean = (code || 'CHIKO001').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14) || 'CHIKO';
  const bars: Array<{ x: number; w: number }> = [];
  let x = 4;
  // Start guard
  bars.push({ x, w: 2 });
  x += 4;
  bars.push({ x, w: 1 });
  x += 3;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    for (let bit = 0; bit < 4; bit++) {
      const wide = ((ch >> bit) & 1) === 1;
      const w = wide ? 2.4 : 1.1;
      bars.push({ x, w });
      x += w + (((ch >> (bit + 1)) & 1) === 1 ? 2.0 : 1.1);
    }
  }
  // End guard
  bars.push({ x, w: 2 });
  x += 4;
  bars.push({ x, w: 1 });
  const totalWidth = Math.max(120, Math.ceil(x + 4));

  return (
    <svg
      viewBox={`0 0 ${totalWidth} 34`}
      className="w-full h-8 text-[#09090B]"
      role="img"
      aria-label={`Barcode ${clean}`}
    >
      {bars.map((b, idx) => (
        <rect key={idx} x={b.x} y={2} width={b.w} height={24} fill="currentColor" />
      ))}
      <text
        x={totalWidth / 2}
        y={33}
        textAnchor="middle"
        fontSize="6.5"
        fontFamily="JetBrains Mono, monospace"
        fill="currentColor"
        letterSpacing="1.2"
      >
        {clean}
      </text>
    </svg>
  );
}

/* ============================================================================
   1. BUSINESS ANALYTICS & SALES INTELLIGENCE WORKSPACE
   ============================================================================ */
interface AdminAnalyticsViewProps {
  watches: WatchItem[];
  savedMemos: DigitalMemo[];
  onAdjustStock: (id: string, delta: number) => Promise<void>;
}

export function AdminAnalyticsView({
  watches,
  savedMemos,
  onAdjustStock,
}: AdminAnalyticsViewProps) {
  const [restockingId, setRestockingId] = useState<string | null>(null);

  const categoryStats = useMemo(() => {
    const map = new Map<
      string,
      { category: string; models: number; units: number; cost: number; revenue: number; profit: number }
    >();
    for (const w of watches) {
      const key = w.category || 'Gadgets & Accessories';
      const cur = map.get(key) || {
        category: key,
        models: 0,
        units: 0,
        cost: 0,
        revenue: 0,
        profit: 0,
      };
      cur.models += 1;
      cur.units += w.stock_count;
      cur.cost += w.real_buying_price * w.stock_count;
      cur.revenue += w.min_selling_price * w.stock_count;
      cur.profit += (w.min_selling_price - w.real_buying_price) * w.stock_count;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [watches]);

  const maxCategoryRevenue = useMemo(
    () => Math.max(1, ...categoryStats.map((c) => c.revenue)),
    [categoryStats]
  );

  const salesStats = useMemo(() => {
    let totalRevenue = 0;
    let totalDiscount = 0;
    let realizedProfit = 0;
    let itemsSold = 0;
    const byPayment: Record<string, { count: number; total: number }> = {
      Cash: { count: 0, total: 0 },
      bKash: { count: 0, total: 0 },
      Nagad: { count: 0, total: 0 },
      Card: { count: 0, total: 0 },
    };

    for (const memo of savedMemos) {
      totalRevenue += Number(memo.total_amount) || 0;
      totalDiscount += Number(memo.discount_amount) || 0;
      const method = byPayment[memo.payment_method] ? memo.payment_method : 'Cash';
      byPayment[method].count += 1;
      byPayment[method].total += Number(memo.total_amount) || 0;

      let memoCost = 0;
      for (const item of memo.items || []) {
        const qty = Number(item.quantity) || 0;
        itemsSold += qty;
        memoCost += (Number(item.realCost) || 0) * qty;
      }
      realizedProfit += (Number(memo.total_amount) || 0) - memoCost;
    }

    const avgOrder = savedMemos.length > 0 ? Math.round(totalRevenue / savedMemos.length) : 0;

    return {
      invoicesCount: savedMemos.length,
      totalRevenue,
      totalDiscount,
      realizedProfit,
      itemsSold,
      avgOrder,
      byPayment,
    };
  }, [savedMemos]);

  const topProfitProducts = useMemo(() => {
    return [...watches]
      .map((w) => {
        const unitProfit = w.min_selling_price - w.real_buying_price;
        const marginPct =
          w.min_selling_price > 0
            ? Math.round((unitProfit / w.min_selling_price) * 1000) / 10
            : 0;
        return { watch: w, unitProfit, marginPct };
      })
      .sort((a, b) => b.unitProfit - a.unitProfit)
      .slice(0, 6);
  }, [watches]);

  const lowStockQueue = useMemo(() => {
    return watches
      .filter((w) => w.stock_count <= 2)
      .sort((a, b) => a.stock_count - b.stock_count);
  }, [watches]);

  const handleQuickRestock = async (id: string, qty: number) => {
    setRestockingId(id);
    try {
      await onAdjustStock(id, qty);
    } finally {
      setRestockingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sales & Digital Memo Realized Performance */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-base font-semibold text-[#09090B] flex items-center gap-2">
              <BarChart3 size={17} />
              <span>Sales Memo Revenue &amp; Payment Breakdown</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live figures computed directly from your saved Digital Memos
            </p>
          </div>
          <span className="text-xs font-mono-num text-zinc-500">
            {salesStats.invoicesCount} invoices · {salesStats.itemsSold} units billed
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">Total Billed Revenue</p>
            <p className="font-mono-num text-xl font-bold text-[#09090B] mt-1">
              {formatBDT(salesStats.totalRevenue)}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">Realized Net Profit</p>
            <p className="font-mono-num text-xl font-bold text-emerald-700 mt-1">
              {formatBDT(salesStats.realizedProfit)}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">Avg. Invoice Value</p>
            <p className="font-mono-num text-xl font-bold text-[#09090B] mt-1">
              {formatBDT(salesStats.avgOrder)}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">Total Discounts Given</p>
            <p className="font-mono-num text-xl font-bold text-amber-700 mt-1">
              {formatBDT(salesStats.totalDiscount)}
            </p>
          </div>
        </div>

        {/* Payment Method Animated Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {Object.entries(salesStats.byPayment).map(([method, info], idx) => {
            const pct =
              salesStats.totalRevenue > 0
                ? Math.round((info.total / salesStats.totalRevenue) * 100)
                : 0;
            return (
              <div key={method} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">{method}</span>
                  <span className="font-mono-num text-zinc-600">
                    {formatBDT(info.total)} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.65, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-[#09090B]"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 font-mono-num">
                  {info.count} {info.count === 1 ? 'invoice' : 'invoices'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-Column Deep Insights: Category Valuation + Profit Leaderboard & Restock Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Category Valuation Breakdown */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-semibold text-[#09090B]">
                Category Valuation &amp; Profit Potential
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Stock capital invested vs projected retail revenue per category
              </p>
            </div>
            <TrendingUp size={16} className="text-zinc-500" />
          </div>

          {categoryStats.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              Add products to see category analytics.
            </p>
          ) : (
            <div className="space-y-3.5">
              {categoryStats.map((cat, idx) => {
                const widthPct = Math.max(6, Math.round((cat.revenue / maxCategoryRevenue) * 100));
                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#09090B]">
                        {cat.category}{' '}
                        <span className="font-normal text-zinc-500 font-mono-num">
                          · {cat.models} models · {cat.units} pcs
                        </span>
                      </span>
                      <span className="font-mono-num text-zinc-700">
                        Rev {formatBDT(cat.revenue)}{' '}
                        <span className="text-emerald-700 font-semibold">
                          (+{formatBDT(cat.profit)})
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.65, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-zinc-900 to-zinc-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Top Margin Items + Urgent Restock Queue */}
        <div className="lg:col-span-5 space-y-5">
          {/* Top Profitable Products */}
          <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-[#09090B] pb-2 border-b border-zinc-100">
              Highest Unit Profit Products
            </h3>
            {topProfitProducts.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">No products yet.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {topProfitProducts.map(({ watch, unitProfit, marginPct }, i) => (
                  <div key={watch.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#09090B] truncate">
                        {i + 1}. {watch.product_name || `${watch.brand} ${watch.model}`}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono-num">
                        Cost {formatBDT(watch.real_buying_price)} · Offer {formatBDT(watch.min_selling_price)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono-num text-xs font-bold text-emerald-700">
                        +{formatBDT(unitProfit)}
                      </p>
                      <p className="font-mono-num text-[11px] text-zinc-500">{marginPct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Urgent Restock Alerts */}
          <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-[#09090B] flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-600" />
                <span>Restock Queue (≤ 2 units)</span>
              </h3>
              <span className="font-mono-num text-xs text-zinc-500">{lowStockQueue.length}</span>
            </div>
            {lowStockQueue.length === 0 ? (
              <p className="text-xs text-emerald-700 font-medium py-2">
                All products are well stocked right now.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {lowStockQueue.map((w) => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#09090B] truncate">
                        {w.product_name || `${w.brand} ${w.model}`}
                      </p>
                      <p
                        className={`text-[11px] font-mono-num font-medium ${
                          w.stock_count === 0 ? 'text-rose-600' : 'text-amber-700'
                        }`}
                      >
                        {w.stock_count === 0 ? 'Out of stock' : `Only ${w.stock_count} left`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={restockingId === w.id}
                      onClick={() => handleQuickRestock(w.id, 5)}
                      className="min-h-[34px] px-3 rounded-lg bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer transition-transform active:scale-95"
                    >
                      {restockingId === w.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      <span>+5</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   2. SHOP TOOLS: CALCULATOR, PRINTABLE PRICE TAGS, CSV IMPORT/EXPORT & BACKUP
   ============================================================================ */
interface AdminToolsViewProps {
  watches: WatchItem[];
  savedMemos: DigitalMemo[];
  onCreateWatch: (input: WatchFormInput) => Promise<void>;
  onAddToMemo?: (watch: WatchItem, agreedPrice?: number) => void;
}

export function AdminToolsView({
  watches,
  savedMemos,
  onCreateWatch,
  onAddToMemo,
}: AdminToolsViewProps) {
  // Standalone Counter Bargaining Calculator
  const [calcWatchId, setCalcWatchId] = useState<string>('');
  const [calcCostStr, setCalcCostStr] = useState<string>('1200');
  const [calcOfferStr, setCalcOfferStr] = useState<string>('1850');
  const [calcQtyStr, setCalcQtyStr] = useState<string>('1');

  // Price Tag Printer selection
  const [tagSelectedIds, setTagSelectedIds] = useState<string[]>(() =>
    watches.slice(0, 6).map((w) => w.id)
  );
  const tagsInitializedRef = useRef(watches.length > 0);
  useEffect(() => {
    if (!tagsInitializedRef.current && watches.length > 0) {
      tagsInitializedRef.current = true;
      setTagSelectedIds(watches.slice(0, 6).map((w) => w.id));
    }
  }, [watches]);

  // CSV Bulk Importer
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvStatus, setCsvStatus] = useState('');
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  const selectedCalcWatch = useMemo(
    () => watches.find((w) => w.id === calcWatchId) || null,
    [watches, calcWatchId]
  );

  const handleSelectCalcWatch = (id: string) => {
    setCalcWatchId(id);
    const found = watches.find((w) => w.id === id);
    if (found) {
      setCalcCostStr(String(found.real_buying_price));
      setCalcOfferStr(String(found.min_selling_price));
      setCalcQtyStr('1');
    }
  };

  const calcCost = Number(calcCostStr) || 0;
  const calcOffer = Number(calcOfferStr) || 0;
  const calcQty = Math.max(1, Number(calcQtyStr) || 1);
  const calcUnitProfit = calcOffer - calcCost;
  const calcTotalProfit = calcUnitProfit * calcQty;
  const calcMarginPct = calcOffer > 0 ? Math.round((calcUnitProfit / calcOffer) * 1000) / 10 : 0;
  const calcMarkupPct = calcCost > 0 ? Math.round((calcUnitProfit / calcCost) * 1000) / 10 : 0;

  // CSV Export: Inventory
  const handleExportInventoryCsv = () => {
    const headers = [
      'Product Name',
      'Brand',
      'Model',
      'Category',
      'Color',
      'Connectivity',
      'Capacity / Spec',
      'Tag Price (BDT)',
      'Real Cost (BDT)',
      'Offer Price (BDT)',
      'Unit Profit (BDT)',
      'Stock Qty',
      'Image Source',
      'Description',
    ];
    const rows = watches.map((w) => [
      w.product_name || `${w.brand} ${w.model}`,
      w.brand,
      w.model,
      w.category,
      w.color,
      w.connectivity,
      w.capacity_spec,
      w.display_buying_price,
      w.real_buying_price,
      w.min_selling_price,
      w.min_selling_price - w.real_buying_price,
      w.stock_count,
      w.image_url?.startsWith('http') ? w.image_url : w.image_url ? 'Embedded Base64' : 'None',
      w.description,
    ]);
    const csv =
      '\uFEFF' +
      [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerDownload(csv, `new-chiko-inventory-${dateStamp}.csv`, 'text/csv;charset=utf-8;');
  };

  // CSV Export: Sales Memos
  const handleExportMemosCsv = () => {
    const headers = [
      'Invoice Number',
      'Date',
      'Customer Name',
      'Customer Phone',
      'Payment Method',
      'Items Count',
      'Discount (BDT)',
      'Total Billed (BDT)',
      'Notes',
    ];
    const rows = savedMemos.map((m) => [
      m.invoice_number,
      new Date(m.created_at).toLocaleString(),
      m.customer_name,
      m.customer_phone,
      m.payment_method,
      (m.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
      m.discount_amount,
      m.total_amount,
      m.notes,
    ]);
    const csv =
      '\uFEFF' +
      [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerDownload(csv, `new-chiko-sales-memos-${dateStamp}.csv`, 'text/csv;charset=utf-8;');
  };

  // Full JSON Store Backup
  const handleExportBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      store: 'New Chiko Watch & Electronics',
      productCount: watches.length,
      memoCount: savedMemos.length,
      watches,
      savedMemos,
    };
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerDownload(
      JSON.stringify(payload, null, 2),
      `new-chiko-full-backup-${dateStamp}.json`,
      'application/json;charset=utf-8;'
    );
  };

  const handleDownloadCsvTemplate = () => {
    const sample =
      '\uFEFF' +
      [
        'product_name,brand,model,category,color,connectivity,capacity_spec,tag_price,real_cost,offer_price,stock_count,image_url,description',
        '"Casio Edifice Sapphire Steel","Casio","EFR-S108D","Analog Watches","Black Dial / Silver Steel","Japanese Quartz","40mm · 10ATM",14500,9800,12800,3,"","Ultra-slim sapphire crystal steel watch."',
        '"Oraimo FreePods 4 ANC","Oraimo","OTW-330","TWS Earbuds","Matte Black","Bluetooth 5.2 · USB-C","35h Playtime · ANC",2900,1750,2350,6,"","Active noise cancellation wireless earbuds."',
      ].join('\r\n');
    triggerDownload(sample, 'new-chiko-import-template.csv', 'text/csv;charset=utf-8;');
  };

  const parsedCsvRows = useMemo<WatchFormInput[]>(() => {
    const raw = csvText.trim();
    if (!raw) return [];
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const parseLine = (line: string): string[] => {
      const cells: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          cells.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      cells.push(cur.trim());
      return cells;
    };

    const firstRow = parseLine(lines[0]).map((c) => c.toLowerCase());
    const hasHeader =
      firstRow.includes('brand') ||
      firstRow.includes('model') ||
      firstRow.includes('product_name');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const results: WatchFormInput[] = [];
    for (const line of dataLines.slice(0, 100)) {
      const cols = parseLine(line);
      if (cols.length < 3) continue;
      const [
        productName,
        brand,
        model,
        rawCategory,
        color,
        connectivity,
        capacitySpec,
        tagPrice,
        realCost,
        offerPrice,
        stockCount,
        imageUrl,
        description,
      ] = cols;
      const cat =
        VALID_CATEGORIES.find((c) => c.toLowerCase() === (rawCategory || '').toLowerCase()) ||
        'Gadgets & Accessories';
      results.push({
        product_name: productName || `${brand || 'New Chiko'} ${model || 'Model'}`.trim(),
        brand: brand || 'New Chiko',
        model: model || productName || 'Model',
        category: cat,
        color: color || 'Black',
        connectivity: connectivity || 'Standard',
        capacity_spec: capacitySpec || 'Standard',
        display_buying_price: Number(tagPrice) || 0,
        real_buying_price: Number(realCost) || 0,
        min_selling_price: Number(offerPrice) || 0,
        stock_count: Math.max(0, Number(stockCount) || 1),
        image_url: imageUrl || '',
        description: description || '',
      });
    }
    return results;
  }, [csvText]);

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ''));
      setCsvStatus('');
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (parsedCsvRows.length === 0 || csvImporting) return;
    setCsvImporting(true);
    setCsvStatus('');
    let imported = 0;
    try {
      for (const item of parsedCsvRows) {
        await onCreateWatch(item);
        imported += 1;
      }
      setCsvStatus(`Successfully imported ${imported} product(s) into live inventory.`);
      setCsvText('');
    } catch (err) {
      setCsvStatus(
        `Imported ${imported} of ${parsedCsvRows.length}. Stopped on error: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    } finally {
      setCsvImporting(false);
    }
  };

  const toggleTagSelection = (id: string) => {
    setTagSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedTagWatches = useMemo(
    () => watches.filter((w) => tagSelectedIds.includes(w.id)),
    [watches, tagSelectedIds]
  );

  return (
    <div className="space-y-6">
      {/* Row 1: Counter Bargaining Calculator + Export & Backup Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 no-print">
        {/* Counter Profit & Bargaining Calculator */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-semibold text-[#09090B] flex items-center gap-2">
                <Calculator size={16} />
                <span>Counter Bargaining &amp; Margin Calculator</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Check exact profit before agreeing to a customer offer at the shop counter
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700">
                Load From Inventory (Optional)
              </label>
              <select
                value={calcWatchId}
                onChange={(e) => handleSelectCalcWatch(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3 text-xs sm:text-sm text-[#09090B] focus:outline-none focus:border-zinc-950"
              >
                <option value="">Custom Manual Entry</option>
                {watches.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.product_name || `${w.brand} ${w.model}`} — Cost {formatBDT(w.real_buying_price)} · Offer {formatBDT(w.min_selling_price)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-800">Real Cost (৳)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={calcCostStr}
                  onChange={(e) => setCalcCostStr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full min-h-[42px] rounded-xl bg-amber-50/40 border border-amber-300 px-3 font-mono-num text-sm text-[#09090B] focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-emerald-800">Customer Offer (৳)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={calcOfferStr}
                  onChange={(e) => setCalcOfferStr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full min-h-[42px] rounded-xl bg-emerald-50/40 border border-emerald-300 px-3 font-mono-num text-sm text-[#09090B] focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">Quantity</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={calcQtyStr}
                  onChange={(e) => setCalcQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full min-h-[42px] rounded-xl bg-zinc-50 border border-zinc-300 px-3 font-mono-num text-sm text-[#09090B] focus:outline-none focus:border-zinc-950"
                />
              </div>
            </div>

            {/* Quick Markup Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-zinc-500 mr-1">Target markup:</span>
              {[15, 25, 40, 60, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    setCalcOfferStr(String(Math.round((calcCost * (1 + pct / 100)) / 10) * 10))
                  }
                  className="min-h-[30px] px-2.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 font-mono-num text-zinc-800 font-medium cursor-pointer transition-colors"
                >
                  +{pct}%
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center">
                <p className="text-[11px] text-zinc-500">Total Net Profit</p>
                <p
                  className={`font-mono-num text-base font-bold mt-0.5 ${
                    calcTotalProfit > 0
                      ? 'text-emerald-700'
                      : calcTotalProfit === 0
                      ? 'text-amber-700'
                      : 'text-rose-600'
                  }`}
                >
                  {calcTotalProfit >= 0 ? '+' : ''}
                  {formatBDT(calcTotalProfit)}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center">
                <p className="text-[11px] text-zinc-500">Gross Margin</p>
                <p className="font-mono-num text-base font-bold text-[#09090B] mt-0.5">
                  {calcMarginPct}%
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center">
                <p className="text-[11px] text-zinc-500">Cost Markup</p>
                <p className="font-mono-num text-base font-bold text-[#09090B] mt-0.5">
                  {calcMarkupPct}%
                </p>
              </div>
            </div>

            {selectedCalcWatch && onAddToMemo && (
              <button
                type="button"
                onClick={() => onAddToMemo(selectedCalcWatch, calcOffer)}
                className="w-full min-h-[42px] rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <ReceiptText size={15} />
                <span>Create Digital Memo at {formatBDT(calcOffer)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Accounting Export & Full Store Backup */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="pb-2.5 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-[#09090B] flex items-center gap-2">
                <FileSpreadsheet size={16} />
                <span>Excel / CSV Export &amp; Full Backup</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Download accounting spreadsheets or full JSON backups anytime
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleExportInventoryCsv}
                className="w-full min-h-[44px] px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-[#09090B] flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Download size={15} />
                  Export Full Inventory (Excel CSV)
                </span>
                <span className="font-mono-num text-zinc-500">{watches.length} rows</span>
              </button>

              <button
                type="button"
                onClick={handleExportMemosCsv}
                className="w-full min-h-[44px] px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-[#09090B] flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Download size={15} />
                  Export Sales Memos Ledger (CSV)
                </span>
                <span className="font-mono-num text-zinc-500">{savedMemos.length} memos</span>
              </button>

              <button
                type="button"
                onClick={handleExportBackupJson}
                className="w-full min-h-[44px] px-4 rounded-xl bg-[#09090B] hover:bg-zinc-800 text-xs font-semibold text-white flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HardDrive size={15} />
                  Download Complete Store Backup (JSON)
                </span>
                <span className="font-mono-num text-zinc-300">All data</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed pt-2 border-t border-zinc-100">
            CSV files include UTF-8 encoding so Bangla product titles and ৳ prices open cleanly in Microsoft Excel and Google Sheets.
          </p>
        </div>
      </div>

      {/* Row 2: Bulk CSV Product Importer */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-semibold text-[#09090B] flex items-center gap-2">
              <FileUp size={16} />
              <span>Bulk CSV Product Importer</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Add 10–100 products in seconds from Excel or Google Sheets CSV
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="min-h-[38px] px-3 rounded-xl border border-zinc-300 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-50 cursor-pointer"
            >
              Download Template
            </button>
            <button
              type="button"
              onClick={() => csvFileRef.current?.click()}
              className="min-h-[38px] px-3 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
            >
              Load CSV File
            </button>
          </div>
        </div>

        <textarea
          rows={4}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Paste CSV rows here (product_name,brand,model,category,color,connectivity,capacity_spec,tag_price,real_cost,offer_price,stock_count,image_url,description)..."
          className="w-full rounded-xl bg-zinc-50 border border-zinc-300 p-3 font-mono text-xs text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
        />

        {parsedCsvRows.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
            <p className="text-xs font-medium text-[#09090B]">
              Ready to import{' '}
              <span className="font-mono-num font-bold">{parsedCsvRows.length}</span> product(s)
              (e.g. {parsedCsvRows[0].brand} {parsedCsvRows[0].model})
            </p>
            <button
              type="button"
              disabled={csvImporting}
              onClick={handleBulkImport}
              className="min-h-[40px] px-4 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {csvImporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Import All to Live Store</span>
                </>
              )}
            </button>
          </div>
        )}

        {csvStatus && (
          <p className="text-xs font-medium text-emerald-700">{csvStatus}</p>
        )}
      </div>

      {/* Row 3: Printable Boutique Shop Price Tag & Barcode Generator */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 no-print">
          <div>
            <h3 className="text-sm font-semibold text-[#09090B] flex items-center gap-2">
              <Printer size={16} />
              <span>Printable Shop Price Tags &amp; Barcodes</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select products below and print ready-to-cut showroom price tags
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTagSelectedIds(
                  tagSelectedIds.length === watches.length ? [] : watches.map((w) => w.id)
                )
              }
              className="min-h-[38px] px-3 rounded-xl border border-zinc-300 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-50 cursor-pointer"
            >
              {tagSelectedIds.length === watches.length ? 'Clear All' : 'Select All'}
            </button>
            <button
              type="button"
              disabled={selectedTagWatches.length === 0}
              onClick={() => window.print()}
              className="min-h-[38px] px-4 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>Print {selectedTagWatches.length} Tag(s)</span>
            </button>
          </div>
        </div>

        {/* Selector list (hidden during print) */}
        <div className="flex flex-wrap gap-2 no-print">
          {watches.map((w) => {
            const active = tagSelectedIds.includes(w.id);
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleTagSelection(w.id)}
                className={`min-h-[34px] px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#09090B] border-[#09090B] text-white'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400'
                }`}
              >
                {w.brand} · {w.model}
              </button>
            );
          })}
        </div>

        {/* Printable Grid */}
        {selectedTagWatches.length > 0 && (
          <div className="print-only-sheet grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {selectedTagWatches.map((w) => {
              const sku = `${w.brand.slice(0, 3)}-${w.model.replace(/\s+/g, '')}`.toUpperCase();
              return (
                <div
                  key={w.id}
                  className="rounded-xl border border-dashed border-zinc-400 bg-white p-3.5 space-y-2 break-inside-avoid"
                >
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                    <span>New Chiko Watch</span>
                    <span>{w.category}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#09090B] line-clamp-1">
                      {w.product_name || `${w.brand} ${w.model}`}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {w.brand} · {w.model} · {w.color}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between border-y border-zinc-200 py-1.5">
                    <span className="text-xs text-zinc-400 line-through font-mono-num">
                      Tag {formatBDT(w.display_buying_price)}
                    </span>
                    <span className="text-base font-bold text-[#09090B] font-mono-num">
                      {formatBDT(w.min_selling_price)}
                    </span>
                  </div>
                  <ProductBarcodeSvg code={sku} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   3. CLOUDINARY 25GB MEDIA & SHOWCASE OPTIMIZER WORKSPACE
   ============================================================================ */
interface AdminMediaCenterViewProps {
  watches: WatchItem[];
  adminToken: string;
  cloudinaryStatus: CloudinaryStatusInfo | null;
  onRefreshCloudinary: () => Promise<void>;
  onUpdateWatch: (id: string, patch: Partial<WatchFormInput>) => Promise<void>;
}

export function AdminMediaCenterView({
  watches,
  adminToken,
  cloudinaryStatus,
  onRefreshCloudinary,
  onUpdateWatch,
}: AdminMediaCenterViewProps) {
  const [migrating, setMigrating] = useState(false);
  const [migrateProgress, setMigrateProgress] = useState({ done: 0, total: 0, savedKb: 0 });
  const [migrateNotice, setMigrateNotice] = useState('');
  const [migrateError, setMigrateError] = useState('');

  const [prewarming, setPrewarming] = useState(false);
  const [prewarmProgress, setPrewarmProgress] = useState({ done: 0, total: 0 });

  const mediaStats = useMemo(() => {
    let cloudinaryCount = 0;
    let externalUrlCount = 0;
    let base64Count = 0;
    let missingCount = 0;
    let base64Bytes = 0;

    for (const w of watches) {
      const url = w.image_url || '';
      if (!url) {
        missingCount += 1;
      } else if (url.startsWith('data:image/')) {
        base64Count += 1;
        base64Bytes += url.length;
      } else if (url.includes('res.cloudinary.com')) {
        cloudinaryCount += 1;
      } else {
        externalUrlCount += 1;
      }
    }

    const base64Kb = Math.round(base64Bytes / 1024);
    const supabaseLimitMb = 500;
    const avgKbPerBase64 = base64Count > 0 ? Math.max(80, Math.round(base64Kb / base64Count)) : 180;
    const estMaxWithoutCloud = Math.round((supabaseLimitMb * 1024) / avgKbPerBase64);

    return {
      cloudinaryCount,
      externalUrlCount,
      base64Count,
      missingCount,
      base64Kb,
      base64Mb: (base64Kb / 1024).toFixed(2),
      estMaxWithoutCloud,
    };
  }, [watches]);

  const handleMigrateAllToCloudinary = async () => {
    const targets = watches.filter((w) => w.image_url?.startsWith('data:image/'));
    if (targets.length === 0 || migrating) return;
    setMigrating(true);
    setMigrateNotice('');
    setMigrateError('');
    setMigrateProgress({ done: 0, total: targets.length, savedKb: 0 });

    let done = 0;
    let savedBytes = 0;
    for (const w of targets) {
      const img = w.image_url;
      if (!img) continue;
      const res = await uploadDataUrlToCloudinary(img, adminToken);
      if (!res.ok) {
        setMigrateError(res.error);
        break;
      }
      const oldBytes = img.length;
      await onUpdateWatch(w.id, { image_url: res.imageUrl });
      done += 1;
      savedBytes += Math.max(0, oldBytes - res.imageUrl.length);
      setMigrateProgress({
        done,
        total: targets.length,
        savedKb: Math.round(savedBytes / 1024),
      });
    }

    if (done > 0) {
      setMigrateNotice(
        `Migrated ${done} product photo(s) to Cloudinary CDN and freed ~${Math.round(
          savedBytes / 1024
        )} KB from your Supabase database!`
      );
    }
    setMigrating(false);
  };

  const handlePrewarmAllAnimations = async () => {
    if (watches.length === 0 || prewarming) return;
    setPrewarming(true);
    setMigrateNotice('');
    setPrewarmProgress({ done: 0, total: watches.length });
    clearMotionProfileCache();
    let done = 0;
    let visionCount = 0;
    for (const w of watches) {
      try {
        const res = await prewarmProductMotionOnline(w, true);
        if (res?.source === 'gemini-vision') {
          visionCount += 1;
        }
      } catch {
        // continue
      }
      done += 1;
      setPrewarmProgress({ done, total: watches.length });
    }
    setPrewarming(false);
    setMigrateNotice(
      `AI Vision freshly analyzed ${done} product(s) (${visionCount} via Gemini Vision) and updated their automatic animations!`
    );
  };

  const isConnected = Boolean(cloudinaryStatus?.configured);

  return (
    <div className="space-y-6">
      {/* Cloudinary Connection & Capacity Card */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-base font-semibold text-[#09090B] flex items-center gap-2">
              <Cloud size={18} />
              <span>Cloudinary 25GB Unlimited Media CDN</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Store 50,000+ high-definition product photos on Cloudinary while keeping your Supabase 500MB database near 0% full
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshCloudinary}
            className="min-h-[38px] px-3.5 rounded-xl border border-zinc-300 bg-white text-xs font-semibold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Check Status</span>
          </button>
        </div>

        {/* Status Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">Cloudinary Status</p>
            <p
              className={`text-sm font-bold mt-1 ${
                isConnected ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {isConnected
                ? cloudinaryStatus?.mode === 'signed'
                  ? 'Connected (Signed API)'
                  : 'Connected (Preset)'
                : 'Ready to Activate'}
            </p>
            <p className="text-[11px] text-zinc-500 font-mono-num mt-0.5">
              Cloud: {cloudinaryStatus?.cloudName || 'zxamensn'}
            </p>
          </div>

          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">On Cloudinary CDN</p>
            <p className="font-mono-num text-xl font-bold text-emerald-700 mt-1">
              {mediaStats.cloudinaryCount}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">~0.1 KB per product in DB</p>
          </div>

          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">Still in Supabase DB</p>
            <p className="font-mono-num text-xl font-bold text-[#09090B] mt-1">
              {mediaStats.base64Count}
            </p>
            <p className="text-[11px] text-zinc-500 font-mono-num mt-0.5">
              Using {mediaStats.base64Kb} KB ({mediaStats.base64Mb} MB)
            </p>
          </div>

          <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5">
            <p className="text-xs text-zinc-500">
              {cloudinaryStatus?.usage ? `Cloudinary (${cloudinaryStatus.usage.plan})` : 'Product Photo Capacity'}
            </p>
            <p className="font-mono-num text-xl font-bold text-[#09090B] mt-1">
              {cloudinaryStatus?.usage
                ? `${cloudinaryStatus.usage.storageMB} MB / ${cloudinaryStatus.usage.maxStorageGB} GB`
                : isConnected
                ? '50,000+'
                : `~${mediaStats.estMaxWithoutCloud}`}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono-num">
              {cloudinaryStatus?.usage
                ? `${cloudinaryStatus.usage.creditsUsed}/${cloudinaryStatus.usage.creditsLimit} credits · ${cloudinaryStatus.usage.resources} files`
                : isConnected
                ? '25GB Cloudinary Free Tier'
                : 'With 500MB DB only'}
            </p>
          </div>
        </div>

        {/* Setup Guide when Secrets not yet added or in Unsigned Preset Mode */}
        {(!isConnected || cloudinaryStatus?.mode === 'unsigned') && (
          <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 space-y-2.5 text-xs text-amber-950">
            <p className="font-semibold">
              {!isConnected
                ? 'How to activate your 25GB Cloudinary storage (takes 1 minute):'
                : 'Recommended: Upgrade to Signed API (or make your Upload Preset "Unsigned")'}
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
              <li>
                Open your <strong>Cloudinary Dashboard</strong> → click{' '}
                <strong>API Keys</strong> → copy your{' '}
                <code className="font-mono font-semibold bg-white/80 px-1.5 py-0.5 rounded">
                  CLOUDINARY_URL
                </code>{' '}
                (looks like <code className="font-mono">cloudinary://API_KEY:API_SECRET@CLOUD_NAME</code>).
              </li>
              <li>
                Open <strong>Settings → Secrets</strong> and add{' '}
                <code className="font-mono font-semibold bg-white/80 px-1.5 py-0.5 rounded">
                  CLOUDINARY_URL
                </code>{' '}
                (or add <code className="font-mono font-semibold">CLOUDINARY_CLOUD_NAME</code>,{' '}
                <code className="font-mono font-semibold">CLOUDINARY_API_KEY</code>, and{' '}
                <code className="font-mono font-semibold">CLOUDINARY_API_SECRET</code> separately).
              </li>
              <li>
                <em>Alternative (Unsigned Preset):</em> In Cloudinary Dashboard → <strong>Settings → Upload → Upload Presets</strong>, edit your preset and set <strong>Signing Mode</strong> to <strong>Unsigned</strong>.
              </li>
            </ol>
          </div>
        )}

        {/* 1-Click Migrate Existing DB Base64 Photos to Cloudinary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <div>
            <p className="text-xs font-semibold text-[#09090B]">
              1-Click Migrate Existing Photos to Cloudinary CDN
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {mediaStats.base64Count > 0
                ? `${mediaStats.base64Count} existing product photo(s) can be moved out of Supabase DB to Cloudinary right now.`
                : 'All product photos are already lightweight URLs — zero Base64 bloat in Supabase!'}
            </p>
          </div>
          <button
            type="button"
            disabled={migrating || mediaStats.base64Count === 0}
            onClick={handleMigrateAllToCloudinary}
            className="min-h-[42px] px-4 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-45 flex items-center gap-2 shrink-0 cursor-pointer transition-all active:scale-[0.98]"
          >
            {migrating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>
                  Migrating {migrateProgress.done}/{migrateProgress.total}...
                </span>
              </>
            ) : (
              <>
                <CloudUpload size={15} />
                <span>Migrate {mediaStats.base64Count} Photo(s) to Cloudinary</span>
              </>
            )}
          </button>
        </div>

        {migrateNotice && (
          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
            <Check size={14} />
            <span>{migrateNotice}</span>
          </p>
        )}
        {migrateError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800 leading-relaxed">
            {migrateError}
          </div>
        )}
      </div>

      {/* Product Interactive Showcase Animation Pre-Warmer */}
      <div className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[#09090B] flex items-center gap-2">
            <Sparkles size={16} />
            <span>Auto-Sync Interactive Product Animations</span>
          </h3>
          <p className="text-xs text-zinc-500">
            Search online and refresh custom realistic animation profiles (vapor, audio waves, fast-charging, liquid splash, horology) for all {watches.length} products in your store.
          </p>
        </div>
        <button
          type="button"
          disabled={prewarming || watches.length === 0}
          onClick={handlePrewarmAllAnimations}
          className="min-h-[42px] px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-[#09090B] flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
        >
          {prewarming ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>
                Syncing {prewarmProgress.done}/{prewarmProgress.total}...
              </span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>Re-Analyze All with AI</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
