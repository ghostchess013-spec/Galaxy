import { useRef, useState } from 'react';
import {
  BedDouble,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  MessageSquare,
  Rocket,
  Sofa,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PORTRAIT_GALLERY } from '../../data/seedData';
import type { Agent, AgentStatus, ThemeId } from '../../types/nexora';
import { compressImageToPortraitDataUrl } from '../AddAgentModal';
import AgentOffice3D, {
  type AgentLiveMood,
  type OfficeCameraPreset,
  type OfficeFloorView,
} from '../AgentOffice3D';

interface AgentCityViewProps {
  agents: Agent[];
  selectedAgentId: string | null;
  theme: ThemeId;
  onSelectAgent: (id: string) => void;
  onUpdateStatus: (agentId: string, status: AgentStatus) => void;
  onUpdateAvatar: (agentId: string, avatarUrl: string) => void;
  onOpenAddAgent: () => void;
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
  onOpenAddAgent,
  onRetireSpecialist,
  onOpenChat,
  onOpenAsk,
}: AgentCityViewProps) {
  const [portraitModalOpen, setPortraitModalOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string>('');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [floorView, setFloorView] = useState<OfficeFloorView>('all');
  const [moods, setMoods] = useState<Record<string, AgentLiveMood>>({});
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<{
    mode: OfficeCameraPreset;
    nonce: number;
  }>({ mode: 'overview', nonce: 0 });

  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) ?? agents.find((a) => a.isHQ) ?? agents[0];

  const workingCount = agents.filter((a) => a.status === 'working').length;
  const idleCount = agents.filter((a) => a.status === 'idle').length;
  const totalSessions = agents.reduce((sum, a) => sum + a.sessionsCount, 0);
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

  const selectedMood = selectedAgent ? moods[selectedAgent.id] : undefined;

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
      {/* Header & 4-KPI Office Telemetry Strip */}
      <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              GALAXY / 3D AI Agent Office · 2 Lantai
            </p>
            <h1 className="font-editorial text-3xl leading-tight mt-0.5 text-[var(--nx-text)]">
              Your office is{' '}
              <span className="italic text-[var(--nx-accent)]">
                {workingCount > 0 ? 'alive.' : 'relaxing.'}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Meja & Kasur (1:1)
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {agents.length}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Working / Santai
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {workingCount}
                <span className="text-sm font-normal text-[var(--nx-text-muted)]"> / {idleCount}</span>
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
                Tokens this month
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {(totalTokens / 1_000_000).toFixed(1)}M
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenAddAgent}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full Unobstructed 2-Floor 3D Office Viewport with Collapsible Bottom Dock */}
      <div className="relative flex-1 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] overflow-hidden">
        <AgentOffice3D
          agents={agents}
          selectedAgentId={selectedAgent?.id ?? null}
          onSelectAgent={onSelectAgent}
          theme={theme}
          floorView={floorView}
          cameraPresetTrigger={cameraPreset}
          onMoodSnapshot={setMoods}
        />

        {/* Collapsible Unified Bottom Control & Inspector Dock (no backdrop-blur over WebGL) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3.5 flex flex-col items-center px-3">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{dockCollapsed ? 'Show Office Controls' : 'Hide Office Controls'}</span>
          </button>

          {!dockCollapsed && selectedAgent && (
            <div className="pointer-events-auto w-full max-w-5xl rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)]/95 px-4 py-3 shadow-2xl space-y-2.5">
              {/* Row 1: Floor View Switcher + Room Camera Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--nx-border)]">
                <div
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-1"
                  role="group"
                  aria-label="Floor view mode"
                >
                  {(
                    [
                      { id: 'all', label: '2 Lantai', icon: Layers },
                      { id: 'floor1', label: 'Lantai 1 · Kantor', icon: Users },
                      { id: 'floor2', label: 'Lantai 2 · Kamar Tidur', icon: BedDouble },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = floorView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFloorView(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                          active
                            ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                            : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCameraPreset((prev) => ({ mode: 'overview', nonce: prev.nonce + 1 }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <Compass className="h-3 w-3" />
                    <span>Overview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFloorView('floor1');
                      setCameraPreset((prev) => ({ mode: 'meeting', nonce: prev.nonce + 1 }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <span>Meeting</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFloorView('floor1');
                      setCameraPreset((prev) => ({ mode: 'lounge', nonce: prev.nonce + 1 }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <Sofa className="h-3 w-3" />
                    <span>Ruang Tamu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFloorView('floor2');
                      setCameraPreset((prev) => ({ mode: 'dorm', nonce: prev.nonce + 1 }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                  >
                    <BedDouble className="h-3 w-3" />
                    <span>Kamar L2</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Selected Agent Identity + Live Thought + Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                        {selectedAgent.name}
                      </span>
                      <span className="text-xs text-[var(--nx-text-muted)]">·</span>
                      <span className="text-xs text-[var(--nx-text-muted)] truncate">
                        {selectedAgent.role}
                      </span>
                      <span className="font-mono text-[10px] rounded bg-[var(--nx-surface)] border border-[var(--nx-border)] px-1.5 py-0.5 text-[var(--nx-text-subtle)]">
                        Lantai {selectedMood?.floor ?? 1}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--nx-text-subtle)] truncate max-w-md">
                      {selectedAgent.status === 'working'
                        ? `💻 ${selectedAgent.currentTask}`
                        : selectedMood?.thought ?? selectedAgent.currentTask}
                    </p>
                  </div>
                </div>

                {/* Live Status Switcher + Chat / Brief / Retire */}
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
