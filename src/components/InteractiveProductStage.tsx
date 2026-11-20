import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BatteryCharging,
  Film,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { WatchItem } from '../types/watch';
import {
  VideoStageKey,
  loadProductVideos,
  removeProductVideo,
  saveProductVideo,
} from '../services/productVideoStore';
import {
  CinemaFoleyAudio,
  ProductActionKind,
  ProductMotionProfile,
  buildMotionSignature,
  loadCachedMotionProfile,
  resolveProductMotionOnline,
  resolveProductMotionProfile,
} from '../services/cinemaMotionEngine';
import {
  isGlobalSoundMuted,
  setGlobalSoundMuted,
  subscribeSoundMute,
} from '../services/uiSoundEngine';
import { CinemaProductCanvas } from './CinemaProductCanvas';
import { WatchImage } from './WatchImage';

interface InteractiveProductStageProps {
  watch: WatchItem;
  isAdmin?: boolean;
}

type StagePlaybackState = 'photo' | 'reveal' | 'action';

function getRecoilKeyframes(actionKind: ProductActionKind) {
  switch (actionKind) {
    case 'liquid':
      return {
        scale: [1.08, 1.115, 1.07, 1.095, 1.08],
        rotate: [0, -4.5, 3.6, -1.8, 0.7, 0],
        y: [0, -8, 2, -3, 0],
        transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] as const },
      };
    case 'audio':
      return {
        scale: [1.08, 1.135, 1.075, 1.125, 1.078, 1.118, 1.08],
        rotate: [0, -0.7, 0.7, -0.5, 0.4, 0],
        y: [0, -2, 0, -2, 0, -1, 0],
        transition: { duration: 0.76, ease: 'easeOut' as const },
      };
    case 'power':
      return {
        scale: [1.08, 1.105, 1.085],
        rotate: [0, 0.8, 0],
        y: [0, -5, 0],
        transition: { duration: 0.52, ease: [0.16, 1, 0.3, 1] as const },
      };
    case 'vapor':
      return {
        scale: [1.08, 1.105, 1.08],
        rotate: [0, -1.2, 0.6, 0],
        y: [0, -6, 0],
        transition: { duration: 0.85, ease: 'easeInOut' as const },
      };
    case 'fan':
      return {
        scale: [1.08, 1.1, 1.085, 1.095, 1.08],
        rotate: [0, 1.4, -1.1, 0.5, 0],
        y: [0, -3, 0],
        transition: { duration: 0.65, ease: 'easeOut' as const },
      };
    default:
      return {
        scale: [1.08, 1.115, 1.08],
        rotate: [0, -1.6, 1.0, 0],
        y: [0, -4, 0],
        transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] as const },
      };
  }
}

