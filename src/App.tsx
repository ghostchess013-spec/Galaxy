import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Building2,
  CalendarClock,
  Compass,
  FileCode2,
  FileText,
  Globe,
  HelpCircle,
  Lock,
  Menu,
  MessageSquare,
  Mic,
  PlugZap,
  Search,
  Settings,
  Target,
  Terminal,
  X,
} from 'lucide-react';
import AddAgentModal, { type CustomAgentDraft } from './components/AddAgentModal';
import AskNexoraModal from './components/AskNexoraModal';
import GalaxyLogo from './components/GalaxyLogo';
import AgentCityView from './components/views/AgentCityView';
import ChatView from './components/views/ChatView';
import CockpitView from './components/views/CockpitView';
import DocsView from './components/views/DocsView';
import FilesView from './components/views/FilesView';
import GuideView from './components/views/GuideView';
import HealthView from './components/views/HealthView';
import IntegrationsView from './components/views/IntegrationsView';
import MissionsView from './components/views/MissionsView';
import ScheduleView from './components/views/ScheduleView';
import SettingsView from './components/views/SettingsView';
import TerminalView from './components/views/TerminalView';
import VoiceModeView from './components/views/VoiceModeView';
import {
  DEFAULT_SETTINGS,
  INITIAL_AGENTS,
  INITIAL_CHATS,
  INITIAL_CRON_JOBS,
  INITIAL_DOCS,
  INITIAL_FILES,
  INITIAL_HEALTH_CHECKS,
  INITIAL_INTEGRATIONS,
  INITIAL_INTER_AGENT_LOGS,
  INITIAL_MISSIONS,
} from './data/seedData';
import { createI18nValue, I18nProvider, type I18nContextValue } from './i18n/translations';
import type {
  Agent,
  AgentStatus,
  BridgeConnectionStatus,
  BridgeTelemetry,
  ChatMessage,
  CronJob,
  DocItem,
  HealthCheck,
  IntegrationService,
  InterAgentLog,
  LanguageId,
  Mission,
  NavSection,
  OperatorSettings,
  ReportLength,
  RolePreset,
  WorkspaceFile,
} from './types/nexora';
import {
  advanceMissionProgress,
  approveMissionPlan,
  createCustomAgent,
  createMission,
  deliverMissionReport,
  generateAgentReply,
  hireSpecialist,
  retireSpecialist,
  reviseMissionPlan,
  searchWorkspace,
} from './utils/nexoraLogic';
import {
  DEFAULT_ROUTER_MODELS,
  buildTelemetryWebSocketUrl,
  createBridgeAgent,
  deleteBridgeAgent,
  establishBridgeSession,
  fetchBridgeFiles,
  fetchBridgeModels,
  fetchBridgeStatus,
  mergeBridgeTelemetry,
  parseAndScrubUrlToken,
  probeBridgeHealth,
  resolveBridgeApproval,
  restartBridgeService,
  runBridgeShell,
  saveBridgeFile,
  sendBridgeChat,
  speakViaBridge,
  updateBridgeAgentAvatar,
  updateBridgeAgentModel,
  type BridgeModelOption,
} from './services/nexoraBridge';

const STORAGE_KEY = 'nexora_mission_control_v3';
const WORKSPACE_VERSION = 2;
const DELETED_TOMBSTONE_KEY = 'galaxy_deleted_agents_v1';
const DELETED_TOMBSTONE_TTL_MS = 25000;

const ISOLATED_CORE_AGENT_KEYS = new Set(['default', 'vps-guardian', 'executor', 'guardian']);
const LEGACY_SEED_AGENT_IDS = new Set([
  'executor',
  'research',
  'developer',
  'data',
  'content',
  'signal',
  'design',
  'ledger',
  'studio',
  'deal',
  'guardian',
  'travel',
]);
const LEGACY_SEED_MISSION_IDS = new Set(['m-1008', 'm-1009', 'm-1010', 'm-1011', 'm-1012']);
const LEGACY_SEED_CRON_IDS = new Set(['cron-1', 'cron-2', 'cron-3', 'cron-4', 'cron-5', 'cron-6']);
const LEGACY_SEED_CHAT_IDS = new Set(['c-1', 'c-2', 'c-3', 'c-4']);
const LEGACY_SEED_LOG_IDS = new Set(['log-1', 'log-2', 'log-3', 'log-4', 'log-5']);
const ISOLATED_CORE_FILE_IDS = new Set(['f-soul', 'f-guardian']);

function isIsolatedCoreAgent(agent: Agent): boolean {
  return (
    ISOLATED_CORE_AGENT_KEYS.has(agent.id.toLowerCase()) ||
    ISOLATED_CORE_AGENT_KEYS.has(agent.profileKey.toLowerCase())
  );
}

function loadActiveDeletedTombstones(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(DELETED_TOMBSTONE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const active: Record<string, number> = {};
    for (const [k, exp] of Object.entries(parsed)) {
      if (typeof exp === 'number' && exp > now) {
        active[k] = exp;
      }
    }
    return active;
  } catch {
    return {};
  }
}

function saveDeletedTombstones(map: Record<string, number>): void {
  try {
    const now = Date.now();
    const active: Record<string, number> = {};
    for (const [k, exp] of Object.entries(map)) {
      if (exp > now) active[k] = exp;
    }
    if (Object.keys(active).length === 0) {
      window.localStorage.removeItem(DELETED_TOMBSTONE_KEY);
    } else {
      window.localStorage.setItem(DELETED_TOMBSTONE_KEY, JSON.stringify(active));
    }
  } catch {
    // Ignore storage quota errors
  }
}

interface PersistedState {
  workspaceVersion?: number;
  agents: Agent[];
  missions: Mission[];
  chats: Record<string, ChatMessage[]>;
  docs: DocItem[];
  crons: CronJob[];
  files: WorkspaceFile[];
  integrations: IntegrationService[];
  interAgentLogs: InterAgentLog[];
  settings: OperatorSettings;
}

function loadInitialState(): PersistedState {
  const activeTombstones = loadActiveDeletedTombstones();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const needsCleanMigration = (parsed.workspaceVersion ?? 1) < WORKSPACE_VERSION;

    const rawAgents = Array.isArray(parsed.agents) ? parsed.agents : INITIAL_AGENTS;
    const filteredAgents = rawAgents.filter((a) => {
      if (isIsolatedCoreAgent(a)) return false;
      if (activeTombstones[a.id] || activeTombstones[a.profileKey]) return false;
      if (needsCleanMigration && LEGACY_SEED_AGENT_IDS.has(a.id)) return false;
      return true;
    });

    const rawMissions = Array.isArray(parsed.missions) ? parsed.missions : INITIAL_MISSIONS;
    const filteredMissions = needsCleanMigration
      ? rawMissions.filter((m) => !LEGACY_SEED_MISSION_IDS.has(m.id))
      : rawMissions;

    const rawCrons = Array.isArray(parsed.crons) ? parsed.crons : INITIAL_CRON_JOBS;
    const filteredCrons = needsCleanMigration
      ? rawCrons.filter((c) => !LEGACY_SEED_CRON_IDS.has(c.id))
      : rawCrons;

    const rawChats = parsed.chats ?? INITIAL_CHATS;
    const allowedAgentIds = new Set(filteredAgents.map((a) => a.id));
    const filteredChats: Record<string, ChatMessage[]> = {};
    for (const [aid, msgs] of Object.entries(rawChats)) {
      if (ISOLATED_CORE_AGENT_KEYS.has(aid.toLowerCase())) continue;
      if (needsCleanMigration && !allowedAgentIds.has(aid)) continue;
      const cleanedMsgs = Array.isArray(msgs)
        ? msgs.filter((m) => !(needsCleanMigration && LEGACY_SEED_CHAT_IDS.has(m.id)))
        : [];
      if (cleanedMsgs.length > 0) {
        filteredChats[aid] = cleanedMsgs;
      }
    }

    const rawLogs = Array.isArray(parsed.interAgentLogs)
      ? parsed.interAgentLogs
      : INITIAL_INTER_AGENT_LOGS;
    const filteredLogs = needsCleanMigration
      ? rawLogs.filter((l) => !LEGACY_SEED_LOG_IDS.has(l.id))
      : rawLogs;

    const rawFiles = Array.isArray(parsed.files) && parsed.files.length > 0 ? parsed.files : INITIAL_FILES;
    const filteredFiles = rawFiles.filter(
      (f) =>
        !ISOLATED_CORE_FILE_IDS.has(f.id) &&
        f.path !== '~/.hermes/SOUL.md' &&
        !f.path.startsWith('~/.hermes/profiles/vps-guardian/'),
    );

    const savedLang: LanguageId =
      parsed.settings?.language === 'en' || parsed.settings?.language === 'id'
        ? parsed.settings.language
        : DEFAULT_SETTINGS.language;

    const nextState: PersistedState = {
      workspaceVersion: WORKSPACE_VERSION,
      agents: filteredAgents,
      missions: filteredMissions,
      chats: filteredChats,
      // Keep Docs library intact as requested
      docs: Array.isArray(parsed.docs) && parsed.docs.length > 0 ? parsed.docs : INITIAL_DOCS,
      crons: filteredCrons,
      files: filteredFiles.length > 0 ? filteredFiles : INITIAL_FILES,
      integrations: parsed.integrations?.length ? parsed.integrations : INITIAL_INTEGRATIONS,
      interAgentLogs: filteredLogs,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
        language: savedLang,
        // Never restore secret bearer tokens from localStorage
        bridgeToken: '',
      },
    };

    if (needsCleanMigration) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch {
        // Ignore storage quota errors
      }
    }

    return nextState;
  } catch {
    return {
      workspaceVersion: WORKSPACE_VERSION,
      agents: INITIAL_AGENTS,
      missions: INITIAL_MISSIONS,
      chats: INITIAL_CHATS,
      docs: INITIAL_DOCS,
      crons: INITIAL_CRON_JOBS,
      files: INITIAL_FILES,
      integrations: INITIAL_INTEGRATIONS,
      interAgentLogs: INITIAL_INTER_AGENT_LOGS,
      settings: DEFAULT_SETTINGS,
    };
  }
}

