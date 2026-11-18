import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  LogOut,
  Minus,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { isCloudinaryPresetConfigured, isSupabaseConfigured } from '../config/keys';
import { uploadWatchPhoto } from '../services/watchStore';
import { ProductCategory, WatchFormInput, WatchItem } from '../types/watch';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface AdminDashboardProps {
  watches: WatchItem[];
  adminUsername: string;
  storageSource: 'supabase' | 'server' | 'local';
  cloudNotice?: string;
  cloudError?: string;
  initialEditWatch?: WatchItem | null;
  onClearInitialEdit?: () => void;
  onLogout: () => void;
  onCreateWatch: (input: WatchFormInput) => Promise<void>;
  onUpdateWatch: (id: string, patch: Partial<WatchFormInput>) => Promise<void>;
  onDeleteWatch: (id: string) => Promise<void>;
  onAdjustStock: (id: string, delta: number) => Promise<void>;
}

const CATEGORY_OPTIONS: ProductCategory[] = [
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

const EMPTY_FORM: WatchFormInput = {
  product_name: '',
  brand: '',
  model: '',
  color: '',
  category: 'Analog Watches',
  connectivity: '',
  capacity_spec: '',
  display_buying_price: 0,
  real_buying_price: 0,
  min_selling_price: 0,
  stock_count: 1,
  image_url: '',
  description: '',
};

interface NumericDrafts {
  display_buying_price: string;
  real_buying_price: string;
  min_selling_price: string;
  stock_count: string;
}

function sanitizePriceInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '').replace(/^0+/, '');
}

function sanitizeStockInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

function normalizeAiCategory(rawCategory: unknown): ProductCategory {
  if (typeof rawCategory === 'string') {
    const exact = CATEGORY_OPTIONS.find(
      (opt) => opt.toLowerCase() === rawCategory.trim().toLowerCase()
    );
    if (exact) return exact;

    const lower = rawCategory.toLowerCase();
    if (lower.includes('smartwatch') || lower.includes('smart watch')) return 'Smartwatches';
    if (lower.includes('digital')) return 'Digital Watches';
    if (lower.includes('watch') || lower.includes('analog') || lower.includes('chronograph')) {
      return 'Analog Watches';
    }
    if (lower.includes('earbud') || lower.includes('tws') || lower.includes('airpod')) {
      return 'TWS Earbuds';
    }
    if (lower.includes('power bank') || lower.includes('powerbank')) return 'Power Banks';
    if (lower.includes('charger') || lower.includes('cable') || lower.includes('adapter')) {
      return 'Chargers & Cables';
    }
    if (lower.includes('speaker')) return 'Bluetooth Speakers';
    if (lower.includes('neckband')) return 'Neckbands';
  }
  return 'Gadgets & Accessories';
}

