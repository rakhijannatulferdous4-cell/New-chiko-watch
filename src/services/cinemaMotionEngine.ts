import { WatchItem } from '../types/watch';
import {
  playProductActionSound,
  playProductRevealSound,
  setGlobalSoundMuted,
} from './uiSoundEngine';

export type ProductActionKind =
  | 'liquid'
  | 'power'
  | 'audio'
  | 'vapor'
  | 'watch'
  | 'light'
  | 'fan'
  | 'universal';

export interface ProductMotionProfile {
  actionKind: ProductActionKind;
  title: string;
  activeLabel: string;
  tap2Prompt: string;
  accentHex: string;
  secondaryHex: string;
  studioBackground: string;
  isTwilight: boolean;
  verifiedOnline?: boolean;
  verifiedProductType?: string;
  specBadge?: string;
  source?: string;
}

const MOTION_CACHE_KEY = 'new_chiko_motion_online_cache_v4';
const inFlightLookups = new Map<string, Promise<ProductMotionProfile>>();

export function buildMotionSignature(watch: WatchItem): string {
  return [
    watch.id,
    watch.product_name || '',
    watch.brand || '',
    watch.model || '',
    watch.category || '',
    watch.color || '',
    watch.capacity_spec || '',
    (watch.description || '').slice(0, 120),
    (watch.image_url || '').slice(0, 120),
  ]
    .join('|')
    .toLowerCase();
}

