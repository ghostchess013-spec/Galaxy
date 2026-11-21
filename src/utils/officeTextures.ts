import * as THREE from 'three';

function finalizeTexture(canvas: HTMLCanvasElement, anisotropy: number, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, anisotropy);
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Warm herringbone oak parquet wood floor inspired by architectural cutaway dioramas.
 */
export function createHerringboneWoodTexture(anisotropy: number, darkMode: boolean): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const baseTone = darkMode ? '#B88C5E' : '#C9A173';
  ctx.fillStyle = baseTone;
  ctx.fillRect(0, 0, size, size);

  const palette = darkMode
    ? ['#B68757', '#C39464', '#A6784B', '#BD8F60', '#9E7044']
    : ['#C89F72', '#D4AE82', '#BC9163', '#CFA77A', '#B4885A'];

  const plankW = 64;
  const plankH = 16;
  ctx.save();
  for (let row = -8; row < 40; row++) {
    for (let col = -8; col < 16; col++) {
      const idx = Math.abs(row * 7 + col * 13) % palette.length;
      const isRight = (row + col) % 2 === 0;
      const x = col * plankW;
      const y = row * plankH;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(isRight ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillStyle = palette[idx];
      ctx.fillRect(0, 0, plankW * 0.96, plankH * 0.92);

      // Subtle wood grain lines
      ctx.strokeStyle = 'rgba(72, 42, 16, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, plankH * 0.35);
      ctx.lineTo(plankW * 0.9, plankH * 0.35);
      ctx.moveTo(4, plankH * 0.68);
      ctx.lineTo(plankW * 0.85, plankH * 0.68);
      ctx.stroke();

      // Plank bevel seam
      ctx.strokeStyle = 'rgba(56, 33, 14, 0.28)';
      ctx.strokeRect(0.5, 0.5, plankW * 0.95, plankH * 0.9);
      ctx.restore();
    }
  }
  ctx.restore();

  return finalizeTexture(canvas, anisotropy, 5, 3);
}

/**
 * Panoramic city skyline seen through the main back office window.
 */
