import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Camera,
  Heart,
  Lock,
  MessageSquare,
  ReceiptText,
  RotateCcw,
  Scale,
  ScanSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  User,
  Volume2,
  VolumeX,
  Watch,
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig, useScroll, useSpring } from 'motion/react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { ChikoLensView } from './components/ChikoLensModal';
import { CustomerAccountModal } from './components/CustomerAccountModal';
import { DigitalMemoBuilder } from './components/DigitalMemoBuilder';
import { HeroWatch3D } from './components/HeroWatch3D';
import { ProductCompareModal } from './components/ProductCompareModal';
import { ShopChatbot } from './components/ShopChatbot';
import { StorefrontAmbientCanvas } from './components/StorefrontAmbientCanvas';
import { WatchCard } from './components/WatchCard';
import { WatchDetailModal } from './components/WatchDetailModal';
import {
  CustomerSessionData,
  fetchAdminCustomerMessages,
  fetchAdminPinResets,
  fetchCustomerSession,
} from './services/customerStore';
import {
  DEFAULT_PAYMENT_SETTINGS,
  fetchAdminOrders,
  fetchStorePaymentSettings,
  loadCachedPaymentSettings,
  loadLocalCart,
  saveLocalCart,
} from './services/orderStore';
import {
  ADMIN_SESSION_KEY,
  createWatchRecord,
  deleteMemoRecord,
  deleteWatchRecord,
  fetchAdminMemos,
  fetchWatches,
  loadLocalWatches,
  saveMemoRecord,
  syncLocalWatchesToCloud,
  updateWatchRecord,
} from './services/watchStore';
import { prewarmProductMotionOnline } from './services/cinemaMotionEngine';
import {
  attachGlobalAestheticTapSounds,
  isGlobalSoundMuted,
  playOrderAlertChime,
  playUiSound,
  setGlobalSoundMuted,
  subscribeSoundMute,
} from './services/uiSoundEngine';
import {
  AppTab,
  CartItem,
  CustomerMessage,
  CustomerOrder,
  DeliveryZone,
  DigitalMemo,
  MemoLineItem,
  PinResetRequest,
  ProductCategory,
  StorePaymentSettings,
  WatchFormInput,
  WatchItem,
} from './types/watch';

type PriceRangeFilter = 'all' | 'under2000' | '2000to15000' | 'above15000';
type StockFilter = 'all' | 'inStock' | 'outOfStock';
type CatalogSortOption = 'featured' | 'priceAsc' | 'priceDesc' | 'discountDesc';