export function AdminDashboard({
  watches,
  adminUsername,
  storageSource,
  cloudNotice,
  cloudError,
  initialEditWatch,
  onClearInitialEdit,
  onLogout,
  onCreateWatch,
  onUpdateWatch,
  onDeleteWatch,
  onAdjustStock,
}: AdminDashboardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WatchFormInput>(EMPTY_FORM);
  const [numericDrafts, setNumericDrafts] = useState<NumericDrafts>({
    display_buying_price: '',
    real_buying_price: '',
    min_selling_price: '',
    stock_count: '1',
  });
  const [uploadedBase64, setUploadedBase64] = useState<{ base64: string; mimeType: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProviderLabel, setPhotoProviderLabel] = useState('');
  const [aiFilling, setAiFilling] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState('');
  const [aiError, setAiError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const openEditModal = (product: WatchItem) => {
    setEditingId(product.id);
    setForm({
      product_name: product.product_name || '',
      brand: product.brand,
      model: product.model,
      color: product.color,
      category: product.category,
      connectivity: product.connectivity,
      capacity_spec: product.capacity_spec,
      display_buying_price: product.display_buying_price,
      real_buying_price: product.real_buying_price,
      min_selling_price: product.min_selling_price,
      stock_count: product.stock_count,
      image_url: product.image_url || '',
      description: product.description,
    });
    setNumericDrafts({
      display_buying_price:
        product.display_buying_price > 0 ? String(product.display_buying_price) : '',
      real_buying_price:
        product.real_buying_price > 0 ? String(product.real_buying_price) : '',
      min_selling_price:
        product.min_selling_price > 0 ? String(product.min_selling_price) : '',
      stock_count: String(product.stock_count),
    });
    setUploadedBase64(null);
    setPhotoProviderLabel('');
    setAiSuccessMsg('');
    setAiError('');
    setSaveError('');
    setFormOpen(true);
  };

  useEffect(() => {
    if (initialEditWatch) {
      openEditModal(initialEditWatch);
      onClearInitialEdit?.();
    }
  }, [initialEditWatch, onClearInitialEdit]);

  const analytics = useMemo(() => {
    let totalUnits = 0;
    let totalWholesaleCost = 0;
    let potentialRevenue = 0;
    let lowStockCount = 0;

    for (const w of watches) {
      totalUnits += w.stock_count;
      totalWholesaleCost += w.real_buying_price * w.stock_count;
      potentialRevenue += w.min_selling_price * w.stock_count;
      if (w.stock_count <= 2) lowStockCount += 1;
    }

    const projectedProfit = potentialRevenue - totalWholesaleCost;
    const avgMarginPct =
      potentialRevenue > 0
        ? Math.round((projectedProfit / potentialRevenue) * 1000) / 10
        : 0;

    return {
      totalModels: watches.length,
      totalUnits,
      totalWholesaleCost,
      potentialRevenue,
      projectedProfit,
      avgMarginPct,
      lowStockCount,
    };
  }, [watches]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNumericDrafts({
      display_buying_price: '',
      real_buying_price: '',
      min_selling_price: '',
      stock_count: '1',
    });
    setUploadedBase64(null);
    setPhotoProviderLabel('');
    setAiSuccessMsg('');
    setAiError('');
    setSaveError('');
    setFormOpen(true);
  };

  const handleNumericFieldChange = (field: keyof NumericDrafts, rawValue: string) => {
    const cleaned =
      field === 'stock_count'
        ? sanitizeStockInput(rawValue)
        : sanitizePriceInput(rawValue);
    setNumericDrafts((prev) => ({ ...prev, [field]: cleaned }));
    setForm((prev) => ({ ...prev, [field]: cleaned === '' ? 0 : Number(cleaned) }));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    setAiSuccessMsg('');
    setAiError('');
    try {
      const result = await uploadWatchPhoto(file);
      setForm((prev) => ({ ...prev, image_url: result.imageUrl }));
      setUploadedBase64({ base64: result.base64, mimeType: result.mimeType });
      setPhotoProviderLabel(
        result.provider === 'cloudinary'
          ? 'Uploaded to Cloudinary — ready for AI Auto-Fill'
          : 'Photo ready — click Auto-Fill Details with AI below'
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to process product image.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const hasPhoto = Boolean(uploadedBase64 || form.image_url?.trim());

  const handleAiAutoFill = async () => {
    if (!hasPhoto) {
      setAiError('Upload or capture a product photo first to use AI Auto-Fill.');
      return;
    }
    setAiFilling(true);
    setAiSuccessMsg('');
    setAiError('');
    try {
      const res = await fetch('/api/gemini/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          uploadedBase64
            ? {
                imageBase64: uploadedBase64.base64,
                mimeType: uploadedBase64.mimeType,
              }
            : {
                imageUrl: form.image_url,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' && !data.error.trim().startsWith('{')
            ? data.error
            : 'Could not auto-fill product details right now. Please enter them manually.'
        );
      }

      const validCategory = normalizeAiCategory(data.category);

      // Populate descriptive details only — leave pricing and stock count untouched
      setForm((prev) => ({
        ...prev,
        product_name:
          typeof data.product_name === 'string' && data.product_name.trim()
            ? data.product_name.trim()
            : prev.product_name,
        brand: typeof data.brand === 'string' && data.brand.trim() ? data.brand.trim() : prev.brand,
        model: typeof data.model === 'string' && data.model.trim() ? data.model.trim() : prev.model,
        color: typeof data.color === 'string' && data.color.trim() ? data.color.trim() : prev.color,
        category: validCategory,
        connectivity:
          typeof data.connectivity === 'string' && data.connectivity.trim()
            ? data.connectivity.trim()
            : prev.connectivity,
        capacity_spec:
          typeof data.capacity_spec === 'string' && data.capacity_spec.trim()
            ? data.capacity_spec.trim()
            : prev.capacity_spec,
        description:
          typeof data.description === 'string' && data.description.trim()
            ? data.description.trim()
            : prev.description,
      }));
      setAiSuccessMsg(
        'Product details filled by Gemini AI. Review details and enter your prices & stock below.'
      );
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      setAiError(
        rawMsg && !rawMsg.trim().startsWith('{')
          ? rawMsg
          : 'Could not analyze this photo. Please fill in the fields manually.'
      );
    } finally {
      setAiFilling(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const trimmedName = (form.product_name || '').trim();
      const trimmedModel = form.model.trim();
      const payload: WatchFormInput = {
        ...form,
        product_name: trimmedName || `${form.brand.trim()} ${trimmedModel}`.trim(),
        model: trimmedModel || trimmedName,
        connectivity: form.connectivity.trim() || 'Standard',
        capacity_spec: form.capacity_spec.trim() || 'Standard',
        display_buying_price: Number(numericDrafts.display_buying_price) || 0,
        real_buying_price: Number(numericDrafts.real_buying_price) || 0,
        min_selling_price: Number(numericDrafts.min_selling_price) || 0,
        stock_count: Number(numericDrafts.stock_count) || 0,
      };
      if (editingId) {
        await onUpdateWatch(editingId, payload);
      } else {
        await onCreateWatch(payload);
      }
      setFormOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save product.';
      setSaveError(
        msg.startsWith('{')
          ? 'Cloud database rejected this save. Please make sure you are signed in with your owner Google account and try again.'
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-[#121216]/90 border border-[#D4AF37]/25 p-5">
        <div>
          <p className="text-xs text-[#D4AF37] font-medium tracking-wider uppercase">
            Admin Mode · {adminUsername}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F8F9FA]">
            Watch &amp; Electronics Inventory
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Storage:{' '}
            {isSupabaseConfigured || storageSource === 'supabase'
              ? 'Supabase Cloud Database (Permanent 24/7 Live Storage)'
              : storageSource === 'server'
              ? 'Temporary Server Storage (Add Supabase keys for permanent 24/7 persistence)'
              : 'Local Browser Fallback'}{' '}
            · Media: {isCloudinaryPresetConfigured ? 'Cloudinary Live' : 'Compressed Cloud Image'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#0A0A0C] font-semibold text-sm flex items-center gap-2 hover:bg-[#E5C158] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus size={17} />
            <span>Add Product</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] px-3.5 rounded-xl border border-white/[0.12] text-xs font-medium text-[#D1D5DB] hover:bg-white/[0.06] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <LogOut size={15} />
            <span>Exit Admin</span>
          </button>
        </div>
      </div>

      {!isSupabaseConfigured && storageSource !== 'supabase' && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-400/35 px-4 py-3 text-xs text-amber-200 leading-relaxed space-y-1">
          <p className="font-semibold text-amber-300">
            Supabase environment keys are not detected on this server yet
          </p>
          <p className="text-[#D1D5DB]">
            Add <code className="text-amber-200">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="text-amber-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in AI Studio Secrets (or Cloud Run / Vercel Environment Variables) and run{' '}
            <code className="text-amber-200">schema.sql</code> in Supabase SQL Editor so products stay permanently saved 24/7 across restarts.
          </p>
        </div>
      )}

      {cloudError && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/35 px-4 py-3 text-xs text-rose-200 leading-relaxed">
          {cloudError}
        </div>
      )}

      {cloudNotice && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 px-4 py-3 text-xs text-emerald-300">
          {cloudNotice}
        </div>
      )}

      {/* Analytics KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#121216]/85 border border-white/[0.08] p-4">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Stock Inventory</span>
            <Package size={15} className="text-[#D4AF37]" />
          </div>
          <p className="font-mono-num text-2xl font-semibold text-[#F8F9FA] mt-2">
            {analytics.totalUnits}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Across {analytics.totalModels} products
          </p>
        </div>

        <div className="rounded-2xl bg-[#121216]/85 border border-white/[0.08] p-4">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Wholesale Valuation</span>
            <TrendingUp size={15} className="text-[#D4AF37]" />
          </div>
          <p className="font-mono-num text-xl sm:text-2xl font-semibold text-[#F8F9FA] mt-2">
            {formatBDT(analytics.totalWholesaleCost)}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">Actual cost invested</p>
        </div>

        <div className="rounded-2xl bg-[#121216]/85 border border-white/[0.08] p-4">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Projected Profit</span>
            <TrendingUp size={15} className="text-emerald-400" />
          </div>
          <p className="font-mono-num text-xl sm:text-2xl font-semibold text-emerald-400 mt-2">
            {formatBDT(analytics.projectedProfit)}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Avg margin {analytics.avgMarginPct}%
          </p>
        </div>

        <div className="rounded-2xl bg-[#121216]/85 border border-white/[0.08] p-4">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>Low Stock Alerts</span>
            <AlertTriangle
              size={15}
              className={analytics.lowStockCount > 0 ? 'text-amber-400' : 'text-[#9CA3AF]'}
            />
          </div>
          <p className="font-mono-num text-2xl font-semibold text-[#F8F9FA] mt-2">
            {analytics.lowStockCount}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">Items with 2 or fewer units</p>
        </div>
      </div>

      {/* Inventory Management Table / Mobile Cards */}
      <div className="rounded-3xl bg-[#121216]/85 border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#F8F9FA]">
            Live Stock &amp; Wholesale Ledger
          </h3>
          <span className="text-xs text-[#9CA3AF] font-mono-num">
            {watches.length} entries
          </span>
        </div>

        {watches.length === 0 ? (
          <div className="py-12 px-5 text-center space-y-3">
            <p className="text-sm text-[#A1A1AA]">
              Your electronics inventory is empty.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0A0A0C] text-xs font-semibold hover:bg-[#E5C158] transition-colors cursor-pointer"
            >
              Add First Product
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {watches.map((product) => {
              const unitProfit = product.min_selling_price - product.real_buying_price;
              const isDeleting = confirmDeleteId === product.id;

              return (
                <div
                  key={product.id}
                  className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-12 rounded-xl overflow-hidden bg-[#0A0A0C] border border-white/[0.08] shrink-0">
                      <WatchImage
                        src={product.image_url}
                        alt={product.model}
                        brand={product.brand}
                        model={product.model}
                        category={product.category}
                        iconSize={20}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#9CA3AF]">
                        <span className="text-[#D4AF37] font-medium">{product.brand}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.category}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#F8F9FA] truncate">
                        {product.product_name || product.model}
                      </p>
                      <p className="text-xs text-[#9CA3AF] truncate">
                        {product.product_name && product.model ? `${product.model} · ` : ''}
                        {product.color}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 sm:gap-6">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-[#9CA3AF]">Tag Price</p>
                        <p className="font-mono-num text-[#D1D5DB] mt-0.5">
                          {formatBDT(product.display_buying_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#9CA3AF]">Real Cost</p>
                        <p className="font-mono-num text-amber-300 mt-0.5">
                          {formatBDT(product.real_buying_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#9CA3AF]">Offer / Profit</p>
                        <p className="font-mono-num text-emerald-400 mt-0.5">
                          {formatBDT(product.min_selling_price)} (+{formatBDT(unitProfit)})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[#0A0A0C] border border-white/[0.1] rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, -1)}
                          disabled={product.stock_count <= 0}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#A1A1AA] hover:text-[#F8F9FA] disabled:opacity-35"
                          aria-label={`Decrease stock of ${product.model}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-mono-num text-xs font-semibold px-2 text-[#F8F9FA]">
                          {product.stock_count}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, 1)}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#A1A1AA] hover:text-[#F8F9FA]"
                          aria-label={`Increase stock of ${product.model}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-white/[0.1] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                        aria-label={`Edit ${product.model}`}
                      >
                        <Pencil size={15} />
                      </button>

                      {isDeleting ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteWatch(product.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[40px] px-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-medium text-rose-300 flex items-center gap-1"
                          >
                            <Check size={13} /> Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[40px] px-2 rounded-xl border border-white/[0.1] text-xs text-[#9CA3AF]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(product.id)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-white/[0.1] text-rose-400 hover:bg-rose-500/10"
                          aria-label={`Delete ${product.model}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6"
          onClick={() => setFormOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit Product' : 'Add New Product'}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-[#121216] border border-white/[0.12] p-5 sm:p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#F8F9FA]">
                  {editingId ? 'Edit Product' : 'Add Watch or Electronics Item'}
                </h3>
                <p className="text-xs text-[#9CA3AF]">
                  Upload a photo and use Auto-Fill with AI to populate details automatically
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.05] text-[#9CA3AF] hover:text-[#F8F9FA]"
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-5">
              {/* Photo Upload / Camera Capture + Prominent Gold Auto-Fill with AI */}
              <div className="rounded-2xl bg-[#0A0A0C] border border-white/[0.08] p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-28 h-24 rounded-xl overflow-hidden bg-[#141418] border border-white/[0.08] shrink-0">
                    <WatchImage
                      src={form.image_url}
                      alt="Preview"
                      brand={form.brand || 'New Chiko'}
                      model={form.product_name || form.model || 'Preview'}
                      category={form.category}
                      iconSize={28}
                    />
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="min-h-[44px] px-4 rounded-xl bg-white/[0.07] border border-white/[0.12] text-xs font-medium text-[#F8F9FA] hover:bg-white/[0.12] flex items-center gap-2 cursor-pointer"
                      >
                        <Upload size={15} />
                        <span>{uploadingPhoto ? 'Processing...' : 'Upload Photo'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="min-h-[44px] px-4 rounded-xl bg-white/[0.07] border border-white/[0.12] text-xs font-medium text-[#F8F9FA] hover:bg-white/[0.12] flex items-center gap-2 cursor-pointer"
                      >
                        <Camera size={15} />
                        <span>Take Photo</span>
                      </button>
                    </div>

                    {photoProviderLabel && (
                      <p className="text-[11px] text-emerald-400">{photoProviderLabel}</p>
                    )}
                    {!hasPhoto && (
                      <p className="text-[11px] text-[#9CA3AF]">
                        Upload or capture a photo to unlock AI Auto-Fill.
                      </p>
                    )}
                  </div>
                </div>

                {hasPhoto && (
                  <button
                    type="button"
                    onClick={handleAiAutoFill}
                    disabled={aiFilling || uploadingPhoto}
                    className="w-full min-h-[48px] px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E8C55B] to-[#D4AF37] text-[#0A0A0C] font-semibold text-sm shadow-lg shadow-[#D4AF37]/25 hover:brightness-105 disabled:opacity-60 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {aiFilling ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        <span>Analyzing Product Photo with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} />
                        <span>✨ Auto-Fill Details with AI</span>
                      </>
                    )}
                  </button>
                )}

                {aiSuccessMsg && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <Check size={14} className="shrink-0" />
                    <span>{aiSuccessMsg}</span>
                  </p>
                )}
                {aiError && <p className="text-xs text-rose-400">{aiError}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-[#D1D5DB]">Product Name</label>
                  <input
                    type="text"
                    required
                    value={form.product_name || ''}
                    onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                    placeholder="e.g. Casio Edifice Slim Sapphire Steel Watch or Oraimo FreePods 4 ANC"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Brand</label>
                  <input
                    type="text"
                    required
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. Casio, Seiko, Oraimo, Anker, JBL"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Model Number / Name</label>
                  <input
                    type="text"
                    required
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. EFR-S108D-1AV or OTW-330"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as ProductCategory })
                    }
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Color / Strap / Finish</label>
                  <input
                    type="text"
                    required
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="e.g. Black / Steel or Matte White"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Movement / Connectivity</label>
                  <input
                    type="text"
                    value={form.connectivity}
                    onChange={(e) => setForm({ ...form, connectivity: e.target.value })}
                    placeholder="e.g. Japanese Quartz or Bluetooth 5.3 · USB-C"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Case Size / Spec / Capacity</label>
                  <input
                    type="text"
                    value={form.capacity_spec}
                    onChange={(e) => setForm({ ...form, capacity_spec: e.target.value })}
                    placeholder="e.g. 40mm · 5ATM or 20,000mAh · 22.5W"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Three-Tier Pricing Inputs (String-backed so leading 0 never gets stuck) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Tag Price (৳)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.display_buying_price}
                    onChange={(e) =>
                      handleNumericFieldChange('display_buying_price', e.target.value)
                    }
                    placeholder="e.g. 2500"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3 font-mono-num text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-amber-300">Real Cost (৳)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.real_buying_price}
                    onChange={(e) =>
                      handleNumericFieldChange('real_buying_price', e.target.value)
                    }
                    placeholder="e.g. 1400"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-amber-400/30 px-3 font-mono-num text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-emerald-300">Offer Price (৳)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.min_selling_price}
                    onChange={(e) =>
                      handleNumericFieldChange('min_selling_price', e.target.value)
                    }
                    placeholder="e.g. 1950"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-emerald-400/30 px-3 font-mono-num text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#D1D5DB]">Stock Qty</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.stock_count}
                    onChange={(e) => handleNumericFieldChange('stock_count', e.target.value)}
                    placeholder="1"
                    className="w-full min-h-[44px] rounded-xl bg-[#0A0A0C] border border-white/[0.12] px-3 font-mono-num text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#D1D5DB]">Short Attractive Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Highlights visible features, strap/build style, finish, and key specs..."
                  className="w-full rounded-xl bg-[#0A0A0C] border border-white/[0.12] p-3 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {saveError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/35 px-3.5 py-2.5 text-xs text-rose-200">
                  {saveError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0A0A0C] font-semibold text-sm hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add to Inventory'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-[48px] px-5 rounded-xl border border-white/[0.12] text-sm text-[#D1D5DB] hover:bg-white/[0.05] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </section>
  );
}
