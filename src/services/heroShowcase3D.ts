import * as THREE from 'three';

export type ShowcaseModelId =
  | 'tourbillon'
  | 'smartwatch'
  | 'diver'
  | 'octagon_watch'
  | 'retro_digital'
  | 'wall_clock'
  | 'earbuds'
  | 'speaker'
  | 'headphones'
  | 'neckband'
  | 'microphone'
  | 'powerbank'
  | 'gancharger'
  | 'wireless_stand'
  | 'power_strip'
  | 'battery_18650'
  | 'battery_9v'
  | 'coin_cell'
  | 'rgblight'
  | 'flashlight'
  | 'ringlight'
  | 'smart_bulb'
  | 'fan'
  | 'calculator'
  | 'usbhub'
  | 'pendrive'
  | 'gaming_mouse'
  | 'mech_keyboard'
  | 'cctv_cam'
  | 'action_cam'
  | 'digital_scale'
  | 'trimmer';

export type ShowcaseCategoryGroup =
  | 'All'
  | 'Watches'
  | 'Audio & Mic'
  | 'Power & Battery'
  | 'RGB & Lights'
  | 'Fans & Gadgets'
  | 'Desk & Tech';

export interface ShowcaseModelMeta {
  id: ShowcaseModelId;
  name: string;
  category: string;
  group: Exclude<ShowcaseCategoryGroup, 'All'>;
  rgbCycle?: boolean;
  tintHex?: number;
}

export interface ShowcaseFinish {
  id: string;
  name: string;
  primaryHex: number;
  secondaryHex: number;
  accentHex: number;
  swatchCss: string;
  metalness: number;
  roughness: number;
  rimHex: number;
}

export interface ShowcaseChoreography {
  id: string;
  name: string;
  orbitSpeed: number;
  explodeTarget: number;
  yawMode: 'sweep' | 'spin' | 'hero' | 'pulse' | 'cinematic';
  particleScale: number;
}

export const SHOWCASE_CATEGORY_GROUPS: ShowcaseCategoryGroup[] = [
  'All',
  'Watches',
  'Audio & Mic',
  'Power & Battery',
  'RGB & Lights',
  'Fans & Gadgets',
  'Desk & Tech',
];

// 32 Completely Distinct, Bespoke 3D Models — ZERO rescaled duplicates!
export const SHOWCASE_MODELS: ShowcaseModelMeta[] = [
  // Watches & Timepieces (6 unique silhouettes)
  { id: 'tourbillon', name: 'Tourbillon Chrono Watch', category: 'Analog Watch', group: 'Watches' },
  { id: 'smartwatch', name: 'AMOLED Ultra Smartwatch', category: 'Smartwatch', group: 'Watches' },
  { id: 'diver', name: 'Skeleton Diver 300M', category: 'Diver Watch', group: 'Watches', tintHex: 0x10b981 },
  { id: 'octagon_watch', name: 'Royal Octagon Steel Watch', category: 'Luxury Watch', group: 'Watches' },
  { id: 'retro_digital', name: 'Classic Retro Digital Watch', category: 'Digital Watch', group: 'Watches', tintHex: 0xf59e0b },
  { id: 'wall_clock', name: 'Pendulum Showroom Clock', category: 'Wall Clock', group: 'Watches' },

  // Audio & Microphones (5 completely different devices)
  { id: 'earbuds', name: 'ANC Pro TWS Earbuds', category: 'TWS Earbuds', group: 'Audio & Mic' },
  { id: 'speaker', name: '360° Bass Bluetooth Speaker', category: 'Bluetooth Speaker', group: 'Audio & Mic', rgbCycle: true },
  { id: 'headphones', name: 'Studio ANC Over-Ear Headphones', category: 'Headphones', group: 'Audio & Mic' },
  { id: 'neckband', name: 'Magnetic Wireless Neckband', category: 'Neckband', group: 'Audio & Mic', tintHex: 0x38bdf8 },
  { id: 'microphone', name: 'Wireless Studio Condenser Mic', category: 'Microphone', group: 'Audio & Mic', tintHex: 0xf59e0b },

  // Power, Chargers & Batteries (7 completely different devices)
  { id: 'powerbank', name: 'MagSafe 20,000mAh Power Bank', category: 'Power Bank', group: 'Power & Battery' },
  { id: 'gancharger', name: 'GaN 100W Turbo Wall Charger', category: 'Fast Charger', group: 'Power & Battery', tintHex: 0x38bdf8 },
  { id: 'wireless_stand', name: '3-in-1 MagSafe Charging Stand', category: 'Wireless Dock', group: 'Power & Battery', tintHex: 0x34d399 },
  { id: 'power_strip', name: 'Smart Surge Extension Board', category: 'Power Strip', group: 'Power & Battery', tintHex: 0xf97316 },
  { id: 'battery_18650', name: '18650 3500mAh Li-Ion Battery', category: 'Li-Ion Battery', group: 'Power & Battery', tintHex: 0x10b981 },
  { id: 'battery_9v', name: '9V Smart USB-C Block Battery', category: '9V Battery', group: 'Power & Battery', tintHex: 0xfbbf24 },
  { id: 'coin_cell', name: 'CR2032 Lithium Watch Cell', category: 'Button Cell', group: 'Power & Battery' },

  // RGB & Lighting (4 completely different light fixtures)
  { id: 'rgblight', name: 'Aurora RGB Smart Light Bar', category: 'RGB Light', group: 'RGB & Lights', rgbCycle: true },
  { id: 'flashlight', name: 'Tactical 5000LM LED Torch', category: 'LED Torch', group: 'RGB & Lights', tintHex: 0xfef08a },
  { id: 'ringlight', name: '12-Inch Studio LED Ring Light', category: 'Ring Light', group: 'RGB & Lights', rgbCycle: true },
  { id: 'smart_bulb', name: 'Wi-Fi RGB Smart LED Bulb', category: 'Smart Bulb', group: 'RGB & Lights', rgbCycle: true },

  // Fans, Calculators & Smart Gadgets (5 completely different devices)
  { id: 'fan', name: 'Turbo Rechargeable Cooling Fan', category: 'Cooling Fan', group: 'Fans & Gadgets', tintHex: 0x38bdf8 },
  { id: 'calculator', name: 'Scientific LCD Calculator', category: 'Calculator', group: 'Fans & Gadgets', tintHex: 0x34d399 },
  { id: 'digital_scale', name: 'Digital Pocket Precision Scale', category: 'Digital Scale', group: 'Fans & Gadgets', tintHex: 0x38bdf8 },
  { id: 'trimmer', name: 'Pro Metal Barber Trimmer', category: 'Electric Trimmer', group: 'Fans & Gadgets', tintHex: 0xf59e0b },
  { id: 'cctv_cam', name: '360° Smart Wi-Fi CCTV Camera', category: 'Security Cam', group: 'Fans & Gadgets', tintHex: 0x22d3ee },

  // Desk, Computing & Accessories (5 completely different devices)
  { id: 'usbhub', name: '8-in-1 4K Aluminum USB-C Hub', category: 'USB-C Hub', group: 'Desk & Tech' },
  { id: 'pendrive', name: '128GB Metal Swivel Pendrive', category: 'Flash Drive', group: 'Desk & Tech', tintHex: 0x38bdf8 },
  { id: 'gaming_mouse', name: 'RGB Wireless Gaming Mouse', category: 'Gaming Mouse', group: 'Desk & Tech', rgbCycle: true },
  { id: 'mech_keyboard', name: '65% RGB Mechanical Keyboard', category: 'Keyboard', group: 'Desk & Tech', rgbCycle: true },
  { id: 'action_cam', name: '4K Waterproof Action Camera', category: 'Action Camera', group: 'Desk & Tech', tintHex: 0xef4444 },
];

export const SHOWCASE_FINISHES: ShowcaseFinish[] = [
  {
    id: 'champagne-obsidian',
    name: 'Champagne Gold',
    primaryHex: 0xd6b57c,
    secondaryHex: 0x16161a,
    accentHex: 0xf5d69b,
    swatchCss: '#C9A465',
    metalness: 0.94,
    roughness: 0.18,
    rimHex: 0xffe4b5,
  },
  {
    id: 'swiss-platinum',
    name: 'Swiss Silver',
    primaryHex: 0xe6e8ec,
    secondaryHex: 0x121826,
    accentHex: 0x60a5fa,
    swatchCss: '#CBD5E1',
    metalness: 0.96,
    roughness: 0.14,
    rimHex: 0xdbeafe,
  },
  {
    id: 'rose-atelier',
    name: '18K Rose Gold',
    primaryHex: 0xd99b82,
    secondaryHex: 0x1f1918,
    accentHex: 0xf6c3ae,
    swatchCss: '#D49178',
    metalness: 0.93,
    roughness: 0.19,
    rimHex: 0xffd7c7,
  },
  {
    id: 'emerald-royal',
    name: 'Emerald Royal',
    primaryHex: 0xd4b26a,
    secondaryHex: 0x0b2b22,
    accentHex: 0x34d399,
    swatchCss: '#10B981',
    metalness: 0.92,
    roughness: 0.2,
    rimHex: 0xa7f3d0,
  },
  {
    id: 'stealth-titanium',
    name: 'Stealth Black',
    primaryHex: 0x3f3f46,
    secondaryHex: 0x09090b,
    accentHex: 0xf59e0b,
    swatchCss: '#27272A',
    metalness: 0.88,
    roughness: 0.28,
    rimHex: 0xfde68a,
  },
  {
    id: 'sapphire-frost',
    name: 'Cyber Sapphire',
    primaryHex: 0xdbe4f0,
    secondaryHex: 0x0f172a,
    accentHex: 0x38bdf8,
    swatchCss: '#38BDF8',
    metalness: 0.95,
    roughness: 0.15,
    rimHex: 0xbae6fd,
  },
];

export const SHOWCASE_CHOREOGRAPHIES: ShowcaseChoreography[] = [
  { id: 'turntable', name: 'Velvet Float', orbitSpeed: 0.35, explodeTarget: 0, yawMode: 'sweep', particleScale: 1.0 },
  { id: 'exploded', name: 'Explode 3D', orbitSpeed: 0.65, explodeTarget: 1, yawMode: 'hero', particleScale: 1.3 },
  { id: 'turntable-360', name: '360° Spin', orbitSpeed: 0.52, explodeTarget: 0.15, yawMode: 'spin', particleScale: 1.15 },
  { id: 'kinetic-pulse', name: 'Pulse Wave', orbitSpeed: 0.85, explodeTarget: 0.32, yawMode: 'pulse', particleScale: 1.4 },
  { id: 'cinema-tilt', name: 'Cinema Orbit', orbitSpeed: 0.42, explodeTarget: 0.08, yawMode: 'cinematic', particleScale: 1.1 },
];

export interface SharedShowcaseMaterials {
  primaryMetal: THREE.MeshPhysicalMaterial;
  secondaryBody: THREE.MeshPhysicalMaterial;
  matteTrim: THREE.MeshStandardMaterial;
  polishedChrome: THREE.MeshStandardMaterial;
  accentGlow: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  orbitRingMat: THREE.MeshBasicMaterial;
}

export interface BuiltModel {
  id: ShowcaseModelId;
  root: THREE.Group;
  update: (elapsed: number, dt: number, explodeAmt: number) => void;
}

