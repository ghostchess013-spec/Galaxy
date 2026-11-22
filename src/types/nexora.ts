export type NavSection =
  | 'cockpit'
  | 'voice'
  | 'chat'
  | 'missions'
  | 'docs'
  | 'schedule'
  | 'city'
  | 'health'
  | 'files'
  | 'terminal'
  | 'integrations'
  | 'guide'
  | 'settings';

export type ThemeId = 'obsidian-ember' | 'editorial-alabaster' | 'tactical-phosphor';

export type AgentStatus = 'working' | 'idle' | 'alert';

export type BuildingArchetype =
  | 'hq_spire'
  | 'observatory_dome'
  | 'ribbed_tower'
  | 'octagonal_citadel'
  | 'curved_atelier'
  | 'signal_spire'
  | 'cantilever_loft'
  | 'stepped_ziggurat'
  | 'stacked_stage'
  | 'twin_towers'
  | 'care_pavilion'
  | 'travel_rotunda';

export interface Agent {
  id: string;
  name: string;
  buildingName: string;
  role: string;
  department: string;
  profileKey: string;
  status: AgentStatus;
  archetype: BuildingArchetype;
  isHQ?: boolean;
  avatarUrl: string;
  model: string;
  currentTask: string;
  sessionsCount: number;
  tokensUsed: number;
  avgReplySec: number;
  uptimePct: number;
  soulSummary: string;
  tools: string[];
  /** Ring angle in radians for non-HQ towers */
  ringAngle: number;
  /** Ring distance from center */
  ringRadius: number;
}

export interface RolePreset {
  id: string;
  name: string;
  buildingName: string;
  role: string;
  department: string;
  archetype: BuildingArchetype;
  avatarUrl: string;
  model: string;
  description: string;
  tools: string[];
  soulSummary: string;
}

export type MissionStage =
  | 'briefing'
  | 'approval'
  | 'in_progress'
  | 'review'
  | 'delivered';

export type ReportLength = 'brief' | 'standard' | 'deep_dive';

export interface MissionStep {
  id: string;
  title: string;
  agentId: string;
  status: 'pending' | 'running' | 'done';
}

export interface Mission {
  id: string;
  code: string;
  title: string;
  goal: string;
  stage: MissionStage;
  reportLength: ReportLength;
  assignedAgentIds: string[];
  createdAt: string;
  updatedAgo: string;
  planSummary: string;
  steps: MissionStep[];
  revisionNote?: string;
  deliveredDocId?: string;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  sender: 'operator' | 'agent';
  content: string;
  timestamp: string;
  modelUsed?: string;
  latencyMs?: number;
  toolTrace?: string[];
  attachmentName?: string;
}

export interface DocItem {
  id: string;
  title: string;
  category: string;
  authorAgentId: string;
  missionCode?: string;
  updatedAt: string;
  wordCount: number;
  content: string;
}

export interface CronJob {
  id: string;
  name: string;
  agentId: string;
  cronExpr: string;
  cadenceLabel: string;
  nextRun: string;
  lastRun: string;
  lastStatus: 'ok' | 'running' | 'warning';
  enabled: boolean;
  command: string;
}

export interface WorkspaceFile {
  id: string;
  path: string;
  folder: string;
  agentId: string;
  language: 'markdown' | 'yaml' | 'json';
  updatedAt: string;
  content: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  category: 'core' | 'network' | 'agents' | 'storage';
  status: 'pass' | 'warn' | 'fail';
  latencyMs: number;
  detail: string;
}

export interface InterAgentLog {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  channel: string;
  message: string;
  timestamp: string;
}

export interface TerminalEntry {
  id: string;
  kind: 'input' | 'output' | 'error' | 'system' | 'gate';
  text: string;
  timestamp: string;
}

export interface PendingGateCommand {
  id: string;
  command: string;
  reason: string;
  requestedAt: string;
}

export interface IntegrationService {
  id: string;
  name: string;
  endpoint: string;
  category: 'runtime' | 'routing' | 'voice' | 'messaging' | 'network';
  status: 'connected' | 'standby' | 'simulated';
  description: string;
  enabled: boolean;
}

export type LanguageId = 'en' | 'id';

export interface OperatorSettings {
  operatorName: string;
  cityLabel: string;
  timezone: string;
  theme: ThemeId;
  language: LanguageId;
  voiceEngine: 'edge-tts' | 'browser-tts';
  edgeVoiceId: string;
  autoSpeakReplies: boolean;
  bridgeMode: 'demo' | 'live';
  bridgeUrl: string;
  /** Session-only bearer token held in memory (never written to localStorage) */
  bridgeToken: string;
  showOnlyVpsAgents: boolean;
  dashboardPinEnabled: boolean;
  dashboardPin: string;
}

export type BridgeConnectionStatus = 'demo' | 'connecting' | 'live' | 'error';

export interface BridgeServiceStatus {
  name: string;
  unit: string;
  state: string;
  healthy: boolean;
  latency_ms?: number;
}

export interface BridgePendingApproval {
  id: string;
  agent: string;
  command: string;
  time: string;
}

export interface BridgeBlackboxEntry {
  id: string;
  time: string;
  agent: string;
  category: string;
  action: string;
  detail: string;
  level: string;
}

export interface BridgeRemoteAgent {
  id: string;
  name: string;
  building_name?: string;
  role: string;
  model: string;
  arch: string;
  soul: string;
  avatar?: string;
  status: 'IDLE' | 'EXECUTING' | 'ALERT';
  task: string;
  is_core?: boolean;
}

export interface BridgeTelemetry {
  timestamp: string;
  connected: boolean;
  error?: string;
  host: string;
  command_node: {
    host: string;
    cpu_percent: number;
    cpu_cores: number;
    ram_used_gb: number;
    ram_total_gb: number;
  };
  cpu: { percent: number; cores: number };
  ram: { used_gb: number; total_gb: number; percent: number };
  disk: { used_gb: number; total_gb: number; percent: number };
  vps_alert: boolean;
  services: BridgeServiceStatus[];
  agents: BridgeRemoteAgent[];
  pending_approvals: BridgePendingApproval[];
  blackbox: BridgeBlackboxEntry[];
}

export interface SearchResult {
  id: string;
  type: 'agent' | 'mission' | 'doc' | 'schedule' | 'file';
  title: string;
  subtitle: string;
  targetSection: NavSection;
  targetId: string;
}
