import type {
  Agent,
  CronJob,
  DocItem,
  HealthCheck,
  Mission,
  ReportLength,
  RolePreset,
  SearchResult,
  WorkspaceFile,
} from '../types/nexora';

/**
 * Computes evenly distributed circular island coordinates for outer specialist towers,
 * alternating slightly between inner and outer rings for architectural skyline depth.
 */
export function computeCitySlotPosition(
  index: number,
  totalOuter: number,
): { ringAngle: number; ringRadius: number } {
  const safeTotal = Math.max(1, totalOuter);
  const ringAngle = (Math.PI * 2 * index) / safeTotal - Math.PI * 0.62;
  const ringRadius = index % 3 === 0 ? 5.3 : 7.4;
  return { ringAngle, ringRadius };
}

/**
 * Re-distributes all non-HQ towers evenly around the circular city island.
 */
export function rebalanceCitySlots(agents: Agent[]): Agent[] {
  const outer = agents.filter((a) => !a.isHQ);
  let outerIdx = 0;
  return agents.map((agent) => {
    if (agent.isHQ) {
      return { ...agent, ringAngle: 0, ringRadius: 0 };
    }
    const slot = computeCitySlotPosition(outerIdx, outer.length);
    outerIdx += 1;
    return { ...agent, ...slot };
  });
}

/**
 * Hires a new specialist from a preset into the active fleet and rebalances 3D city slots.
 */
