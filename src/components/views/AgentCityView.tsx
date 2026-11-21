import { useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  MessageSquare,
  Plus,
  Rocket,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { PORTRAIT_GALLERY, ROLE_PRESETS } from '../../data/seedData';
import type { Agent, AgentStatus, RolePreset, ThemeId } from '../../types/nexora';
import AgentCity3D from '../AgentCity3D';

function compressImageToPortraitDataUrl(file: File): Promise<string> {
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

interface AgentCityViewProps {
  agents: Agent[];
  selectedAgentId: string | null;
  theme: ThemeId;
  onSelectAgent: (id: string) => void;
  onUpdateStatus: (agentId: string, status: AgentStatus) => void;
  onUpdateAvatar: (agentId: string, avatarUrl: string) => void;
  onHireSpecialist: (
    preset: RolePreset,
    customName?: string,
    customBuilding?: string,
    customAvatarUrl?: string,
  ) => void;
  onRetireSpecialist: (agentId: string) => void;
  onOpenChat: (agentId: string) => void;
  onOpenAsk: () => void;
}

export default function AgentCityView({
  agents,
  selectedAgentId,
  theme,
  onSelectAgent,
  onUpdateStatus,
  onUpdateAvatar,
  onHireSpecialist,
  onRetireSpecialist,
  onOpenChat,
  onOpenAsk,
}: AgentCityViewProps) {
  const [hireModalOpen, setHireModalOpen] = useState(false);
  const [portraitModalOpen, setPortraitModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<RolePreset>(ROLE_PRESETS[0]);
  const [customName, setCustomName] = useState('');
  const [customBuilding, setCustomBuilding] = useState('');
  const [customAvatar, setCustomAvatar] = useState<string>('');
  const [avatarError, setAvatarError] = useState<string>('');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const hireFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<{
    mode: 'overview' | 'focus' | 'top';
    nonce: number;
  }>({ mode: 'overview', nonce: 0 });

  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) ?? agents.find((a) => a.isHQ) ?? agents[0];

  const workingCount = agents.filter((a) => a.status === 'working').length;
  const totalSessions = agents.reduce((sum, a) => sum + a.sessionsCount, 0);
  const avgReply =
    agents.length > 0
      ? (agents.reduce((sum, a) => sum + a.avgReplySec, 0) / agents.length).toFixed(1)
      : '0.0';
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

  const effectiveHireAvatar = customAvatar || selectedPreset.avatarUrl;

  const handleConfirmHire = (e: React.FormEvent) => {
    e.preventDefault();
    onHireSpecialist(selectedPreset, customName, customBuilding, effectiveHireAvatar);
    setCustomName('');
    setCustomBuilding('');
    setCustomAvatar('');
    setAvatarError('');
    setHireModalOpen(false);
  };

  const handleUploadHirePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleUploadSelectedPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedAgent) return;
    try {
      setAvatarError('');
      const dataUrl = await compressImageToPortraitDataUrl(file);
      onUpdateAvatar(selectedAgent.id, dataUrl);
      setPortraitModalOpen(false);
    } catch {
      setAvatarError('Could not process photo. Choose a JPG, PNG, or WebP image.');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] min-h-[640px] gap-4">
      {/* Header & 4-KPI Strip matching NEXORA 3.0 */}
      <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              GALAXY / Agent City
            </p>
            <h1 className="font-editorial text-3xl leading-tight mt-0.5 text-[var(--nx-text)]">
              Your crew is{' '}
              <span className="italic text-[var(--nx-accent)]">
                {workingCount > 0 ? 'working.' : 'at rest.'}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Working right now
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {workingCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Sessions (7d)
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {totalSessions}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Average reply
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {avgReply}s
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Tokens this month
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {(totalTokens / 1_000_000).toFixed(1)}M
              </p>
            </div>

            <button
              type="button"
              onClick={() => setHireModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Hire Specialist</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full Unobstructed 3D Viewport with Collapsible Bottom Dock */}
      <div className="relative flex-1 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] overflow-hidden">
        <AgentCity3D
          agents={agents}
          selectedAgentId={selectedAgent?.id ?? null}
          onSelectAgent={onSelectAgent}
          theme={theme}
          cameraPresetTrigger={cameraPreset}
        />

        {/* Collapsible Unified Bottom Control & Inspector Dock (no backdrop-blur over WebGL) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center px-4">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{dockCollapsed ? 'Show Inspector Dock' : 'Hide Inspector Dock'}</span>
          </button>

          {!dockCollapsed && selectedAgent && (
            <div className="pointer-events-auto w-full max-w-4xl rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)]/95 px-4 py-3 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Selected Tower Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarError('');
                      setPortraitModalOpen(true);
                    }}
                    title="Change agent portrait"
                    aria-label={`Change portrait for ${selectedAgent.name}`}
                    className="group relative h-10 w-10 rounded-full overflow-hidden border border-[var(--nx-border-strong)] hover:border-[var(--nx-accent)] shrink-0 cursor-pointer"
                  >
                    <img
                      src={selectedAgent.avatarUrl}
                      alt={selectedAgent.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top"
                    />
                    <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Camera className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--nx-text)] truncate">
                        {selectedAgent.buildingName}
                      </span>
                      <span className="text-xs text-[var(--nx-text-muted)]">·</span>
                      <span className="text-xs text-[var(--nx-text-muted)] truncate">
                        {selectedAgent.name} ({selectedAgent.profileKey})
                      </span>
                    </div>
                    <p className="text-xs text-[var(--nx-text-subtle)] truncate max-w-md">
                      {selectedAgent.currentTask}
                    </p>
                  </div>
                </div>

                {/* Live Status Switcher + Camera + Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-1"
                    role="group"
                    aria-label={`Set status for ${selectedAgent.name}`}
                  >
                    {(['idle', 'working', 'alert'] as AgentStatus[]).map((st) => {
                      const active = selectedAgent.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => onUpdateStatus(selectedAgent.id, st)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize whitespace-nowrap transition-colors cursor-pointer ${
                            active
                              ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                              : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCameraPreset((prev) => ({ mode: 'overview', nonce: prev.nonce + 1 }))
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Overview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenChat(selectedAgent.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenAsk}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-surface-hover)] px-2.5 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-accent)] hover:text-[var(--nx-accent-fg)] whitespace-nowrap transition-colors cursor-pointer"
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    <span>Brief</span>
                  </button>

                  {!selectedAgent.isHQ && (
                    <button
                      type="button"
                      onClick={() => onRetireSpecialist(selectedAgent.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-alert)]/40 px-2.5 py-1.5 text-xs font-medium text-[var(--nx-alert)] hover:bg-[var(--nx-alert)]/15 whitespace-nowrap transition-colors cursor-pointer"
                      aria-label={`Retire ${selectedAgent.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Retire</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hire Specialist Drawer / Modal — 14 Ready-Made Roles */}
      {hireModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hire-specialist-heading"
        >
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--nx-border)] px-6 py-4">
              <div>
                <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
                  Agent City / Expansion Roster
                </p>
                <h2
                  id="hire-specialist-heading"
                  className="font-editorial text-2xl mt-0.5 text-[var(--nx-text)]"
                >
                  Hire from <span className="italic text-[var(--nx-accent)]">14 specialist roles.</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHireModalOpen(false)}
                aria-label="Close Hire Specialist dialog"
                className="rounded-lg p-2 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
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

              <form onSubmit={handleConfirmHire} className="mt-6 border-t border-[var(--nx-border)] pt-5 space-y-4">
                {/* Auto-Assigned Portrait Preview + Gallery / Upload Override */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={effectiveHireAvatar}
                      alt="Agent portrait preview"
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-full object-cover object-top border border-[var(--nx-accent)] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--nx-text)]">
                        Auto-Assigned Studio Portrait
                      </p>
                      <p className="text-[11px] text-[var(--nx-text-muted)]">
                        Ready immediately — pick another studio portrait or upload your own photo.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PORTRAIT_GALLERY.map((item) => {
                      const active = effectiveHireAvatar === item.url;
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
                      ref={hireFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleUploadHirePhoto(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => hireFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                    >
                      <Upload className="h-3 w-3" />
                      <span>Upload</span>
                    </button>
                  </div>
                </div>
                {avatarError && <p className="text-xs text-[var(--nx-alert)]">{avatarError}</p>}

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

                <div className="flex items-center justify-between gap-4 pt-1">
                  <p className="text-xs text-[var(--nx-text-muted)]">
                    Constructs <strong className="text-[var(--nx-text)]">{customBuilding || selectedPreset.buildingName}</strong> on the island & binds profile tools ({selectedPreset.tools.join(', ')}).
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Construct & Hire</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Quick Portrait Editor Modal for Any Active Agent */}
      {portraitModalOpen && selectedAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portrait-editor-heading"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
                  Agent Portrait · {selectedAgent.profileKey}
                </p>
                <h2 id="portrait-editor-heading" className="font-editorial text-2xl mt-0.5 text-[var(--nx-text)]">
                  Update <span className="italic text-[var(--nx-accent)]">{selectedAgent.name}.</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPortraitModalOpen(false)}
                aria-label="Close portrait dialog"
                className="rounded-lg p-1.5 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {PORTRAIT_GALLERY.map((item) => {
                const active = selectedAgent.avatarUrl === item.url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onUpdateAvatar(selectedAgent.id, item.url);
                      setPortraitModalOpen(false);
                    }}
                    className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)]'
                        : 'border-[var(--nx-border)] bg-[var(--nx-surface)] hover:border-[var(--nx-border-strong)]'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-full object-cover object-top border border-[var(--nx-border-strong)]"
                    />
                    <span className="text-[11px] font-medium text-[var(--nx-text-muted)] group-hover:text-[var(--nx-text)]">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--nx-border)]">
              <span className="text-[11px] text-[var(--nx-text-muted)]">
                Saved to ~/.hermes/ metadata when Live
              </span>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void handleUploadSelectedPhoto(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Custom Photo</span>
              </button>
            </div>
            {avatarError && <p className="text-xs text-[var(--nx-alert)]">{avatarError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