export function buildProfileForKind(
  actionKind: ProductActionKind,
  overrides?: {
    title?: string;
    activeLabel?: string;
    tap2Prompt?: string;
    accentHex?: string;
    secondaryHex?: string;
    specBadge?: string;
    source?: string;
    verifiedOnline?: boolean;
    verifiedProductType?: string;
  }
): ProductMotionProfile {
  const baseByKind: Record<ProductActionKind, ProductMotionProfile> = {
    vapor: {
      actionKind: 'vapor',
      title: 'Silky Vapor',
      activeLabel: 'Smooth Smoke Plumes',
      tap2Prompt: 'Tap again for dense silky vapor',
      accentHex: '#8B5CF6',
      secondaryHex: '#E2E8F0',
      studioBackground:
        'radial-gradient(circle at 50% 26%, #FFFFFF 0%, #F4F0F8 48%, #E6DEF0 82%, #D9CEE8 100%)',
      isTwilight: false,
    },
    liquid: {
      actionKind: 'liquid',
      title: 'Hydro Splash',
      activeLabel: 'Fresh Water Burst',
      tap2Prompt: 'Tap bottle again to splash water',
      accentHex: '#38BDF8',
      secondaryHex: '#E0F2FE',
      studioBackground:
        'radial-gradient(circle at 50% 28%, #FFFFFF 0%, #EFF8FC 50%, #DCEEF7 84%, #CBE4F2 100%)',
      isTwilight: false,
    },
    audio: {
      actionKind: 'audio',
      title: 'Acoustic Bass',
      activeLabel: 'Live Soundwave Pulse',
      tap2Prompt: 'Tap speaker again for bass beat',
      accentHex: '#2563EB',
      secondaryHex: '#93C5FD',
      studioBackground:
        'radial-gradient(circle at 50% 26%, #FFFFFF 0%, #EEF2F7 48%, #DCE3EE 82%, #CDD7E6 100%)',
      isTwilight: false,
    },
    fan: {
      actionKind: 'fan',
      title: 'Aero Breeze',
      activeLabel: 'Cool Airflow Stream',
      tap2Prompt: 'Tap again for breeze gust',
      accentHex: '#06B6D4',
      secondaryHex: '#CFFAFE',
      studioBackground:
        'radial-gradient(circle at 50% 26%, #FFFFFF 0%, #ECF9FA 48%, #D6F0F4 82%, #C4E7ED 100%)',
      isTwilight: false,
    },
    light: {
      actionKind: 'light',
      title: 'Studio Beam',
      activeLabel: 'Warm Beam Active',
      tap2Prompt: 'Tap again to pulse light beam',
      accentHex: '#F59E0B',
      secondaryHex: '#FEF3C7',
      studioBackground:
        'radial-gradient(circle at 50% 34%, #525E73 0%, #3C4759 54%, #2B3444 100%)',
      isTwilight: true,
    },
    watch: {
      actionKind: 'watch',
      title: 'Horology Glint',
      activeLabel: 'Sapphire Sunburst Sweep',
      tap2Prompt: 'Tap watch again for crystal glint',
      accentHex: '#D97706',
      secondaryHex: '#FEF3C7',
      studioBackground:
        'radial-gradient(circle at 50% 24%, #FFFDF9 0%, #F7F1E6 48%, #ECE2D0 82%, #E1D3BC 100%)',
      isTwilight: false,
    },
    power: {
      actionKind: 'power',
      title: 'Super-Fast Charge',
      activeLabel: 'Fast Charging Phone',
      tap2Prompt: 'Tap again to boost fast charge',
      accentHex: '#10B981',
      secondaryHex: '#38BDF8',
      studioBackground:
        'radial-gradient(circle at 50% 24%, #FFFFFF 0%, #EEF4FC 48%, #DCE8F8 82%, #CEDCF2 100%)',
      isTwilight: false,
    },
    universal: {
      actionKind: 'universal',
      title: 'Studio Motion',
      activeLabel: 'Live Product Showcase',
      tap2Prompt: 'Tap product again to animate',
      accentHex: '#52525B',
      secondaryHex: '#E4E4E7',
      studioBackground:
        'radial-gradient(circle at 50% 24%, #FFFFFF 0%, #F6F4EF 52%, #EBE6DC 84%, #E0D9CC 100%)',
      isTwilight: false,
    },
  };

  const base = baseByKind[actionKind];
  const validHex = (val?: string) =>
    val && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim() : '';

  return {
    ...base,
    title: overrides?.title?.trim() || base.title,
    activeLabel: overrides?.activeLabel?.trim() || base.activeLabel,
    tap2Prompt: overrides?.tap2Prompt?.trim() || base.tap2Prompt,
    accentHex: validHex(overrides?.accentHex) || base.accentHex,
    secondaryHex: validHex(overrides?.secondaryHex) || base.secondaryHex,
    specBadge: overrides?.specBadge?.trim() || undefined,
    source: overrides?.source?.trim() || undefined,
    verifiedOnline: overrides?.verifiedOnline,
    verifiedProductType: overrides?.verifiedProductType,
  };
}

/**
 * Instant local product classifier (0ms) — checks PRIMARY product identity
 * (product_name, brand, model, category) FIRST so compatibility notes in description
 * (like "charges earbuds/speakers/watch" or "built-in LED light") NEVER hijack a Power Bank!
 */
