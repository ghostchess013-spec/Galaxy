import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Agent, BuildingArchetype, ThemeId } from '../types/nexora';

interface AgentCity3DProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  theme: ThemeId;
  compact?: boolean;
  cameraPresetTrigger?: { mode: 'overview' | 'focus' | 'top'; nonce: number };
}

interface TowerVisualRecord {
  agentId: string;
  group: THREE.Group;
  position: THREE.Vector3;
  labelAnchorY: number;
  accentMeshes: THREE.Mesh[];
  sonarRing: THREE.Mesh;
  hitProxy: THREE.Mesh;
  shuttle?: THREE.Mesh;
  shuttlePhase: number;
}

const _projVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function getThemeColors(theme: ThemeId) {
  if (theme === 'tactical-phosphor') {
    return {
      bg: 0x050706,
      fog: 0x050706,
      deck: 0x111714,
      deckRim: 0x1b2620,
      road: 0x090d0b,
      roadDash: 0x00e864,
      buildingBody: 0x1a241f,
      buildingDark: 0x0d1310,
      plaza: 0x151e19,
      accentRing: 0x00e864,
      working: 0x2e90fa,
      idle: 0x00e864,
      alert: 0xff3b3b,
      treeLight: 0x244233,
      treeDark: 0x162920,
    };
  }
  if (theme === 'editorial-alabaster') {
    return {
      bg: 0xf0ebe2,
      fog: 0xf0ebe2,
      deck: 0xe6dfd3,
      deckRim: 0xcbc2b3,
      road: 0x2c2a29,
      roadDash: 0xf4f0e8,
      buildingBody: 0xfaf7f2,
      buildingDark: 0x2e2c2a,
      plaza: 0xf4efe6,
      accentRing: 0xe64c15,
      working: 0xe64c15,
      idle: 0xd9845b,
      alert: 0xdc2626,
      treeLight: 0x6c7361,
      treeDark: 0x4f5547,
    };
  }
  // Default: Obsidian Ember (matching NEXORA 3.0 video thumbnail)
  return {
    bg: 0x0a0909,
    fog: 0x0a0909,
    deck: 0xe6ddd0,
    deckRim: 0x3b2f26,
    road: 0x222021,
    roadDash: 0xf4efe8,
    buildingBody: 0xf7f3ec,
    buildingDark: 0x232225,
    plaza: 0xf1eae0,
    accentRing: 0xff4d0a,
    working: 0xff4d0a,
    idle: 0xe85d1a,
    alert: 0xef4444,
    treeLight: 0x5c5349,
    treeDark: 0x3e3731,
  };
}

