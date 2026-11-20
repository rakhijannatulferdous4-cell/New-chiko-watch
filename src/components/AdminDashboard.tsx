import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Camera,
  Check,
  CheckSquare,
  Cloud,
  CloudUpload,
  Copy,
  Link2,
  Loader2,
  LogOut,
  Minus,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { isSupabaseConfigured } from '../config/keys';
import {
  CloudinaryStatusInfo,
  fetchCloudinaryStatus,
  uploadDataUrlToCloudinary,
  uploadWatchPhoto,
} from '../services/watchStore';
import { DigitalMemo, ProductCategory, WatchFormInput, WatchItem } from '../types/watch';
import {
  AdminAnalyticsView,
  AdminMediaCenterView,
  AdminToolsView,
} from './AdminProTools';
import { formatBDT } from './TripleTapPrice';
import { WatchImage } from './WatchImage';

interface AdminDashboardProps {
  watches: WatchItem[];
  savedMemos: DigitalMemo[];
  adminUsername: string;
  adminToken: string;
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
  onAddToMemo?: (watch: WatchItem, agreedPrice?: number) => void;
}

type AdminWorkspaceTab = 'inventory' | 'analytics' | 'tools' | 'media';
type AdminStockFilter = 'all' | 'inStock' | 'lowStock' | 'outOfStock';
type AdminMediaFilter = 'all' | 'cloudinary' | 'base64';
type AdminSortOption =
  | 'newest'
  | 'priceAsc'
  | 'priceDesc'
  | 'marginDesc'
  | 'stockAsc'
  | 'nameAsc';

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

