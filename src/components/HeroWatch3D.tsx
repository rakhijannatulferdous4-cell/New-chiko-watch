import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Pause,
  Play,
  Shuffle,
  Sparkles,
  Watch,
} from 'lucide-react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BuiltModel,
  createShowcaseModel,
  ResourceTracker,
  SharedShowcaseMaterials,
  SHOWCASE_CATEGORY_GROUPS,
  SHOWCASE_CHOREOGRAPHIES,
  SHOWCASE_FINISHES,
  SHOWCASE_MODELS,
  ShowcaseCategoryGroup,
  ShowcaseModelId,
} from '../services/heroShowcase3D';

// Pre-allocated math helpers (zero GC inside animation loop)
const _colorPrimary = new THREE.Color();
const _colorSecondary = new THREE.Color();
const _colorAccent = new THREE.Color();
const _colorRim = new THREE.Color();
const _particleDummy = new THREE.Object3D();

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(9, 9, 11, 0.26)');
    grad.addColorStop(0.55, 'rgba(9, 9, 11, 0.08)');
    grad.addColorStop(1, 'rgba(9, 9, 11, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function HeroWatch3D() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const [categoryGroup, setCategoryGroup] = useState<ShowcaseCategoryGroup>('All');
  const [modelIdx, setModelIdx] = useState(0);
  const [finishIdx, setFinishIdx] = useState(0);
  const [choreoIdx, setChoreoIdx] = useState(0);
  const [autoCycle, setAutoCycle] = useState(true);

  const filteredModels = useMemo(() => {
    if (categoryGroup === 'All') return SHOWCASE_MODELS;
    return SHOWCASE_MODELS.filter((m) => m.group === categoryGroup);
  }, [categoryGroup]);

  const safeIdx = filteredModels.length > 0 ? modelIdx % filteredModels.length : 0;
  const currentModel = filteredModels[safeIdx] || SHOWCASE_MODELS[0];
  const currentChoreo = SHOWCASE_CHOREOGRAPHIES[choreoIdx] || SHOWCASE_CHOREOGRAPHIES[0];

  // Live mutable refs so WebGL never re-initializes on React state changes
  const activeModelRef = useRef(currentModel);
  const activeFinishRef = useRef(0);
  const activeChoreoRef = useRef(0);
  const isUserDraggingRef = useRef(false);

  useEffect(() => {
    activeModelRef.current = currentModel;
  }, [currentModel]);

  useEffect(() => {
    activeFinishRef.current = finishIdx;
  }, [finishIdx]);

  useEffect(() => {
    activeChoreoRef.current = choreoIdx;
  }, [choreoIdx]);

  // Smoothly auto-cycle through all 32 completely unique 3D electronics & watch products
  useEffect(() => {
    if (!autoCycle || filteredModels.length <= 1) return;
    const timer = window.setInterval(() => {
      if (isUserDraggingRef.current) return;
      setModelIdx((prev) => {
        const next = (prev + 1) % filteredModels.length;
        if (next % 2 === 0) {
          setFinishIdx((f) => (f + 1) % SHOWCASE_FINISHES.length);
        }
        return next;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoCycle, filteredModels.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = Math.max(container.clientWidth, 240);
    const height = Math.max(container.clientHeight, 220);

    let renderer: THREE.WebGLRenderer;
    let envRT: THREE.WebGLRenderTarget;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    camera.position.set(0, 0.04, 5.45);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'pan-y';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // Balanced warm/cool studio 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0xf1f5f9, 0x18181b, 0.96);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.5);
    keyLight.position.set(3.8, 4.8, 5.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffe4b5, 1.8);
    rimLight.position.set(-4.2, -1.5, -3.2);
    scene.add(rimLight);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const tracker: ResourceTracker = {
      geo: <T extends THREE.BufferGeometry>(g: T): T => {
        geometries.push(g);
        return g;
      },
      mat: <T extends THREE.Material>(m: T): T => {
        materials.push(m);
        return m;
      },
      tex: <T extends THREE.Texture>(t: T): T => {
        textures.push(t);
        return t;
      },
    };

    const initialFinish = SHOWCASE_FINISHES[0];
    const sharedMats: SharedShowcaseMaterials = {
      primaryMetal: tracker.mat(
        new THREE.MeshPhysicalMaterial({
          color: initialFinish.primaryHex,
          metalness: initialFinish.metalness,
          roughness: initialFinish.roughness,
          anisotropy: 0.7,
          clearcoat: 0.55,
          clearcoatRoughness: 0.14,
        })
      ),
      secondaryBody: tracker.mat(
        new THREE.MeshPhysicalMaterial({
          color: initialFinish.secondaryHex,
          metalness: 0.76,
          roughness: 0.34,
          clearcoat: 0.3,
          clearcoatRoughness: 0.22,
        })
      ),
      matteTrim: tracker.mat(
        new THREE.MeshStandardMaterial({
          color: 0x151518,
          metalness: 0.18,
          roughness: 0.72,
        })
      ),
      polishedChrome: tracker.mat(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.98,
          roughness: 0.08,
        })
      ),
      accentGlow: tracker.mat(
        new THREE.MeshStandardMaterial({
          color: initialFinish.accentHex,
          emissive: new THREE.Color(initialFinish.accentHex),
          emissiveIntensity: 0.45,
          metalness: 0.78,
          roughness: 0.22,
        })
      ),
      glass: tracker.mat(
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.0,
          roughness: 0.04,
          transparent: true,
          opacity: 0.22,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          depthWrite: false,
        })
      ),
      orbitRingMat: tracker.mat(
        new THREE.MeshBasicMaterial({
          color: 0x8a7962,
          transparent: true,
          opacity: 0.26,
        })
      ),
    };

    const stageRoot = new THREE.Group();
    scene.add(stageRoot);

    const modelPivot = new THREE.Group();
    stageRoot.add(modelPivot);

    // Lazy cache of all 32 distinct bespoke 3D hardware models (instant startup!)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const builtCache = new Map<ShowcaseModelId, BuiltModel>();
    const modelScales = new Map<ShowcaseModelId, number>();

    const ensureModelBuilt = (id: ShowcaseModelId): BuiltModel => {
      const existing = builtCache.get(id);
      if (existing) return existing;
      const built = createShowcaseModel(id, sharedMats, tracker, maxAniso);
      built.root.scale.setScalar(0.001);
      built.root.visible = false;
      modelPivot.add(built.root);
      builtCache.set(id, built);
      modelScales.set(id, 0.001);
      return built;
    };

    // Build initial model immediately at full scale
    const initialModel = ensureModelBuilt(activeModelRef.current.id);
    initialModel.root.visible = true;
    initialModel.root.scale.setScalar(0.95);
    modelScales.set(activeModelRef.current.id, 0.95);

    // Triple Counter-Rotating Precision Astrolabe Rings
    const ringOuter = new THREE.Mesh(
      tracker.geo(new THREE.TorusGeometry(1.68, 0.007, 12, 96)),
      sharedMats.orbitRingMat
    );
    ringOuter.rotation.set(Math.PI * 0.38, -Math.PI * 0.14, 0);
    stageRoot.add(ringOuter);

    const ringMid = new THREE.Mesh(
      tracker.geo(new THREE.TorusGeometry(1.48, 0.0055, 10, 84)),
      sharedMats.orbitRingMat
    );
    ringMid.rotation.set(-Math.PI * 0.34, Math.PI * 0.24, 0);
    stageRoot.add(ringMid);

    const ringAccentArc = new THREE.Mesh(
      tracker.geo(new THREE.TorusGeometry(1.58, 0.013, 10, 64, Math.PI * 0.62)),
      sharedMats.accentGlow
    );
    ringAccentArc.rotation.set(Math.PI * 0.42, 0.2, 0);
    stageRoot.add(ringAccentArc);

    // 110 Instanced Orbital Studio Shimmer Particles
    const PARTICLE_COUNT = 110;
    const particleGeo = tracker.geo(new THREE.OctahedronGeometry(0.02, 0));
    const particleMat = tracker.mat(
      new THREE.MeshStandardMaterial({
        color: 0xd4b26a,
        metalness: 0.9,
        roughness: 0.2,
        transparent: true,
        opacity: 0.62,
      })
    );
    const particles = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT);
    particles.frustumCulled = false;
    const pRadii = new Float32Array(PARTICLE_COUNT);
    const pAngles = new Float32Array(PARTICLE_COUNT);
    const pSpeeds = new Float32Array(PARTICLE_COUNT);
    const pHeights = new Float32Array(PARTICLE_COUNT);
    const pScales = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pRadii[i] = 1.4 + ((i * 37) % 100) * 0.011;
      pAngles[i] = (i / PARTICLE_COUNT) * Math.PI * 2;
      pSpeeds[i] = (i % 2 === 0 ? 1 : -1) * (0.14 + ((i * 19) % 10) * 0.024);
      pHeights[i] = (((i * 29) % 100) / 100 - 0.5) * 2.1;
      pScales[i] = 0.45 + ((i * 13) % 10) * 0.09;
    }
    stageRoot.add(particles);

    // Soft Grounded Contact Shadow Plane
    const shadowTex = tracker.tex(createContactShadowTexture());
    const contactShadow = new THREE.Mesh(
      tracker.geo(new THREE.PlaneGeometry(2.5, 2.5)),
      tracker.mat(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.68,
        })
      )
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -1.58;
    scene.add(contactShadow);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer drag & hover tilt
    let targetRotX = 0.14;
    let targetRotY = -0.22;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      isUserDraggingRef.current = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        dragOffsetY += dx * 0.013;
        dragOffsetX = THREE.MathUtils.clamp(dragOffsetX + dy * 0.01, -0.78, 0.78);
      } else if (e.pointerType === 'mouse') {
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        targetRotY = nx * 0.85;
        targetRotX = -ny * 0.55;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      isUserDraggingRef.current = false;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let disposed = false;
    let rafId = 0;
    let timeoutId = 0;
    let resizeRaf = 0;
    let lastW = width;
    let lastH = height;
    let currentExplode = 0;
    const clock = new THREE.Clock();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const w = Math.max(Math.round(entry.contentRect.width), 160);
      const h = Math.max(Math.round(entry.contentRect.height), 160);
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (disposed) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      });
    });
    resizeObserver.observe(container);

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        timeoutId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      const model = activeModelRef.current;
      const finish = SHOWCASE_FINISHES[activeFinishRef.current] || SHOWCASE_FINISHES[0];
      const choreo = SHOWCASE_CHOREOGRAPHIES[activeChoreoRef.current] || SHOWCASE_CHOREOGRAPHIES[0];

      // Ensure currently selected bespoke 3D model is built
      ensureModelBuilt(model.id);

      // 1. Smooth PBR finish + per-model accent / RGB cycle blending
      const lerpAlpha = 1 - Math.exp(-4.8 * dt);
      _colorPrimary.setHex(finish.primaryHex);
      _colorSecondary.setHex(finish.secondaryHex);
      if (model.rgbCycle) {
        _colorAccent.setHSL((elapsed * 0.24) % 1, 0.92, 0.58);
        _colorRim.copy(_colorAccent);
      } else {
        _colorAccent.setHex(model.tintHex ?? finish.accentHex);
        _colorRim.setHex(finish.rimHex);
      }

      sharedMats.primaryMetal.color.lerp(_colorPrimary, lerpAlpha);
      sharedMats.primaryMetal.metalness = THREE.MathUtils.damp(
        sharedMats.primaryMetal.metalness,
        finish.metalness,
        5,
        dt
      );
      sharedMats.primaryMetal.roughness = THREE.MathUtils.damp(
        sharedMats.primaryMetal.roughness,
        finish.roughness,
        5,
        dt
      );
      sharedMats.secondaryBody.color.lerp(_colorSecondary, lerpAlpha);
      sharedMats.accentGlow.color.lerp(_colorAccent, lerpAlpha);
      sharedMats.accentGlow.emissive.lerp(_colorAccent, lerpAlpha);
      particleMat.color.lerp(_colorAccent, lerpAlpha);
      rimLight.color.lerp(_colorRim, lerpAlpha);

      rimLight.position.x = Math.cos(elapsed * 0.55) * 4.5;
      rimLight.position.z = Math.sin(elapsed * 0.55) * 3.8;

      // 2. Smooth exploded-view factor
      const breathingExplode =
        choreo.explodeTarget > 0.5
          ? 0.56 + Math.sin(elapsed * 1.45) * 0.36
          : choreo.explodeTarget;
      currentExplode = THREE.MathUtils.damp(currentExplode, breathingExplode, 4.2, dt);

      // 3. Smooth morph transitions across cached bespoke 3D models
      builtCache.forEach((built, id) => {
        const isTarget = id === model.id;
        const curScale = modelScales.get(id) ?? 0.001;
        const nextScale = THREE.MathUtils.damp(curScale, isTarget ? 0.95 : 0.001, 7.6, dt);
        modelScales.set(id, nextScale);
        const visible = nextScale > 0.02;
        built.root.visible = visible;
        if (visible) {
          built.root.scale.setScalar(nextScale);
          built.update(elapsed, dt, currentExplode);
        }
      });

      // 4. Levitation + triple gyroscope rings + 110 orbital particles
      const floatY = Math.sin(elapsed * 1.55) * 0.08;
      stageRoot.position.y = floatY;
      contactShadow.scale.setScalar(1 - floatY * 0.85);

      ringOuter.rotation.z = elapsed * choreo.orbitSpeed;
      ringMid.rotation.z = -elapsed * (choreo.orbitSpeed * 1.35);
      ringAccentArc.rotation.z = elapsed * (choreo.orbitSpeed * 1.7);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ang = pAngles[i] + elapsed * pSpeeds[i] * (0.7 + choreo.orbitSpeed);
        const rad = pRadii[i] * (0.94 + Math.sin(elapsed * 0.9 + i) * 0.08);
        _particleDummy.position.set(
          Math.cos(ang) * rad,
          pHeights[i] + Math.sin(elapsed * 1.2 + i * 0.7) * 0.14,
          Math.sin(ang) * rad * 0.72
        );
        _particleDummy.rotation.set(elapsed + i, elapsed * 0.7, 0);
        const s = pScales[i] * choreo.particleScale * (0.75 + Math.sin(elapsed * 2.4 + i) * 0.25);
        _particleDummy.scale.setScalar(s);
        _particleDummy.updateMatrix();
        particles.setMatrixAt(i, _particleDummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      // 5. Kinetic choreography + interactive 360° drag damping
      let idleYaw = Math.sin(elapsed * 0.65) * 0.44;
      let idlePitch = Math.cos(elapsed * 0.5) * 0.11 + 0.1;
      if (choreo.yawMode === 'spin') {
        idleYaw = elapsed * 0.64;
        idlePitch = 0.15 + Math.sin(elapsed * 0.9) * 0.08;
      } else if (choreo.yawMode === 'hero') {
        idleYaw = Math.sin(elapsed * 0.55) * 0.68;
        idlePitch = 0.18 + Math.cos(elapsed * 0.6) * 0.1;
      } else if (choreo.yawMode === 'pulse') {
        idleYaw = Math.sin(elapsed * 0.95) * 0.55;
        idlePitch = 0.12 + Math.sin(elapsed * 1.9) * 0.09;
      } else if (choreo.yawMode === 'cinematic') {
        idleYaw = elapsed * 0.36 + Math.sin(elapsed * 0.7) * 0.3;
        idlePitch = 0.2 + Math.cos(elapsed * 0.45) * 0.13;
      }

      if (!isDragging) {
        dragOffsetX = THREE.MathUtils.damp(dragOffsetX, 0, 2.4, dt);
        dragOffsetY = THREE.MathUtils.damp(dragOffsetY, 0, 1.8, dt);
      }

      modelPivot.rotation.x = THREE.MathUtils.damp(
        modelPivot.rotation.x,
        idlePitch + targetRotX * 0.42 + dragOffsetX,
        6,
        dt
      );
      modelPivot.rotation.y = THREE.MathUtils.damp(
        modelPivot.rotation.y,
        idleYaw + targetRotY * 0.55 + dragOffsetY,
        6,
        dt
      );

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(resizeRaf);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      envRT.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  const handleCategoryChange = (group: ShowcaseCategoryGroup) => {
    setCategoryGroup(group);
    setModelIdx(0);
  };

  const handlePrevModel = () => {
    setModelIdx((i) => (i - 1 + filteredModels.length) % filteredModels.length);
  };

  const handleNextModel = () => {
    setModelIdx((i) => (i + 1) % filteredModels.length);
  };

  const handleShuffle = () => {
    if (filteredModels.length <= 1) return;
    let next = Math.floor(Math.random() * filteredModels.length);
    if (next === safeIdx) next = (safeIdx + 1) % filteredModels.length;
    setModelIdx(next);
    setFinishIdx((f) => (f + 1) % SHOWCASE_FINISHES.length);
  };

  if (webglFailed) {
    return (
      <div
        className="relative w-full h-full min-h-[240px] flex items-center justify-center select-none"
        aria-label="New Chiko Watch 3D Showcase"
      >
        <div className="w-24 h-24 rounded-full border border-stone-300 bg-white/85 flex items-center justify-center shadow-sm">
          <Watch size={40} className="text-zinc-800" strokeWidth={1.35} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col select-none">
      {/* 100% UNOBSTRUCTED 3D STAGE — Zero Buttons or Controls Overlaying the Model */}
      <div className="relative flex-1 w-full min-h-[240px] sm:min-h-[290px]">
        <div
          ref={containerRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          aria-label={`Interactive 3D ${currentModel.name} — ${SHOWCASE_MODELS.length} unique electronics models`}
        />
      </div>

      {/* DEDICATED COMPACT CONTROL STRIP COMPLETELY BELOW THE 3D MODEL */}
      <div className="relative z-10 border-t border-stone-200/90 bg-[#FAF8F4] px-2.5 sm:px-3 py-2 space-y-1.5">
        {/* Row 1: Model Info + Prev/Next/Shuffle/Motion/Play */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-stone-500 truncate">
              {currentModel.category} · {safeIdx + 1}/{filteredModels.length}
              {categoryGroup === 'All' ? ' Unique 3D' : ''}
            </p>
            <p className="text-xs font-semibold text-[#09090B] truncate leading-tight">
              {currentModel.name}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handlePrevModel}
              className="h-7 w-7 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Previous 3D model"
              title="Previous 3D model"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={handleNextModel}
              className="h-7 w-7 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Next 3D model"
              title="Next 3D model"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={handleShuffle}
              className="h-7 w-7 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Random 3D model"
              title="Random 3D product"
            >
              <Shuffle size={12} />
            </button>
            <button
              type="button"
              onClick={() => setChoreoIdx((c) => (c + 1) % SHOWCASE_CHOREOGRAPHIES.length)}
              className="h-7 px-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-[10.5px] font-medium text-zinc-800 flex items-center gap-1 transition-colors cursor-pointer"
              title={`3D Motion: ${currentChoreo.name}`}
            >
              {choreoIdx === 1 ? <Layers size={11} /> : <Sparkles size={11} />}
              <span className="hidden sm:inline">{currentChoreo.name}</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoCycle((v) => !v)}
              className="h-7 w-7 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={autoCycle ? 'Pause auto showcase' : 'Play auto showcase'}
              title={autoCycle ? 'Pause auto-rotate' : 'Play auto-rotate'}
            >
              {autoCycle ? <Pause size={11} /> : <Play size={11} />}
            </button>
          </div>
        </div>

        {/* Row 2: Category Quick-Switch + 6 Luxury Color Swatches */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {SHOWCASE_CATEGORY_GROUPS.map((grp) => {
              const active = categoryGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => handleCategoryChange(grp)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#09090B] text-white'
                      : 'bg-white border border-stone-200 text-stone-600 hover:text-[#09090B]'
                  }`}
                >
                  {grp === 'All' ? `All (${SHOWCASE_MODELS.length})` : grp}
                </button>
              );
            })}
          </div>

          <div
            className="flex items-center gap-1.5 shrink-0 pl-1.5 border-l border-stone-200"
            role="group"
            aria-label="Material finish colors"
          >
            {SHOWCASE_FINISHES.map((fin, idx) => (
              <button
                key={fin.id}
                type="button"
                onClick={() => setFinishIdx(idx)}
                title={fin.name}
                aria-label={`Color: ${fin.name}`}
                className={`h-3.5 w-3.5 rounded-full border transition-transform cursor-pointer ${
                  finishIdx === idx
                    ? 'scale-120 border-[#09090B] ring-2 ring-zinc-900/20'
                    : 'border-stone-300 hover:scale-110'
                }`}
                style={{ backgroundColor: fin.swatchCss }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