function createRoadDashedRingTexture(roadHex: number, dashHex: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${roadHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = `#${dashHex.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 18]);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCompositeTower(
  archetype: BuildingArchetype,
  bodyMat: THREE.MeshStandardMaterial,
  darkMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial,
): { group: THREE.Group; accentMeshes: THREE.Mesh[]; height: number } {
  const g = new THREE.Group();
  const accentMeshes: THREE.Mesh[] = [];

  const addPart = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    isAccent = false,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    if (isAccent) accentMeshes.push(m);
    return m;
  };

  let height = 2.6;

  switch (archetype) {
    case 'hq_spire': {
      height = 3.85;
      // Stepped ceremonial plinth
      addPart(new THREE.CylinderGeometry(1.15, 1.28, 0.22, 32), bodyMat, 0, 0.11, 0);
      addPart(new THREE.CylinderGeometry(0.95, 1.05, 0.18, 32), darkMat, 0, 0.3, 0);
      // Central core column
      addPart(new THREE.CylinderGeometry(0.58, 0.68, 2.55, 24), bodyMat, 0, 1.65, 0);
      // 4 vertical glowing architectural fins
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI / 4;
        addPart(
          new THREE.BoxGeometry(0.14, 2.4, 0.24),
          accentMat,
          Math.cos(ang) * 0.62,
          1.62,
          Math.sin(ang) * 0.62,
          true,
          0,
          -ang,
          0,
        );
      }
      // Dual luminous crown rings
      addPart(new THREE.TorusGeometry(0.68, 0.06, 12, 32), accentMat, 0, 2.85, 0, true, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.66, 0.56, 0.26, 24), bodyMat, 0, 3.05, 0);
      addPart(new THREE.TorusGeometry(0.45, 0.05, 12, 28), accentMat, 0, 3.24, 0, true, Math.PI / 2);
      // Upper spire antenna
      addPart(new THREE.CylinderGeometry(0.05, 0.14, 0.62, 12), darkMat, 0, 3.55, 0);
      break;
    }

    case 'observatory_dome': {
      height = 2.25;
      addPart(new THREE.CylinderGeometry(0.96, 1.04, 0.26, 24), bodyMat, 0, 0.13, 0);
      addPart(new THREE.CylinderGeometry(0.84, 0.88, 0.52, 24), bodyMat, 0, 0.52, 0);
      addPart(new THREE.CylinderGeometry(0.86, 0.86, 0.16, 24), accentMat, 0, 0.86, 0, true);
      addPart(new THREE.CylinderGeometry(0.76, 0.84, 0.28, 24), darkMat, 0, 1.08, 0);
      addPart(
        new THREE.SphereGeometry(0.74, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
        bodyMat,
        0,
        1.18,
        0,
      );
      addPart(new THREE.BoxGeometry(0.14, 0.66, 0.82), accentMat, 0, 1.56, 0.22, true);
      addPart(new THREE.CylinderGeometry(0.03, 0.05, 0.35, 8), darkMat, 0, 2.04, 0);
      break;
    }

    case 'ribbed_tower': {
      height = 2.95;
      addPart(new THREE.CylinderGeometry(0.76, 0.86, 0.24, 24), darkMat, 0, 0.12, 0);
      addPart(new THREE.CylinderGeometry(0.64, 0.68, 2.25, 24), bodyMat, 0, 1.36, 0);
      for (let i = 0; i < 4; i++) {
        addPart(
          new THREE.TorusGeometry(0.66, 0.05, 10, 24),
          accentMat,
          0,
          0.62 + i * 0.52,
          0,
          true,
          Math.PI / 2,
        );
      }
      addPart(new THREE.CylinderGeometry(0.54, 0.62, 0.24, 20), darkMat, 0, 2.6, 0);
      addPart(new THREE.BoxGeometry(0.32, 0.24, 0.32), bodyMat, 0, 2.82, 0);
      break;
    }

    case 'octagonal_citadel': {
      height = 2.45;
      addPart(new THREE.CylinderGeometry(1.02, 1.1, 0.25, 8), bodyMat, 0, 0.125, 0);
      addPart(new THREE.CylinderGeometry(0.86, 0.92, 1.5, 8), bodyMat, 0, 1.0, 0);
      // Recessed vertical glowing pillars
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI * 2) / 6;
        addPart(
          new THREE.BoxGeometry(0.14, 1.25, 0.16),
          accentMat,
          Math.cos(ang) * 0.84,
          1.05,
          Math.sin(ang) * 0.84,
          true,
          0,
          -ang,
          0,
        );
      }
      addPart(new THREE.CylinderGeometry(0.74, 0.84, 0.32, 8), darkMat, 0, 1.9, 0);
      addPart(new THREE.CylinderGeometry(0.46, 0.52, 0.28, 8), accentMat, 0, 2.18, 0, true);
      break;
    }

    case 'curved_atelier': {
      height = 2.1;
      addPart(new THREE.CylinderGeometry(0.95, 1.02, 0.22, 28), bodyMat, 0, 0.11, 0);
      // Organic offset stacked studio decks
      addPart(new THREE.CylinderGeometry(0.84, 0.88, 0.44, 28), bodyMat, -0.1, 0.44, 0.06);
      addPart(new THREE.CylinderGeometry(0.76, 0.8, 0.14, 28), accentMat, -0.06, 0.72, 0.04, true);
      addPart(new THREE.CylinderGeometry(0.72, 0.76, 0.48, 28), bodyMat, 0.12, 1.02, -0.06);
      addPart(new THREE.CylinderGeometry(0.62, 0.66, 0.14, 28), accentMat, 0.08, 1.32, -0.04, true);
      addPart(new THREE.CylinderGeometry(0.52, 0.58, 0.36, 24), darkMat, 0.04, 1.56, 0);
      break;
    }

    case 'signal_spire': {
      height = 3.5;
      addPart(new THREE.CylinderGeometry(0.78, 0.92, 0.28, 20), bodyMat, 0, 0.14, 0);
      addPart(new THREE.CylinderGeometry(0.28, 0.48, 1.85, 20), bodyMat, 0, 1.2, 0);
      // Observation saucer deck
      addPart(new THREE.CylinderGeometry(0.76, 0.56, 0.22, 24), bodyMat, 0, 2.18, 0);
      addPart(new THREE.TorusGeometry(0.74, 0.055, 10, 28), accentMat, 0, 2.2, 0, true, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.14, 0.24, 0.68, 16), darkMat, 0, 2.64, 0);
      addPart(new THREE.CylinderGeometry(0.03, 0.06, 0.62, 10), bodyMat, 0, 3.22, 0);
      addPart(new THREE.SphereGeometry(0.11, 12, 12), accentMat, 0, 3.52, 0, true);
      break;
    }

    case 'cantilever_loft': {
      height = 2.15;
      // Curved C-shaped design loft matching Design Loft in thumbnail
      addPart(new THREE.CylinderGeometry(0.98, 1.04, 0.2, 24), darkMat, 0, 0.1, 0);
      addPart(
        new THREE.CylinderGeometry(0.9, 0.9, 0.92, 24, 1, false, 0, Math.PI * 1.45),
        bodyMat,
        0,
        0.66,
        0,
      );
      addPart(
        new THREE.CylinderGeometry(0.92, 0.92, 0.22, 24, 1, false, 0, Math.PI * 1.45),
        accentMat,
        0,
        0.72,
        0,
        true,
      );
      addPart(new THREE.BoxGeometry(1.15, 0.34, 0.66), bodyMat, 0.15, 1.32, 0.1);
      addPart(new THREE.BoxGeometry(0.95, 0.12, 0.54), accentMat, 0.15, 1.55, 0.1, true);
      break;
    }

    case 'stepped_ziggurat': {
      height = 2.45;
      // Stepped architectural pyramid matching Ledger House
      const tiers = 5;
      for (let i = 0; i < tiers; i++) {
        const w = 1.68 - i * 0.26;
        const y = 0.18 + i * 0.36;
        addPart(new THREE.BoxGeometry(w, 0.26, w), bodyMat, 0, y, 0);
        if (i === 1 || i === 3) {
          addPart(new THREE.BoxGeometry(w + 0.04, 0.09, w + 0.04), accentMat, 0, y + 0.16, 0, true);
        } else {
          addPart(new THREE.BoxGeometry(w - 0.06, 0.08, w - 0.06), darkMat, 0, y + 0.16, 0);
        }
      }
      addPart(new THREE.BoxGeometry(0.36, 0.32, 0.36), accentMat, 0, 2.1, 0, true);
      break;
    }

    case 'stacked_stage': {
      height = 2.55;
      // Cantilevered architectural cubes matching Studio Stage
      addPart(new THREE.BoxGeometry(1.4, 0.3, 1.25), bodyMat, 0, 0.15, 0);
      addPart(new THREE.BoxGeometry(1.1, 0.58, 1.05), bodyMat, -0.14, 0.59, 0.08);
      addPart(new THREE.BoxGeometry(1.16, 0.16, 1.1), accentMat, -0.14, 0.66, 0.08, true);
      addPart(new THREE.BoxGeometry(1.05, 0.56, 0.92), bodyMat, 0.18, 1.18, -0.1);
      addPart(new THREE.BoxGeometry(0.74, 0.54, 0.74), darkMat, -0.06, 1.74, 0.04);
      addPart(new THREE.BoxGeometry(0.78, 0.16, 0.78), accentMat, -0.06, 2.08, 0.04, true);
      break;
    }

    case 'twin_towers': {
      height = 2.95;
      // Sleek twin slabs matching Deal Desk
      addPart(new THREE.BoxGeometry(1.5, 0.24, 1.1), darkMat, 0, 0.12, 0);
      // Tall slab
      addPart(new THREE.BoxGeometry(0.56, 2.45, 0.64), bodyMat, -0.34, 1.44, 0);
      addPart(new THREE.BoxGeometry(0.59, 1.9, 0.26), accentMat, -0.34, 1.48, 0.22, true);
      // Secondary slab
      addPart(new THREE.BoxGeometry(0.52, 1.88, 0.58), bodyMat, 0.36, 1.16, 0.08);
      addPart(new THREE.BoxGeometry(0.55, 1.35, 0.24), accentMat, 0.36, 1.2, 0.28, true);
      // Skybridge
      addPart(new THREE.BoxGeometry(0.42, 0.22, 0.34), darkMat, 0.02, 1.36, 0.04);
      break;
    }

    case 'care_pavilion': {
      height = 2.15;
      addPart(new THREE.CylinderGeometry(1.02, 1.08, 0.22, 24), bodyMat, 0, 0.11, 0);
      addPart(new THREE.CylinderGeometry(0.92, 0.92, 0.68, 24), bodyMat, 0, 0.56, 0);
      addPart(new THREE.CylinderGeometry(0.94, 0.94, 0.2, 24), accentMat, 0, 0.62, 0, true);
      addPart(new THREE.CylinderGeometry(0.72, 0.86, 0.42, 24), darkMat, 0, 1.1, 0);
      addPart(new THREE.CylinderGeometry(0.56, 0.62, 0.3, 24), bodyMat, 0, 1.46, 0);
      addPart(new THREE.TorusGeometry(0.45, 0.05, 10, 24), accentMat, 0, 1.65, 0, true, Math.PI / 2);
      break;
    }

    case 'travel_rotunda':
    default: {
      height = 2.35;
      addPart(new THREE.CylinderGeometry(0.96, 1.04, 0.24, 24), bodyMat, 0, 0.12, 0);
      addPart(new THREE.CylinderGeometry(0.84, 0.9, 0.56, 24), bodyMat, 0, 0.52, 0);
      addPart(new THREE.CylinderGeometry(0.86, 0.86, 0.16, 24), accentMat, 0, 0.86, 0, true);
      addPart(new THREE.CylinderGeometry(0.72, 0.78, 0.52, 24), bodyMat, 0, 1.2, 0);
      addPart(new THREE.CylinderGeometry(0.74, 0.74, 0.14, 24), accentMat, 0, 1.52, 0, true);
      addPart(new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), darkMat, 0, 1.58, 0);
      break;
    }
  }

  return { group: g, accentMeshes, height };
}

export default function AgentCity3D({
  agents,
  selectedAgentId,
  onSelectAgent,
  theme,
  compact = false,
  cameraPresetTrigger,
}: AgentCity3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const agentsRef = useRef<Agent[]>(agents);
  const selectedRef = useRef<string | null>(selectedAgentId);
  const onSelectRef = useRef(onSelectAgent);
  const themeRef = useRef<ThemeId>(theme);

  agentsRef.current = agents;
  selectedRef.current = selectedAgentId;
  onSelectRef.current = onSelectAgent;
  themeRef.current = theme;

  // Imperative scene API ref so prop updates don't tear down WebGLRenderer
  const sceneApiRef = useRef<{
    rebuildTowers: (nextAgents: Agent[], nextTheme: ThemeId) => void;
    focusAgent: (agentId: string | null) => void;
    setCameraPreset: (mode: 'overview' | 'focus' | 'top') => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const initialColors = getThemeColors(themeRef.current);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialColors.bg);
    scene.fog = new THREE.FogExp2(initialColors.fog, 0.017);

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 280);
    const defaultCamY = compact ? 18.2 : 16.4;
    const defaultCamZ = compact ? 25.8 : 23.6;
    const defaultTargetY = compact ? -0.35 : -1.05;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 140);
    camera.position.set(0, defaultCamY, defaultCamZ);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // Studio warm/cool 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0xdce8ff, 0x3a2e25, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.5);
    keyLight.position.set(12, 22, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff6b24, 0.95);
    rimLight.position.set(-14, 10, -16);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 8.5;
    controls.maxDistance = 38;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.target.set(0, defaultTargetY, 0);
    controls.update();

    let transitioningCamera = false;
    controls.addEventListener('start', () => {
      transitioningCamera = false;
    });

    // Dynamic world root (rebuilt cleanly on fleet/theme updates)
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const towerRecords: TowerVisualRecord[] = [];
    const hitProxies: THREE.Mesh[] = [];
    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];
    const disposableTextures: THREE.Texture[] = [];

    const clearWorld = () => {
      while (worldGroup.children.length > 0) {
        worldGroup.remove(worldGroup.children[0]);
      }
      towerRecords.length = 0;
      hitProxies.length = 0;
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableTextures.forEach((t) => t.dispose());
      disposableGeos.length = 0;
      disposableMats.length = 0;
      disposableTextures.length = 0;
    };

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposableGeos.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      disposableMats.push(m);
      return m;
    };

    const rebuildWorld = (list: Agent[], nextTheme: ThemeId) => {
      clearWorld();
      const c = getThemeColors(nextTheme);
      scene.background = new THREE.Color(c.bg);
      scene.fog = new THREE.FogExp2(c.fog, 0.017);

      // 1. Circular Architectural Tabletop Island
      const islandRadius = 10.6;
      const deckMat = trackMat(
        new THREE.MeshStandardMaterial({ color: c.deck, roughness: 0.78, metalness: 0.05 }),
      );
      const rimMat = trackMat(
        new THREE.MeshStandardMaterial({ color: c.deckRim, roughness: 0.42, metalness: 0.45 }),
      );
      const glowRingMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: c.accentRing,
          emissive: c.accentRing,
          emissiveIntensity: 1.5,
          roughness: 0.25,
          metalness: 0.2,
        }),
      );

      const islandDeck = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(islandRadius, islandRadius + 0.35, 0.56, 64)),
        deckMat,
      );
      islandDeck.position.y = -0.28;
      islandDeck.receiveShadow = true;
      worldGroup.add(islandDeck);

      const islandBase = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(islandRadius + 0.42, islandRadius * 0.88, 0.42, 64)),
        rimMat,
      );
      islandBase.position.y = -0.74;
      worldGroup.add(islandBase);

      // Luminous outer perimeter halo ring
      const outerHalo = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(islandRadius + 0.26, 0.09, 12, 72)),
        glowRingMat,
      );
      outerHalo.rotation.x = Math.PI / 2;
      outerHalo.position.y = -0.04;
      worldGroup.add(outerHalo);

      // 2. Dark Asphalt Concentric Ring Road (elevated +0.025 to prevent Z-fighting)
      const roadTex = createRoadDashedRingTexture(c.road, c.roadDash);
      roadTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposableTextures.push(roadTex);

      const roadMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: c.road,
          roughness: 0.88,
          metalness: 0.05,
        }),
      );
      const dashMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: c.roadDash,
          emissive: c.roadDash,
          emissiveIntensity: 0.25,
          roughness: 0.6,
        }),
      );

      // Main circular ring road
      const ringRoad = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(4.65, 5.75, 64)),
        roadMat,
      );
      ringRoad.rotation.x = -Math.PI / 2;
      ringRoad.position.y = 0.025;
      ringRoad.receiveShadow = true;
      worldGroup.add(ringRoad);

      // Dashed ring markings
      const dashCount = 44;
      const dashGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.015, 0.06));
      const dashInst = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < dashCount; i++) {
        const ang = (i / dashCount) * Math.PI * 2;
        dummy.position.set(Math.cos(ang) * 5.2, 0.042, Math.sin(ang) * 5.2);
        dummy.rotation.set(0, -ang + Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        dashInst.setMatrixAt(i, dummy.matrix);
      }
      dashInst.instanceMatrix.needsUpdate = true;
      dashInst.computeBoundingSphere();
      worldGroup.add(dashInst);

      // Shared architectural materials
      const bodyMat = trackMat(
        new THREE.MeshStandardMaterial({ color: c.buildingBody, roughness: 0.68, metalness: 0.08 }),
      );
      const darkMat = trackMat(
        new THREE.MeshStandardMaterial({ color: c.buildingDark, roughness: 0.28, metalness: 0.55 }),
      );
      const plazaMat = trackMat(
        new THREE.MeshStandardMaterial({ color: c.plaza, roughness: 0.72, metalness: 0.06 }),
      );

      // Instanced miniature trees & plaza bollards
      const treePositions: Array<{ x: number; z: number; scale: number; tint: number }> = [];
      const bollardPositions: Array<{ x: number; z: number }> = [];

      // 3. Build every Agent Tower + Plaza + Radial Avenue
      list.forEach((agent, idx) => {
        const pos = agent.isHQ
          ? new THREE.Vector3(0, 0, 0)
          : new THREE.Vector3(
              Math.cos(agent.ringAngle) * agent.ringRadius,
              0,
              Math.sin(agent.ringAngle) * agent.ringRadius,
            );

        // Radial avenue from center to tower
        if (!agent.isHQ) {
          const dist = pos.length();
          const ave = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.62, 0.025, dist)),
            roadMat,
          );
          ave.position.set(pos.x * 0.5, 0.02, pos.z * 0.5);
          ave.rotation.y = Math.atan2(pos.x, pos.z);
          ave.receiveShadow = true;
          worldGroup.add(ave);
        }

        // Circular landscaped plaza plinth
        const plazaRadius = agent.isHQ ? 2.15 : 1.52;
        const plazaDisc = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(plazaRadius, plazaRadius + 0.14, 0.14, 32)),
          plazaMat,
        );
        plazaDisc.position.set(pos.x, 0.07, pos.z);
        plazaDisc.receiveShadow = true;
        worldGroup.add(plazaDisc);

        // Perimeter bollards & miniature trees around plaza edge
        const periCount = agent.isHQ ? 14 : 9;
        for (let p = 0; p < periCount; p++) {
          const a = (p / periCount) * Math.PI * 2 + idx * 0.3;
          const bx = pos.x + Math.cos(a) * (plazaRadius - 0.14);
          const bz = pos.z + Math.sin(a) * (plazaRadius - 0.14);
          if (p % 2 === 0) {
            treePositions.push({
              x: bx,
              z: bz,
              scale: 0.85 + ((idx + p) % 4) * 0.1,
              tint: p % 4 === 0 ? c.treeLight : c.treeDark,
            });
          } else {
            bollardPositions.push({ x: bx, z: bz });
          }
        }

        // Status-responsive emissive accent material per tower
        const statusColor =
          agent.status === 'alert'
            ? c.alert
            : agent.status === 'working'
              ? c.working
              : c.idle;

        const accentMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: statusColor,
            emissive: statusColor,
            emissiveIntensity: agent.status === 'working' ? 1.35 : agent.status === 'alert' ? 1.65 : 0.35,
            roughness: 0.25,
            metalness: 0.25,
          }),
        );

        const { group, accentMeshes, height: bHeight } = buildCompositeTower(
          agent.archetype,
          bodyMat,
          darkMat,
          accentMat,
        );
        group.position.set(pos.x, 0.14, pos.z);
        worldGroup.add(group);

        // Plaza status ring / sonar ripple
        const sonarMat = trackMat(
          new THREE.MeshBasicMaterial({
            color: statusColor,
            transparent: true,
            opacity: agent.status === 'idle' ? 0.28 : 0.72,
            depthWrite: false,
          }),
        );
        const sonarRing = new THREE.Mesh(
          trackGeo(new THREE.RingGeometry(plazaRadius - 0.08, plazaRadius + 0.06, 36)),
          sonarMat,
        );
        sonarRing.rotation.x = -Math.PI / 2;
        sonarRing.position.set(pos.x, 0.16, pos.z);
        worldGroup.add(sonarRing);

        // Simplified invisible hit proxy for fast raycasting
        const hitProxy = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(plazaRadius * 0.9, plazaRadius * 0.9, bHeight + 0.5, 12)),
          trackMat(new THREE.MeshBasicMaterial({ visible: false })),
        );
        hitProxy.position.set(pos.x, (bHeight + 0.5) / 2, pos.z);
        hitProxy.userData.agentId = agent.id;
        worldGroup.add(hitProxy);
        hitProxies.push(hitProxy);

        // Data shuttle capsule traveling between working specialist tower & Executor HQ
        let shuttle: THREE.Mesh | undefined;
        if (!agent.isHQ) {
          const shuttleMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: statusColor,
              emissive: statusColor,
              emissiveIntensity: 1.8,
              roughness: 0.2,
            }),
          );
          shuttle = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.085, 0.22, 6, 10)), shuttleMat);
          shuttle.rotation.z = Math.PI / 2;
          shuttle.visible = agent.status === 'working';
          worldGroup.add(shuttle);
        }

        towerRecords.push({
          agentId: agent.id,
          group,
          position: pos,
          labelAnchorY: bHeight + 0.65,
          accentMeshes,
          sonarRing,
          hitProxy,
          shuttle,
          shuttlePhase: (idx * 0.37) % 1,
        });
      });

      // Instanced miniature architectural trees
      if (treePositions.length > 0) {
        const crownGeo = trackGeo(new THREE.SphereGeometry(0.14, 10, 8));
        const crownMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }));
        const treeInst = new THREE.InstancedMesh(crownGeo, crownMat, treePositions.length);
        const col = new THREE.Color();
        treePositions.forEach((t, i) => {
          dummy.position.set(t.x, 0.24 * t.scale, t.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(t.scale, t.scale * 1.15, t.scale);
          dummy.updateMatrix();
          treeInst.setMatrixAt(i, dummy.matrix);
          col.setHex(t.tint);
          treeInst.setColorAt(i, col);
        });
        treeInst.instanceMatrix.needsUpdate = true;
        if (treeInst.instanceColor) treeInst.instanceColor.needsUpdate = true;
        treeInst.computeBoundingSphere();
        worldGroup.add(treeInst);
      }

      // Instanced perimeter bollards
      if (bollardPositions.length > 0) {
        const bolGeo = trackGeo(new THREE.SphereGeometry(0.07, 8, 8));
        const bolMat = trackMat(
          new THREE.MeshStandardMaterial({ color: c.buildingDark, roughness: 0.4, metalness: 0.5 }),
        );
        const bolInst = new THREE.InstancedMesh(bolGeo, bolMat, bollardPositions.length);
        bollardPositions.forEach((b, i) => {
          dummy.position.set(b.x, 0.19, b.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bolInst.setMatrixAt(i, dummy.matrix);
        });
        bolInst.instanceMatrix.needsUpdate = true;
        bolInst.computeBoundingSphere();
        worldGroup.add(bolInst);
      }
    };

    rebuildWorld(agentsRef.current, themeRef.current);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const focusAgent = (agentId: string | null) => {
      if (!agentId) {
        _targetLookAt.set(0, defaultTargetY, 0);
        _targetCamPos.set(0, defaultCamY, defaultCamZ);
        transitioningCamera = true;
        return;
      }
      const rec = towerRecords.find((r) => r.agentId === agentId);
      if (!rec) return;
      _targetLookAt.set(rec.position.x, 1.2, rec.position.z);
      const dir = rec.position.lengthSq() > 0.1
        ? rec.position.clone().normalize()
        : new THREE.Vector3(0, 0, 1);
      _targetCamPos.set(
        rec.position.x + dir.x * 7.8 + 2.4,
        8.6,
        rec.position.z + dir.z * 7.8 + 3.2,
      );
      transitioningCamera = true;
    };

    const setCameraPreset = (mode: 'overview' | 'focus' | 'top') => {
      if (mode === 'focus' && selectedRef.current) {
        focusAgent(selectedRef.current);
        return;
      }
      if (mode === 'top') {
        _targetLookAt.set(0, 0.4, 0);
        _targetCamPos.set(0, 24.5, 4.8);
        transitioningCamera = true;
        return;
      }
      _targetLookAt.set(0, defaultTargetY, 0);
      _targetCamPos.set(0, defaultCamY, defaultCamZ);
      transitioningCamera = true;
    };

    sceneApiRef.current = { rebuildTowers: rebuildWorld, focusAgent, setCameraPreset };

    // Raycasting on pointer click (distinguishing click vs orbit drag)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.agentId as string | undefined;
        if (hitId) {
          onSelectRef.current(hitId);
          focusAgent(hitId);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const resizeObserver = new ResizeObserver(() => {
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Software-WebGL paced animation loop (using performance.now instead of deprecated THREE.Clock)
    const startMs = performance.now();
    let lastMs = startMs;
    let disposed = false;
    let frameId = 0;
    let timerId = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            timerId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            timerId = window.setTimeout(cb, 85);
          }
        };
        timerId = window.setTimeout(poll, 5);
      } else {
        timerId = window.setTimeout(cb, 100);
      }
    };

    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - lastMs) / 1000, 0.1);
      lastMs = nowMs;
      const elapsed = (nowMs - startMs) / 1000;

      if (transitioningCamera) {
        const dampLambda = 4.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, dampLambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, dampLambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, dampLambda, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLookAt.x, dampLambda, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLookAt.y, dampLambda, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLookAt.z, dampLambda, dt);
        if (camera.position.distanceTo(_targetCamPos) < 0.08) {
          transitioningCamera = false;
        }
      }

      controls.update();

      // Subtle live tower pulse, sonar waves, and road data shuttles
      const curAgents = agentsRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const padX = compact ? 52 : 60;
      const padYTop = 28;
      const padYBottom = compact ? 14 : 92;

      for (const rec of towerRecords) {
        const agent = curAgents.find((a) => a.id === rec.agentId);
        if (!agent) continue;

        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.1 + rec.shuttlePhase * Math.PI * 2);
        if (agent.status === 'working') {
          const s = 1 + ((elapsed * 0.6 + rec.shuttlePhase) % 1) * 0.34;
          rec.sonarRing.scale.set(s, s, 1);
          const mat = rec.sonarRing.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - ((elapsed * 0.6 + rec.shuttlePhase) % 1)) * 0.85;
          for (const am of rec.accentMeshes) {
            const m = am.material as THREE.MeshStandardMaterial;
            m.emissiveIntensity = 1.05 + pulse * 0.85;
          }
          if (rec.shuttle) {
            rec.shuttle.visible = true;
            const t = (elapsed * 0.28 + rec.shuttlePhase) % 1;
            const travel = t < 0.5 ? t * 2 : (1 - t) * 2;
            const along = 0.16 + travel * 0.72;
            rec.shuttle.position.set(rec.position.x * along, 0.16, rec.position.z * along);
            rec.shuttle.rotation.y = Math.atan2(rec.position.x, rec.position.z);
          }
        } else if (agent.status === 'alert') {
          const s = 1 + ((elapsed * 1.1) % 1) * 0.42;
          rec.sonarRing.scale.set(s, s, 1);
          const mat = rec.sonarRing.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - ((elapsed * 1.1) % 1)) * 0.95;
          if (rec.shuttle) rec.shuttle.visible = false;
        } else {
          rec.sonarRing.scale.set(1, 1, 1);
          const mat = rec.sonarRing.material as THREE.MeshBasicMaterial;
          mat.opacity = selectedRef.current === agent.id ? 0.72 : 0.24;
          if (rec.shuttle) rec.shuttle.visible = false;
        }

        // Project 3D crown anchor -> clean DOM label clamped inside viewport
        const el = labelRefs.current[rec.agentId];
        if (el) {
          _projVec.set(rec.position.x, rec.labelAnchorY, rec.position.z);
          _projVec.project(camera);
          const visible = _projVec.z < 1;
          if (visible) {
            const rawX = (_projVec.x * 0.5 + 0.5) * w;
            const rawY = (-_projVec.y * 0.5 + 0.5) * h;
            const sx = Math.max(padX, Math.min(w - padX, rawX));
            const sy = Math.max(padYTop, Math.min(h - padYBottom, rawY));
            el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
            el.style.opacity = '1';
          } else {
            el.style.opacity = '0';
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      clearWorld();
      envTex.dispose();
      renderer.dispose();
      sceneApiRef.current = null;
    };
  }, [compact]);

  // Rebuild meshes when agents or theme change without recreating the WebGL context
  useEffect(() => {
    sceneApiRef.current?.rebuildTowers(agents, theme);
  }, [agents, theme]);

  // Smooth camera presets triggered from UI controls
  useEffect(() => {
    if (!cameraPresetTrigger) return;
    sceneApiRef.current?.setCameraPreset(cameraPresetTrigger.mode);
  }, [cameraPresetTrigger]);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      data-testid="agent-city-3d"
      data-agent-count={agents.length}
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected semantic HTML tower labels (no backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {agents.map((agent) => {
          const isSelected = selectedAgentId === agent.id;
          const isHQ = Boolean(agent.isHQ);
          const statusColor =
            agent.status === 'alert'
              ? 'var(--nx-alert)'
              : agent.status === 'working'
                ? 'var(--nx-working)'
                : 'var(--nx-idle)';

          return (
            <button
              key={agent.id}
              ref={(node) => {
                labelRefs.current[agent.id] = node;
              }}
              type="button"
              onClick={() => {
                onSelectAgent(agent.id);
                sceneApiRef.current?.focusAgent(agent.id);
              }}
              style={{
                backgroundColor: isHQ
                  ? 'var(--nx-accent)'
                  : isSelected
                    ? 'var(--nx-surface-hover)'
                    : 'rgba(18, 18, 22, 0.92)',
                color: isHQ ? 'var(--nx-accent-fg)' : '#F5F2EC',
                borderColor: isSelected
                  ? 'var(--nx-accent)'
                  : isHQ
                    ? 'var(--nx-accent)'
                    : 'rgba(255, 255, 255, 0.16)',
              }}
              className="pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap shadow-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={`Inspect ${agent.buildingName} (${agent.status})`}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: isHQ ? '#FFFFFF' : statusColor }}
                aria-hidden="true"
              />
              <span>{agent.buildingName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