export function InteractiveProductStage({
  watch,
  isAdmin = false,
}: InteractiveProductStageProps) {
  const [profile, setProfile] = useState<ProductMotionProfile>(() =>
    resolveProductMotionProfile(watch)
  );
  const [verifyingOnline, setVerifyingOnline] = useState(false);

  const [stage, setStage] = useState<StagePlaybackState>('photo');
  const [burstCount, setBurstCount] = useState(0);
  const [burstOrigin, setBurstOrigin] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.44 });
  const [lightSweepKey, setLightSweepKey] = useState(0);
  const [chargeLevel, setChargeLevel] = useState(64);
  const [pointerTilt, setPointerTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
  const [pointerLight, setPointerLight] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 40,
    active: false,
  });
  const [canvasPointer, setCanvasPointer] = useState<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
  }>({ x: 0.5, y: 0.5, vx: 0, vy: 0, active: false });

  // Optional custom local MP4 videos from IndexedDB (0 cloud storage)
  const [revealUrl, setRevealUrl] = useState<string | null>(null);
  const [actionUrl, setActionUrl] = useState<string | null>(null);
  const [revealName, setRevealName] = useState<string>('');
  const [actionName, setActionName] = useState<string>('');
  const [muted, setMuted] = useState<boolean>(() => isGlobalSoundMuted());

  // Admin inline drawer to attach/manage custom local MP4 clips
  const [studioOpen, setStudioOpen] = useState(false);
  const [savingStage, setSavingStage] = useState<VideoStageKey | null>(null);
  const [studioMessage, setStudioMessage] = useState<string>('');

  const revealVideoRef = useRef<HTMLVideoElement | null>(null);
  const actionVideoRef = useRef<HTMLVideoElement | null>(null);
  const revealInputRef = useRef<HTMLInputElement | null>(null);
  const actionInputRef = useRef<HTMLInputElement | null>(null);
  const foleyRef = useRef<CinemaFoleyAudio | null>(null);
  const prevPointerRef = useRef<{ x: number; y: number; t: number }>({ x: 0.5, y: 0.5, t: 0 });

  const hasCustomReveal = Boolean(revealUrl);
  const hasCustomAction = Boolean(actionUrl);

  // Initialize realistic foley audio engine
  useEffect(() => {
    const foley = new CinemaFoleyAudio();
    foleyRef.current = foley;
    return () => {
      foley.dispose();
      foleyRef.current = null;
    };
  }, []);

  // Sync mute state with global unified audio engine
  useEffect(() => {
    const unsub = subscribeSoundMute((nextMuted) => setMuted(nextMuted));
    return unsub;
  }, []);

  useEffect(() => {
    if (revealVideoRef.current) revealVideoRef.current.muted = muted;
    if (actionVideoRef.current) actionVideoRef.current.muted = muted;
  }, [muted]);

  // Analyze product photo + specs with Gemini Vision FIRST whenever a product opens (cached on server + localStorage)
  useEffect(() => {
    let active = true;
    const signature = buildMotionSignature(watch);
    const cached = loadCachedMotionProfile(signature);
    if (cached) {
      setProfile(cached);
      if (cached.verifiedOnline && cached.source === 'gemini-vision') {
        setVerifyingOnline(false);
        return () => {
          active = false;
        };
      }
    } else {
      setProfile(resolveProductMotionProfile(watch));
    }

    setVerifyingOnline(true);
    resolveProductMotionOnline(watch)
      .then((verified) => {
        if (active) {
          setProfile(verified);
        }
      })
      .finally(() => {
        if (active) {
          setVerifyingOnline(false);
        }
      });

    return () => {
      active = false;
    };
  }, [watch]);

  const handleForceReanalyzeAi = async () => {
    if (verifyingOnline) return;
    setVerifyingOnline(true);
    setStudioMessage('');
    try {
      const fresh = await resolveProductMotionOnline(watch, true);
      setProfile(fresh);
      setStudioMessage(
        `AI analyzed: ${fresh.verifiedProductType || fresh.title} (${fresh.actionKind} animation active).`
      );
    } finally {
      setVerifyingOnline(false);
    }
  };

  // Reset stage & load any locally attached custom videos when switching products
  useEffect(() => {
    let active = true;
    let localRevealUrl: string | null = null;
    let localActionUrl: string | null = null;

    setStage('photo');
    setBurstCount(0);
    setLightSweepKey(0);
    setChargeLevel(64);
    setPointerTilt({ rx: 0, ry: 0 });
    setPointerLight({ x: 50, y: 40, active: false });
    setCanvasPointer({ x: 0.5, y: 0.5, vx: 0, vy: 0, active: false });
    setStudioMessage('');

    loadProductVideos(watch.id).then(({ reveal, action }) => {
      if (!active) return;
      if (reveal?.blob) {
        localRevealUrl = URL.createObjectURL(reveal.blob);
        setRevealUrl(localRevealUrl);
        setRevealName(reveal.fileName || 'Reveal clip');
      } else {
        setRevealUrl(null);
        setRevealName('');
      }
      if (action?.blob) {
        localActionUrl = URL.createObjectURL(action.blob);
        setActionUrl(localActionUrl);
        setActionName(action.fileName || 'Action clip');
      } else {
        setActionUrl(null);
        setActionName('');
      }
    });

    return () => {
      active = false;
      if (localRevealUrl) URL.revokeObjectURL(localRevealUrl);
      if (localActionUrl) URL.revokeObjectURL(localActionUrl);
    };
  }, [watch.id]);

  // Smooth fast-charge percentage counter animation for Power Bank / Charger products
  useEffect(() => {
    if (profile.actionKind !== 'power' || stage === 'photo') return;
    if (stage === 'reveal') {
      setChargeLevel(28);
      const interval = window.setInterval(() => {
        setChargeLevel((prev) => (prev >= 58 ? 58 : prev + 1));
      }, 95);
      return () => window.clearInterval(interval);
    }
    setChargeLevel(58);
    const interval = window.setInterval(() => {
      setChargeLevel((prev) => (prev >= 100 ? 100 : prev + 1));
    }, 52);
    return () => window.clearInterval(interval);
  }, [profile.actionKind, stage, burstCount]);

  const playVideoElement = useCallback(
    (videoEl: HTMLVideoElement | null) => {
      if (!videoEl) return;
      videoEl.muted = muted;
      videoEl.currentTime = 0;
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          videoEl.muted = true;
          setMuted(true);
          videoEl.play().catch(() => {
            // ignore
          });
        });
      }
    },
    [muted]
  );

  const triggerStage1Reveal = useCallback(() => {
    setStage('reveal');
    setLightSweepKey((k) => k + 1);

    if (revealUrl) {
      if (actionVideoRef.current) {
        actionVideoRef.current.pause();
        actionVideoRef.current.currentTime = 0;
      }
      requestAnimationFrame(() => playVideoElement(revealVideoRef.current));
    } else {
      foleyRef.current?.playReveal();
    }
  }, [playVideoElement, revealUrl]);

  const triggerStage2Action = useCallback(
    (origin: { x: number; y: number }) => {
      setBurstOrigin(origin);
      setStage('action');
      setBurstCount((c) => c + 1);
      setLightSweepKey((k) => k + 1);

      if (actionUrl) {
        if (revealVideoRef.current) revealVideoRef.current.pause();
        requestAnimationFrame(() => playVideoElement(actionVideoRef.current));
      } else {
        foleyRef.current?.playAction(profile.actionKind);
      }
    },
    [actionUrl, playVideoElement, profile.actionKind]
  );

  const returnToPhoto = useCallback(() => {
    if (revealVideoRef.current) {
      revealVideoRef.current.pause();
      revealVideoRef.current.currentTime = 0;
    }
    if (actionVideoRef.current) {
      actionVideoRef.current.pause();
      actionVideoRef.current.currentTime = 0;
    }
    setPointerTilt({ rx: 0, ry: 0 });
    setPointerLight({ x: 50, y: 40, active: false });
    setCanvasPointer({ x: 0.5, y: 0.5, vx: 0, vy: 0, active: false });
    setStage('photo');
  }, []);

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx =
      rect.width > 0 ? Math.max(0.12, Math.min(0.88, (e.clientX - rect.left) / rect.width)) : 0.5;
    const ny =
      rect.height > 0 ? Math.max(0.12, Math.min(0.88, (e.clientY - rect.top) / rect.height)) : 0.45;

    if (stage === 'photo') {
      triggerStage1Reveal();
    } else {
      triggerStage2Action({ x: nx, y: ny });
    }
  };

  // Real-time GPU gimbal parallax + directional specular studio light + live fluid swirl velocity
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage === 'photo') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const now = performance.now();
    const dt = Math.max(8, now - prevPointerRef.current.t);
    const vx = ((nx - prevPointerRef.current.x) * rect.width) / (dt / 1000);
    const vy = ((ny - prevPointerRef.current.y) * rect.height) / (dt / 1000);
    prevPointerRef.current = { x: nx, y: ny, t: now };

    setPointerTilt({
      rx: -(ny - 0.5) * 7.5,
      ry: (nx - 0.5) * 8.5,
    });
    setPointerLight({ x: nx * 100, y: ny * 100, active: true });
    setCanvasPointer({ x: nx, y: ny, vx, vy, active: true });
  };

  const handlePointerLeave = () => {
    setPointerTilt({ rx: 0, ry: 0 });
    setPointerLight((prev) => ({ ...prev, active: false }));
    setCanvasPointer((prev) => ({ ...prev, vx: 0, vy: 0, active: false }));
  };

  const handleVideoUpload = async (stageKey: VideoStageKey, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setStudioMessage('Please choose a valid MP4, WebM, or MOV video file.');
      return;
    }
    setSavingStage(stageKey);
    setStudioMessage('');
    const saved = await saveProductVideo(watch.id, stageKey, file, file.name);
    setSavingStage(null);
    if (!saved) {
      setStudioMessage('Could not store video locally in this browser.');
      return;
    }
    const nextUrl = URL.createObjectURL(saved.blob);
    if (stageKey === 'reveal') {
      setRevealUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setRevealName(saved.fileName);
    } else {
      setActionUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setActionName(saved.fileName);
    }
    setStudioMessage(
      stageKey === 'reveal'
        ? 'Tap 1 (Reveal) custom clip saved locally.'
        : 'Tap 2 (Action) custom clip saved locally.'
    );
  };

  const handleRemoveClip = async (stageKey: VideoStageKey) => {
    await removeProductVideo(watch.id, stageKey);
    if (stageKey === 'reveal') {
      setRevealUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setRevealName('');
      if (stage === 'reveal') returnToPhoto();
    } else {
      setActionUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setActionName('');
      if (stage === 'action') returnToPhoto();
    }
    setStudioMessage('Custom clip removed — automatic cinema animation active.');
  };

  const isLive = stage !== 'photo';
  const showCustomVideoLayer =
    (stage === 'reveal' && hasCustomReveal) || (stage === 'action' && hasCustomAction);

  const stageHint =
    stage === 'photo'
      ? 'Tap product to animate'
      : stage === 'reveal'
      ? profile.tap2Prompt
      : `${profile.activeLabel} · Tap or glide to interact`;

  const recoil = getRecoilKeyframes(profile.actionKind);

  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl overflow-hidden bg-[#FCFBFA] border border-stone-200/90 shadow-[0_20px_44px_-18px_rgba(24,24,27,0.16)]">
        {/* Clean Light Top Controls Bar (appears seamlessly once activated) */}
        <AnimatePresence initial={false}>
          {isLive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-[#FCFBFA] border-b border-stone-200/80 overflow-hidden"
            >
              <div className="min-w-0 flex items-center gap-2 text-zinc-900">
                <span className="w-6 h-6 rounded-lg bg-stone-100 border border-stone-200/90 flex items-center justify-center shrink-0 text-zinc-700">
                  <Sparkles size={13} />
                </span>
                <p className="text-[11.5px] font-semibold tracking-tight truncate">
                  {stage === 'action' ? profile.activeLabel : profile.title}
                </p>
                {verifyingOnline && (
                  <Loader2 size={12} className="animate-spin text-zinc-400 shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setGlobalSoundMuted(!muted)}
                  className="min-h-[32px] min-w-[32px] px-2 rounded-lg bg-stone-100 hover:bg-stone-200/80 border border-stone-200/90 text-[11px] font-medium text-zinc-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <VolumeX size={13} className="text-zinc-500" /> : <Volume2 size={13} />}
                </button>

                <button
                  type="button"
                  onClick={triggerStage1Reveal}
                  className="min-h-[32px] min-w-[32px] px-2 rounded-lg bg-stone-100 hover:bg-stone-200/80 border border-stone-200/90 text-[11px] font-medium text-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Replay reveal animation"
                  title="Replay"
                >
                  <RotateCcw size={12} />
                </button>

                <button
                  type="button"
                  onClick={returnToPhoto}
                  className="min-h-[32px] px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200/80 border border-stone-200/90 text-[11px] font-medium text-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ImageIcon size={12} />
                  <span>Photo</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Aesthetic Interactive High-GPU Cinema Stage */}
        <div
          data-sound="none"
          onClick={handleStageClick}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (stage === 'photo') {
                triggerStage1Reveal();
              } else {
                triggerStage2Action({ x: 0.5, y: 0.45 });
              }
            }
          }}
          style={{
            perspective: 950,
            background: isLive
              ? profile.studioBackground
              : 'radial-gradient(circle at 50% 36%, #FFFFFF 0%, #F6F4EF 64%, #EBE7DF 100%)',
          }}
          aria-label={`Interactive studio showcase of ${
            watch.product_name || `${watch.brand} ${watch.model}`
          }. ${stageHint}`}
          className="group relative aspect-square w-full overflow-hidden cursor-pointer select-none transition-[background] duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
        >
          {/* Soft Ambient Depth-of-Field Studio Backlight */}
          <AnimatePresence>
            {isLive && !showCustomVideoLayer && watch.image_url && (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: profile.isTwilight ? 0.24 : 0.16 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
                className="pointer-events-none absolute -inset-6 z-0 scale-110 blur-2xl saturate-125"
                style={{
                  backgroundImage: `url(${watch.image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            )}
          </AnimatePresence>

          {/* Living Gimbal + Physical Touch-Recoil Real Product Photo Layer */}
          <motion.div
            key={`cinema-motion-${watch.id}-${burstCount}`}
            animate={
              stage === 'photo'
                ? { scale: 1, rotate: 0, y: 0 }
                : stage === 'action' && !showCustomVideoLayer
                ? {
                    scale: recoil.scale,
                    rotate: recoil.rotate,
                    y: recoil.y,
                  }
                : {
                    scale: [0.97, 1.09, 1.065],
                    rotate: [0, -0.8, 0.5, 0],
                    y: [12, -6, 0],
                  }
            }
            transition={
              stage === 'photo'
                ? { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
                : stage === 'action' && !showCustomVideoLayer
                ? recoil.transition
                : { duration: 1.25, ease: [0.16, 1, 0.3, 1] }
            }
            className={`relative z-10 w-full h-full will-change-transform transition-opacity duration-200 ${
              showCustomVideoLayer ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <motion.div
              animate={
                isLive && !showCustomVideoLayer
                  ? {
                      y: [0, -3.5, 1.5, 0],
                      rotateX: pointerTilt.rx,
                      rotateY: pointerTilt.ry,
                    }
                  : { y: 0, rotateX: 0, rotateY: 0 }
              }
              transition={
                isLive
                  ? {
                      y: { duration: 4.4, repeat: Infinity, ease: 'easeInOut' },
                      rotateX: { type: 'spring', stiffness: 180, damping: 22 },
                      rotateY: { type: 'spring', stiffness: 180, damping: 22 },
                    }
                  : { duration: 0.25 }
              }
              className="w-full h-full"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <WatchImage
                src={watch.image_url}
                alt={`${watch.brand} ${watch.model}`}
                brand={watch.brand}
                model={watch.model}
                category={watch.category}
                iconSize={56}
                className={
                  isLive
                    ? 'scale-[1.01]'
                    : 'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]'
                }
              />
            </motion.div>
          </motion.div>

          {/* Real-Time Pointer-Tracked Directional Studio Key-Light Specular Reflection */}
          {isLive && !showCustomVideoLayer && pointerLight.active && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 mix-blend-soft-light transition-opacity duration-200"
              style={{
                background: `radial-gradient(circle at ${pointerLight.x}% ${pointerLight.y}%, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0) 64%)`,
              }}
            />
          )}

          {/* Realistic Commercial Studio Key-Light Specular Sweep */}
          <AnimatePresence>
            {isLive && !showCustomVideoLayer && (
              <motion.div
                key={`studio-sheen-${lightSweepKey}`}
                aria-hidden="true"
                initial={{ x: '-120%', opacity: 0 }}
                animate={{ x: '130%', opacity: [0, 0.72, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute inset-y-0 w-[55%] z-10 mix-blend-soft-light"
                style={{
                  background:
                    'linear-gradient(108deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 100%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* Crisp Tactile Touch Ripple at Exact Tap Coordinate */}
          <AnimatePresence>
            {stage === 'action' && burstCount > 0 && !showCustomVideoLayer && (
              <motion.span
                key={`tap-ripple-${burstCount}`}
                aria-hidden="true"
                initial={{ scale: 0.2, opacity: 0.75 }}
                animate={{ scale: 2.3, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  left: `${burstOrigin.x * 100}%`,
                  top: `${burstOrigin.y * 100}%`,
                }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/80 z-30 shadow-[0_0_24px_rgba(255,255,255,0.55)]"
              />
            )}
          </AnimatePresence>

          {/* High-GPU 1200+ Particle Pointer-Reactive Fluid & Optical Physics Canvas */}
          <CinemaProductCanvas
            actionKind={profile.actionKind}
            active={isLive && !showCustomVideoLayer}
            burstCount={burstCount}
            burstOrigin={burstOrigin}
            pointer={canvasPointer}
          />

          {/* Realistic Sleek Smartphone Fast-Charging HUD (ONLY for verified Power Banks & Chargers) */}
          <AnimatePresence>
            {profile.actionKind === 'power' && isLive && !showCustomVideoLayer && (
              <motion.div
                initial={{ opacity: 0, y: 26, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="pointer-events-none absolute bottom-3.5 right-3.5 z-30 rounded-2xl bg-zinc-950/90 text-white px-3.5 py-2.5 shadow-[0_16px_32px_-8px_rgba(9,9,11,0.5)] border border-emerald-400/30 backdrop-blur-md min-w-[164px]"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    {stage === 'action' ? (
                      <Zap size={14} className="shrink-0 fill-emerald-400 animate-pulse" />
                    ) : (
                      <BatteryCharging size={15} className="shrink-0" />
                    )}
                    <span className="text-[10px] font-bold tracking-wide uppercase">
                      {stage === 'action' ? 'Turbo Charge' : 'Charging'}
                    </span>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-white">
                    {chargeLevel}%
                  </span>
                </div>
                {(profile.specBadge || watch.capacity_spec) && (
                  <p className="text-[9.5px] text-emerald-200/85 font-medium mt-0.5 truncate">
                    {profile.specBadge || watch.capacity_spec}
                  </p>
                )}
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400"
                    animate={{ width: `${chargeLevel}%` }}
                    transition={{ duration: 0.12 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Optional Custom Local MP4 Clips (Stage 1 Reveal & Stage 2 Action) */}
          {revealUrl && (
            <video
              ref={revealVideoRef}
              src={revealUrl}
              playsInline
              preload="auto"
              muted={muted}
              className={`absolute inset-0 w-full h-full object-cover z-20 transition-opacity duration-200 ${
                stage === 'reveal' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          )}
          {actionUrl && (
            <video
              ref={actionVideoRef}
              src={actionUrl}
              playsInline
              preload="auto"
              muted={muted}
              className={`absolute inset-0 w-full h-full object-cover z-20 transition-opacity duration-200 ${
                stage === 'action' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          )}
        </div>
      </div>

      {/* Clean Minimal Caption + Staff Optional Custom Video Clip Drawer */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] text-zinc-500">{stageHint}</p>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setStudioOpen((v) => !v)}
            className="text-[11px] font-medium text-zinc-700 hover:text-zinc-950 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Film size={12} />
            <span>{hasCustomReveal || hasCustomAction ? 'Custom Clips' : 'Custom Video'}</span>
          </button>
        )}
      </div>

      {/* Staff-Only Local Custom Video Override (IndexedDB — 0 Cloud Storage) */}
      <AnimatePresence initial={false}>
        {isAdmin && studioOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-stone-200 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-emerald-600 shrink-0" />
                    <span>AI Auto Animation</span>
                  </p>
                  <p className="text-[10.5px] text-zinc-500 truncate">
                    {profile.verifiedProductType || profile.title} · {profile.actionKind}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={verifyingOnline}
                  onClick={() => void handleForceReanalyzeAi()}
                  className="min-h-[30px] px-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw size={11} className={verifyingOnline ? 'animate-spin' : ''} />
                  <span>{verifyingOnline ? 'Analyzing...' : 'Re-Analyze AI'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-zinc-900">Optional Custom MP4 Clips</p>
                <span className="text-[10.5px] text-zinc-500">Saved locally on device</span>
              </div>

              <input
                ref={revealInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  void handleVideoUpload('reveal', e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              <input
                ref={actionInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  void handleVideoUpload('action', e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />

              <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-stone-200 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">Tap 1 · Reveal / Unbox</p>
                  <p className="text-[10.5px] text-zinc-500 truncate">
                    {revealName || 'Using auto cinema reveal'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={savingStage === 'reveal'}
                    onClick={() => revealInputRef.current?.click()}
                    className="min-h-[30px] px-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={11} />
                    <span>{hasCustomReveal ? 'Replace' : 'Upload'}</span>
                  </button>
                  {hasCustomReveal && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveClip('reveal')}
                      className="min-h-[30px] min-w-[30px] rounded-md bg-stone-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                      aria-label="Remove reveal clip"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-stone-200 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">Tap 2 · Live Action</p>
                  <p className="text-[10.5px] text-zinc-500 truncate">
                    {actionName || `Using auto ${profile.title.toLowerCase()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={savingStage === 'action'}
                    onClick={() => actionInputRef.current?.click()}
                    className="min-h-[30px] px-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={11} />
                    <span>{hasCustomAction ? 'Replace' : 'Upload'}</span>
                  </button>
                  {hasCustomAction && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveClip('action')}
                      className="min-h-[30px] min-w-[30px] rounded-md bg-stone-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                      aria-label="Remove action clip"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {studioMessage && (
                <p className="text-[11px] text-emerald-700 font-medium">{studioMessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
