import { memo, useCallback, useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  OFFICE_ALERT_FALLBACK,
  OFFICE_IDLE_THOUGHTS,
  OFFICE_WORKING_THOUGHTS,
  useI18n,
} from '../i18n/translations';
import type { Agent, LanguageId, ThemeId } from '../types/nexora';
import {
  createCitySkylineTexture,
  createDormCarpetTexture,
  createHerringboneWoodTexture,
  createMonitorScreenTexture,
  createTvScreenTexture,
  createWallArtTexture,
  createWhiteboardTexture,
} from '../utils/officeTextures';

export type OfficeFloorView = 'all' | 'floor1' | 'floor2';
export type OfficeCameraPreset = 'overview' | 'focus' | 'top' | 'meeting' | 'lounge' | 'dorm';

export interface AgentLiveMood {
  activity: string;
  thought: string;
  floor: 1 | 2;
}

interface AgentOffice3DProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  theme: ThemeId;
  compact?: boolean;
  floorView?: OfficeFloorView;
  cameraPresetTrigger?: { mode: OfficeCameraPreset; nonce: number };
  onMoodSnapshot?: (moods: Record<string, AgentLiveMood>) => void;
  onSelectedMoodChange?: (mood: AgentLiveMood | null) => void;
}

type IdleActivityType = 'coffee' | 'tv' | 'billiard' | 'meeting' | 'reading' | 'stroll' | 'nap';

interface Waypoint {
  x: number;
  y: number;
  z: number;
}

interface HumanoidRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  mug: THREE.Mesh;
  contactShadow: THREE.Mesh;
  hitProxy: THREE.Mesh;
}

interface AgentRuntime {
  agentId: string;
  index: number;
  rig: HumanoidRig;
  deskPos: THREE.Vector3;
  chairPos: THREE.Vector3;
  bedPos: THREE.Vector3;
  bedRotY: number;
  deskLedMat: THREE.MeshStandardMaterial;
  currentPos: THREE.Vector3;
  currentRotY: number;
  currentSpeed: number;
  currentFloor: 1 | 2;
  path: Waypoint[];
  activity: 'working' | 'alert' | IdleActivityType;
  thought: string;
  moodEmoji: string;
  pose: 'stand' | 'walk' | 'sit' | 'sleep';
  faceAngle: number;
  nextSwitchAt: number;
  phaseOffset: number;
  lastRenderedThought: string;
  lastRenderedDot: string;
  lastRenderedSelected: boolean | null;
  lastRenderedBubbleVis: boolean | null;
  lastScreenX: number;
  lastScreenY: number;
  lastVisible: boolean | null;
}

const FLOOR2_Y = 4.55;
const STAIR_BOTTOM = { x: 5.95, y: 0, z: -2.0 };
const STAIR_TOP = { x: 5.95, y: FLOOR2_Y, z: -6.5 };

const AGENT_OUTFIT_PALETTE = [
  { shirt: 0xf95c19, pants: 0x1c1e24, duvet: 0xf95c19, badgeBg: '#F95C19' },
  { shirt: 0x2563eb, pants: 0x1e293b, duvet: 0x3b82f6, badgeBg: '#2563EB' },
  { shirt: 0x059669, pants: 0x1f2937, duvet: 0x10b981, badgeBg: '#059669' },
  { shirt: 0x7c3aed, pants: 0x1e1b2e, duvet: 0x8b5cf6, badgeBg: '#7C3AED' },
  { shirt: 0xd97706, pants: 0x292524, duvet: 0xf59e0b, badgeBg: '#D97706' },
  { shirt: 0x0891b2, pants: 0x16222c, duvet: 0x06b6d4, badgeBg: '#0891B2' },
  { shirt: 0xe11d48, pants: 0x241920, duvet: 0xf43f5e, badgeBg: '#E11D48' },
  { shirt: 0x4f46e5, pants: 0x1d1f2b, duvet: 0x6366f1, badgeBg: '#4F46E5' },
];

const SKIN_TONES = [0xf2c8a2, 0xe3b18a, 0xd49c73, 0xf6d4b7, 0xc78d65];
const HAIR_TONES = [0x1c1917, 0x3b2618, 0x27272a, 0x523420, 0x18181b];

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

