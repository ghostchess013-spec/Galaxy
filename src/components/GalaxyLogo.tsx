import { useId } from 'react';

interface GalaxyLogoProps {
  size?: number;
  className?: string;
}

/**
 * Signature GALAXY "Orbital G" brand emblem.
 * Precision obsidian squircle housing a sculpted metallic G-arc,
 * tilted ember orbital ring, singularity core, and twin orbital nodes.
 */
export default function GalaxyLogo({ size = 36, className = '' }: GalaxyLogoProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `gx-bg-${uid}`;
  const rimId = `gx-rim-${uid}`;
  const glowId = `gx-glow-${uid}`;
  const arcId = `gx-arc-${uid}`;
  const orbitId = `gx-orbit-${uid}`;
  const coreId = `gx-core-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D1B1C" />
          <stop offset="52%" stopColor="#111011" />
          <stop offset="100%" stopColor="#09090A" />
        </linearGradient>

        <linearGradient id={rimId} x1="8" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF9650" stopOpacity="0.65" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#F95C19" stopOpacity="0.28" />
        </linearGradient>

        <radialGradient id={glowId} cx="50%" cy="50%" r="52%">
          <stop offset="0%" stopColor="#F95C19" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#F95C19" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#F95C19" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={arcId} x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="58%" stopColor="#ECE5DF" />
          <stop offset="100%" stopColor="#BDB3AA" />
        </linearGradient>

        <linearGradient id={orbitId} x1="10" y1="44" x2="54" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB066" />
          <stop offset="50%" stopColor="#F95C19" />
          <stop offset="100%" stopColor="#D84308" />
        </linearGradient>

        <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF0DC" />
          <stop offset="48%" stopColor="#FF8838" />
          <stop offset="100%" stopColor="#F95C19" />
        </radialGradient>
      </defs>

      {/* Machined obsidian squircle base */}
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${bgId})`} />
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="14.25" stroke={`url(#${rimId})`} strokeWidth="1.5" />

      {/* Warm singularity ambient core */}
      <circle cx="32" cy="32" r="24" fill={`url(#${glowId})`} />

      {/* Back half of tilted galaxy orbital ring */}
      <g transform="rotate(-28 32 32)">
        <path
          d="M 8 32 A 24 8.2 0 0 1 56 32"
          stroke={`url(#${orbitId})`}
          strokeWidth="2.1"
          strokeLinecap="round"
          opacity="0.45"
        />
      </g>

      {/* Sculpted geometric G-arc */}
      <path
        d="M 44.5 21.2 A 16.5 16.5 0 1 0 47.8 34.5 L 47.8 32.2 L 34.8 32.2"
        stroke={`url(#${arcId})`}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Front sweeping ember orbital ring */}
      <g transform="rotate(-28 32 32)">
        <path
          d="M 55.6 32.7 A 24 8.2 0 0 1 8.4 32.7"
          stroke={`url(#${orbitId})`}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>

      {/* Central command singularity star + accent crossbar jewel */}
      <circle cx="32" cy="32" r="3.4" fill={`url(#${coreId})`} />
      <path
        d="M 32 25.5 L 33.1 30.9 L 38.5 32 L 33.1 33.1 L 32 38.5 L 30.9 33.1 L 25.5 32 L 30.9 30.9 Z"
        fill="#FFF3E4"
        opacity="0.92"
      />

      {/* Orbiting sentinel satellite nodes */}
      <circle cx="48.5" cy="18.2" r="2.2" fill="#FF9852" />
      <circle cx="48.5" cy="18.2" r="4.2" fill="#F95C19" opacity="0.22" />
      <circle cx="15.2" cy="43.8" r="1.4" fill="#FFE2C8" opacity="0.85" />
    </svg>
  );
}
