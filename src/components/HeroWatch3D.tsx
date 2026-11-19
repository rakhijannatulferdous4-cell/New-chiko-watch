import React, { useEffect, useRef, useState } from 'react';
import { Watch } from 'lucide-react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

function createDialTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    // Deep sunburst obsidian dial
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, size * 0.48);
    grad.addColorStop(0, '#1c1c21');
    grad.addColorStop(0.65, '#0b0b0e');
    grad.addColorStop(1, '#050507');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle concentric guilloche rings
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let r = 48; r <= 200; r += 26) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer minute track
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const isHour = i % 5 === 0;
      const rOuter = 224;
      const rInner = isHour ? 206 : 215;
      ctx.strokeStyle = isHour ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.34)';
      ctx.lineWidth = isHour ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
      ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
      ctx.stroke();
    }

    // Chronograph sub-dial rings
    const subOffsets = [
      { x: cx - 70, y: cy },
      { x: cx + 70, y: cy },
      { x: cx, y: cy + 72 },
    ];
    for (const sub of subOffsets) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sub.x, sub.y, 40, 0, Math.PI * 2);
      ctx.stroke();

      for (let t = 0; t < 12; t++) {
        const a = (t / 12) * Math.PI * 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sub.x + Math.cos(a) * 32, sub.y + Math.sin(a) * 32);
        ctx.lineTo(sub.x + Math.cos(a) * 38, sub.y + Math.sin(a) * 38);
        ctx.stroke();
      }
    }

    // Crisp monochrome dial wordmark
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('CHIKO', cx, cy - 82);

    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText('CHRONOGRAPH', cx, cy - 62);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);
  tex.needsUpdate = true;
  return tex;
}

