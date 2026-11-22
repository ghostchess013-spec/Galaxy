import { useRef, useState } from 'react';
import { Sparkles, Upload, UserPlus, Wrench, X } from 'lucide-react';
import { AVATARS, PORTRAIT_GALLERY, ROLE_PRESETS } from '../data/seedData';
import { useI18n } from '../i18n/translations';
import type { BuildingArchetype, RolePreset } from '../types/nexora';

export interface CustomAgentDraft {
  name: string;
  buildingName: string;
  role: string;
  department: string;
  model: string;
  archetype: BuildingArchetype;
  soulSummary: string;
  avatarUrl: string;
  tools: string[];
}

interface AddAgentModalProps {
  open: boolean;
  isLiveBridge: boolean;
  onClose: () => void;
  onAddFromPreset: (
    preset: RolePreset,
    customName?: string,
    customBuilding?: string,
    customAvatarUrl?: string,
  ) => void;
  onAddCustomAgent: (draft: CustomAgentDraft) => void;
}

const WORKSTATION_STYLES: BuildingArchetype[] = [
  'observatory_dome',
  'ribbed_tower',
  'octagonal_citadel',
  'curved_atelier',
  'signal_spire',
  'cantilever_loft',
  'stepped_ziggurat',
  'stacked_stage',
  'twin_towers',
  'care_pavilion',
  'travel_rotunda',
];

const MODEL_OPTIONS = [
  'combo-best',
  '9router / claude-sonnet-4',
  '9router / gemini-2.5-pro',
  '9router / gemini-2.5-flash',
  '9router / gpt-4.1',
  '9router / gpt-4.1-mini',
];

/**
 * Resizes an uploaded image file onto a square 256x256 JPEG data URL so it stays crisp
 * in portraits and lightweight inside localStorage and ~/.hermes/metadata.json.
 */
