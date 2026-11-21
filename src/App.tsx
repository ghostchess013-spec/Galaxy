import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  CalendarClock,
  Compass,
  FileCode2,
  FileText,
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
  buildTelemetryWebSocketUrl,
  createBridgeAgent,
  deleteBridgeAgent,
  fetchBridgeFiles,
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
} from './services/nexoraBridge';

const STORAGE_KEY = 'nexora_mission_control_v3';

interface PersistedState {
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
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      agents: parsed.agents?.length ? parsed.agents : INITIAL_AGENTS,
      missions: parsed.missions?.length ? parsed.missions : INITIAL_MISSIONS,
      chats: parsed.chats ?? INITIAL_CHATS,
      docs: parsed.docs?.length ? parsed.docs : INITIAL_DOCS,
      crons: parsed.crons?.length ? parsed.crons : INITIAL_CRON_JOBS,
      files: parsed.files?.length ? parsed.files : INITIAL_FILES,
      integrations: parsed.integrations?.length ? parsed.integrations : INITIAL_INTEGRATIONS,
      interAgentLogs: parsed.interAgentLogs?.length
        ? parsed.interAgentLogs
        : INITIAL_INTER_AGENT_LOGS,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
        // Never restore secret bearer tokens from localStorage
        bridgeToken: '',
      },
    };
  } catch {
    return {
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

const PRIMARY_NAV: Array<{ id: NavSection; label: string; icon: typeof Compass }> = [
  { id: 'cockpit', label: 'Cockpit', icon: Compass },
  { id: 'voice', label: 'Voice Mode', icon: Mic },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'missions', label: 'Missions', icon: Target },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'city', label: 'Agent City', icon: Building2 },
  { id: 'health', label: 'Health', icon: Activity },
];