export function resolveProductMotionProfile(watch: WatchItem): ProductMotionProfile {
  const cached = loadCachedMotionProfile(buildMotionSignature(watch));
  if (cached) return cached;

  const primary = [watch.product_name, watch.brand, watch.model, watch.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const fullHaystack = [
    watch.product_name,
    watch.brand,
    watch.model,
    watch.category,
    watch.description,
    watch.capacity_spec,
    watch.connectivity,
    watch.color,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const classifyText = (text: string, checkCategory: boolean): ProductActionKind | null => {
    // 1. Vapor / Vape / Pod / Disposable / Humidifier / Diffuser (STRICTLY FIRST — never hijacked by mAh or Type-C!)
    if (
      /\b(vape|vaping|pod|pods|pod\s*kit|pod\s*system|prelled\s*pod|puff|puffs|e-cig|ecig|smoke|vapor|vapour|oxva|xlim|voopoo|argus|drag|uwell|caliburn|vaporesso|xros|smok|nord|rpm|elfbar|elf\s*bar|vozol|d-breath|waka|iget|nasty|geekbar|geek\s*bar|lost\s*mary|relx|juul|e-liquid|eliquid|nic\s*salt|salt\s*nic|mesh\s*coil|cartridge|disposable\s*bar|shisha|hookah|humidifier|diffuser|aroma|steamer)\b/.test(
        text
      )
    ) {
      return 'vapor';
    }

    // 2. Power Bank / Dedicated Charger / Cable / Adapter (checked BEFORE audio/light on primary identity!)
    if (
      /\b(power\s*bank|powerbank|wall\s*charger|fast\s*charger|gan\s*charger|charging\s*adapter|power\s*adapter|travel\s*adapter|charging\s*cable|data\s*cable|magsafe\s*battery|battery\s*pack|anker\s*powercore|car\s*charger|portable\s*charger|charger)\b/.test(
        text
      ) ||
      (checkCategory &&
        (watch.category === 'Power Banks' || watch.category === 'Chargers & Cables'))
    ) {
      return 'power';
    }

    // 3. Liquid / Water Bottle / Flask / Tumbler / Perfume / Spray
    if (
      /\b(water\s*bottle|bottle|botol|pani|panir|flask|thermos|tumbler|sipper|mug|cup|hydration|stanley|hydro\s*flask|perfume|attar|cologne|eau\s*de|mist\s*spray|spray\s*bottle|shampoo|serum)\b/.test(
        text
      )
    ) {
      return 'liquid';
    }

    // 4. Audio / Bluetooth Speakers / TWS Earbuds / Neckbands / Headphones
    if (
      /\b(speaker|bluetooth\s*speaker|soundbar|sound\s*box|soundbox|woofer|subwoofer|ktx|jbl|earbud|earphone|tws|airpod|headphone|headset|neckband|mic|microphone|audio|bass)\b/.test(
        text
      ) ||
      (checkCategory &&
        (watch.category === 'Bluetooth Speakers' ||
          watch.category === 'TWS Earbuds' ||
          watch.category === 'Neckbands'))
    ) {
      return 'audio';
    }

    // 5. Cooling Fan / Mini Fan / Air Cooler / Hair Dryer
    if (
      /\b(fan|mini\s*fan|neck\s*fan|desk\s*fan|cooler|air\s*purifier|blower|hair\s*dryer|breeze)\b/.test(
        text
      )
    ) {
      return 'fan';
    }

    // 6. Lights / Flashlights / Desk Lamps / Ring Lights / Lanterns
    if (
      /\b(light|lamp|torch|flashlight|lantern|led\s*strip|ring\s*light|rgb\s*light|bulb|night\s*light|spotlight|headlamp)\b/.test(
        text
      )
    ) {
      return 'light';
    }

    // 7. Watches / Timepieces / Smartwatches
    if (
      /\b(watch|chronograph|horology|timepiece|rolex|casio|seiko|omega|tissot|fossil|citizen|g-shock|smartwatch|amoled|strap|dial|quartz|automatic)\b/.test(
        text
      ) ||
      (checkCategory &&
        (watch.category === 'Analog Watches' ||
          watch.category === 'Digital Watches' ||
          watch.category === 'Smartwatches'))
    ) {
      return 'watch';
    }

    return null;
  };

  // Pass 1: Strict primary identity (name + brand + model + category)
  const primaryMatch = classifyText(primary, true);
  if (primaryMatch) {
    return buildProfileForKind(primaryMatch, {
      specBadge: watch.capacity_spec || undefined,
    });
  }

  // Pass 2: Full metadata fallback (for generic category items)
  const fullMatch = classifyText(fullHaystack, false);
  if (fullMatch) {
    return buildProfileForKind(fullMatch, {
      specBadge: watch.capacity_spec || undefined,
    });
  }

  return buildProfileForKind('universal', {
    specBadge: watch.capacity_spec || undefined,
  });
}

function readCacheMap(): Record<string, ProductMotionProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MOTION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadCachedMotionProfile(signature: string): ProductMotionProfile | null {
  const map = readCacheMap();
  const hit = map[signature];
  if (hit && typeof hit.actionKind === 'string') {
    return hit;
  }
  return null;
}

function saveCachedMotionProfile(signature: string, profile: ProductMotionProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const map = readCacheMap();
    const keys = Object.keys(map);
    if (keys.length > 160) {
      delete map[keys[0]];
    }
    map[signature] = profile;
    window.localStorage.setItem(MOTION_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function clearMotionProfileCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MOTION_CACHE_KEY);
    window.localStorage.removeItem('new_chiko_motion_online_cache_v3');
  } catch {
    // ignore
  }
}

/**
 * Analyzes the product photo + details via /api/showcase/identify-product (Gemini Vision + Server Persistent Cache)
 * to generate the exact real-world animation profile, then caches locally for instant 0ms opens.
 */
export async function resolveProductMotionOnline(
  watch: WatchItem,
  forceRefresh = false
): Promise<ProductMotionProfile> {
  const signature = buildMotionSignature(watch);
  if (!forceRefresh) {
    const cached = loadCachedMotionProfile(signature);
    if (cached?.verifiedOnline && cached.source === 'gemini-vision') {
      return cached;
    }
  }

  const flightKey = `${signature}:${forceRefresh ? 'force' : 'normal'}`;
  const existing = inFlightLookups.get(flightKey);
  if (existing) return existing;

  const task = (async () => {
    const localFallback = resolveProductMotionProfile(watch);
    try {
      const res = await fetch('/api/showcase/identify-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: watch.id,
          imageUrl: watch.image_url,
          productName: watch.product_name,
          brand: watch.brand,
          model: watch.model,
          category: watch.category,
          color: watch.color,
          description: watch.description,
          capacitySpec: watch.capacity_spec,
          connectivity: watch.connectivity,
          forceRefresh,
        }),
      });
      if (!res.ok) return localFallback;
      const data = (await res.json()) as {
        verified?: boolean;
        source?: string;
        actionKind?: ProductActionKind;
        verifiedProductType?: string;
        title?: string;
        activeLabel?: string;
        tap2Prompt?: string;
        accentHex?: string;
        secondaryHex?: string;
        specBadge?: string;
      };
      if (data?.verified && data.actionKind) {
        const verifiedProfile = buildProfileForKind(data.actionKind, {
          title: data.title,
          activeLabel: data.activeLabel,
          tap2Prompt: data.tap2Prompt,
          accentHex: data.accentHex,
          secondaryHex: data.secondaryHex,
          specBadge: data.specBadge || watch.capacity_spec,
          source: data.source,
          verifiedOnline: true,
          verifiedProductType: data.verifiedProductType,
        });
        saveCachedMotionProfile(signature, verifiedProfile);
        return verifiedProfile;
      }
      return localFallback;
    } catch {
      return localFallback;
    } finally {
      inFlightLookups.delete(flightKey);
    }
  })();

  inFlightLookups.set(flightKey, task);
  return task;
}

/**
 * Called automatically when ANY new product is added or updated in inventory
 * so Gemini Vision analyzes the photo + metadata and prepares the tailored animation immediately.
 */
export async function prewarmProductMotionOnline(
  watch: WatchItem,
  forceRefresh = false
): Promise<ProductMotionProfile | null> {
  try {
    return await resolveProductMotionOnline(watch, forceRefresh);
  } catch {
    return null;
  }
}

/**
 * Delegates to the shared unlocked Web Audio master engine so speaker bass,
 * vape mist, water splash, and reveal foley play crisply on the very first tap.
 */
export class CinemaFoleyAudio {
  setMuted(muted: boolean) {
    setGlobalSoundMuted(muted);
  }

  playReveal() {
    playProductRevealSound();
  }

  playAction(kind: ProductActionKind) {
    playProductActionSound(kind);
  }

  dispose() {
    // Shared singleton audio graph stays alive across modal open/close
  }
}