export function HeroWatch3D() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

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
    const height = Math.max(container.clientHeight, 160);

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

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 0.15, 5.2);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
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

    // Studio 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0xf4f4f5, 0x09090b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3.5, 4.5, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd4d4d8, 1.5);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    // Track geometries & materials for clean disposal
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };

    const brushedSteelMat = regMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xe4e4e7,
        metalness: 0.94,
        roughness: 0.2,
        clearcoat: 0.4,
        clearcoatRoughness: 0.15,
      })
    );

    const darkTitaniumMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x18181b,
        metalness: 0.82,
        roughness: 0.32,
      })
    );

    const matteStrapMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x121215,
        metalness: 0.25,
        roughness: 0.68,
      })
    );

    const polishedChromeMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.98,
        roughness: 0.08,
      })
    );

    const glassMat = regMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.05,
        transparent: true,
        opacity: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        depthWrite: false,
      })
    );

    const dialTex = createDialTexture(renderer.capabilities.getMaxAnisotropy());
    textures.push(dialTex);

    const dialMat = regMat(
      new THREE.MeshStandardMaterial({
        map: dialTex,
        metalness: 0.35,
        roughness: 0.45,
      })
    );

    // Master watch group
    const watchRoot = new THREE.Group();
    scene.add(watchRoot);

    const watchGroup = new THREE.Group();
    watchRoot.add(watchGroup);

    // 1. Main circular watch case
    const caseGeo = regGeo(new THREE.CylinderGeometry(1.12, 1.08, 0.28, 64));
    caseGeo.rotateX(Math.PI / 2);
    const caseMesh = new THREE.Mesh(caseGeo, brushedSteelMat);
    watchGroup.add(caseMesh);

    // 2. Sculpted dark tachymeter bezel ring
    const bezelGeo = regGeo(new THREE.TorusGeometry(1.03, 0.1, 24, 64));
    const bezelMesh = new THREE.Mesh(bezelGeo, darkTitaniumMat);
    bezelMesh.position.z = 0.12;
    watchGroup.add(bezelMesh);

    const innerRimGeo = regGeo(new THREE.TorusGeometry(0.95, 0.025, 16, 64));
    const innerRimMesh = new THREE.Mesh(innerRimGeo, polishedChromeMat);
    innerRimMesh.position.z = 0.14;
    watchGroup.add(innerRimMesh);

    // 3. Dial face
    const dialGeo = regGeo(new THREE.CircleGeometry(0.96, 64));
    const dialMesh = new THREE.Mesh(dialGeo, dialMat);
    dialMesh.position.z = 0.145;
    watchGroup.add(dialMesh);

    // 4. 12 Applied chrome hour indices via InstancedMesh
    const indexGeo = regGeo(new THREE.BoxGeometry(0.036, 0.11, 0.025));
    const indicesInstanced = new THREE.InstancedMesh(indexGeo, polishedChromeMat, 12);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 0.78;
      dummy.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.16);
      dummy.rotation.set(0, 0, -a);
      dummy.scale.set(i % 3 === 0 ? 1.35 : 1, i % 3 === 0 ? 1.15 : 1, 1);
      dummy.updateMatrix();
      indicesInstanced.setMatrixAt(i, dummy.matrix);
    }
    indicesInstanced.instanceMatrix.needsUpdate = true;
    indicesInstanced.computeBoundingSphere();
    watchGroup.add(indicesInstanced);

    // 5. Watch hands (Hour, Minute, Second) + Center Pinion
    const hourPivot = new THREE.Group();
    hourPivot.position.z = 0.18;
    const hourGeo = regGeo(new THREE.BoxGeometry(0.055, 0.48, 0.018));
    hourGeo.translate(0, 0.19, 0);
    hourPivot.add(new THREE.Mesh(hourGeo, polishedChromeMat));
    watchGroup.add(hourPivot);

    const minPivot = new THREE.Group();
    minPivot.position.z = 0.2;
    const minGeo = regGeo(new THREE.BoxGeometry(0.038, 0.68, 0.015));
    minGeo.translate(0, 0.28, 0);
    minPivot.add(new THREE.Mesh(minGeo, polishedChromeMat));
    watchGroup.add(minPivot);

    const secPivot = new THREE.Group();
    secPivot.position.z = 0.218;
    const secGeo = regGeo(new THREE.BoxGeometry(0.014, 0.84, 0.01));
    secGeo.translate(0, 0.26, 0);
    secPivot.add(new THREE.Mesh(secGeo, brushedSteelMat));
    watchGroup.add(secPivot);

    const pinionGeo = regGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 24));
    pinionGeo.rotateX(Math.PI / 2);
    const pinionMesh = new THREE.Mesh(pinionGeo, polishedChromeMat);
    pinionMesh.position.z = 0.2;
    watchGroup.add(pinionMesh);

    // 6. Fluted Crown & Chrono Pushers on right flank
    const crownGeo = regGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 24));
    crownGeo.rotateZ(Math.PI / 2);
    const crownMesh = new THREE.Mesh(crownGeo, brushedSteelMat);
    crownMesh.position.set(1.17, 0, 0);
    watchGroup.add(crownMesh);

    const pusherGeo = regGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 16));
    pusherGeo.rotateZ(Math.PI / 2);
    const topPusher = new THREE.Mesh(pusherGeo, polishedChromeMat);
    topPusher.position.set(1.08, 0.44, 0);
    topPusher.rotation.z = 0.35;
    watchGroup.add(topPusher);

    const botPusher = new THREE.Mesh(pusherGeo, polishedChromeMat);
    botPusher.position.set(1.08, -0.44, 0);
    botPusher.rotation.z = -0.35;
    watchGroup.add(botPusher);

    // 7. Lugs & Articulated Matte Strap Links (top & bottom)
    const lugGeo = regGeo(new THREE.BoxGeometry(0.16, 0.42, 0.22));
    const lugOffsets = [
      { x: -0.48, y: 1.1, rx: 0.12 },
      { x: 0.48, y: 1.1, rx: 0.12 },
      { x: -0.48, y: -1.1, rx: -0.12 },
      { x: 0.48, y: -1.1, rx: -0.12 },
    ];
    for (const l of lugOffsets) {
      const lug = new THREE.Mesh(lugGeo, brushedSteelMat);
      lug.position.set(l.x, l.y, -0.02);
      lug.rotation.x = l.rx;
      watchGroup.add(lug);
    }

    const linkGeo = regGeo(new THREE.BoxGeometry(0.84, 0.22, 0.14));
    for (let i = 0; i < 4; i++) {
      const topLink = new THREE.Mesh(linkGeo, i % 2 === 0 ? matteStrapMat : darkTitaniumMat);
      topLink.position.set(0, 1.18 + i * 0.24, -0.08 - i * 0.07);
      topLink.rotation.x = 0.22 + i * 0.12;
      watchGroup.add(topLink);

      const botLink = new THREE.Mesh(linkGeo, i % 2 === 0 ? matteStrapMat : darkTitaniumMat);
      botLink.position.set(0, -1.18 - i * 0.24, -0.08 - i * 0.07);
      botLink.rotation.x = -(0.22 + i * 0.12);
      watchGroup.add(botLink);
    }

    // 8. Domed Sapphire Glass
    const crystalGeo = regGeo(new THREE.CircleGeometry(0.95, 48));
    const crystalMesh = new THREE.Mesh(crystalGeo, glassMat);
    crystalMesh.position.z = 0.235;
    crystalMesh.renderOrder = 10;
    watchGroup.add(crystalMesh);

    // 9. Orbital precision gyroscope ring
    const orbitMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.22,
      })
    );
    const orbitGeo = regGeo(new THREE.TorusGeometry(1.55, 0.009, 12, 96));
    const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
    orbitRing.rotation.x = Math.PI * 0.36;
    orbitRing.rotation.y = -Math.PI * 0.15;
    watchRoot.add(orbitRing);

    // Interactive pointer & drag state
    let targetRotX = 0.18;
    let targetRotY = -0.35;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
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
        dragOffsetY += dx * 0.012;
        dragOffsetX = THREE.MathUtils.clamp(dragOffsetX + dy * 0.01, -0.7, 0.7);
      } else if (e.pointerType === 'mouse') {
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        targetRotY = nx * 0.85;
        targetRotX = -ny * 0.65;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Animation loop & ResizeObserver state
    let disposed = false;
    let rafId = 0;
    let timeoutId = 0;
    let resizeRaf = 0;
    let lastW = width;
    let lastH = height;
    const clock = new THREE.Clock();

    // Defer ResizeObserver buffer updates to the next animation frame & avoid CSS mutating (updateStyle = false)
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const w = Math.max(Math.round(entry.contentRect.width), 160);
      const h = Math.max(Math.round(entry.contentRect.height), 120);
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

      // Real-time mechanical watch hands
      const now = new Date();
      const secs = now.getSeconds() + now.getMilliseconds() / 1000;
      const mins = now.getMinutes() + secs / 60;
      const hrs = (now.getHours() % 12) + mins / 60;

      secPivot.rotation.z = -(secs / 60) * Math.PI * 2;
      minPivot.rotation.z = -(mins / 60) * Math.PI * 2;
      hourPivot.rotation.z = -(hrs / 12) * Math.PI * 2;

      // Idle 3D levitation + smooth showcase sweep
      watchRoot.position.y = Math.sin(elapsed * 1.5) * 0.08;
      orbitRing.rotation.z = elapsed * 0.25;

      const idleYaw = Math.sin(elapsed * 0.7) * 0.35;
      const idlePitch = Math.cos(elapsed * 0.55) * 0.12 + 0.12;

      if (!isDragging) {
        dragOffsetX = THREE.MathUtils.damp(dragOffsetX, 0, 2.5, dt);
        dragOffsetY = THREE.MathUtils.damp(dragOffsetY, 0, 2.0, dt);
      }

      const desiredX = idlePitch + targetRotX * 0.4 + dragOffsetX;
      const desiredY = idleYaw + targetRotY * 0.55 + dragOffsetY;

      watchGroup.rotation.x = THREE.MathUtils.damp(watchGroup.rotation.x, desiredX, 6, dt);
      watchGroup.rotation.y = THREE.MathUtils.damp(watchGroup.rotation.y, desiredY, 6, dt);

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

  if (webglFailed) {
    return (
      <div
        className="relative w-full h-full min-h-[150px] sm:min-h-[210px] flex items-center justify-center select-none"
        aria-label="New Chiko Watch emblem"
      >
        <div className="w-24 h-24 rounded-full border border-zinc-700 bg-zinc-900/90 flex items-center justify-center shadow-lg">
          <Watch size={40} className="text-zinc-200" strokeWidth={1.35} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[150px] sm:min-h-[210px] cursor-grab active:cursor-grabbing select-none"
      aria-label="Interactive 3D New Chiko Watch showcase"
    />
  );
}
