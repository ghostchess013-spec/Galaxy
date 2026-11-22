import { useMemo, useState } from 'react';
import { Check, Cpu, RefreshCw, X } from 'lucide-react';
import { useI18n } from '../i18n/translations';
import type { BridgeModelOption } from '../services/nexoraBridge';

const CUSTOM_SENTINEL = '__custom_model_input__';

interface AgentModelPickerProps {
  value: string;
  models: BridgeModelOption[];
  modelsSource?: '9router' | 'fallback';
  loading?: boolean;
  compact?: boolean;
  onChange: (nextModel: string) => void;
  onRefresh?: () => void;
  selectId?: string;
}

export default function AgentModelPicker({
  value,
  models,
  modelsSource = 'fallback',
  loading = false,
  compact = false,
  onChange,
  onRefresh,
  selectId,
}: AgentModelPickerProps) {
  const { t } = useI18n();
  const [customMode, setCustomMode] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const options = useMemo(() => {
    const map = new Map<string, BridgeModelOption>();
    for (const m of models) {
      if (m.id.trim()) map.set(m.id.trim(), m);
    }
    const cleanVal = value.trim();
    if (cleanVal && !map.has(cleanVal)) {
      map.set(cleanVal, { id: cleanVal, label: cleanVal, group: 'current' });
    }
    if (map.size === 0) {
      map.set('combo-best', { id: 'combo-best', label: 'combo-best', group: 'combo' });
    }
    return Array.from(map.values());
  }, [models, value]);

  const handleSelectChange = (next: string) => {
    if (next === CUSTOM_SENTINEL) {
      setCustomDraft(value);
      setCustomMode(true);
      return;
    }
    if (next && next !== value) {
      onChange(next);
    }
  };

  const applyCustom = () => {
    const clean = customDraft.trim();
    if (!clean) {
      setCustomMode(false);
      return;
    }
    onChange(clean);
    setCustomMode(false);
  };

  if (customMode) {
    return (
      <div className={`flex items-center gap-1.5 ${compact ? 'max-w-[260px]' : 'w-full'}`}>
        <input
          type="text"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyCustom();
            } else if (e.key === 'Escape') {
              setCustomMode(false);
            }
          }}
          placeholder={t('modelPickerCustomPlaceholder')}
          autoFocus
          className={`min-w-0 flex-1 rounded-lg border border-[var(--nx-accent)] bg-[var(--nx-bg-elevated)] font-mono text-[var(--nx-text)] focus:outline-none ${
            compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs'
          }`}
        />
        <button
          type="button"
          onClick={applyCustom}
          title={t('modelPickerApply')}
          aria-label={t('modelPickerApply')}
          className={`inline-flex items-center justify-center rounded-lg bg-[var(--nx-accent)] text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] shrink-0 cursor-pointer ${
            compact ? 'p-1.5' : 'px-2.5 py-2 text-xs font-semibold'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setCustomMode(false)}
          title={t('commonCancel')}
          aria-label={t('commonCancel')}
          className={`inline-flex items-center justify-center rounded-lg border border-[var(--nx-border-strong)] text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] shrink-0 cursor-pointer ${
            compact ? 'p-1.5' : 'p-2'
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 min-w-0 max-w-full">
        <Cpu className="h-3 w-3 text-[var(--nx-accent)] shrink-0" aria-hidden="true" />
        <select
          id={selectId}
          aria-label={t('modelPickerAria')}
          title={t('modelPickerSyncHint')}
          value={value}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="min-w-0 max-w-[190px] sm:max-w-[230px] truncate rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--nx-text)] hover:border-[var(--nx-accent)] focus:border-[var(--nx-accent)] focus:outline-none cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.group === 'combo' ? `★ ${opt.label}` : opt.label}
            </option>
          ))}
          <option value={CUSTOM_SENTINEL}>{t('modelPickerCustomOption')}</option>
        </select>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title={t('modelPickerRefresh')}
            aria-label={t('modelPickerRefresh')}
            className="rounded-md border border-[var(--nx-border)] p-1 text-[var(--nx-text-muted)] hover:border-[var(--nx-border-strong)] hover:text-[var(--nx-text)] disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <select
          id={selectId}
          value={value}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.group === 'combo' ? `★ ${opt.label}` : opt.label}
            </option>
          ))}
          <option value={CUSTOM_SENTINEL}>{t('modelPickerCustomOption')}</option>
        </select>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title={t('modelPickerRefresh')}
            aria-label={t('modelPickerRefresh')}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] p-2 text-[var(--nx-text-muted)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-text)] disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--nx-text-subtle)]">
        <span>{t('modelPickerSyncHint')}</span>
        {modelsSource === '9router' && (
          <span className="font-mono text-[var(--nx-ok)] shrink-0">
            {t('modelPickerLiveCount', { count: models.length })}
          </span>
        )}
      </div>
    </div>
  );
}