export function compressImageToPortraitDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        // Favor upper-center crop so portraits keep faces centered
        const sy = Math.max(0, (img.height - minSide) * 0.2);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function AddAgentModal({
  open,
  isLiveBridge,
  onClose,
  onAddFromPreset,
  onAddCustomAgent,
}: AddAgentModalProps) {
  const { lang, t, presetDisplay, archetypeStyleLabel, portraitLabel } = useI18n();
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<RolePreset>(ROLE_PRESETS[0]);
  const [presetCustomName, setPresetCustomName] = useState('');
  const [presetCustomStation, setPresetCustomStation] = useState('');
  const [presetAvatarUrl, setPresetAvatarUrl] = useState<string>(ROLE_PRESETS[0].avatarUrl);
  const [presetUploadErr, setPresetUploadErr] = useState('');
  const presetFileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [stationName, setStationName] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [archetype, setArchetype] = useState<BuildingArchetype>('ribbed_tower');
  const [avatarUrl, setAvatarUrl] = useState<string>(AVATARS.developer);
  const [soulSummary, setSoulSummary] = useState('');
  const [error, setError] = useState('');
  const customFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleSelectPreset = (preset: RolePreset) => {
    setSelectedPreset(preset);
    setPresetAvatarUrl(preset.avatarUrl);
    setPresetUploadErr('');
  };

  const handleUploadPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'preset' | 'custom',
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageToPortraitDataUrl(file);
      if (target === 'preset') {
        setPresetAvatarUrl(dataUrl);
        setPresetUploadErr('');
      } else {
        setAvatarUrl(dataUrl);
        setError('');
      }
    } catch {
      const msg = t('addModalCustomPhotoError');
      if (target === 'preset') {
        setPresetUploadErr(msg);
      } else {
        setError(msg);
      }
    }
  };

  const handlePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const localizedPreset = presetDisplay(selectedPreset);
    const chosenStation = presetCustomStation.trim() || localizedPreset.workstation;
    onAddFromPreset(
      selectedPreset,
      presetCustomName.trim() || undefined,
      chosenStation,
      presetAvatarUrl,
    );
    setPresetCustomName('');
    setPresetCustomStation('');
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName) {
      setError(t('addModalCustomErrorName'));
      return;
    }
    if (!trimmedRole) {
      setError(t('addModalCustomErrorRole'));
      return;
    }
    const defaultDeskLabel =
      lang === 'id' ? `Meja ${trimmedName}` : `${trimmedName} Desk`;
    const defaultDept = lang === 'id' ? 'Divisi Kustom' : 'Custom Team';
    const defaultSoul =
      lang === 'id'
        ? `${trimmedName} bertugas sebagai ${trimmedRole} di Kantor 3D Agen AI GALAXY, mengikuti aturan operasi permanen dan selalu melapor ke Operator.`
        : `${trimmedName} operates as ${trimmedRole} in the GALAXY 3D Agent Office, following permanent operating rules and reporting to the Operator.`;

    onAddCustomAgent({
      name: trimmedName,
      buildingName: stationName.trim() || defaultDeskLabel,
      role: trimmedRole,
      department: department.trim() || defaultDept,
      model,
      archetype,
      avatarUrl,
      soulSummary: soulSummary.trim() || defaultSoul,
      tools: ['hermes_cli', 'hermes_skills', '9router_proxy'],
    });
    setName('');
    setStationName('');
    setRole('');
    setDepartment('');
    setSoulSummary('');
    setError('');
    onClose();
  };

  const selectedPresetDisplay = presetDisplay(selectedPreset);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-agent-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--nx-border)] pb-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              {isLiveBridge ? t('addModalEyebrowLive') : t('addModalEyebrowDemo')}
            </p>
            <h2
              id="add-agent-modal-title"
              className="font-editorial text-2xl sm:text-3xl mt-1 text-[var(--nx-text)]"
            >
              {t('addModalTitlePrefix')}{' '}
              <span className="italic text-[var(--nx-accent)]">{t('addModalTitleAccent')}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('addModalCloseAria')}
            className="rounded-lg p-2 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('presets')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              tab === 'presets'
                ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                : 'border border-[var(--nx-border)] bg-[var(--nx-surface)] text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('addModalTabPresets', { count: ROLE_PRESETS.length })}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('custom')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              tab === 'custom'
                ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                : 'border border-[var(--nx-border)] bg-[var(--nx-surface)] text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>{t('addModalTabCustom')}</span>
          </button>
        </div>

        {tab === 'presets' ? (
          <form onSubmit={handlePresetSubmit} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {ROLE_PRESETS.map((preset) => {
                const pDisp = presetDisplay(preset);
                const selected = preset.id === selectedPreset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)]'
                        : 'border-[var(--nx-border)] bg-[var(--nx-surface)] hover:border-[var(--nx-border-strong)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={preset.avatarUrl}
                        alt={preset.name}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 rounded-full object-cover object-top border border-[var(--nx-border-strong)] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--nx-text)] truncate">
                          {preset.name}
                        </div>
                        <div className="text-[11px] text-[var(--nx-text-muted)] truncate">
                          {pDisp.workstation}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--nx-text-muted)] leading-relaxed line-clamp-2">
                      {pDisp.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-surface)] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--nx-text)]">
                  {t('addModalPresetHeading')}
                </span>
                <span className="text-[11px] text-[var(--nx-text-muted)]">
                  {selectedPresetDisplay.role} · {selectedPresetDisplay.department}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="add-preset-name"
                    className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                  >
                    {t('addModalAgentNameLabel')}
                  </label>
                  <input
                    id="add-preset-name"
                    type="text"
                    value={presetCustomName}
                    onChange={(e) => setPresetCustomName(e.target.value)}
                    placeholder={selectedPreset.name}
                    className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="add-preset-station"
                    className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                  >
                    {t('addModalWorkstationLabel')}
                  </label>
                  <input
                    id="add-preset-station"
                    type="text"
                    value={presetCustomStation}
                    onChange={(e) => setPresetCustomStation(e.target.value)}
                    placeholder={selectedPresetDisplay.workstation}
                    className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Preset Portrait Picker + Custom Photo Upload */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-[var(--nx-text-muted)]">
                    {t('addModalPortraitLabel')}
                  </span>
                  <input
                    ref={presetFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void handleUploadPhoto(e, 'preset')}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => presetFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--nx-text)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-accent)] cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    <span>{t('addModalUploadPhoto')}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {PORTRAIT_GALLERY.map((item) => {
                    const active = presetAvatarUrl === item.url;
                    const lbl = portraitLabel(item.id, item.label);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPresetAvatarUrl(item.url)}
                        title={lbl}
                        className={`relative h-10 w-10 rounded-full overflow-hidden border-2 shrink-0 transition-transform cursor-pointer ${
                          active
                            ? 'border-[var(--nx-accent)] scale-105'
                            : 'border-[var(--nx-border-strong)] opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={lbl}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover object-top"
                        />
                      </button>
                    );
                  })}
                  {!PORTRAIT_GALLERY.some((p) => p.url === presetAvatarUrl) && (
                    <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-[var(--nx-accent)] shrink-0">
                      <img
                        src={presetAvatarUrl}
                        alt={t('addModalUploadPhoto')}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                  )}
                </div>
                {presetUploadErr && (
                  <p className="mt-1.5 text-[11px] text-[var(--nx-alert)]">{presetUploadErr}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--nx-border)]">
                <p className="text-xs text-[var(--nx-text-muted)]">
                  {t('addModalProvisionInfo', {
                    workstation: presetCustomStation.trim() || selectedPresetDisplay.workstation,
                    model: selectedPreset.model,
                  })}
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{t('addModalAddPresetBtn')}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCustomSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="custom-agent-name"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                >
                  {t('addModalCustomNameLabel')}
                </label>
                <input
                  id="custom-agent-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={t('addModalCustomNamePlaceholder')}
                  className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-agent-station"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                >
                  {t('addModalCustomWorkstationLabel')}
                </label>
                <input
                  id="custom-agent-station"
                  type="text"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder={t('addModalCustomWorkstationPlaceholder')}
                  className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-agent-role"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                >
                  {t('addModalCustomRoleLabel')}
                </label>
                <input
                  id="custom-agent-role"
                  type="text"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={t('addModalCustomRolePlaceholder')}
                  className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-agent-dept"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                >
                  {t('addModalCustomDeptLabel')}
                </label>
                <input
                  id="custom-agent-dept"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder={t('addModalCustomDeptPlaceholder')}
                  className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-agent-model"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                >
                  {t('addModalCustomModelLabel')}
                </label>
                <select
                  id="custom-agent-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="custom-agent-style"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
                >
                  {t('addModalCustomStyleLabel')}
                </label>
                <select
                  id="custom-agent-style"
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value as BuildingArchetype)}
                  className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                >
                  {WORKSTATION_STYLES.map((arch) => (
                    <option key={arch} value={arch}>
                      {archetypeStyleLabel(arch)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Agent Portrait Picker + Photo Upload */}
            <div className="rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-medium text-[var(--nx-text-muted)]">
                  {t('addModalPortraitLabel')}
                </span>
                <input
                  ref={customFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handleUploadPhoto(e, 'custom')}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => customFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--nx-text)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-accent)] cursor-pointer"
                >
                  <Upload className="h-3 w-3" />
                  <span>{t('addModalUploadPhoto')}</span>
                </button>
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {PORTRAIT_GALLERY.map((item) => {
                  const active = avatarUrl === item.url;
                  const lbl = portraitLabel(item.id, item.label);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAvatarUrl(item.url)}
                      className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                    >
                      <span
                        className={`h-11 w-11 rounded-full overflow-hidden border-2 transition-transform ${
                          active
                            ? 'border-[var(--nx-accent)] scale-105'
                            : 'border-[var(--nx-border-strong)] opacity-75 group-hover:opacity-100'
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={lbl}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover object-top"
                        />
                      </span>
                      <span
                        className={`text-[10px] ${
                          active ? 'text-[var(--nx-accent)] font-semibold' : 'text-[var(--nx-text-subtle)]'
                        }`}
                      >
                        {lbl}
                      </span>
                    </button>
                  );
                })}
                {!PORTRAIT_GALLERY.some((p) => p.url === avatarUrl) && (
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="h-11 w-11 rounded-full overflow-hidden border-2 border-[var(--nx-accent)]">
                      <img
                        src={avatarUrl}
                        alt={t('addModalUploadPhoto')}
                        className="h-full w-full object-cover object-top"
                      />
                    </span>
                    <span className="text-[10px] text-[var(--nx-accent)] font-semibold">
                      {t('addModalUploadPhoto')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="custom-agent-soul"
                className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1"
              >
                {t('addModalCustomSoulLabel')}
              </label>
              <textarea
                id="custom-agent-soul"
                rows={3}
                value={soulSummary}
                onChange={(e) => setSoulSummary(e.target.value)}
                placeholder={t('addModalCustomSoulPlaceholder')}
                className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
              />
            </div>

            {error && <p className="text-xs text-[var(--nx-alert)]">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--nx-border)]">
              <p className="text-xs text-[var(--nx-text-muted)]">
                {isLiveBridge ? t('addModalCustomFooterLive') : t('addModalCustomFooterDemo')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-2 text-xs font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
                >
                  {t('commonCancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{t('addModalCreateCustomBtn')}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