export function hireSpecialist(
  agents: Agent[],
  preset: RolePreset,
  customName?: string,
  customBuilding?: string,
): { agents: Agent[]; hired: Agent } {
  const trimmedName = (customName ?? '').trim() || preset.name;
  const trimmedBuilding = (customBuilding ?? '').trim() || preset.buildingName;
  const baseSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
  let candidateId = baseSlug;
  let suffix = 2;
  while (agents.some((a) => a.id === candidateId)) {
    candidateId = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const hired: Agent = {
    id: candidateId,
    name: trimmedName,
    buildingName: trimmedBuilding,
    role: preset.role,
    department: preset.department,
    profileKey: candidateId,
    status: 'working',
    archetype: preset.archetype,
    avatarUrl: preset.avatarUrl,
    model: preset.model,
    currentTask: 'Initializing workspace & syncing permanent operating rules',
    sessionsCount: 1,
    tokensUsed: 4200,
    avgReplySec: 2.4,
    uptimePct: 100.0,
    soulSummary: preset.soulSummary,
    tools: [...preset.tools],
    ringAngle: 0,
    ringRadius: 7.4,
  };

  const rebalanced = rebalanceCitySlots([...agents, hired]);
  const finalHired = rebalanced.find((a) => a.id === candidateId) ?? hired;
  return { agents: rebalanced, hired: finalHired };
}

/**
 * Retires a specialist from the fleet. Executor HQ is permanently protected.
 */
export function retireSpecialist(
  agents: Agent[],
  agentId: string,
): { agents: Agent[]; removed: boolean; reason?: string } {
  const target = agents.find((a) => a.id === agentId);
  if (!target) {
    return { agents, removed: false, reason: 'Agent not found.' };
  }
  if (target.isHQ) {
    return { agents, removed: false, reason: 'Executor HQ cannot be retired.' };
  }
  const remaining = agents.filter((a) => a.id !== agentId);
  return { agents: rebalanceCitySlots(remaining), removed: true };
}

/**
 * Picks relevant specialist agents for a new mission goal based on keywords.
 */
export function selectTeamForGoal(goal: string, agents: Agent[]): Agent[] {
  const lower = goal.toLowerCase();
  const hq = agents.find((a) => a.isHQ) ?? agents[0];
  const picks: Agent[] = hq ? [hq] : [];

  const keywordPairs: Array<[RegExp, string[]]> = [
    [/(vps|server|tailscale|port|linux|uptime|firewall|nginx|ssh|systemd)/, ['guardian', 'developer', 'sentinel', 'deploy']],
    [/(code|api|bug|refactor|build|app|script|websocket|typescript|python)/, ['developer', 'qa', 'verifier', 'deploy']],
    [/(research|compare|study|benchmark|market|find|analyze|verify)/, ['research', 'scout', 'data']],
    [/(write|doc|article|brief|report|post|copy|guide|script|blog)/, ['content', 'design', 'reach', 'director']],
    [/(cost|budget|token|price|finance|ledger|spend|roi)/, ['ledger', 'data', 'treasury']],
    [/(voice|audio|speak|tts|podcast|briefing)/, ['studio', 'content']],
    [/(schedule|cron|habit|plan|calendar|routine)/, ['travel', 'mentor', 'content']],
  ];

  for (const [regex, ids] of keywordPairs) {
    if (regex.test(lower)) {
      for (const id of ids) {
        const match = agents.find((a) => a.id === id || a.role.toLowerCase().includes(id));
        if (match && !picks.some((p) => p.id === match.id) && picks.length < 4) {
          picks.push(match);
        }
      }
    }
  }

  if (picks.length < 3) {
    for (const fallback of agents) {
      if (!picks.some((p) => p.id === fallback.id)) {
        picks.push(fallback);
      }
      if (picks.length >= 3) break;
    }
  }

  return picks;
}

/**
 * Creates a new mission drafted by EXECUTOR in 'approval' stage ("Nothing runs without your OK").
 */
export function createMission(
  title: string,
  goal: string,
  reportLength: ReportLength,
  existingMissions: Mission[],
  agents: Agent[],
): Mission {
  const maxNum = existingMissions.reduce((max, m) => {
    const parsed = Number.parseInt(m.code.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 1012);

  const code = `NX-${maxNum + 1}`;
  const team = selectTeamForGoal(`${title} ${goal}`, agents);
  const lead = team[1] ?? team[0];
  const secondary = team[2] ?? team[0];
  const lengthLabel =
    reportLength === 'brief'
      ? 'concise 1-page executive brief'
      : reportLength === 'deep_dive'
        ? 'comprehensive deep-dive dossier'
        : 'structured standard report';

  return {
    id: `m-${maxNum + 1}-${Date.now()}`,
    code,
    title: title.trim(),
    goal: goal.trim(),
    stage: 'approval',
    reportLength,
    assignedAgentIds: team.map((a) => a.id),
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAgo: 'JUST NOW',
    planSummary: `EXECUTOR assembled ${team.map((a) => a.name).join(', ')} to deliver a ${lengthLabel}. Awaiting your approval before any specialist begins work.`,
    steps: [
      {
        id: `st-1-${Date.now()}`,
        title: `Scope requirements & gather verified inputs for "${title.trim()}"`,
        agentId: lead.id,
        status: 'pending',
      },
      {
        id: `st-2-${Date.now()}`,
        title: `Execute core analysis & validate outputs against operating rules`,
        agentId: secondary.id,
        status: 'pending',
      },
      {
        id: `st-3-${Date.now()}`,
        title: `Synthesize final ${lengthLabel} and file to Docs Library`,
        agentId: team[0].id,
        status: 'pending',
      },
    ],
  };
}

/**
 * Operator approves a mission plan: transitions from 'approval' -> 'in_progress' and starts step 1.
 */
export function approveMissionPlan(missions: Mission[], missionId: string): Mission[] {
  return missions.map((m) => {
    if (m.id !== missionId) return m;
    const steps = m.steps.map((s, idx) =>
      idx === 0 ? { ...s, status: 'running' as const } : s,
    );
    return {
      ...m,
      stage: 'in_progress',
      updatedAgo: 'JUST NOW',
      revisionNote: undefined,
      steps,
    };
  });
}

/**
 * Requests a plan revision, keeping mission in 'briefing' / 'approval' with operator feedback.
 */
export function reviseMissionPlan(
  missions: Mission[],
  missionId: string,
  note: string,
): Mission[] {
  return missions.map((m) => {
    if (m.id !== missionId) return m;
    return {
      ...m,
      stage: 'approval',
      updatedAgo: 'REVISED NOW',
      revisionNote: note.trim(),
      planSummary: `${m.planSummary} Updated per operator note: "${note.trim()}".`,
    };
  });
}

/**
 * Advances an in-progress mission by one step; moves to 'review' once all steps finish.
 */
export function advanceMissionProgress(missions: Mission[], missionId: string): Mission[] {
  return missions.map((m) => {
    if (m.id !== missionId || m.stage !== 'in_progress') return m;
    const runningIdx = m.steps.findIndex((s) => s.status === 'running');
    const nextPendingIdx = m.steps.findIndex((s) => s.status === 'pending');

    let updatedSteps = [...m.steps];
    if (runningIdx >= 0) {
      updatedSteps[runningIdx] = { ...updatedSteps[runningIdx], status: 'done' };
      if (runningIdx + 1 < updatedSteps.length) {
        updatedSteps[runningIdx + 1] = { ...updatedSteps[runningIdx + 1], status: 'running' };
      }
    } else if (nextPendingIdx >= 0) {
      updatedSteps[nextPendingIdx] = { ...updatedSteps[nextPendingIdx], status: 'running' };
    }

    const allDone = updatedSteps.every((s) => s.status === 'done');
    return {
      ...m,
      stage: allDone ? 'review' : 'in_progress',
      updatedAgo: 'JUST NOW',
      steps: updatedSteps,
    };
  });
}

/**
 * Marks a reviewed mission as 'delivered' and generates a Markdown document for the Docs library.
 */
export function deliverMissionReport(
  mission: Mission,
  agents: Agent[],
): { mission: Mission; doc: DocItem } {
  const docId = `doc-${mission.code.toLowerCase()}-${Date.now()}`;
  const teamNames = mission.assignedAgentIds
    .map((id) => agents.find((a) => a.id === id)?.name ?? id)
    .join(', ');

  const depthSection =
    mission.reportLength === 'deep_dive'
      ? `\n## Deep-Dive Verification Matrix\n- Cross-checked every specialist artifact against \`OPERATING_RULES.md\`.\n- Validated zero regressions on \`hermesagent (100.72.221.36)\`.\n- Archived structured execution trail for future memory recall.\n`
      : mission.reportLength === 'brief'
        ? `\n## Executive Takeaway\nCompleted cleanly on schedule with zero unresolved risks.\n`
        : `\n## Key Outcomes\n- Plan approved by Operator prior to specialist dispatch.\n- All ${mission.steps.length} execution stages completed cleanly.\n- Follow-up hooks registered in Standing Orders if recurring monitoring is needed.\n`;

  const content = `# ${mission.title} (${mission.code})

**Mission Goal**: ${mission.goal}  
**Assigned Crew**: ${teamNames}  
**Report Format**: ${mission.reportLength.replace('_', ' ')}

## Execution Summary
${mission.planSummary}

## Completed Steps
${mission.steps.map((s, idx) => `${idx + 1}. **${s.title}** — Completed by \`${s.agentId}\``).join('\n')}
${depthSection}`;

  const wordCount = content.trim().split(/\s+/).length;
  const doc: DocItem = {
    id: docId,
    title: `${mission.title} — Mission Deliverable`,
    category: 'Mission Report',
    authorAgentId: mission.assignedAgentIds[0] ?? 'executor',
    missionCode: mission.code,
    updatedAt: 'Just now',
    wordCount,
    content,
  };

  return {
    mission: {
      ...mission,
      stage: 'delivered',
      updatedAgo: 'DELIVERED',
      deliveredDocId: docId,
    },
    doc,
  };
}

/**
 * Detects destructive or privileged shell commands that require HITL Gate approval.
 */
export function detectRiskyCommand(command: string): string | null {
  const trimmed = command.trim();
  const patterns: Array<[RegExp, string]> = [
    [/\brm\s+-[a-z]*r[a-z]*f\b|\brm\s+-rf\b/i, 'Recursive forced file deletion detected'],
    [/\bsystemctl\s+(stop|restart|disable)\b/i, 'Service lifecycle interruption on production host'],
    [/\b(reboot|shutdown|poweroff)\b/i, 'Host reboot/shutdown command requires operator sign-off'],
    [/\biptables\s+.*(-F|--flush|-D)\b/i, 'Firewall table modification on Tailscale gateway'],
    [/\bkill\s+-9\b/i, 'Forceful process termination detected'],
  ];
  for (const [regex, reason] of patterns) {
    if (regex.test(trimmed)) return reason;
  }
  return null;
}

export interface TerminalEvaluation {
  output: string;
  isError?: boolean;
  requiresGate?: boolean;
  gateReason?: string;
  clear?: boolean;
}

/**
 * Evaluates shell commands in the NEXORA Live Terminal with realistic Hermes VPS telemetry.
 */
export function evaluateTerminalCommand(
  rawCommand: string,
  agents: Agent[],
  bypassGate = false,
): TerminalEvaluation {
  const cmd = rawCommand.trim();
  if (!cmd) return { output: '' };

  if (!bypassGate) {
    const risk = detectRiskyCommand(cmd);
    if (risk) {
      return {
        output: `[GATE HOLD] "${cmd}" paused — ${risk}. Confirm in the HITL Approval Banner above to execute.`,
        requiresGate: true,
        gateReason: risk,
      };
    }
  }

  if (cmd === 'clear') {
    return { output: '', clear: true };
  }

  if (cmd === 'help') {
    return {
      output: [
        'GALAXY Live Shell — Available Commands:',
        '  hermes status          Show Hermes gateway & active daemon state',
        '  hermes fleet           List all active agent towers & statuses',
        '  tailscale status       Check encrypted mesh peers (100.72.221.36)',
        '  ss -tulnp              Inspect listening Hermes, 9Router & VoiceStudio ports',
        '  free -h / df -h        Check RAM and 200 GB NVMe storage utilization',
        '  uptime                 Show hermesagent uptime & load averages',
        '  ls ~/.hermes           Browse Hermes runtime directory',
        '  cat ~/.hermes/SOUL.md  Print Executor identity file',
        '  sudo systemctl restart hermes   (Triggers HITL Gate approval)',
        '  clear                  Clear terminal buffer',
      ].join('\n'),
    };
  }

  if (cmd === 'hermes status') {
    const workingCount = agents.filter((a) => a.status === 'working').length;
    return {
      output: [
        'HERMES GATEWAY v3.4.2 — ACTIVE (PID 998)',
        '  Host:       hermesagent (100.72.221.36:9119)',
        `  Fleet:      ${agents.length} registered towers (${workingCount} working right now)`,
        '  9Router:    127.0.0.1:20128 [ONLINE]',
        '  VoiceStudio:127.0.0.1:3900  [ONLINE · Kokoro/Piper]',
        '  SQLite DBs: kanban.db (WAL), shared-state.db (OK)',
      ].join('\n'),
    };
  }

  if (cmd === 'hermes fleet') {
    const header = 'ID            BUILDING              STATUS    SESSIONS  MODEL';
    const rows = agents.map(
      (a) =>
        `${a.id.padEnd(13)} ${a.buildingName.padEnd(21)} ${a.status.toUpperCase().padEnd(9)} ${String(a.sessionsCount).padEnd(9)} ${a.model}`,
    );
    return { output: [header, '-'.repeat(76), ...rows].join('\n') };
  }

  if (cmd === 'tailscale status' || cmd.startsWith('tailscale ping')) {
    return {
      output: [
        '100.72.221.36   hermesagent       ubuntu   linux   active; direct 24ms',
        '100.85.109.20   vm-23-58-ubuntu   ubuntu   linux   active; relay-free 18ms',
        '100.91.44.12    operator-mobile   rayden   android active; idle',
      ].join('\n'),
    };
  }

  if (cmd.startsWith('ss -tulnp')) {
    return {
      output: [
        'tcp  LISTEN  0  2048  100.72.221.36:9119   0.0.0.0:*  users:(("hermes",pid=998))',
        'tcp  LISTEN  0  511   127.0.0.1:20128      0.0.0.0:*  users:(("next-server",pid=1217))',
        'tcp  LISTEN  0  2048  127.0.0.1:3900       0.0.0.0:*  users:(("uvicorn",pid=24201))',
        'tcp  LISTEN  0  511   127.0.0.1:9377       0.0.0.0:*  users:(("node-MainThread",pid=10048))',
      ].join('\n'),
    };
  }

  if (cmd === 'free -h') {
    return {
      output: [
        '               total        used        free      shared  buff/cache   available',
        'Mem:            23Gi       5.4Gi        13Gi       142Mi       4.9Gi        17Gi',
        'Swap:          2.0Gi          0B       2.0Gi',
      ].join('\n'),
    };
  }

  if (cmd === 'df -h') {
    return {
      output: [
        'Filesystem      Size  Used Avail Use% Mounted on',
        '/dev/sda1       194G   62G  132G  32% /',
        'tmpfs            12G   14M   12G   1% /dev/shm',
      ].join('\n'),
    };
  }

  if (cmd === 'uptime') {
    return {
      output: '19:58:14 up 42 days,  6:19,  1 user,  load average: 0.42, 0.38, 0.31',
    };
  }

  if (cmd === 'ls ~/.hermes' || cmd === 'ls -la ~/.hermes') {
    return {
      output: [
        'SOUL.md   USER.md   OPERATING_RULES.md   config.yaml',
        'kanban.db   projects.db   shared-state.db   gateway.sock',
        'profiles/   memories/   cron/   skills/   logs/',
      ].join('\n'),
    };
  }

  if (cmd === 'cat ~/.hermes/SOUL.md') {
    return {
      output:
        '# SOUL.md — EXECUTOR (Profile: default)\nPrimary orchestrator of the GALAXY Hermes Fleet. Plans first, executes only after operator approval.',
    };
  }

  if (bypassGate) {
    return {
      output: `[GATE APPROVED] Executed "${cmd}" cleanly on hermesagent (exit code 0 · 312ms).`,
    };
  }

  return {
    output: `bash: ${cmd.split(' ')[0]}: command not found in sandbox shell (type "help" for supported Hermes/VPS commands).`,
    isError: true,
  };
}

/**
 * Generates contextual, role-authentic replies for Chat and Voice Mode.
 */
export function generateAgentReply(
  agent: Agent,
  prompt: string,
  allAgents: Agent[],
): { text: string; toolTrace: string[] } {
  const lower = prompt.toLowerCase();
  const workingNames = allAgents
    .filter((a) => a.status === 'working')
    .map((a) => a.name)
    .join(', ');

  if (lower.includes('status') || lower.includes('health') || lower.includes('vps')) {
    return {
      text: `${agent.name} reporting from ${agent.buildingName}: hermesagent (100.72.221.36) is optimal at 18% CPU and 5.4 GB of 24 GB RAM. Currently active crew: ${workingNames || 'all units on standby'}.`,
      toolTrace: ['vps_probe("100.72.221.36")', 'fleet_bus.active()'],
    };
  }

  if (lower.includes('mission') || lower.includes('plan') || lower.includes('build')) {
    return {
      text: `Understood. I have scoped "${prompt.slice(0, 72)}" from ${agent.buildingName}. Per permanent operating rules, head to the Missions board or use Ask GALAXY to submit it as a formal mission so you can approve the specialist plan before execution.`,
      toolTrace: ['mission_scope.draft()', 'rules.check("PLAN_APPROVAL")'],
    };
  }

  if (lower.includes('rule') || lower.includes('who are you') || lower.includes('soul')) {
    return {
      text: `I am ${agent.name} (${agent.role}) stationed at ${agent.buildingName}. ${agent.soulSummary}`,
      toolTrace: [`memory.read("${agent.profileKey}/SOUL.md")`],
    };
  }

  return {
    text: `${agent.name} (${agent.buildingName}) received your brief: "${prompt.trim()}". I am routing this through ${agent.model} with my active tools (${agent.tools.slice(0, 3).join(', ')}) and can log a structured summary straight into the Docs Library whenever you're ready.`,
    toolTrace: [`${agent.tools[0] ?? 'fleet_bus'}()`, 'memory_context.sync()'],
  };
}

