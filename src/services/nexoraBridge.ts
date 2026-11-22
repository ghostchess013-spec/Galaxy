import type {
  Agent,
  AgentStatus,
  BridgeTelemetry,
  BuildingArchetype,
  HealthCheck,
  InterAgentLog,
  WorkspaceFile,
} from '../types/nexora';
import { pickAutoPortrait } from '../data/seedData';
import { rebalanceCitySlots } from '../utils/nexoraLogic';

const VALID_ARCHETYPES: BuildingArchetype[] = [
  'hq_spire',
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

export function parseAndScrubUrlToken(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token')?.trim() ?? '';
  if (token) {
    params.delete('token');
    const nextSearch = params.toString();
    const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl);
  }
  return token;
}

export function normalizeBridgeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (typeof window !== 'undefined' && trimmed === window.location.origin) {
    return '';
  }
  return trimmed;
}

export async function probeBridgeHealth(
  baseUrl: string,
  timeoutMs = 2500,
): Promise<{
  ok: boolean;
  authenticated?: boolean;
  version?: string;
  main_vps?: string;
  time?: string;
}> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const prefix = normalizeBridgeBaseUrl(baseUrl);
    const res = await fetch(`${prefix}/api/health`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return { ok: false };
    const data = (await res.json()) as {
      ok?: boolean;
      authenticated?: boolean;
      version?: string;
      main_vps?: string;
      time?: string;
    };
    return {
      ok: Boolean(data.ok && data.main_vps),
      authenticated: Boolean(data.authenticated),
      version: data.version,
      main_vps: data.main_vps,
      time: data.time,
    };
  } catch {
    return { ok: false };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function establishBridgeSession(
  baseUrl: string,
  token: string,
): Promise<{ ok: boolean; authenticated: boolean }> {
  if (!token.trim()) return { ok: false, authenticated: false };
  try {
    const prefix = normalizeBridgeBaseUrl(baseUrl);
    const res = await fetch(`${prefix}/api/auth/session`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'galaxy-ui',
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return { ok: false, authenticated: false };
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; authenticated?: boolean };
    return { ok: Boolean(data.ok), authenticated: Boolean(data.authenticated) };
  } catch {
    return { ok: false, authenticated: false };
  }
}

async function bridgeJson<T>(
  baseUrl: string,
  token: string,
  path: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);
  try {
    const prefix = normalizeBridgeBaseUrl(baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'galaxy-ui',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${prefix}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { detail: text };
    }
    if (!res.ok) {
      const detail =
        typeof parsed === 'object' && parsed !== null && 'detail' in parsed
          ? String((parsed as { detail: unknown }).detail)
          : `HTTP ${res.status}`;
      throw new Error(detail);
    }
    return parsed as T;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function fetchBridgeStatus(baseUrl: string, token: string): Promise<BridgeTelemetry> {
  return bridgeJson<BridgeTelemetry>(baseUrl, token, '/api/status', { timeoutMs: 12000 });
}

export async function sendBridgeChat(
  baseUrl: string,
  token: string,
  payload: {
    agent_id: string;
    message: string;
    model?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
): Promise<{
  ok: boolean;
  reply: string;
  model: string;
  latency_ms?: number;
  runtime?: string;
  tools_enabled?: boolean;
}> {
  return bridgeJson(baseUrl, token, '/api/chat', {
    method: 'POST',
    body: payload,
    timeoutMs: 90000,
  });
}

export async function speakViaBridge(
  baseUrl: string,
  token: string,
  payload: { agent_id: string; text: string; voice?: string },
): Promise<{ audioBlob?: Blob; ok: boolean; detail?: string }> {
  const prefix = normalizeBridgeBaseUrl(baseUrl);
  const res = await fetch(`${prefix}/api/voice/speak`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'galaxy-ui',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const ct = res.headers.get('content-type') ?? '';
  if (res.ok && (ct.includes('audio/') || ct.includes('application/octet-stream'))) {
    const audioBlob = await res.blob();
    return { ok: true, audioBlob };
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: string };
  return { ok: Boolean(data.ok), detail: data.detail };
}

export async function runBridgeShell(
  baseUrl: string,
  token: string,
  command: string,
  agentId = 'vps-guardian',
): Promise<{
  ok: boolean;
  status?: string;
  approval_id?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  code?: number;
}> {
  return bridgeJson(baseUrl, token, '/api/shell', {
    method: 'POST',
    body: { agent_id: agentId, command },
    timeoutMs: 25000,
  });
}

export async function resolveBridgeApproval(
  baseUrl: string,
  token: string,
  approvalId: string,
  decision: 'approve' | 'reject',
): Promise<{ ok: boolean; status?: string; stdout?: string; stderr?: string }> {
  return bridgeJson(baseUrl, token, `/api/approvals/${encodeURIComponent(approvalId)}/${decision}`, {
    method: 'POST',
    timeoutMs: 25000,
  });
}

export async function createBridgeAgent(
  baseUrl: string,
  token: string,
  payload: {
    slug: string;
    name?: string;
    building_name?: string;
    role: string;
    model: string;
    arch: string;
    soul?: string;
    avatar?: string;
  },
): Promise<{
  ok: boolean;
  slug?: string;
  skills_linked?: boolean;
  env_copied?: boolean;
  config_copied?: boolean;
}> {
  return bridgeJson(baseUrl, token, '/api/agents', { method: 'POST', body: payload });
}

export async function updateBridgeAgentAvatar(
  baseUrl: string,
  token: string,
  agentId: string,
  avatar: string,
): Promise<{ ok: boolean }> {
  return bridgeJson(baseUrl, token, `/api/agents/${encodeURIComponent(agentId)}/avatar`, {
    method: 'PUT',
    body: { avatar },
  });
}

export async function deleteBridgeAgent(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<{ ok: boolean }> {
  return bridgeJson(baseUrl, token, `/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
  });
}

export async function fetchBridgeFiles(
  baseUrl: string,
  token: string,
): Promise<{ ok: boolean; files: WorkspaceFile[] }> {
  return bridgeJson(baseUrl, token, '/api/files', { timeoutMs: 12000 });
}

export async function saveBridgeFile(
  baseUrl: string,
  token: string,
  path: string,
  content: string,
): Promise<{ ok: boolean; path: string }> {
  return bridgeJson(baseUrl, token, '/api/files', {
    method: 'PUT',
    body: { path, content },
    timeoutMs: 12000,
  });
}

export async function restartBridgeService(
  baseUrl: string,
  token: string,
  unit: string,
): Promise<{ ok: boolean; stdout?: string; stderr?: string }> {
  return bridgeJson(baseUrl, token, `/api/systemd/${encodeURIComponent(unit)}/restart`, {
    method: 'POST',
    timeoutMs: 18000,
  });
}

export function buildTelemetryWebSocketUrl(baseUrl: string, token: string): string {
  const prefix = normalizeBridgeBaseUrl(baseUrl);
  let wsBase: string;
  if (!prefix) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = `${proto}//${window.location.host}`;
  } else {
    wsBase = prefix.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  }
  const cleanToken = token.trim();
  return cleanToken ? `${wsBase}/ws?token=${encodeURIComponent(cleanToken)}` : `${wsBase}/ws`;
}

function mapRemoteStatus(remoteStatus: 'IDLE' | 'EXECUTING' | 'ALERT'): AgentStatus {
  if (remoteStatus === 'ALERT') return 'alert';
  if (remoteStatus === 'EXECUTING') return 'working';
  return 'idle';
}

function coerceArchetype(raw: string, fallback: BuildingArchetype): BuildingArchetype {
  return VALID_ARCHETYPES.includes(raw as BuildingArchetype)
    ? (raw as BuildingArchetype)
    : fallback;
}

/**
 * The user's 2 main Telegram bots (default / Executor & vps-guardian / Guardian)
 * remain strictly isolated on Telegram and are never synced into this dashboard.
 */
export const EXCLUDED_CORE_PROFILE_KEYS: ReadonlySet<string> = new Set([
  'default',
  'vps-guardian',
  'executor',
  'guardian',
]);

/**
 * Pure reconciliation helper: maps live hermesagent profiles, services, and blackbox entries
 * onto GALAXY domain state while strictly excluding the 2 isolated Telegram core agents.
 */
export function mergeBridgeTelemetry(
  telemetry: BridgeTelemetry,
  currentAgents: Agent[],
  currentChecks: HealthCheck[],
  showOnlyVpsAgents: boolean,
  excludedProfileKeys?: ReadonlySet<string>,
  pendingCreatedKeys?: ReadonlySet<string>,
): {
  agents: Agent[];
  healthChecks: HealthCheck[];
  interAgentLogs: InterAgentLog[];
} {
  const isExcluded = (key: string): boolean => {
    const clean = key.trim().toLowerCase();
    return EXCLUDED_CORE_PROFILE_KEYS.has(clean) || Boolean(excludedProfileKeys?.has(key));
  };
  const activeRemoteAgents = telemetry.agents.filter(
    (ra) => !ra.is_core && !isExcluded(ra.id) && !isExcluded(ra.name),
  );
  const remoteByProfile = new Map(activeRemoteAgents.map((ra) => [ra.id, ra]));

  const updatedAgents: Agent[] = [];
  const matchedRemoteIds = new Set<string>();

  for (const existing of currentAgents) {
    if (existing.isHQ || isExcluded(existing.profileKey) || isExcluded(existing.id)) {
      continue;
    }
    const matchKey = existing.profileKey;
    const remote = remoteByProfile.get(matchKey);

    if (remote) {
      matchedRemoteIds.add(remote.id);
      updatedAgents.push({
        ...existing,
        name: remote.name || existing.name,
        buildingName: remote.building_name || existing.buildingName,
        status: mapRemoteStatus(remote.status),
        currentTask: remote.task || existing.currentTask,
        model: remote.model || existing.model,
        avatarUrl: remote.avatar || existing.avatarUrl,
        soulSummary: remote.soul ? remote.soul.slice(0, 220) : existing.soulSummary,
      });
    } else if (
      !showOnlyVpsAgents ||
      pendingCreatedKeys?.has(existing.profileKey) ||
      pendingCreatedKeys?.has(existing.id)
    ) {
      // Keep locally created agents while POST /api/agents is still provisioning over SSH
      updatedAgents.push(existing);
    }
  }

  for (const remote of activeRemoteAgents) {
    if (matchedRemoteIds.has(remote.id)) continue;
    updatedAgents.push({
      id: `vps-${remote.id}`,
      name: remote.name,
      buildingName: remote.building_name || `${remote.name.replace(/-/g, ' ')} Desk`,
      role: remote.role || 'Hermes Specialist Agent',
      department: 'VPS Profile',
      profileKey: remote.id,
      status: mapRemoteStatus(remote.status),
      archetype: coerceArchetype(remote.arch, 'observatory_dome'),
      isHQ: false,
      avatarUrl: remote.avatar || pickAutoPortrait(remote.id, remote.role, remote.arch),
      model: remote.model || 'combo-best',
      currentTask: remote.task || 'STANDBY',
      sessionsCount: 1,
      tokensUsed: 0,
      avgReplySec: 2.8,
      uptimePct: 99.9,
      soulSummary: remote.soul || `Live Hermes profile ~/.hermes/profiles/${remote.id}`,
      tools: ['hermes_cli', 'hermes_skills', '9router_proxy'],
      ringAngle: 0,
      ringRadius: 7.4,
    });
  }

  const rebalancedAgents = rebalanceCitySlots(updatedAgents);

  // Merge live service probes into the 21-point Health Check matrix
  const svcMap = new Map(telemetry.services.map((s) => [s.unit, s]));
  const updatedChecks: HealthCheck[] = currentChecks.map((chk) => {
    const lower = chk.name.toLowerCase();
    if (!telemetry.connected && lower.includes('tailscale')) {
      return {
        ...chk,
        status: 'fail',
        detail: telemetry.error || 'SSH bridge disconnected from hermesagent',
      };
    }
    for (const [unit, svc] of svcMap.entries()) {
      if (
        (unit === 'hermes-gateway' && lower.includes('hermes gateway')) ||
        (unit === 'hermes-dashboard' && lower.includes('hermes dashboard')) ||
        (unit === '9router' && lower.includes('9router')) ||
        (unit === 'voicestudio' && lower.includes('voicestudio')) ||
        (unit === 'camofox' && (lower.includes('camofox') || lower.includes('9377')))
      ) {
        return {
          ...chk,
          status: svc.healthy ? 'pass' : 'fail',
          latencyMs: svc.latency_ms ?? chk.latencyMs,
          detail: svc.healthy
            ? `Live probe: ${svc.name} is ${svc.state}`
            : `Live alert: ${svc.name} reported ${svc.state}`,
        };
      }
    }
    return chk;
  });

  const liveLogs: InterAgentLog[] = telemetry.blackbox.slice(0, 20).map((b) => ({
    id: `bb-${b.id}`,
    fromAgentId: isExcluded(b.agent) ? 'system' : b.agent,
    toAgentId: 'operator',
    channel: b.category.toLowerCase(),
    message: `[${b.action}] ${b.detail}`,
    timestamp: b.time,
  }));

  return {
    agents: rebalancedAgents,
    healthChecks: updatedChecks,
    interAgentLogs: liveLogs,
  };
}