export interface ResourceTracker {
  geo: <T extends THREE.BufferGeometry>(g: T) => T;
  mat: <T extends THREE.Material>(m: T) => T;
  tex: <T extends THREE.Texture>(t: T) => T;
}

const _rgbColor = new THREE.Color();

/* ---- Procedural Canvas Textures ---- */
function makeDialTex(maxAniso: number, theme: 'chrono' | 'diver' | 'octagon' | 'wall'): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const g = ctx.createRadialGradient(cx, cy, 18, cx, cy, size * 0.49);
    if (theme === 'diver') {
      g.addColorStop(0, '#0f2d24');
      g.addColorStop(1, '#040c0a');
    } else if (theme === 'octagon') {
      g.addColorStop(0, '#132440');
      g.addColorStop(1, '#070d19');
    } else if (theme === 'wall') {
      g.addColorStop(0, '#fbfaf6');
      g.addColorStop(1, '#e8e2d5');
    } else {
      g.addColorStop(0, '#222229');
      g.addColorStop(1, '#050507');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    if (theme === 'octagon') {
      // Tapisserie waffle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < size; i += 22) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
    }

    const ink = theme === 'wall' ? '#18181b' : '#ffffff';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const isH = i % 5 === 0;
      ctx.strokeStyle = isH ? ink : theme === 'wall' ? 'rgba(24,24,27,0.35)' : 'rgba(255,255,255,0.32)';
      ctx.lineWidth = isH ? 3 : 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (isH ? 202 : 216), cy + Math.sin(a) * (isH ? 202 : 216));
      ctx.lineTo(cx + Math.cos(a) * 228, cy + Math.sin(a) * 228);
      ctx.stroke();
    }

    if (theme === 'wall') {
      ctx.fillStyle = '#18181b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 32px Georgia, serif';
      const nums = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
      nums.forEach((n, idx) => {
        const a = (idx / 12) * Math.PI * 2 - Math.PI / 2;
        ctx.fillText(n, cx + Math.cos(a) * 168, cy + Math.sin(a) * 168);
      });
    }

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('NEW CHIKO', cx, cy - 82);
    ctx.fillStyle = theme === 'wall' ? 'rgba(24,24,27,0.6)' : 'rgba(214,181,124,0.85)';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(
      theme === 'diver'
        ? 'DIVER 300M'
        : theme === 'octagon'
        ? 'ROYAL OAK AUTO'
        : theme === 'wall'
        ? 'QUARTZ CHIME'
        : 'TOURBILLON',
      cx,
      cy - 60
    );
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso || 1);
  tex.needsUpdate = true;
  return tex;
}

function makeLiveCanvas(
  w: number,
  h: number,
  maxAniso: number,
  interval: number,
  drawFn: (ctx: CanvasRenderingContext2D, elapsed: number, w: number, h: number) => void
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso || 1);
  let last = -1;
  const redraw = (elapsed: number) => {
    if (!ctx || (last >= 0 && elapsed - last < interval)) return;
    last = elapsed;
    drawFn(ctx, elapsed, w, h);
    tex.needsUpdate = true;
  };
  redraw(0);
  return { tex, redraw };
}

function makeMeshTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 8) {
      for (let x = 0; x < 256; x += 8) {
        const off = (y / 8) % 2 === 0 ? 0 : 4;
        ctx.fillStyle = '#2d2d35';
        ctx.beginPath(); ctx.arc(x + off, y, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#09090b';
        ctx.beginPath(); ctx.arc(x + off, y, 1.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = Math.min(8, maxAniso || 1);
  tex.needsUpdate = true;
  return tex;
}

function makeStaticLabel(
  w: number,
  h: number,
  maxAniso: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso || 1);
  tex.needsUpdate = true;
  return tex;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function createGear(radius: number, teeth: number, mat: THREE.Material, tr: ResourceTracker): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tr.geo(new THREE.TorusGeometry(radius * 0.78, radius * 0.14, 10, 24)), mat));
  const hub = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.03, 12)), mat);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  const tGeo = tr.geo(new THREE.BoxGeometry(radius * 0.18, radius * 0.24, 0.024));
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(tGeo, mat);
    t.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    t.rotation.z = a;
    g.add(t);
  }
  return g;
}

/* ============================================================================
   LAZY BUILDER FOR EACH OF THE 32 COMPLETELY UNIQUE 3D MODELS
   ============================================================================ */