function hashSlug(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Exact 1:1 Floor 1 workstation coordinates matching agents.length.
 * Centered cleanly in front of the panoramic city skyline window.
 */
function computeDeskSlot(index: number, total: number): { x: number; z: number } {
  const perRow = total <= 6 ? Math.max(1, total) : Math.ceil(total / 2);
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const countInRow = row === 0 ? Math.min(perRow, total) : Math.max(1, total - perRow);

  const maxSpan = 9.4;
  const spacing = countInRow <= 1 ? 0 : Math.min(1.95, maxSpan / Math.max(1, countInRow - 1));
  const startX = -((countInRow - 1) * spacing) / 2;
  const x = startX + col * spacing;
  const z = total <= 6 ? -4.35 : row === 0 ? -5.05 : -2.55;
  return { x, z };
}

/**
 * Exact 1:1 Floor 2 Dormitory bed coordinates matching agents.length.
 * Grows and shrinks dynamically as agents are added or removed.
 */
function computeBedSlot(index: number, total: number): { x: number; z: number; rotY: number } {
  const maxBackRow = 8;
  if (total <= maxBackRow) {
    const spacing = total <= 1 ? 0 : Math.min(2.65, 20.5 / Math.max(1, total - 1));
    const startX = -((total - 1) * spacing) / 2 - 1.2;
    let x = startX + index * spacing;
    if (x > 4.4 && x < 7.4) {
      x = x < 5.95 ? 4.2 : 7.65;
    }
    return { x: Math.max(-11.8, Math.min(11.8, x)), z: -5.45, rotY: 0 };
  }

  const perRow = Math.ceil(total / 2);
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const countInRow = row === 0 ? Math.min(perRow, total) : Math.max(1, total - perRow);
  const spacing = countInRow <= 1 ? 0 : Math.min(2.45, 21.5 / Math.max(1, countInRow - 1));
  let x = -((countInRow - 1) * spacing) / 2;
  x += col * spacing;
  if (row === 0 && x > 4.4 && x < 7.4) {
    x = x < 5.95 ? 4.2 : 7.65;
  }
  const z = row === 0 ? -5.85 : -2.55;
  return { x: Math.max(-11.8, Math.min(11.8, x)), z, rotY: 0 };
}

function getActivitySpot(
  activity: IdleActivityType,
  agentIndex: number,
  bedPos: THREE.Vector3,
): { pos: Waypoint; floor: 1 | 2; pose: 'stand' | 'sit' | 'sleep'; faceAngle: number } {
  const slot = agentIndex % 3;
  switch (activity) {
    case 'coffee':
      return {
        pos: { x: 8.1 + slot * 1.15, y: 0, z: -4.15 },
        floor: 1,
        pose: 'stand',
        faceAngle: Math.PI,
      };
    case 'tv':
      return {
        pos: { x: 8.2 + slot * 1.15, y: 0, z: 2.35 },
        floor: 1,
        pose: 'sit',
        faceAngle: Math.PI,
      };
    case 'billiard':
      return {
        pos: { x: 8.3 + slot * 1.25, y: 0, z: 4.15 },
        floor: 1,
        pose: 'stand',
        faceAngle: 0,
      };
    case 'meeting':
      return {
        pos: { x: -11.3 + slot * 1.35, y: 0, z: -2.2 },
        floor: 1,
        pose: 'stand',
        faceAngle: Math.PI,
      };
    case 'reading':
      return {
        pos: { x: -4.4 + (slot % 2) * 1.1, y: 0, z: 4.15 },
        floor: 1,
        pose: 'sit',
        faceAngle: Math.PI * 0.65,
      };
    case 'nap':
      return {
        pos: { x: bedPos.x, y: FLOOR2_Y, z: bedPos.z },
        floor: 2,
        pose: 'sleep',
        faceAngle: 0,
      };
    case 'stroll':
    default: {
      const ang = (agentIndex * 1.7 + Math.random() * Math.PI * 2) % (Math.PI * 2);
      return {
        pos: {
          x: -0.6 + Math.cos(ang) * 2.55,
          y: 0,
          z: 3.15 + Math.sin(ang) * 1.85,
        },
        floor: 1,
        pose: 'stand',
        faceAngle: ang + Math.PI / 2,
      };
    }
  }
}

function buildRoutePath(
  fromFloor: 1 | 2,
  toFloor: 1 | 2,
  dest: Waypoint,
  currentY?: number,
): Waypoint[] {
  // If an agent is mid-staircase when redirected, exit the stairs cleanly first
  const onStairs =
    typeof currentY === 'number' && currentY > 0.25 && currentY < FLOOR2_Y - 0.25;
  if (onStairs) {
    if (toFloor === 1) {
      return [
        { x: STAIR_BOTTOM.x, y: 0, z: STAIR_BOTTOM.z },
        { x: STAIR_BOTTOM.x, y: 0, z: STAIR_BOTTOM.z + 0.8 },
        dest,
      ];
    }
    return [
      { x: STAIR_TOP.x, y: FLOOR2_Y, z: STAIR_TOP.z },
      { x: STAIR_TOP.x, y: FLOOR2_Y, z: -3.4 },
      dest,
    ];
  }
  if (fromFloor === toFloor) {
    return [dest];
  }
  if (fromFloor === 1 && toFloor === 2) {
    return [
      { x: STAIR_BOTTOM.x, y: 0, z: STAIR_BOTTOM.z + 0.6 },
      { x: STAIR_BOTTOM.x, y: 0, z: STAIR_BOTTOM.z },
      { x: STAIR_TOP.x, y: FLOOR2_Y, z: STAIR_TOP.z },
      { x: STAIR_TOP.x, y: FLOOR2_Y, z: -3.4 },
      dest,
    ];
  }
  return [
    { x: STAIR_TOP.x, y: FLOOR2_Y, z: -3.4 },
    { x: STAIR_TOP.x, y: FLOOR2_Y, z: STAIR_TOP.z },
    { x: STAIR_BOTTOM.x, y: 0, z: STAIR_BOTTOM.z },
    { x: STAIR_BOTTOM.x, y: 0, z: STAIR_BOTTOM.z + 0.8 },
    dest,
  ];
}

/**
 * Merges static meshes inside a THREE.Group by shared material + shadow flags + attribute
 * layout, cutting hundreds of individual draw calls down to ~15-25 batched draw calls for
 * smooth 60fps performance on mobile and desktop GPUs.
 */
function mergeGroupByMaterial(
  group: THREE.Group,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): void {
  group.updateMatrixWorld(true);
  const invGroupMatrix = group.matrixWorld.clone().invert();
  const localMatrix = new THREE.Matrix4();

  interface Bucket {
    material: THREE.Material;
    castShadow: boolean;
    receiveShadow: boolean;
    geos: THREE.BufferGeometry[];
  }

  const buckets = new Map<string, Bucket>();
  const keepList: THREE.Object3D[] = [];

  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.userData.keepSeparate) {
      keepList.push(obj);
      return;
    }
    if (Array.isArray(obj.material) || !obj.geometry) {
      keepList.push(obj);
      return;
    }

    const baseGeo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    localMatrix.multiplyMatrices(invGroupMatrix, obj.matrixWorld);
    baseGeo.applyMatrix4(localMatrix);
    if (!baseGeo.getAttribute('normal')) {
      baseGeo.computeVertexNormals();
    }

    const attrKey = Object.keys(baseGeo.attributes).sort().join(',');
    const key = `${obj.material.uuid}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}|${attrKey}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: obj.material,
        castShadow: obj.castShadow,
        receiveShadow: obj.receiveShadow,
        geos: [],
      };
      buckets.set(key, bucket);
    }
    bucket.geos.push(baseGeo);
  });

  // Preserve world transforms for any kept animated objects (clock hand, status LED strips)
  const keptWorldTransforms = keepList.map((obj) => {
    const m = new THREE.Matrix4().multiplyMatrices(invGroupMatrix, obj.matrixWorld);
    return { obj, m };
  });

  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geos, false);
    for (let i = 0; i < bucket.geos.length; i += 1) {
      bucket.geos[i].dispose();
    }
    if (!merged) continue;
    trackGeo(merged);
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    group.add(mesh);
  }

  for (const { obj, m } of keptWorldTransforms) {
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    m.decompose(pos, quat, scl);
    obj.position.copy(pos);
    obj.quaternion.copy(quat);
    obj.scale.copy(scl);
    group.add(obj);
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(12, 10, 8, 0.42)');
    grad.addColorStop(0.55, 'rgba(12, 10, 8, 0.2)');
    grad.addColorStop(1, 'rgba(12, 10, 8, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCompositeHumanoid(
  agent: Agent,
  paletteIdx: number,
  contactShadowGeo: THREE.BufferGeometry,
  contactShadowMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
): HumanoidRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Lightweight grounded contact shadow disc (zero dynamic shadow-map cost while walking)
  const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.018;
  root.add(contactShadow);

  const pal = AGENT_OUTFIT_PALETTE[paletteIdx % AGENT_OUTFIT_PALETTE.length];
  const h = hashSlug(agent.id);
  const skinColor = SKIN_TONES[h % SKIN_TONES.length];
  const hairColor = HAIR_TONES[(h >> 3) % HAIR_TONES.length];

  const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: pal.shirt, roughness: 0.65, metalness: 0.05 }));
  const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.78, metalness: 0.05 }));
  const shoeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.45, metalness: 0.2 }));
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.62, metalness: 0.02 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.72, metalness: 0.08 }));
  const visorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x101216,
      roughness: 0.16,
      metalness: 0.85,
      emissive: 0xf95c19,
      emissiveIntensity: agent.isHQ ? 0.45 : 0,
    }),
  );

  // Legs pivoted at hip (y = 0.64)
  const makeLeg = (xOff: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOff, 0.64, 0);
    const thigh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.56, 0.17)), pantsMat);
    thigh.position.y = -0.28;
    legGroup.add(thigh);
    const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.17, 0.1, 0.24)), shoeMat);
    shoe.position.set(0, -0.59, 0.04);
    legGroup.add(shoe);
    return legGroup;
  };
  const leftLeg = makeLeg(-0.11);
  const rightLeg = makeLeg(0.11);
  bodyPivot.add(leftLeg, rightLeg);

  // Torso (smart blazer/shirt + subtle collar)
  const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.54, 0.24)), shirtMat);
  torso.position.set(0, 0.92, 0);
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  const collar = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.22, 0.08, 0.26)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.7 })),
  );
  collar.position.set(0, 1.17, 0.01);
  bodyPivot.add(collar);

  // Arms pivoted at shoulder (y = 1.14)
  const makeArm = (xOff: number) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(xOff, 1.14, 0);
    const sleeve = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.13, 0.42, 0.14)), shirtMat);
    sleeve.position.y = -0.19;
    armGroup.add(sleeve);
    const hand = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.065, 10, 8)), skinMat);
    hand.position.y = -0.43;
    armGroup.add(hand);
    return armGroup;
  };
  const leftArm = makeArm(-0.29);
  const rightArm = makeArm(0.29);
  bodyPivot.add(leftArm, rightArm);

  // Coffee mug in right hand (shown when visiting pantry)
  const mug = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 10)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.1 })),
  );
  mug.position.set(0, -0.45, 0.08);
  mug.visible = false;
  rightArm.add(mug);

  // Head assembly
  const head = new THREE.Group();
  head.position.set(0, 1.24, 0);
  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.065, 0.075, 0.1, 10)), skinMat);
  neck.position.y = 0.04;
  head.add(neck);

  const cranium = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.19, 16, 14)), agent.isHQ ? visorMat : skinMat);
  cranium.position.y = 0.24;
  head.add(cranium);

  if (agent.isHQ) {
    // Sleek Executor visor band
    const visorGlow = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.28, 0.065, 0.14)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xff7b36,
          emissive: 0xf95c19,
          emissiveIntensity: 1.4,
          roughness: 0.2,
        }),
      ),
    );
    visorGlow.position.set(0, 0.25, 0.13);
    head.add(visorGlow);
  } else {
    // Stylized sculpted hair cap & crisp eyes
    const hair = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.202, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56)),
      hairMat,
    );
    hair.position.set(0, 0.26, -0.015);
    head.add(hair);

    const eyeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x18181b }));
    const leftEye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.02, 6, 6)), eyeMat);
    leftEye.position.set(-0.062, 0.24, 0.175);
    const rightEye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.02, 6, 6)), eyeMat);
    rightEye.position.set(0.062, 0.24, 0.175);
    head.add(leftEye, rightEye);
  }
  bodyPivot.add(head);

  // Invisible hit proxy for reliable clicking
  const hitProxy = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 1.85, 10)),
    trackMat(new THREE.MeshBasicMaterial({ visible: false })),
  );
  hitProxy.position.y = 0.92;
  hitProxy.userData.agentId = agent.id;
  root.add(hitProxy);

  return { root, bodyPivot, head, leftArm, rightArm, leftLeg, rightLeg, mug, contactShadow, hitProxy };
}

function buildWorkstationUnit(
  x: number,
  z: number,
  woodMat: THREE.Material,
  darkSteelMat: THREE.Material,
  chairFabricMat: THREE.Material,
  monitorTex: THREE.CanvasTexture,
  statusColor: number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
): { group: THREE.Group; ledMat: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  // Desk tabletop & steel frame
  const top = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.56, 0.07, 0.82)), woodMat);
  top.position.set(0, 0.74, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  for (const lx of [-0.72, 0.72]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.055, 0.72, 0.72)), darkSteelMat);
    leg.position.set(lx, 0.36, 0);
    leg.castShadow = true;
    g.add(leg);
  }

  // Front modesty panel
  const modesty = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.42, 0.32, 0.04)), darkSteelMat);
  modesty.position.set(0, 0.54, -0.34);
  g.add(modesty);

  // Status LED accent bar along desk back edge
  const ledMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: statusColor,
      emissive: statusColor,
      emissiveIntensity: 1.1,
      roughness: 0.25,
    }),
  );
  const ledStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.36, 0.03, 0.03)), ledMat);
  ledStrip.position.set(0, 0.785, -0.38);
  ledStrip.userData.keepSeparate = true;
  g.add(ledStrip);

  // Dual Monitors (angled slightly inward toward the agent)
  const screenMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: monitorTex,
      emissiveMap: monitorTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.42,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );
  for (const side of [-1, 1]) {
    const mGroup = new THREE.Group();
    mGroup.position.set(side * 0.34, 1.04, -0.22);
    mGroup.rotation.y = side * -0.14;
    const bezel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.38, 0.035)), darkSteelMat);
    bezel.castShadow = true;
    mGroup.add(bezel);
    const screen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.57, 0.33)), screenMat);
    screen.position.z = 0.02;
    mGroup.add(screen);
    const stand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.26, 0.05)), darkSteelMat);
    stand.position.set(0, -0.22, -0.02);
    mGroup.add(stand);
    g.add(mGroup);
  }

  // Keyboard, mouse & desk mat
  const deskPad = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.76, 0.01, 0.3)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1e2026, roughness: 0.9 })),
  );
  deskPad.position.set(0, 0.78, 0.14);
  g.add(deskPad);

  const kb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.025, 0.14)), darkSteelMat);
  kb.position.set(-0.08, 0.795, 0.14);
  g.add(kb);

  const mouse = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 0.025, 0.11)), darkSteelMat);
  mouse.position.set(0.24, 0.795, 0.14);
  g.add(mouse);

  // Ergonomic Swivel Office Chair (exact 1:1 per workstation!)
  const chair = new THREE.Group();
  chair.position.set(0, 0, 0.72);
  // 5-star caster base
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 0.035, 0.34)), darkSteelMat);
    spoke.position.set(Math.sin(ang) * 0.15, 0.06, Math.cos(ang) * 0.15);
    spoke.rotation.y = ang;
    chair.add(spoke);
  }
  const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.045, 0.36, 10)), darkSteelMat);
  stem.position.y = 0.24;
  chair.add(stem);
  const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.54, 0.08, 0.5)), chairFabricMat);
  seat.position.y = 0.45;
  seat.castShadow = true;
  chair.add(seat);
  const backrest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.62, 0.08)), chairFabricMat);
  backrest.position.set(0, 0.78, 0.22);
  backrest.rotation.x = 0.08;
  backrest.castShadow = true;
  chair.add(backrest);
  for (const ax of [-0.28, 0.28]) {
    const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.05, 0.34)), darkSteelMat);
    arm.position.set(ax, 0.64, 0.04);
    chair.add(arm);
  }
  g.add(chair);

  return { group: g, ledMat };
}

function buildDormBedUnit(
  x: number,
  y: number,
  z: number,
  rotY: number,
  duvetHex: number,
  woodMat: THREE.Material,
  mattressMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  // Bedside rug
  const rug = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.95, 0.02, 2.45)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x454954, roughness: 0.95 })),
  );
  rug.position.set(0.1, 0.015, 0.05);
  rug.receiveShadow = true;
  g.add(rug);

  // Oak platform bed frame + legs
  const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.26, 0.22, 2.15)), woodMat);
  frame.position.set(0, 0.22, 0);
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  for (const lx of [-0.56, 0.56]) {
    for (const lz of [-0.96, 0.96]) {
      const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.035, 0.14, 8)), woodMat);
      leg.position.set(lx, 0.07, lz);
      g.add(leg);
    }
  }

  // Headboard
  const headboard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 0.85, 0.1)), woodMat);
  headboard.position.set(0, 0.64, -1.03);
  headboard.castShadow = true;
  g.add(headboard);

  // Mattress
  const mattress = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 0.2, 2.02)), mattressMat);
  mattress.position.set(0, 0.42, 0.02);
  mattress.castShadow = true;
  g.add(mattress);

  // Color-coded cozy duvet blanket
  const duvetMat = trackMat(new THREE.MeshStandardMaterial({ color: duvetHex, roughness: 0.86, metalness: 0.02 }));
  const duvet = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.22, 0.12, 1.38)), duvetMat);
  duvet.position.set(0, 0.52, 0.34);
  duvet.castShadow = true;
  g.add(duvet);

  // Fluffy pillow
  const pillow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.14, 0.42)), mattressMat);
  pillow.position.set(0, 0.58, -0.68);
  pillow.rotation.x = 0.12;
  g.add(pillow);

  // Nightstand + warm glowing bedside lamp
  const stand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.48, 0.46)), woodMat);
  stand.position.set(0.92, 0.24, -0.78);
  stand.castShadow = true;
  g.add(stand);

  const lampBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 10)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xb08a56, roughness: 0.3, metalness: 0.7 })),
  );
  lampBase.position.set(0.92, 0.55, -0.78);
  g.add(lampBase);

  const lampShade = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.09, 0.14, 0.18, 12)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xffa756,
        emissiveIntensity: 0.75,
        roughness: 0.5,
      }),
    ),
  );
  lampShade.position.set(0.92, 0.7, -0.78);
  g.add(lampShade);

  return g;
}

function buildPottedPlant(
  x: number,
  y: number,
  z: number,
  scale: number,
  potColor: number,
  leafMat: THREE.Material,
  trunkMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);

  const pot = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.26, 0.2, 0.46, 14)),
    trackMat(new THREE.MeshStandardMaterial({ color: potColor, roughness: 0.72 })),
  );
  pot.position.y = 0.23;
  pot.castShadow = true;
  g.add(pot);

  const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.048, 0.75, 8)), trunkMat);
  stem.position.y = 0.75;
  g.add(stem);

  const offsets = [
    [0, 1.24, 0, 0.28],
    [0.18, 1.12, 0.1, 0.2],
    [-0.17, 1.15, -0.08, 0.22],
    [0.05, 1.38, -0.06, 0.2],
  ];
  offsets.forEach(([ox, oy, oz, r]) => {
    const leaf = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(r, 1)), leafMat);
    leaf.position.set(ox, oy, oz);
    leaf.castShadow = true;
    g.add(leaf);
  });

  return g;
}

/**
 * Never-re-rendering WebGL canvas mount node so React reconciliations in ancestor
 * views can never touch or disturb the mounted Three.js canvas element.
 */
const OfficeCanvasMount = memo(
  function OfficeCanvasMount({ mountRef }: { mountRef: RefObject<HTMLDivElement | null> }) {
    return <div ref={mountRef} className="w-full h-full" />;
  },
  () => true,
);

interface OfficeViewportProps {
  agents: Agent[];
  fleetLabelKey: string;
  compact: boolean;
  mountRef: RefObject<HTMLDivElement | null>;
  labelRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  labelBubbleBoxRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  labelThoughtRefs: MutableRefObject<Record<string, HTMLParagraphElement | null>>;
  labelPillRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  labelDotRefs: MutableRefObject<Record<string, HTMLSpanElement | null>>;
  onClickAgent: (agentId: string) => void;
}

/**
 * Frozen viewport + floating label shell: ONLY re-renders when agents are added,
 * removed, renamed, or compact mode changes. Live thought text, status dot colors,
 * selection highlights, and 3D screen coordinates are updated imperatively inside
 * the requestAnimationFrame loop with ZERO React re-renders.
 */
const OfficeViewport = memo(
  function OfficeViewport({
    agents,
    compact,
    mountRef,
    labelRefs,
    labelBubbleBoxRefs,
    labelThoughtRefs,
    labelPillRefs,
    labelDotRefs,
    onClickAgent,
  }: OfficeViewportProps) {
    const { lang, agentDisplay } = useI18n();
    const idleDefaultBubble =
      lang === 'id' ? '☕ Lagi santai di kantor...' : '☕ Relaxing in the office...';
    return (
      <div
        className="relative w-full h-full overflow-hidden select-none touch-none [contain:layout_style]"
        data-testid="agent-office-3d"
        data-agent-count={agents.length}
      >
        <OfficeCanvasMount mountRef={mountRef} />

        {/* Projected Floating Name + Role + Live Thought/Mood Bubbles above every Agent */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden [contain:layout_style]">
          {agents.map((agent, idx) => {
            const pal = AGENT_OUTFIT_PALETTE[idx % AGENT_OUTFIT_PALETTE.length];
            const disp = agentDisplay(agent);
            const initialThought =
              agent.status === 'working'
                ? `💻 ${disp.task}`
                : agent.status === 'alert'
                  ? `⚠️ ${disp.task}`
                  : idleDefaultBubble;
            const initialDot =
              agent.status === 'alert'
                ? '#EF4444'
                : agent.status === 'working'
                  ? '#F95C19'
                  : '#22C55E';

            return (
              <button
                key={agent.id}
                ref={(node) => {
                  labelRefs.current[agent.id] = node;
                }}
                type="button"
                onClick={() => onClickAgent(agent.id)}
                className="pointer-events-auto touch-none absolute top-0 left-0 flex flex-col items-center gap-0.5 cursor-pointer will-change-transform focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label={lang === 'id' ? `Periksa ${agent.name}` : `Inspect ${agent.name}`}
              >
                <div
                  ref={(node) => {
                    labelBubbleBoxRefs.current[agent.id] = node;
                  }}
                  style={{
                    backgroundColor: 'rgba(252, 250, 247, 0.96)',
                    color: '#18181B',
                    borderColor: 'rgba(24, 24, 27, 0.16)',
                    display: !compact || agents.length <= 4 ? 'block' : 'none',
                  }}
                  className={`rounded-lg border text-left ${
                    compact ? 'px-2 py-0.5 max-w-[144px]' : 'px-2.5 py-1 max-w-[195px]'
                  }`}
                >
                  <p
                    ref={(node) => {
                      labelThoughtRefs.current[agent.id] = node;
                    }}
                    className="text-[10px] leading-tight font-medium truncate"
                  >
                    {initialThought}
                  </p>
                </div>

                <div
                  ref={(node) => {
                    labelPillRefs.current[agent.id] = node;
                  }}
                  data-default-bg={pal.badgeBg}
                  style={{
                    backgroundColor: pal.badgeBg,
                    color: '#FFFFFF',
                    borderColor: 'rgba(255,255,255,0.22)',
                  }}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                >
                  <span
                    ref={(node) => {
                      labelDotRefs.current[agent.id] = node;
                    }}
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: initialDot }}
                    aria-hidden="true"
                  />
                  <span>{agent.name}</span>
                  {!compact && (
                    <span className="opacity-80 font-normal truncate max-w-[92px]">
                      · {disp.role.split(' ')[0]}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.compact === next.compact && prev.fleetLabelKey === next.fleetLabelKey,
);

const AgentOffice3D = memo(function AgentOffice3D({
  agents,
  selectedAgentId,
  onSelectAgent,
  theme,
  compact = false,
  floorView = 'all',
  cameraPresetTrigger,
  onMoodSnapshot,
  onSelectedMoodChange,
}: AgentOffice3DProps) {
  const { lang, agentDisplay } = useI18n();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const labelBubbleBoxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const labelThoughtRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
  const labelPillRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const labelDotRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const agentsRef = useRef<Agent[]>(agents);
  const agentMapRef = useRef<Map<string, Agent>>(new Map());
  const selectedRef = useRef<string | null>(selectedAgentId);
  const onSelectRef = useRef(onSelectAgent);
  const themeRef = useRef<ThemeId>(theme);
  const langRef = useRef<LanguageId>(lang);
  const agentDisplayRef = useRef(agentDisplay);
  const floorViewRef = useRef<OfficeFloorView>(floorView);
  const onMoodSnapshotRef = useRef(onMoodSnapshot);
  const onSelectedMoodChangeRef = useRef(onSelectedMoodChange);

  // Sync latest refs without rebuilding meshes or re-rendering OfficeViewport
  if (agentsRef.current !== agents || agentMapRef.current.size !== agents.length) {
    agentsRef.current = agents;
    const map = new Map<string, Agent>();
    for (let i = 0; i < agents.length; i += 1) {
      map.set(agents[i].id, agents[i]);
    }
    agentMapRef.current = map;
  }
  selectedRef.current = selectedAgentId;
  onSelectRef.current = onSelectAgent;
  themeRef.current = theme;
  langRef.current = lang;
  agentDisplayRef.current = agentDisplay;
  floorViewRef.current = floorView;
  onMoodSnapshotRef.current = onMoodSnapshot;
  onSelectedMoodChangeRef.current = onSelectedMoodChange;

  const fleetSignature = useMemo(() => agents.map((a) => a.id).join('|'), [agents]);
  const fleetLabelKey = useMemo(
    () => `${lang}||` + agents.map((a) => `${a.id}:${a.name}:${a.role}`).join('|'),
    [agents, lang],
  );

  const sceneApiRef = useRef<{
    rebuildDynamicFleet: (nextAgents: Agent[]) => void;
    applyTheme: (nextTheme: ThemeId) => void;
    applyLanguage: (nextLang: LanguageId) => void;
    applyFloorView: (mode: OfficeFloorView) => void;
    focusAgent: (agentId: string | null) => void;
    setCameraPreset: (mode: OfficeCameraPreset) => void;
  } | null>(null);

  const handleClickAgent = useCallback((agentId: string) => {
    onSelectRef.current(agentId);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const isMobileViewport = window.innerWidth < 768;
    const enableBakedShadows = !isSoftwareGl && !isMobileViewport;
    const isLight = themeRef.current === 'editorial-alabaster';

    const dampAngle = (current: number, target: number, lambda: number, dt: number): number => {
      const diff = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      return current + diff * (1 - Math.exp(-lambda * dt));
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isLight ? 0xebe6dd : 0x0b0b0d);
    scene.fog = new THREE.FogExp2(isLight ? 0xebe6dd : 0x0b0b0d, 0.0095);

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 280);

    const defaultCamPos = compact
      ? new THREE.Vector3(0, 19.6, 35.2)
      : new THREE.Vector3(0, 16.8, 28.4);
    const defaultLookAt = new THREE.Vector3(0, 1.5, -0.8);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 180);
    camera.position.copy(defaultCamPos);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    const maxDpr = isMobileViewport ? 1.25 : 1.75;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    // Bake static architectural shadows ONCE instead of re-rendering 400+ meshes at 60fps
    renderer.shadowMap.enabled = enableBakedShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // Balanced warm/cool studio architectural lighting rig
    const hemiLight = new THREE.HemisphereLight(0xf6f8ff, 0x5c4633, 0.92);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.55);
    keyLight.position.set(14, 26, 18);
    keyLight.castShadow = enableBakedShadows;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.025;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffb478, 0.65);
    rimLight.position.set(-16, 12, -14);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.zoomSpeed = 0.78;
    controls.minDistance = 8.5;
    controls.maxDistance = 48;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.target.copy(defaultLookAt);
    controls.update();

    let transitioningCamera = false;
    let transitionStartedAt = 0;
    const cancelCameraTransition = () => {
      transitioningCamera = false;
    };
    controls.addEventListener('start', cancelCameraTransition);
    renderer.domElement.addEventListener('wheel', cancelCameraTransition, { passive: true });
    renderer.domElement.addEventListener('touchstart', cancelCameraTransition, { passive: true });

    const staticGroup = new THREE.Group();
    const floor2StaticGroup = new THREE.Group();
    const dynamicFloor1Group = new THREE.Group();
    const dynamicFloor2Group = new THREE.Group();
    const agentsGroup = new THREE.Group();

    scene.add(staticGroup);
    scene.add(floor2StaticGroup);
    scene.add(dynamicFloor1Group);
    scene.add(dynamicFloor2Group);
    scene.add(agentsGroup);

    const staticGeos: THREE.BufferGeometry[] = [];
    const staticMats: THREE.Material[] = [];
    const staticTexs: THREE.Texture[] = [];

    const dynGeos: THREE.BufferGeometry[] = [];
    const dynMats: THREE.Material[] = [];

    const sGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      staticGeos.push(g);
      return g;
    };
    const sMat = <T extends THREE.Material>(m: T): T => {
      staticMats.push(m);
      return m;
    };
    const sTex = <T extends THREE.Texture>(t: T): T => {
      staticTexs.push(t);
      return t;
    };
    const dGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      dynGeos.push(g);
      return g;
    };
    const dMat = <T extends THREE.Material>(m: T): T => {
      dynMats.push(m);
      return m;
    };

    // Procedural Textures (Zero 404 external files)
    const woodTex = sTex(createHerringboneWoodTexture(maxAniso, !isLight));
    const skylineTex = sTex(createCitySkylineTexture(maxAniso, !isLight));
    const whiteboardTex = sTex(createWhiteboardTexture(maxAniso));
    const monitorTex = sTex(createMonitorScreenTexture(maxAniso, '#F95C19'));
    const tvTex = sTex(createTvScreenTexture(maxAniso));
    const art0Tex = sTex(createWallArtTexture(maxAniso, 0));
    const art1Tex = sTex(createWallArtTexture(maxAniso, 1));
    const dormCarpetTex = sTex(createDormCarpetTexture(maxAniso));

    // Shared Architectural PBR Materials
    const woodFloorMat = sMat(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.04 }));
    const plinthTrimMat = sMat(new THREE.MeshStandardMaterial({ color: 0x8f6944, roughness: 0.72, metalness: 0.04 }));
    const wallMat = sMat(new THREE.MeshStandardMaterial({ color: 0xe6e0d6, roughness: 0.88, metalness: 0.02 }));
    const darkWallMat = sMat(new THREE.MeshStandardMaterial({ color: 0x262529, roughness: 0.68, metalness: 0.15 }));
    const walnutMat = sMat(new THREE.MeshStandardMaterial({ color: 0x5c3c24, roughness: 0.56, metalness: 0.06 }));
    const oakMat = sMat(new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.58, metalness: 0.05 }));
    const darkSteelMat = sMat(new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.34, metalness: 0.68 }));
    const glassMat = sMat(
      new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    const creamRugMat = sMat(new THREE.MeshStandardMaterial({ color: 0xf1ece3, roughness: 0.94, metalness: 0.0 }));
    const taupeRugMat = sMat(new THREE.MeshStandardMaterial({ color: 0x7b6d61, roughness: 0.94, metalness: 0.0 }));
    const slateFloorMat = sMat(new THREE.MeshStandardMaterial({ color: 0x6f7883, roughness: 0.78, metalness: 0.05 }));
    const emeraldFabricMat = sMat(new THREE.MeshStandardMaterial({ color: 0x165e4c, roughness: 0.85, metalness: 0.02 }));
    const cognacLeatherMat = sMat(new THREE.MeshStandardMaterial({ color: 0x8d4c25, roughness: 0.52, metalness: 0.08 }));
    const espressoLeatherMat = sMat(new THREE.MeshStandardMaterial({ color: 0x3b261d, roughness: 0.54, metalness: 0.08 }));
    const creamChairMat = sMat(new THREE.MeshStandardMaterial({ color: 0xf4f1eb, roughness: 0.65, metalness: 0.04 }));
    const chairFabricMat = sMat(new THREE.MeshStandardMaterial({ color: 0x202228, roughness: 0.82, metalness: 0.05 }));
    const foliageMat = sMat(new THREE.MeshStandardMaterial({ color: 0x5b7a42, roughness: 0.82, metalness: 0.02 }));
    const foliageLightMat = sMat(new THREE.MeshStandardMaterial({ color: 0x7a9659, roughness: 0.8, metalness: 0.02 }));
    const trunkMat = sMat(new THREE.MeshStandardMaterial({ color: 0x543822, roughness: 0.86, metalness: 0.02 }));
    const brassMat = sMat(new THREE.MeshStandardMaterial({ color: 0xd2a457, roughness: 0.28, metalness: 0.78 }));
    const mattressMat = sMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.88, metalness: 0.01 }));
    const dormFloorMat = sMat(new THREE.MeshStandardMaterial({ map: dormCarpetTex, roughness: 0.9, metalness: 0.02 }));

    // =========================================================================
    // 1. FLOOR 1 ARCHITECTURE (Cutaway Diorama Base + Walls + Skyline Window)
    // =========================================================================
    const floor1Top = new THREE.Mesh(sGeo(new THREE.BoxGeometry(28.0, 0.12, 15.0)), woodFloorMat);
    floor1Top.position.set(0, -0.06, 0);
    floor1Top.receiveShadow = true;
    staticGroup.add(floor1Top);

    const floor1Base = new THREE.Mesh(sGeo(new THREE.BoxGeometry(28.3, 0.42, 15.3)), plinthTrimMat);
    floor1Base.position.set(0, -0.33, 0);
    staticGroup.add(floor1Base);

    // Back wall left, right, under-window & lintel (window centered cleanly away from staircase)
    const backLeftWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(8.9, FLOOR2_Y, 0.28)), wallMat);
    backLeftWall.position.set(-9.55, FLOOR2_Y / 2, -7.48);
    backLeftWall.receiveShadow = true;
    staticGroup.add(backLeftWall);

    const backRightWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(8.9, FLOOR2_Y, 0.28)), wallMat);
    backRightWall.position.set(9.55, FLOOR2_Y / 2, -7.48);
    backRightWall.receiveShadow = true;
    staticGroup.add(backRightWall);

    const windowSillWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(10.3, 0.85, 0.28)), wallMat);
    windowSillWall.position.set(0, 0.425, -7.48);
    staticGroup.add(windowSillWall);

    const windowLintel = new THREE.Mesh(sGeo(new THREE.BoxGeometry(10.3, 0.48, 0.28)), wallMat);
    windowLintel.position.set(0, FLOOR2_Y - 0.24, -7.48);
    staticGroup.add(windowLintel);

    // Panoramic City Skyline Window
    const skylinePlane = new THREE.Mesh(
      sGeo(new THREE.PlaneGeometry(10.2, 3.25)),
      sMat(
        new THREE.MeshBasicMaterial({
          map: skylineTex,
        }),
      ),
    );
    skylinePlane.position.set(0, 2.48, -7.52);
    staticGroup.add(skylinePlane);

    // Black steel window mullions
    for (let i = 0; i <= 5; i++) {
      const mx = -5.1 + (i / 5) * 10.2;
      const mullion = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.08, 3.25, 0.14)), darkSteelMat);
      mullion.position.set(mx, 2.48, -7.42);
      staticGroup.add(mullion);
    }
    for (const my of [0.88, 2.48, 4.08]) {
      const bar = new THREE.Mesh(sGeo(new THREE.BoxGeometry(10.28, 0.08, 0.14)), darkSteelMat);
      bar.position.set(0, my, -7.42);
      staticGroup.add(bar);
    }

    // Left & Right cutaway side walls
    const leftWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.28, FLOOR2_Y, 15.0)), wallMat);
    leftWall.position.set(-14.0, FLOOR2_Y / 2, 0);
    leftWall.receiveShadow = true;
    staticGroup.add(leftWall);

    const rightWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.28, FLOOR2_Y, 15.0)), wallMat);
    rightWall.position.set(14.0, FLOOR2_Y / 2, 0);
    rightWall.receiveShadow = true;
    staticGroup.add(rightWall);

    // =========================================================================
    // 2. ZONE A — GLASS-WALLED MEETING ROOM (Back-Left)
    // =========================================================================
    const meetFloor = new THREE.Mesh(sGeo(new THREE.BoxGeometry(7.6, 0.025, 6.6)), slateFloorMat);
    meetFloor.position.set(-10.0, 0.015, -4.0);
    meetFloor.receiveShadow = true;
    staticGroup.add(meetFloor);

    // Glass partition walls + black frames (front z = -0.7, right x = -6.2)
    const addGlassPanel = (w: number, h: number, x: number, z: number, rotY = 0) => {
      const panel = new THREE.Group();
      panel.position.set(x, h / 2, z);
      panel.rotation.y = rotY;
      const pane = new THREE.Mesh(sGeo(new THREE.BoxGeometry(w, h - 0.1, 0.04)), glassMat);
      pane.renderOrder = 2;
      panel.add(pane);
      const topRail = new THREE.Mesh(sGeo(new THREE.BoxGeometry(w + 0.06, 0.08, 0.08)), darkSteelMat);
      topRail.position.y = h / 2;
      const botRail = new THREE.Mesh(sGeo(new THREE.BoxGeometry(w + 0.06, 0.08, 0.08)), darkSteelMat);
      botRail.position.y = -h / 2 + 0.04;
      const leftPost = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.08, h, 0.08)), darkSteelMat);
      leftPost.position.x = -w / 2;
      const rightPost = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.08, h, 0.08)), darkSteelMat);
      rightPost.position.x = w / 2;
      panel.add(topRail, botRail, leftPost, rightPost);
      staticGroup.add(panel);
    };
    addGlassPanel(4.9, 3.6, -11.4, -0.7, 0);
    addGlassPanel(1.3, 3.6, -6.85, -0.7, 0);
    addGlassPanel(4.6, 3.6, -6.2, -5.0, Math.PI / 2);

    // Conference table & 6 modern white chairs
    const confTable = new THREE.Mesh(sGeo(new THREE.BoxGeometry(4.0, 0.1, 1.65)), oakMat);
    confTable.position.set(-10.0, 0.76, -3.9);
    confTable.castShadow = true;
    confTable.receiveShadow = true;
    staticGroup.add(confTable);
    for (const cx of [-11.5, -8.5]) {
      const leg = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.14, 0.72, 1.15)), darkSteelMat);
      leg.position.set(cx, 0.36, -3.9);
      staticGroup.add(leg);
    }
    for (let i = 0; i < 3; i++) {
      const cx = -11.3 + i * 1.3;
      for (const side of [-1, 1]) {
        const ch = new THREE.Group();
        ch.position.set(cx, 0, -3.9 + side * 1.12);
        const seat = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.48, 0.08, 0.46)), creamChairMat);
        seat.position.y = 0.44;
        const back = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.46, 0.44, 0.07)), creamChairMat);
        back.position.set(0, 0.68, side * 0.21);
        const leg = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 8)), darkSteelMat);
        leg.position.y = 0.21;
        ch.add(seat, back, leg);
        staticGroup.add(ch);
      }
    }

    // Kanban Whiteboard on Meeting Room back wall
    const wbFrame = new THREE.Mesh(sGeo(new THREE.BoxGeometry(3.75, 1.9, 0.08)), darkSteelMat);
    wbFrame.position.set(-10.0, 2.35, -7.3);
    staticGroup.add(wbFrame);
    const wbCanvas = new THREE.Mesh(
      sGeo(new THREE.PlaneGeometry(3.6, 1.76)),
      sMat(new THREE.MeshStandardMaterial({ map: whiteboardTex, roughness: 0.35 })),
    );
    wbCanvas.position.set(-10.0, 2.35, -7.25);
    staticGroup.add(wbCanvas);

    // =========================================================================
    // 3. ZONE B — RECEPTION & GUEST WAITING AREA (Front-Left)
    // =========================================================================
    const recepRug = new THREE.Mesh(sGeo(new THREE.BoxGeometry(5.8, 0.02, 4.2)), creamRugMat);
    recepRug.position.set(-9.9, 0.015, 3.8);
    recepRug.receiveShadow = true;
    staticGroup.add(recepRug);

    const execDesk = new THREE.Mesh(sGeo(new THREE.BoxGeometry(2.65, 0.78, 1.15)), walnutMat);
    execDesk.position.set(-9.6, 0.39, 3.5);
    execDesk.castShadow = true;
    execDesk.receiveShadow = true;
    staticGroup.add(execDesk);

    const execMonitor = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.85, 0.48, 0.05)), darkSteelMat);
    execMonitor.position.set(-9.6, 1.08, 3.45);
    staticGroup.add(execMonitor);

    // Two cognac leather guest armchairs facing executive desk
    for (const gx of [-10.35, -8.85]) {
      const armCh = new THREE.Group();
      armCh.position.set(gx, 0, 5.15);
      const seat = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.84, 0.36, 0.76)), cognacLeatherMat);
      seat.position.y = 0.24;
      seat.castShadow = true;
      const back = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.84, 0.56, 0.18)), cognacLeatherMat);
      back.position.set(0, 0.54, 0.3);
      for (const sx of [-0.36, 0.36]) {
        const arm = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.14, 0.36, 0.74)), cognacLeatherMat);
        arm.position.set(sx, 0.42, 0);
        armCh.add(arm);
      }
      armCh.add(seat, back);
      staticGroup.add(armCh);
    }

    // Waiting sofa against left wall + framed art
    const waitSofa = new THREE.Group();
    waitSofa.position.set(-13.15, 0, 3.6);
    const wsSeat = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.92, 0.38, 2.35)), espressoLeatherMat);
    wsSeat.position.y = 0.24;
    wsSeat.castShadow = true;
    const wsBack = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.22, 0.65, 2.35)), espressoLeatherMat);
    wsBack.position.set(-0.36, 0.58, 0);
    waitSofa.add(wsSeat, wsBack);
    staticGroup.add(waitSofa);

    const leftArtFrame = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.08, 1.65, 1.35)), walnutMat);
    leftArtFrame.position.set(-13.82, 2.25, 3.6);
    staticGroup.add(leftArtFrame);
    const leftArtCanvas = new THREE.Mesh(
      sGeo(new THREE.PlaneGeometry(1.2, 1.48)),
      sMat(new THREE.MeshStandardMaterial({ map: art0Tex, roughness: 0.6 })),
    );
    leftArtCanvas.position.set(-13.76, 2.25, 3.6);
    leftArtCanvas.rotation.y = Math.PI / 2;
    staticGroup.add(leftArtCanvas);

    // =========================================================================
    // 4. ZONE D — CENTER ATRIUM TREE & COZY READING NOOK
    // =========================================================================
    const treeGroup = new THREE.Group();
    treeGroup.position.set(-0.6, 0, 3.1);
    const benchBase = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(1.55, 1.62, 0.42, 28)), creamChairMat);
    benchBase.position.y = 0.21;
    benchBase.receiveShadow = true;
    benchBase.castShadow = true;
    const benchRim = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(1.6, 1.6, 0.09, 28)), walnutMat);
    benchRim.position.y = 0.44;
    const innerPot = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(0.86, 0.78, 0.72, 24)), creamChairMat);
    innerPot.position.y = 0.72;
    const mainTrunk = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(0.14, 0.22, 1.65, 12)), trunkMat);
    mainTrunk.position.y = 1.65;
    mainTrunk.castShadow = true;
    treeGroup.add(benchBase, benchRim, innerPot, mainTrunk);

    const canopyPuffs: Array<[number, number, number, number, boolean]> = [
      [0, 2.85, 0, 0.82, true],
      [-0.68, 2.48, 0.35, 0.62, false],
      [0.66, 2.55, 0.28, 0.64, true],
      [0.12, 2.45, -0.64, 0.6, false],
      [-0.45, 3.12, -0.25, 0.56, true],
      [0.45, 3.05, -0.22, 0.54, false],
      [0, 2.38, 0.68, 0.56, true],
    ];
    canopyPuffs.forEach(([px, py, pz, r, light]) => {
      const puff = new THREE.Mesh(
        sGeo(new THREE.DodecahedronGeometry(r, 1)),
        light ? foliageLightMat : foliageMat,
      );
      puff.position.set(px, py, pz);
      puff.castShadow = true;
      treeGroup.add(puff);
    });
    staticGroup.add(treeGroup);

    // Cozy Reading Nook (left of tree)
    const nookRug = new THREE.Mesh(sGeo(new THREE.BoxGeometry(2.8, 0.02, 2.6)), taupeRugMat);
    nookRug.position.set(-4.3, 0.015, 4.1);
    nookRug.receiveShadow = true;
    staticGroup.add(nookRug);

    // Wooden bookshelf with colorful books
    const shelf = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.42, 1.75, 1.65)), walnutMat);
    shelf.position.set(-5.7, 0.88, 4.1);
    shelf.castShadow = true;
    staticGroup.add(shelf);
    const bookColors = [0xf95c19, 0x3b82f6, 0x10b981, 0xf59e0b, 0xef4444];
    for (let row = 0; row < 3; row++) {
      for (let b = 0; b < 5; b++) {
        const book = new THREE.Mesh(
          sGeo(new THREE.BoxGeometry(0.24, 0.22, 0.14)),
          sMat(new THREE.MeshStandardMaterial({ color: bookColors[(row + b) % bookColors.length], roughness: 0.7 })),
        );
        book.position.set(-5.58, 0.44 + row * 0.46, 3.55 + b * 0.26);
        staticGroup.add(book);
      }
    }
    for (const nz of [3.55, 4.65]) {
      const rc = new THREE.Group();
      rc.position.set(-4.15, 0, nz);
      rc.rotation.y = nz < 4.0 ? -0.35 : 0.35;
      const seat = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.76, 0.34, 0.74)), creamChairMat);
      seat.position.y = 0.22;
      seat.castShadow = true;
      const back = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.18, 0.56, 0.74)), creamChairMat);
      back.position.set(0.3, 0.52, 0);
      rc.add(seat, back);
      staticGroup.add(rc);
    }

    // =========================================================================
    // 5. ZONE E — COFFEE PANTRY / MINI BAR (Back-Right) + WALL CLOCK
    // =========================================================================
    // Wooden slatted divider screen between Pantry and Living Room
    for (let i = 0; i < 20; i++) {
      const slat = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.09, 2.75, 0.12)), walnutMat);
      slat.position.set(6.85 + i * 0.28, 1.38, -1.75);
      slat.castShadow = true;
      staticGroup.add(slat);
    }

    // Pantry counter, espresso machine & mini fridge
    const pantryCounter = new THREE.Mesh(sGeo(new THREE.BoxGeometry(5.6, 0.92, 0.92)), walnutMat);
    pantryCounter.position.set(9.8, 0.46, -6.75);
    pantryCounter.castShadow = true;
    pantryCounter.receiveShadow = true;
    staticGroup.add(pantryCounter);

    const counterTop = new THREE.Mesh(sGeo(new THREE.BoxGeometry(5.68, 0.06, 0.98)), darkWallMat);
    counterTop.position.set(9.8, 0.94, -6.75);
    staticGroup.add(counterTop);

    // Espresso machine
    const espresso = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.65, 0.52, 0.48)), darkSteelMat);
    espresso.position.set(8.4, 1.22, -6.72);
    espresso.castShadow = true;
    staticGroup.add(espresso);
    const espressoTrim = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.55, 0.06, 0.04)), brassMat);
    espressoTrim.position.set(8.4, 1.34, -6.47);
    staticGroup.add(espressoTrim);

    // Stainless mini-fridge
    const fridge = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.95, 1.85, 0.9)), darkSteelMat);
    fridge.position.set(13.15, 0.93, -6.75);
    fridge.castShadow = true;
    staticGroup.add(fridge);

    // Floating pantry shelves & 3 warm brass pendant lights
    for (const sy of [1.85, 2.42]) {
      const pShelf = new THREE.Mesh(sGeo(new THREE.BoxGeometry(4.2, 0.07, 0.34)), oakMat);
      pShelf.position.set(9.9, sy, -7.15);
      staticGroup.add(pShelf);
    }
    for (let i = 0; i < 3; i++) {
      const px = 8.4 + i * 1.45;
      const cord = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6)), darkSteelMat);
      cord.position.set(px, 3.7, -5.9);
      const dome = new THREE.Mesh(sGeo(new THREE.ConeGeometry(0.22, 0.24, 16)), brassMat);
      dome.position.set(px, 2.95, -5.9);
      staticGroup.add(cord, dome);
    }

    // Live animated Wall Clock
    const clockFace = new THREE.Mesh(
      sGeo(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 24)),
      creamChairMat,
    );
    clockFace.rotation.x = Math.PI / 2;
    clockFace.position.set(6.9, 3.35, -7.3);
    staticGroup.add(clockFace);
    const clockRim = new THREE.Mesh(sGeo(new THREE.TorusGeometry(0.36, 0.04, 10, 24)), darkSteelMat);
    clockRim.position.set(6.9, 3.35, -7.27);
    staticGroup.add(clockRim);
    const clockMinuteHand = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.03, 0.26, 0.02)), darkSteelMat);
    clockMinuteHand.position.set(6.9, 3.35, -7.24);
    clockMinuteHand.userData.keepSeparate = true;
    staticGroup.add(clockMinuteHand);

    // =========================================================================
    // 6. ZONE F — LIVING ROOM (TV + EMERALD SOFA + BILLIARD TABLE)
    // =========================================================================
    const loungeRug = new THREE.Mesh(sGeo(new THREE.BoxGeometry(6.4, 0.02, 5.2)), creamRugMat);
    loungeRug.position.set(9.6, 0.015, 1.5);
    loungeRug.receiveShadow = true;
    staticGroup.add(loungeRug);

    // Walnut TV Console & Large Wall-Mounted Smart TV
    const tvConsole = new THREE.Mesh(sGeo(new THREE.BoxGeometry(3.4, 0.56, 0.65)), walnutMat);
    tvConsole.position.set(9.5, 0.28, -1.25);
    tvConsole.castShadow = true;
    staticGroup.add(tvConsole);

    const tvBezel = new THREE.Mesh(sGeo(new THREE.BoxGeometry(3.0, 1.72, 0.09)), darkSteelMat);
    tvBezel.position.set(9.5, 1.62, -1.52);
    tvBezel.castShadow = true;
    staticGroup.add(tvBezel);

    const tvScreen = new THREE.Mesh(
      sGeo(new THREE.PlaneGeometry(2.86, 1.58)),
      sMat(
        new THREE.MeshStandardMaterial({
          map: tvTex,
          emissiveMap: tvTex,
          emissive: 0xffffff,
          emissiveIntensity: 0.45,
          roughness: 0.18,
        }),
      ),
    );
    tvScreen.position.set(9.5, 1.62, -1.46);
    staticGroup.add(tvScreen);

    // Emerald Green 3-Seater Lounge Sofa facing the TV
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(9.5, 0, 2.55);
    const sofaBase = new THREE.Mesh(sGeo(new THREE.BoxGeometry(3.6, 0.4, 1.05)), emeraldFabricMat);
    sofaBase.position.y = 0.26;
    sofaBase.castShadow = true;
    sofaBase.receiveShadow = true;
    const sofaBack = new THREE.Mesh(sGeo(new THREE.BoxGeometry(3.6, 0.64, 0.22)), emeraldFabricMat);
    sofaBack.position.set(0, 0.62, 0.42);
    sofaBack.castShadow = true;
    for (const sx of [-1.7, 1.7]) {
      const arm = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.22, 0.5, 1.05)), emeraldFabricMat);
      arm.position.set(sx, 0.46, 0);
      sofaGroup.add(arm);
    }
    sofaGroup.add(sofaBase, sofaBack);
    staticGroup.add(sofaGroup);

    // Flanking cognac leather lounge chairs + low coffee table
    for (const side of [-1, 1]) {
      const lc = new THREE.Group();
      lc.position.set(9.5 + side * 2.55, 0, 0.85);
      lc.rotation.y = side * -Math.PI * 0.42;
      const seat = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.86, 0.36, 0.82)), cognacLeatherMat);
      seat.position.y = 0.24;
      seat.castShadow = true;
      const back = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.86, 0.56, 0.18)), cognacLeatherMat);
      back.position.set(0, 0.54, 0.34);
      lc.add(seat, back);
      staticGroup.add(lc);
    }

    const coffeeTable = new THREE.Mesh(sGeo(new THREE.BoxGeometry(1.7, 0.08, 0.88)), creamChairMat);
    coffeeTable.position.set(9.5, 0.42, 0.92);
    coffeeTable.castShadow = true;
    staticGroup.add(coffeeTable);
    const ctBase = new THREE.Mesh(sGeo(new THREE.BoxGeometry(1.3, 0.38, 0.55)), darkSteelMat);
    ctBase.position.set(9.5, 0.2, 0.92);
    staticGroup.add(ctBase);

    // Standing floor lamp + right wall art
    const lampPole = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(0.03, 0.04, 1.95, 8)), brassMat);
    lampPole.position.set(12.6, 0.98, 2.35);
    const lampHead = new THREE.Mesh(
      sGeo(new THREE.CylinderGeometry(0.18, 0.28, 0.36, 14)),
      sMat(new THREE.MeshStandardMaterial({ color: 0xfff3de, emissive: 0xffb366, emissiveIntensity: 0.72, roughness: 0.45 })),
    );
    lampHead.position.set(12.6, 2.04, 2.35);
    staticGroup.add(lampPole, lampHead);

    const rightArtFrame = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.08, 1.75, 1.4)), darkSteelMat);
    rightArtFrame.position.set(13.82, 2.3, 0.9);
    staticGroup.add(rightArtFrame);
    const rightArtCanvas = new THREE.Mesh(
      sGeo(new THREE.PlaneGeometry(1.26, 1.58)),
      sMat(new THREE.MeshStandardMaterial({ map: art1Tex, roughness: 0.55 })),
    );
    rightArtCanvas.position.set(13.76, 2.3, 0.9);
    rightArtCanvas.rotation.y = -Math.PI / 2;
    staticGroup.add(rightArtCanvas);

    // Billiard / Pool Table (Front-Right, matching reference image!)
    const poolGroup = new THREE.Group();
    poolGroup.position.set(9.6, 0, 5.25);
    const poolBody = new THREE.Mesh(sGeo(new THREE.BoxGeometry(3.25, 0.28, 1.75)), walnutMat);
    poolBody.position.y = 0.78;
    poolBody.castShadow = true;
    poolBody.receiveShadow = true;
    const poolFelt = new THREE.Mesh(
      sGeo(new THREE.BoxGeometry(2.96, 0.04, 1.46)),
      sMat(new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.88 })),
    );
    poolFelt.position.y = 0.93;
    poolGroup.add(poolBody, poolFelt);
    for (const lx of [-1.42, 1.42]) {
      for (const lz of [-0.68, 0.68]) {
        const leg = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.16, 0.68, 0.16)), walnutMat);
        leg.position.set(lx, 0.34, lz);
        poolGroup.add(leg);
      }
    }
    // Pool balls & cue stick
    const ballCols = [0xffffff, 0xfacc15, 0xef4444, 0x3b82f6, 0x111827, 0xf97316];
    ballCols.forEach((hex, idx) => {
      const ball = new THREE.Mesh(
        sGeo(new THREE.SphereGeometry(0.055, 10, 8)),
        sMat(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.15, metalness: 0.1 })),
      );
      ball.position.set(idx === 0 ? -0.75 : 0.45 + (idx % 3) * 0.13, 1.0, (Math.floor(idx / 3) - 0.5) * 0.14);
      poolGroup.add(ball);
    });
    const cueStick = new THREE.Mesh(sGeo(new THREE.CylinderGeometry(0.015, 0.025, 1.85, 8)), oakMat);
    cueStick.rotation.z = Math.PI / 2;
    cueStick.position.set(-0.2, 0.97, 0.79);
    poolGroup.add(cueStick);
    staticGroup.add(poolGroup);

    // Decorative Potted Office Plants around Floor 1
    const plantSpecs: Array<[number, number, number, number]> = [
      [-13.2, 0, 6.4, 1.1],
      [-6.55, 0, 5.8, 1.25],
      [3.6, 0, 4.9, 1.15],
      [13.15, 0, 5.9, 1.35],
      [-6.65, 0, -6.5, 0.95],
      [5.9, 0, -6.5, 0.95],
    ];
    plantSpecs.forEach(([px, py, pz, sc], i) => {
      staticGroup.add(
        buildPottedPlant(
          px,
          py,
          pz,
          sc,
          i % 2 === 0 ? 0xe5e0d8 : 0x242326,
          i % 2 === 0 ? foliageLightMat : foliageMat,
          trunkMat,
          sGeo,
          sMat,
        ),
      );
    });

    // =========================================================================
    // 7. ARCHITECTURAL OPEN STAIRCASE (Floor 1 -> Floor 2, clear of window)
    // =========================================================================
    const stepCount = 14;
    for (let i = 0; i < stepCount; i++) {
      const t = (i + 0.5) / stepCount;
      const tread = new THREE.Mesh(sGeo(new THREE.BoxGeometry(1.06, 0.08, 0.34)), oakMat);
      tread.position.set(
        STAIR_BOTTOM.x,
        t * FLOOR2_Y,
        THREE.MathUtils.lerp(STAIR_BOTTOM.z, STAIR_TOP.z, t),
      );
      tread.castShadow = true;
      tread.receiveShadow = true;
      staticGroup.add(tread);
    }
    const stairLen = Math.hypot(FLOOR2_Y, STAIR_BOTTOM.z - STAIR_TOP.z);
    const stairPitch = Math.atan2(FLOOR2_Y, Math.abs(STAIR_BOTTOM.z - STAIR_TOP.z));
    for (const sx of [STAIR_BOTTOM.x - 0.52, STAIR_BOTTOM.x + 0.52]) {
      const stringer = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.07, 0.18, stairLen)), darkSteelMat);
      stringer.position.set(sx, FLOOR2_Y * 0.48, (STAIR_BOTTOM.z + STAIR_TOP.z) / 2);
      stringer.rotation.x = stairPitch;
      staticGroup.add(stringer);
    }

    // =========================================================================
    // 8. FLOOR 2 — MEZZANINE DORMITORY / KAMAR TIDUR AGENT (y = FLOOR2_Y)
    // =========================================================================
    // Recessed mezzanine deck (z: -7.45..-0.55) so Floor 1 atrium, desks & lounge stay open in 2-Floor view
    const f2Slab = new THREE.Mesh(sGeo(new THREE.BoxGeometry(27.8, 0.24, 7.0)), plinthTrimMat);
    f2Slab.position.set(0, FLOOR2_Y - 0.12, -4.0);
    f2Slab.receiveShadow = true;
    f2Slab.castShadow = true;
    floor2StaticGroup.add(f2Slab);

    const f2Carpet = new THREE.Mesh(sGeo(new THREE.BoxGeometry(27.4, 0.03, 6.7)), dormFloorMat);
    f2Carpet.position.set(0, FLOOR2_Y + 0.015, -4.0);
    f2Carpet.receiveShadow = true;
    floor2StaticGroup.add(f2Carpet);

    // Floor 2 back & side cutaway walls (height 3.0)
    const f2WallH = 3.0;
    const f2BackWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(28.0, f2WallH, 0.26)), wallMat);
    f2BackWall.position.set(0, FLOOR2_Y + f2WallH / 2, -7.48);
    f2BackWall.receiveShadow = true;
    floor2StaticGroup.add(f2BackWall);

    const f2LeftWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.26, f2WallH, 7.0)), wallMat);
    f2LeftWall.position.set(-14.0, FLOOR2_Y + f2WallH / 2, -4.0);
    floor2StaticGroup.add(f2LeftWall);

    const f2RightWall = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.26, f2WallH, 7.0)), wallMat);
    f2RightWall.position.set(14.0, FLOOR2_Y + f2WallH / 2, -4.0);
    floor2StaticGroup.add(f2RightWall);

    // Warm brass ambient sconce light strips along Floor 2 back wall
    const sconceMat = sMat(
      new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        emissive: 0xffa04a,
        emissiveIntensity: 0.9,
        roughness: 0.35,
      }),
    );
    for (const wx of [-9.5, -3.5, 2.5, 9.5]) {
      const sconce = new THREE.Mesh(sGeo(new THREE.BoxGeometry(1.4, 0.08, 0.08)), sconceMat);
      sconce.position.set(wx, FLOOR2_Y + 2.35, -7.3);
      floor2StaticGroup.add(sconce);
    }

    // Mezzanine glass balcony railing overlooking Floor 1
    const railGlass = new THREE.Mesh(sGeo(new THREE.BoxGeometry(27.4, 1.0, 0.05)), glassMat);
    railGlass.position.set(0, FLOOR2_Y + 0.54, -0.55);
    railGlass.renderOrder = 3;
    floor2StaticGroup.add(railGlass);

    const railTopBar = new THREE.Mesh(sGeo(new THREE.BoxGeometry(27.6, 0.07, 0.09)), darkSteelMat);
    railTopBar.position.set(0, FLOOR2_Y + 1.05, -0.55);
    floor2StaticGroup.add(railTopBar);

    for (let p = 0; p <= 8; p++) {
      const post = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.07, 1.05, 0.07)), darkSteelMat);
      post.position.set(-13.6 + (p / 8) * 27.2, FLOOR2_Y + 0.52, -0.55);
      floor2StaticGroup.add(post);
    }

    // Floor 2 wooden wardrobe lockers & potted plants
    const wardrobe = new THREE.Mesh(sGeo(new THREE.BoxGeometry(0.75, 2.15, 2.6)), walnutMat);
    wardrobe.position.set(-13.42, FLOOR2_Y + 1.08, -4.1);
    wardrobe.castShadow = true;
    floor2StaticGroup.add(wardrobe);

    floor2StaticGroup.add(
      buildPottedPlant(-13.2, FLOOR2_Y, -1.2, 0.88, 0xe5e0d8, foliageLightMat, trunkMat, sGeo, sMat),
      buildPottedPlant(13.2, FLOOR2_Y, -1.2, 0.88, 0x242326, foliageMat, trunkMat, sGeo, sMat),
    );

    // Batch all static Floor 1 & Floor 2 architectural meshes by material (massive GPU draw-call win)
    mergeGroupByMaterial(staticGroup, sGeo);
    mergeGroupByMaterial(floor2StaticGroup, sGeo);

    // =========================================================================
    // 9. DYNAMIC 1:1 WORKSTATIONS, 1:1 BEDS, AND AUTONOMOUS AI AGENTS
    // =========================================================================
    const contactShadowTex = sTex(createContactShadowTexture());
    const contactShadowGeo = sGeo(new THREE.CircleGeometry(0.38, 18));
    const contactShadowMat = sMat(
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
      }),
    );

    const runtimes: AgentRuntime[] = [];
    const hitProxies: THREE.Mesh[] = [];
    let lastSelectedMoodKey = '';

    const pushSelectedMoodIfChanged = () => {
      const selId = selectedRef.current;
      if (!onSelectedMoodChangeRef.current) return;
      const selRt = selId ? runtimes.find((r) => r.agentId === selId) : runtimes[0];
      if (!selRt) {
        if (lastSelectedMoodKey !== '') {
          lastSelectedMoodKey = '';
          onSelectedMoodChangeRef.current(null);
        }
        return;
      }
      const nextKey = `${selRt.agentId}|${selRt.activity}|${selRt.moodEmoji}|${selRt.thought}|${selRt.currentFloor}`;
      if (nextKey === lastSelectedMoodKey) return;
      lastSelectedMoodKey = nextKey;
      onSelectedMoodChangeRef.current({
        activity: selRt.activity,
        thought: `${selRt.moodEmoji} ${selRt.thought}`,
        floor: selRt.currentFloor,
      });
    };

    const clearDynamic = () => {
      [dynamicFloor1Group, dynamicFloor2Group, agentsGroup].forEach((grp) => {
        while (grp.children.length > 0) grp.remove(grp.children[0]);
      });
      runtimes.length = 0;
      hitProxies.length = 0;
      dynGeos.forEach((g) => g.dispose());
      dynMats.forEach((m) => m.dispose());
      dynGeos.length = 0;
      dynMats.length = 0;
    };

    const applyTheme = (nextTheme: ThemeId) => {
      const lightBg = nextTheme === 'editorial-alabaster';
      scene.background = new THREE.Color(lightBg ? 0xebe6dd : 0x0b0b0d);
      scene.fog = new THREE.FogExp2(lightBg ? 0xebe6dd : 0x0b0b0d, 0.0095);
    };

    const rebuildDynamicFleet = (list: Agent[]) => {
      // Preserve live walking positions & activities for existing agents so adding/removing
      // an agent never teleports or stutters other agents already moving around the office.
      const prevById = new Map<string, AgentRuntime>();
      for (const existing of runtimes) {
        prevById.set(existing.agentId, existing);
      }

      clearDynamic();
      applyTheme(themeRef.current);

      const total = list.length;
      const idleCycle: IdleActivityType[] = ['tv', 'coffee', 'billiard', 'nap', 'meeting', 'reading', 'stroll'];

      list.forEach((agent, idx) => {
        const pal = AGENT_OUTFIT_PALETTE[idx % AGENT_OUTFIT_PALETTE.length];
        const statusHex =
          agent.status === 'alert' ? 0xef4444 : agent.status === 'working' ? 0xf95c19 : 0x22c55e;

        // 1:1 Floor 1 Workstation (Desk + Dual Monitors + Ergonomic Chair)
        const dSlot = computeDeskSlot(idx, total);
        const ws = buildWorkstationUnit(
          dSlot.x,
          dSlot.z,
          oakMat,
          darkSteelMat,
          chairFabricMat,
          monitorTex,
          statusHex,
          dGeo,
          dMat,
        );
        dynamicFloor1Group.add(ws.group);

        // 1:1 Floor 2 Dormitory Bed
        const bSlot = computeBedSlot(idx, total);
        const bed = buildDormBedUnit(
          bSlot.x,
          FLOOR2_Y,
          bSlot.z,
          bSlot.rotY,
          pal.duvet,
          walnutMat,
          mattressMat,
          dGeo,
          dMat,
        );
        dynamicFloor2Group.add(bed);

        // Humanoid AI Agent Avatar
        const rig = buildCompositeHumanoid(agent, idx, contactShadowGeo, contactShadowMat, dGeo, dMat);
        agentsGroup.add(rig.root);
        hitProxies.push(rig.hitProxy);

        const deskPos = new THREE.Vector3(dSlot.x, 0, dSlot.z);
        const chairPos = new THREE.Vector3(dSlot.x, 0, dSlot.z + 0.72);
        const bedPos = new THREE.Vector3(bSlot.x, FLOOR2_Y, bSlot.z);

        const curLang = langRef.current;
        const localizedTask = agentDisplayRef.current(agent).task;
        const workingBank = OFFICE_WORKING_THOUGHTS[curLang];
        const idleBank = OFFICE_IDLE_THOUGHTS[curLang];
        const prevRt = prevById.get(agent.id);
        let initialActivity: AgentRuntime['activity'] = 'working';
        let startPos = chairPos.clone();
        let startFloor: 1 | 2 = 1;
        let pose: AgentRuntime['pose'] = 'sit';
        let faceAngle = Math.PI;
        let thought = localizedTask || workingBank[idx % workingBank.length];
        let moodEmoji = '💻';
        let preservedPath: Waypoint[] = [];
        let preservedRotY = faceAngle;
        let nextSwitchAt = 6 + (idx * 3.7) % 9;

        if (prevRt) {
          initialActivity = prevRt.activity;
          startPos = prevRt.currentPos.clone();
          startFloor = prevRt.currentFloor;
          pose = prevRt.pose;
          faceAngle = prevRt.faceAngle;
          preservedRotY = prevRt.currentRotY;
          thought = prevRt.thought;
          moodEmoji = prevRt.moodEmoji;
          preservedPath = prevRt.path.map((wp) => ({ ...wp }));
          nextSwitchAt = prevRt.nextSwitchAt;
        } else if (agent.status === 'alert') {
          initialActivity = 'alert';
          startPos = new THREE.Vector3(dSlot.x, 0, dSlot.z + 1.15);
          pose = 'stand';
          faceAngle = 0;
          preservedRotY = 0;
          moodEmoji = '⚠️';
          thought = localizedTask || OFFICE_ALERT_FALLBACK[curLang];
        } else if (agent.status === 'idle') {
          const chosen = idleCycle[idx % idleCycle.length];
          initialActivity = chosen;
          const spot = getActivitySpot(chosen, idx, bedPos);
          startPos = new THREE.Vector3(spot.pos.x, spot.pos.y, spot.pos.z);
          startFloor = spot.floor;
          pose = spot.pose;
          faceAngle = spot.faceAngle;
          preservedRotY = spot.faceAngle;
          const meta = idleBank[chosen];
          moodEmoji = meta.emoji;
          thought = meta.lines[idx % meta.lines.length];
        }

        rig.root.position.copy(startPos);
        rig.root.rotation.y = preservedRotY;

        runtimes.push({
          agentId: agent.id,
          index: idx,
          rig,
          deskPos,
          chairPos,
          bedPos,
          bedRotY: bSlot.rotY,
          deskLedMat: ws.ledMat,
          currentPos: startPos,
          currentRotY: preservedRotY,
          currentSpeed: prevRt ? prevRt.currentSpeed : 0,
          currentFloor: startFloor,
          path: preservedPath,
          activity: initialActivity,
          thought,
          moodEmoji,
          pose,
          faceAngle,
          nextSwitchAt,
          phaseOffset: idx * 1.17,
          lastRenderedThought: '',
          lastRenderedDot: '',
          lastRenderedSelected: null,
          lastRenderedBubbleVis: null,
          lastScreenX: -9999,
          lastScreenY: -9999,
          lastVisible: null,
        });
      });

      // Merge static workstation & dormitory bed geometry by material (keeps ledStrip separate)
      mergeGroupByMaterial(dynamicFloor1Group, dGeo);
      mergeGroupByMaterial(dynamicFloor2Group, dGeo);

      // Re-bake static office + workstation shadows once after fleet structure changes
      if (enableBakedShadows) {
        renderer.shadowMap.needsUpdate = true;
      }

      lastSelectedMoodKey = '';
      pushSelectedMoodIfChanged();

      if (onMoodSnapshotRef.current) {
        const snap: Record<string, AgentLiveMood> = {};
        runtimes.forEach((r) => {
          snap[r.agentId] = {
            activity: r.activity,
            thought: `${r.moodEmoji} ${r.thought}`,
            floor: r.currentFloor,
          };
        });
        onMoodSnapshotRef.current(snap);
      }
    };

    const startCameraTransition = () => {
      transitioningCamera = true;
      transitionStartedAt = performance.now();
    };

    const applyFloorView = (mode: OfficeFloorView, animateCamera = true) => {
      floorViewRef.current = mode;
      const showFloor2 = mode === 'all' || mode === 'floor2';
      floor2StaticGroup.visible = showFloor2;
      dynamicFloor2Group.visible = showFloor2;
      if (enableBakedShadows) {
        renderer.shadowMap.needsUpdate = true;
      }

      if (!animateCamera) return;

      if (mode === 'floor2') {
        _targetLookAt.set(0, FLOOR2_Y + 0.8, -3.2);
        _targetCamPos.set(0, FLOOR2_Y + 11.2, 14.5);
        startCameraTransition();
      } else if (mode === 'floor1') {
        _targetLookAt.set(0, 1.0, 0.2);
        _targetCamPos.set(0, 15.8, 22.8);
        startCameraTransition();
      } else {
        _targetLookAt.copy(defaultLookAt);
        _targetCamPos.copy(defaultCamPos);
        startCameraTransition();
      }
    };

    const focusAgent = (agentId: string | null) => {
      if (!agentId) {
        _targetLookAt.copy(defaultLookAt);
        _targetCamPos.copy(defaultCamPos);
        startCameraTransition();
        return;
      }
      const rt = runtimes.find((r) => r.agentId === agentId);
      if (!rt) return;
      if (rt.currentFloor === 2 && floorViewRef.current === 'floor1') {
        floor2StaticGroup.visible = true;
        dynamicFloor2Group.visible = true;
      }
      _targetLookAt.set(rt.currentPos.x, rt.currentPos.y + 1.15, rt.currentPos.z);
      _targetCamPos.set(rt.currentPos.x + 2.4, rt.currentPos.y + 5.4, rt.currentPos.z + 8.2);
      startCameraTransition();
    };

    const setCameraPreset = (mode: OfficeCameraPreset) => {
      if (mode === 'focus' && selectedRef.current) {
        focusAgent(selectedRef.current);
        return;
      }
      if (mode === 'top') {
        _targetLookAt.set(0, 1.0, -0.5);
        _targetCamPos.set(0, 32.5, 6.2);
      } else if (mode === 'meeting') {
        _targetLookAt.set(-9.8, 1.2, -3.6);
        _targetCamPos.set(-4.2, 8.2, 6.5);
      } else if (mode === 'lounge') {
        _targetLookAt.set(9.5, 1.1, 2.2);
        _targetCamPos.set(4.5, 8.8, 12.6);
      } else if (mode === 'dorm') {
        floor2StaticGroup.visible = true;
        dynamicFloor2Group.visible = true;
        _targetLookAt.set(0, FLOOR2_Y + 0.7, -3.6);
        _targetCamPos.set(0, FLOOR2_Y + 10.6, 13.8);
      } else {
        _targetLookAt.copy(defaultLookAt);
        _targetCamPos.copy(defaultCamPos);
      }
      startCameraTransition();
    };

    const applyLanguage = (nextLang: LanguageId) => {
      langRef.current = nextLang;
      const idleBank = OFFICE_IDLE_THOUGHTS[nextLang];
      const workingBank = OFFICE_WORKING_THOUGHTS[nextLang];
      const agentById = agentMapRef.current;
      runtimes.forEach((rt) => {
        const ag = agentById.get(rt.agentId);
        const localizedTask = ag ? agentDisplayRef.current(ag).task : '';
        if (rt.activity === 'working') {
          rt.thought = localizedTask || workingBank[rt.index % workingBank.length];
        } else if (rt.activity === 'alert') {
          rt.thought = localizedTask || OFFICE_ALERT_FALLBACK[nextLang];
        } else {
          const meta = idleBank[rt.activity];
          rt.moodEmoji = meta.emoji;
          rt.thought = meta.lines[rt.index % meta.lines.length];
        }
        rt.lastRenderedThought = '';
      });
      lastSelectedMoodKey = '';
      pushSelectedMoodIfChanged();
    };

    rebuildDynamicFleet(agentsRef.current);
    applyFloorView(floorViewRef.current, false);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    sceneApiRef.current = {
      rebuildDynamicFleet,
      applyTheme,
      applyLanguage,
      applyFloorView,
      focusAgent,
      setCameraPreset,
    };

    // Raycasting pointer click (strictly ignores multi-touch pinch-to-zoom gestures and never hijacks zoom on single tap)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const activePointers = new Set<number>();
    let wasMultiTouch = false;
    let downX = 0;
    let downY = 0;
    let lastTapId = '';
    let lastTapAt = 0;

    const onPointerDown = (e: PointerEvent) => {
      transitioningCamera = false;
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) {
        wasMultiTouch = true;
        return;
      }
      wasMultiTouch = false;
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (wasMultiTouch || activePointers.size > 0) {
        if (activePointers.size === 0) wasMultiTouch = false;
        return;
      }
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
          const now = performance.now();
          if (hitId === lastTapId && now - lastTapAt < 380) {
            focusAgent(hitId);
            lastTapId = '';
            lastTapAt = 0;
          } else {
            lastTapId = hitId;
            lastTapAt = now;
          }
        }
      }
    };
    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) wasMultiTouch = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    const onContextLost = (ev: Event) => ev.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    let viewportW = width;
    let viewportH = height;
    let pendingResizeW: number | null = null;
    let pendingResizeH: number | null = null;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const cw = entry ? entry.contentRect.width : container.clientWidth;
      const ch = entry ? entry.contentRect.height : container.clientHeight;
      const w = Math.max(Math.round(cw), 320);
      const h = Math.max(Math.round(ch), 260);
      if (Math.abs(w - viewportW) < 4 && Math.abs(h - viewportH) < 4) return;
      pendingResizeW = w;
      pendingResizeH = h;
    });
    resizeObserver.observe(container);

    // Paced animation loop (software-WebGL safe)
    const startMs = performance.now();
    let lastMs = startMs;
    let disposed = false;
    let frameId = 0;
    let timerId = 0;
    let lastMoodSyncElapsed = 0;

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

    const IDLE_ACTIVITIES: IdleActivityType[] = ['coffee', 'tv', 'billiard', 'meeting', 'reading', 'stroll', 'nap'];

    let smoothedDt = 1 / 60;

    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const rawDt = Math.min(Math.max((nowMs - lastMs) / 1000, 0.001), 0.036);
      lastMs = nowMs;
      smoothedDt = smoothedDt * 0.65 + rawDt * 0.35;
      const dt = smoothedDt;
      const elapsed = (nowMs - startMs) / 1000;

      // Apply coalesced viewport resize cleanly inside rAF (never synchronously inside ResizeObserver)
      if (pendingResizeW !== null && pendingResizeH !== null) {
        viewportW = pendingResizeW;
        viewportH = pendingResizeH;
        pendingResizeW = null;
        pendingResizeH = null;
        camera.aspect = viewportW / viewportH;
        camera.updateProjectionMatrix();
        renderer.setSize(viewportW, viewportH, false);
      }

      // Subtle ticking wall clock
      clockMinuteHand.rotation.z = -elapsed * 0.25;

      if (transitioningCamera) {
        const dampLambda = 4.8;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, dampLambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, dampLambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, dampLambda, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLookAt.x, dampLambda, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLookAt.y, dampLambda, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLookAt.z, dampLambda, dt);
        const arrived =
          camera.position.distanceTo(_targetCamPos) < 0.08 &&
          controls.target.distanceTo(_targetLookAt) < 0.08;
        if (arrived || nowMs - transitionStartedAt > 1600) {
          transitioningCamera = false;
        }
      }

      controls.update();

      const agentById = agentMapRef.current;
      const curSelectedId = selectedRef.current;
      const totalAgents = agentsRef.current.length;

      const w = viewportW;
      const h = viewportH;
      const padX = compact ? 58 : 74;
      const padYTop = 44;
      const padYBottom = compact ? 18 : 112;
      let moodDirty = false;

      for (let i = 0; i < runtimes.length; i += 1) {
        const rt = runtimes[i];
        const agent = agentById.get(rt.agentId);
        if (!agent) continue;

        // Reconcile status transitions (working / alert / idle) without rebuilding meshes
        const curLang = langRef.current;
        const localizedTask = agentDisplayRef.current(agent).task;
        const workingBank = OFFICE_WORKING_THOUGHTS[curLang];
        const idleBank = OFFICE_IDLE_THOUGHTS[curLang];

        if (agent.status === 'working') {
          const nextTaskText = localizedTask || workingBank[rt.index % workingBank.length];
          if (rt.activity !== 'working') {
            rt.activity = 'working';
            rt.moodEmoji = '💻';
            rt.thought = nextTaskText;
            rt.path = buildRoutePath(
              rt.currentFloor,
              1,
              { x: rt.chairPos.x, y: 0, z: rt.chairPos.z },
              rt.currentPos.y,
            );
            rt.pose = 'sit';
            rt.faceAngle = Math.PI;
            rt.deskLedMat.color.setHex(0xf95c19);
            rt.deskLedMat.emissive.setHex(0xf95c19);
            moodDirty = true;
          } else if (rt.thought !== nextTaskText) {
            rt.thought = nextTaskText;
            moodDirty = true;
          }
        } else if (agent.status === 'alert' && rt.activity !== 'alert') {
          rt.activity = 'alert';
          rt.moodEmoji = '⚠️';
          rt.thought = localizedTask || OFFICE_ALERT_FALLBACK[curLang];
          rt.path = buildRoutePath(
            rt.currentFloor,
            1,
            { x: rt.deskPos.x, y: 0, z: rt.deskPos.z + 1.15 },
            rt.currentPos.y,
          );
          rt.pose = 'stand';
          rt.faceAngle = 0;
          rt.deskLedMat.color.setHex(0xef4444);
          rt.deskLedMat.emissive.setHex(0xef4444);
          moodDirty = true;
        } else if (agent.status === 'idle') {
          rt.deskLedMat.color.setHex(0x22c55e);
          rt.deskLedMat.emissive.setHex(0x22c55e);
          if (rt.activity === 'working' || rt.activity === 'alert' || elapsed >= rt.nextSwitchAt) {
            const pick = IDLE_ACTIVITIES[(rt.index + Math.floor(elapsed / 7)) % IDLE_ACTIVITIES.length];
            const spot = getActivitySpot(pick, rt.index, rt.bedPos);
            rt.activity = pick;
            const meta = idleBank[pick];
            rt.moodEmoji = meta.emoji;
            rt.thought = meta.lines[(rt.index + Math.floor(elapsed)) % meta.lines.length];
            rt.path = buildRoutePath(rt.currentFloor, spot.floor, spot.pos, rt.currentPos.y);
            rt.pose = spot.pose;
            rt.faceAngle = spot.faceAngle;
            rt.nextSwitchAt = elapsed + 11 + (rt.index * 2.3) % 7;
            moodDirty = true;
          }
        }

        const { rig } = rt;
        // Wait until waking agent stands upright before walking away from bed (zero horizontal sliding)
        const standingUpFromSleep = rt.path.length > 0 && Math.abs(rig.bodyPivot.rotation.x) > 0.35;

        // Follow walking waypoints with smooth acceleration/deceleration and shortest-arc turning
        let isWalking = false;
        if (rt.path.length > 0 && !standingUpFromSleep) {
          const wp = rt.path[0];
          const dx = wp.x - rt.currentPos.x;
          const dy = wp.y - rt.currentPos.y;
          const dz = wp.z - rt.currentPos.z;
          const dist = Math.hypot(dx, dy, dz);
          const isFinalWaypoint = rt.path.length === 1;
          const desiredSpeed = isFinalWaypoint ? Math.min(2.45, Math.max(0.75, dist * 3.0)) : 2.45;
          rt.currentSpeed = THREE.MathUtils.damp(rt.currentSpeed, desiredSpeed, 7.5, dt);

          if (dist < 0.06) {
            rt.currentPos.set(wp.x, wp.y, wp.z);
            rt.path.shift();
            rt.currentFloor = rt.currentPos.y > FLOOR2_Y * 0.6 ? 2 : 1;
            if (rt.path.length === 0) {
              rt.currentSpeed = 0;
            }
          } else {
            isWalking = true;
            const step = Math.min(dist, rt.currentSpeed * dt);
            rt.currentPos.x += (dx / dist) * step;
            rt.currentPos.y += (dy / dist) * step;
            rt.currentPos.z += (dz / dist) * step;
            rt.currentFloor = rt.currentPos.y > FLOOR2_Y * 0.6 ? 2 : 1;
            const desiredRot = Math.atan2(dx, dz);
            rt.currentRotY = dampAngle(rt.currentRotY, desiredRot, 9.5, dt);
          }
        } else {
          rt.currentSpeed = THREE.MathUtils.damp(rt.currentSpeed, 0, 10, dt);
          rt.currentRotY = dampAngle(rt.currentRotY, rt.faceAngle, 8, dt);
        }

        // Hide agents on Floor 2 if user toggled Floor 1 only
        const visibleOnCurrentFloorView =
          floorViewRef.current === 'all' ||
          (floorViewRef.current === 'floor1' && rt.currentPos.y < FLOOR2_Y * 0.5) ||
          (floorViewRef.current === 'floor2' && rt.currentPos.y >= FLOOR2_Y * 0.5);
        rig.root.visible = visibleOnCurrentFloorView;

        rig.root.position.copy(rt.currentPos);
        rig.root.rotation.y = rt.currentRotY;
        rig.mug.visible = !isWalking && rt.activity === 'coffee';
        rig.contactShadow.visible = isWalking || standingUpFromSleep || rt.pose !== 'sleep';

        // Compute target body & limb pose, then blend smoothly (zero instant joint snapping)
        let targetPivotY = 0;
        let targetPivotZ = 0;
        let targetPivotRotX = 0;
        let targetLeftLeg = 0;
        let targetRightLeg = 0;
        let targetLeftArm = 0;
        let targetRightArm = 0;
        let targetHeadY = 0;

        if (standingUpFromSleep) {
          // Smoothly transition upright before walking off the bed
          targetPivotY = 0;
          targetPivotZ = 0;
          targetPivotRotX = 0;
        } else if (isWalking) {
          const speedScale = Math.min(1, rt.currentSpeed / 2.2);
          const stride = Math.sin(elapsed * 8.2 + rt.phaseOffset) * speedScale;
          targetPivotY = Math.abs(stride) * 0.038;
          targetLeftLeg = stride * 0.52;
          targetRightLeg = -stride * 0.52;
          targetLeftArm = -stride * 0.42;
          targetRightArm = stride * 0.42;
          targetHeadY = Math.sin(elapsed * 2.0 + rt.phaseOffset) * 0.06;
        } else if (rt.pose === 'sleep') {
          targetPivotY = 0.64;
          targetPivotZ = -0.58;
          targetPivotRotX = Math.PI / 2;
          targetLeftLeg = 0.05;
          targetRightLeg = -0.05;
          targetLeftArm = 0.15;
          targetRightArm = -0.15;
          targetHeadY = Math.sin(elapsed * 0.8 + rt.phaseOffset) * 0.12;
        } else if (rt.pose === 'sit') {
          targetPivotY = -0.22;
          targetLeftLeg = -Math.PI * 0.46;
          targetRightLeg = -Math.PI * 0.46;
          if (rt.activity === 'working') {
            const typeWave = Math.sin(elapsed * 11 + rt.phaseOffset);
            targetLeftArm = -0.95 + typeWave * 0.11;
            targetRightArm = -0.95 - typeWave * 0.11;
            targetHeadY = Math.sin(elapsed * 1.5 + rt.phaseOffset) * 0.16;
          } else {
            targetLeftArm = -0.35;
            targetRightArm = -0.35;
            targetHeadY = Math.sin(elapsed * 0.9 + rt.phaseOffset) * 0.14;
          }
        } else if (rt.activity === 'alert') {
          const wave = Math.sin(elapsed * 7.2 + rt.phaseOffset);
          targetLeftArm = -2.3 + wave * 0.32;
          targetRightArm = -2.3 - wave * 0.32;
        } else {
          const breathe = Math.sin(elapsed * 2.1 + rt.phaseOffset);
          targetLeftArm = rt.activity === 'billiard' ? -0.45 : breathe * 0.06;
          targetRightArm = rt.activity === 'coffee' ? -1.05 + breathe * 0.08 : -breathe * 0.06;
          targetHeadY = Math.sin(elapsed * 1.1 + rt.phaseOffset) * 0.22;
        }

        const jointLambda = isWalking ? 16 : 11;
        rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, targetPivotY, 12, dt);
        rig.bodyPivot.position.z = THREE.MathUtils.damp(rig.bodyPivot.position.z, targetPivotZ, 12, dt);
        rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, targetPivotRotX, 11, dt);
        rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, targetLeftLeg, jointLambda, dt);
        rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, targetRightLeg, jointLambda, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, targetLeftArm, jointLambda, dt);
        rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, targetRightArm, jointLambda, dt);
        rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, targetHeadY, 9, dt);

        // Imperatively sync thought text, status dot, and selection highlight (ZERO React re-renders)
        const nextThoughtStr = `${rt.moodEmoji} ${rt.thought}`;
        if (rt.lastRenderedThought !== nextThoughtStr) {
          const thoughtEl = labelThoughtRefs.current[rt.agentId];
          if (thoughtEl) {
            thoughtEl.textContent = nextThoughtStr;
            rt.lastRenderedThought = nextThoughtStr;
          }
        }

        const nextDotColor =
          agent.status === 'alert' ? '#EF4444' : agent.status === 'working' ? '#F95C19' : '#22C55E';
        if (rt.lastRenderedDot !== nextDotColor) {
          const dotEl = labelDotRefs.current[rt.agentId];
          if (dotEl) {
            dotEl.style.backgroundColor = nextDotColor;
            rt.lastRenderedDot = nextDotColor;
          }
        }

        const isSelected = curSelectedId === rt.agentId;
        if (rt.lastRenderedSelected !== isSelected) {
          const bubbleEl = labelBubbleBoxRefs.current[rt.agentId];
          const pillEl = labelPillRefs.current[rt.agentId];
          if (bubbleEl) {
            bubbleEl.style.borderColor = isSelected ? '#F95C19' : 'rgba(24, 24, 27, 0.16)';
          }
          if (pillEl) {
            const defaultBg = pillEl.dataset.defaultBg || '#F95C19';
            pillEl.style.backgroundColor = isSelected ? '#F95C19' : defaultBg;
            pillEl.style.borderColor = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.22)';
          }
          rt.lastRenderedSelected = isSelected;
        }

        const showBubble = !compact || isSelected || totalAgents <= 4;
        if (rt.lastRenderedBubbleVis !== showBubble) {
          const bubbleEl = labelBubbleBoxRefs.current[rt.agentId];
          if (bubbleEl) {
            bubbleEl.style.display = showBubble ? 'block' : 'none';
            rt.lastRenderedBubbleVis = showBubble;
          }
        }

        // Project floating Name + Task + Thought Bubble above the agent's head (skip stationary writes)
        const el = labelRefs.current[rt.agentId];
        if (el) {
          if (!visibleOnCurrentFloorView) {
            if (rt.lastVisible !== false) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
              rt.lastVisible = false;
            }
          } else {
            const headHeight = rt.pose === 'sleep' ? 1.15 : rt.pose === 'sit' ? 1.68 : 1.92;
            _projVec.set(rt.currentPos.x, rt.currentPos.y + headHeight, rt.currentPos.z);
            _projVec.project(camera);
            if (_projVec.z < 1) {
              const rawX = (_projVec.x * 0.5 + 0.5) * w;
              const rawY = (-_projVec.y * 0.5 + 0.5) * h;
              const sx = Math.max(padX, Math.min(w - padX, rawX));
              const sy = Math.max(padYTop, Math.min(h - padYBottom, rawY));
              if (Math.abs(sx - rt.lastScreenX) >= 0.4 || Math.abs(sy - rt.lastScreenY) >= 0.4) {
                el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
                rt.lastScreenX = sx;
                rt.lastScreenY = sy;
              }
              if (rt.lastVisible !== true) {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                rt.lastVisible = true;
              }
            } else if (rt.lastVisible !== false) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
              rt.lastVisible = false;
            }
          }
        }
      }

      if (elapsed - lastMoodSyncElapsed > 0.45) {
        lastMoodSyncElapsed = elapsed;
        pushSelectedMoodIfChanged();
        if (moodDirty && onMoodSnapshotRef.current) {
          const snap: Record<string, AgentLiveMood> = {};
          runtimes.forEach((r) => {
            snap[r.agentId] = {
              activity: r.activity,
              thought: `${r.moodEmoji} ${r.thought}`,
              floor: r.currentFloor,
            };
          });
          onMoodSnapshotRef.current(snap);
        }
      } else if (curSelectedId && !lastSelectedMoodKey.startsWith(`${curSelectedId}|`)) {
        pushSelectedMoodIfChanged();
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
      controls.removeEventListener('start', cancelCameraTransition);
      renderer.domElement.removeEventListener('wheel', cancelCameraTransition);
      renderer.domElement.removeEventListener('touchstart', cancelCameraTransition);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      clearDynamic();
      staticGeos.forEach((g) => g.dispose());
      staticMats.forEach((m) => m.dispose());
      staticTexs.forEach((t) => t.dispose());
      envTex.dispose();
      renderer.dispose();
      sceneApiRef.current = null;
    };
  }, [compact]);

  // Rebuild 1:1 workstations & 1:1 beds ONLY when agents are added/removed (never on 2.5s telemetry ticks!)
  useEffect(() => {
    sceneApiRef.current?.rebuildDynamicFleet(agentsRef.current);
  }, [fleetSignature]);

  // Apply theme backdrop cleanly without resetting agent walking positions
  useEffect(() => {
    sceneApiRef.current?.applyTheme(theme);
  }, [theme]);

  // Refresh floating thought texts immediately when language switches (zero WebGL reset)
  useEffect(() => {
    sceneApiRef.current?.applyLanguage(lang);
  }, [lang]);

  // Floor visibility transitions (skip initial mount so user's camera is never needlessly animated)
  const prevFloorViewRef = useRef<OfficeFloorView>(floorView);
  useEffect(() => {
    if (prevFloorViewRef.current === floorView) return;
    prevFloorViewRef.current = floorView;
    sceneApiRef.current?.applyFloorView(floorView);
  }, [floorView]);

  // Smooth camera preset transitions (ignore nonce === 0 initial mount state)
  useEffect(() => {
    if (!cameraPresetTrigger || cameraPresetTrigger.nonce === 0) return;
    sceneApiRef.current?.setCameraPreset(cameraPresetTrigger.mode);
  }, [cameraPresetTrigger]);

  return (
    <OfficeViewport
      agents={agents}
      fleetLabelKey={fleetLabelKey}
      compact={compact}
      mountRef={mountRef}
      labelRefs={labelRefs}
      labelBubbleBoxRefs={labelBubbleBoxRefs}
      labelThoughtRefs={labelThoughtRefs}
      labelPillRefs={labelPillRefs}
      labelDotRefs={labelDotRefs}
      onClickAgent={handleClickAgent}
    />
  );
});

export default AgentOffice3D;
