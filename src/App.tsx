import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  MessageSquare,
  ReceiptText,
  RotateCcw,
  ScanSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Watch,
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ChikoLensView } from './components/ChikoLensModal';
import { DigitalMemoBuilder } from './components/DigitalMemoBuilder';
import { HeroWatch3D } from './components/HeroWatch3D';
import { ShopChatbot } from './components/ShopChatbot';
import { WatchCard } from './components/WatchCard';
import { WatchDetailModal } from './components/WatchDetailModal';
import {
  ADMIN_SESSION_KEY,
  createWatchRecord,
  deleteWatchRecord,
  fetchAdminMemos,
  fetchWatches,
  loadLocalWatches,
  saveMemoRecord,
  syncLocalWatchesToCloud,
  updateWatchRecord,
} from './services/watchStore';
import {
  AppTab,
  DigitalMemo,
  MemoLineItem,
  ProductCategory,
  WatchFormInput,
  WatchItem,
} from './types/watch';

type PriceRangeFilter = 'all' | 'under2000' | '2000to15000' | 'above15000';
type StockFilter = 'all' | 'inStock' | 'outOfStock';

const STORE_CATEGORIES: ProductCategory[] = [
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

class StoreErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Unexpected application error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-zinc-200 p-6 text-center space-y-4 shadow-sm">
            <h1 className="font-display text-2xl font-semibold text-[#09090B]">
              New Chiko Watch &amp; Electronics
            </h1>
            <p className="text-sm text-zinc-600">
              We hit a temporary data sync issue. Please reload the page to continue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 rounded-xl bg-[#09090B] text-white text-sm font-semibold cursor-pointer"
            >
              Reload Store
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <StoreErrorBoundary>
      <MotionConfig reducedMotion="user">
        <StoreApp />
      </MotionConfig>
    </StoreErrorBoundary>
  );
}

