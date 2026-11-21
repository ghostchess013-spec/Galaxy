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
): Promise<{ ok: boolean; version?: string; main_vps?: string; time?: string }> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const prefix = normalizeBridgeBaseUrl(baseUrl);
    const res = await fetch(`${prefix}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return { ok: false };
    const data = (await res.json()) as {
      ok?: boolean;
      version?: string;
      main_vps?: string;
      time?: string;
    };
    return {
      ok: Boolean(data.ok && data.main_vps),
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
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${prefix}${path}`, {
      method: options.method ?? 'GET',
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
  payload: { agent_id: string; message: string; model?: string },
): Promise<{ ok: boolean; reply: string; model: string; latency_ms?: number }> {
  return bridgeJson(baseUrl, token, '/api/chat', {
    method: 'POST',
    body: payload,
    timeoutMs: 65000,
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
    headers: {
      'Content-Type': 'application/json',
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
    role: string;
    model: string;
    arch: string;
    soul?: string;
    avatar?: string;
  },
): Promise<{ ok: boolean; slug?: string }> {
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
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
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
 * Pure reconciliation helper: maps live hermesagent profiles, services, and blackbox entries
 * onto NEXORA 3.0 domain state without losing 3D Agent City spatial geometry.
 */
export function mergeBridgeTelemetry(
  telemetry: BridgeTelemetry,
  currentAgents: Agent[],
  currentChecks: HealthCheck[],
  showOnlyVpsAgents: boolean,
): {
  agents: Agent[];
  healthChecks: HealthCheck[];
  interAgentLogs: InterAgentLog[];
} {
  const remoteByProfile = new Map(telemetry.agents.map((ra) => [ra.id, ra]));

  const updatedAgents: Agent[] = [];
  const matchedRemoteIds = new Set<string>();

  for (const existing of currentAgents) {
    const matchKey = existing.isHQ ? 'default' : existing.profileKey;
    const remote = remoteByProfile.get(matchKey);

    if (remote) {
      matchedRemoteIds.add(remote.id);
      updatedAgents.push({
        ...existing,
        status: mapRemoteStatus(remote.status),
        currentTask: remote.task || existing.currentTask,
        model: remote.model || existing.model,
        avatarUrl: remote.avatar || existing.avatarUrl,
        soulSummary: remote.soul ? remote.soul.slice(0, 220) : existing.soulSummary,
      });
    } else if (!showOnlyVpsAgents) {
      updatedAgents.push(existing);
    }
  }

  for (const remote of telemetry.agents) {
    if (matchedRemoteIds.has(remote.id)) continue;
    const isHq = remote.id === 'default';
    updatedAgents.push({
      id: isHq ? 'executor' : `vps-${remote.id}`,
      name: isHq ? 'Executor' : remote.name,
      buildingName: isHq
        ? 'Executor HQ'
        : remote.id === 'vps-guardian'
          ? 'Care Center'
          : `${remote.name.replace(/-/g, ' ')} Tower`,
      role: remote.role || 'Hermes Specialist Agent',
      department: remote.is_core ? 'Core Fleet' : 'VPS Profile',
      profileKey: remote.id,
      status: mapRemoteStatus(remote.status),
      archetype: coerceArchetype(remote.arch, isHq ? 'hq_spire' : 'observatory_dome'),
      isHQ: isHq,
      avatarUrl: remote.avatar || pickAutoPortrait(remote.id, remote.role, remote.arch),
      model: remote.model || 'combo-best',
      currentTask: remote.task || 'STANDBY',
      sessionsCount: 1,
      tokensUsed: 12000,
      avgReplySec: 3.1,
      uptimePct: 99.9,
      soulSummary: remote.soul || `Live Hermes profile ~/.hermes/profiles/${remote.id}`,
      tools: ['hermes_cli', '9router_proxy', 'tailscale_mesh'],
      ringAngle: 0,
      ringRadius: isHq ? 0 : 7.4,
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
    fromAgentId: b.agent === 'default' ? 'executor' : b.agent,
    toAgentId: 'executor',
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