const SPEC_PRESETS: Array<{
  label: string;
  category: ProductCategory;
  connectivity: string;
  capacity_spec: string;
}> = [
  {
    label: 'Quartz Watch',
    category: 'Analog Watches',
    connectivity: 'Japanese Quartz · Stainless Steel',
    capacity_spec: '40mm · 5ATM Water Resistant',
  },
  {
    label: 'Smartwatch',
    category: 'Smartwatches',
    connectivity: 'Bluetooth 5.3 · Magnetic Charge',
    capacity_spec: 'AMOLED Display · 7-Day Battery',
  },
  {
    label: 'TWS Earbuds',
    category: 'TWS Earbuds',
    connectivity: 'Bluetooth 5.3 · USB-C',
    capacity_spec: 'ANC · 32h Total Playtime',
  },
  {
    label: 'Power Bank',
    category: 'Power Banks',
    connectivity: 'USB-C PD · Dual Output',
    capacity_spec: '10,000mAh · 22.5W Fast Charge',
  },
  {
    label: 'BT Speaker',
    category: 'Bluetooth Speakers',
    connectivity: 'Bluetooth 5.1 · USB / TF / AUX',
    capacity_spec: '10W Deep Bass · RGB LED',
  },
  {
    label: 'Pod / Gadget',
    category: 'Gadgets & Accessories',
    connectivity: 'USB-C Rechargeable',
    capacity_spec: '6000 Puffs · Dual Mesh Coil',
  },
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
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
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
  savedMemos,
  adminUsername,
  adminToken,
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
  onAddToMemo,
}: AdminDashboardProps) {
  // Workspace sub-tab
  const [workspaceTab, setWorkspaceTab] = useState<AdminWorkspaceTab>('inventory');

  // Cloudinary live status
  const [cloudinaryStatus, setCloudinaryStatus] = useState<CloudinaryStatusInfo | null>(null);

  const refreshCloudinaryStatus = useCallback(async () => {
    const info = await fetchCloudinaryStatus();
    setCloudinaryStatus(info);
  }, []);

  useEffect(() => {
    void refreshCloudinaryStatus();
  }, [refreshCloudinaryStatus]);

  // Inventory filter, search & sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProductCategory>('All');
  const [stockFilter, setStockFilter] = useState<AdminStockFilter>('all');
  const [mediaFilter, setMediaFilter] = useState<AdminMediaFilter>('all');
  const [sortBy, setSortBy] = useState<AdminSortOption>('newest');

  // Bulk selection & actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkPricePct, setBulkPricePct] = useState('10');
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<ProductCategory>('Gadgets & Accessories');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Add / Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WatchFormInput>(EMPTY_FORM);
  const [numericDrafts, setNumericDrafts] = useState<NumericDrafts>({
    display_buying_price: '',
    real_buying_price: '',
    min_selling_price: '',
    stock_count: '1',
  });
  const [showUrlInput, setShowUrlInput] = useState(false);
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
      display_buying_price: String(product.display_buying_price ?? 0),
      real_buying_price: String(product.real_buying_price ?? 0),
      min_selling_price: String(product.min_selling_price ?? 0),
      stock_count: String(product.stock_count ?? 0),
    });
    setUploadedBase64(null);
    setShowUrlInput(false);
    setPhotoProviderLabel('');
    setAiSuccessMsg('');
    setAiError('');
    setSaveError('');
    setFormOpen(true);
  };

  const openDuplicateModal = (product: WatchItem) => {
    setEditingId(null);
    setForm({
      product_name: product.product_name ? `${product.product_name} (Variant)` : '',
      brand: product.brand,
      model: `${product.model}-V2`,
      color: product.color,
      category: product.category,
      connectivity: product.connectivity,
      capacity_spec: product.capacity_spec,
      display_buying_price: product.display_buying_price,
      real_buying_price: product.real_buying_price,
      min_selling_price: product.min_selling_price,
      stock_count: Math.max(1, product.stock_count),
      image_url: product.image_url || '',
      description: product.description,
    });
    setNumericDrafts({
      display_buying_price: String(product.display_buying_price ?? 0),
      real_buying_price: String(product.real_buying_price ?? 0),
      min_selling_price: String(product.min_selling_price ?? 0),
      stock_count: String(Math.max(1, product.stock_count)),
    });
    setUploadedBase64(null);
    setShowUrlInput(false);
    setPhotoProviderLabel('Duplicated from existing product — adjust color, model, or photo');
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

  // Prune stale selected IDs when watches change
  useEffect(() => {
    const valid = new Set(watches.map((w) => w.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [watches]);

  const analytics = useMemo(() => {
    let totalUnits = 0;
    let totalWholesaleCost = 0;
    let potentialRevenue = 0;
    let lowStockCount = 0;
    let base64Count = 0;

    for (const w of watches) {
      totalUnits += w.stock_count;
      totalWholesaleCost += w.real_buying_price * w.stock_count;
      potentialRevenue += w.min_selling_price * w.stock_count;
      if (w.stock_count <= 2) lowStockCount += 1;
      if (w.image_url?.startsWith('data:image/')) base64Count += 1;
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
      base64Count,
    };
  }, [watches]);

  const filteredWatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = watches.filter((w) => {
      if (q) {
        const hay =
          `${w.product_name ?? ''} ${w.brand} ${w.model} ${w.color} ${w.category} ${w.connectivity} ${w.capacity_spec} ${w.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter !== 'All' && w.category !== categoryFilter) return false;
      if (stockFilter === 'inStock' && w.stock_count <= 0) return false;
      if (stockFilter === 'lowStock' && (w.stock_count <= 0 || w.stock_count > 2)) return false;
      if (stockFilter === 'outOfStock' && w.stock_count > 0) return false;
      if (mediaFilter === 'cloudinary' && !w.image_url?.includes('res.cloudinary.com')) {
        return false;
      }
      if (mediaFilter === 'base64' && !w.image_url?.startsWith('data:image/')) {
        return false;
      }
      return true;
    });

    const sorted = [...list];
    switch (sortBy) {
      case 'priceAsc':
        sorted.sort((a, b) => a.min_selling_price - b.min_selling_price);
        break;
      case 'priceDesc':
        sorted.sort((a, b) => b.min_selling_price - a.min_selling_price);
        break;
      case 'marginDesc': {
        const marginOf = (w: WatchItem) =>
          w.min_selling_price > 0
            ? (w.min_selling_price - w.real_buying_price) / w.min_selling_price
            : -1;
        sorted.sort((a, b) => marginOf(b) - marginOf(a));
        break;
      }
      case 'stockAsc':
        sorted.sort((a, b) => a.stock_count - b.stock_count);
        break;
      case 'nameAsc':
        sorted.sort((a, b) =>
          (a.product_name || `${a.brand} ${a.model}`).localeCompare(
            b.product_name || `${b.brand} ${b.model}`
          )
        );
        break;
      default:
        break;
    }
    return sorted;
  }, [watches, searchQuery, categoryFilter, stockFilter, mediaFilter, sortBy]);

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredWatches.length > 0 && filteredWatches.every((w) => selectedIds.includes(w.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredWatches.map((w) => w.id));
    }
  };

  // Bulk operation runners
  const runBulkStockDelta = async (delta: number) => {
    if (selectedIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkMessage('');
    try {
      for (const id of selectedIds) {
        await onAdjustStock(id, delta);
      }
      setBulkMessage(
        `Updated stock (${delta > 0 ? `+${delta}` : delta}) for ${selectedIds.length} product(s).`
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkMarkOutOfStock = async () => {
    if (selectedIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkMessage('');
    try {
      for (const id of selectedIds) {
        await onUpdateWatch(id, { stock_count: 0 });
      }
      setBulkMessage(`Marked ${selectedIds.length} product(s) out of stock.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkPriceAdjust = async (direction: 1 | -1) => {
    const pct = Math.max(1, Math.min(90, Number(bulkPricePct) || 0));
    if (selectedIds.length === 0 || pct <= 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkMessage('');
    const factor = 1 + (direction * pct) / 100;
    try {
      for (const id of selectedIds) {
        const target = watches.find((w) => w.id === id);
        if (!target) continue;
        const nextOffer = Math.max(0, Math.round((target.min_selling_price * factor) / 10) * 10);
        const nextTag = Math.max(
          nextOffer,
          Math.round((target.display_buying_price * factor) / 10) * 10
        );
        await onUpdateWatch(id, {
          min_selling_price: nextOffer,
          display_buying_price: nextTag,
        });
      }
      setBulkMessage(
        `Adjusted prices by ${direction > 0 ? '+' : '-'}${pct}% on ${selectedIds.length} product(s).`
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkCategoryMove = async () => {
    if (selectedIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkMessage('');
    try {
      for (const id of selectedIds) {
        await onUpdateWatch(id, { category: bulkCategoryTarget });
      }
      setBulkMessage(`Moved ${selectedIds.length} product(s) to ${bulkCategoryTarget}.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkCloudinaryMigrate = async () => {
    const targets = watches.filter(
      (w) => selectedIds.includes(w.id) && w.image_url?.startsWith('data:image/')
    );
    if (targets.length === 0 || bulkBusy) {
      setBulkMessage('None of the selected items use Base64 database photos.');
      return;
    }
    setBulkBusy(true);
    setBulkMessage('');
    let migrated = 0;
    try {
      for (const w of targets) {
        const img = w.image_url;
        if (!img) continue;
        const res = await uploadDataUrlToCloudinary(img, adminToken);
        if (!res.ok) {
          setBulkMessage(`Cloudinary notice: ${res.error}`);
          break;
        }
        await onUpdateWatch(w.id, { image_url: res.imageUrl });
        migrated += 1;
      }
      if (migrated > 0) {
        setBulkMessage(`Migrated ${migrated} selected photo(s) to Cloudinary CDN!`);
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkDelete = async () => {
    if (selectedIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkMessage('');
    const count = selectedIds.length;
    try {
      for (const id of [...selectedIds]) {
        await onDeleteWatch(id);
      }
      setSelectedIds([]);
      setConfirmBulkDelete(false);
      setBulkMessage(`Deleted ${count} product(s) from inventory.`);
    } finally {
      setBulkBusy(false);
    }
  };

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
    setShowUrlInput(false);
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

  const applyMarkupPreset = (markupPct: number) => {
    const cost = Number(numericDrafts.real_buying_price) || 0;
    if (cost <= 0) return;
    const offer = Math.round((cost * (1 + markupPct / 100)) / 10) * 10;
    const tag = Math.round((offer * 1.2) / 50) * 50;
    setNumericDrafts((prev) => ({
      ...prev,
      min_selling_price: String(offer),
      display_buying_price: String(Math.max(tag, offer)),
    }));
    setForm((prev) => ({
      ...prev,
      min_selling_price: offer,
      display_buying_price: Math.max(tag, offer),
    }));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    setAiSuccessMsg('');
    setAiError('');
    try {
      const result = await uploadWatchPhoto(file, adminToken);
      setForm((prev) => ({ ...prev, image_url: result.imageUrl }));
      setUploadedBase64({ base64: result.base64, mimeType: result.mimeType });
      setPhotoProviderLabel(
        result.provider === 'cloudinary'
          ? `Uploaded to Cloudinary 25GB CDN (${result.mode === 'signed' ? 'Signed' : 'Preset'}) — ready for AI Auto-Fill`
          : 'Photo ready (DB compressed) — add Cloudinary Secrets for 25GB CDN'
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
          ? 'Cloud database rejected this save. Please try again.'
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  // Live form pricing stats
  const draftCost = Number(numericDrafts.real_buying_price) || 0;
  const draftOffer = Number(numericDrafts.min_selling_price) || 0;
  const draftTag = Number(numericDrafts.display_buying_price) || 0;
  const draftProfit = draftOffer - draftCost;
  const draftMarginPct =
    draftOffer > 0 ? Math.round((draftProfit / draftOffer) * 1000) / 10 : 0;
  const draftDiscountPct =
    draftTag > draftOffer && draftTag > 0
      ? Math.round(((draftTag - draftOffer) / draftTag) * 100)
      : 0;

  const WORKSPACE_TABS: Array<{
    id: AdminWorkspaceTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    { id: 'inventory', label: 'Inventory & Bulk', icon: <Package size={15} /> },
    { id: 'analytics', label: 'Analytics & Profit', icon: <BarChart3 size={15} /> },
    { id: 'tools', label: 'Tools, Tags & CSV', icon: <Wrench size={15} /> },
    {
      id: 'media',
      label: 'Cloudinary 25GB',
      icon: <Cloud size={15} />,
      badge: analytics.base64Count > 0 ? `${analytics.base64Count}` : undefined,
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white border border-zinc-200 p-5 shadow-xs no-print">
        <div>
          <p className="text-xs text-zinc-500 font-semibold tracking-wider uppercase">
            Admin Command Center · {adminUsername}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#09090B]">
            Watch &amp; Electronics Management
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Database:{' '}
            {isSupabaseConfigured || storageSource === 'supabase'
              ? 'Supabase Live Cloud'
              : storageSource === 'server'
              ? 'Server Storage'
              : 'Local Fallback'}{' '}
            · Media:{' '}
            {cloudinaryStatus?.configured
              ? `Cloudinary 25GB CDN (${cloudinaryStatus.cloudName})`
              : `DB Compressed (${analytics.base64Count} ready for Cloudinary)`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[44px] px-4 rounded-xl bg-[#09090B] text-white font-semibold text-sm flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer"
          >
            <Plus size={17} />
            <span>Add Product</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] px-3.5 rounded-xl border border-zinc-300 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer"
          >
            <LogOut size={15} />
            <span>Exit Admin</span>
          </button>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-xl bg-zinc-200/70 border border-zinc-200 no-print">
        {WORKSPACE_TABS.map((tab) => {
          const active = workspaceTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWorkspaceTab(tab.id)}
              className={`relative flex-1 min-w-[140px] min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                active ? 'text-[#09090B]' : 'text-zinc-600 hover:text-[#09090B]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="admin-workspace-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-white shadow-xs"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="font-mono-num text-[11px] text-amber-700 font-bold">
                    ({tab.badge})
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {!isSupabaseConfigured && storageSource !== 'supabase' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 leading-relaxed space-y-1 no-print">
          <p className="font-semibold">
            Supabase environment keys are not detected on this server yet
          </p>
          <p>
            Add <code className="font-mono font-semibold">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in AI Studio Secrets and run{' '}
            <code className="font-mono font-semibold">schema.sql</code> in Supabase SQL Editor.
          </p>
        </div>
      )}

      {cloudError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 leading-relaxed no-print">
          {cloudError}
        </div>
      )}

      {cloudNotice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800 font-medium no-print">
          {cloudNotice}
        </div>
      )}

      {/* Analytics KPI Strip (always visible on Inventory & Analytics tabs) */}
      {(workspaceTab === 'inventory' || workspaceTab === 'analytics') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
            className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Stock Inventory</span>
              <Package size={15} className="text-zinc-900" />
            </div>
            <p className="font-mono-num text-2xl font-bold text-[#09090B] mt-2">
              {analytics.totalUnits}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Across {analytics.totalModels} products
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Wholesale Valuation</span>
              <TrendingUp size={15} className="text-zinc-900" />
            </div>
            <p className="font-mono-num text-xl sm:text-2xl font-bold text-[#09090B] mt-2">
              {formatBDT(analytics.totalWholesaleCost)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Actual cost invested</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Projected Profit</span>
              <TrendingUp size={15} className="text-emerald-700" />
            </div>
            <p className="font-mono-num text-xl sm:text-2xl font-bold text-emerald-700 mt-2">
              {formatBDT(analytics.projectedProfit)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Avg margin {analytics.avgMarginPct}%
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="rounded-xl bg-white border border-zinc-200 p-4 shadow-2xs"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Low Stock Alerts</span>
              <AlertTriangle
                size={15}
                className={analytics.lowStockCount > 0 ? 'text-amber-600' : 'text-zinc-400'}
              />
            </div>
            <p className="font-mono-num text-2xl font-bold text-[#09090B] mt-2">
              {analytics.lowStockCount}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Items with 2 or fewer units</p>
          </motion.div>
        </div>
      )}

      {/* Workspace Body */}
      <AnimatePresence mode="wait">
        {workspaceTab === 'inventory' && (
          <motion.div
            key="ws-inventory"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Search, Multi-Filter & Sort Toolbar */}
            <div className="rounded-2xl bg-white border border-zinc-200 p-4 shadow-2xs space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                <div className="relative md:col-span-4">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search inventory by name, brand, model..."
                    className="w-full min-h-[40px] rounded-xl bg-zinc-50 border border-zinc-200 pl-9 pr-3 text-xs text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value as 'All' | ProductCategory)
                  }
                  className="md:col-span-2 min-h-[40px] rounded-xl bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                >
                  <option value="All">All Categories</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as AdminStockFilter)}
                  className="md:col-span-2 min-h-[40px] rounded-xl bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                >
                  <option value="all">All Stock</option>
                  <option value="inStock">In Stock</option>
                  <option value="lowStock">Low Stock (1–2)</option>
                  <option value="outOfStock">Out of Stock</option>
                </select>

                <select
                  value={mediaFilter}
                  onChange={(e) => setMediaFilter(e.target.value as AdminMediaFilter)}
                  className="md:col-span-2 min-h-[40px] rounded-xl bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                >
                  <option value="all">All Photos</option>
                  <option value="cloudinary">Cloudinary CDN</option>
                  <option value="base64">DB Base64 Only</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as AdminSortOption)}
                  className="md:col-span-2 min-h-[40px] rounded-xl bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="priceAsc">Price: Low to High</option>
                  <option value="priceDesc">Price: High to Low</option>
                  <option value="marginDesc">Highest Margin %</option>
                  <option value="stockAsc">Lowest Stock First</option>
                  <option value="nameAsc">Name: A to Z</option>
                </select>
              </div>

              {/* Bulk Selection Action Bar */}
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl bg-zinc-950 text-white p-3 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold font-mono-num">
                        {selectedIds.length} product(s) selected
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds([]);
                          setConfirmBulkDelete(false);
                        }}
                        className="text-xs text-zinc-300 hover:text-white cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => runBulkStockDelta(1)}
                        className="min-h-[34px] px-2.5 rounded-lg bg-white/15 hover:bg-white/25 font-medium cursor-pointer disabled:opacity-40"
                      >
                        Stock +1
                      </button>
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={() => runBulkStockDelta(5)}
                        className="min-h-[34px] px-2.5 rounded-lg bg-white/15 hover:bg-white/25 font-medium cursor-pointer disabled:opacity-40"
                      >
                        Stock +5
                      </button>
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={runBulkMarkOutOfStock}
                        className="min-h-[34px] px-2.5 rounded-lg bg-white/15 hover:bg-white/25 font-medium cursor-pointer disabled:opacity-40"
                      >
                        Set Stock 0
                      </button>

                      {/* Bulk % Price Adjust */}
                      <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={bulkPricePct}
                          onChange={(e) =>
                            setBulkPricePct(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))
                          }
                          className="w-10 rounded bg-white/15 px-1.5 py-1 text-center font-mono-num text-xs text-white focus:outline-none"
                          aria-label="Bulk price adjustment percentage"
                        />
                        <span className="text-zinc-300 text-[11px]">%</span>
                        <button
                          type="button"
                          disabled={bulkBusy}
                          onClick={() => runBulkPriceAdjust(1)}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer disabled:opacity-40"
                        >
                          +Raise
                        </button>
                        <button
                          type="button"
                          disabled={bulkBusy}
                          onClick={() => runBulkPriceAdjust(-1)}
                          className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer disabled:opacity-40"
                        >
                          -Drop
                        </button>
                      </div>

                      {/* Bulk Category Move */}
                      <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                        <select
                          value={bulkCategoryTarget}
                          onChange={(e) =>
                            setBulkCategoryTarget(e.target.value as ProductCategory)
                          }
                          className="bg-zinc-900 text-white text-xs rounded px-2 py-1 focus:outline-none"
                        >
                          {CATEGORY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={bulkBusy}
                          onClick={runBulkCategoryMove}
                          className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-semibold cursor-pointer disabled:opacity-40"
                        >
                          Move
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={runBulkCloudinaryMigrate}
                        className="min-h-[34px] px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <CloudUpload size={13} />
                        <span>Move to Cloudinary</span>
                      </button>

                      {confirmBulkDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={bulkBusy}
                            onClick={runBulkDelete}
                            className="min-h-[34px] px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                          >
                            Confirm Delete ({selectedIds.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmBulkDelete(false)}
                            className="min-h-[34px] px-2 rounded-lg bg-white/15 text-zinc-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={bulkBusy}
                          onClick={() => setConfirmBulkDelete(true)}
                          className="min-h-[34px] px-2.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {bulkMessage && (
                <p className="text-xs font-medium text-emerald-700">{bulkMessage}</p>
              )}
            </div>

            {/* Inventory Management Ledger */}
            <div className="rounded-2xl bg-white border border-zinc-200 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
                <div className="flex items-center gap-3">
                  {filteredWatches.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="text-zinc-700 hover:text-[#09090B] flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                      aria-label="Select all filtered products"
                    >
                      {allFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      <span>Select All</span>
                    </button>
                  )}
                  <h3 className="text-sm font-semibold text-[#09090B]">
                    Live Stock &amp; Wholesale Ledger
                  </h3>
                </div>
                <span className="text-xs text-zinc-500 font-mono-num">
                  {filteredWatches.length} of {watches.length} entries
                </span>
              </div>

              {watches.length === 0 ? (
                <div className="py-12 px-5 text-center space-y-3">
                  <p className="text-sm text-zinc-500">
                    Your watches &amp; electronics inventory is empty.
                  </p>
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="min-h-[44px] px-5 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Add First Product
                  </button>
                </div>
              ) : filteredWatches.length === 0 ? (
                <div className="py-10 px-5 text-center space-y-2">
                  <p className="text-sm text-zinc-600 font-medium">
                    No products match your current filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('All');
                      setStockFilter('all');
                      setMediaFilter('all');
                    }}
                    className="text-xs font-semibold text-[#09090B] underline cursor-pointer"
                  >
                    Reset Inventory Filters
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredWatches.map((product) => {
                    const unitProfit = product.min_selling_price - product.real_buying_price;
                    const marginPct =
                      product.min_selling_price > 0
                        ? Math.round((unitProfit / product.min_selling_price) * 100)
                        : 0;
                    const isDeleting = confirmDeleteId === product.id;
                    const isSelected = selectedIds.includes(product.id);
                    const isCloudCdn = Boolean(product.image_url?.includes('res.cloudinary.com'));
                    const isBase64 = Boolean(product.image_url?.startsWith('data:image/'));

                    return (
                      <div
                        key={product.id}
                        className={`p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                          isSelected ? 'bg-zinc-100/70' : 'hover:bg-zinc-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleSelectRow(product.id)}
                            className="text-zinc-500 hover:text-[#09090B] shrink-0 cursor-pointer"
                            aria-label={`Select ${product.model}`}
                          >
                            {isSelected ? (
                              <CheckSquare size={17} className="text-[#09090B]" />
                            ) : (
                              <Square size={17} />
                            )}
                          </button>

                          <div className="w-16 h-12 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
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
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                              <span className="text-zinc-900 font-semibold uppercase">
                                {product.brand}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{product.category}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  isCloudCdn
                                    ? 'text-emerald-700 font-medium'
                                    : isBase64
                                    ? 'text-amber-700'
                                    : 'text-zinc-400'
                                }
                              >
                                {isCloudCdn ? 'Cloudinary CDN' : isBase64 ? 'DB Photo' : 'No Photo'}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-[#09090B] truncate">
                              {product.product_name || product.model}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                              {product.product_name && product.model ? `${product.model} · ` : ''}
                              {product.color}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 sm:gap-5">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-zinc-500">Tag Price</p>
                              <p className="font-mono-num text-zinc-800 font-medium mt-0.5">
                                {formatBDT(product.display_buying_price)}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Real Cost</p>
                              <p className="font-mono-num text-zinc-950 font-semibold mt-0.5">
                                {formatBDT(product.real_buying_price)}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Offer · {marginPct}%</p>
                              <p
                                className={`font-mono-num font-semibold mt-0.5 ${
                                  unitProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {formatBDT(product.min_selling_price)} ({unitProfit >= 0 ? '+' : ''}
                                {formatBDT(unitProfit)})
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-0.5 bg-zinc-50 border border-zinc-200 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => onAdjustStock(product.id, -1)}
                                disabled={product.stock_count <= 0}
                                className="min-h-[34px] min-w-[32px] flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-white disabled:opacity-35 cursor-pointer"
                                aria-label={`Decrease stock of ${product.model}`}
                              >
                                <Minus size={13} />
                              </button>
                              <span className="font-mono-num text-xs font-bold px-1.5 text-[#09090B]">
                                {product.stock_count}
                              </span>
                              <button
                                type="button"
                                onClick={() => onAdjustStock(product.id, 1)}
                                className="min-h-[34px] min-w-[32px] flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-white cursor-pointer"
                                aria-label={`Increase stock of ${product.model}`}
                              >
                                <Plus size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onAdjustStock(product.id, 5)}
                                className="min-h-[34px] px-1.5 rounded-lg text-[11px] font-mono-num font-semibold text-zinc-700 hover:text-zinc-950 hover:bg-white cursor-pointer"
                                title="Quick restock +5"
                              >
                                +5
                              </button>
                            </div>

                            {onAddToMemo && (
                              <button
                                type="button"
                                onClick={() => onAddToMemo(product)}
                                disabled={product.stock_count <= 0}
                                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-800 hover:bg-zinc-100 disabled:opacity-35 transition-colors cursor-pointer"
                                title="Create Digital Memo"
                                aria-label={`Create memo for ${product.model}`}
                              >
                                <ReceiptText size={14} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openDuplicateModal(product)}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                              title="Duplicate product variant"
                              aria-label={`Duplicate ${product.model}`}
                            >
                              <Copy size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                              title="Edit product"
                              aria-label={`Edit ${product.model}`}
                            >
                              <Pencil size={14} />
                            </button>

                            {isDeleting ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteWatch(product.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="min-h-[38px] px-2.5 rounded-xl bg-rose-600 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                                >
                                  <Check size={13} /> Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[38px] px-2 rounded-xl border border-zinc-200 text-xs text-zinc-600 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(product.id)}
                                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-zinc-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete product"
                                aria-label={`Delete ${product.model}`}
                              >
                                <Trash2 size={14} />
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
          </motion.div>
        )}

        {workspaceTab === 'analytics' && (
          <motion.div
            key="ws-analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <AdminAnalyticsView
              watches={watches}
              savedMemos={savedMemos}
              onAdjustStock={onAdjustStock}
            />
          </motion.div>
        )}

        {workspaceTab === 'tools' && (
          <motion.div
            key="ws-tools"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <AdminToolsView
              watches={watches}
              savedMemos={savedMemos}
              onCreateWatch={onCreateWatch}
              onAddToMemo={onAddToMemo}
            />
          </motion.div>
        )}

        {workspaceTab === 'media' && (
          <motion.div
            key="ws-media"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <AdminMediaCenterView
              watches={watches}
              adminToken={adminToken}
              cloudinaryStatus={cloudinaryStatus}
              onRefreshCloudinary={refreshCloudinaryStatus}
              onUpdateWatch={onUpdateWatch}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Product Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-xs p-0 md:p-6 no-print"
          onClick={() => setFormOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit Product' : 'Add New Product'}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-2xl bg-white border border-zinc-200 p-5 sm:p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#09090B]">
                  {editingId ? 'Edit Product' : 'Add Watch or Electronics Item'}
                </h3>
                <p className="text-xs text-zinc-500">
                  Photos auto-upload to Cloudinary 25GB CDN when connected · Use AI Auto-Fill to save time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 hover:text-zinc-950 cursor-pointer"
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-5">
              {/* Photo Upload / Camera Capture / Direct URL + Auto-Fill with AI */}
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-28 h-24 rounded-xl overflow-hidden bg-white border border-zinc-200 shrink-0">
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
                        className="min-h-[42px] px-3.5 rounded-xl bg-white border border-zinc-300 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload size={14} />
                        <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="min-h-[42px] px-3.5 rounded-xl bg-white border border-zinc-300 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera size={14} />
                        <span>Take Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowUrlInput((v) => !v)}
                        className="min-h-[42px] px-3.5 rounded-xl bg-white border border-zinc-300 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Link2 size={14} />
                        <span>Image URL</span>
                      </button>
                    </div>

                    {showUrlInput && (
                      <input
                        type="url"
                        value={form.image_url?.startsWith('http') ? form.image_url : ''}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, image_url: e.target.value.trim() }));
                          setUploadedBase64(null);
                        }}
                        placeholder="Paste Cloudinary or external https:// image link..."
                        className="w-full min-h-[38px] rounded-lg bg-white border border-zinc-300 px-3 text-xs text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950"
                      />
                    )}

                    {photoProviderLabel && (
                      <p className="text-[11px] font-medium text-emerald-700">
                        {photoProviderLabel}
                      </p>
                    )}
                    {!hasPhoto && (
                      <p className="text-[11px] text-zinc-500">
                        Upload, capture, or paste a Cloudinary photo link to unlock AI Auto-Fill.
                      </p>
                    )}
                  </div>
                </div>

                {hasPhoto && (
                  <button
                    type="button"
                    onClick={handleAiAutoFill}
                    disabled={aiFilling || uploadingPhoto}
                    className="w-full min-h-[44px] px-5 rounded-xl bg-[#09090B] text-white font-semibold text-sm hover:bg-zinc-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {aiFilling ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        <span>Analyzing Product Photo with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} />
                        <span>Auto-Fill Details with AI</span>
                      </>
                    )}
                  </button>
                )}

                {aiSuccessMsg && (
                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <Check size={14} className="shrink-0" />
                    <span>{aiSuccessMsg}</span>
                  </p>
                )}
                {aiError && <p className="text-xs text-rose-600">{aiError}</p>}
              </div>

              {/* Quick Category Spec Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-zinc-500 font-medium mr-0.5">Quick spec template:</span>
                {SPEC_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        category: preset.category,
                        connectivity: preset.connectivity,
                        capacity_spec: preset.capacity_spec,
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-700">Product Name</label>
                  <input
                    type="text"
                    required
                    value={form.product_name || ''}
                    onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                    placeholder="e.g. Casio Edifice Slim Sapphire Steel Watch or Oraimo FreePods 4 ANC"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Brand</label>
                  <input
                    type="text"
                    required
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. Casio, Seiko, Oraimo, Anker, JBL"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Model Number / Name</label>
                  <input
                    type="text"
                    required
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. EFR-S108D-1AV or OTW-330"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as ProductCategory })
                    }
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] focus:outline-none focus:bg-white focus:border-zinc-950"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Color / Strap / Finish</label>
                  <input
                    type="text"
                    required
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="e.g. Black / Steel or Matte White"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Movement / Connectivity</label>
                  <input
                    type="text"
                    value={form.connectivity}
                    onChange={(e) => setForm({ ...form, connectivity: e.target.value })}
                    placeholder="e.g. Japanese Quartz or Bluetooth 5.3 · USB-C"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Case Size / Spec / Capacity</label>
                  <input
                    type="text"
                    value={form.capacity_spec}
                    onChange={(e) => setForm({ ...form, capacity_spec: e.target.value })}
                    placeholder="e.g. 40mm · 5ATM or 20,000mAh · 22.5W"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>
              </div>

              {/* Three-Tier Pricing Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Tag Price (৳)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.display_buying_price}
                    onChange={(e) =>
                      handleNumericFieldChange('display_buying_price', e.target.value)
                    }
                    placeholder="e.g. 2500"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3 font-mono-num text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-800">Real Cost (৳)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.real_buying_price}
                    onChange={(e) =>
                      handleNumericFieldChange('real_buying_price', e.target.value)
                    }
                    placeholder="e.g. 1400"
                    className="w-full min-h-[44px] rounded-xl bg-amber-50/50 border border-amber-300 px-3 font-mono-num text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-emerald-800">Offer Price (৳)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.min_selling_price}
                    onChange={(e) =>
                      handleNumericFieldChange('min_selling_price', e.target.value)
                    }
                    placeholder="e.g. 1950"
                    className="w-full min-h-[44px] rounded-xl bg-emerald-50/50 border border-emerald-300 px-3 font-mono-num text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">Stock Qty</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={numericDrafts.stock_count}
                    onChange={(e) => handleNumericFieldChange('stock_count', e.target.value)}
                    placeholder="1"
                    className="w-full min-h-[44px] rounded-xl bg-zinc-50 border border-zinc-300 px-3 font-mono-num text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                  />
                </div>
              </div>

              {/* Live Profit & Markup Helper Strip */}
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-mono-num">
                  <span
                    className={`font-semibold ${
                      draftProfit < 0
                        ? 'text-rose-600'
                        : draftProfit === 0
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    Profit: {draftProfit >= 0 ? '+' : ''}
                    {formatBDT(draftProfit)} ({draftMarginPct}%)
                  </span>
                  {draftDiscountPct > 0 && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span className="text-zinc-600">
                        Shows {draftDiscountPct}% off Tag
                      </span>
                    </>
                  )}
                </div>

                {draftCost > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500 text-[11px] mr-0.5">Auto price:</span>
                    {[25, 40, 60, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyMarkupPreset(pct)}
                        className="px-2 py-1 rounded-md bg-white border border-zinc-200 hover:border-zinc-400 font-mono-num text-[11px] font-semibold text-zinc-800 cursor-pointer"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">
                  Short Attractive Description
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Highlights visible features, strap/build style, finish, and key specs..."
                  className="w-full rounded-xl bg-zinc-50 border border-zinc-300 p-3 text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950"
                />
              </div>

              {saveError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700">
                  {saveError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[46px] rounded-xl bg-[#09090B] text-white font-semibold text-sm hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add to Inventory'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-[46px] px-5 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.section>
  );
}