function StoreApp() {
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('catalog');
  const [selectedWatch, setSelectedWatch] = useState<WatchItem | null>(null);

  // Admin & Storage state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminToken, setAdminToken] = useState('');
  const [storageSource, setStorageSource] = useState<'supabase' | 'server' | 'local'>('server');
  const [cloudNotice, setCloudNotice] = useState('');
  const [cloudError, setCloudError] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [watchToEdit, setWatchToEdit] = useState<WatchItem | null>(null);
  const logoTapsRef = useRef<number[]>([]);

  // Search & Multi-Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProductCategory>('All');
  const [priceFilter, setPriceFilter] = useState<PriceRangeFilter>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Digital Memo state
  const [savedMemos, setSavedMemos] = useState<DigitalMemo[]>([]);
  const [draftMemoItems, setDraftMemoItems] = useState<MemoLineItem[]>([]);

  // Chatbot drawer state
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function initStore() {
      let validToken = '';
      let validUsername = 'admin';
      try {
        const savedAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY);
        if (savedAdmin) {
          const parsed = JSON.parse(savedAdmin);
          if (parsed?.loggedIn && typeof parsed?.token === 'string' && parsed.token) {
            const verifyRes = await fetch('/api/admin/verify', {
              headers: { Authorization: `Bearer ${parsed.token}` },
            });
            if (verifyRes.ok) {
              validToken = parsed.token;
              validUsername = parsed.username || 'admin';
            } else {
              sessionStorage.removeItem(ADMIN_SESSION_KEY);
            }
          } else if (parsed?.loggedIn) {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
          }
        }
      } catch {
        // ignore session parse errors
      }

      if (!active) return;
      if (validToken) {
        setIsAdmin(true);
        setAdminUsername(validUsername);
        setAdminToken(validToken);
      }

      const result = await fetchWatches(validToken || undefined);
      if (!active) return;

      if (result.error) {
        setCloudError(result.error);
      }

      if (validToken) {
        const localItems = loadLocalWatches();
        if (!result.error && localItems.length > 0 && result.watches.length === 0) {
          const uploaded = await syncLocalWatchesToCloud(localItems, validToken);
          if (uploaded > 0 && active) {
            const refreshed = await fetchWatches(validToken);
            if (!active) return;
            setWatches(refreshed.watches);
            setStorageSource(refreshed.source);
            if (refreshed.error) setCloudError(refreshed.error);
            setCloudNotice(
              `Synced ${uploaded} local product(s) to the live store so everyone can see them.`
            );
          } else {
            setWatches(result.watches);
            setStorageSource(result.source);
          }
        } else {
          setWatches(result.watches);
          setStorageSource(result.source);
        }
        const memos = await fetchAdminMemos(validToken);
        if (active) setSavedMemos(memos);
      } else {
        setWatches(result.watches);
        setStorageSource(result.source);
      }

      setLoading(false);
    }

    void initStore();

    return () => {
      active = false;
    };
  }, []);

  const hydratedWatches = watches;

  // 5-Tap Rapid Gesture on header logo triggers Admin Login modal
  const handleLogoTap = () => {
    const now = Date.now();
    const recent = logoTapsRef.current.filter((t) => now - t < 2000);
    recent.push(now);
    logoTapsRef.current = recent;

    if (recent.length >= 5) {
      logoTapsRef.current = [];
      if (isAdmin) {
        setActiveTab('admin');
      } else {
        setLoginOpen(true);
      }
    } else {
      setActiveTab('catalog');
    }
  };

  const handleAdminSuccess = async (username: string, token: string) => {
    setIsAdmin(true);
    setAdminUsername(username);
    setAdminToken(token);
    setLoginOpen(false);
    setActiveTab('admin');
    setCloudError('');
    try {
      sessionStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({ loggedIn: true, username, token })
      );
    } catch {
      // ignore
    }

    try {
      const localItems = loadLocalWatches();
      let uploadedCount = 0;
      if (localItems.length > 0) {
        uploadedCount = await syncLocalWatchesToCloud(localItems, token);
      }
      const [refreshed, memos] = await Promise.all([
        fetchWatches(token),
        fetchAdminMemos(token),
      ]);
      setWatches(refreshed.watches);
      setStorageSource(refreshed.source);
      if (refreshed.error) {
        setCloudError(refreshed.error);
      }
      setSavedMemos(memos);
      if (uploadedCount > 0) {
        setCloudNotice(
          `Published ${uploadedCount} existing local product(s) so everyone can see them.`
        );
      }
    } catch (err) {
      console.warn('Admin hydration note:', err);
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminToken('');
    setSavedMemos([]);
    setDraftMemoItems([]);
    setCloudNotice('');
    setCloudError('');
    setActiveTab('catalog');
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    void fetchWatches().then((res) => {
      setWatches(res.watches);
      setStorageSource(res.source);
    });
  };

  const brands = useMemo(() => {
    const unique = Array.from(
      new Set(hydratedWatches.map((w) => w.brand.trim()).filter(Boolean))
    );
    return ['All', ...unique.sort()];
  }, [hydratedWatches]);

  const filteredWatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hydratedWatches.filter((w) => {
      if (q) {
        const hay =
          `${w.product_name ?? ''} ${w.brand} ${w.model} ${w.color} ${w.category} ${w.connectivity} ${w.capacity_spec} ${w.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (brandFilter !== 'All' && w.brand.toLowerCase() !== brandFilter.toLowerCase()) {
        return false;
      }
      if (categoryFilter !== 'All' && w.category !== categoryFilter) {
        return false;
      }
      if (priceFilter === 'under2000' && w.min_selling_price >= 2000) {
        return false;
      }
      if (
        priceFilter === '2000to15000' &&
        (w.min_selling_price < 2000 || w.min_selling_price > 15000)
      ) {
        return false;
      }
      if (priceFilter === 'above15000' && w.min_selling_price <= 15000) {
        return false;
      }
      if (stockFilter === 'inStock' && w.stock_count <= 0) {
        return false;
      }
      if (stockFilter === 'outOfStock' && w.stock_count > 0) {
        return false;
      }
      return true;
    });
  }, [hydratedWatches, searchQuery, brandFilter, categoryFilter, priceFilter, stockFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    brandFilter !== 'All' ||
    categoryFilter !== 'All' ||
    priceFilter !== 'all' ||
    stockFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setBrandFilter('All');
    setCategoryFilter('All');
    setPriceFilter('all');
    setStockFilter('all');
  };

  const handleCreateWatch = async (input: WatchFormInput) => {
    const { watches: updated, syncedToCloud, source } = await createWatchRecord(
      input,
      hydratedWatches,
      adminToken
    );
    setWatches(updated);
    setStorageSource(source);
    if (syncedToCloud) {
      setCloudError('');
      setCloudNotice('Product saved and published live — visible to everyone on any device.');
    } else {
      setCloudNotice('');
      setCloudError(
        'Could not reach Supabase or server storage — saved locally on this browser only.'
      );
    }
  };

  const handleUpdateWatch = async (id: string, patch: Partial<WatchFormInput>) => {
    const { watches: updated, syncedToCloud, source } = await updateWatchRecord(
      id,
      patch,
      hydratedWatches,
      adminToken
    );
    setWatches(updated);
    setStorageSource(source);
    if (syncedToCloud) {
      setCloudError('');
    }
    if (selectedWatch?.id === id) {
      const refreshed = updated.find((w) => w.id === id) || null;
      setSelectedWatch(refreshed);
    }
  };

  const handleDeleteWatch = async (id: string) => {
    const { watches: updated } = await deleteWatchRecord(
      id,
      hydratedWatches,
      adminToken
    );
    setWatches(updated);
    if (selectedWatch?.id === id) {
      setSelectedWatch(null);
    }
  };

  const handleAdjustStock = async (id: string, delta: number) => {
    const target = hydratedWatches.find((w) => w.id === id);
    if (!target) return;
    const nextCount = Math.max(0, target.stock_count + delta);
    await handleUpdateWatch(id, { stock_count: nextCount });
  };

  const handleAddToMemo = (watch: WatchItem, agreedPrice?: number) => {
    if (!isAdmin) {
      setLoginOpen(true);
      return;
    }
    setDraftMemoItems([
      {
        watchId: watch.id,
        brand: watch.brand,
        model: watch.model,
        color: watch.color,
        quantity: 1,
        unitPrice: agreedPrice ?? watch.min_selling_price,
        realCost: watch.real_buying_price,
      },
    ]);
    setActiveTab('memo');
  };

  const clearDraftMemoItems = useCallback(() => {
    setDraftMemoItems([]);
  }, []);

  const handleSaveMemo = async (memo: DigitalMemo) => {
    if (!isAdmin || !adminToken) {
      setLoginOpen(true);
      return;
    }
    const updated = await saveMemoRecord(memo, savedMemos, adminToken);
    setSavedMemos(updated);
  };

  const handleNavClick = (tab: AppTab) => {
    if ((tab === 'admin' || tab === 'memo') && !isAdmin) {
      setLoginOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const scrollToCatalog = () => {
    setActiveTab('catalog');
    const el = document.getElementById('catalog-collection');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] flex flex-col">
      {/* Top Bar (Strict 3-Zone Contract, 56px crisp white frosted bar) */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="sticky top-0 z-30 h-[56px] bg-white/95 backdrop-blur-md border-b border-zinc-200 no-print"
      >
        <div className="max-w-[1400px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark (5 rapid taps opens Admin Login) */}
          <motion.button
            type="button"
            onClick={handleLogoTap}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.94 }}
            className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#09090B] hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 select-none touch-manipulation cursor-pointer"
          >
            New Chiko Watch
          </motion.button>

          {/* Zone 2: Desktop Single-Line Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium"
            aria-label="Primary navigation"
          >
            <button
              type="button"
              onClick={() => handleNavClick('catalog')}
              className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'catalog'
                  ? 'text-[#09090B] font-semibold'
                  : 'text-zinc-500 hover:text-[#09090B]'
              }`}
            >
              Catalog
              {activeTab === 'catalog' && (
                <motion.span
                  layoutId="desktop-nav-underline"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#09090B] rounded-full"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('lens')}
              className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'lens'
                  ? 'text-[#09090B] font-semibold'
                  : 'text-zinc-500 hover:text-[#09090B]'
              }`}
            >
              Chiko Lens
              {activeTab === 'lens' && (
                <motion.span
                  layoutId="desktop-nav-underline"
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#09090B] rounded-full"
                />
              )}
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => handleNavClick('memo')}
                  className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeTab === 'memo'
                      ? 'text-[#09090B] font-semibold'
                      : 'text-zinc-500 hover:text-[#09090B]'
                  }`}
                >
                  Digital Memo
                  {activeTab === 'memo' && (
                    <motion.span
                      layoutId="desktop-nav-underline"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#09090B] rounded-full"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('admin')}
                  className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeTab === 'admin'
                      ? 'text-[#09090B] font-semibold'
                      : 'text-zinc-500 hover:text-[#09090B]'
                  }`}
                >
                  Inventory
                  {activeTab === 'admin' && (
                    <motion.span
                      layoutId="desktop-nav-underline"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#09090B] rounded-full"
                    />
                  )}
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <motion.button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="min-h-[38px] px-4 rounded-lg bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              Ask Concierge
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content Canvas */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-2.5 sm:px-6 pt-3 sm:pt-6 pb-24 md:pb-14 space-y-5">
        <AnimatePresence mode="wait">
          {activeTab === 'catalog' && (
            <motion.div
              key="tab-catalog"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="space-y-4 sm:space-y-6"
            >
              {/* Compact Editorial Black & White Marketplace Banner with Interactive 3D Chronometer */}
              <section className="rounded-xl sm:rounded-2xl bg-white border border-zinc-200 overflow-hidden shadow-xs">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                    className="lg:col-span-7 p-4 sm:p-8 flex flex-col justify-center space-y-2.5 sm:space-y-3.5"
                  >
                    <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-zinc-500 font-semibold">
                      Watches &amp; Electronics Marketplace
                    </p>
                    <h1
                      className="font-display font-bold text-[#09090B] leading-[1.08] text-balance max-w-2xl"
                      style={{ fontSize: 'clamp(1.5rem, 3.2vw, 3rem)' }}
                    >
                      Signature Timepieces &amp; Smart Electronics Under One Roof
                    </h1>
                    <p className="text-[11.5px] sm:text-sm text-zinc-600 max-w-xl leading-relaxed">
                      Discover authentic Analog &amp; Digital Watches, Smartwatches, TWS Earbuds, Power Banks, Chargers, and Speakers with transparent offer pricing and AI visual search.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 sm:pt-1">
                      <motion.button
                        type="button"
                        onClick={scrollToCatalog}
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                        className="min-h-[38px] sm:min-h-[42px] px-4 sm:px-5 rounded-xl bg-[#09090B] text-white font-semibold text-xs sm:text-sm hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                      >
                        Explore Catalog
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setActiveTab('lens')}
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                        className="min-h-[38px] sm:min-h-[42px] px-3.5 sm:px-4 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm font-medium text-zinc-900 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer"
                      >
                        <ScanSearch size={14} className="text-zinc-900" />
                        <span>Search by Photo</span>
                      </motion.button>
                    </div>
                  </motion.div>

                  <div className="lg:col-span-5 relative min-h-[165px] sm:min-h-[240px] bg-[#09090B] text-white flex flex-col items-center justify-center overflow-hidden">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.16),rgba(9,9,11,0)_68%)]"
                    />
                    <HeroWatch3D />
                    <div className="pointer-events-none pb-2.5 text-center">
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 tracking-wide">
                        Drag to rotate · Watches · Smartwatches · Earbuds · Gadgets
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Instant Search, Category Tabs & Multi-Filter Toolbar */}
              <section id="catalog-collection" className="space-y-2.5 sm:space-y-3.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
                  <div>
                    <h2 className="font-display text-xl sm:text-3xl font-bold text-[#09090B]">
                      Store Collection
                    </h2>
                    <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5 font-mono-num">
                      Showing {filteredWatches.length} of {hydratedWatches.length} products
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search watch, Casio, earbuds, charger..."
                        className="w-full min-h-[38px] sm:min-h-[42px] rounded-xl bg-white border border-zinc-300 pl-9 pr-3 text-xs sm:text-sm text-[#09090B] placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFiltersMobile((v) => !v)}
                      className={`md:hidden min-h-[38px] min-w-[44px] px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                        showFiltersMobile
                          ? 'bg-[#09090B] border-[#09090B] text-white'
                          : 'bg-white border-zinc-300 text-zinc-900'
                      }`}
                      aria-label="Toggle filters"
                    >
                      <SlidersHorizontal size={14} />
                      <span>Filter</span>
                    </button>
                  </div>
                </div>

                {/* Daraz/Alibaba-inspired Horizontal Category Quick Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <motion.button
                    type="button"
                    onClick={() => setCategoryFilter('All')}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                    className={`relative min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      categoryFilter === 'All'
                        ? 'text-white'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {categoryFilter === 'All' && (
                      <motion.span
                        layoutId="category-active-bg"
                        transition={{ type: 'spring', stiffness: 420, damping: 25 }}
                        className="absolute inset-0 rounded-lg bg-[#09090B] shadow-xs"
                      />
                    )}
                    <span className="relative z-10">All Items</span>
                  </motion.button>
                  {STORE_CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                      className={`relative min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        categoryFilter === cat
                          ? 'text-white'
                          : 'bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      {categoryFilter === cat && (
                        <motion.span
                          layoutId="category-active-bg"
                          transition={{ type: 'spring', stiffness: 420, damping: 25 }}
                          className="absolute inset-0 rounded-lg bg-[#09090B] shadow-xs"
                        />
                      )}
                      <span className="relative z-10">{cat}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Animated Mobile Filter Drawer */}
                <AnimatePresence initial={false}>
                  {showFiltersMobile && (
                    <motion.div
                      key="mobile-filters"
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="md:hidden grid grid-cols-2 gap-2.5 rounded-xl bg-white border border-zinc-200 p-2.5 shadow-xs"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-zinc-500">Brand</label>
                        <select
                          value={brandFilter}
                          onChange={(e) => setBrandFilter(e.target.value)}
                          className="w-full min-h-[36px] rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 text-[11px] text-[#09090B] focus:outline-none focus:border-zinc-950"
                        >
                          {brands.map((b) => (
                            <option key={b} value={b}>
                              {b === 'All' ? 'All Brands' : b}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-zinc-500">Category</label>
                        <select
                          value={categoryFilter}
                          onChange={(e) =>
                            setCategoryFilter(e.target.value as 'All' | ProductCategory)
                          }
                          className="w-full min-h-[36px] rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 text-[11px] text-[#09090B] focus:outline-none focus:border-zinc-950"
                        >
                          <option value="All">All Categories</option>
                          {STORE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-zinc-500">Price Range</label>
                        <select
                          value={priceFilter}
                          onChange={(e) => setPriceFilter(e.target.value as PriceRangeFilter)}
                          className="w-full min-h-[36px] rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 text-[11px] text-[#09090B] focus:outline-none focus:border-zinc-950"
                        >
                          <option value="all">All Prices</option>
                          <option value="under2000">Under ৳2,000</option>
                          <option value="2000to15000">৳2,000 – ৳15,000</option>
                          <option value="above15000">৳15,000+</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-zinc-500">Stock Status</label>
                        <div className="flex gap-1.5">
                          <select
                            value={stockFilter}
                            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                            className="flex-1 min-h-[36px] rounded-lg bg-zinc-50 border border-zinc-200 px-2 text-[11px] text-[#09090B] focus:outline-none focus:border-zinc-950"
                          >
                            <option value="all">All Stock</option>
                            <option value="inStock">In Stock</option>
                            <option value="outOfStock">Out of Stock</option>
                          </select>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="min-h-[36px] px-2 rounded-lg border border-zinc-300 bg-white text-[11px] font-medium text-zinc-900 active:scale-95 transition-transform flex items-center justify-center shrink-0 cursor-pointer"
                              title="Reset filters"
                              aria-label="Reset filters"
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Desktop Filter Controls */}
                <div className="hidden md:grid grid-cols-4 gap-3 rounded-xl bg-white border border-zinc-200 p-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-500">Brand</label>
                    <select
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                    >
                      {brands.map((b) => (
                        <option key={b} value={b}>
                          {b === 'All' ? 'All Brands' : b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-500">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) =>
                        setCategoryFilter(e.target.value as 'All' | ProductCategory)
                      }
                      className="w-full min-h-[40px] rounded-lg bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                    >
                      <option value="All">All Categories</option>
                      {STORE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-500">Price Range</label>
                    <select
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value as PriceRangeFilter)}
                      className="w-full min-h-[40px] rounded-lg bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                    >
                      <option value="all">All Prices</option>
                      <option value="under2000">Under ৳2,000</option>
                      <option value="2000to15000">৳2,000 – ৳15,000</option>
                      <option value="above15000">৳15,000+</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-500">Stock Status</label>
                    <div className="flex gap-2">
                      <select
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                        className="flex-1 min-h-[40px] rounded-lg bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                      >
                        <option value="all">All Stock</option>
                        <option value="inStock">In Stock Only</option>
                        <option value="outOfStock">Out of Stock</option>
                      </select>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="min-h-[40px] px-3 rounded-lg border border-zinc-300 bg-white text-xs font-medium text-zinc-900 hover:bg-zinc-50 flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
                          title="Reset filters"
                        >
                          <RotateCcw size={13} />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Multi-Column Marketplace Product Grid (2 cols mobile, 3-5 cols desktop) */}
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <div
                        key={n}
                        className="h-56 sm:h-64 rounded-xl bg-white border border-zinc-200 animate-pulse"
                      />
                    ))}
                  </div>
                ) : hydratedWatches.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-zinc-200 py-14 px-6 text-center space-y-4 shadow-xs">
                    <div className="w-14 h-14 mx-auto rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
                      <Watch size={26} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-[#09090B]">
                      No watches or electronics added yet. Tap Staff to add your first item.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavClick('admin')}
                      className="min-h-[44px] px-5 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {isAdmin ? 'Open Inventory' : 'Staff Login'}
                    </button>
                  </div>
                ) : filteredWatches.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-zinc-200 py-12 px-6 text-center space-y-3 shadow-xs">
                    <Watch size={32} className="mx-auto text-zinc-400" />
                    <h3 className="text-base font-semibold text-[#09090B]">
                      No matching products found
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Try adjusting your brand, category, or price range filter, or ask our Concierge for a recommendation.
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="min-h-[40px] px-4 rounded-xl bg-[#09090B] text-white text-xs font-semibold active:scale-95 transition-transform cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    key={`${categoryFilter}-${brandFilter}-${priceFilter}-${stockFilter}`}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5"
                  >
                    {filteredWatches.map((watch, idx) => (
                      <WatchCard
                        key={watch.id}
                        watch={watch}
                        index={idx}
                        isAdmin={isAdmin}
                        onSelect={setSelectedWatch}
                        onAdjustStock={handleAdjustStock}
                        onEdit={(w) => {
                          setWatchToEdit(w);
                          setActiveTab('admin');
                        }}
                        onDelete={handleDeleteWatch}
                      />
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'lens' && (
            <motion.div
              key="tab-lens"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 290, damping: 25 }}
            >
              <ChikoLensView watches={hydratedWatches} onSelectWatch={setSelectedWatch} />
            </motion.div>
          )}

          {activeTab === 'memo' && isAdmin && (
            <motion.div
              key="tab-memo"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 290, damping: 25 }}
            >
              <DigitalMemoBuilder
                watches={hydratedWatches}
                initialItems={draftMemoItems}
                savedMemos={savedMemos}
                onSaveMemo={handleSaveMemo}
                onClearDraftItems={clearDraftMemoItems}
              />
            </motion.div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <motion.div
              key="tab-admin"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 290, damping: 25 }}
            >
              <AdminDashboard
                watches={hydratedWatches}
                adminUsername={adminUsername}
                storageSource={storageSource}
                cloudNotice={cloudNotice}
                cloudError={cloudError}
                initialEditWatch={watchToEdit}
                onClearInitialEdit={() => setWatchToEdit(null)}
                onLogout={handleAdminLogout}
                onCreateWatch={handleCreateWatch}
                onUpdateWatch={handleUpdateWatch}
                onDeleteWatch={handleDeleteWatch}
                onAdjustStock={handleAdjustStock}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quiet Boutique Footer */}
      <footer className="hidden md:block border-t border-zinc-200 bg-white py-5 px-6 text-xs text-zinc-500 no-print">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <span>© {new Date().getFullYear()} New Chiko Watch &amp; Electronics. All rights reserved.</span>
          <span>Tag prices are indicative retail anchors · Ask Concierge for best offer.</span>
        </div>
      </footer>

      {/* Floating Chiko Lens & AI Concierge Triggers */}
      <div className="fixed bottom-[70px] md:bottom-6 right-3.5 sm:right-4 z-40 flex flex-col gap-2 no-print">
        <AnimatePresence>
          {activeTab !== 'lens' && (
            <motion.button
              key="fab-lens"
              type="button"
              initial={{ opacity: 0, scale: 0.88, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 6 }}
              transition={{ duration: 0.18 }}
              onClick={() => setActiveTab('lens')}
              className="min-h-[42px] px-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-zinc-300 text-[#09090B] shadow-lg flex items-center gap-2 hover:border-zinc-950 transition-all active:scale-95 cursor-pointer"
              aria-label="Open Chiko Lens visual search"
            >
              <Camera size={16} className="text-[#09090B]" />
              <span className="text-xs font-semibold hidden sm:inline">Chiko Lens</span>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!chatOpen && (
            <motion.button
              key="fab-chat"
              type="button"
              initial={{ opacity: 0, scale: 0.88, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 6 }}
              transition={{ duration: 0.18 }}
              onClick={() => setChatOpen(true)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#09090B] text-white shadow-lg flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
              aria-label="Open Smart Shop Assistant"
            >
              <MessageSquare size={16} />
              <span className="text-xs font-semibold hidden sm:inline">Assistant</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile-First Bottom Navigation Bar */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 h-[58px] pb-safe bg-white/95 backdrop-blur-md border-t border-zinc-200 grid ${
          isAdmin ? 'grid-cols-4' : 'grid-cols-3'
        } items-center no-print`}
        aria-label="Mobile bottom navigation"
      >
        <motion.button
          type="button"
          onClick={() => handleNavClick('catalog')}
          whileTap={{ scale: 0.86 }}
          transition={{ type: 'spring', stiffness: 460, damping: 22 }}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'catalog' ? 'text-[#09090B] font-semibold' : 'text-zinc-500'
          }`}
        >
          {activeTab === 'catalog' && (
            <motion.span
              layoutId="mobile-nav-indicator"
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="absolute top-0 left-1/5 right-1/5 h-[3px] bg-[#09090B] rounded-b-full"
            />
          )}
          <Watch
            size={18}
            className={`transition-transform duration-200 ${
              activeTab === 'catalog' ? 'scale-120 -translate-y-0.5' : 'scale-100'
            }`}
          />
          <span className="text-[10px] tracking-tight">Catalog</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => handleNavClick('lens')}
          whileTap={{ scale: 0.86 }}
          transition={{ type: 'spring', stiffness: 460, damping: 22 }}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'lens' ? 'text-[#09090B] font-semibold' : 'text-zinc-500'
          }`}
        >
          {activeTab === 'lens' && (
            <motion.span
              layoutId="mobile-nav-indicator"
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="absolute top-0 left-1/5 right-1/5 h-[3px] bg-[#09090B] rounded-b-full"
            />
          )}
          <ScanSearch
            size={18}
            className={`transition-transform duration-200 ${
              activeTab === 'lens' ? 'scale-120 -translate-y-0.5' : 'scale-100'
            }`}
          />
          <span className="text-[10px] tracking-tight">Lens</span>
        </motion.button>

        {isAdmin && (
          <motion.button
            type="button"
            onClick={() => handleNavClick('memo')}
            whileTap={{ scale: 0.86 }}
            transition={{ type: 'spring', stiffness: 460, damping: 22 }}
            className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'memo' ? 'text-[#09090B] font-semibold' : 'text-zinc-500'
            }`}
          >
            {activeTab === 'memo' && (
              <motion.span
                layoutId="mobile-nav-indicator"
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                className="absolute top-0 left-1/5 right-1/5 h-[3px] bg-[#09090B] rounded-b-full"
              />
            )}
            <ReceiptText
              size={18}
              className={`transition-transform duration-200 ${
                activeTab === 'memo' ? 'scale-120 -translate-y-0.5' : 'scale-100'
              }`}
            />
            <span className="text-[10px] tracking-tight">Memo</span>
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={() => handleNavClick('admin')}
          whileTap={{ scale: 0.86 }}
          transition={{ type: 'spring', stiffness: 460, damping: 22 }}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'admin'
              ? 'text-[#09090B] font-semibold'
              : isAdmin
              ? 'text-emerald-700 font-medium'
              : 'text-zinc-500'
          }`}
        >
          {activeTab === 'admin' && (
            <motion.span
              layoutId="mobile-nav-indicator"
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="absolute top-0 left-1/5 right-1/5 h-[3px] bg-[#09090B] rounded-b-full"
            />
          )}
          <ShieldCheck
            size={18}
            className={`transition-transform duration-200 ${
              activeTab === 'admin' ? 'scale-120 -translate-y-0.5' : 'scale-100'
            }`}
          />
          <span className="text-[10px] tracking-tight">
            {isAdmin ? 'Admin' : 'Staff'}
          </span>
        </motion.button>
      </nav>

      {/* Modals & Floating Chatbot */}
      <AnimatePresence>
        {selectedWatch && (
          <WatchDetailModal
            key={selectedWatch.id}
            watch={selectedWatch}
            isAdmin={isAdmin}
            onClose={() => setSelectedWatch(null)}
            onAddToMemo={handleAddToMemo}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loginOpen && (
          <AdminLoginModal
            key="admin-login-modal"
            onClose={() => setLoginOpen(false)}
            onSuccess={handleAdminSuccess}
          />
        )}
      </AnimatePresence>

      <ShopChatbot
        watches={hydratedWatches}
        isOpen={chatOpen}
        onToggle={setChatOpen}
        onSelectWatch={(w) => {
          setChatOpen(false);
          setSelectedWatch(w);
        }}
      />
    </div>
  );
}