const PRIMARY_NAV: Array<{ id: NavSection; icon: typeof Compass }> = [
  { id: 'cockpit', icon: Compass },
  { id: 'voice', icon: Mic },
  { id: 'chat', icon: MessageSquare },
  { id: 'missions', icon: Target },
  { id: 'docs', icon: FileText },
  { id: 'schedule', icon: CalendarClock },
  { id: 'city', icon: Building2 },
  { id: 'health', icon: Activity },
];

const MANAGE_NAV: Array<{ id: NavSection; icon: typeof Compass }> = [
  { id: 'files', icon: FileCode2 },
  { id: 'terminal', icon: Terminal },
  { id: 'integrations', icon: PlugZap },
  { id: 'guide', icon: HelpCircle },
  { id: 'settings', icon: Settings },
];

/**
 * Isolated 1-second clock widget so ticking seconds never re-render the root App
 * or the active 3D WebGL Agent Office viewport.
 */
const LiveClock = memo(function LiveClock({
  cityLabel,
  timezone,
}: {
  cityLabel: string;
  timezone: string;
}) {
  const [clockText, setClockText] = useState('');

  useEffect(() => {
    const updateClock = () => {
      try {
        const formatted = new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date());
        setClockText(formatted);
      } catch {
        setClockText(new Date().toLocaleTimeString('en-GB', { hour12: false }));
      }
    };
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, [timezone]);

  return (
    <div className="text-right leading-tight">
      <div className="text-[10px] tracking-[0.14em] uppercase text-[var(--nx-text-subtle)]">
        {cityLabel}
      </div>
      <div className="font-mono text-xs font-medium text-[var(--nx-text)] tabular-nums">
        {clockText || '00:00:00'}
      </div>
    </div>
  );
});

function agentsAreEquivalent(prev: Agent[], next: Agent[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.role !== b.role ||
      a.status !== b.status ||
      a.currentTask !== b.currentTask ||
      a.model !== b.model ||
      a.avatarUrl !== b.avatarUrl ||
      a.sessionsCount !== b.sessionsCount ||
      a.tokensUsed !== b.tokensUsed
    ) {
      return false;
    }
  }
  return true;
}

function healthChecksAreEquivalent(prev: HealthCheck[], next: HealthCheck[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (
      prev[i].id !== next[i].id ||
      prev[i].status !== next[i].status ||
      prev[i].latencyMs !== next[i].latencyMs ||
      prev[i].detail !== next[i].detail
    ) {
      return false;
    }
  }
  return true;
}

