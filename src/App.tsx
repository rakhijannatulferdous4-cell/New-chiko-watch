import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ChikoLensView } from './components/ChikoLensModal';
import { DigitalMemoBuilder } from './components/DigitalMemoBuilder';
import { ShopChatbot } from './components/ShopChatbot';
import { WatchCard } from './components/WatchCard';
import { WatchDetailModal } from './components/WatchDetailModal';
import {
  createWatchRecord,
  deleteWatchRecord,
  fetchWatches,
  loadLocalMemos,
  saveMemoRecord,
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

const ADMIN_SESSION_KEY = 'new_chiko_admin_session_v1';

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

export default function App() {
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('catalog');
  const [selectedWatch, setSelectedWatch] = useState<WatchItem | null>(null);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
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
    let mounted = true;
    async function init() {
      const [{ watches: loaded }] = await Promise.all([fetchWatches()]);
      if (!mounted) return;
      setWatches(loaded);
      setSavedMemos(loadLocalMemos());

      try {
        const savedAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY);
        if (savedAdmin) {
          const parsed = JSON.parse(savedAdmin);
          if (parsed?.loggedIn) {
            setIsAdmin(true);
            setAdminUsername(parsed.username || 'admin');
          }
        }
      } catch {
        // ignore session parse errors
      }
      setLoading(false);
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

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

  const handleAdminSuccess = (username: string) => {
    setIsAdmin(true);
    setAdminUsername(username);
    setLoginOpen(false);
    setActiveTab('admin');
    try {
      sessionStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({ loggedIn: true, username })
      );
    } catch {
      // ignore
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setActiveTab('catalog');
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
  };

  const brands = useMemo(() => {
    const unique = Array.from(new Set(watches.map((w) => w.brand.trim()).filter(Boolean)));
    return ['All', ...unique.sort()];
  }, [watches]);

  const filteredWatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return watches.filter((w) => {
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
  }, [watches, searchQuery, brandFilter, categoryFilter, priceFilter, stockFilter]);

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
    const updated = await createWatchRecord(input, watches);
    setWatches(updated);
  };

  const handleUpdateWatch = async (id: string, patch: Partial<WatchFormInput>) => {
    const updated = await updateWatchRecord(id, patch, watches);
    setWatches(updated);
    if (selectedWatch?.id === id) {
      const refreshed = updated.find((w) => w.id === id) || null;
      setSelectedWatch(refreshed);
    }
  };

  const handleDeleteWatch = async (id: string) => {
    const updated = await deleteWatchRecord(id, watches);
    setWatches(updated);
    if (selectedWatch?.id === id) {
      setSelectedWatch(null);
    }
  };

  const handleAdjustStock = async (id: string, delta: number) => {
    const target = watches.find((w) => w.id === id);
    if (!target) return;
    const nextCount = Math.max(0, target.stock_count + delta);
    await handleUpdateWatch(id, { stock_count: nextCount });
  };

  const handleAddToMemo = (watch: WatchItem, agreedPrice?: number) => {
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
    const updated = await saveMemoRecord(memo, savedMemos);
    setSavedMemos(updated);
  };

  const handleNavClick = (tab: AppTab) => {
    if (tab === 'admin' && !isAdmin) {
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
    <div className="min-h-screen bg-[#0A0A0C] text-[#F8F9FA] flex flex-col">
      {/* Top Bar (Strict 3-Zone Contract, 54px compact height) */}
      <header className="sticky top-0 z-30 h-[54px] bg-[#0A0A0C]/90 backdrop-blur-xl border-b border-white/[0.08] no-print">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark (5 rapid taps opens Admin Login) */}
          <button
            type="button"
            onClick={handleLogoTap}
            className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#F8F9FA] hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0 select-none cursor-pointer"
          >
            New Chiko Watch
          </button>

          {/* Zone 2: Desktop Single-Line Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium"
            aria-label="Primary navigation"
          >
            <button
              type="button"
              onClick={() => handleNavClick('catalog')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'catalog'
                  ? 'text-[#D4AF37] border-b border-[#D4AF37]'
                  : 'text-[#A1A1AA] hover:text-[#F8F9FA]'
              }`}
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('lens')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'lens'
                  ? 'text-[#D4AF37] border-b border-[#D4AF37]'
                  : 'text-[#A1A1AA] hover:text-[#F8F9FA]'
              }`}
            >
              Chiko Lens
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('memo')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'memo'
                  ? 'text-[#D4AF37] border-b border-[#D4AF37]'
                  : 'text-[#A1A1AA] hover:text-[#F8F9FA]'
              }`}
            >
              Digital Memo
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === 'admin'
                    ? 'text-[#D4AF37] border-b border-[#D4AF37]'
                    : 'text-[#A1A1AA] hover:text-[#F8F9FA]'
                }`}
              >
                Inventory
              </button>
            )}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#D4AF37] text-[#0A0A0C] text-xs font-semibold hover:bg-[#E5C158] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ask Concierge
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-14 space-y-8">
        {activeTab === 'catalog' && (
          <>
            {/* Boutique Hero Showcase */}
            <section className="rounded-3xl bg-gradient-to-br from-[#141419] via-[#0F0F13] to-[#0A0A0C] border border-white/[0.08] overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-5">
                  <p className="text-xs tracking-[0.2em] uppercase text-[#D4AF37] font-medium">
                    Watches &amp; Electronics
                  </p>
                  <h1
                    className="font-display font-semibold text-[#F8F9FA] leading-[1.06] text-balance max-w-xl"
                    style={{ fontSize: 'clamp(2.15rem, 4vw, 3.5rem)' }}
                  >
                    Signature Timepieces &amp; Smart Electronics Under One Roof
                  </h1>
                  <p className="text-sm sm:text-base text-[#A1A1AA] max-w-lg leading-relaxed">
                    Discover authentic Analog &amp; Digital Watches, Smartwatches, TWS Earbuds, Power Banks, Chargers, and Speakers with transparent offer pricing, instant visual search, and multilingual support.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={scrollToCatalog}
                      className="min-h-[46px] px-6 rounded-xl bg-[#D4AF37] text-[#0A0A0C] font-semibold text-sm hover:bg-[#E5C158] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Explore Catalog
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('lens')}
                      className="min-h-[46px] px-5 rounded-xl border border-white/[0.14] text-sm font-medium text-[#F8F9FA] hover:bg-white/[0.06] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <ScanSearch size={16} className="text-[#D4AF37]" />
                      <span>Search by Photo</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5 relative min-h-[220px] sm:min-h-[280px] bg-gradient-to-br from-[#121216] via-[#0D0D11] to-[#0A0A0C] border-t lg:border-t-0 lg:border-l border-white/[0.06] flex flex-col items-center justify-center p-8 text-center">
                  <div
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 50% 45%, rgba(212, 175, 55, 0.2), transparent 65%)',
                    }}
                  />
                  <div className="relative flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-full border border-[#D4AF37]/35 bg-[#0A0A0C]/80 flex items-center justify-center shadow-2xl">
                      <Watch size={44} strokeWidth={1.35} className="text-[#D4AF37]" />
                    </div>
                    <p className="font-display text-lg text-[#F8F9FA] tracking-wide">
                      New Chiko Watch &amp; Electronics
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      Watches · Smartwatches · Earbuds · Power Banks · Gadgets
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Instant Search & Multi-Filter Toolbar */}
            <section id="catalog-collection" className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F8F9FA]">
                    Watches &amp; Electronics Collection
                  </h2>
                  <p className="text-xs text-[#9CA3AF] mt-0.5 font-mono-num">
                    Showing {filteredWatches.length} of {watches.length} products
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-72">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search watch, Casio, earbuds, charger..."
                      className="w-full min-h-[44px] rounded-xl bg-[#121216] border border-white/[0.12] pl-10 pr-3.5 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFiltersMobile((v) => !v)}
                    className="md:hidden min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#121216] border border-white/[0.12] text-[#F8F9FA] flex items-center justify-center gap-1.5 text-xs font-medium"
                    aria-label="Toggle filters"
                  >
                    <SlidersHorizontal size={16} className="text-[#D4AF37]" />
                    <span>Filter</span>
                  </button>
                </div>
              </div>

              {/* Filter Controls */}
              <div
                className={`${
                  showFiltersMobile ? 'grid' : 'hidden md:grid'
                } grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl bg-[#121216]/85 border border-white/[0.08] p-3.5`}
              >
                <div className="space-y-1">
                  <label className="text-[11px] text-[#9CA3AF]">Brand</label>
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl bg-[#0A0A0C] border border-white/[0.1] px-3 text-xs text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]"
                  >
                    {brands.map((b) => (
                      <option key={b} value={b}>
                        {b === 'All' ? 'All Brands' : b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[#9CA3AF]">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(e.target.value as 'All' | ProductCategory)
                    }
                    className="w-full min-h-[42px] rounded-xl bg-[#0A0A0C] border border-white/[0.1] px-3 text-xs text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]"
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
                  <label className="text-[11px] text-[#9CA3AF]">Price Range</label>
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value as PriceRangeFilter)}
                    className="w-full min-h-[42px] rounded-xl bg-[#0A0A0C] border border-white/[0.1] px-3 text-xs text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="all">All Prices</option>
                    <option value="under2000">Under ৳2,000</option>
                    <option value="2000to15000">৳2,000 – ৳15,000</option>
                    <option value="above15000">৳15,000+</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[#9CA3AF]">Stock Status</label>
                  <div className="flex gap-2">
                    <select
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                      className="flex-1 min-h-[42px] rounded-xl bg-[#0A0A0C] border border-white/[0.1] px-3 text-xs text-[#F8F9FA] focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="all">All Stock</option>
                      <option value="inStock">In Stock Only</option>
                      <option value="outOfStock">Out of Stock</option>
                    </select>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="min-h-[42px] px-3 rounded-xl border border-white/[0.12] text-xs text-[#D4AF37] hover:bg-white/[0.05] flex items-center gap-1 shrink-0 cursor-pointer"
                        title="Reset filters"
                      >
                        <RotateCcw size={13} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-80 rounded-2xl bg-[#121216] border border-white/[0.06] animate-pulse"
                    />
                  ))}
                </div>
              ) : watches.length === 0 ? (
                <div className="rounded-3xl bg-[#121216]/80 border border-white/[0.08] py-16 px-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                    <Watch size={28} strokeWidth={1.5} />
                  </div>
                  <p className="text-sm sm:text-base font-medium text-[#F8F9FA]">
                    No watches or electronics added yet. Tap Staff to add your first item.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleNavClick('admin')}
                    className="min-h-[44px] px-5 rounded-xl bg-[#D4AF37] text-[#0A0A0C] text-xs font-semibold hover:bg-[#E5C158] transition-colors cursor-pointer"
                  >
                    {isAdmin ? 'Open Inventory' : 'Staff Login'}
                  </button>
                </div>
              ) : filteredWatches.length === 0 ? (
                <div className="rounded-3xl bg-[#121216]/80 border border-white/[0.08] py-14 px-6 text-center space-y-3">
                  <Watch size={34} className="mx-auto text-[#D4AF37]/70" />
                  <h3 className="text-base font-semibold text-[#F8F9FA]">
                    No matching products found
                  </h3>
                  <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">
                    Try adjusting your brand, category, or price range filter, or ask our AI Concierge for a recommendation.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="min-h-[42px] px-4 rounded-xl bg-[#D4AF37] text-[#0A0A0C] text-xs font-semibold cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredWatches.map((watch) => (
                    <WatchCard
                      key={watch.id}
                      watch={watch}
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
          </>
        )}

        {activeTab === 'lens' && (
          <ChikoLensView watches={watches} onSelectWatch={setSelectedWatch} />
        )}

        {activeTab === 'memo' && (
          <DigitalMemoBuilder
            watches={watches}
            initialItems={draftMemoItems}
            savedMemos={savedMemos}
            onSaveMemo={handleSaveMemo}
            onClearDraftItems={clearDraftMemoItems}
          />
        )}

        {activeTab === 'admin' && isAdmin && (
          <AdminDashboard
            watches={watches}
            adminUsername={adminUsername}
            initialEditWatch={watchToEdit}
            onClearInitialEdit={() => setWatchToEdit(null)}
            onLogout={handleAdminLogout}
            onCreateWatch={handleCreateWatch}
            onUpdateWatch={handleUpdateWatch}
            onDeleteWatch={handleDeleteWatch}
            onAdjustStock={handleAdjustStock}
          />
        )}
      </main>

      {/* Quiet Boutique Footer */}
      <footer className="hidden md:block border-t border-white/[0.06] py-6 px-6 text-xs text-[#6B7280] no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span>© {new Date().getFullYear()} New Chiko Watch &amp; Electronics. All rights reserved.</span>
          <span>Tag prices are indicative retail anchors · Ask Concierge for best offer.</span>
        </div>
      </footer>

      {/* Floating Chiko Lens & AI Concierge Triggers */}
      <div className="fixed bottom-[74px] md:bottom-6 right-4 z-40 flex flex-col gap-2.5 no-print">
        {activeTab !== 'lens' && (
          <button
            type="button"
            onClick={() => setActiveTab('lens')}
            className="min-h-[48px] px-4 rounded-2xl bg-[#141418]/95 backdrop-blur-xl border border-[#D4AF37]/45 text-[#F8F9FA] shadow-xl shadow-black/60 flex items-center gap-2 hover:border-[#D4AF37] transition-all cursor-pointer"
            aria-label="Open Chiko Lens visual search"
          >
            <Camera size={18} className="text-[#D4AF37]" />
            <span className="text-xs font-semibold hidden sm:inline">Chiko Lens</span>
          </button>
        )}

        {!chatOpen && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="min-h-[48px] px-4 rounded-2xl bg-[#D4AF37] text-[#0A0A0C] shadow-xl shadow-black/60 flex items-center gap-2 hover:bg-[#E5C158] transition-all cursor-pointer"
            aria-label="Open Smart Shop Assistant"
          >
            <MessageSquare size={18} />
            <span className="text-xs font-semibold hidden sm:inline">Assistant</span>
          </button>
        )}
      </div>

      {/* Mobile-First Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] pb-safe bg-[#0A0A0C]/95 backdrop-blur-xl border-t border-white/[0.08] grid grid-cols-4 items-center no-print"
        aria-label="Mobile bottom navigation"
      >
        <button
          type="button"
          onClick={() => handleNavClick('catalog')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'catalog' ? 'text-[#D4AF37]' : 'text-[#9CA3AF]'
          }`}
        >
          <Watch size={20} />
          <span className="text-[10px] font-medium tracking-tight">Catalog</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('lens')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'lens' ? 'text-[#D4AF37]' : 'text-[#9CA3AF]'
          }`}
        >
          <ScanSearch size={20} />
          <span className="text-[10px] font-medium tracking-tight">Lens</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('memo')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'memo' ? 'text-[#D4AF37]' : 'text-[#9CA3AF]'
          }`}
        >
          <ReceiptText size={20} />
          <span className="text-[10px] font-medium tracking-tight">Memo</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('admin')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'admin'
              ? 'text-[#D4AF37]'
              : isAdmin
              ? 'text-emerald-400'
              : 'text-[#9CA3AF]'
          }`}
        >
          <ShieldCheck size={20} />
          <span className="text-[10px] font-medium tracking-tight">
            {isAdmin ? 'Admin' : 'Staff'}
          </span>
        </button>
      </nav>

      {/* Modals & Floating Chatbot */}
      {selectedWatch && (
        <WatchDetailModal
          watch={selectedWatch}
          isAdmin={isAdmin}
          onClose={() => setSelectedWatch(null)}
          onAddToMemo={handleAddToMemo}
        />
      )}

      {loginOpen && (
        <AdminLoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={handleAdminSuccess}
        />
      )}

      <ShopChatbot
        watches={watches}
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