export function createCitySkylineTexture(anisotropy: number, isWarmDark: boolean): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Soft sunlit sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (isWarmDark) {
    sky.addColorStop(0, '#5B8EC9');
    sky.addColorStop(0.52, '#A9CCE8');
    sky.addColorStop(0.84, '#F5DEC4');
    sky.addColorStop(1, '#E6C9A8');
  } else {
    sky.addColorStop(0, '#6CA4DF');
    sky.addColorStop(0.58, '#B8D9F2');
    sky.addColorStop(1, '#F7E7D0');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Subtle warm sun halo
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.36, 12, w * 0.72, h * 0.36, 160);
  sun.addColorStop(0, 'rgba(255, 248, 224, 0.9)');
  sun.addColorStop(0.45, 'rgba(255, 226, 178, 0.35)');
  sun.addColorStop(1, 'rgba(255, 226, 178, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // Distant soft skyline silhouette
  const drawLayer = (count: number, minH: number, maxH: number, color: string, seed: number, winColor?: string) => {
    let x = 0;
    for (let i = 0; i < count; i++) {
      const bw = 26 + ((i * 19 + seed * 7) % 44);
      const bh = minH + ((i * 37 + seed * 17) % (maxH - minH));
      const y = h - bh;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, bw - 3, bh);
      if (winColor) {
        ctx.fillStyle = winColor;
        for (let wy = y + 10; wy < h - 10; wy += 12) {
          for (let wx = x + 5; wx < x + bw - 10; wx += 9) {
            if ((wx + wy + i) % 3 !== 0) {
              ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
      }
      x += bw - 2;
      if (x > w + 20) break;
    }
  };

  drawLayer(28, 90, 210, '#8DA6BF', 3);
  drawLayer(26, 70, 175, '#68829D', 11, 'rgba(255, 244, 214, 0.25)');
  drawLayer(24, 50, 140, '#495E75', 23, 'rgba(255, 238, 198, 0.36)');

  // Thin horizontal window glass highlight
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  return finalizeTexture(canvas, anisotropy);
}

/**
 * Meeting room Kanban & strategy whiteboard texture.
 */
export function createWhiteboardTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F7F8FA';
  ctx.fillRect(0, 0, w, h);

  // Header bar
  ctx.fillStyle = '#1E242E';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('GALAXY SPRINT BOARD  ·  HERMES FLEET', 20, 32);
  ctx.strokeStyle = '#D5DCE6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 46);
  ctx.lineTo(w - 16, 46);
  ctx.stroke();

  // 4 Kanban columns
  const cols = ['BACKLOG', 'PLANNING', 'IN PROGRESS', 'SHIPPED'];
  const colors = ['#FDE68A', '#FED7AA', '#BFDBFE', '#BBF7D0'];
  const colW = (w - 32) / 4;
  cols.forEach((title, idx) => {
    const cx = 16 + idx * colW;
    if (idx > 0) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(cx, 52);
      ctx.lineTo(cx, h - 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(title, cx + 10, 68);

    // Sticky notes
    const noteCount = idx === 2 ? 4 : 3;
    for (let n = 0; n < noteCount; n++) {
      const ny = 82 + n * 38;
      ctx.fillStyle = colors[(idx + n) % colors.length];
      ctx.fillRect(cx + 10, ny, colW - 22, 28);
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx + 16, ny + 8, (colW - 38) * 0.78, 3);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(cx + 16, ny + 16, (colW - 38) * 0.52, 2.5);
    }
  });

  return finalizeTexture(canvas, anisotropy);
}

/**
 * Dual computer monitor code & terminal display texture.
 */
export function createMonitorScreenTexture(anisotropy: number, accentHex = '#F95C19'): THREE.CanvasTexture {
  const w = 256;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0D1117';
  ctx.fillRect(0, 0, w, h);

  // Top window chrome
  ctx.fillStyle = '#161B22';
  ctx.fillRect(0, 0, w, 18);
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.arc(10, 9, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(20, 9, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(30, 9, 3, 0, Math.PI * 2);
  ctx.fill();

  // Sidebar & code lines
  ctx.fillStyle = '#141923';
  ctx.fillRect(0, 18, 44, h - 18);

  const lineColors = ['#93C5FD', '#E2E8F0', accentHex, '#86EFAC', '#FCD34D', '#94A3B8'];
  for (let i = 0; i < 11; i++) {
    const y = 28 + i * 11;
    const indent = (i % 3) * 10;
    const len = 46 + ((i * 29) % 118);
    ctx.fillStyle = lineColors[i % lineColors.length];
    ctx.fillRect(54 + indent, y, Math.min(len, w - 62 - indent), 4);
  }

  return finalizeTexture(canvas, anisotropy);
}

/**
 * Living room Smart TV live media / GALAXY telemetry screen texture.
 */
export function createTvScreenTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 288;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0C1322');
  grad.addColorStop(0.55, '#191D2D');
  grad.addColorStop(1, '#2B1610');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle glowing orbital arc
  ctx.strokeStyle = 'rgba(249, 92, 25, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(w * 0.65, h * 0.48, 120, 44, -0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('GALAXY LIVE TV', 34, 62);
  ctx.fillStyle = '#F95C19';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('LOUNGE CHANNEL  ·  HERMES FLEET TELEMETRY', 34, 88);

  // Chart bars
  for (let i = 0; i < 12; i++) {
    const bh = 28 + ((i * 23) % 72);
    ctx.fillStyle = i % 3 === 0 ? '#F95C19' : '#38BDF8';
    ctx.fillRect(36 + i * 24, 232 - bh, 14, bh);
  }

  // Bottom ticker
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, h - 34, w, 34);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '13px monospace';
  ctx.fillText('9ROUTER :20128 ONLINE   •   ALL HERMES AGENTS ACTIVE   •   LOUNGE READY', 22, h - 12);

  return finalizeTexture(canvas, anisotropy);
}

/**
 * Framed modern geometric wall art texture.
 */
export function createWallArtTexture(anisotropy: number, variant: 0 | 1): THREE.CanvasTexture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = variant === 0 ? '#F4EDE4' : '#1A1C22';
  ctx.fillRect(0, 0, w, h);

  if (variant === 0) {
    ctx.fillStyle = '#D95D26';
    ctx.beginPath();
    ctx.arc(130, 124, 68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2A2726';
    ctx.fillRect(42, 178, 172, 92);

    ctx.strokeStyle = '#F4EDE4';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(128, 180, 56, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#E0642A';
    ctx.beginPath();
    ctx.moveTo(40, 260);
    ctx.lineTo(128, 70);
    ctx.lineTo(216, 260);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#F5E7D3';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(128, 152, 52, 0, Math.PI * 2);
    ctx.stroke();
  }

  return finalizeTexture(canvas, anisotropy);
}

/**
 * Floor 2 cozy woven bedroom carpet texture.
 */
export function createDormCarpetTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#333640';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  return finalizeTexture(canvas, anisotropy, 6, 3);
}
