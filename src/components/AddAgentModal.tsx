import { useRef, useState } from 'react';
import { Plus, Sliders, Sparkles, Upload, X } from 'lucide-react';
import { PORTRAIT_GALLERY, ROLE_PRESETS, pickAutoPortrait } from '../data/seedData';
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

const ARCHETYPE_OPTIONS: Array<{ value: BuildingArchetype; label: string }> = [
  { value: 'observatory_dome', label: 'Observatory Dome' },
  { value: 'ribbed_tower', label: 'Ribbed Engineering Tower' },
  { value: 'octagonal_citadel', label: 'Octagonal Citadel' },
  { value: 'curved_atelier', label: 'Curved Studio Atelier' },
  { value: 'signal_spire', label: 'Signal Spire' },
  { value: 'cantilever_loft', label: 'Cantilever Loft' },
  { value: 'stepped_ziggurat', label: 'Stepped Ziggurat' },
  { value: 'stacked_stage', label: 'Stacked Stage' },
  { value: 'twin_towers', label: 'Twin Towers' },
  { value: 'care_pavilion', label: 'Sentinel Pavilion' },
  { value: 'travel_rotunda', label: 'Focus Rotunda' },
];

const MODEL_OPTIONS = [
  'combo-best',
  '9router / claude-sonnet-4',
  '9router / gemini-2.5-pro',
  '9router / gemini-2.5-flash',
  '9router / gpt-4.1',
  '9router / gpt-4.1-mini',
];

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
          reject(new Error('Canvas unavailable'));
          return;
        }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
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
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<RolePreset>(ROLE_PRESETS[0]);
  const [customName, setCustomName] = useState('');
  const [customBuilding, setCustomBuilding] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [avatarError, setAvatarError] = useState('');

  // Custom Hermes Agent fields
  const [scratchName, setScratchName] = useState('');
  const [scratchRole, setScratchRole] = useState('');
  const [scratchBuilding, setScratchBuilding] = useState('');
  const [scratchModel, setScratchModel] = useState('combo-best');
  const [scratchArch, setScratchArch] = useState<BuildingArchetype>('observatory_dome');
  const [scratchSoul, setScratchSoul] = useState('');
  const [scratchError, setScratchError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const previewSlug =
    (tab === 'presets' ? customName.trim() || selectedPreset.name : scratchName.trim() || 'new-agent')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'agent';

  const autoPortrait =
    tab === 'presets'
      ? selectedPreset.avatarUrl
      : pickAutoPortrait(previewSlug, scratchRole, scratchArch);

  const effectiveAvatar = customAvatar || autoPortrait;

  const resetAndClose = () => {
    setCustomName('');
    setCustomBuilding('');
    setCustomAvatar('');
    setAvatarError('');
    setScratchName('');
    setScratchRole('');
    setScratchBuilding('');
    setScratchSoul('');
    setScratchError('');
    onClose();
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setAvatarError('');
      const dataUrl = await compressImageToPortraitDataUrl(file);
      setCustomAvatar(dataUrl);
    } catch {
      setAvatarError('Could not process photo. Choose a JPG, PNG, or WebP image.');
    }
  };

  const handlePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddFromPreset(selectedPreset, customName, customBuilding, effectiveAvatar);
    resetAndClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = scratchName.trim();
    if (!trimmedName) {
      setScratchError('Enter an agent name (used for the ~/.hermes/profiles/ folder).');
      return;
    }
    setScratchError('');
    onAddCustomAgent({
      name: trimmedName,
      buildingName: scratchBuilding.trim() || `${trimmedName} Tower`,
      role: scratchRole.trim() || 'Hermes Specialist Agent',
      department: 'Custom Profile',
      model: scratchModel,
      archetype: scratchArch,
      soulSummary:
        scratchSoul.trim() ||
        `Autonomous Hermes specialist (${trimmedName}) operating under GALAXY permanent rules.`,
      avatarUrl: effectiveAvatar,
      tools: ['hermes_cli', '9router_proxy', 'tailscale_mesh'],
    });
    resetAndClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-agent-heading"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--nx-border)] px-6 py-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              GALAXY / Agent Roster · {isLiveBridge ? 'Creates ~/.hermes/profiles/' : 'Demo Preview'}
            </p>
            <h2
              id="add-agent-heading"
              className="font-editorial text-2xl mt-0.5 text-[var(--nx-text)]"
            >
              Add a new <span className="italic text-[var(--nx-accent)]">Hermes agent.</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('presets');
                  setCustomAvatar('');
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  tab === 'presets'
                    ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Specialist Presets</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('custom');
                  setCustomAvatar('');
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  tab === 'custom'
                    ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Custom Agent</span>
              </button>
            </div>

            <button
              type="button"
              onClick={resetAndClose}
              aria-label="Close Add Agent dialog"
              className="rounded-lg p-2 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Portrait Preview & Selector Strip (shared across both tabs) */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={effectiveAvatar}
                alt="Agent portrait preview"
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-full object-cover object-top border border-[var(--nx-accent)] shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--nx-text)]">
                  Auto-Assigned Studio Portrait
                </p>
                <p className="text-[11px] font-mono text-[var(--nx-text-muted)] truncate">
                  ~/.hermes/profiles/{previewSlug}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PORTRAIT_GALLERY.map((item) => {
                const active = effectiveAvatar === item.url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCustomAvatar(item.url)}
                    title={item.label}
                    aria-label={`Select ${item.label} portrait`}
                    className={`h-8 w-8 rounded-full overflow-hidden border transition-colors cursor-pointer ${
                      active
                        ? 'border-[var(--nx-accent)] ring-2 ring-[var(--nx-accent)]/40'
                        : 'border-[var(--nx-border-strong)] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top"
                    />
                  </button>
                );
              })}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void handleUploadPhoto(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
              >
                <Upload className="h-3 w-3" />
                <span>Upload</span>
              </button>
            </div>
          </div>
          {avatarError && <p className="text-xs text-[var(--nx-alert)]">{avatarError}</p>}

          {tab === 'presets' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ROLE_PRESETS.map((preset) => {
                  const isPicked = selectedPreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(preset);
                        setCustomAvatar('');
                      }}
                      className={`text-left rounded-lg border p-3.5 transition-colors cursor-pointer ${
                        isPicked
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--nx-text)] truncate">
                              {preset.name}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--nx-text-muted)] shrink-0">
                              {preset.department}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-[var(--nx-accent)] truncate">
                            {preset.buildingName}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--nx-text-muted)] mt-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handlePresetSubmit}
                className="border-t border-[var(--nx-border)] pt-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="hire-agent-name"
                      className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                    >
                      Agent Callsign (optional override)
                    </label>
                    <input
                      id="hire-agent-name"
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder={selectedPreset.name}
                      className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="hire-building-name"
                      className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                    >
                      Tower Name on City Island
                    </label>
                    <input
                      id="hire-building-name"
                      type="text"
                      value={customBuilding}
                      onChange={(e) => setCustomBuilding(e.target.value)}
                      placeholder={selectedPreset.buildingName}
                      className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <p className="text-xs text-[var(--nx-text-muted)]">
                    Constructs{' '}
                    <strong className="text-[var(--nx-text)]">
                      {customBuilding || selectedPreset.buildingName}
                    </strong>{' '}
                    & creates <span className="font-mono text-[var(--nx-text)]">SOUL.md</span> in
                    Hermes.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Construct & Add Agent</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="custom-agent-name"
                    className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                  >
                    Agent Name / Profile Slug *
                  </label>
                  <input
                    id="custom-agent-name"
                    type="text"
                    value={scratchName}
                    onChange={(e) => {
                      setScratchName(e.target.value);
                      if (scratchError) setScratchError('');
                    }}
                    placeholder="e.g. Trader, ResearchBot, DevOps"
                    className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-agent-role"
                    className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                  >
                    Role / Specialty
                  </label>
                  <input
                    id="custom-agent-role"
                    type="text"
                    value={scratchRole}
                    onChange={(e) => setScratchRole(e.target.value)}
                    placeholder="e.g. Quantitative Crypto Analyst"
                    className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-agent-building"
                    className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                  >
                    Tower Name on 3D Island
                  </label>
                  <input
                    id="custom-agent-building"
                    type="text"
                    value={scratchBuilding}
                    onChange={(e) => setScratchBuilding(e.target.value)}
                    placeholder={scratchName.trim() ? `${scratchName.trim()} Tower` : 'Alpha Tower'}
                    className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-agent-arch"
                    className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                  >
                    3D Building Architecture
                  </label>
                  <select
                    id="custom-agent-arch"
                    value={scratchArch}
                    onChange={(e) => setScratchArch(e.target.value as BuildingArchetype)}
                    className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                  >
                    {ARCHETYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="custom-agent-model"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                >
                  Default Model (9Router :20128)
                </label>
                <select
                  id="custom-agent-model"
                  value={scratchModel}
                  onChange={(e) => setScratchModel(e.target.value)}
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
                  htmlFor="custom-agent-soul"
                  className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
                >
                  SOUL.md System Prompt / Operating Instructions
                </label>
                <textarea
                  id="custom-agent-soul"
                  rows={4}
                  value={scratchSoul}
                  onChange={(e) => setScratchSoul(e.target.value)}
                  placeholder="Describe this agent's personality, focus area, and decision boundaries..."
                  className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
              </div>

              {scratchError && <p className="text-xs text-[var(--nx-alert)]">{scratchError}</p>}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--nx-border)]">
                <p className="text-xs text-[var(--nx-text-muted)]">
                  Writes{' '}
                  <span className="font-mono text-[var(--nx-text)]">
                    ~/.hermes/profiles/{previewSlug}/SOUL.md
                  </span>{' '}
                  and adds a 1:1 desk &amp; Floor 2 bed immediately.
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Hermes Agent</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