/**
 * Unified workspace search across agents, missions, docs, cron schedules, and files.
 */
export function searchWorkspace(
  query: string,
  data: {
    agents: Agent[];
    missions: Mission[];
    docs: DocItem[];
    crons: CronJob[];
    files: WorkspaceFile[];
  },
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const a of data.agents) {
    if (
      a.name.toLowerCase().includes(q) ||
      a.buildingName.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      a.profileKey.toLowerCase().includes(q)
    ) {
      results.push({
        id: `res-a-${a.id}`,
        type: 'agent',
        title: `${a.name} · ${a.buildingName}`,
        subtitle: `${a.role} (${a.status})`,
        targetSection: 'city',
        targetId: a.id,
      });
    }
  }

  for (const m of data.missions) {
    if (
      m.title.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.goal.toLowerCase().includes(q)
    ) {
      results.push({
        id: `res-m-${m.id}`,
        type: 'mission',
        title: `${m.code} · ${m.title}`,
        subtitle: `Stage: ${m.stage.replace('_', ' ')}`,
        targetSection: 'missions',
        targetId: m.id,
      });
    }
  }

  for (const d of data.docs) {
    if (
      d.title.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q)
    ) {
      results.push({
        id: `res-d-${d.id}`,
        type: 'doc',
        title: d.title,
        subtitle: `${d.category} · ${d.wordCount} words`,
        targetSection: 'docs',
        targetId: d.id,
      });
    }
  }

  for (const c of data.crons) {
    if (c.name.toLowerCase().includes(q) || c.command.toLowerCase().includes(q)) {
      results.push({
        id: `res-c-${c.id}`,
        type: 'schedule',
        title: c.name,
        subtitle: `${c.cadenceLabel} · ${c.cronExpr}`,
        targetSection: 'schedule',
        targetId: c.id,
      });
    }
  }

  for (const f of data.files) {
    if (f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)) {
      results.push({
        id: `res-f-${f.id}`,
        type: 'file',
        title: f.path,
        subtitle: `Workspace file · ${f.language}`,
        targetSection: 'files',
        targetId: f.id,
      });
    }
  }

  return results.slice(0, 10);
}

/**
 * Calculates overall system health label and pass metrics.
 */
export function calculateHealthSummary(checks: HealthCheck[]): {
  passed: number;
  total: number;
  pct: number;
  label: 'Optimal' | 'Degraded' | 'Critical';
} {
  const total = checks.length;
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const pct = total === 0 ? 100 : Math.round((passed / total) * 100);
  const label = failed > 0 ? 'Critical' : passed < total ? 'Degraded' : 'Optimal';
  return { passed, total, pct, label };
}
