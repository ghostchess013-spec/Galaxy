import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
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
import { useI18n } from '../../i18n/translations';
import type { Agent, AgentStatus, ChatMessage, ThemeId } from '../../types/nexora';
import { compressImageToPortraitDataUrl } from '../AddAgentModal';
import AgentOffice3D, {
  type AgentLiveMood,
  type OfficeCameraPreset,
  type OfficeFloorView,
} from '../AgentOffice3D';

interface InOfficeChatPanelProps {
  agents: Agent[];
  selectedAgent: Agent;
  selectedMood?: AgentLiveMood;
  thread: ChatMessage[];
  isSending: boolean;
  onSelectAgent: (id: string) => void;
  onSendMessage: (agentId: string, content: string, attachmentName?: string) => void;
  onClearThread: (agentId: string) => void;
  onOpenFullChat: (agentId: string) => void;
  onClose: () => void;
}

const ChatMessageRow = memo(function ChatMessageRow({
  msg,
  agentName,
}: {
  msg: ChatMessage;
  agentName: string;
}) {
  const { t, chatMessageDisplay } = useI18n();
  return (
    <div
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
            {t('commonAttachment')}: {msg.attachmentName}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">
          {chatMessageDisplay(msg.id, msg.content)}
        </p>
        {msg.toolTrace && msg.toolTrace.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-[var(--nx-border)] text-[10px] font-mono text-[var(--nx-text-muted)]">
            {msg.toolTrace.join(' · ')}
          </div>
        )}
      </div>
      <span className="mt-1 text-[10px] font-mono text-[var(--nx-text-subtle)]">
        {msg.sender === 'operator' ? t('operatorRole') : agentName} · {msg.timestamp}
        {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ''}
      </span>
    </div>
  );
});

/**
 * Isolated memoized chat panel so keystrokes and incoming messages never trigger
 * re-renders or layout reflows inside the adjacent 3D WebGL office canvas.
 */