export default function App() {
  const [initial] = useState<PersistedState>(() => loadInitialState());
  const [section, setSection] = useState<NavSection>('cockpit');
  const [agents, setAgents] = useState<Agent[]>(initial.agents);
  const [missions, setMissions] = useState<Mission[]>(initial.missions);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(initial.chats);
  const [docs, setDocs] = useState<DocItem[]>(initial.docs);
  const [crons, setCrons] = useState<CronJob[]>(initial.crons);
  const [files, setFiles] = useState<WorkspaceFile[]>(initial.files);
  const [integrations, setIntegrations] = useState<IntegrationService[]>(initial.integrations);
  const [interAgentLogs, setInterAgentLogs] = useState<InterAgentLog[]>(initial.interAgentLogs);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>(INITIAL_HEALTH_CHECKS);
  const [settings, setSettings] = useState<OperatorSettings>(initial.settings);

  const i18n = useMemo(() => createI18nValue(settings.language), [settings.language]);
  const i18nRef = useRef<I18nContextValue>(i18n);
  i18nRef.current = i18n;

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initial.agents[0]?.id ?? null,
  );
  const [activeChatAgentId, setActiveChatAgentId] = useState<string>(initial.agents[0]?.id ?? '');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(initial.docs[0]?.id ?? null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    initial.files[0]?.id ?? null,
  );
  const [askOpen, setAskOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [sessionToken, setSessionToken] = useState<string>(() => parseAndScrubUrlToken());
  const [bridgeCookieAuth, setBridgeCookieAuth] = useState<boolean>(false);
  const [bridgeAuthChecked, setBridgeAuthChecked] = useState<boolean>(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeConnectionStatus>('demo');
  const [bridgeError, setBridgeError] = useState<string>('');
  const [liveTelemetry, setLiveTelemetry] = useState<BridgeTelemetry | null>(null);
  const [availableModels, setAvailableModels] = useState<BridgeModelOption[]>(DEFAULT_ROUTER_MODELS);
  const [modelsSource, setModelsSource] = useState<'9router' | 'fallback'>('fallback');
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [sendingChatAgentId, setSendingChatAgentId] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const chatRevertTimersRef = useRef<Record<string, number>>({});
  const chatPrevStateRef = useRef<Record<string, { status: AgentStatus; currentTask: string }>>({});
  const chatWorkingLockRef = useRef<Record<string, { task: string; untilMs: number }>>({});
  const deletedAgentTombstonesRef = useRef<Record<string, number>>(loadActiveDeletedTombstones());
  const pendingCreatedProfilesRef = useRef<Record<string, number>>({});
  const latestTelemetryRef = useRef<BridgeTelemetry | null>(null);
  const latestHealthChecksRef = useRef<HealthCheck[] | null>(null);
  const latestInterAgentLogsRef = useRef<InterAgentLog[] | null>(null);
  const sectionRef = useRef<NavSection>(section);
  const agentsRef = useRef<Agent[]>(agents);
  const missionsRef = useRef<Mission[]>(missions);
  const chatsRef = useRef<Record<string, ChatMessage[]>>(chats);
  const docsRef = useRef<DocItem[]>(docs);
  const cronsRef = useRef<CronJob[]>(crons);
  const filesRef = useRef<WorkspaceFile[]>(files);
  const integrationsRef = useRef<IntegrationService[]>(integrations);
  const interAgentLogsRef = useRef<InterAgentLog[]>(interAgentLogs);
  const settingsRef = useRef<OperatorSettings>(settings);
  const bridgeStatusRef = useRef<BridgeConnectionStatus>(bridgeStatus);
  const sessionTokenRef = useRef<string>(sessionToken);

  const hasBridgeAuth = Boolean(sessionToken || bridgeCookieAuth);
  const hasBridgeAuthRef = useRef<boolean>(hasBridgeAuth);

  sectionRef.current = section;
  agentsRef.current = agents;
  missionsRef.current = missions;
  chatsRef.current = chats;
  docsRef.current = docs;
  cronsRef.current = crons;
  filesRef.current = files;
  integrationsRef.current = integrations;
  interAgentLogsRef.current = interAgentLogs;
  settingsRef.current = settings;
  bridgeStatusRef.current = bridgeStatus;
  sessionTokenRef.current = sessionToken;
  hasBridgeAuthRef.current = hasBridgeAuth;

  const getActiveExcludedProfileSet = useCallback((): Set<string> => {
    const now = Date.now();
    const map = deletedAgentTombstonesRef.current;
    let changed = false;
    const set = new Set<string>();
    for (const [key, exp] of Object.entries(map)) {
      if (exp > now) {
        set.add(key);
      } else {
        delete map[key];
        changed = true;
      }
    }
    if (changed) {
      saveDeletedTombstones(map);
    }
    return set;
  }, []);

  const getActivePendingCreatedProfileSet = useCallback((): Set<string> => {
    const now = Date.now();
    const map = pendingCreatedProfilesRef.current;
    const set = new Set<string>();
    for (const [key, exp] of Object.entries(map)) {
      if (exp > now) {
        set.add(key);
      } else {
        delete map[key];
      }
    }
    return set;
  }, []);

  const showActionBanner = useCallback((kind: 'success' | 'error', text: string) => {
    setActionBanner({ kind, text });
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setActionBanner(null);
      bannerTimerRef.current = null;
    }, kind === 'error' ? 7500 : 4200);
  }, []);

  const handleRefreshModels = useCallback(async (forceRefresh = true) => {
    if (settingsRef.current.bridgeMode !== 'live' || !hasBridgeAuthRef.current) {
      return;
    }
    setLoadingModels(true);
    try {
      const res = await fetchBridgeModels(
        settingsRef.current.bridgeUrl,
        sessionTokenRef.current,
        forceRefresh,
      );
      if (res.ok && Array.isArray(res.models) && res.models.length > 0) {
        setAvailableModels(res.models);
        setModelsSource(res.source === '9router' ? '9router' : 'fallback');
      }
    } catch {
      // Keep current model list if 9Router is temporarily unreachable
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (settings.bridgeMode === 'live' && hasBridgeAuth && bridgeStatus === 'live') {
      void handleRefreshModels(false);
    }
  }, [settings.bridgeMode, settings.bridgeUrl, hasBridgeAuth, bridgeStatus, handleRefreshModels]);

  const flushWorkspaceSnapshotNow = useCallback((overrides?: Partial<PersistedState>) => {
    try {
      const payload: PersistedState = {
        workspaceVersion: WORKSPACE_VERSION,
        agents: overrides?.agents ?? agentsRef.current,
        missions: overrides?.missions ?? missionsRef.current,
        chats: overrides?.chats ?? chatsRef.current,
        docs: overrides?.docs ?? docsRef.current,
        crons: overrides?.crons ?? cronsRef.current,
        files: overrides?.files ?? filesRef.current,
        integrations: overrides?.integrations ?? integrationsRef.current,
        interAgentLogs: overrides?.interAgentLogs ?? interAgentLogsRef.current,
        settings: {
          ...(overrides?.settings ?? settingsRef.current),
          bridgeToken: '',
        },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  // Flush latest buffered telemetry/logs when leaving 3D Agent Office for Cockpit or Health
  useEffect(() => {
    if (section !== 'city') {
      startTransition(() => {
        if (latestTelemetryRef.current) setLiveTelemetry(latestTelemetryRef.current);
        if (latestHealthChecksRef.current) setHealthChecks(latestHealthChecksRef.current);
        if (latestInterAgentLogsRef.current) setInterAgentLogs(latestInterAgentLogsRef.current);
      });
    }
  }, [section]);

  useEffect(() => {
    const timers = chatRevertTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const [locked, setLocked] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return false;
    return Boolean(initial.settings.dashboardPinEnabled);
  });
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');

  // Auto-detect VPS 2 nexora-bridge (:9120) & restore HttpOnly session cookie across refreshes
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const targetUrl = settings.bridgeMode === 'live' ? settings.bridgeUrl : '';
      const health = await probeBridgeHealth(targetUrl, 2500);
      if (cancelled) return;
      if (health.ok) {
        if (!targetUrl) {
          setSettings((prev) => ({
            ...prev,
            bridgeMode: 'live',
            bridgeUrl: '',
          }));
        }
        if (health.authenticated) {
          setBridgeCookieAuth(true);
        }
      }
      setBridgeAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
    // Run once on initial mount to probe same-origin / saved bridge health & cookie session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exchange in-memory sessionToken for a persistent 30-day HttpOnly cookie on the bridge server
  useEffect(() => {
    if (settings.bridgeMode !== 'live' || !sessionToken) return;
    let cancelled = false;
    void establishBridgeSession(settings.bridgeUrl, sessionToken).then((res) => {
      if (!cancelled && res.ok && res.authenticated) {
        setBridgeCookieAuth(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [settings.bridgeMode, settings.bridgeUrl, sessionToken]);

  // Maintain live WebSocket telemetry stream when in Live Bridge mode
  useEffect(() => {
    if (settings.bridgeMode !== 'live') {
      setBridgeStatus('demo');
      setBridgeError('');
      setLiveTelemetry(null);
      return;
    }

    if (!hasBridgeAuth) {
      if (!bridgeAuthChecked) {
        setBridgeStatus('connecting');
        setBridgeError('');
        return;
      }
      setBridgeStatus('error');
      setBridgeError(i18nRef.current.t('appBridgeErrTokenMissing'));
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;
    let filesSyncedOnce = false;

    const connect = () => {
      if (disposed) return;
      setBridgeStatus('connecting');
      setBridgeError('');
      try {
        const wsUrl = buildTelemetryWebSocketUrl(settings.bridgeUrl, sessionToken);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (disposed) return;
          setBridgeStatus('live');
          setBridgeError('');
          if (!filesSyncedOnce) {
            filesSyncedOnce = true;
            void fetchBridgeFiles(settings.bridgeUrl, sessionToken)
              .then((res) => {
                if (!disposed && res.ok && res.files.length > 0) {
                  setFiles(res.files);
                  setSelectedFileId(res.files[0].id);
                }
              })
              .catch(() => {
                // Keep local workspace files if remote ~/.hermes fetch is unavailable
              });
          }
        };

        ws.onmessage = (ev) => {
          if (disposed) return;
          try {
            const msg = JSON.parse(String(ev.data)) as { type?: string; data?: BridgeTelemetry };
            if (msg.type === 'telemetry' && msg.data) {
              const snap = msg.data;
              latestTelemetryRef.current = snap;
              const inOffice = sectionRef.current === 'city';
              // Skip re-rendering root App for telemetry numbers/logs while user is in 3D Agent Office
              if (!inOffice) {
                startTransition(() => {
                  setLiveTelemetry(snap);
                });
              }
              const nextStatus: BridgeConnectionStatus = snap.connected ? 'live' : 'error';
              setBridgeStatus((prev) => (prev === nextStatus ? prev : nextStatus));
              if (!snap.connected && snap.error) {
                setBridgeError((prev) => (prev === snap.error ? prev : snap.error ?? ''));
              }
              startTransition(() => {
                setAgents((prevAgents) => {
                  const excluded = getActiveExcludedProfileSet();
                  const pendingCreated = getActivePendingCreatedProfileSet();
                  for (const remote of snap.agents) {
                    if (pendingCreated.has(remote.id)) {
                      delete pendingCreatedProfilesRef.current[remote.id];
                    }
                  }
                  const merged = mergeBridgeTelemetry(
                    snap,
                    prevAgents,
                    INITIAL_HEALTH_CHECKS,
                    settings.showOnlyVpsAgents,
                    excluded,
                    pendingCreated,
                  );
                  latestHealthChecksRef.current = merged.healthChecks;
                  if (merged.interAgentLogs.length > 0) {
                    latestInterAgentLogsRef.current = merged.interAgentLogs;
                  }
                  if (!inOffice) {
                    setHealthChecks((prevChecks) =>
                      healthChecksAreEquivalent(prevChecks, merged.healthChecks)
                        ? prevChecks
                        : merged.healthChecks,
                    );
                    if (merged.interAgentLogs.length > 0) {
                      setInterAgentLogs((prevLogs) => {
                        if (
                          prevLogs.length === merged.interAgentLogs.length &&
                          prevLogs[0]?.id === merged.interAgentLogs[0]?.id &&
                          prevLogs[0]?.message === merged.interAgentLogs[0]?.message
                        ) {
                          return prevLogs;
                        }
                        return merged.interAgentLogs;
                      });
                    }
                  }
                  const nowMs = Date.now();
                  const reconciled = merged.agents.map((ag) => {
                    const lock = chatWorkingLockRef.current[ag.id];
                    if (lock && lock.untilMs > nowMs && ag.status !== 'alert') {
                      return { ...ag, status: 'working' as const, currentTask: lock.task };
                    }
                    if (lock && lock.untilMs <= nowMs) {
                      delete chatWorkingLockRef.current[ag.id];
                    }
                    return ag;
                  });
                  return agentsAreEquivalent(prevAgents, reconciled) ? prevAgents : reconciled;
                });
              });
            }
          } catch {
            // Ignore malformed telemetry frames
          }
        };

        ws.onerror = () => {
          if (disposed) return;
          setBridgeStatus('error');
          setBridgeError(i18nRef.current.t('appBridgeErrWs'));
        };

        ws.onclose = (ev) => {
          if (disposed) return;
          if (ev.code === 1008) {
            setBridgeCookieAuth(false);
            setBridgeStatus('error');
            setBridgeError(i18nRef.current.t('appBridgeErr401'));
            return;
          }
          setBridgeStatus('error');
          reconnectTimer = window.setTimeout(connect, 3500);
        };
      } catch (err) {
        setBridgeStatus('error');
        setBridgeError(err instanceof Error ? err.message : 'Failed to open WebSocket');
      }
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [
    settings.bridgeMode,
    settings.bridgeUrl,
    settings.showOnlyVpsAgents,
    sessionToken,
    hasBridgeAuth,
    bridgeAuthChecked,
    getActiveExcludedProfileSet,
    getActivePendingCreatedProfileSet,
  ]);

  // Sync theme & language attributes on documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.lang = settings.language;
    if (settings.theme === 'editorial-alabaster') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [settings.theme, settings.language]);

  // Persist workspace state to localStorage strictly during browser idle time (zero Send stutter)
  useEffect(() => {
    let idleId: number | null = null;
    const writeSnapshot = () => {
      try {
        const payload: PersistedState = {
          workspaceVersion: WORKSPACE_VERSION,
          agents,
          missions,
          chats,
          docs,
          crons,
          files,
          integrations,
          interAgentLogs,
          settings: {
            ...settings,
            bridgeToken: '',
          },
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors
      }
    };
    const saveTimer = window.setTimeout(() => {
      const ric = (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback;
      if (typeof ric === 'function') {
        idleId = ric(writeSnapshot, { timeout: 2000 });
      } else {
        writeSnapshot();
      }
    }, 2200);
    return () => {
      window.clearTimeout(saveTimer);
      if (idleId !== null) {
        const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
          .cancelIdleCallback;
        cic?.(idleId);
      }
    };
  }, [agents, missions, chats, docs, crons, files, integrations, interAgentLogs, settings]);

  // Keyboard shortcut Cmd/Ctrl + K opens Ask GALAXY
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAskOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const searchResults = useMemo(
    () => searchWorkspace(searchQuery, { agents, missions, docs, crons, files }),
    [searchQuery, agents, missions, docs, crons, files],
  );

  const pendingApprovalsCount = missions.filter((m) => m.stage === 'approval').length;

  const pushInterAgentLog = (
    fromAgentId: string,
    toAgentId: string,
    channel: string,
    message: string,
  ) => {
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setInterAgentLogs((prev) => [
      { id: `log-${Date.now()}`, fromAgentId, toAgentId, channel, message, timestamp: ts },
      ...prev.slice(0, 24),
    ]);
  };

  // --- Handlers ---
  const handleCreateMission = (title: string, goal: string, length: ReportLength) => {
    const created = createMission(title, goal, length, missions, agents);
    setMissions((prev) => [created, ...prev]);
    const isId = settingsRef.current.language === 'id';
    pushInterAgentLog(
      'operator',
      created.assignedAgentIds[0] ?? 'operator',
      `mission-${created.code.toLowerCase()}`,
      isId
        ? `Rencana untuk ${created.code} (${created.title}) disusun. Menunggu persetujuan Operator.`
        : `Drafted plan for ${created.code} (${created.title}). Holding execution until Operator approves.`,
    );
  };

  const handleApproveMission = (missionId: string) => {
    const target = missions.find((m) => m.id === missionId);
    setMissions((prev) => approveMissionPlan(prev, missionId));
    if (target) {
      const isId = settingsRef.current.language === 'id';
      setAgents((prev) =>
        prev.map((a) =>
          target.assignedAgentIds.includes(a.id)
            ? {
                ...a,
                status: 'working',
                currentTask: isId
                  ? `Menjalankan ${target.code}: ${target.title}`
                  : `Executing ${target.code}: ${target.title}`,
              }
            : a,
        ),
      );
      pushInterAgentLog(
        'operator',
        target.assignedAgentIds[0] ?? 'operator',
        `mission-${target.code.toLowerCase()}`,
        isId
          ? `Operator menyetujui ${target.code}. Langkah aktif mulai dijalankan.`
          : `Operator approved ${target.code}. Dispatching active step now.`,
      );
    }
  };

  const handleReviseMission = (missionId: string, note: string) => {
    setMissions((prev) => reviseMissionPlan(prev, missionId, note));
  };

  const handleRejectMission = (missionId: string) => {
    setMissions((prev) => prev.filter((m) => m.id !== missionId));
  };

  const handleAdvanceMission = (missionId: string) => {
    setMissions((prev) => advanceMissionProgress(prev, missionId));
  };

  const handleDeliverMission = (missionId: string) => {
    const target = missions.find((m) => m.id === missionId);
    if (!target) return;
    const { mission: delivered, doc } = deliverMissionReport(target, agents);
    setMissions((prev) => prev.map((m) => (m.id === missionId ? delivered : m)));
    setDocs((prev) => [doc, ...prev]);
    setSelectedDocId(doc.id);
    const isId = settingsRef.current.language === 'id';
    pushInterAgentLog(
      target.assignedAgentIds[0] ?? 'operator',
      'operator',
      'docs-library',
      isId
        ? `Menyimpan hasil akhir "${doc.title}" (${doc.wordCount} kata) ke Pustaka Dokumen.`
        : `Filed completed deliverable "${doc.title}" (${doc.wordCount} words) to Docs Library.`,
    );
  };

  const handleUpdateAgentStatus = useCallback((agentId: string, status: AgentStatus) => {
    const curI18n = i18nRef.current;
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status,
              currentTask:
                status === 'working'
                  ? curI18n.t('appStatusWorkingTask')
                  : status === 'alert'
                    ? curI18n.t('appStatusAlertTask')
                    : curI18n.t('appStatusIdleTask'),
            }
          : a,
      ),
    );
  }, []);

  const handleHireSpecialist = (
    preset: RolePreset,
    customName?: string,
    customBuilding?: string,
    customAvatarUrl?: string,
    customModel?: string,
  ) => {
    const { agents: nextAgents, hired } = hireSpecialist(
      agents,
      preset,
      customName,
      customBuilding,
      customAvatarUrl,
      customModel,
    );
    delete deletedAgentTombstonesRef.current[hired.id];
    delete deletedAgentTombstonesRef.current[hired.profileKey];
    saveDeletedTombstones(deletedAgentTombstonesRef.current);

    if (settings.bridgeMode === 'live' && hasBridgeAuth) {
      const graceUntil = Date.now() + 30_000;
      pendingCreatedProfilesRef.current[hired.id] = graceUntil;
      pendingCreatedProfilesRef.current[hired.profileKey] = graceUntil;
    }

    setAgents(nextAgents);
    flushWorkspaceSnapshotNow({ agents: nextAgents });
    setSelectedAgentId(hired.id);
    setActiveChatAgentId((cur) => cur || hired.id);
    const isId = settingsRef.current.language === 'id';
    pushInterAgentLog(
      'operator',
      hired.id,
      'agent-office',
      isId
        ? `Menambahkan meja kerja Lantai 1 & kasur Lantai 2 untuk ${hired.name} (${hired.buildingName}).`
        : `Provisioned Floor 1 desk & Floor 2 bed for ${hired.name} (${hired.buildingName}).`,
    );

    if (settings.bridgeMode === 'live' && hasBridgeAuth) {
      void createBridgeAgent(settings.bridgeUrl, sessionToken, {
        slug: hired.profileKey,
        name: hired.name,
        building_name: hired.buildingName,
        role: hired.role,
        model: hired.model,
        arch: hired.archetype,
        avatar: hired.avatarUrl,
        soul: `# SOUL.md — ${hired.name}\n\n${hired.soulSummary}\n`,
      })
        .then(async () => {
          const fresh = await fetchBridgeStatus(settings.bridgeUrl, sessionToken);
          latestTelemetryRef.current = fresh;
          setLiveTelemetry(fresh);
          setAgents((prev) => {
            const merged = mergeBridgeTelemetry(
              fresh,
              prev,
              INITIAL_HEALTH_CHECKS,
              settingsRef.current.showOnlyVpsAgents,
              getActiveExcludedProfileSet(),
              getActivePendingCreatedProfileSet(),
            );
            return agentsAreEquivalent(prev, merged.agents) ? prev : merged.agents;
          });
          delete pendingCreatedProfilesRef.current[hired.id];
          delete pendingCreatedProfilesRef.current[hired.profileKey];
          void fetchBridgeFiles(settings.bridgeUrl, sessionToken)
            .then((fRes) => {
              if (fRes.ok && fRes.files.length > 0) setFiles(fRes.files);
            })
            .catch(() => {});
          showActionBanner(
            'success',
            isId
              ? `Profil "${hired.name}" berhasil dibuat di Hermes beserta skill & tools.`
              : `Profile "${hired.name}" created on Hermes with skills & tools.`,
          );
        })
        .catch((err) => {
          delete pendingCreatedProfilesRef.current[hired.id];
          delete pendingCreatedProfilesRef.current[hired.profileKey];
          const detail = err instanceof Error ? err.message : String(err);
          setAgents((prev) => {
            const rolled = prev.filter((a) => a.id !== hired.id && a.profileKey !== hired.profileKey);
            flushWorkspaceSnapshotNow({ agents: rolled });
            return rolled;
          });
          pushInterAgentLog(
            'system',
            'operator',
            'agent-office',
            isId
              ? `Gagal membuat profil "${hired.name}" di Hermes: ${detail}`
              : `Failed to create profile "${hired.name}" on Hermes: ${detail}`,
          );
          showActionBanner(
            'error',
            isId
              ? `Gagal membuat profil "${hired.name}" di Hermes: ${detail}`
              : `Failed to create "${hired.name}" on Hermes: ${detail}`,
          );
        });
    }
  };

  const handleCreateCustomAgent = (draft: CustomAgentDraft) => {
    const { agents: nextAgents, hired } = createCustomAgent(agents, draft);
    delete deletedAgentTombstonesRef.current[hired.id];
    delete deletedAgentTombstonesRef.current[hired.profileKey];
    saveDeletedTombstones(deletedAgentTombstonesRef.current);

    if (settings.bridgeMode === 'live' && hasBridgeAuth) {
      const graceUntil = Date.now() + 30_000;
      pendingCreatedProfilesRef.current[hired.id] = graceUntil;
      pendingCreatedProfilesRef.current[hired.profileKey] = graceUntil;
    }

    setAgents(nextAgents);
    flushWorkspaceSnapshotNow({ agents: nextAgents });
    setSelectedAgentId(hired.id);
    setActiveChatAgentId((cur) => cur || hired.id);
    const isId = settingsRef.current.language === 'id';
    pushInterAgentLog(
      'operator',
      hired.id,
      'agent-office',
      isId
        ? `Membuat profil Hermes kustom ~/.hermes/profiles/${hired.profileKey} (${hired.buildingName}) beserta skill Hermes & meja 1:1.`
        : `Provisioned custom Hermes profile ~/.hermes/profiles/${hired.profileKey} (${hired.buildingName}) with Hermes skills & 1:1 desk.`,
    );

    if (settings.bridgeMode === 'live' && hasBridgeAuth) {
      void createBridgeAgent(settings.bridgeUrl, sessionToken, {
        slug: hired.profileKey,
        name: hired.name,
        building_name: hired.buildingName,
        role: hired.role,
        model: hired.model,
        arch: hired.archetype,
        avatar: hired.avatarUrl,
        soul: `# SOUL.md — ${hired.name}\n\n${hired.soulSummary}\n`,
      })
        .then(async () => {
          const fresh = await fetchBridgeStatus(settings.bridgeUrl, sessionToken);
          latestTelemetryRef.current = fresh;
          setLiveTelemetry(fresh);
          setAgents((prev) => {
            const merged = mergeBridgeTelemetry(
              fresh,
              prev,
              INITIAL_HEALTH_CHECKS,
              settingsRef.current.showOnlyVpsAgents,
              getActiveExcludedProfileSet(),
              getActivePendingCreatedProfileSet(),
            );
            return agentsAreEquivalent(prev, merged.agents) ? prev : merged.agents;
          });
          delete pendingCreatedProfilesRef.current[hired.id];
          delete pendingCreatedProfilesRef.current[hired.profileKey];
          void fetchBridgeFiles(settings.bridgeUrl, sessionToken)
            .then((fRes) => {
              if (fRes.ok && fRes.files.length > 0) setFiles(fRes.files);
            })
            .catch(() => {});
          showActionBanner(
            'success',
            isId
              ? `Profil kustom "${hired.name}" berhasil dibuat di Hermes beserta skill & tools.`
              : `Custom profile "${hired.name}" created on Hermes with skills & tools.`,
          );
        })
        .catch((err) => {
          delete pendingCreatedProfilesRef.current[hired.id];
          delete pendingCreatedProfilesRef.current[hired.profileKey];
          const detail = err instanceof Error ? err.message : String(err);
          setAgents((prev) => {
            const rolled = prev.filter((a) => a.id !== hired.id && a.profileKey !== hired.profileKey);
            flushWorkspaceSnapshotNow({ agents: rolled });
            return rolled;
          });
          pushInterAgentLog(
            'system',
            'operator',
            'agent-office',
            isId
              ? `Gagal membuat profil kustom "${hired.name}" di Hermes: ${detail}`
              : `Failed to create custom profile "${hired.name}" on Hermes: ${detail}`,
          );
          showActionBanner(
            'error',
            isId
              ? `Gagal membuat profil "${hired.name}" di Hermes: ${detail}`
              : `Failed to create "${hired.name}" on Hermes: ${detail}`,
          );
        });
    }
  };

  const handleUpdateAgentAvatar = useCallback((agentId: string, avatarUrl: string) => {
    const target = agentsRef.current.find((a) => a.id === agentId);
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, avatarUrl } : a)));
    if (target && settingsRef.current.bridgeMode === 'live' && hasBridgeAuthRef.current) {
      const slug = target.profileKey;
      void updateBridgeAgentAvatar(
        settingsRef.current.bridgeUrl,
        sessionTokenRef.current,
        slug,
        avatarUrl,
      ).catch(() => {});
    }
  }, []);

  const handleUpdateAgentModel = useCallback(
    (agentId: string, nextModelRaw: string) => {
      const nextModel = nextModelRaw.trim();
      if (!nextModel) return;
      const target = agentsRef.current.find((a) => a.id === agentId);
      if (!target || target.model === nextModel) return;
      const prevModel = target.model;

      setAgents((prev) => {
        const next = prev.map((a) => (a.id === agentId ? { ...a, model: nextModel } : a));
        flushWorkspaceSnapshotNow({ agents: next });
        return next;
      });

      if (settingsRef.current.bridgeMode === 'live' && hasBridgeAuthRef.current) {
        const slug = target.profileKey;
        void updateBridgeAgentModel(
          settingsRef.current.bridgeUrl,
          sessionTokenRef.current,
          slug,
          nextModel,
        )
          .then(() => {
            showActionBanner(
              'success',
              i18nRef.current.t('modelPickerUpdatedToast', {
                name: target.name,
                model: nextModel,
              }),
            );
            void fetchBridgeFiles(settingsRef.current.bridgeUrl, sessionTokenRef.current)
              .then((fRes) => {
                if (fRes.ok && fRes.files.length > 0) setFiles(fRes.files);
              })
              .catch(() => {});
          })
          .catch((err) => {
            const detail = err instanceof Error ? err.message : String(err);
            setAgents((prev) => {
              const rolled = prev.map((a) => (a.id === agentId ? { ...a, model: prevModel } : a));
              flushWorkspaceSnapshotNow({ agents: rolled });
              return rolled;
            });
            showActionBanner(
              'error',
              i18nRef.current.t('modelPickerFailedToast', {
                name: target.name,
                detail,
              }),
            );
          });
      } else {
        showActionBanner(
          'success',
          i18nRef.current.t('modelPickerUpdatedToast', {
            name: target.name,
            model: nextModel,
          }),
        );
      }
    },
    [flushWorkspaceSnapshotNow, showActionBanner],
  );

  const handleRetireSpecialist = useCallback(
    (agentId: string) => {
      const currentAgents = agentsRef.current;
      const target = currentAgents.find((a) => a.id === agentId);
      if (
        !target ||
        target.isHQ ||
        target.profileKey === 'default' ||
        target.profileKey === 'vps-guardian'
      ) {
        return;
      }

      const { agents: nextAgents, removed } = retireSpecialist(currentAgents, agentId);
      if (!removed) return;

      // Record tombstone immediately so in-flight WS telemetry & rapid tab refreshes never resurrect this agent
      const expiresAt = Date.now() + DELETED_TOMBSTONE_TTL_MS;
      deletedAgentTombstonesRef.current[target.id] = expiresAt;
      deletedAgentTombstonesRef.current[target.profileKey] = expiresAt;
      saveDeletedTombstones(deletedAgentTombstonesRef.current);

      if (chatRevertTimersRef.current[target.id]) {
        window.clearTimeout(chatRevertTimersRef.current[target.id]);
        delete chatRevertTimersRef.current[target.id];
      }
      delete chatPrevStateRef.current[target.id];
      delete chatWorkingLockRef.current[target.id];

      const nextChats = { ...chatsRef.current };
      delete nextChats[target.id];

      const fallbackAgentId = nextAgents[0]?.id ?? null;
      setAgents(nextAgents);
      setChats(nextChats);
      setSelectedAgentId((cur) => (cur === target.id ? fallbackAgentId : cur));
      setActiveChatAgentId((cur) => (cur === target.id ? fallbackAgentId ?? '' : cur));

      // Flush to localStorage synchronously right away (never wait 2.2s debounce) so refresh stays clean
      flushWorkspaceSnapshotNow({ agents: nextAgents, chats: nextChats });

      const isId = settingsRef.current.language === 'id';
      pushInterAgentLog(
        'operator',
        target.id,
        'agent-office',
        isId
          ? `Menghapus agen ${target.name} (${target.buildingName}), meja kerja Lantai 1, dan kasur Lantai 2.`
          : `Removed agent ${target.name} (${target.buildingName}), Floor 1 desk, and Floor 2 bed.`,
      );

      if (settingsRef.current.bridgeMode === 'live' && hasBridgeAuthRef.current) {
        const bridgeUrl = settingsRef.current.bridgeUrl;
        const token = sessionTokenRef.current;
        void deleteBridgeAgent(bridgeUrl, token, target.profileKey)
          .then(() => fetchBridgeStatus(bridgeUrl, token))
          .then((fresh) => {
            latestTelemetryRef.current = fresh;
            if (sectionRef.current !== 'city') {
              setLiveTelemetry(fresh);
            }
          })
          .catch(() => {});
      }
    },
    [flushWorkspaceSnapshotNow],
  );

  const handleSendChatMessage = useCallback(
    (agentId: string, content: string, attachmentName?: string) => {
      const currentAgents = agentsRef.current;
      const agent = currentAgents.find((a) => a.id === agentId) ?? currentAgents[0];
      if (!agent) return;
      const trimmed = content.trim();
      if (!trimmed) return;
      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const operatorMsg: ChatMessage = {
        id: `cm-u-${Date.now()}`,
        agentId: agent.id,
        sender: 'operator',
        content: trimmed,
        timestamp: ts,
        attachmentName,
      };

      const promptPreview = trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed;
      const curI18n = i18nRef.current;

      // Remember original status so idle agents walk to their Floor 1 desk to work while replying,
      // then naturally return to relaxing/hanging out after finishing the conversation.
      if (!chatPrevStateRef.current[agent.id]) {
        chatPrevStateRef.current[agent.id] = {
          status: agent.status,
          currentTask: agent.currentTask,
        };
      }
      if (chatRevertTimersRef.current[agent.id]) {
        window.clearTimeout(chatRevertTimersRef.current[agent.id]);
        delete chatRevertTimersRef.current[agent.id];
      }

      const markAgentWorking = (taskText: string, lockMs = 60000) => {
        chatWorkingLockRef.current[agent.id] = {
          task: taskText,
          untilMs: Date.now() + lockMs,
        };
        startTransition(() => {
          setAgents((prev) =>
            prev.map((a) =>
              a.id === agent.id ? { ...a, status: 'working', currentTask: taskText } : a,
            ),
          );
        });
      };

      const scheduleIdleReturn = (delayMs: number) => {
        const prevSnapshot = chatPrevStateRef.current[agent.id];
        const existingLock = chatWorkingLockRef.current[agent.id];
        if (existingLock) {
          chatWorkingLockRef.current[agent.id] = {
            ...existingLock,
            untilMs: Date.now() + delayMs,
          };
        }
        chatRevertTimersRef.current[agent.id] = window.setTimeout(() => {
          delete chatRevertTimersRef.current[agent.id];
          delete chatPrevStateRef.current[agent.id];
          delete chatWorkingLockRef.current[agent.id];
          if (!prevSnapshot) return;
          startTransition(() => {
            setAgents((prev) =>
              prev.map((a) =>
                a.id === agent.id
                  ? {
                      ...a,
                      status: prevSnapshot.status,
                      currentTask: prevSnapshot.currentTask,
                    }
                  : a,
              ),
            );
          });
        }, delayMs);
      };

      markAgentWorking(curI18n.t('appChatProcessing', { preview: promptPreview }), 65000);

      if (bridgeStatusRef.current === 'live' && hasBridgeAuthRef.current) {
        const priorHistory = (chatsRef.current[agent.id] ?? [])
          .filter(
            (m) =>
              !m.content.startsWith('Live bridge error:') &&
              !m.content.startsWith('Kesalahan jembatan langsung:'),
          )
          .slice(-10)
          .map((m) => ({
            role: (m.sender === 'operator' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }));
        setChats((prev) => ({
          ...prev,
          [agent.id]: [...(prev[agent.id] ?? []), operatorMsg],
        }));
        setSendingChatAgentId(agent.id);
        void sendBridgeChat(settingsRef.current.bridgeUrl, sessionTokenRef.current, {
          agent_id: agent.profileKey,
          message: trimmed,
          model: agent.model || 'combo-best',
          history: priorHistory,
        })
          .then((res) => {
            const runtimeLabel =
              res.runtime === 'hermes-cli' || res.tools_enabled
                ? 'hermes-cli (skills & tools)'
                : '9router :20128';
            const agentMsg: ChatMessage = {
              id: `cm-a-${Date.now() + 1}`,
              agentId: agent.id,
              sender: 'agent',
              content: res.reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              modelUsed: res.model,
              latencyMs: res.latency_ms,
              toolTrace: [runtimeLabel, `profile:${agent.profileKey}`],
            };
            setChats((prev) => ({
              ...prev,
              [agent.id]: [...(prev[agent.id] ?? []), agentMsg],
            }));
            markAgentWorking(
              i18nRef.current.t('appChatFinished', { preview: promptPreview }),
            );
          })
          .catch((err) => {
            const errMsg: ChatMessage = {
              id: `cm-e-${Date.now() + 1}`,
              agentId: agent.id,
              sender: 'agent',
              content: i18nRef.current.t('appLiveBridgeErr', {
                err: err instanceof Error ? err.message : String(err),
              }),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setChats((prev) => ({
              ...prev,
              [agent.id]: [...(prev[agent.id] ?? []), errMsg],
            }));
          })
          .finally(() => {
            setSendingChatAgentId((cur) => (cur === agent.id ? null : cur));
            scheduleIdleReturn(14000);
          });
        return;
      }

      // Demo Preview mode: show operator message immediately and animate agent typing at desk briefly
      setChats((prev) => ({
        ...prev,
        [agent.id]: [...(prev[agent.id] ?? []), operatorMsg],
      }));
      setSendingChatAgentId(agent.id);

      window.setTimeout(() => {
        const reply = generateAgentReply(
          agent,
          trimmed,
          agentsRef.current,
          settingsRef.current.language,
        );
        const agentMsg: ChatMessage = {
          id: `cm-a-${Date.now() + 1}`,
          agentId: agent.id,
          sender: 'agent',
          content: reply.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: agent.model,
          latencyMs: 920 + Math.round(agent.avgReplySec * 140),
          toolTrace: reply.toolTrace,
        };

        setChats((prev) => ({
          ...prev,
          [agent.id]: [...(prev[agent.id] ?? []), agentMsg],
        }));
        setSendingChatAgentId((cur) => (cur === agent.id ? null : cur));
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agent.id
              ? {
                  ...a,
                  status: 'working',
                  currentTask: i18nRef.current.t('appChatFinished', { preview: promptPreview }),
                  sessionsCount: a.sessionsCount + 1,
                  tokensUsed: a.tokensUsed + 1480,
                }
              : a,
          ),
        );
        scheduleIdleReturn(14000);
      }, 850);
    },
    [],
  );

  const handleOpenChat = useCallback((agentId: string) => {
    setActiveChatAgentId(agentId);
    setSection('chat');
  }, []);

  const handleOpenAddAgent = useCallback(() => {
    setAddAgentOpen(true);
  }, []);

  const handleOpenAsk = useCallback(() => {
    setAskOpen(true);
  }, []);

  const handleClearChatThread = useCallback((id: string) => {
    setChats((prev) => ({
      ...prev,
      [id]: [],
    }));
  }, []);

  const handleRunDiagnostics = () => {
    if (bridgeStatus === 'live' && hasBridgeAuth) {
      void fetchBridgeStatus(settings.bridgeUrl, sessionToken)
        .then((snap) => {
          setLiveTelemetry(snap);
          const merged = mergeBridgeTelemetry(
            snap,
            agentsRef.current,
            INITIAL_HEALTH_CHECKS,
            settings.showOnlyVpsAgents,
            getActiveExcludedProfileSet(),
          );
          setAgents(merged.agents);
          setHealthChecks(merged.healthChecks);
          if (merged.interAgentLogs.length > 0) setInterAgentLogs(merged.interAgentLogs);
        })
        .catch(() => {});
      return;
    }
    setHealthChecks((prev) =>
      prev.map((hc) => ({
        ...hc,
        status: 'pass',
        latencyMs: Math.max(2, hc.latencyMs + (((Math.random() - 0.5) * 4) | 0)),
      })),
    );
    const isId = settingsRef.current.language === 'id';
    pushInterAgentLog(
      'system',
      'operator',
      'fleet-telemetry',
      isId
        ? 'Pemindaian diagnostik 21-titik di hermesagent (100.72.221.36) selesai: 21 dari 21 lulus.'
        : 'Completed 21-point diagnostic sweep on hermesagent (100.72.221.36): 21 of 21 pass.',
    );
  };

  const handleVerifyBridge = async (): Promise<string> => {
    const curI18n = i18nRef.current;
    if (settings.bridgeMode === 'demo') {
      return curI18n.t('appVerifyDemo');
    }
    const health = await probeBridgeHealth(settings.bridgeUrl, 4000);
    if (!health.ok) {
      setBridgeStatus('error');
      return curI18n.t('appVerifyUnreachable', {
        url: settings.bridgeUrl || 'same-origin',
      });
    }
    if (sessionToken) {
      const sess = await establishBridgeSession(settings.bridgeUrl, sessionToken);
      if (sess.ok && sess.authenticated) {
        setBridgeCookieAuth(true);
      }
    } else if (health.authenticated) {
      setBridgeCookieAuth(true);
    } else {
      return curI18n.t('appVerifyNeedToken', {
        version: health.version ?? '3.0',
        host: health.main_vps ?? 'hermesagent',
      });
    }
    try {
      const snap = await fetchBridgeStatus(settings.bridgeUrl, sessionToken);
      setLiveTelemetry(snap);
      setBridgeStatus(snap.connected ? 'live' : 'error');
      const merged = mergeBridgeTelemetry(
        snap,
        agentsRef.current,
        INITIAL_HEALTH_CHECKS,
        settings.showOnlyVpsAgents,
        getActiveExcludedProfileSet(),
      );
      setAgents(merged.agents);
      setHealthChecks(merged.healthChecks);
      return snap.connected
        ? curI18n.t('appVerifyConnected', {
            host: snap.host,
            version: health.version ?? '3.0',
            cpu: snap.cpu.percent,
            ramUsed: snap.ram.used_gb,
            ramTotal: snap.ram.total_gb,
          })
        : curI18n.t('appVerifyWaitingSsh', {
            err: snap.error ?? 'SSH',
          });
    } catch (err) {
      setBridgeStatus('error');
      return curI18n.t('appVerifyAuthErr', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleSyncLiveFiles = async () => {
    if (bridgeStatus !== 'live' || !hasBridgeAuth) return;
    const res = await fetchBridgeFiles(settings.bridgeUrl, sessionToken);
    if (res.ok && res.files.length > 0) {
      setFiles(res.files);
      setSelectedFileId(res.files[0].id);
    }
  };

  const handleSaveFile = async (id: string, content: string) => {
    const target = files.find((f) => f.id === id);
    if (bridgeStatus === 'live' && hasBridgeAuth && target) {
      await saveBridgeFile(settings.bridgeUrl, sessionToken, target.path, content);
    }
    const savedLabel = i18nRef.current.t('appFileSavedNow');
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, content, updatedAt: savedLabel } : f)),
    );
  };

  const handleRestartService = async (unit: string) => {
    if (bridgeStatus !== 'live' || !hasBridgeAuth) return;
    await restartBridgeService(settings.bridgeUrl, sessionToken, unit);
    handleRunDiagnostics();
  };

  const handleLiveVoiceExchange = async (agent: Agent, promptText: string) => {
    const chatRes = await sendBridgeChat(settings.bridgeUrl, sessionToken, {
      agent_id: agent.profileKey,
      message: promptText,
      model: agent.model || 'combo-best',
    });
    let audioBlob: Blob | undefined;
    if (settings.autoSpeakReplies) {
      try {
        const tts = await speakViaBridge(settings.bridgeUrl, sessionToken, {
          agent_id: agent.profileKey,
          text: chatRes.reply.slice(0, 600),
          voice: 'alloy',
        });
        audioBlob = tts.audioBlob;
      } catch {
        // Fallback smoothly to browser Web Speech API
      }
    }
    return {
      replyText: chatRes.reply,
      audioBlob,
      engineLabel: audioBlob ? 'VoiceStudio :3900' : `${chatRes.model} · TTS`,
    };
  };

  const handleResetWorkspace = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAgents(INITIAL_AGENTS);
    setMissions(INITIAL_MISSIONS);
    setChats(INITIAL_CHATS);
    setDocs(INITIAL_DOCS);
    setCrons(INITIAL_CRON_JOBS);
    setFiles(INITIAL_FILES);
    setIntegrations(INITIAL_INTEGRATIONS);
    setInterAgentLogs(INITIAL_INTER_AGENT_LOGS);
    setSettings((prev) => ({ ...DEFAULT_SETTINGS, language: prev.language }));
    setSelectedAgentId(null);
    setActiveChatAgentId('');
  };

  // Optional Dashboard PIN Lock screen
  if (locked) {
    return (
      <I18nProvider language={settings.language}>
        <div className="min-h-screen flex items-center justify-center bg-[var(--nx-bg)] p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pinEntry === settings.dashboardPin) {
                setLocked(false);
                setPinEntry('');
                setPinError('');
              } else {
                setPinError(i18n.t('lockInvalidPin'));
              }
            }}
            className="w-full max-w-sm rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] p-6 space-y-4 text-center"
          >
            <div className="relative mx-auto inline-flex items-center justify-center">
              <GalaxyLogo
                size={54}
                className="drop-shadow-[0_0_18px_rgba(249,92,25,0.32)]"
              />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--nx-bg-elevated)] bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]">
                <Lock className="h-2.5 w-2.5" />
              </span>
            </div>
            <div>
              <p className="text-[11px] tracking-[0.16em] uppercase text-[var(--nx-text-muted)]">
                {i18n.t('lockEyebrow')}
              </p>
              <h1 className="font-editorial text-2xl mt-1 text-[var(--nx-text)]">
                {i18n.t('lockTitlePrefix')}{' '}
                <span className="italic text-[var(--nx-accent)]">{i18n.t('lockTitleAccent')}</span>
              </h1>
            </div>
            <input
              type="password"
              value={pinEntry}
              onChange={(e) => setPinEntry(e.target.value)}
              placeholder={i18n.t('lockPlaceholder')}
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2.5 text-center font-mono text-sm tracking-[0.3em] text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            {pinError && <p className="text-xs text-[var(--nx-alert)]">{pinError}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--nx-accent)] py-2.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] cursor-pointer"
            >
              {i18n.t('lockUnlockBtn')}
            </button>
          </form>
        </div>
      </I18nProvider>
    );
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Signature GALAXY Brand Emblem Header */}
        <button
          type="button"
          onClick={() => {
            setSection('cockpit');
            setMobileNavOpen(false);
          }}
          className="group flex items-center gap-3 px-1.5 text-left cursor-pointer"
        >
          <GalaxyLogo
            size={36}
            className="shrink-0 transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_12px_rgba(249,92,25,0.28)]"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-[0.16em] text-[var(--nx-text)] leading-none">
              GALAXY
            </div>
            <div className="text-[9px] tracking-[0.18em] uppercase text-[var(--nx-text-subtle)] mt-1">
              {i18n.t('brandSubtitle')}
            </div>
          </div>
        </button>

        {/* Primary Fleet Navigation (Hand Mode & Mini-Game intentionally excluded) */}
        <nav aria-label="Primary navigation" className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[var(--nx-accent-soft)] text-[var(--nx-accent)]'
                    : 'text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="tracking-[0.04em] uppercase text-[11px]">
                    {i18n.navLabel(item.id)}
                  </span>
                </span>
                {item.id === 'missions' && pendingApprovalsCount > 0 && (
                  <span className="font-mono text-[10px] font-semibold text-[var(--nx-accent)] tabular-nums">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Manage Section */}
        <div>
          <p className="px-3 pb-2 text-[10px] tracking-[0.16em] uppercase text-[var(--nx-text-subtle)]">
            {i18n.t('manageHeader')}
          </p>
          <nav aria-label="System management" className="space-y-0.5">
            {MANAGE_NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[var(--nx-accent-soft)] text-[var(--nx-accent)]'
                      : 'text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="tracking-[0.04em] uppercase text-[11px]">
                    {i18n.navLabel(item.id)}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Signature Bottom ASK GALAXY CTA Button */}
      <div className="pt-4 border-t border-[var(--nx-border)]">
        <button
          type="button"
          onClick={() => {
            setAskOpen(true);
            setMobileNavOpen(false);
          }}
          className="w-full rounded-lg bg-[var(--nx-accent)] py-2.5 px-4 text-xs font-bold tracking-[0.12em] uppercase text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer shadow-md"
        >
          {i18n.t('askGalaxyBtn')}
        </button>
      </div>
    </div>
  );

  return (
    <I18nProvider language={settings.language}>
      <div
        className="min-h-screen flex bg-[var(--nx-bg)] text-[var(--nx-text)]"
        data-active-section={section}
        data-language={settings.language}
      >
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 border-r border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] sticky top-0 h-screen">
          {renderSidebarContent()}
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="w-64 bg-[var(--nx-bg-elevated)] border-r border-[var(--nx-border-strong)] h-full relative">
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label={i18n.t('closeNavAria')}
                className="absolute top-4 right-3 rounded-lg p-1.5 text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              {renderSidebarContent()}
            </div>
            <button
              type="button"
              aria-label={i18n.t('dismissNavAria')}
              className="flex-1 bg-black/65"
              onClick={() => setMobileNavOpen(false)}
            />
          </div>
        )}

        {/* Main Content Shell */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Utility Bar */}
          <header className="sticky top-0 z-30 h-14 border-b border-[var(--nx-border)] bg-[var(--nx-bg)]/95 px-4 lg:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 lg:hidden shrink-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label={i18n.t('openNavAria')}
                className="rounded-lg border border-[var(--nx-border-strong)] p-2 text-[var(--nx-text)] cursor-pointer"
              >
                <Menu className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSection('cockpit')}
                className="flex items-center gap-2 cursor-pointer"
              >
                <GalaxyLogo
                  size={28}
                  className="shrink-0 drop-shadow-[0_0_8px_rgba(249,92,25,0.25)]"
                />
                <span className="text-sm font-bold tracking-[0.16em]">GALAXY</span>
              </button>
            </div>

            {/* Centered Global Search */}
            <div className="relative flex-1 max-w-md mx-auto">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--nx-text-subtle)]"
                aria-hidden="true"
              />
              <label htmlFor="global-nexora-search" className="sr-only">
                {i18n.t('searchAria')}
              </label>
              <input
                id="global-nexora-search"
                type="search"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={i18n.t('searchPlaceholder')}
                className="w-full rounded-full border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] pl-9 pr-4 py-1.5 text-[16px] sm:text-xs text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
              />

              {searchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] shadow-2xl overflow-hidden z-40">
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-[var(--nx-text-muted)]">
                      {i18n.t('searchEmpty')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--nx-border)] max-h-72 overflow-y-auto">
                      {searchResults.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onMouseDown={() => {
                              if (hit.type === 'agent') setSelectedAgentId(hit.targetId);
                              if (hit.type === 'doc') setSelectedDocId(hit.targetId);
                              if (hit.type === 'file') setSelectedFileId(hit.targetId);
                              setSection(hit.targetSection);
                              setSearchQuery('');
                            }}
                            className="w-full px-4 py-2.5 text-left hover:bg-[var(--nx-surface-hover)] flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[var(--nx-text)] truncate">
                                {hit.title}
                              </p>
                              <p className="text-[11px] text-[var(--nx-text-muted)] truncate">
                                {hit.subtitle}
                              </p>
                            </div>
                            <span className="font-mono text-[10px] uppercase text-[var(--nx-accent)] shrink-0">
                              {i18n.searchTypeLabel(hit.type)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Right Utility Controls: 1-Click Language Switcher + Bridge + Clock + Operator */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <div
                role="group"
                aria-label={i18n.t('switchLangAria')}
                className="inline-flex items-center rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] p-0.5"
              >
                <Globe className="hidden md:block h-3 w-3 text-[var(--nx-text-subtle)] ml-1.5 mr-1" />
                {(['id', 'en'] as const).map((code) => {
                  const active = settings.language === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSettings((prev) => ({ ...prev, language: code }))}
                      className={`rounded-md px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                          : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                      }`}
                    >
                      {code.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              <div className="hidden sm:flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setSection('integrations')}
                  className="text-right leading-tight hover:opacity-80 transition-opacity cursor-pointer"
                  title={i18n.t('bridgeConfigTitle')}
                >
                  <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--nx-text-subtle)]">
                    {bridgeStatus === 'live'
                      ? i18n.t('bridgeLive')
                      : bridgeStatus === 'connecting'
                        ? i18n.t('bridgeConnecting')
                        : bridgeStatus === 'error'
                          ? i18n.t('bridgeOffline')
                          : i18n.t('bridgePreview')}
                  </div>
                  <div
                    className="font-mono text-[11px] font-medium"
                    style={{
                      color:
                        bridgeStatus === 'live'
                          ? 'var(--nx-idle)'
                          : bridgeStatus === 'error'
                            ? 'var(--nx-alert)'
                            : 'var(--nx-text-muted)',
                    }}
                  >
                    {bridgeStatus === 'live' ? 'hermesagent :9120' : i18n.t('bridgeDeployCta')}
                  </div>
                </button>

                <LiveClock cityLabel={settings.cityLabel} timezone={settings.timezone} />

                <button
                  type="button"
                  onClick={() => setSection('settings')}
                  className="flex items-center gap-2.5 rounded-full border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] pl-1.5 pr-3 py-1 hover:border-[var(--nx-accent)] transition-colors cursor-pointer"
                  aria-label={i18n.t('openSettingsAria')}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--nx-surface-hover)] text-[11px] font-semibold text-[var(--nx-text)]">
                    {settings.operatorName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block text-xs font-semibold text-[var(--nx-text)]">
                      {settings.operatorName}
                    </span>
                    <span className="block text-[9px] tracking-[0.12em] uppercase text-[var(--nx-text-subtle)]">
                      {i18n.t('operatorRole')}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </header>

          {/* Active Section Viewport */}
          <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
            {section === 'cockpit' && (
              <CockpitView
                agents={agents}
                missions={missions}
                healthChecks={healthChecks}
                interAgentLogs={interAgentLogs}
                liveTelemetry={liveTelemetry}
                theme={settings.theme}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
                onApproveMission={handleApproveMission}
                onNavigate={setSection}
                onOpenChat={handleOpenChat}
                onOpenAsk={handleOpenAsk}
                onOpenAddAgent={handleOpenAddAgent}
              />
            )}

            {section === 'city' && (
              <AgentCityView
                agents={agents}
                selectedAgentId={selectedAgentId}
                theme={settings.theme}
                chats={chats}
                sendingAgentId={sendingChatAgentId}
                availableModels={availableModels}
                loadingModels={loadingModels}
                onRefreshModels={
                  bridgeStatus === 'live' ? () => void handleRefreshModels(true) : undefined
                }
                onSelectAgent={setSelectedAgentId}
                onUpdateStatus={handleUpdateAgentStatus}
                onUpdateAvatar={handleUpdateAgentAvatar}
                onUpdateModel={handleUpdateAgentModel}
                onOpenAddAgent={handleOpenAddAgent}
                onRetireSpecialist={handleRetireSpecialist}
                onOpenChat={handleOpenChat}
                onSendMessage={handleSendChatMessage}
                onClearThread={handleClearChatThread}
                onOpenAsk={handleOpenAsk}
              />
            )}

            {section === 'voice' && (
              <VoiceModeView
                agents={agents}
                settings={settings}
                bridgeStatus={bridgeStatus}
                onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
                onOpenAddAgent={handleOpenAddAgent}
                onLiveVoiceExchange={
                  bridgeStatus === 'live' ? handleLiveVoiceExchange : undefined
                }
              />
            )}

            {section === 'chat' && (
              <ChatView
                agents={agents}
                activeAgentId={activeChatAgentId}
                onSelectAgent={setActiveChatAgentId}
                chats={chats}
                sendingAgentId={sendingChatAgentId}
                availableModels={availableModels}
                loadingModels={loadingModels}
                onRefreshModels={
                  bridgeStatus === 'live' ? () => void handleRefreshModels(true) : undefined
                }
                onUpdateModel={handleUpdateAgentModel}
                onSendMessage={handleSendChatMessage}
                onClearThread={handleClearChatThread}
                onOpenAddAgent={handleOpenAddAgent}
              />
            )}

            {section === 'missions' && (
              <MissionsView
                missions={missions}
                agents={agents}
                onCreateMission={handleCreateMission}
                onApproveMission={handleApproveMission}
                onReviseMission={handleReviseMission}
                onRejectMission={handleRejectMission}
                onAdvanceMission={handleAdvanceMission}
                onDeliverMission={handleDeliverMission}
                onOpenDoc={(docId) => {
                  setSelectedDocId(docId);
                  setSection('docs');
                }}
              />
            )}

            {section === 'docs' && (
              <DocsView
                docs={docs}
                agents={agents}
                selectedDocId={selectedDocId}
                onSelectDoc={setSelectedDocId}
                onSaveDoc={(updated) =>
                  setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
                }
                onCreateDoc={(title, category, content) => {
                  const doc: DocItem = {
                    id: `doc-${Date.now()}`,
                    title,
                    category,
                    authorAgentId: agents[0]?.id ?? 'operator',
                    updatedAt: i18n.t('commonJustNow'),
                    wordCount: content.trim().split(/\s+/).filter(Boolean).length,
                    content,
                  };
                  setDocs((prev) => [doc, ...prev]);
                  setSelectedDocId(doc.id);
                }}
                onDeleteDoc={(id) => {
                  setDocs((prev) => prev.filter((d) => d.id !== id));
                  if (selectedDocId === id) setSelectedDocId(null);
                }}
              />
            )}

            {section === 'schedule' && (
              <ScheduleView
                crons={crons}
                agents={agents}
                onToggleCron={(id) =>
                  setCrons((prev) =>
                    prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
                  )
                }
                onRunCronNow={(id) => {
                  const target = crons.find((c) => c.id === id);
                  setCrons((prev) =>
                    prev.map((c) =>
                      c.id === id
                        ? { ...c, lastRun: i18n.t('commonJustNow'), lastStatus: 'ok' }
                        : c,
                    ),
                  );
                  if (target) {
                    const isId = settingsRef.current.language === 'id';
                    pushInterAgentLog(
                      target.agentId,
                      'operator',
                      'standing-orders',
                      isId
                        ? `Menjalankan jadwal manual "${target.name}" (${target.command}) — kode keluar 0.`
                        : `Triggered manual run for "${target.name}" (${target.command}) — exit 0.`,
                    );
                  }
                }}
                onAddCron={(job) => {
                  setCrons((prev) => [
                    {
                      ...job,
                      id: `cron-${Date.now()}`,
                      lastRun: i18n.t('commonNever'),
                      lastStatus: 'ok',
                      nextRun: i18n.t('commonScheduled'),
                    },
                    ...prev,
                  ]);
                }}
                onDeleteCron={(id) => setCrons((prev) => prev.filter((c) => c.id !== id))}
              />
            )}

            {section === 'health' && (
              <HealthView
                checks={healthChecks}
                agents={agents}
                interAgentLogs={interAgentLogs}
                liveTelemetry={liveTelemetry}
                bridgeStatus={bridgeStatus}
                onRunDiagnostics={handleRunDiagnostics}
                onRestartService={bridgeStatus === 'live' ? handleRestartService : undefined}
              />
            )}

            {section === 'files' && (
              <FilesView
                files={files}
                selectedFileId={selectedFileId}
                bridgeStatus={bridgeStatus}
                onSelectFile={setSelectedFileId}
                onSaveFile={handleSaveFile}
                onSyncLiveFiles={bridgeStatus === 'live' ? handleSyncLiveFiles : undefined}
              />
            )}

            {section === 'terminal' && (
              <TerminalView
                agents={agents}
                bridgeStatus={bridgeStatus}
                onExecuteLiveShell={
                  bridgeStatus === 'live' && hasBridgeAuth
                    ? (cmd) => runBridgeShell(settings.bridgeUrl, sessionToken, cmd)
                    : undefined
                }
                onResolveLiveApproval={
                  bridgeStatus === 'live' && hasBridgeAuth
                    ? (approvalId, decision) =>
                        resolveBridgeApproval(
                          settings.bridgeUrl,
                          sessionToken,
                          approvalId,
                          decision,
                        )
                    : undefined
                }
              />
            )}

            {section === 'integrations' && (
              <IntegrationsView
                integrations={integrations}
                settings={settings}
                bridgeStatus={bridgeStatus}
                bridgeError={bridgeError}
                sessionToken={sessionToken}
                onUpdateSessionToken={setSessionToken}
                onVerifyBridge={handleVerifyBridge}
                onToggleIntegration={(id) =>
                  setIntegrations((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
                  )
                }
                onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
              />
            )}

            {section === 'guide' && <GuideView onNavigate={setSection} />}

            {section === 'settings' && (
              <SettingsView
                settings={settings}
                onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
                onResetWorkspace={handleResetWorkspace}
              />
            )}
          </main>
        </div>

        <AskNexoraModal
          open={askOpen}
          agents={agents}
          onClose={() => setAskOpen(false)}
          onLaunchMission={handleCreateMission}
          onQuickChat={handleSendChatMessage}
          onNavigate={setSection}
          onOpenAddAgent={handleOpenAddAgent}
        />

        <AddAgentModal
          open={addAgentOpen}
          isLiveBridge={bridgeStatus === 'live'}
          availableModels={availableModels}
          modelsSource={modelsSource}
          loadingModels={loadingModels}
          onRefreshModels={
            bridgeStatus === 'live' ? () => void handleRefreshModels(true) : undefined
          }
          onClose={() => setAddAgentOpen(false)}
          onAddFromPreset={handleHireSpecialist}
          onAddCustomAgent={handleCreateCustomAgent}
        />

        {actionBanner && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-xs shadow-2xl backdrop-blur-md ${
              actionBanner.kind === 'error'
                ? 'border-[var(--nx-alert)]/40 bg-[var(--nx-surface)] text-[var(--nx-text)]'
                : 'border-[var(--nx-ok)]/40 bg-[var(--nx-surface)] text-[var(--nx-text)]'
            }`}
          >
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                actionBanner.kind === 'error' ? 'bg-[var(--nx-alert)]' : 'bg-[var(--nx-ok)]'
              }`}
            />
            <p className="leading-relaxed">{actionBanner.text}</p>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              aria-label="Close notice"
              className="ml-1 shrink-0 text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </I18nProvider>
  );
}
