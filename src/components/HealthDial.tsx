import { useI18n } from '../i18n/translations';

interface HealthDialProps {
  passed: number;
  total: number;
  label: 'Optimal' | 'Degraded' | 'Critical';
  size?: number;
}

export default function HealthDial({ passed, total, label, size = 164 }: HealthDialProps) {
  const { t, healthLabel } = useI18n();
  const displayLabel = healthLabel(label);
  const pct = total === 0 ? 100 : passed / total;
  const stroke = 5;
  const radius = (size - 24) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const ringColor =
    label === 'Critical'
      ? 'var(--nx-alert)'
      : label === 'Degraded'
        ? '#f59e0b'
        : 'var(--nx-accent)';

  // 36 radial precision tick marks matching GALAXY Health dial
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const innerR = radius - 9;
    const outerR = radius - 4;
    return {
      x1: cx + Math.cos(angle) * innerR,
      y1: cy + Math.sin(angle) * innerR,
      x2: cx + Math.cos(angle) * outerR,
      y2: cy + Math.sin(angle) * outerR,
      active: i / 36 <= pct,
    };
  });

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={t('healthAria', { label: displayLabel, passed, total })}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--nx-border-strong)"
          strokeWidth={stroke}
        />

        {ticks.map((tk, idx) => (
          <line
            key={idx}
            x1={tk.x1}
            y1={tk.y1}
            x2={tk.x2}
            y2={tk.y2}
            stroke={tk.active ? ringColor : 'var(--nx-border)'}
            strokeWidth={1.25}
            strokeLinecap="round"
            opacity={tk.active ? 0.65 : 0.45}
          />
        ))}

        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <span className="text-[9px] tracking-[0.16em] uppercase text-[var(--nx-text-muted)]">
          {t('healthOverall')}
        </span>
        <span
          className={`font-editorial font-medium leading-tight mt-0.5 text-[var(--nx-text)] ${
            size <= 132 ? 'text-lg' : 'text-2xl'
          }`}
        >
          {displayLabel}
        </span>
        <span className="font-mono text-[10px] text-[var(--nx-text-muted)] mt-0.5 tabular-nums whitespace-nowrap">
          {t('healthOfPass', { passed, total })}
        </span>
      </div>
    </div>
  );
}
