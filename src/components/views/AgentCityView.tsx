import { useEffect, useRef, useState } from 'react';
import {
  BedDouble,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  Maximize2,
  MessageSquare,
  Paperclip,
  Rocket,
  Send,
  Sofa,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PORTRAIT_GALLERY } from '../../data/seedData';
import type { Agent, AgentStatus, ChatMessage, ThemeId } from '../../types/nexora';
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
  chats: Record<string, ChatMessage[]>;
  sendingAgentId?: string | null;
  onSelectAgent: (id: string) => void;
  onUpdateStatus: (agentId: string, status: AgentStatus) => void;
  onUpdateAvatar: (agentId: string, avatarUrl: string) => void;
  onOpenAddAgent: () => void;
  onRetireSpecialist: (agentId: string) => void;
  onOpenChat: (agentId: string) => void;
  onSendMessage: (agentId: string, content: string, attachmentName?: string) => void;
  onClearThread: (agentId: string) => void;
  onOpenAsk: () => void;
}

export default function AgentCityView({
  agents,
  selectedAgentId,
  theme,
  chats,
  sendingAgentId,
  onSelectAgent,
  onUpdateStatus,
  onUpdateAvatar,
  onOpenAddAgent,
  onRetireSpecialist,
  onOpenChat,
  onSendMessage,
  onClearThread,
  onOpenAsk,
}: AgentCityViewProps) {
  const [portraitModalOpen, setPortraitModalOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string>('');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
  const [chatDrawerOpen, setChatDrawerOpen] = useState(true);
  const [chatDraft, setChatDraft] = useState('');
  const [chatAttachment, setChatAttachment] = useState<string | null>(null);
  const [floorView, setFloorView] = useState<OfficeFloorView>('all');
  const [moods, setMoods] = useState<Record<string, AgentLiveMood>>({});
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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
  const activeThread = selectedAgent ? chats[selectedAgent.id] ?? [] : [];
  const isSendingToSelected = Boolean(selectedAgent && sendingAgentId === selectedAgent.id);

  // Auto-scroll in-office chat to latest message
  useEffect(() => {
    if (!chatDrawerOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread.length, isSendingToSelected, selectedAgent?.id, chatDrawerOpen]);

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

  const handleInOfficeChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !chatDraft.trim()) return;
    onSendMessage(selectedAgent.id, chatDraft, chatAttachment ?? undefined);
    setChatDraft('');
    setChatAttachment(null);
  };

  return (
    <div className="flex flex-col lg:h-[calc(100vh-5.5rem)] lg:min-h-[640px] gap-4">
      {/* Header & 4-KPI Office Telemetry Strip */}
      <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              GALAXY / 3D AI Agent Office · 2 Lantai
            </p>
            <h1 className="font-editorial text-2xl sm:text-3xl leading-tight mt-0.5 text-[var(--nx-text)]">
              Your office is{' '}
              <span className="italic text-[var(--nx-accent)]">
                {workingCount > 0 ? 'alive.' : 'relaxing.'}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Meja & Kasur (1:1)
              </p>
              <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {agents.length}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Working / Santai
              </p>
              <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {workingCount}
                <span className="text-sm font-normal text-[var(--nx-text-muted)]"> / {idleCount}</span>
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Sessions (7d)
              </p>
              <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {totalSessions}
              </p>
            </div>
            <div className="hidden xl:block">
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                Tokens this month
              </p>
              <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {(totalTokens / 1_000_000).toFixed(1)}M
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChatDrawerOpen((v) => !v)}
                aria-pressed={chatDrawerOpen}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  chatDrawerOpen
                    ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)] text-[var(--nx-accent)]'
                    : 'border-[var(--nx-border-strong)] bg-[var(--nx-surface)] text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)]'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>{chatDrawerOpen ? 'Hide Chat' : 'Live Chat'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenAddAgent}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Agent</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: 3D AI Agent Office + Docked Side-by-Side Live Chat */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
        {/* Left: Full 2-Floor 3D Office Viewport with Collapsible Bottom Dock */}
        <div className="relative flex-1 min-w-0 h-[360px] sm:h-[440px] lg:h-auto lg:min-h-0 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] overflow-hidden">
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
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center px-3">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              {dockCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>{dockCollapsed ? 'Show Office Controls' : 'Hide Office Controls'}</span>
            </button>

            {!dockCollapsed && selectedAgent && (
              <div className="pointer-events-auto w-full max-w-4xl rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)]/95 px-3.5 py-2.5 shadow-2xl space-y-2">
                {/* Row 1: Floor View Switcher + Room Camera Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--nx-border)]">
                <div
                  className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-1"
                  role="group"
                  aria-label="Floor view mode"
                >
                  {(
                    [
                      { id: 'all', label: '2 Lantai', shortLabel: '2 Lantai', icon: Layers },
                      { id: 'floor1', label: 'Lantai 1 · Kantor', shortLabel: 'L1 Kantor', icon: Users },
                      { id: 'floor2', label: 'Lantai 2 · Kamar Tidur', shortLabel: 'L2 Kamar', icon: BedDouble },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = floorView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFloorView(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                          active
                            ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                            : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{item.label}</span>
                        <span className="sm:hidden">{item.shortLabel}</span>
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                    >
                      <span>Meeting</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFloorView('floor1');
                        setCameraPreset((prev) => ({ mode: 'lounge', nonce: prev.nonce + 1 }));
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                    >
                      <BedDouble className="h-3 w-3" />
                      <span>Kamar L2</span>
                    </button>
                  </div>
                </div>

                {/* Row 2: Selected Agent Identity + Live Thought + Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarError('');
                        setPortraitModalOpen(true);
                      }}
                      title="Change agent portrait"
                      aria-label={`Change portrait for ${selectedAgent.name}`}
                      className="group relative h-9 w-9 rounded-full overflow-hidden border border-[var(--nx-border-strong)] hover:border-[var(--nx-accent)] shrink-0 cursor-pointer"
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[var(--nx-text)] truncate">
                          {selectedAgent.name}
                        </span>
                        <span className="text-xs text-[var(--nx-text-muted)]">·</span>
                        <span className="text-xs text-[var(--nx-text-muted)] truncate">
                          {selectedAgent.role}
                        </span>
                        <span className="font-mono text-[10px] rounded bg-[var(--nx-surface)] border border-[var(--nx-border)] px-1.5 py-0.5 text-[var(--nx-text-subtle)]">
                          L{selectedMood?.floor ?? 1}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--nx-text-subtle)] truncate max-w-xs xl:max-w-md">
                        {selectedAgent.status === 'working'
                          ? `💻 ${selectedAgent.currentTask}`
                          : selectedMood?.thought ?? selectedAgent.currentTask}
                      </p>
                    </div>
                  </div>

                  {/* Live Status Switcher + Chat / Brief / Retire */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div
                      className="flex items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-0.5"
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
                            className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize whitespace-nowrap transition-colors cursor-pointer ${
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
                      onClick={() => setChatDrawerOpen(true)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                        chatDrawerOpen
                          ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)] text-[var(--nx-accent)]'
                          : 'border-[var(--nx-border-strong)] text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)]'
                      }`}
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
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-alert)]/40 px-2 py-1.5 text-xs font-medium text-[var(--nx-alert)] hover:bg-[var(--nx-alert)]/15 whitespace-nowrap transition-colors cursor-pointer"
                        aria-label={`Retire ${selectedAgent.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Docked In-Office Live Chat Panel (watch agents walk & work while chatting) */}
        {chatDrawerOpen && selectedAgent && (
          <aside
            aria-label="In-Office Live Chat"
            className="w-full lg:w-[370px] xl:w-[400px] shrink-0 h-[460px] lg:h-auto rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] flex flex-col overflow-hidden"
          >
            {/* Quick Agent Switcher Strip */}
            <div className="border-b border-[var(--nx-border)] px-3 py-2.5 bg-[var(--nx-surface)]/55">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] tracking-[0.14em] uppercase font-semibold text-[var(--nx-text-muted)]">
                  Live Office Chat · {agents.length} Agents
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenChat(selectedAgent.id)}
                    title="Open full-screen Chat view"
                    aria-label="Open full-screen Chat view"
                    className="rounded-md p-1 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatDrawerOpen(false)}
                    title="Hide in-office chat"
                    aria-label="Hide in-office chat"
                    className="rounded-md p-1 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {agents.map((agent) => {
                  const isActive = agent.id === selectedAgent.id;
                  const statusColor =
                    agent.status === 'working'
                      ? '#F95C19'
                      : agent.status === 'alert'
                        ? '#EF4444'
                        : '#22C55E';
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => onSelectAgent(agent.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                        isActive
                          ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)] text-[var(--nx-accent)]'
                          : 'border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:border-[var(--nx-border-strong)]'
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: statusColor }}
                        aria-hidden="true"
                      />
                      <span>{agent.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Agent Chat Header */}
            <div className="px-4 py-3 border-b border-[var(--nx-border)] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={selectedAgent.avatarUrl}
                  alt={selectedAgent.name}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover object-top border border-[var(--nx-border-strong)] shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs font-semibold text-[var(--nx-text)] truncate">
                      {selectedAgent.name}
                    </h2>
                    <span className="font-mono text-[10px] rounded bg-[var(--nx-surface)] border border-[var(--nx-border)] px-1.5 py-0.5 text-[var(--nx-text-muted)] shrink-0">
                      {selectedAgent.status === 'working'
                        ? 'Working · L1'
                        : `Santai · L${selectedMood?.floor ?? 1}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--nx-text-subtle)] truncate">
                    {selectedAgent.model} · {selectedAgent.profileKey}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClearThread(selectedAgent.id)}
                title="Forget thread"
                aria-label={`Clear chat thread with ${selectedAgent.name}`}
                className="rounded-lg border border-[var(--nx-border)] p-1.5 text-[var(--nx-text-muted)] hover:text-[var(--nx-alert)] hover:border-[var(--nx-alert)]/40 cursor-pointer shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3">
              {activeThread.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-3 py-8">
                  <img
                    src={selectedAgent.avatarUrl}
                    alt={selectedAgent.name}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full object-cover object-top border border-[var(--nx-border-strong)] mb-3"
                  />
                  <p className="font-editorial text-xl text-[var(--nx-text)]">
                    Chat langsung dengan{' '}
                    <span className="italic text-[var(--nx-accent)]">{selectedAgent.name}.</span>
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--nx-text-muted)] leading-relaxed">
                    Kirim pesan di sini — jika sedang santai atau tidur di Lantai 2,{' '}
                    {selectedAgent.name} akan langsung menuju meja kerjanya untuk mengerjakan tugas Anda.
                  </p>
                </div>
              ) : (
                activeThread.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'operator' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed border ${
                        msg.sender === 'operator'
                          ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)] border-transparent'
                          : 'bg-[var(--nx-surface)] text-[var(--nx-text)] border-[var(--nx-border)]'
                      }`}
                    >
                      {msg.attachmentName && (
                        <p className="text-[10px] font-mono opacity-85 mb-1">
                          Attachment: {msg.attachmentName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.toolTrace && msg.toolTrace.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-[var(--nx-border)] text-[10px] font-mono text-[var(--nx-text-muted)]">
                          {msg.toolTrace.join(' · ')}
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[10px] font-mono text-[var(--nx-text-subtle)]">
                      {msg.sender === 'operator' ? 'Operator' : selectedAgent.name} · {msg.timestamp}
                      {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ''}
                    </span>
                  </div>
                ))
              )}

              {isSendingToSelected && (
                <div className="flex flex-col items-start">
                  <div className="rounded-xl px-3.5 py-2.5 text-[11px] font-mono border border-[var(--nx-accent)]/40 bg-[var(--nx-accent-soft)] text-[var(--nx-text)]">
                    💻 {selectedAgent.name} sedang bekerja di meja & menyiapkan balasan...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Live Chat Composer */}
            <form
              onSubmit={handleInOfficeChatSubmit}
              className="border-t border-[var(--nx-border)] p-3 bg-[var(--nx-bg-elevated)]"
            >
              {chatAttachment && (
                <div className="mb-2 flex items-center justify-between rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-2.5 py-1 text-[11px] text-[var(--nx-text-muted)]">
                  <span className="font-mono truncate">Attached: {chatAttachment}</span>
                  <button
                    type="button"
                    onClick={() => setChatAttachment(null)}
                    aria-label="Remove attachment"
                    className="p-0.5 hover:text-[var(--nx-text)] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <input
                  ref={chatFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setChatAttachment(f.name);
                  }}
                />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  aria-label="Attach file to office chat"
                  className="rounded-lg border border-[var(--nx-border-strong)] p-2 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer shrink-0"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>

                <label htmlFor="office-live-chat-input" className="sr-only">
                  Chat langsung dengan {selectedAgent.name}
                </label>
                <input
                  id="office-live-chat-input"
                  type="text"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder={`Chat dengan ${selectedAgent.name}...`}
                  className="flex-1 min-w-0 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatDraft.trim() || isSendingToSelected}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] disabled:opacity-50 whitespace-nowrap cursor-pointer shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </aside>
        )}
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