const SAVED_SHORTLIST_KEY = 'new_chiko_saved_shortlist_v1';

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
  const [sortBy, setSortBy] = useState<CatalogSortOption>('featured');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Subtle customer shortlist & comparison state (invisible until user saves an item)
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_SHORTLIST_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Digital Memo state
  const [savedMemos, setSavedMemos] = useState<DigitalMemo[]>([]);
  const [draftMemoItems, setDraftMemoItems] = useState<MemoLineItem[]>([]);

  // E-Commerce Cart, Checkout, Payment Settings & Live Admin Orders state
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadLocalCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone>('inside_city');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);
  const [checkoutIsBuyNow, setCheckoutIsBuyNow] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<StorePaymentSettings>(() =>
    loadCachedPaymentSettings() || DEFAULT_PAYMENT_SETTINGS
  );
  const [adminOrders, setAdminOrders] = useState<CustomerOrder[]>([]);
  const [adminMessages, setAdminMessages] = useState<CustomerMessage[]>([]);
  const [adminPinResets, setAdminPinResets] = useState<PinResetRequest[]>([]);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const ordersInitializedRef = useRef(false);
  const knownCustomerMsgIdsRef = useRef<Set<string>>(new Set());
  const messagesInitializedRef = useRef(false);
  const knownPinResetIdsRef = useRef<Set<string>>(new Set());

  // Customer Account / ID Portal state + Account-Required Checkout Gate
  const [customerSession, setCustomerSession] = useState<CustomerSessionData | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [checkoutGateNotice, setCheckoutGateNotice] = useState('');
  const pendingCheckoutRef = useRef<{ items: CartItem[]; isBuyNow: boolean } | null>(null);

  // Chatbot drawer state
  const [chatOpen, setChatOpen] = useState(false);

  // Global aesthetic UI & product sound state
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isGlobalSoundMuted());

  useEffect(() => {
    saveLocalCart(cartItems);
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_SHORTLIST_KEY, JSON.stringify(savedIds));
    } catch {
      // ignore storage quota errors
    }
  }, [savedIds]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 420);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleSaveWatch = useCallback((id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-11), id]
    );
  }, []);

  useEffect(() => {
    const detachSounds = attachGlobalAestheticTapSounds();
    const unsubMute = subscribeSoundMute((nextMuted) => setSoundMuted(nextMuted));
    return () => {
      detachSounds();
      unsubMute();
    };
  }, []);

  // GPU-accelerated storefront scroll progress indicator
  const { scrollYProgress } = useScroll();
  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 32,
    restDelta: 0.001,
  });

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
        const [memos, loadedSettings, loadedOrders, loadedMessages, loadedPinResets, custSession] =
          await Promise.all([
            fetchAdminMemos(validToken),
            fetchStorePaymentSettings(validToken),
            fetchAdminOrders(validToken),
            fetchAdminCustomerMessages(validToken),
            fetchAdminPinResets(validToken),
            fetchCustomerSession(),
          ]);
        if (active) {
          setSavedMemos(memos);
          setPaymentSettings(loadedSettings.settings);
          setAdminOrders(loadedOrders);
          setAdminMessages(loadedMessages);
          setAdminPinResets(loadedPinResets);
          setCustomerSession(custSession);
          knownOrderIdsRef.current = new Set(loadedOrders.map((o) => o.id));
          ordersInitializedRef.current = true;
          knownCustomerMsgIdsRef.current = new Set(
            loadedMessages.filter((m) => m.sender === 'customer').map((m) => m.id)
          );
          knownPinResetIdsRef.current = new Set(loadedPinResets.map((r) => r.id));
          messagesInitializedRef.current = true;
        }
      } else {
        setWatches(result.watches);
        setStorageSource(result.source);
        const [publicSettings, custSession] = await Promise.all([
          fetchStorePaymentSettings(),
          fetchCustomerSession(),
        ]);
        if (active) {
          setPaymentSettings(publicSettings.settings);
          setCustomerSession(custSession);
        }
      }

      setLoading(false);
    }

    void initStore();

    return () => {
      active = false;
    };
  }, []);

  // Poll for live customer order updates & Admin messages when logged in as customer
  useEffect(() => {
    if (!customerSession?.token) return;
    let cancelled = false;
    const pollCustomer = async () => {
      const fresh = await fetchCustomerSession(customerSession.token);
      if (!cancelled && fresh) {
        setCustomerSession(fresh);
      }
    };
    const timer = window.setInterval(() => {
      void pollCustomer();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [customerSession?.token]);

  // Poll for live incoming orders, customer messages & PIN reset requests while Admin Mode is active
  useEffect(() => {
    if (!isAdmin || !adminToken) return;
    let cancelled = false;

    const pollAdminData = async () => {
      const [latestOrders, latestMessages, latestPinResets] = await Promise.all([
        fetchAdminOrders(adminToken),
        fetchAdminCustomerMessages(adminToken),
        fetchAdminPinResets(adminToken),
      ]);
      if (cancelled) return;
      let shouldChime = false;
      if (ordersInitializedRef.current) {
        if (latestOrders.some((o) => !knownOrderIdsRef.current.has(o.id))) {
          shouldChime = true;
        }
      }
      if (messagesInitializedRef.current) {
        if (
          latestMessages.some(
            (m) =>
              m.sender === 'customer' &&
              !m.read_by_admin &&
              !knownCustomerMsgIdsRef.current.has(m.id)
          ) ||
          latestPinResets.some((r) => !knownPinResetIdsRef.current.has(r.id))
        ) {
          shouldChime = true;
        }
      }
      if (shouldChime) {
        playOrderAlertChime();
      }
      knownOrderIdsRef.current = new Set(latestOrders.map((o) => o.id));
      ordersInitializedRef.current = true;
      knownCustomerMsgIdsRef.current = new Set(
        latestMessages.filter((m) => m.sender === 'customer').map((m) => m.id)
      );
      knownPinResetIdsRef.current = new Set(latestPinResets.map((r) => r.id));
      messagesInitializedRef.current = true;
      setAdminOrders(latestOrders);
      setAdminMessages(latestMessages);
      setAdminPinResets(latestPinResets);
    };

    const timer = window.setInterval(() => {
      void pollAdminData();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAdmin, adminToken]);

  const hydratedWatches = watches;

  // Secret Triple-Tap Rapid Gesture on header logo triggers Admin Login modal
  const handleLogoTap = () => {
    const now = Date.now();
    const recent = logoTapsRef.current.filter((t) => now - t < 1600);
    recent.push(now);
    logoTapsRef.current = recent;

    if (recent.length >= 3) {
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
      const [refreshed, memos, loadedSettings, loadedOrders, loadedMessages, loadedPinResets] =
        await Promise.all([
          fetchWatches(token),
          fetchAdminMemos(token),
          fetchStorePaymentSettings(token),
          fetchAdminOrders(token),
          fetchAdminCustomerMessages(token),
          fetchAdminPinResets(token),
        ]);
      setWatches(refreshed.watches);
      setStorageSource(refreshed.source);
      if (refreshed.error) {
        setCloudError(refreshed.error);
      }
      setSavedMemos(memos);
      setPaymentSettings(loadedSettings.settings);
      setAdminOrders(loadedOrders);
      setAdminMessages(loadedMessages);
      setAdminPinResets(loadedPinResets);
      knownOrderIdsRef.current = new Set(loadedOrders.map((o) => o.id));
      ordersInitializedRef.current = true;
      knownCustomerMsgIdsRef.current = new Set(
        loadedMessages.filter((m) => m.sender === 'customer').map((m) => m.id)
      );
      knownPinResetIdsRef.current = new Set(loadedPinResets.map((r) => r.id));
      messagesInitializedRef.current = true;
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
    setAdminOrders([]);
    setAdminMessages([]);
    setAdminPinResets([]);
    ordersInitializedRef.current = false;
    knownOrderIdsRef.current = new Set();
    messagesInitializedRef.current = false;
    knownCustomerMsgIdsRef.current = new Set();
    knownPinResetIdsRef.current = new Set();
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
    void fetchStorePaymentSettings().then((res) => {
      setPaymentSettings(res.settings);
    });
  };

  const brands = useMemo(() => {
    const unique = Array.from(
      new Set(hydratedWatches.map((w) => w.brand.trim()).filter(Boolean))
    );
    return ['All', ...unique.sort()];
  }, [hydratedWatches]);

  const savedWatches = useMemo(
    () => hydratedWatches.filter((w) => savedIds.includes(w.id)),
    [hydratedWatches, savedIds]
  );

  useEffect(() => {
    if (savedWatches.length === 0 && showSavedOnly) {
      setShowSavedOnly(false);
    }
  }, [savedWatches.length, showSavedOnly]);

  const filteredWatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = hydratedWatches.filter((w) => {
      if (showSavedOnly && !savedIds.includes(w.id)) {
        return false;
      }
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

    if (sortBy === 'priceAsc') {
      return [...list].sort((a, b) => a.min_selling_price - b.min_selling_price);
    }
    if (sortBy === 'priceDesc') {
      return [...list].sort((a, b) => b.min_selling_price - a.min_selling_price);
    }
    if (sortBy === 'discountDesc') {
      const pct = (w: WatchItem) =>
        w.display_buying_price > 0
          ? (w.display_buying_price - w.min_selling_price) / w.display_buying_price
          : 0;
      return [...list].sort((a, b) => pct(b) - pct(a));
    }
    return list;
  }, [
    hydratedWatches,
    searchQuery,
    brandFilter,
    categoryFilter,
    priceFilter,
    stockFilter,
    sortBy,
    showSavedOnly,
    savedIds,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    brandFilter !== 'All' ||
    categoryFilter !== 'All' ||
    priceFilter !== 'all' ||
    stockFilter !== 'all' ||
    sortBy !== 'featured' ||
    showSavedOnly;

  const resetFilters = () => {
    setSearchQuery('');
    setBrandFilter('All');
    setCategoryFilter('All');
    setPriceFilter('all');
    setStockFilter('all');
    setSortBy('featured');
    setShowSavedOnly(false);
  };

  const handleCreateWatch = async (input: WatchFormInput) => {
    const prevIds = new Set(hydratedWatches.map((w) => w.id));
    const { watches: updated, syncedToCloud, source } = await createWatchRecord(
      input,
      hydratedWatches,
      adminToken
    );
    setWatches(updated);
    setStorageSource(source);
    const createdWatch = updated.find((w) => !prevIds.has(w.id)) || updated[0];
    if (createdWatch) {
      // Automatically search online and build custom product animation profile for newly added items
      void prewarmProductMotionOnline(createdWatch);
    }
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
    const refreshed = updated.find((w) => w.id === id) || null;
    if (refreshed) {
      void prewarmProductMotionOnline(refreshed);
    }
    if (selectedWatch?.id === id) {
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

  const handleDeleteMemo = async (id: string) => {
    if (!isAdmin || !adminToken) {
      setLoginOpen(true);
      return;
    }
    const updated = await deleteMemoRecord(id, savedMemos, adminToken);
    setSavedMemos(updated);
  };

  // E-Commerce Cart & Checkout handlers
  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const pendingOrdersCount = useMemo(
    () => adminOrders.filter((o) => o.status === 'Pending').length,
    [adminOrders]
  );

  const unreadAdminMessagesCount = useMemo(
    () => adminMessages.filter((m) => m.sender === 'customer' && !m.read_by_admin).length,
    [adminMessages]
  );

  const adminTotalAlerts = pendingOrdersCount + unreadAdminMessagesCount + adminPinResets.length;

  const unreadCustomerMessagesCount = useMemo(
    () =>
      (customerSession?.messages || []).filter(
        (m) => m.sender === 'admin' && !m.read_by_customer
      ).length,
    [customerSession?.messages]
  );

  const handleAddToCart = useCallback((watch: WatchItem) => {
    if (watch.stock_count <= 0) return;
    setCartItems((prev) => {
      const existing = prev.find((i) => i.watchId === watch.id);
      if (existing) {
        return prev.map((i) =>
          i.watchId === watch.id
            ? {
                ...i,
                maxStock: Math.max(1, watch.stock_count),
                unitPrice: watch.min_selling_price,
                quantity: Math.min(Math.max(1, watch.stock_count), i.quantity + 1),
              }
            : i
        );
      }
      return [
        ...prev,
        {
          watchId: watch.id,
          product_name: watch.product_name,
          brand: watch.brand,
          model: watch.model,
          color: watch.color,
          image_url: watch.image_url,
          unitPrice: watch.min_selling_price,
          maxStock: Math.max(1, watch.stock_count),
          quantity: 1,
        },
      ];
    });
  }, []);

  const handleUpdateCartQty = useCallback((watchId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.watchId !== watchId) return item;
          const nextQty = Math.min(item.maxStock, item.quantity + delta);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const handleRemoveCartItem = useCallback((watchId: string) => {
    setCartItems((prev) => prev.filter((item) => item.watchId !== watchId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const handleBuyNow = useCallback(
    (watch: WatchItem) => {
      if (watch.stock_count <= 0) return;
      const singleItem: CartItem = {
        watchId: watch.id,
        product_name: watch.product_name,
        brand: watch.brand,
        model: watch.model,
        color: watch.color,
        image_url: watch.image_url,
        unitPrice: watch.min_selling_price,
        maxStock: Math.max(1, watch.stock_count),
        quantity: 1,
      };
      setCartOpen(false);
      if (!customerSession) {
        pendingCheckoutRef.current = { items: [singleItem], isBuyNow: true };
        setCheckoutGateNotice(
          'Order place korar age apnar Customer Account create ba Sign In korun — login korlei direct checkout e niye jabe!'
        );
        setCustomerModalOpen(true);
        return;
      }
      setCheckoutItems([singleItem]);
      setCheckoutIsBuyNow(true);
      setCheckoutOpen(true);
    },
    [customerSession]
  );

  const handleProceedToCheckout = useCallback(() => {
    if (cartItems.length === 0) return;
    setCartOpen(false);
    if (!customerSession) {
      pendingCheckoutRef.current = { items: cartItems, isBuyNow: false };
      setCheckoutGateNotice(
        'Order confirm korar age apnar Customer Account create ba Sign In korun — login korlei direct checkout open hobe!'
      );
      setCustomerModalOpen(true);
      return;
    }
    setCheckoutItems(cartItems);
    setCheckoutIsBuyNow(false);
    setCheckoutOpen(true);
  }, [cartItems, customerSession]);

  const handleCustomerSessionChange = useCallback((next: CustomerSessionData | null) => {
    setCustomerSession(next);
    if (next && pendingCheckoutRef.current) {
      const queued = pendingCheckoutRef.current;
      pendingCheckoutRef.current = null;
      setCheckoutGateNotice('');
      setCustomerModalOpen(false);
      setCheckoutItems(queued.items);
      setCheckoutIsBuyNow(queued.isBuyNow);
      setCheckoutOpen(true);
    }
  }, []);

  const handleOrderSuccess = useCallback(
    (order: CustomerOrder) => {
      if (!checkoutIsBuyNow) {
        setCartItems([]);
      }
      if (isAdmin) {
        knownOrderIdsRef.current.add(order.id);
        setAdminOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
        playOrderAlertChime();
      }
      if (customerSession?.token) {
        void fetchCustomerSession(customerSession.token).then((fresh) => {
          if (fresh) setCustomerSession(fresh);
        });
      }
    },
    [checkoutIsBuyNow, isAdmin, customerSession?.token]
  );

  const handleRefreshAdminOrders = useCallback(async () => {
    if (!adminToken) return;
    const [latest, latestMsgs, latestResets] = await Promise.all([
      fetchAdminOrders(adminToken),
      fetchAdminCustomerMessages(adminToken),
      fetchAdminPinResets(adminToken),
    ]);
    knownOrderIdsRef.current = new Set(latest.map((o) => o.id));
    knownPinResetIdsRef.current = new Set(latestResets.map((r) => r.id));
    setAdminOrders(latest);
    setAdminMessages(latestMsgs);
    setAdminPinResets(latestResets);
  }, [adminToken]);

  const handleAdminOrderUpdated = useCallback(
    (updated: CustomerOrder) => {
      setAdminOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (adminToken) {
        void fetchAdminCustomerMessages(adminToken).then((msgs) => setAdminMessages(msgs));
      }
    },
    [adminToken]
  );

  const handleRefreshAdminMessages = useCallback(async () => {
    if (!adminToken) return;
    const latest = await fetchAdminCustomerMessages(adminToken);
    knownCustomerMsgIdsRef.current = new Set(
      latest.filter((m) => m.sender === 'customer').map((m) => m.id)
    );
    setAdminMessages(latest);
  }, [adminToken]);

  const handleRefreshAdminPinResets = useCallback(async () => {
    if (!adminToken) return;
    const latest = await fetchAdminPinResets(adminToken);
    knownPinResetIdsRef.current = new Set(latest.map((r) => r.id));
    setAdminPinResets(latest);
  }, [adminToken]);

  const handleAdminMessageSent = useCallback((msg: CustomerMessage) => {
    setAdminMessages((prev) => [...prev.filter((m) => m.id !== msg.id), msg]);
  }, []);

  const handleAdminThreadMarkedRead = useCallback((phoneNormalized: string) => {
    setAdminMessages((prev) =>
      prev.map((m) =>
        m.customer_phone_normalized === phoneNormalized && m.sender === 'customer'
          ? { ...m, read_by_admin: true }
          : m
      )
    );
  }, []);

  const handleConvertOrderToMemo = useCallback(
    (order: CustomerOrder) => {
      if (!isAdmin) return;
      const mapped: MemoLineItem[] = order.items.map((item) => {
        const matched = hydratedWatches.find((w) => w.id === item.watchId);
        return {
          watchId: item.watchId,
          brand: item.brand,
          model: item.model || item.productName,
          color: item.color || 'Standard',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          realCost: matched?.real_buying_price ?? 0,
        };
      });
      setDraftMemoItems(mapped);
      setActiveTab('memo');
    },
    [isAdmin, hydratedWatches]
  );

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
    <div className="min-h-screen bg-transparent text-[#09090B] flex flex-col">
      {/* Top Bar (Strict 3-Zone Contract, 56px refined alabaster frosted bar) */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="sticky top-0 z-30 h-[56px] bg-[#FCFBFA]/90 backdrop-blur-md border-b border-stone-200/80 no-print"
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
                  className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'admin'
                      ? 'text-[#09090B] font-semibold'
                      : 'text-zinc-500 hover:text-[#09090B]'
                  }`}
                >
                  <span>Inventory</span>
                  {adminTotalAlerts > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-mono-num text-[10px] font-bold leading-none animate-pulse">
                      {adminTotalAlerts}
                    </span>
                  )}
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

          {/* Zone 3: Customer Account + Cart Button + Sound Toggle + Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <motion.button
              type="button"
              onClick={() => setCustomerModalOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="relative min-h-[38px] min-w-[38px] px-2 sm:px-2.5 rounded-lg border border-stone-200 bg-white text-zinc-800 hover:text-zinc-950 hover:bg-stone-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              aria-label="Open Customer Account and Order History"
              title={
                customerSession
                  ? `${customerSession.account.name} (${customerSession.account.customer_code})`
                  : 'Customer Account & Order Status'
              }
            >
              <User size={16} />
              <span className="hidden sm:inline text-xs font-semibold max-w-[90px] truncate">
                {customerSession ? customerSession.account.customer_code : 'Account'}
              </span>
              {unreadCustomerMessagesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-mono-num text-[10px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                  {unreadCustomerMessagesCount}
                </span>
              )}
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setCartOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="relative min-h-[38px] min-w-[38px] px-2 sm:px-2.5 rounded-lg border border-stone-200 bg-white text-zinc-800 hover:text-zinc-950 hover:bg-stone-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              aria-label={`Open shopping cart (${cartCount} items)`}
              title="Shopping Bag"
            >
              <ShoppingBag size={16} />
              <span className="hidden sm:inline text-xs font-semibold">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#09090B] text-white font-mono-num text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </motion.button>
            <motion.button
              type="button"
              data-sound="none"
              onClick={() => {
                const nextMuted = !soundMuted;
                setGlobalSoundMuted(nextMuted);
                if (!nextMuted) {
                  playUiSound('tab');
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="min-h-[38px] min-w-[38px] rounded-lg border border-stone-200 bg-white text-zinc-700 hover:text-zinc-950 hover:bg-stone-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label={soundMuted ? 'Enable interface sounds' : 'Mute interface sounds'}
              title={soundMuted ? 'Sound Off' : 'Sound On'}
            >
              {soundMuted ? <VolumeX size={16} className="text-zinc-400" /> : <Volume2 size={16} />}
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="min-h-[38px] px-3.5 sm:px-4 rounded-lg bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              Ask Concierge
            </motion.button>
          </div>
        </div>
        {/* Razor-thin GPU Scroll Progress Ribbon */}
        <motion.div
          aria-hidden="true"
          style={{ scaleX: smoothScrollProgress, transformOrigin: '0% 50%' }}
          className="h-[2px] w-full bg-gradient-to-r from-zinc-900 via-amber-700/80 to-zinc-900 will-change-transform"
        />
      </motion.header>

      {/* Main Content Canvas */}
      <main
        style={{ perspective: 1400 }}
        className="flex-1 max-w-[1400px] w-full mx-auto px-2.5 sm:px-6 pt-3 sm:pt-6 pb-8 md:pb-14 space-y-5"
      >
        <AnimatePresence mode="wait">
          {activeTab === 'catalog' && (
            <motion.div
              key="tab-catalog"
              initial={{ opacity: 0, y: 24, scale: 0.96, rotateX: 8 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: -18, scale: 0.96, rotateX: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="space-y-4 sm:space-y-6"
            >
              {/* Editorial Luxury Marketplace Banner with Interactive GPU Light-Field & 3D Chronometer */}
              <motion.section
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className="relative rounded-xl sm:rounded-2xl bg-[#FFFDFB] border border-stone-200/90 overflow-hidden shadow-[0_14px_34px_-18px_rgba(24,24,27,0.12)]"
              >
                <StorefrontAmbientCanvas />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <motion.div
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.04 }}
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
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 440, damping: 20 }}
                        className="min-h-[38px] sm:min-h-[42px] px-4 sm:px-5 rounded-xl bg-[#09090B] text-white font-semibold text-xs sm:text-sm hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                      >
                        Explore Catalog
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setActiveTab('lens')}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 440, damping: 20 }}
                        className="min-h-[38px] sm:min-h-[42px] px-3.5 sm:px-4 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm font-medium text-zinc-900 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer"
                      >
                        <ScanSearch size={14} className="text-zinc-900" />
                        <span>Search by Photo</span>
                      </motion.button>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, rotateY: 14 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 22, delay: 0.08 }}
                    className="lg:col-span-5 relative min-h-[225px] sm:min-h-[285px] bg-[radial-gradient(circle_at_50%_34%,#FFFFFF_0%,#F4EFE6_54%,#E5DDD0_100%)] text-zinc-800 border-t lg:border-t-0 lg:border-l border-stone-200/80 flex flex-col items-stretch justify-center overflow-hidden"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0)_48%,rgba(196,178,150,0.22)_100%)]"
                    />
                    <HeroWatch3D />
                  </motion.div>
                </div>
              </motion.section>

              {/* Instant Search, Category Tabs & Multi-Filter Toolbar */}
              <section id="catalog-collection" className="space-y-2.5 sm:space-y-3.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
                  <div>
                    <h2 className="font-display text-xl sm:text-3xl font-bold text-[#09090B]">
                      Store Collection
                    </h2>
                    <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                      <p className="text-[11px] sm:text-xs text-zinc-500 font-mono-num">
                        Showing {filteredWatches.length} of {hydratedWatches.length} products
                      </p>
                      {savedWatches.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
                          <span aria-hidden="true" className="text-zinc-300">·</span>
                          <button
                            type="button"
                            onClick={() => setShowSavedOnly((v) => !v)}
                            className={`inline-flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                              showSavedOnly
                                ? 'text-rose-600 underline'
                                : 'text-zinc-700 hover:text-[#09090B]'
                            }`}
                          >
                            <Heart size={12} className={showSavedOnly ? 'fill-rose-600' : ''} />
                            <span>Saved ({savedWatches.length})</span>
                          </button>
                          {savedWatches.length >= 2 && (
                            <>
                              <span aria-hidden="true" className="text-zinc-300">·</span>
                              <button
                                type="button"
                                onClick={() => setCompareOpen(true)}
                                className="inline-flex items-center gap-1 font-semibold text-[#09090B] hover:opacity-75 cursor-pointer"
                              >
                                <Scale size={12} />
                                <span>Compare</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
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
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-medium text-zinc-500">Sort By</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as CatalogSortOption)}
                          className="w-full min-h-[36px] rounded-lg bg-zinc-50 border border-zinc-200 px-2.5 text-[11px] text-[#09090B] focus:outline-none focus:border-zinc-950"
                        >
                          <option value="featured">Featured (Newest)</option>
                          <option value="priceAsc">Price: Low to High</option>
                          <option value="priceDesc">Price: High to Low</option>
                          <option value="discountDesc">Biggest Savings</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Desktop Filter Controls */}
                <div className="hidden md:grid grid-cols-5 gap-3 rounded-xl bg-white border border-zinc-200 p-3">
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
                    <label className="text-[11px] font-medium text-zinc-500">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as CatalogSortOption)}
                      className="w-full min-h-[40px] rounded-lg bg-zinc-50 border border-zinc-200 px-3 text-xs text-[#09090B] focus:outline-none focus:border-zinc-950"
                    >
                      <option value="featured">Featured (Newest)</option>
                      <option value="priceAsc">Price: Low to High</option>
                      <option value="priceDesc">Price: High to Low</option>
                      <option value="discountDesc">Biggest Savings</option>
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
                      {isAdmin
                        ? 'No products added yet. Open Inventory to add your first item.'
                        : 'New collection arriving shortly. Ask our Concierge for stock updates.'}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleNavClick('admin')}
                        className="min-h-[44px] px-5 rounded-xl bg-[#09090B] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Open Inventory
                      </button>
                    )}
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
                    key={`${categoryFilter}-${brandFilter}-${priceFilter}-${stockFilter}-${sortBy}-${showSavedOnly}`}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5"
                  >
                    {filteredWatches.map((watch, idx) => (
                      <WatchCard
                        key={watch.id}
                        watch={watch}
                        index={idx}
                        isAdmin={isAdmin}
                        isSaved={savedIds.includes(watch.id)}
                        inCartQty={cartItems.find((i) => i.watchId === watch.id)?.quantity ?? 0}
                        onToggleSave={toggleSaveWatch}
                        onAddToCart={handleAddToCart}
                        onBuyNow={handleBuyNow}
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
              initial={{ opacity: 0, y: 26, scale: 0.94, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: -18, scale: 0.96, rotateX: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            >
              <ChikoLensView watches={hydratedWatches} onSelectWatch={setSelectedWatch} />
            </motion.div>
          )}

          {activeTab === 'memo' && isAdmin && (
            <motion.div
              key="tab-memo"
              initial={{ opacity: 0, y: 26, scale: 0.94, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: -18, scale: 0.96, rotateX: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            >
              <DigitalMemoBuilder
                watches={hydratedWatches}
                initialItems={draftMemoItems}
                savedMemos={savedMemos}
                onSaveMemo={handleSaveMemo}
                onDeleteMemo={handleDeleteMemo}
                onClearDraftItems={clearDraftMemoItems}
              />
            </motion.div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <motion.div
              key="tab-admin"
              initial={{ opacity: 0, y: 26, scale: 0.94, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: -18, scale: 0.96, rotateX: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            >
              <AdminDashboard
                watches={hydratedWatches}
                savedMemos={savedMemos}
                orders={adminOrders}
                customerMessages={adminMessages}
                pinResetRequests={adminPinResets}
                paymentSettings={paymentSettings}
                adminUsername={adminUsername}
                adminToken={adminToken}
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
                onAddToMemo={handleAddToMemo}
                onRefreshOrders={handleRefreshAdminOrders}
                onOrderUpdated={handleAdminOrderUpdated}
                onRefreshMessages={handleRefreshAdminMessages}
                onRefreshPinResets={handleRefreshAdminPinResets}
                onMessageSent={handleAdminMessageSent}
                onThreadMarkedRead={handleAdminThreadMarkedRead}
                onPaymentSettingsSaved={setPaymentSettings}
                onConvertOrderToMemo={handleConvertOrderToMemo}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quiet Boutique Footer with Discreet Tiny Corner Portal Trigger (Mobile & Desktop) */}
      <footer className="border-t border-stone-200/90 bg-[#FCFBFA] py-4 pb-20 md:pb-5 px-4 sm:px-6 text-[11px] sm:text-xs text-zinc-500 no-print">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3">
          <span className="truncate">
            © {new Date().getFullYear()} New Chiko Watch &amp; Electronics.
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline">
              Tag prices are indicative retail anchors · Ask Concierge for best offer.
            </span>
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-300 hover:text-zinc-700 hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label={isAdmin ? 'Open inventory dashboard' : 'Store portal'}
              title={isAdmin ? 'Inventory' : 'Portal'}
            >
              <Lock size={12} />
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Chiko Lens & AI Concierge Triggers */}
      <div className="fixed bottom-[70px] md:bottom-6 right-3.5 sm:right-4 z-40 flex flex-col gap-2 no-print">
        <AnimatePresence>
          {showBackToTop && (
            <motion.button
              key="fab-top"
              type="button"
              initial={{ opacity: 0, scale: 0.72, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.72, y: 10 }}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="self-end min-h-[38px] min-w-[38px] rounded-xl bg-white/95 backdrop-blur-md border border-zinc-300 text-[#09090B] shadow-md flex items-center justify-center hover:border-zinc-950 transition-colors cursor-pointer"
              aria-label="Scroll back to top"
              title="Back to top"
            >
              <ArrowUp size={15} />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeTab !== 'lens' && (
            <motion.button
              key="fab-lens"
              type="button"
              initial={{ opacity: 0, scale: 0.72, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.72, y: 14 }}
              whileHover={{ scale: 1.07, y: -2 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={() => setActiveTab('lens')}
              className="min-h-[42px] px-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-zinc-300 text-[#09090B] shadow-lg flex items-center gap-2 hover:border-zinc-950 transition-colors cursor-pointer"
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
              initial={{ opacity: 0, scale: 0.72, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.72, y: 14 }}
              whileHover={{ scale: 1.07, y: -2 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={() => setChatOpen(true)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#09090B] text-white shadow-lg flex items-center gap-2 hover:bg-zinc-800 transition-colors cursor-pointer"
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

        {isAdmin ? (
          <motion.button
            type="button"
            onClick={() => handleNavClick('admin')}
            whileTap={{ scale: 0.86 }}
            transition={{ type: 'spring', stiffness: 460, damping: 22 }}
            className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'admin'
                ? 'text-[#09090B] font-semibold'
                : 'text-emerald-700 font-medium'
            }`}
          >
            {activeTab === 'admin' && (
              <motion.span
                layoutId="mobile-nav-indicator"
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                className="absolute top-0 left-1/5 right-1/5 h-[3px] bg-[#09090B] rounded-b-full"
              />
            )}
            <div className="relative">
              <ShieldCheck
                size={18}
                className={`transition-transform duration-200 ${
                  activeTab === 'admin' ? 'scale-120 -translate-y-0.5' : 'scale-100'
                }`}
              />
              {adminTotalAlerts > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-600 text-white font-mono-num text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {adminTotalAlerts}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Admin</span>
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            whileTap={{ scale: 0.86 }}
            transition={{ type: 'spring', stiffness: 460, damping: 22 }}
            className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              chatOpen ? 'text-[#09090B] font-semibold' : 'text-zinc-500'
            }`}
          >
            <MessageSquare
              size={18}
              className={`transition-transform duration-200 ${
                chatOpen ? 'scale-120 -translate-y-0.5' : 'scale-100'
              }`}
            />
            <span className="text-[10px] tracking-tight">Concierge</span>
          </motion.button>
        )}
      </nav>

      {/* Modals, Cart Drawer & Floating Chatbot */}
      <CartDrawer
        isOpen={cartOpen}
        items={cartItems}
        deliveryZone={deliveryZone}
        paymentSettings={paymentSettings}
        onChangeZone={setDeliveryZone}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onClose={() => setCartOpen(false)}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <AnimatePresence>
        {checkoutOpen && checkoutItems.length > 0 && (
          <CheckoutModal
            key="checkout-modal"
            items={checkoutItems}
            initialZone={deliveryZone}
            paymentSettings={paymentSettings}
            isBuyNow={checkoutIsBuyNow}
            customerAccount={customerSession?.account || null}
            onOpenCustomerAccount={() => setCustomerModalOpen(true)}
            onClose={() => setCheckoutOpen(false)}
            onOrderSuccess={handleOrderSuccess}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {customerModalOpen && (
          <CustomerAccountModal
            key="customer-account-modal"
            session={customerSession}
            checkoutGateMessage={checkoutGateNotice}
            onClose={() => {
              setCustomerModalOpen(false);
              setCheckoutGateNotice('');
              pendingCheckoutRef.current = null;
            }}
            onSessionChange={handleCustomerSessionChange}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedWatch && (
          <WatchDetailModal
            key={selectedWatch.id}
            watch={selectedWatch}
            isAdmin={isAdmin}
            isSaved={savedIds.includes(selectedWatch.id)}
            inCartQty={cartItems.find((i) => i.watchId === selectedWatch.id)?.quantity ?? 0}
            onToggleSave={toggleSaveWatch}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onClose={() => setSelectedWatch(null)}
            onAddToMemo={handleAddToMemo}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareOpen && savedWatches.length >= 2 && (
          <ProductCompareModal
            key="compare-modal"
            watches={savedWatches}
            onClose={() => setCompareOpen(false)}
            onSelectWatch={setSelectedWatch}
            onRemoveSaved={toggleSaveWatch}
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