const MANAGE_NAV: Array<{ id: NavSection; label: string; icon: typeof Compass }> = [
  { id: 'files', label: 'Files', icon: FileCode2 },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'integrations', label: 'Integrations', icon: PlugZap },
  { id: 'guide', label: 'Guide', icon: HelpCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

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

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('executor');
  const [activeChatAgentId, setActiveChatAgentId] = useState<string>('executor');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(initial.docs[0]?.id ?? null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    initial.files[0]?.id ?? null,
  );
  const [askOpen, setAskOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [clockText, setClockText] = useState('');

  const [sessionToken, setSessionToken] = useState<string>(() => parseAndScrubUrlToken());
  const [bridgeStatus, setBridgeStatus] = useState<BridgeConnectionStatus>('demo');
  const [bridgeError, setBridgeError] = useState<string>('');
  const [liveTelemetry, setLiveTelemetry] = useState<BridgeTelemetry | null>(null);
  const [sendingChatAgentId, setSendingChatAgentId] = useState<string | null>(null);

  const [locked, setLocked] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return false;
    return Boolean(initial.settings.dashboardPinEnabled);
  });
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');

  // Auto-detect when served directly from VPS 2 nexora-bridge (:9120)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const health = await probeBridgeHealth('', 2000);
      if (cancelled) return;
      if (health.ok) {
        setSettings((prev) => ({
          ...prev,
          bridgeMode: 'live',
          bridgeUrl: '',
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Maintain live WebSocket telemetry stream when in Live Bridge mode
  useEffect(() => {
    if (settings.bridgeMode !== 'live') {
      setBridgeStatus('demo');
      setBridgeError('');
      setLiveTelemetry(null);
      return;
    }

    if (!sessionToken) {
      setBridgeStatus('error');
      setBridgeError('Enter your NEXORA_TOKEN in Integrations or open via ?token= link.');
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
              setLiveTelemetry(snap);
              setBridgeStatus(snap.connected ? 'live' : 'error');
              if (!snap.connected && snap.error) {
                setBridgeError(snap.error);
              }
              setAgents((prevAgents) => {
                const merged = mergeBridgeTelemetry(
                  snap,
                  prevAgents,
                  INITIAL_HEALTH_CHECKS,
                  settings.showOnlyVpsAgents,
                );
                setHealthChecks(merged.healthChecks);
                if (merged.interAgentLogs.length > 0) {
                  setInterAgentLogs(merged.interAgentLogs);
                }
                return merged.agents;
              });
            }
          } catch {
            // Ignore malformed telemetry frames
          }
        };

        ws.onerror = () => {
          if (disposed) return;
          setBridgeStatus('error');
          setBridgeError('Unable to reach nexora-bridge WebSocket — check Tailscale & port 9120.');
        };

        ws.onclose = (ev) => {
          if (disposed) return;
          if (ev.code === 1008) {
            setBridgeStatus('error');
            setBridgeError('Invalid NEXORA_TOKEN (401). Update your session token in Integrations.');
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
  }, [settings.bridgeMode, settings.bridgeUrl, settings.showOnlyVpsAgents, sessionToken]);

  // Sync theme attribute on documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    if (settings.theme === 'editorial-alabaster') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [settings.theme]);

  // Persist workspace state to localStorage (explicitly stripping session bearer token)
  useEffect(() => {
    try {
      const payload: PersistedState = {
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
  }, [agents, missions, chats, docs, crons, files, integrations, interAgentLogs, settings]);

  // Live city clock in top bar
  useEffect(() => {
    const updateClock = () => {
      try {
        const formatted = new Intl.DateTimeFormat('en-GB', {
          timeZone: settings.timezone,
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
  }, [settings.timezone]);

  // Keyboard shortcut Cmd/Ctrl + K opens Ask NEXORA
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

  const pushInterAgentLog = (fromAgentId: string, toAgentId: string, channel: string, message: string) => {
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
    pushInterAgentLog(
      'executor',
      created.assignedAgentIds[1] ?? 'research',
      `mission-${created.code.toLowerCase()}`,
      `Drafted plan for ${created.code} (${created.title}). Holding execution until Operator approves.`,
    );
  };

  const handleApproveMission = (missionId: string) => {
    const target = missions.find((m) => m.id === missionId);
    setMissions((prev) => approveMissionPlan(prev, missionId));
    if (target) {
      // Mark assigned specialists as actively working in 3D Agent City!
      setAgents((prev) =>
        prev.map((a) =>
          target.assignedAgentIds.includes(a.id)
            ? { ...a, status: 'working', currentTask: `Executing ${target.code}: ${target.title}` }
            : a,
        ),
      );
      pushInterAgentLog(
        'executor',
        target.assignedAgentIds[1] ?? 'research',
        `mission-${target.code.toLowerCase()}`,
        `Operator approved ${target.code}. Dispatching active step now.`,
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
    pushInterAgentLog(
      'executor',
      'content',
      'docs-library',
      `Filed completed deliverable "${doc.title}" (${doc.wordCount} words) to Docs Library.`,
    );
  };

  const handleUpdateAgentStatus = (agentId: string, status: AgentStatus) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status,
              currentTask:
                status === 'working'
                  ? 'Executing live priority dispatch from Operator'
                  : status === 'alert'
                    ? 'Flagged for manual inspection by Operator'
                    : 'Standing by on island plaza',
            }
          : a,
      ),
    );
  };

  const handleHireSpecialist = (
    preset: RolePreset,
    customName?: string,
    customBuilding?: string,
    customAvatarUrl?: string,
  ) => {
    const { agents: nextAgents, hired } = hireSpecialist(
      agents,
      preset,
      customName,
      customBuilding,
      customAvatarUrl,
    );
    setAgents(nextAgents);
    setSelectedAgentId(hired.id);
    pushInterAgentLog(
      'executor',
      hired.id,
      'agent-city',
      `Constructed ${hired.buildingName} and onboarded ${hired.name} (${hired.role}).`,
    );

    if (bridgeStatus === 'live' && sessionToken) {
      void createBridgeAgent(settings.bridgeUrl, sessionToken, {
        slug: hired.profileKey,
        role: hired.role,
        model: hired.model,
        arch: hired.archetype,
        avatar: hired.avatarUrl,
        soul: `# SOUL.md — ${hired.name}\n\n${hired.soulSummary}\n`,
      })
        .then(() => fetchBridgeStatus(settings.bridgeUrl, sessionToken))
        .then((fresh) => setLiveTelemetry(fresh))
        .catch(() => {
          // Optimistic tower stays visible; next WS sync reconciles server state
        });
    }
  };

  const handleCreateCustomAgent = (draft: CustomAgentDraft) => {
    const { agents: nextAgents, hired } = createCustomAgent(agents, draft);
    setAgents(nextAgents);
    setSelectedAgentId(hired.id);
    pushInterAgentLog(
      'executor',
      hired.id,
      'agent-city',
      `Provisioned custom Hermes profile ~/.hermes/profiles/${hired.profileKey} (${hired.buildingName}).`,
    );

    if (bridgeStatus === 'live' && sessionToken) {
      void createBridgeAgent(settings.bridgeUrl, sessionToken, {
        slug: hired.profileKey,
        role: hired.role,
        model: hired.model,
        arch: hired.archetype,
        avatar: hired.avatarUrl,
        soul: `# SOUL.md — ${hired.name}\n\n${hired.soulSummary}\n`,
      })
        .then(() => fetchBridgeStatus(settings.bridgeUrl, sessionToken))
        .then((fresh) => setLiveTelemetry(fresh))
        .catch(() => {});
    }
  };

  const handleUpdateAgentAvatar = (agentId: string, avatarUrl: string) => {
    const target = agents.find((a) => a.id === agentId);
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, avatarUrl } : a)));
    if (target && bridgeStatus === 'live' && sessionToken) {
      const slug = target.isHQ ? 'default' : target.profileKey;
      void updateBridgeAgentAvatar(settings.bridgeUrl, sessionToken, slug, avatarUrl).catch(
        () => {},
      );
    }
  };

  const handleRetireSpecialist = (agentId: string) => {
    const target = agents.find((a) => a.id === agentId);
    const { agents: nextAgents, removed } = retireSpecialist(agents, agentId);
    if (removed) {
      setAgents(nextAgents);
      setSelectedAgentId('executor');
      if (target) {
        pushInterAgentLog(
          'executor',
          'guardian',
          'agent-city',
          `Decommissioned ${target.buildingName} (${target.name}) and archived workspace.`,
        );
        if (
          bridgeStatus === 'live' &&
          sessionToken &&
          target.profileKey !== 'default' &&
          target.profileKey !== 'vps-guardian'
        ) {
          void deleteBridgeAgent(settings.bridgeUrl, sessionToken, target.profileKey).catch(() => {});
        }
      }
    }
  };

  const handleSendChatMessage = (agentId: string, content: string, attachmentName?: string) => {
    const agent = agents.find((a) => a.id === agentId) ?? agents[0];
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const operatorMsg: ChatMessage = {
      id: `cm-u-${Date.now()}`,
      agentId: agent.id,
      sender: 'operator',
      content: content.trim(),
      timestamp: ts,
      attachmentName,
    };

    if (bridgeStatus === 'live' && sessionToken) {
      setChats((prev) => ({
        ...prev,
        [agent.id]: [...(prev[agent.id] ?? []), operatorMsg],
      }));
      setSendingChatAgentId(agent.id);
      void sendBridgeChat(settings.bridgeUrl, sessionToken, {
        agent_id: agent.isHQ ? 'default' : agent.profileKey,
        message: content.trim(),
        model: 'combo-best',
      })
        .then((res) => {
          const agentMsg: ChatMessage = {
            id: `cm-a-${Date.now() + 1}`,
            agentId: agent.id,
            sender: 'agent',
            content: res.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelUsed: res.model,
            latencyMs: res.latency_ms,
            toolTrace: ['9router :20128', `profile:${agent.profileKey}`],
          };
          setChats((prev) => ({
            ...prev,
            [agent.id]: [...(prev[agent.id] ?? []), agentMsg],
          }));
        })
        .catch((err) => {
          const errMsg: ChatMessage = {
            id: `cm-e-${Date.now() + 1}`,
            agentId: agent.id,
            sender: 'agent',
            content: `Live bridge error: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setChats((prev) => ({
            ...prev,
            [agent.id]: [...(prev[agent.id] ?? []), errMsg],
          }));
        })
        .finally(() => {
          setSendingChatAgentId((cur) => (cur === agent.id ? null : cur));
        });
      return;
    }

    const reply = generateAgentReply(agent, content, agents);
    const agentMsg: ChatMessage = {
      id: `cm-a-${Date.now() + 1}`,
      agentId: agent.id,
      sender: 'agent',
      content: reply.text,
      timestamp: ts,
      modelUsed: agent.model,
      latencyMs: 920 + Math.round(agent.avgReplySec * 140),
      toolTrace: reply.toolTrace,
    };

    setChats((prev) => ({
      ...prev,
      [agent.id]: [...(prev[agent.id] ?? []), operatorMsg, agentMsg],
    }));

    setAgents((prev) =>
      prev.map((a) =>
        a.id === agent.id
          ? { ...a, sessionsCount: a.sessionsCount + 1, tokensUsed: a.tokensUsed + 1480 }
          : a,
      ),
    );
  };

  const handleOpenChat = (agentId: string) => {
    setActiveChatAgentId(agentId);
    setSection('chat');
  };

  const handleRunDiagnostics = () => {
    if (bridgeStatus === 'live' && sessionToken) {
      void fetchBridgeStatus(settings.bridgeUrl, sessionToken)
        .then((snap) => {
          setLiveTelemetry(snap);
          const merged = mergeBridgeTelemetry(
            snap,
            agents,
            INITIAL_HEALTH_CHECKS,
            settings.showOnlyVpsAgents,
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
    pushInterAgentLog(
      'guardian',
      'executor',
      'fleet-telemetry',
      'Completed 21-point diagnostic sweep on hermesagent (100.72.221.36): 21 of 21 pass.',
    );
  };

  const handleVerifyBridge = async (): Promise<string> => {
    if (settings.bridgeMode === 'demo') {
      return 'Demo Simulation active — switch to Live VPS Bridge when accessing via Tailscale.';
    }
    const health = await probeBridgeHealth(settings.bridgeUrl, 4000);
    if (!health.ok) {
      setBridgeStatus('error');
      return `Could not reach /api/health at ${settings.bridgeUrl || 'same-origin'}. Ensure Tailscale is active and nexora-bridge is running on port 9120.`;
    }
    if (!sessionToken) {
      return `Bridge v${health.version ?? '3.0'} online (${health.main_vps}), but Session Bearer Token is empty.`;
    }
    try {
      const snap = await fetchBridgeStatus(settings.bridgeUrl, sessionToken);
      setLiveTelemetry(snap);
      setBridgeStatus(snap.connected ? 'live' : 'error');
      const merged = mergeBridgeTelemetry(
        snap,
        agents,
        INITIAL_HEALTH_CHECKS,
        settings.showOnlyVpsAgents,
      );
      setAgents(merged.agents);
      setHealthChecks(merged.healthChecks);
      return snap.connected
        ? `Live connected to ${snap.host} (Bridge v${health.version ?? '3.0'}) · CPU ${snap.cpu.percent}%, RAM ${snap.ram.used_gb}/${snap.ram.total_gb} GB.`
        : `Bridge reachable, waiting on SSH link: ${snap.error ?? 'Check SSH key on hermesagent'}`;
    } catch (err) {
      setBridgeStatus('error');
      return `Auth/status error: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  const handleSyncLiveFiles = async () => {
    if (bridgeStatus !== 'live' || !sessionToken) return;
    const res = await fetchBridgeFiles(settings.bridgeUrl, sessionToken);
    if (res.ok && res.files.length > 0) {
      setFiles(res.files);
      setSelectedFileId(res.files[0].id);
    }
  };

  const handleSaveFile = async (id: string, content: string) => {
    const target = files.find((f) => f.id === id);
    if (bridgeStatus === 'live' && sessionToken && target) {
      await saveBridgeFile(settings.bridgeUrl, sessionToken, target.path, content);
    }
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, content, updatedAt: 'Saved just now' } : f)),
    );
  };

  const handleRestartService = async (unit: string) => {
    if (bridgeStatus !== 'live' || !sessionToken) return;
    await restartBridgeService(settings.bridgeUrl, sessionToken, unit);
    handleRunDiagnostics();
  };

  const handleLiveVoiceExchange = async (agent: Agent, promptText: string) => {
    const chatRes = await sendBridgeChat(settings.bridgeUrl, sessionToken, {
      agent_id: agent.isHQ ? 'default' : agent.profileKey,
      message: promptText,
      model: 'combo-best',
    });
    let audioBlob: Blob | undefined;
    if (settings.autoSpeakReplies) {
      try {
        const tts = await speakViaBridge(settings.bridgeUrl, sessionToken, {
          agent_id: agent.isHQ ? 'default' : agent.profileKey,
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
      engineLabel: audioBlob ? 'VoiceStudio :3900 (Live Audio)' : `${chatRes.model} · Browser TTS`,
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
    setSettings(DEFAULT_SETTINGS);
    setSelectedAgentId('executor');
  };

  // Optional Dashboard PIN Lock screen
  if (locked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--nx-bg)] p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pinEntry === settings.dashboardPin) {
              setLocked(false);
              setPinEntry('');
              setPinError('');
            } else {
              setPinError('Invalid PIN. Try again.');
            }
          }}
          className="w-full max-w-sm rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] p-6 space-y-4 text-center"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] tracking-[0.16em] uppercase text-[var(--nx-text-muted)]">
              GALAXY Operator System
            </p>
            <h1 className="font-editorial text-2xl mt-1 text-[var(--nx-text)]">
              Dashboard <span className="italic text-[var(--nx-accent)]">Locked.</span>
            </h1>
          </div>
          <input
            type="password"
            value={pinEntry}
            onChange={(e) => setPinEntry(e.target.value)}
            placeholder="Enter access PIN"
            className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2.5 text-center font-mono text-sm tracking-[0.3em] text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
          />
          {pinError && <p className="text-xs text-[var(--nx-alert)]">{pinError}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--nx-accent)] py-2.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] cursor-pointer"
          >
            Unlock Mission Control
          </button>
        </form>
      </div>
    );
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Brand Monogram Header matching NEXORA 3.0 */}
        <button
          type="button"
          onClick={() => {
            setSection('cockpit');
            setMobileNavOpen(false);
          }}
          className="flex items-center gap-3 px-2 text-left cursor-pointer"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] font-editorial text-base font-semibold text-[var(--nx-text)] shrink-0">
            G
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-[0.12em] text-[var(--nx-text)] leading-none">
              GALAXY
            </div>
            <div className="text-[9px] tracking-[0.16em] uppercase text-[var(--nx-text-subtle)] mt-1">
              Operator System
            </div>
          </div>
        </button>

        {/* Primary Fleet Navigation (Hand Mode & Mini-Game intentionally excluded per user request) */}
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
                  <span className="tracking-[0.04em] uppercase text-[11px]">{item.label}</span>
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
            Manage
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
                  <span className="tracking-[0.04em] uppercase text-[11px]">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Signature Bottom ASK NEXORA CTA Button */}
      <div className="pt-4 border-t border-[var(--nx-border)]">
        <button
          type="button"
          onClick={() => {
            setAskOpen(true);
            setMobileNavOpen(false);
          }}
          className="w-full rounded-lg bg-[var(--nx-accent)] py-2.5 px-4 text-xs font-bold tracking-[0.12em] uppercase text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer shadow-md"
        >
          Ask GALAXY
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex bg-[var(--nx-bg)] text-[var(--nx-text)]"
      data-active-section={section}
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
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 rounded-lg p-1.5 text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            {renderSidebarContent()}
          </div>
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            className="flex-1 bg-black/65"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Bar matching NEXORA 3.0 */}
        <header className="sticky top-0 z-30 h-14 border-b border-[var(--nx-border)] bg-[var(--nx-bg)]/95 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg border border-[var(--nx-border-strong)] p-2 text-[var(--nx-text)] cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold tracking-[0.12em]">GALAXY</span>
          </div>

          {/* Centered Global Search */}
          <div className="relative flex-1 max-w-md mx-auto">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--nx-text-subtle)]"
              aria-hidden="true"
            />
            <label htmlFor="global-nexora-search" className="sr-only">
              Search agents, missions, docs, or logs
            </label>
            <input
              id="global-nexora-search"
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents, missions, docs, files..."
              className="w-full rounded-full border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] pl-9 pr-4 py-1.5 text-xs text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
            />

            {searchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] shadow-2xl overflow-hidden z-40">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-[var(--nx-text-muted)]">
                    No matching agents, missions, or docs found.
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
                            {hit.type}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right Mode Link + Clock + Operator Chip */}
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <button
              type="button"
              onClick={() => setSection('integrations')}
              className="text-right leading-tight hover:opacity-80 transition-opacity cursor-pointer"
              title="Configure Live VPS Bridge or VPS 2 Migration"
            >
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--nx-text-subtle)]">
                {bridgeStatus === 'live'
                  ? 'LIVE BRIDGE'
                  : bridgeStatus === 'connecting'
                    ? 'CONNECTING'
                    : bridgeStatus === 'error'
                      ? 'BRIDGE OFFLINE'
                      : 'PREVIEW MODE'}
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
                {bridgeStatus === 'live' ? 'hermesagent :9120' : 'Deploy to VPS 2'}
              </div>
            </button>

            <div className="text-right leading-tight">
              <div className="text-[10px] tracking-[0.14em] uppercase text-[var(--nx-text-subtle)]">
                {settings.cityLabel}
              </div>
              <div className="font-mono text-xs font-medium text-[var(--nx-text)] tabular-nums">
                {clockText || '00:00:00'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSection('settings')}
              className="flex items-center gap-2.5 rounded-full border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] pl-1.5 pr-3 py-1 hover:border-[var(--nx-accent)] transition-colors cursor-pointer"
              aria-label="Open Operator Settings"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--nx-surface-hover)] text-[11px] font-semibold text-[var(--nx-text)]">
                {settings.operatorName.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-left leading-tight">
                <span className="block text-xs font-semibold text-[var(--nx-text)]">
                  {settings.operatorName}
                </span>
                <span className="block text-[9px] tracking-[0.12em] uppercase text-[var(--nx-text-subtle)]">
                  Operator
                </span>
              </span>
            </button>
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
              onOpenAsk={() => setAskOpen(true)}
              onOpenAddAgent={() => setAddAgentOpen(true)}
            />
          )}

          {section === 'city' && (
            <AgentCityView
              agents={agents}
              selectedAgentId={selectedAgentId}
              theme={settings.theme}
              onSelectAgent={setSelectedAgentId}
              onUpdateStatus={handleUpdateAgentStatus}
              onUpdateAvatar={handleUpdateAgentAvatar}
              onOpenAddAgent={() => setAddAgentOpen(true)}
              onRetireSpecialist={handleRetireSpecialist}
              onOpenChat={handleOpenChat}
              onOpenAsk={() => setAskOpen(true)}
            />
          )}

          {section === 'voice' && (
            <VoiceModeView
              agents={agents}
              settings={settings}
              bridgeStatus={bridgeStatus}
              onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
              onLiveVoiceExchange={bridgeStatus === 'live' ? handleLiveVoiceExchange : undefined}
            />
          )}

          {section === 'chat' && (
            <ChatView
              agents={agents}
              activeAgentId={activeChatAgentId}
              onSelectAgent={setActiveChatAgentId}
              chats={chats}
              sendingAgentId={sendingChatAgentId}
              onSendMessage={handleSendChatMessage}
              onClearThread={(id) =>
                setChats((prev) => ({
                  ...prev,
                  [id]: [],
                }))
              }
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
                  authorAgentId: 'executor',
                  updatedAt: 'Just now',
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
                    c.id === id ? { ...c, lastRun: 'Just now', lastStatus: 'ok' } : c,
                  ),
                );
                if (target) {
                  pushInterAgentLog(
                    target.agentId,
                    'executor',
                    'standing-orders',
                    `Triggered manual run for "${target.name}" (${target.command}) — exit 0.`,
                  );
                }
              }}
              onAddCron={(job) => {
                setCrons((prev) => [
                  {
                    ...job,
                    id: `cron-${Date.now()}`,
                    lastRun: 'Never',
                    lastStatus: 'ok',
                    nextRun: 'Scheduled',
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
                bridgeStatus === 'live' && sessionToken
                  ? (cmd) => runBridgeShell(settings.bridgeUrl, sessionToken, cmd)
                  : undefined
              }
              onResolveLiveApproval={
                bridgeStatus === 'live' && sessionToken
                  ? (approvalId, decision) =>
                      resolveBridgeApproval(settings.bridgeUrl, sessionToken, approvalId, decision)
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
        onClose={() => setAskOpen(false)}
        onLaunchMission={handleCreateMission}
        onQuickChat={handleSendChatMessage}
        onNavigate={setSection}
      />

      <AddAgentModal
        open={addAgentOpen}
        isLiveBridge={bridgeStatus === 'live'}
        onClose={() => setAddAgentOpen(false)}
        onAddFromPreset={handleHireSpecialist}
        onAddCustomAgent={handleCreateCustomAgent}
      />
    </div>
  );
}