export function createShowcaseModel(
  id: ShowcaseModelId,
  mats: SharedShowcaseMaterials,
  tr: ResourceTracker,
  maxAniso: number
): BuiltModel {
  const dummy = new THREE.Object3D();

  switch (id) {
    /* 1. TOURBILLON CHRONOGRAPH WATCH */
    case 'tourbillon': {
      const root = new THREE.Group();
      const caseGeo = tr.geo(new THREE.CylinderGeometry(1.05, 1.0, 0.26, 56));
      caseGeo.rotateX(Math.PI / 2);
      root.add(new THREE.Mesh(caseGeo, mats.primaryMetal));

      const bezel = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.97, 0.095, 20, 56)), mats.secondaryBody);
      bezel.position.z = 0.12;
      root.add(bezel);

      const dialTex = tr.tex(makeDialTex(maxAniso, 'chrono'));
      const dial = new THREE.Mesh(
        tr.geo(new THREE.CircleGeometry(0.91, 56)),
        tr.mat(new THREE.MeshStandardMaterial({ map: dialTex, metalness: 0.35, roughness: 0.4 }))
      );
      dial.position.z = 0.14;
      root.add(dial);

      const cage = createGear(0.21, 10, mats.accentGlow, tr);
      cage.position.set(0, -0.34, 0.165);
      root.add(cage);

      const hP = new THREE.Group(); hP.position.z = 0.185;
      const hG = tr.geo(new THREE.BoxGeometry(0.052, 0.45, 0.018)); hG.translate(0, 0.18, 0);
      hP.add(new THREE.Mesh(hG, mats.polishedChrome)); root.add(hP);
      const mP = new THREE.Group(); mP.position.z = 0.205;
      const mG = tr.geo(new THREE.BoxGeometry(0.036, 0.64, 0.015)); mG.translate(0, 0.26, 0);
      mP.add(new THREE.Mesh(mG, mats.polishedChrome)); root.add(mP);
      const sP = new THREE.Group(); sP.position.z = 0.22;
      const sG = tr.geo(new THREE.BoxGeometry(0.014, 0.78, 0.01)); sG.translate(0, 0.24, 0);
      sP.add(new THREE.Mesh(sG, mats.accentGlow)); root.add(sP);

      const crownG = tr.geo(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 20)); crownG.rotateZ(Math.PI / 2);
      const crown = new THREE.Mesh(crownG, mats.primaryMetal); crown.position.set(1.1, 0, 0); root.add(crown);

      const linkG = tr.geo(new THREE.BoxGeometry(0.78, 0.21, 0.13));
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(linkG, i % 2 === 0 ? mats.matteTrim : mats.secondaryBody);
        t.position.set(0, 1.1 + i * 0.22, -0.07 - i * 0.07); t.rotation.x = 0.22 + i * 0.12; root.add(t);
        const b = new THREE.Mesh(linkG, i % 2 === 0 ? mats.matteTrim : mats.secondaryBody);
        b.position.set(0, -1.1 - i * 0.22, -0.07 - i * 0.07); b.rotation.x = -(0.22 + i * 0.12); root.add(b);
      }

      const glass = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.9, 48)), mats.glass);
      glass.position.z = 0.24; glass.renderOrder = 10; root.add(glass);

      return {
        id, root,
        update: (e, _dt, ex) => {
          const n = new Date();
          const s = n.getSeconds() + n.getMilliseconds() / 1000;
          const m = n.getMinutes() + s / 60;
          const h = (n.getHours() % 12) + m / 60;
          sP.rotation.z = -(s / 60) * Math.PI * 2;
          mP.rotation.z = -(m / 60) * Math.PI * 2;
          hP.rotation.z = -(h / 12) * Math.PI * 2;
          cage.rotation.z = e * 2.4;
          bezel.position.z = 0.12 + ex * 0.3;
          glass.position.z = 0.24 + ex * 0.54;
          crown.position.x = 1.1 + ex * 0.24;
        },
      };
    }

    /* 2. AMOLED ULTRA SMARTWATCH */
    case 'smartwatch': {
      const root = new THREE.Group();
      const bodyGeo = tr.geo(
        new THREE.ExtrudeGeometry(roundedRect(1.42, 1.76, 0.32), {
          depth: 0.24, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 4,
        })
      );
      bodyGeo.translate(0, 0, -0.12);
      root.add(new THREE.Mesh(bodyGeo, mats.primaryMetal));

      const screenCanvas = makeLiveCanvas(256, 320, maxAniso, 0.14, (ctx, elapsed, w, h) => {
        ctx.fillStyle = '#06070a'; ctx.fillRect(0, 0, w, h);
        const cx = w / 2, cy = 128;
        [
          { r: 74, c: '#f59e0b', p: 0.78 + Math.sin(elapsed) * 0.06 },
          { r: 60, c: '#10b981', p: 0.66 + Math.cos(elapsed * 1.2) * 0.07 },
          { r: 46, c: '#38bdf8', p: 0.85 + Math.sin(elapsed * 0.8) * 0.05 },
        ].forEach((rg) => {
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = rg.c; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(cx, cy, rg.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rg.p); ctx.stroke();
        });
        const now = new Date();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 32px monospace';
        ctx.fillText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, cx, cy + 11);
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2.4; ctx.beginPath();
        for (let x = 24; x <= w - 24; x += 4) {
          const ph = ((x / 22) + elapsed * 3.4) % 4;
          const dy = ph > 1.6 && ph < 1.9 ? -16 : ph >= 1.9 && ph < 2.15 ? 11 : 0;
          if (x === 24) ctx.moveTo(x, 248 + dy); else ctx.lineTo(x, 248 + dy);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '600 13px monospace';
        ctx.fillText(`${Math.round(72 + Math.sin(elapsed * 2) * 3)} BPM · ULTRA OS`, cx, 290);
      });
      tr.tex(screenCanvas.tex);
      const scr = new THREE.Mesh(
        tr.geo(new THREE.PlaneGeometry(1.1, 1.42)),
        tr.mat(new THREE.MeshStandardMaterial({ map: screenCanvas.tex, emissiveMap: screenCanvas.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.72, roughness: 0.12 }))
      );
      scr.position.z = 0.185; root.add(scr);

      const glass = new THREE.Mesh(tr.geo(new THREE.PlaneGeometry(1.16, 1.48)), mats.glass);
      glass.position.z = 0.22; glass.renderOrder = 10; root.add(glass);

      const crG = tr.geo(new THREE.CylinderGeometry(0.13, 0.13, 0.13, 20)); crG.rotateZ(Math.PI / 2);
      const cr = new THREE.Mesh(crG, mats.accentGlow); cr.position.set(0.82, 0.3, 0.02); root.add(cr);

      const bG = tr.geo(new THREE.BoxGeometry(0.9, 0.23, 0.11));
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(bG, mats.matteTrim); t.position.set(0, 1.04 + i * 0.22, -0.06 - i * 0.08); t.rotation.x = 0.24 + i * 0.13; root.add(t);
        const b = new THREE.Mesh(bG, mats.matteTrim); b.position.set(0, -1.04 - i * 0.22, -0.06 - i * 0.08); b.rotation.x = -(0.24 + i * 0.13); root.add(b);
      }
      return {
        id, root,
        update: (e, _dt, ex) => {
          screenCanvas.redraw(e);
          cr.rotation.x = e * 1.4;
          scr.position.z = 0.185 + ex * 0.24;
          glass.position.z = 0.22 + ex * 0.5;
        },
      };
    }

    /* 3. SKELETON DIVER 300M */
    case 'diver': {
      const root = new THREE.Group();
      const cG = tr.geo(new THREE.CylinderGeometry(1.06, 1.02, 0.28, 48)); cG.rotateX(Math.PI / 2);
      root.add(new THREE.Mesh(cG, mats.primaryMetal));

      const bezel = new THREE.Group(); bezel.position.z = 0.14;
      bezel.add(new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.98, 0.105, 16, 48)), mats.secondaryBody));
      const nG = tr.geo(new THREE.BoxGeometry(0.042, 0.085, 0.04));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const n = new THREE.Mesh(nG, i === 0 ? mats.accentGlow : mats.polishedChrome);
        n.position.set(Math.sin(a) * 0.98, Math.cos(a) * 0.98, 0.08); n.rotation.z = -a; bezel.add(n);
      }
      root.add(bezel);

      const dTex = tr.tex(makeDialTex(maxAniso, 'diver'));
      const dM = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.9, 48)), tr.mat(new THREE.MeshStandardMaterial({ map: dTex, metalness: 0.45, roughness: 0.35 })));
      dM.position.z = 0.14; root.add(dM);

      const gA = createGear(0.3, 14, mats.accentGlow, tr); gA.position.set(-0.22, -0.14, 0.168);
      const gB = createGear(0.22, 10, mats.polishedChrome, tr); gB.position.set(0.24, -0.14, 0.172);
      const gC = createGear(0.18, 9, mats.primaryMetal, tr); gC.position.set(0.02, 0.22, 0.172);
      root.add(gA, gB, gC);

      const sH = new THREE.Group(); sH.position.z = 0.205;
      const shG = tr.geo(new THREE.BoxGeometry(0.022, 0.76, 0.015)); shG.translate(0, 0.24, 0);
      sH.add(new THREE.Mesh(shG, mats.accentGlow)); root.add(sH);

      const oG = tr.geo(new THREE.BoxGeometry(0.8, 0.22, 0.14));
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(oG, mats.primaryMetal); t.position.set(0, 1.1 + i * 0.23, -0.07 - i * 0.07); t.rotation.x = 0.2 + i * 0.12; root.add(t);
        const b = new THREE.Mesh(oG, mats.primaryMetal); b.position.set(0, -1.1 - i * 0.23, -0.07 - i * 0.07); b.rotation.x = -(0.2 + i * 0.12); root.add(b);
      }
      const glass = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.9, 48)), mats.glass);
      glass.position.z = 0.235; glass.renderOrder = 10; root.add(glass);

      return {
        id, root,
        update: (e, _dt, ex) => {
          gA.rotation.z = e * 1.3; gB.rotation.z = -e * 1.8; gC.rotation.z = e * 2.1;
          bezel.rotation.z = Math.sin(e * 0.45) * 0.35;
          sH.rotation.z = -e * 1.05;
          bezel.position.z = 0.14 + ex * 0.28;
          glass.position.z = 0.235 + ex * 0.52;
        },
      };
    }

    /* 4. ROYAL OCTAGON STEEL WATCH (8-Sided Bezel + Exposed Hex Screws!) */
    case 'octagon_watch': {
      const root = new THREE.Group();
      const octCase = tr.geo(new THREE.CylinderGeometry(1.12, 1.08, 0.24, 8));
      octCase.rotateX(Math.PI / 2); octCase.rotateZ(Math.PI / 8);
      root.add(new THREE.Mesh(octCase, mats.primaryMetal));

      const octBezel = tr.geo(new THREE.CylinderGeometry(1.04, 1.08, 0.14, 8));
      octBezel.rotateX(Math.PI / 2); octBezel.rotateZ(Math.PI / 8);
      const bezelMesh = new THREE.Mesh(octBezel, mats.polishedChrome);
      bezelMesh.position.z = 0.12; root.add(bezelMesh);

      // 8 Iconic Hex Bezel Screws
      const screwGeo = tr.geo(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 6));
      screwGeo.rotateX(Math.PI / 2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const sc = new THREE.Mesh(screwGeo, mats.secondaryBody);
        sc.position.set(Math.cos(a) * 0.94, Math.sin(a) * 0.94, 0.195);
        root.add(sc);
      }

      const dTex = tr.tex(makeDialTex(maxAniso, 'octagon'));
      const dial = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.84, 48)), tr.mat(new THREE.MeshStandardMaterial({ map: dTex, metalness: 0.4, roughness: 0.35 })));
      dial.position.z = 0.195; root.add(dial);

      const hP = new THREE.Group(); hP.position.z = 0.22;
      const hG = tr.geo(new THREE.BoxGeometry(0.06, 0.44, 0.018)); hG.translate(0, 0.18, 0);
      hP.add(new THREE.Mesh(hG, mats.polishedChrome)); root.add(hP);
      const mP = new THREE.Group(); mP.position.z = 0.235;
      const mG = tr.geo(new THREE.BoxGeometry(0.042, 0.64, 0.016)); mG.translate(0, 0.26, 0);
      mP.add(new THREE.Mesh(mG, mats.polishedChrome)); root.add(mP);

      // Integrated tapered metallic bracelet
      for (let i = 0; i < 4; i++) {
        const w = 0.96 - i * 0.09;
        const lG = tr.geo(new THREE.BoxGeometry(w, 0.22, 0.13));
        const t = new THREE.Mesh(lG, mats.primaryMetal); t.position.set(0, 1.12 + i * 0.23, -0.06 - i * 0.07); t.rotation.x = 0.22 + i * 0.1; root.add(t);
        const b = new THREE.Mesh(lG, mats.primaryMetal); b.position.set(0, -1.12 - i * 0.23, -0.06 - i * 0.07); b.rotation.x = -(0.22 + i * 0.1); root.add(b);
      }

      const glass = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.84, 48)), mats.glass);
      glass.position.z = 0.255; glass.renderOrder = 10; root.add(glass);

      return {
        id, root,
        update: (e, _dt, ex) => {
          mP.rotation.z = -e * 0.8; hP.rotation.z = -e * 0.15;
          bezelMesh.position.z = 0.12 + ex * 0.28;
          glass.position.z = 0.255 + ex * 0.55;
        },
      };
    }

    /* 5. CLASSIC RETRO DIGITAL WATCH (Horizontal Rectangular Vintage LCD!) */
    case 'retro_digital': {
      const root = new THREE.Group();
      const bodyGeo = tr.geo(
        new THREE.ExtrudeGeometry(roundedRect(1.56, 1.32, 0.22), {
          depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3,
        })
      );
      bodyGeo.translate(0, 0, -0.11);
      root.add(new THREE.Mesh(bodyGeo, mats.primaryMetal));

      const facePlate = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(1.36, 1.08, 0.04)), mats.secondaryBody);
      facePlate.position.z = 0.15; root.add(facePlate);

      const lcd = makeLiveCanvas(256, 160, maxAniso, 0.25, (ctx, elapsed, w, h) => {
        ctx.fillStyle = '#9db596'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(15,35,20,0.28)'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, h - 8);
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        ctx.fillStyle = '#142417'; ctx.font = '700 16px monospace'; ctx.textAlign = 'left';
        ctx.fillText('AL  SIG  24H  CHIKO', 14, 30);
        ctx.font = '800 54px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`${hh}:${mm}`, w * 0.43, 112);
        ctx.font = '700 28px monospace';
        ctx.fillText(ss, w * 0.84, 112);
        ctx.font = '600 13px monospace';
        ctx.fillText(elapsed % 2 < 1 ? 'WATER RESIST · WR' : 'ILLUMINATOR · LED', w / 2, 144);
      });
      tr.tex(lcd.tex);
      const lcdM = new THREE.Mesh(
        tr.geo(new THREE.PlaneGeometry(1.16, 0.72)),
        tr.mat(new THREE.MeshStandardMaterial({ map: lcd.tex, emissiveMap: lcd.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.45, roughness: 0.2 }))
      );
      lcdM.position.z = 0.175; root.add(lcdM);

      // 4 side retro push buttons
      const btnG = tr.geo(new THREE.BoxGeometry(0.12, 0.16, 0.08));
      [[-0.82, 0.34], [-0.82, -0.34], [0.82, 0.34], [0.82, -0.34]].forEach(([bx, by]) => {
        const b = new THREE.Mesh(btnG, mats.polishedChrome); b.position.set(bx, by, 0); root.add(b);
      });

      const linkG = tr.geo(new THREE.BoxGeometry(0.84, 0.2, 0.1));
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(linkG, mats.primaryMetal); t.position.set(0, 0.84 + i * 0.22, -0.06 - i * 0.07); t.rotation.x = 0.22 + i * 0.12; root.add(t);
        const b = new THREE.Mesh(linkG, mats.primaryMetal); b.position.set(0, -0.84 - i * 0.22, -0.06 - i * 0.07); b.rotation.x = -(0.22 + i * 0.12); root.add(b);
      }

      return {
        id, root,
        update: (e, _dt, ex) => {
          lcd.redraw(e);
          facePlate.position.z = 0.15 + ex * 0.22;
          lcdM.position.z = 0.175 + ex * 0.38;
        },
      };
    }

    /* 6. PENDULUM SHOWROOM WALL CLOCK */
    case 'wall_clock': {
      const root = new THREE.Group();
      const rim = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.95, 0.12, 20, 56)), mats.primaryMetal);
      rim.position.y = 0.34; root.add(rim);

      const backG = tr.geo(new THREE.CylinderGeometry(0.96, 0.96, 0.18, 48)); backG.rotateX(Math.PI / 2);
      const back = new THREE.Mesh(backG, mats.secondaryBody); back.position.set(0, 0.34, -0.06); root.add(back);

      const dTex = tr.tex(makeDialTex(maxAniso, 'wall'));
      const face = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.88, 48)), tr.mat(new THREE.MeshStandardMaterial({ map: dTex, roughness: 0.45 })));
      face.position.set(0, 0.34, 0.04); root.add(face);

      const hP = new THREE.Group(); hP.position.set(0, 0.34, 0.07);
      const hG = tr.geo(new THREE.BoxGeometry(0.055, 0.42, 0.02)); hG.translate(0, 0.16, 0);
      hP.add(new THREE.Mesh(hG, mats.secondaryBody)); root.add(hP);
      const mP = new THREE.Group(); mP.position.set(0, 0.34, 0.085);
      const mG = tr.geo(new THREE.BoxGeometry(0.036, 0.62, 0.018)); mG.translate(0, 0.24, 0);
      mP.add(new THREE.Mesh(mG, mats.secondaryBody)); root.add(mP);

      // Swinging golden pendulum bob below!
      const pendPivot = new THREE.Group();
      pendPivot.position.set(0, 0.15, -0.04);
      const rod = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.022, 0.022, 1.18, 12)), mats.primaryMetal);
      rod.position.y = -0.6; pendPivot.add(rod);
      const bobG = tr.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 32)); bobG.rotateX(Math.PI / 2);
      const bob = new THREE.Mesh(bobG, mats.accentGlow); bob.position.y = -1.22; pendPivot.add(bob);
      root.add(pendPivot);

      const glass = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.88, 48)), mats.glass);
      glass.position.set(0, 0.34, 0.12); glass.renderOrder = 10; root.add(glass);

      return {
        id, root,
        update: (e, _dt, ex) => {
          pendPivot.rotation.z = Math.sin(e * 2.8) * 0.34;
          mP.rotation.z = -e * 0.6; hP.rotation.z = -e * 0.08;
          glass.position.z = 0.12 + ex * 0.45;
          rim.position.z = ex * 0.2;
        },
      };
    }

    /* 7. ANC PRO TWS EARBUDS & OPENING CHARGING CASE */
    case 'earbuds': {
      const root = new THREE.Group();
      const base = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.8, 0.72, 1.0, 36)), mats.secondaryBody);
      base.scale.set(1.22, 1, 0.68); base.position.y = -0.4; root.add(base);
      const led = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.32, 0.045, 0.04)), mats.accentGlow);
      led.position.set(0, -0.18, 0.55); root.add(led);

      const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.1, -0.52);
      const lidCap = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.8, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.52)), mats.primaryMetal);
      lidCap.scale.set(1.22, 0.72, 0.68); lidCap.position.set(0, 0, 0.52); lidPivot.add(lidCap); root.add(lidPivot);

      const buildBud = (side: -1 | 1) => {
        const b = new THREE.Group();
        const hd = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.22, 20, 16)), mats.polishedChrome); hd.scale.set(1.15, 0.95, 0.9); b.add(hd);
        const tp = new THREE.Mesh(tr.geo(new THREE.ConeGeometry(0.13, 0.17, 16)), mats.matteTrim); tp.rotation.z = side * Math.PI * 0.42; tp.position.set(side * 0.2, -0.02, 0.05); b.add(tp);
        const st = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.06, 0.048, 0.56, 14)), mats.primaryMetal); st.position.set(-side * 0.04, -0.32, 0); st.rotation.z = side * 0.12; b.add(st);
        return b;
      };
      const lB = buildBud(-1), rB = buildBud(1); root.add(lB, rB);
      const wL = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.34, 0.012, 10, 32)), mats.accentGlow);
      const wR = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.34, 0.012, 10, 32)), mats.accentGlow);
      root.add(wL, wR);

      return {
        id, root,
        update: (e, _dt, ex) => {
          const op = Math.min(1, Math.max(0.25, (Math.sin(e * 1.15) + 1) * 0.5) + ex * 0.6);
          lidPivot.rotation.x = -op * 1.48;
          const lift = 0.24 + op * 0.56 + ex * 0.22;
          const sp = 0.4 + op * 0.16 + ex * 0.2;
          lB.position.set(-sp, lift + Math.sin(e * 2.5) * 0.04, 0.04);
          rB.position.set(sp, lift + Math.cos(e * 2.5) * 0.04, 0.04);
          const p = (e * 0.85) % 1;
          wL.position.copy(lB.position); wR.position.copy(rB.position);
          wL.scale.setScalar(0.65 + p); wR.scale.setScalar(0.65 + p);
        },
      };
    }

    /* 8. 360° BASS BLUETOOTH SPEAKER */
    case 'speaker': {
      const root = new THREE.Group();
      const meshTex = tr.tex(makeMeshTexture(maxAniso));
      root.add(new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.72, 0.74, 1.9, 42, 1, true)), tr.mat(new THREE.MeshStandardMaterial({ map: meshTex, metalness: 0.55, roughness: 0.42 }))));
      const tCap = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.74, 0.72, 0.15, 42)), mats.primaryMetal); tCap.position.y = 0.97; root.add(tCap);
      const bCap = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.74, 0.76, 0.15, 42)), mats.primaryMetal); bCap.position.y = -0.97; root.add(bCap);
      const tBass = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.52, 0.44, 0.08, 32)), mats.secondaryBody); tBass.position.y = 1.05; root.add(tBass);
      const tCen = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.21, 0.21, 0.09, 22)), mats.accentGlow); tCen.position.y = 1.07; root.add(tCen);
      const hT = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.76, 0.028, 12, 48)), mats.accentGlow); hT.rotation.x = Math.PI / 2; hT.position.y = 0.89; root.add(hT);
      const hB = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.77, 0.028, 12, 48)), mats.accentGlow); hB.rotation.x = Math.PI / 2; hB.position.y = -0.89; root.add(hB);
      const waves = [0, 1, 2].map(() => {
        const w = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.88, 0.012, 10, 44)), mats.orbitRingMat); w.rotation.x = Math.PI / 2; root.add(w); return w;
      });
      return {
        id, root,
        update: (e, _dt, ex) => {
          const beat = Math.pow(Math.max(0, Math.sin(e * 5.2)), 4);
          tBass.position.y = 1.05 + beat * 0.09 + ex * 0.3;
          tCen.position.y = 1.07 + beat * 0.11 + ex * 0.38;
          tCap.position.y = 0.97 + ex * 0.16; bCap.position.y = -0.97 - ex * 0.16;
          waves.forEach((w, i) => {
            const p = (e * 0.72 + i / 3) % 1; w.scale.setScalar(1 + p * 0.9); w.position.y = Math.sin(e * 1.4 + i * 2.1) * 0.65;
          });
        },
      };
    }

    /* 9. STUDIO OVER-EAR ANC HEADPHONES */
    case 'headphones': {
      const root = new THREE.Group();
      const arch = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.94, -0.14, 0), new THREE.Vector3(-0.92, 0.66, 0), new THREE.Vector3(-0.52, 1.1, 0),
        new THREE.Vector3(0, 1.22, 0), new THREE.Vector3(0.52, 1.1, 0), new THREE.Vector3(0.92, 0.66, 0), new THREE.Vector3(0.94, -0.14, 0),
      ]);
      root.add(new THREE.Mesh(tr.geo(new THREE.TubeGeometry(arch, 44, 0.105, 14, false)), mats.primaryMetal));
      const padCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.58, 0.96, 0), new THREE.Vector3(0, 1.12, 0), new THREE.Vector3(0.58, 0.96, 0)]);
      const hPad = new THREE.Mesh(tr.geo(new THREE.TubeGeometry(padCurve, 22, 0.125, 12, false)), mats.matteTrim); root.add(hPad);

      const mkCup = (s: -1 | 1) => {
        const g = new THREE.Group();
        const sh = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.44, 0.5, 0.26, 32)), mats.primaryMetal); sh.rotation.z = s * Math.PI / 2; g.add(sh);
        const tm = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.42, 0.026, 12, 32)), mats.accentGlow); tm.rotation.y = Math.PI / 2; tm.position.x = s * 0.13; g.add(tm);
        const pd = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.44, 0.125, 14, 32)), mats.matteTrim); pd.rotation.y = Math.PI / 2; pd.position.x = -s * 0.14; g.add(pd);
        return g;
      };
      const lC = mkCup(-1), rC = mkCup(1); lC.position.set(-0.88, -0.44, 0); rC.position.set(0.88, -0.44, 0); root.add(lC, rC);
      return {
        id, root,
        update: (e, _dt, ex) => {
          const b = Math.sin(e * 2.2) * 0.04;
          lC.position.x = -0.88 - ex * 0.32 - b; rC.position.x = 0.88 + ex * 0.32 + b;
          lC.rotation.y = Math.sin(e * 1.1) * 0.16; rC.rotation.y = -Math.sin(e * 1.1) * 0.16;
          hPad.position.y = ex * 0.2;
        },
      };
    }

    /* 10. MAGNETIC WIRELESS NECKBAND */
    case 'neckband': {
      const root = new THREE.Group();
      const collar = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.62, -0.42, 0.44), new THREE.Vector3(-0.88, 0.25, 0.12), new THREE.Vector3(-0.64, 0.92, -0.22),
        new THREE.Vector3(0, 1.12, -0.34), new THREE.Vector3(0.64, 0.92, -0.22), new THREE.Vector3(0.88, 0.25, 0.12), new THREE.Vector3(0.62, -0.42, 0.44),
      ]);
      root.add(new THREE.Mesh(tr.geo(new THREE.TubeGeometry(collar, 48, 0.09, 14, false)), mats.matteTrim));
      const podG = tr.geo(new THREE.CylinderGeometry(0.12, 0.11, 0.56, 18));
      const pL = new THREE.Mesh(podG, mats.primaryMetal); pL.position.set(-0.64, -0.48, 0.44); pL.rotation.z = -0.22; root.add(pL);
      const pR = new THREE.Mesh(podG, mats.primaryMetal); pR.position.set(0.64, -0.48, 0.44); pR.rotation.z = 0.22; root.add(pR);
      const bL = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.18, 20, 16)), mats.accentGlow);
      const bR = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.18, 20, 16)), mats.accentGlow);
      root.add(bL, bR);
      return {
        id, root,
        update: (e, _dt, ex) => {
          const sp = 0.22 + (Math.sin(e * 2) + 1) * 0.14 + ex * 0.26;
          bL.position.set(-sp, -0.95, 0.46); bR.position.set(sp, -0.95, 0.46);
        },
      };
    }

    /* 11. WIRELESS STUDIO CONDENSER MICROPHONE */
    case 'microphone': {
      const root = new THREE.Group();
      const mTex = tr.tex(makeMeshTexture(maxAniso));
      const handle = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.24, 0.2, 1.32, 32)), mats.secondaryBody);
      handle.position.y = -0.34; root.add(handle);

      const collarRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.26, 0.035, 12, 32)), mats.accentGlow);
      collarRing.rotation.x = Math.PI / 2; collarRing.position.y = 0.34; root.add(collarRing);

      const meshHead = new THREE.Mesh(
        tr.geo(new THREE.SphereGeometry(0.46, 32, 24)),
        tr.mat(new THREE.MeshStandardMaterial({ map: mTex, metalness: 0.78, roughness: 0.3 }))
      );
      meshHead.scale.set(1, 1.15, 1); meshHead.position.y = 0.76; root.add(meshHead);

      const eqBand = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.47, 0.025, 12, 42)), mats.primaryMetal);
      eqBand.rotation.x = Math.PI / 2; eqBand.position.y = 0.76; root.add(eqBand);

      const standBase = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.56, 0.62, 0.1, 32)), mats.primaryMetal);
      standBase.position.y = -1.06; root.add(standBase);

      const voiceRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.68, 0.014, 10, 44)), mats.accentGlow);
      voiceRing.position.y = 0.76; root.add(voiceRing);

      return {
        id, root,
        update: (e, _dt, ex) => {
          const p = (e * 1.2) % 1;
          voiceRing.scale.setScalar(0.8 + p * 0.75);
          voiceRing.rotation.y = e * 1.4;
          meshHead.position.y = 0.76 + ex * 0.32;
          eqBand.position.y = 0.76 + ex * 0.32;
          standBase.position.y = -1.06 - ex * 0.22;
        },
      };
    }

    /* 12. MAGSAFE 20,000mAh POWER BANK */
    case 'powerbank': {
      const root = new THREE.Group();
      const slabG = tr.geo(new THREE.ExtrudeGeometry(roundedRect(1.42, 2.16, 0.2), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4 }));
      slabG.translate(0, 0, -0.15); root.add(new THREE.Mesh(slabG, mats.primaryMetal));
      const pad = new THREE.Mesh(tr.geo(new THREE.ShapeGeometry(roundedRect(1.24, 1.96, 0.15), 8)), mats.secondaryBody);
      pad.position.z = 0.205; root.add(pad);
      const qi = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.44, 0.042, 12, 44)), mats.accentGlow); qi.position.set(0, -0.26, 0.22); root.add(qi);
      const halo = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.52, 0.015, 10, 44)), mats.polishedChrome); halo.position.set(0, -0.26, 0.26); root.add(halo);

      const oled = makeLiveCanvas(256, 128, maxAniso, 0.2, (ctx, elapsed) => {
        ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#34d399'; ctx.textAlign = 'center'; ctx.font = '700 44px monospace';
        ctx.fillText(`${84 + Math.floor((elapsed * 3) % 17)}%`, 128, 66);
        ctx.fillStyle = '#fbbf24'; ctx.font = '600 14px monospace'; ctx.fillText('65W PD · FAST CHARGE', 128, 100);
      });
      tr.tex(oled.tex);
      const oledM = new THREE.Mesh(tr.geo(new THREE.PlaneGeometry(0.98, 0.48)), tr.mat(new THREE.MeshStandardMaterial({ map: oled.tex, emissiveMap: oled.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.8 })));
      oledM.position.set(0, 0.58, 0.215); root.add(oledM);

      return {
        id, root,
        update: (e, _dt, ex) => {
          oled.redraw(e);
          const p = (e * 1.1) % 1;
          halo.scale.setScalar(0.82 + p * 0.52); halo.position.z = 0.24 + p * 0.3 + ex * 0.32;
          qi.position.z = 0.22 + ex * 0.2; oledM.position.z = 0.215 + ex * 0.26;
        },
      };
    }

    /* 13. GaN 100W TURBO WALL CHARGER */
    case 'gancharger': {
      const root = new THREE.Group();
      const cG = tr.geo(new THREE.ExtrudeGeometry(roundedRect(1.34, 1.34, 0.2), { depth: 1.15, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4 }));
      cG.translate(0, 0, -0.575); root.add(new THREE.Mesh(cG, mats.secondaryBody));
      const plate = new THREE.Mesh(tr.geo(new THREE.ShapeGeometry(roundedRect(1.18, 1.18, 0.14), 8)), mats.primaryMetal);
      plate.position.z = 0.64; root.add(plate);
      const uG = tr.geo(new THREE.BoxGeometry(0.34, 0.11, 0.05));
      const p1 = new THREE.Mesh(uG, mats.accentGlow); p1.position.set(0, 0.32, 0.66);
      const p2 = new THREE.Mesh(uG, mats.accentGlow); p2.position.set(0, 0.02, 0.66);
      const pA = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.48, 0.16, 0.05)), mats.polishedChrome); pA.position.set(0, -0.32, 0.66);
      root.add(p1, p2, pA);
      const prG = tr.geo(new THREE.BoxGeometry(0.08, 0.4, 0.46));
      const pL = new THREE.Mesh(prG, mats.polishedChrome); pL.position.set(-0.26, 0, -0.84);
      const pR = new THREE.Mesh(prG, mats.polishedChrome); pR.position.set(0.26, 0, -0.84);
      root.add(pL, pR);
      const a1 = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(1.1, 0.018, 10, 52, Math.PI * 1.3)), mats.accentGlow);
      const a2 = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(1.24, 0.013, 10, 52, Math.PI * 1.1)), mats.polishedChrome);
      root.add(a1, a2);
      return {
        id, root,
        update: (e, _dt, ex) => {
          a1.rotation.set(e * 1.2, e * 0.8, 0); a2.rotation.set(-e * 0.9, e * 1.1, 0.8);
          plate.position.z = 0.64 + ex * 0.32;
          p1.position.z = p2.position.z = pA.position.z = 0.66 + ex * 0.42;
        },
      };
    }

    /* 14. 3-IN-1 MAGSAFE WIRELESS CHARGING STAND */
    case 'wireless_stand': {
      const root = new THREE.Group();
      const base = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.76, 0.82, 0.14, 36)), mats.secondaryBody);
      base.position.y = -0.96; root.add(base);
      const baseHalo = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.42, 0.02, 10, 36)), mats.accentGlow);
      baseHalo.rotation.x = Math.PI / 2; baseHalo.position.set(0, -0.88, 0.18); root.add(baseHalo);

      // Angled sleek aluminum pillar
      const stem = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.11, 0.13, 1.56, 20)), mats.primaryMetal);
      stem.position.set(0, -0.18, -0.18); stem.rotation.x = 0.22; root.add(stem);

      // Floating tilted MagSafe Phone Puck
      const phonePad = new THREE.Group();
      phonePad.position.set(0, 0.62, 0.12); phonePad.rotation.x = -0.35;
      const pDisc = tr.geo(new THREE.CylinderGeometry(0.56, 0.56, 0.1, 36)); pDisc.rotateX(Math.PI / 2);
      phonePad.add(new THREE.Mesh(pDisc, mats.primaryMetal));
      const pRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.36, 0.032, 12, 36)), mats.accentGlow);
      pRing.position.z = 0.06; phonePad.add(pRing);
      root.add(phonePad);

      // Side Smartwatch Charging Arm
      const sideArm = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.72, 0.08, 0.1)), mats.primaryMetal);
      sideArm.position.set(0.45, 0.15, -0.12); root.add(sideArm);
      const watchPuck = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 28)), mats.polishedChrome);
      watchPuck.position.set(0.82, 0.18, -0.12); root.add(watchPuck);

      const pulseHalo = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.44, 0.015, 10, 36)), mats.polishedChrome);
      phonePad.add(pulseHalo);

      return {
        id, root,
        update: (e, _dt, ex) => {
          const p = (e * 1.1) % 1;
          pulseHalo.position.z = 0.08 + p * 0.34;
          pulseHalo.scale.setScalar(0.8 + p * 0.45);
          phonePad.position.y = 0.62 + ex * 0.26;
          watchPuck.position.x = 0.82 + ex * 0.24;
        },
      };
    }

    /* 15. SMART SURGE EXTENSION BOARD / POWER STRIP */
    case 'power_strip': {
      const root = new THREE.Group();
      root.rotation.x = 0.42;
      const barGeo = tr.geo(
        new THREE.ExtrudeGeometry(roundedRect(2.38, 0.78, 0.14), {
          depth: 0.24, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3,
        })
      );
      barGeo.translate(0, 0, -0.12);
      root.add(new THREE.Mesh(barGeo, mats.secondaryBody));

      const topDeck = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(2.18, 0.62, 0.05)), mats.primaryMetal);
      topDeck.position.z = 0.15; root.add(topDeck);

      // 4 Distinct Universal 3-Pin Sockets
      const sockG = tr.geo(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24)); sockG.rotateX(Math.PI / 2);
      const pinG = tr.geo(new THREE.BoxGeometry(0.05, 0.08, 0.05));
      for (let i = 0; i < 4; i++) {
        const sx = -0.82 + i * 0.44;
        const s = new THREE.Mesh(sockG, mats.secondaryBody); s.position.set(sx, 0, 0.175); root.add(s);
        const p1 = new THREE.Mesh(pinG, mats.polishedChrome); p1.position.set(sx - 0.06, -0.04, 0.18); root.add(p1);
        const p2 = new THREE.Mesh(pinG, mats.polishedChrome); p2.position.set(sx + 0.06, -0.04, 0.18); root.add(p2);
        const p3 = new THREE.Mesh(pinG, mats.accentGlow); p3.position.set(sx, 0.07, 0.18); root.add(p3);
      }

      // Glowing Master Rocker Switch on Right
      const sw = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.24, 0.34, 0.09)), mats.accentGlow);
      sw.position.set(0.88, 0, 0.19); root.add(sw);

      // Thick Braided Power Cord
      const cord = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.22, 0, 0), new THREE.Vector3(-1.55, -0.22, -0.15), new THREE.Vector3(-1.32, -0.68, -0.1),
      ]);
      root.add(new THREE.Mesh(tr.geo(new THREE.TubeGeometry(cord, 24, 0.06, 12, false)), mats.matteTrim));

      return {
        id, root,
        update: (e, _dt, ex) => {
          sw.rotation.x = Math.sin(e * 2.2) * 0.16;
          topDeck.position.z = 0.15 + ex * 0.24;
          sw.position.z = 0.19 + ex * 0.36;
        },
      };
    }

    /* 16. 18650 3500mAh LI-ION BATTERY CELL */
    case 'battery_18650': {
      const root = new THREE.Group();
      const lTex = tr.tex(
        makeStaticLabel(512, 256, maxAniso, (ctx) => {
          ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 512, 256);
          ctx.fillStyle = '#10b981'; ctx.fillRect(0, 0, 512, 60);
          ctx.fillStyle = '#052e16'; ctx.font = '800 28px sans-serif'; ctx.fillText('CHIKO LI-ION · 3.7V', 28, 40);
          ctx.fillStyle = '#f8fafc'; ctx.font = '700 46px monospace'; ctx.fillText('3500 mAh', 28, 138);
          ctx.fillStyle = '#94a3b8'; ctx.font = '600 20px monospace'; ctx.fillText('18650 RECHARGEABLE CELL', 28, 185);
          ctx.fillStyle = '#fbbf24'; ctx.font = '800 34px monospace'; ctx.fillText('+  +  +  +  +', 28, 234);
        })
      );
      root.add(new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.54, 0.54, 1.94, 40)), tr.mat(new THREE.MeshStandardMaterial({ map: lTex, metalness: 0.45, roughness: 0.28 }))));
      const pRing = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.5, 0.52, 0.08, 32)), mats.primaryMetal); pRing.position.y = 1.01; root.add(pRing);
      const pBtn = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 24)), mats.polishedChrome); pBtn.position.y = 1.1; root.add(pBtn);
      const nCap = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.52, 0.5, 0.1, 32)), mats.polishedChrome); nCap.position.y = -1.01; root.add(nCap);
      const rings = [0, 1, 2].map(() => {
        const r = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.66, 0.022, 12, 40)), mats.accentGlow); r.rotation.x = Math.PI / 2; root.add(r); return r;
      });
      return {
        id, root,
        update: (e, _dt, ex) => {
          pBtn.position.y = 1.1 + ex * 0.32; pRing.position.y = 1.01 + ex * 0.2; nCap.position.y = -1.01 - ex * 0.24;
          rings.forEach((r, i) => { const p = (e * 0.75 + i / 3) % 1; r.position.y = -0.88 + p * 1.8; r.scale.setScalar(0.95 + Math.sin(p * Math.PI) * 0.22); });
        },
      };
    }

    /* 17. 9V RECTANGULAR SMART USB-C BLOCK BATTERY */
    case 'battery_9v': {
      const root = new THREE.Group();
      const blkGeo = tr.geo(
        new THREE.ExtrudeGeometry(roundedRect(1.16, 1.72, 0.14), {
          depth: 0.68, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3,
        })
      );
      blkGeo.translate(0, 0, -0.34);
      root.add(new THREE.Mesh(blkGeo, mats.secondaryBody));

      const goldBand = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(1.25, 0.42, 0.77)), mats.primaryMetal);
      goldBand.position.y = 0.66; root.add(goldBand);

      const lblTex = tr.tex(
        makeStaticLabel(256, 256, maxAniso, (ctx) => {
          ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = '#fbbf24'; ctx.font = '900 92px monospace'; ctx.textAlign = 'center'; ctx.fillText('9V', 128, 122);
          ctx.fillStyle = '#ffffff'; ctx.font = '700 22px sans-serif'; ctx.fillText('USB-C SMART', 128, 174);
          ctx.fillStyle = '#34d399'; ctx.font = '600 18px monospace'; ctx.fillText('1200 mAh LI-PO', 128, 212);
        })
      );
      const frontLbl = new THREE.Mesh(tr.geo(new THREE.PlaneGeometry(1.06, 1.1)), tr.mat(new THREE.MeshStandardMaterial({ map: lblTex, roughness: 0.3 })));
      frontLbl.position.set(0, -0.14, 0.385); root.add(frontLbl);

      // Iconic 9V Twin Top Terminals: Circular (+) & Hexagonal (-)
      const posTerm = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 20)), mats.polishedChrome);
      posTerm.position.set(-0.28, 0.98, 0); root.add(posTerm);
      const negTerm = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.19, 0.19, 0.22, 6)), mats.polishedChrome);
      negTerm.position.set(0.28, 0.98, 0); root.add(negTerm);

      // Glowing USB-C recharge port on side
      const usbc = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.06, 0.22, 0.1)), mats.accentGlow);
      usbc.position.set(0.62, -0.42, 0); root.add(usbc);

      return {
        id, root,
        update: (e, _dt, ex) => {
          posTerm.position.y = 0.98 + ex * 0.3;
          negTerm.position.y = 0.98 + ex * 0.3;
          goldBand.position.y = 0.66 + ex * 0.16;
          usbc.scale.setScalar(1 + Math.sin(e * 4) * 0.08);
        },
      };
    }

    /* 18. CR2032 LITHIUM WATCH BUTTON COIN CELL */
    case 'coin_cell': {
      const root = new THREE.Group();
      const coinG = tr.geo(new THREE.CylinderGeometry(1.06, 1.06, 0.24, 56));
      coinG.rotateX(Math.PI / 2);
      root.add(new THREE.Mesh(coinG, mats.polishedChrome));

      const coinTex = tr.tex(
        makeStaticLabel(512, 512, maxAniso, (ctx) => {
          const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
          g.addColorStop(0, '#f4f4f5'); g.addColorStop(0.7, '#d4d4d8'); g.addColorStop(1, '#a1a1aa');
          ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
          ctx.strokeStyle = '#52525b'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(256, 256, 224, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#18181b'; ctx.textAlign = 'center';
          ctx.font = '800 58px monospace'; ctx.fillText('CR2032', 256, 224);
          ctx.font = '700 40px sans-serif'; ctx.fillText('+', 256, 134);
          ctx.font = '700 32px monospace'; ctx.fillText('LITHIUM 3V', 256, 294);
          ctx.font = '600 22px sans-serif'; ctx.fillText('NEW CHIKO SWISS CELL', 256, 356);
        })
      );
      const face = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(1.02, 56)), tr.mat(new THREE.MeshStandardMaterial({ map: coinTex, metalness: 0.86, roughness: 0.16 })));
      face.position.z = 0.125; root.add(face);

      const sealRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.98, 0.03, 12, 56)), mats.accentGlow);
      sealRing.position.z = -0.12; root.add(sealRing);

      return {
        id, root,
        update: (e, _dt, ex) => {
          face.position.z = 0.125 + ex * 0.34;
          sealRing.position.z = -0.12 - ex * 0.34;
          sealRing.rotation.z = e * 1.2;
        },
      };
    }

    /* 19. AURORA RGB SMART AMBIENT LIGHT BAR */
    case 'rgblight': {
      const root = new THREE.Group();
      const rgbMat = tr.mat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: new THREE.Color(0x38bdf8), emissiveIntensity: 1.4, roughness: 0.12 }));
      const base = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.54, 0.64, 0.22, 32)), mats.secondaryBody); base.position.y = -1.02; root.add(base);
      const cap = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.32, 0.36, 0.16, 24)), mats.primaryMetal); cap.position.y = 1.03; root.add(cap);
      root.add(new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.24, 0.24, 1.9, 24)), rgbMat));
      const glass = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.33, 0.33, 1.92, 6)), mats.glass); glass.renderOrder = 10; root.add(glass);
      const fins = [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        const f = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.06, 1.9, 0.12)), mats.primaryMetal);
        f.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34); f.rotation.y = -a; root.add(f); return f;
      });
      const halos = [0, 1, 2].map((i) => {
        const h = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.6 + i * 0.16, 0.018, 12, 44)), rgbMat); h.rotation.x = Math.PI / 2; root.add(h); return h;
      });
      return {
        id, root,
        update: (e, _dt, ex) => {
          _rgbColor.setHSL((e * 0.2) % 1, 0.92, 0.56); rgbMat.color.copy(_rgbColor); rgbMat.emissive.copy(_rgbColor);
          fins.forEach((f, i) => { const a = (i / 4) * Math.PI * 2; const r = 0.34 + ex * 0.32; f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); });
          halos.forEach((h, i) => { h.position.y = Math.sin(e * 1.6 + i * 2.1) * 0.76; h.scale.setScalar(0.9 + Math.sin(e * 2 + i) * 0.14 + ex * 0.2); });
        },
      };
    }

    /* 20. TACTICAL 5000LM RECHARGEABLE LED TORCH */
    case 'flashlight': {
      const root = new THREE.Group();
      const tg = new THREE.Group(); tg.rotation.z = -Math.PI * 0.18; root.add(tg);
      const body = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.28, 0.26, 1.44, 30)), mats.secondaryBody); body.position.y = -0.35; tg.add(body);
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.29, 0.025, 10, 30)), mats.primaryMetal); g.rotation.x = Math.PI / 2; g.position.y = -0.8 + i * 0.24; tg.add(g);
      }
      const head = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.52, 0.3, 0.5, 30)), mats.primaryMetal); head.position.y = 0.6; tg.add(head);
      const ledMat = tr.mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xfff7cc), emissiveIntensity: 1.8, roughness: 0.05 }));
      const em = new THREE.Mesh(tr.geo(new THREE.CircleGeometry(0.4, 30)), ledMat); em.rotation.x = -Math.PI / 2; em.position.y = 0.84; tg.add(em);
      const beamMat = tr.mat(new THREE.MeshBasicMaterial({ color: 0xfff8dc, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
      const beam = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.92, 0.4, 1.3, 30, 1, true)), beamMat); beam.position.y = 1.5; beam.renderOrder = 11; tg.add(beam);
      const cob = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.14, 0.56, 0.06)), ledMat); cob.position.set(0, -0.25, 0.28); tg.add(cob);
      const tail = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.28, 0.25, 0.18, 22)), mats.accentGlow); tail.position.y = -1.14; tg.add(tail);
      return {
        id, root,
        update: (e, _dt, ex) => {
          beamMat.opacity = 0.16 + (Math.sin(e * 3.2) + 1) * 0.08;
          head.position.y = 0.6 + ex * 0.26; em.position.y = 0.84 + ex * 0.34; beam.position.y = 1.5 + ex * 0.34; tail.position.y = -1.14 - ex * 0.24;
        },
      };
    }

    /* 21. 12-INCH STUDIO LED RING LIGHT */
    case 'ringlight': {
      const root = new THREE.Group();
      const ringMat = tr.mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xfffbeb), emissiveIntensity: 1.4, roughness: 0.12 }));
      const bez = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.86, 0.1, 18, 52)), mats.secondaryBody); bez.position.set(0, 0.34, -0.04); root.add(bez);
      const glow = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.86, 0.082, 16, 52)), ringMat); glow.position.set(0, 0.34, 0.04); root.add(glow);
      const clamp = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.44, 0.26, 0.12)), mats.primaryMetal); clamp.position.set(0, 0.28, 0.02); root.add(clamp);
      const pole = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.06, 0.075, 0.84, 18)), mats.primaryMetal); pole.position.set(0, -0.82, 0); root.add(pole);
      const base = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.56, 0.62, 0.12, 32)), mats.secondaryBody); base.position.set(0, -1.22, 0); root.add(base);
      return {
        id, root,
        update: (e, _dt, ex) => {
          _rgbColor.setHSL((e * 0.2) % 1, 0.88, 0.6); ringMat.color.copy(_rgbColor); ringMat.emissive.copy(_rgbColor);
          glow.position.z = 0.04 + ex * 0.32; clamp.position.z = 0.02 + ex * 0.46;
        },
      };
    }

    /* 22. SMART WI-FI RGB LED BULB (E27 EDISON SCREW BASE!) */
    case 'smart_bulb': {
      const root = new THREE.Group();
      const domeMat = tr.mat(
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          emissive: new THREE.Color(0x38bdf8),
          emissiveIntensity: 1.15,
          roughness: 0.18,
          clearcoat: 0.9,
        })
      );
      // Glowing glass bulb globe
      const globe = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.76, 36, 28)), domeMat);
      globe.scale.set(1, 1.06, 1); globe.position.y = 0.44; root.add(globe);

      // Sleek matte heatsink funnel collar
      const collar = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.56, 0.36, 0.56, 32)), mats.secondaryBody);
      collar.position.y = -0.32; root.add(collar);

      const accentRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.54, 0.028, 12, 36)), mats.primaryMetal);
      accentRing.rotation.x = Math.PI / 2; accentRing.position.y = -0.04; root.add(accentRing);

      // Threaded metallic E27 Edison screw base
      const screwCore = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.32, 0.28, 0.48, 28)), mats.polishedChrome);
      screwCore.position.y = -0.82; root.add(screwCore);
      for (let i = 0; i < 4; i++) {
        const thread = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.32 - i * 0.01, 0.028, 10, 28)), mats.primaryMetal);
        thread.rotation.x = Math.PI / 2 + 0.08; thread.position.y = -0.66 - i * 0.1; root.add(thread);
      }
      const contactTip = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.14, 16, 12)), mats.matteTrim);
      contactTip.position.y = -1.08; root.add(contactTip);

      // Ambient light halo
      const halo = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.96, 0.015, 10, 48)), domeMat);
      halo.position.y = 0.44; root.add(halo);

      return {
        id, root,
        update: (e, _dt, ex) => {
          _rgbColor.setHSL((e * 0.22) % 1, 0.9, 0.58);
          domeMat.emissive.copy(_rgbColor);
          globe.position.y = 0.44 + ex * 0.32;
          halo.position.y = 0.44 + ex * 0.32;
          halo.rotation.x = e * 1.1; halo.rotation.y = e * 0.9;
          screwCore.position.y = -0.82 - ex * 0.22;
        },
      };
    }

    /* 23. RECHARGEABLE MINI / DESK COOLING FAN (5-BLADE SPINNING ROTOR!) */
    case 'fan': {
      const root = new THREE.Group();
      const base = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.56, 0.64, 0.16, 34)), mats.secondaryBody); base.position.y = -1.1; root.add(base);
      const pBtn = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18)), mats.accentGlow); pBtn.position.set(0, -1.0, 0.32); root.add(pBtn);
      const stem = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.12, 0.15, 0.82, 20)), mats.primaryMetal); stem.position.set(0, -0.66, -0.08); root.add(stem);

      const head = new THREE.Group(); head.position.set(0, 0.26, 0); root.add(head);
      head.add(new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.9, 0.082, 18, 52)), mats.primaryMetal));
      const cage = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.54, 0.015, 10, 36)), mats.polishedChrome); cage.position.z = 0.15; head.add(cage);
      const mot = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.26, 0.24, 0.34, 22)), mats.secondaryBody); mot.rotation.x = Math.PI / 2; mot.position.z = -0.14; head.add(mot);

      const rotor = new THREE.Group(); rotor.position.z = 0.04;
      const hub = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.19, 0.21, 0.12, 20)), mats.accentGlow); hub.rotation.x = Math.PI / 2; rotor.add(hub);
      const bG = tr.geo(new THREE.ExtrudeGeometry(roundedRect(0.27, 0.66, 0.11), { depth: 0.024, bevelEnabled: false }));
      bG.translate(0, 0.42, -0.012);
      for (let i = 0; i < 5; i++) {
        const h = new THREE.Group(); h.rotation.z = (i / 5) * Math.PI * 2;
        const b = new THREE.Mesh(bG, mats.polishedChrome); b.rotation.y = 0.38; h.add(b); rotor.add(h);
      }
      head.add(rotor);
      const wind = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.66, 0.012, 10, 40, Math.PI * 1.2)), mats.accentGlow);
      wind.position.z = 0.3; head.add(wind);

      return {
        id, root,
        update: (e, _dt, ex) => {
          rotor.rotation.z = -e * 12;
          head.rotation.y = Math.sin(e * 0.9) * 0.42;
          wind.rotation.z = -e * 6.5; wind.position.z = 0.26 + ((e * 1.4) % 0.52) + ex * 0.32;
          cage.position.z = 0.15 + ex * 0.36; rotor.position.z = 0.04 + ex * 0.18;
        },
      };
    }

    /* 24. SCIENTIFIC LCD CALCULATOR (24 INSTANCED RIPPLING KEYS!) */
    case 'calculator': {
      const root = new THREE.Group();
      const bG = tr.geo(new THREE.ExtrudeGeometry(roundedRect(1.46, 2.14, 0.15), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }));
      bG.translate(0, 0, -0.09); root.add(new THREE.Mesh(bG, mats.secondaryBody));
      const frame = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(1.24, 0.54, 0.06)), mats.primaryMetal); frame.position.set(0, 0.65, 0.13); root.add(frame);

      const eqs = ['12,450 × 2', 'sin(45°) = 0.707', '৳ 24,900.00', '√(2026) = 45.01'];
      const ans = ['24,900', '0.7071', '24,900', '45.011'];
      const lcd = makeLiveCanvas(256, 112, maxAniso, 0.35, (ctx, elapsed) => {
        const s = Math.floor(elapsed * 0.45) % eqs.length;
        ctx.fillStyle = '#a7c4a0'; ctx.fillRect(0, 0, 256, 112);
        ctx.fillStyle = '#182b1c'; ctx.textAlign = 'left'; ctx.font = '600 15px monospace';
        ctx.fillText('DEG  MATH  CHIKO', 14, 26); ctx.fillText(eqs[s], 14, 54);
        ctx.textAlign = 'right'; ctx.font = '700 34px monospace'; ctx.fillText(ans[s], 242, 96);
      });
      tr.tex(lcd.tex);
      const lcdM = new THREE.Mesh(tr.geo(new THREE.PlaneGeometry(1.14, 0.45)), tr.mat(new THREE.MeshStandardMaterial({ map: lcd.tex, emissiveMap: lcd.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.4 })));
      lcdM.position.set(0, 0.65, 0.165); root.add(lcdM);

      const keys = new THREE.InstancedMesh(tr.geo(new THREE.BoxGeometry(0.22, 0.135, 0.08)), mats.primaryMetal, 24);
      keys.frustumCulled = false; root.add(keys);
      const eqKey = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.24, 0.145, 0.095)), mats.accentGlow);
      eqKey.position.set(0.42, -0.87, 0.155); root.add(eqKey);

      return {
        id, root,
        update: (e, _dt, ex) => {
          lcd.redraw(e);
          const act = Math.floor(e * 3.5) % 24;
          for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 4; c++) {
              const i = r * 4 + c;
              dummy.position.set(-0.42 + c * 0.28, 0.23 - r * 0.22, 0.15 + (i === act ? -0.035 : 0) + ex * 0.25);
              dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
              keys.setMatrixAt(i, dummy.matrix);
            }
          }
          keys.instanceMatrix.needsUpdate = true;
          lcdM.position.z = 0.165 + ex * 0.34; eqKey.position.z = 0.155 + ex * 0.32;
        },
      };
    }

    /* 25. DIGITAL POCKET PRECISION SCALE */
    case 'digital_scale': {
      const root = new THREE.Group();
      root.rotation.x = 0.55;
      const bodyG = tr.geo(new THREE.ExtrudeGeometry(roundedRect(1.62, 2.08, 0.14), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3 }));
      bodyG.translate(0, 0, -0.11); root.add(new THREE.Mesh(bodyG, mats.secondaryBody));

      // Brushed stainless steel weighing pan
      const pan = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(1.38, 1.24, 0.07)), mats.polishedChrome);
      pan.position.set(0, 0.26, 0.17); root.add(pan);

      // Glowing Blue Backlit Gram Readout LCD
      const readout = makeLiveCanvas(256, 96, maxAniso, 0.25, (ctx, elapsed) => {
        ctx.fillStyle = '#0c2748'; ctx.fillRect(0, 0, 256, 96);
        ctx.fillStyle = '#38bdf8'; ctx.font = '700 46px monospace'; ctx.textAlign = 'right';
        const wt = (128.4 + Math.sin(elapsed * 1.4) * 18.6).toFixed(1);
        ctx.fillText(`${wt} g`, 240, 66);
        ctx.fillStyle = '#bae6fd'; ctx.font = '600 14px monospace'; ctx.textAlign = 'left';
        ctx.fillText('TARE  PCS', 14, 26);
      });
      tr.tex(readout.tex);
      const lcd = new THREE.Mesh(tr.geo(new THREE.PlaneGeometry(1.02, 0.36)), tr.mat(new THREE.MeshStandardMaterial({ map: readout.tex, emissiveMap: readout.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.85 })));
      lcd.position.set(0, -0.68, 0.155); root.add(lcd);

      // 4 Tactile Control Buttons below LCD
      const bG = tr.geo(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16)); bG.rotateX(Math.PI / 2);
      [-0.42, -0.14, 0.14, 0.42].forEach((bx, idx) => {
        const b = new THREE.Mesh(bG, idx === 0 ? mats.accentGlow : mats.primaryMetal);
        b.position.set(bx, -0.94, 0.15); root.add(b);
      });

      return {
        id, root,
        update: (e, _dt, ex) => {
          readout.redraw(e);
          pan.position.z = 0.17 + Math.sin(e * 1.4) * 0.02 + ex * 0.36;
          lcd.position.z = 0.155 + ex * 0.24;
        },
      };
    }

    /* 26. PRO METAL BARBER ELECTRIC TRIMMER */
    case 'trimmer': {
      const root = new THREE.Group();
      const barrel = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.28, 0.22, 1.56, 30)), mats.primaryMetal);
      barrel.position.y = -0.22; root.add(barrel);

      // Engraved metallic grip sleeve
      const grip = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.295, 0.26, 0.78, 24)), mats.secondaryBody);
      grip.position.y = -0.32; root.add(grip);

      // Power Button + Glowing Battery LED Ring
      const pRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.11, 0.02, 10, 24)), mats.accentGlow);
      pRing.position.set(0, 0.18, 0.28); root.add(pRing);

      // Tapered Neck & Precision Stainless T-Blade Head
      const neck = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.18, 0.26, 0.26, 20)), mats.secondaryBody);
      neck.position.y = 0.66; root.add(neck);

      const bladeHead = new THREE.Group();
      bladeHead.position.set(0, 0.86, 0.05);
      bladeHead.add(new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.76, 0.22, 0.14)), mats.polishedChrome));
      // 11 Fine T-Blade Teeth
      const toothG = tr.geo(new THREE.BoxGeometry(0.036, 0.14, 0.06));
      for (let i = -5; i <= 5; i++) {
        const th = new THREE.Mesh(toothG, mats.accentGlow);
        th.position.set(i * 0.068, 0.15, 0.02); bladeHead.add(th);
      }
      root.add(bladeHead);

      const bottomCap = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.22, 0.2, 0.12, 24)), mats.accentGlow);
      bottomCap.position.y = -1.04; root.add(bottomCap);

      return {
        id, root,
        update: (e, _dt, ex) => {
          // Micro high-frequency blade oscillation
          bladeHead.position.x = Math.sin(e * 42) * 0.015;
          bladeHead.position.y = 0.86 + ex * 0.34;
          bottomCap.position.y = -1.04 - ex * 0.22;
        },
      };
    }

    /* 27. 360° SMART WI-FI CCTV SECURITY CAMERA */
    case 'cctv_cam': {
      const root = new THREE.Group();
      // Weighted motorized base
      const base = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.68, 0.78, 0.36, 36)), mats.primaryMetal);
      base.position.y = -0.82; root.add(base);

      // Twin U-Bracket Support Arms
      const armGeo = tr.geo(new THREE.BoxGeometry(0.16, 0.96, 0.28));
      const aL = new THREE.Mesh(armGeo, mats.primaryMetal); aL.position.set(-0.68, -0.18, 0); root.add(aL);
      const aR = new THREE.Mesh(armGeo, mats.primaryMetal); aR.position.set(0.68, -0.18, 0); root.add(aR);

      // Motorized Pan-Tilt Optical Camera Sphere
      const camHead = new THREE.Group();
      camHead.position.y = 0.14;
      camHead.add(new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.62, 36, 28)), mats.primaryMetal));

      // Glossy Dark Visor + Multi-Layer Optical Lens
      const visor = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.36, 0.38, 0.16, 32)), mats.secondaryBody);
      visor.rotation.x = Math.PI / 2; visor.position.z = 0.52; camHead.add(visor);

      const lensRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.24, 0.03, 12, 32)), mats.accentGlow);
      lensRing.position.z = 0.61; camHead.add(lensRing);

      const lensGlass = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.21, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45)), mats.glass);
      lensGlass.rotation.x = Math.PI / 2; lensGlass.position.z = 0.56; lensGlass.renderOrder = 10; camHead.add(lensGlass);

      // Twin Wi-Fi Antennas behind base
      const antG = tr.geo(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 12));
      const antL = new THREE.Mesh(antG, mats.secondaryBody); antL.position.set(-0.46, 0.12, -0.58); antL.rotation.z = 0.14; root.add(antL);
      const antR = new THREE.Mesh(antG, mats.secondaryBody); antR.position.set(0.46, 0.12, -0.58); antR.rotation.z = -0.14; root.add(antR);

      root.add(camHead);

      return {
        id, root,
        update: (e, _dt, ex) => {
          camHead.rotation.y = Math.sin(e * 0.95) * 0.55;
          camHead.rotation.x = Math.cos(e * 0.7) * 0.24;
          camHead.position.y = 0.14 + ex * 0.28;
          lensRing.position.z = 0.61 + ex * 0.24;
        },
      };
    }

    /* 28. 8-IN-1 4K ALUMINUM USB-C HUB */
    case 'usbhub': {
      const root = new THREE.Group();
      const bG = tr.geo(new THREE.ExtrudeGeometry(roundedRect(2.08, 0.7, 0.14), { depth: 0.26, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 4 }));
      bG.translate(0, 0, -0.13); root.add(new THREE.Mesh(bG, mats.primaryMetal));
      const pG = tr.geo(new THREE.BoxGeometry(0.24, 0.1, 0.08));
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(pG, i % 2 === 0 ? mats.accentGlow : mats.polishedChrome);
        p.position.set(-0.68 + i * 0.45, 0, 0.19); root.add(p);
      }
      const cc = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.06, 0, 0), new THREE.Vector3(-1.4, -0.18, 0.14), new THREE.Vector3(-1.24, -0.66, 0.24), new THREE.Vector3(-0.66, -0.8, 0.14)]);
      root.add(new THREE.Mesh(tr.geo(new THREE.TubeGeometry(cc, 28, 0.055, 12, false)), mats.matteTrim));
      const plug = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.36, 0.18, 0.12)), mats.polishedChrome); plug.position.set(-0.5, -0.8, 0.14); root.add(plug);
      const dRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.95, 0.015, 10, 48, Math.PI * 1.4)), mats.accentGlow); root.add(dRing);
      return {
        id, root,
        update: (e, _dt, ex) => {
          dRing.rotation.set(e * 1.1, e * 0.9, 0); dRing.scale.setScalar(1 + ex * 0.25); plug.position.x = -0.5 + ex * 0.25;
        },
      };
    }

    /* 29. 128GB METAL SWIVEL USB FLASH PENDRIVE */
    case 'pendrive': {
      const root = new THREE.Group();
      root.rotation.z = Math.PI * 0.16;

      // Inner Flash Memory Core + Exposed USB-A Plug
      const core = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.56, 1.32, 0.22)), mats.secondaryBody);
      core.position.y = -0.12; root.add(core);

      const usbPlug = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.46, 0.56, 0.16)), mats.polishedChrome);
      usbPlug.position.y = 0.82; root.add(usbPlug);

      // 2 Iconic Rectangular USB-A Cutout Dots
      const dotG = tr.geo(new THREE.BoxGeometry(0.08, 0.08, 0.18));
      const d1 = new THREE.Mesh(dotG, mats.secondaryBody); d1.position.set(-0.11, 0.92, 0); root.add(d1);
      const d2 = new THREE.Mesh(dotG, mats.secondaryBody); d2.position.set(0.11, 0.92, 0); root.add(d2);

      // Swiveling Brushed Metal U-Shield Cap!
      const swivelPivot = new THREE.Group();
      swivelPivot.position.set(0, -0.34, 0);
      const shieldL = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.64, 1.24, 0.05)), mats.primaryMetal);
      shieldL.position.set(0, 0.44, 0.145); swivelPivot.add(shieldL);
      const shieldR = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.64, 1.24, 0.05)), mats.primaryMetal);
      shieldR.position.set(0, 0.44, -0.145); swivelPivot.add(shieldR);
      const shieldTop = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.64, 0.07, 0.34)), mats.primaryMetal);
      shieldTop.position.set(0, 1.06, 0); swivelPivot.add(shieldTop);
      root.add(swivelPivot);

      // Keyring Loop + Activity LED
      const loop = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.24, 0.042, 12, 28)), mats.polishedChrome);
      loop.position.y = -0.96; root.add(loop);

      const led = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.06, 12, 12)), mats.accentGlow);
      led.position.set(0, -0.66, 0.12); root.add(led);

      return {
        id, root,
        update: (e, _dt, ex) => {
          const swing = Math.PI * 0.45 + Math.sin(e * 1.2) * 0.45 + ex * 0.8;
          swivelPivot.rotation.z = swing;
          usbPlug.position.y = 0.82 + ex * 0.22;
        },
      };
    }

    /* 30. RGB WIRELESS GAMING MOUSE */
    case 'gaming_mouse': {
      const root = new THREE.Group();
      root.rotation.x = 0.46;

      // Sculpted ergonomic curved mouse shell
      const shell = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.86, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.55)), mats.secondaryBody);
      shell.scale.set(0.82, 0.65, 1.38); shell.position.y = -0.1; root.add(shell);

      // Flat base plate + Glowing RGB Underglow Rim!
      const base = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.7, 0.68, 0.12, 36)), mats.matteTrim);
      base.scale.set(1, 1, 1.65); base.position.y = -0.16; root.add(base);

      const rgbRim = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.7, 0.032, 12, 48)), mats.accentGlow);
      rgbRim.rotation.x = Math.PI / 2; rgbRim.scale.set(1, 1.66, 1); rgbRim.position.y = -0.14; root.add(rgbRim);

      // Split Left & Right Click Plates + Glowing Scroll Wheel
      const clickGeo = tr.geo(new THREE.BoxGeometry(0.46, 0.08, 0.82));
      const lClick = new THREE.Mesh(clickGeo, mats.primaryMetal); lClick.position.set(-0.26, 0.22, -0.42); lClick.rotation.x = 0.34; root.add(lClick);
      const rClick = new THREE.Mesh(clickGeo, mats.primaryMetal); rClick.position.set(0.26, 0.22, -0.42); rClick.rotation.x = 0.34; root.add(rClick);

      const wheel = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.14, 0.14, 0.11, 24)), mats.accentGlow);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.28, -0.48); root.add(wheel);

      return {
        id, root,
        update: (e, _dt, ex) => {
          wheel.rotation.x = -e * 3.5;
          lClick.position.y = 0.22 + ex * 0.26;
          rClick.position.y = 0.22 + ex * 0.26;
          wheel.position.y = 0.28 + ex * 0.36;
        },
      };
    }

    /* 31. 65% RGB MECHANICAL KEYBOARD (40 INSTANCED KEYCAPS + WAVE!) */
    case 'mech_keyboard': {
      const root = new THREE.Group();
      root.rotation.x = 0.64;

      const chassis = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(2.38, 0.96, 0.22)), mats.primaryMetal);
      root.add(chassis);
      const plate = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(2.24, 0.82, 0.06)), mats.secondaryBody);
      plate.position.z = 0.12; root.add(plate);

      // Glowing RGB Underglow Strip
      const underGlow = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(2.42, 1.0, 0.04)), mats.accentGlow);
      underGlow.position.z = -0.08; root.add(underGlow);

      // 40 Instanced Sculpted Mechanical Keycaps (10 cols × 4 rows)
      const capGeo = tr.geo(new THREE.BoxGeometry(0.175, 0.155, 0.12));
      const caps = new THREE.InstancedMesh(capGeo, mats.matteTrim, 40);
      caps.frustumCulled = false; root.add(caps);

      // Highlight Accent ESC & Enter Keys
      const escKey = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.18, 0.16, 0.13)), mats.accentGlow);
      escKey.position.set(-0.99, 0.285, 0.2); root.add(escKey);

      return {
        id, root,
        update: (e, _dt, ex) => {
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 10; c++) {
              const idx = r * 10 + c;
              const wave = Math.sin(e * 4.2 - c * 0.48 - r * 0.5) * 0.035;
              dummy.position.set(-0.99 + c * 0.22, 0.285 - r * 0.19, 0.2 + wave + ex * 0.3);
              dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
              caps.setMatrixAt(idx, dummy.matrix);
            }
          }
          caps.instanceMatrix.needsUpdate = true;
          escKey.position.z = 0.2 + Math.sin(e * 4.2) * 0.035 + ex * 0.38;
        },
      };
    }

    /* 32. 4K WATERPROOF ACTION CAMERA */
    case 'action_cam': {
      const root = new THREE.Group();
      const bG = tr.geo(new THREE.ExtrudeGeometry(roundedRect(1.88, 1.32, 0.18), { depth: 0.72, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4 }));
      bG.translate(0, 0, -0.36); root.add(new THREE.Mesh(bG, mats.secondaryBody));

      // Protruding Square-Rounded Wide-Angle Lens Housing on Left
      const lensBox = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.76, 0.76, 0.28)), mats.primaryMetal);
      lensBox.position.set(-0.42, 0.12, 0.44); root.add(lensBox);

      const lensRing = new THREE.Mesh(tr.geo(new THREE.TorusGeometry(0.28, 0.04, 14, 36)), mats.polishedChrome);
      lensRing.position.set(-0.42, 0.12, 0.6); root.add(lensRing);

      const lensGlass = new THREE.Mesh(tr.geo(new THREE.SphereGeometry(0.25, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45)), mats.glass);
      lensGlass.rotation.x = Math.PI / 2; lensGlass.position.set(-0.42, 0.12, 0.54); lensGlass.renderOrder = 10; root.add(lensGlass);

      // Front Color Selfie/Status Mini Display on Right
      const statusLcd = makeLiveCanvas(160, 160, maxAniso, 0.25, (ctx, elapsed) => {
        ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, 160, 160);
        ctx.fillStyle = elapsed % 1 < 0.5 ? '#ef4444' : '#7f1d1d';
        ctx.beginPath(); ctx.arc(28, 28, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 22px monospace'; ctx.fillText('REC', 48, 36);
        ctx.fillStyle = '#38bdf8'; ctx.font = '800 32px monospace'; ctx.fillText('4K 60', 22, 92);
        ctx.fillStyle = '#34d399'; ctx.font = '600 18px monospace'; ctx.fillText('STAB ON', 22, 134);
      });
      tr.tex(statusLcd.tex);
      const scr = new THREE.Mesh(tr.geo(new THREE.PlaneGeometry(0.66, 0.66)), tr.mat(new THREE.MeshStandardMaterial({ map: statusLcd.tex, emissiveMap: statusLcd.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.75 })));
      scr.position.set(0.42, 0.06, 0.415); root.add(scr);

      // Red Top Shutter Button + Bottom Mounting Fingers
      const shutter = new THREE.Mesh(tr.geo(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 24)), mats.accentGlow);
      shutter.position.set(0.42, 0.72, 0); root.add(shutter);

      const mountL = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.12, 0.28, 0.36)), mats.primaryMetal); mountL.position.set(-0.18, -0.82, 0); root.add(mountL);
      const mountR = new THREE.Mesh(tr.geo(new THREE.BoxGeometry(0.12, 0.28, 0.36)), mats.primaryMetal); mountR.position.set(0.18, -0.82, 0); root.add(mountR);

      return {
        id, root,
        update: (e, _dt, ex) => {
          statusLcd.redraw(e);
          lensBox.position.z = 0.44 + ex * 0.26;
          lensRing.position.z = 0.6 + ex * 0.38;
          lensGlass.position.z = 0.54 + ex * 0.44;
          shutter.position.y = 0.72 + ex * 0.22;
        },
      };
    }
  }
}