const InOfficeChatPanel = memo(function InOfficeChatPanel({
  agents,
  selectedAgent,
  selectedMood,
  thread,
  isSending,
  onSelectAgent,
  onSendMessage,
  onClearThread,
  onOpenFullChat,
  onClose,
}: InOfficeChatPanelProps) {
  const { t, statusLabel } = useI18n();
  const [chatDraft, setChatDraft] = useState('');
  const [chatAttachment, setChatAttachment] = useState<string | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Defer scroll adjustment to next animation frame (never forces synchronous layout on Send)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const scroller = scrollContainerRef.current;
      if (!scroller) return;
      scroller.scrollTop = scroller.scrollHeight;
    });
    return () => window.cancelAnimationFrame(id);
  }, [thread.length, isSending, selectedAgent.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim() || isSending) return;
    onSendMessage(selectedAgent.id, chatDraft, chatAttachment ?? undefined);
    setChatDraft('');
    setChatAttachment(null);
  };

  const floorPrefix = t('commonFloorShort');

  return (
    <aside
      aria-label={t('officeChatPanelAria')}
      className="w-full lg:w-[370px] xl:w-[400px] shrink-0 h-[460px] lg:h-auto rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] flex flex-col overflow-hidden [contain:strict]"
    >
      {/* Quick Agent Switcher Strip */}
      <div className="border-b border-[var(--nx-border)] px-3 py-2.5 bg-[var(--nx-surface)]/55">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] tracking-[0.14em] uppercase font-semibold text-[var(--nx-text-muted)]">
            {t('officeChatHeader', { count: agents.length })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenFullChat(selectedAgent.id)}
              title={t('officeChatOpenFull')}
              aria-label={t('officeChatOpenFull')}
              className="rounded-md p-1 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title={t('officeChatHideTitle')}
              aria-label={t('officeChatHideTitle')}
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
                {statusLabel(selectedAgent.status)} · {floorPrefix}
                {selectedAgent.status === 'working' ? 1 : selectedMood?.floor ?? 1}
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
          title={t('officeChatClearTitle')}
          aria-label={t('officeChatClearAria', { name: selectedAgent.name })}
          className="rounded-lg border border-[var(--nx-border)] p-1.5 text-[var(--nx-text-muted)] hover:text-[var(--nx-alert)] hover:border-[var(--nx-alert)]/40 cursor-pointer shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages Stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 [contain:layout_style]"
      >
        {thread.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 py-8">
            <img
              src={selectedAgent.avatarUrl}
              alt={selectedAgent.name}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-full object-cover object-top border border-[var(--nx-border-strong)] mb-3"
            />
            <p className="font-editorial text-xl text-[var(--nx-text)]">
              {t('officeChatEmptyTitle')}{' '}
              <span className="italic text-[var(--nx-accent)]">{selectedAgent.name}.</span>
            </p>
            <p className="mt-1.5 text-xs text-[var(--nx-text-muted)] leading-relaxed">
              {t('officeChatEmptyDesc', { name: selectedAgent.name })}
            </p>
          </div>
        ) : (
          thread.map((msg) => (
            <ChatMessageRow key={msg.id} msg={msg} agentName={selectedAgent.name} />
          ))
        )}

        {isSending && (
          <div className="flex flex-col items-start">
            <div className="rounded-xl px-3.5 py-2.5 text-[11px] font-mono border border-[var(--nx-accent)]/40 bg-[var(--nx-accent-soft)] text-[var(--nx-text)]">
              {t('officeChatWorkingBubble', { name: selectedAgent.name })}
            </div>
          </div>
        )}
      </div>

      {/* Live Chat Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--nx-border)] p-3 bg-[var(--nx-bg-elevated)]"
      >
        {chatAttachment && (
          <div className="mb-2 flex items-center justify-between rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-2.5 py-1 text-[11px] text-[var(--nx-text-muted)]">
            <span className="font-mono truncate">
              {t('commonAttached')}: {chatAttachment}
            </span>
            <button
              type="button"
              onClick={() => setChatAttachment(null)}
              aria-label={t('commonRemoveAttachment')}
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
            aria-label={t('commonAttachFile')}
            className="rounded-lg border border-[var(--nx-border-strong)] p-2 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer shrink-0"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>

          <label htmlFor="office-live-chat-input" className="sr-only">
            {t('officeChatInputAria', { name: selectedAgent.name })}
          </label>
          <input
            id="office-live-chat-input"
            type="text"
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder={t('officeChatInputPlaceholder', { name: selectedAgent.name })}
            className="flex-1 min-w-0 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-[16px] sm:text-xs text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
          />
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            disabled={!chatDraft.trim() || isSending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] disabled:opacity-50 whitespace-nowrap cursor-pointer shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{t('commonSend')}</span>
          </button>
        </div>
      </form>
    </aside>
  );
});

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

const AgentCityView = memo(function AgentCityView({
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
  const { t, statusLabel, agentDisplay, portraitLabel } = useI18n();
  const [portraitModalOpen, setPortraitModalOpen] = useState(false);
  const [deleteConfirmAgent, setDeleteConfirmAgent] = useState<Agent | null>(null);
  const [avatarError, setAvatarError] = useState<string>('');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
  const [chatDrawerOpen, setChatDrawerOpen] = useState(true);
  const [floorView, setFloorView] = useState<OfficeFloorView>('all');
  const [selectedMood, setSelectedMood] = useState<AgentLiveMood | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<{
    mode: OfficeCameraPreset;
    nonce: number;
  }>({ mode: 'overview', nonce: 0 });

  useEffect(() => {
    if (!deleteConfirmAgent) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDeleteConfirmAgent(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirmAgent]);

  const handleCloseChat = useCallback(() => {
    setChatDrawerOpen(false);
  }, []);

  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) ?? agents.find((a) => a.isHQ) ?? agents[0];
  const selectedDisp = selectedAgent ? agentDisplay(selectedAgent) : null;

  const workingCount = agents.filter((a) => a.status === 'working').length;
  const idleCount = agents.filter((a) => a.status === 'idle').length;
  const totalSessions = agents.reduce((sum, a) => sum + a.sessionsCount, 0);
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

  const activeThread = selectedAgent ? chats[selectedAgent.id] ?? [] : [];
  const isSendingToSelected = Boolean(selectedAgent && sendingAgentId === selectedAgent.id);

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
      setAvatarError(t('officePortraitError'));
    }
  };

  const floorPrefix = t('commonFloorShort');

  return (
    <div className="flex flex-col lg:h-[calc(100vh-5.5rem)] lg:min-h-[640px] gap-4">
      {/* Header & 4-KPI Office Telemetry Strip */}
      <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[230px] sm:min-w-[295px]">
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              {t('officeEyebrow')}
            </p>
            <h1 className="font-editorial text-2xl sm:text-3xl leading-tight mt-0.5 text-[var(--nx-text)] whitespace-nowrap">
              {t('officeTitle')}{' '}
              <span className="italic text-[var(--nx-accent)]">
                {workingCount > 0 ? t('officeTitleAlive') : t('officeTitleRelaxing')}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                {t('officeKpiDesksBeds')}
              </p>
              <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {agents.length}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                {t('officeKpiWorkingIdle')}
              </p>
              <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {workingCount}
                <span className="text-sm font-normal text-[var(--nx-text-muted)]">
                  {' '}
                  / {idleCount}
                </span>
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                {t('officeKpiSessions7d')}
              </p>
              <p className="font-mono text-xl sm:text-2xl font-semibold text-[var(--nx-text)] tabular-nums">
                {totalSessions}
              </p>
            </div>
            <div className="hidden xl:block">
              <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                {t('officeKpiTokensMonth')}
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
                <span>{chatDrawerOpen ? t('officeHideChat') : t('officeLiveChat')}</span>
              </button>

              <button
                type="button"
                onClick={onOpenAddAgent}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>{t('cockpitAddAgentBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: 3D AI Agent Office + Docked Side-by-Side Live Chat */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
        {/* Left: Full 2-Floor 3D Office Viewport with strict GPU layer containment */}
        <div className="relative shrink-0 h-[340px] sm:h-[420px] lg:shrink lg:flex-1 lg:min-w-0 lg:h-auto lg:min-h-0 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] overflow-hidden [contain:strict] [transform:translateZ(0)]">
          <AgentOffice3D
            agents={agents}
            selectedAgentId={selectedAgent?.id ?? null}
            onSelectAgent={onSelectAgent}
            theme={theme}
            floorView={floorView}
            cameraPresetTrigger={cameraPreset}
            onSelectedMoodChange={setSelectedMood}
          />

          {/* Collapsible Unified Bottom Control & Inspector Dock */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center px-3">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              {dockCollapsed ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span>{dockCollapsed ? t('officeShowControls') : t('officeHideControls')}</span>
            </button>

            {!dockCollapsed && selectedAgent && selectedDisp && (
              <div className="pointer-events-auto w-full max-w-4xl rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)]/95 px-3.5 py-2.5 shadow-2xl space-y-2">
                {/* Row 1: Floor View Switcher + Room Camera Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--nx-border)]">
                  <div
                    className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-1"
                    role="group"
                    aria-label={t('officeFloorAria')}
                  >
                    {(
                      [
                        {
                          id: 'all',
                          label: t('officeFloorAll'),
                          shortLabel: t('officeFloorAllShort'),
                          icon: Layers,
                        },
                        {
                          id: 'floor1',
                          label: t('officeFloor1'),
                          shortLabel: t('officeFloor1Short'),
                          icon: Users,
                        },
                        {
                          id: 'floor2',
                          label: t('officeFloor2'),
                          shortLabel: t('officeFloor2Short'),
                          icon: BedDouble,
                        },
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
                      <span>{t('officeCamOverview')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCameraPreset((prev) => ({ mode: 'focus', nonce: prev.nonce + 1 }))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                    >
                      <Crosshair className="h-3 w-3" />
                      <span>{t('officeCamFocus')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFloorView('floor1');
                        setCameraPreset((prev) => ({ mode: 'meeting', nonce: prev.nonce + 1 }));
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] px-2 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
                    >
                      <span>{t('officeCamMeeting')}</span>
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
                      <span>{t('officeCamLounge')}</span>
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
                      <span>{t('officeCamDorm')}</span>
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
                      title={t('officeChangePortraitTitle')}
                      aria-label={t('officeChangePortraitAria', { name: selectedAgent.name })}
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
                          {selectedDisp.role}
                        </span>
                        <span className="font-mono text-[10px] rounded bg-[var(--nx-surface)] border border-[var(--nx-border)] px-1.5 py-0.5 text-[var(--nx-text-subtle)]">
                          {floorPrefix}
                          {selectedMood?.floor ?? 1}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--nx-text-subtle)] truncate max-w-xs xl:max-w-md">
                        {selectedAgent.status === 'working'
                          ? `💻 ${selectedDisp.task}`
                          : selectedMood?.thought ?? selectedDisp.task}
                      </p>
                    </div>
                  </div>

                  {/* Live Status Switcher + Chat / Brief / Delete */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div
                      className="flex items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-0.5"
                      role="group"
                      aria-label={t('officeSetStatusAria', { name: selectedAgent.name })}
                    >
                      {(['idle', 'working', 'alert'] as AgentStatus[]).map((st) => {
                        const active = selectedAgent.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => onUpdateStatus(selectedAgent.id, st)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                              active
                                ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                                : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                            }`}
                          >
                            {statusLabel(st)}
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
                      <span>{t('officeBtnChat')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenAsk}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-surface-hover)] px-2.5 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-accent)] hover:text-[var(--nx-accent-fg)] whitespace-nowrap transition-colors cursor-pointer"
                    >
                      <Rocket className="h-3.5 w-3.5" />
                      <span>{t('officeBtnBrief')}</span>
                    </button>

                    {!selectedAgent.isHQ && selectedAgent.profileKey !== 'vps-guardian' && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmAgent(selectedAgent)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--nx-alert)]/40 px-2 py-1.5 text-xs font-medium text-[var(--nx-alert)] hover:bg-[var(--nx-alert)]/15 whitespace-nowrap transition-colors cursor-pointer"
                        aria-label={t('officeDeleteAgentAria', { name: selectedAgent.name })}
                        title={t('officeDeleteAgentAria', { name: selectedAgent.name })}
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

        {/* Right: Isolated Memoized Live Chat Panel */}
        {chatDrawerOpen && selectedAgent && (
          <InOfficeChatPanel
            agents={agents}
            selectedAgent={selectedAgent}
            selectedMood={selectedMood ?? undefined}
            thread={activeThread}
            isSending={isSendingToSelected}
            onSelectAgent={onSelectAgent}
            onSendMessage={onSendMessage}
            onClearThread={onClearThread}
            onOpenFullChat={onOpenChat}
            onClose={handleCloseChat}
          />
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
                  {t('officePortraitEyebrow', { profile: selectedAgent.profileKey })}
                </p>
                <h2
                  id="portrait-editor-heading"
                  className="font-editorial text-2xl mt-0.5 text-[var(--nx-text)]"
                >
                  {t('officePortraitTitle')}{' '}
                  <span className="italic text-[var(--nx-accent)]">{selectedAgent.name}.</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPortraitModalOpen(false)}
                aria-label={t('officePortraitCloseAria')}
                className="rounded-lg p-1.5 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {PORTRAIT_GALLERY.map((item) => {
                const active = selectedAgent.avatarUrl === item.url;
                const lbl = portraitLabel(item.id, item.label);
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
                      alt={lbl}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-full object-cover object-top border border-[var(--nx-border-strong)]"
                    />
                    <span className="text-[11px] font-medium text-[var(--nx-text-muted)] group-hover:text-[var(--nx-text)]">
                      {lbl}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--nx-border)]">
              <span className="text-[11px] text-[var(--nx-text-muted)]">
                {t('officePortraitHint')}
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
                <span>{t('officePortraitUploadBtn')}</span>
              </button>
            </div>
            {avatarError && <p className="text-xs text-[var(--nx-alert)]">{avatarError}</p>}
          </div>
        </div>
      )}

      {/* Approval Confirmation Dialog Before Deleting an Agent */}
      {deleteConfirmAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-agent-confirm-title"
          aria-describedby="delete-agent-confirm-desc"
          onClick={() => setDeleteConfirmAgent(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--nx-alert)]/40 bg-[var(--nx-bg-elevated)] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--nx-alert)]/40 bg-[var(--nx-alert)]/12 text-[var(--nx-alert)]">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-alert)] font-semibold">
                    {t('officeDeleteEyebrow')}
                  </p>
                  <h2
                    id="delete-agent-confirm-title"
                    className="font-editorial text-2xl mt-0.5 text-[var(--nx-text)]"
                  >
                    {t('officeDeleteTitle')}{' '}
                    <span className="italic text-[var(--nx-alert)]">
                      {deleteConfirmAgent.name}?
                    </span>
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmAgent(null)}
                aria-label={t('officeDeleteCloseAria')}
                className="rounded-lg p-1.5 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-3">
              <img
                src={deleteConfirmAgent.avatarUrl}
                alt={deleteConfirmAgent.name}
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-full object-cover object-top border border-[var(--nx-border-strong)] shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--nx-text)] truncate">
                  {deleteConfirmAgent.name}
                </p>
                <p className="text-xs text-[var(--nx-text-muted)] truncate">
                  {agentDisplay(deleteConfirmAgent).role}
                </p>
                <p className="font-mono text-[10px] text-[var(--nx-text-subtle)] truncate mt-0.5">
                  ~/.hermes/profiles/{deleteConfirmAgent.profileKey}
                </p>
              </div>
            </div>

            <p
              id="delete-agent-confirm-desc"
              className="text-xs leading-relaxed text-[var(--nx-text-muted)]"
            >
              {t('officeDeleteDesc')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--nx-border)]">
              <button
                type="button"
                onClick={() => setDeleteConfirmAgent(null)}
                className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-4 py-2 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] transition-colors cursor-pointer"
              >
                {t('commonCancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = deleteConfirmAgent.id;
                  setDeleteConfirmAgent(null);
                  onRetireSpecialist(targetId);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-alert)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('officeDeleteConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AgentCityView;
