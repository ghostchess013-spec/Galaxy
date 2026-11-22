import type {
  Agent,
  ChatMessage,
  CronJob,
  DocItem,
  HealthCheck,
  IntegrationService,
  InterAgentLog,
  Mission,
  OperatorSettings,
  RolePreset,
  WorkspaceFile,
} from '../types/nexora';

export const AVATARS = {
  executor: '/src/assets/images/avatar_executor_1795234267459.jpg',
  research: '/src/assets/images/avatar_research_1795234267421.jpg',
  developer: '/src/assets/images/avatar_developer_1795234267422.jpg',
  content: '/src/assets/images/avatar_content_1795234267930.jpg',
  data: '/src/assets/images/avatar_data_1795234269028.jpg',
  guardian: '/src/assets/images/avatar_guardian_1795265201887.jpg',
  design: '/src/assets/images/avatar_design_1795265160205.jpg',
  signal: '/src/assets/images/avatar_signal_1795265128937.jpg',
  ledger: '/src/assets/images/avatar_ledger_1795265180086.jpg',
} as const;

export const PORTRAIT_GALLERY: ReadonlyArray<{ id: keyof typeof AVATARS; label: string; url: string }> = [
  { id: 'executor', label: 'Executor', url: AVATARS.executor },
  { id: 'guardian', label: 'Sentinel', url: AVATARS.guardian },
  { id: 'developer', label: 'Developer', url: AVATARS.developer },
  { id: 'research', label: 'Research', url: AVATARS.research },
  { id: 'data', label: 'Data', url: AVATARS.data },
  { id: 'design', label: 'Design', url: AVATARS.design },
  { id: 'content', label: 'Editorial', url: AVATARS.content },
  { id: 'signal', label: 'Signal', url: AVATARS.signal },
  { id: 'ledger', label: 'Ledger', url: AVATARS.ledger },
];

const SPECIALIST_PORTRAIT_POOL: readonly string[] = [
  AVATARS.guardian,
  AVATARS.developer,
  AVATARS.research,
  AVATARS.data,
  AVATARS.design,
  AVATARS.content,
  AVATARS.signal,
  AVATARS.ledger,
];

/**
 * Deterministically assigns a studio portrait to any Hermes agent profile
 * based on role/slug keywords or a stable hash across the 8 specialist portraits.
 */
export function pickAutoPortrait(profileKey: string, role = '', archetype = ''): string {
  const slug = profileKey.trim().toLowerCase();
  if (slug === 'default' || slug === 'executor' || archetype === 'hq_spire') {
    return AVATARS.executor;
  }
  const haystack = `${slug} ${role.toLowerCase()} ${archetype.toLowerCase()}`;
  if (/(guard|sentinel|sec|firewall|vps|ops|devops|deploy|care_pavilion)/.test(haystack)) {
    return AVATARS.guardian;
  }
  if (/(dev|code|eng|build|script|api|ribbed_tower)/.test(haystack)) {
    return AVATARS.developer;
  }
  if (/(design|ui|ux|creative|art|brand|cantilever_loft)/.test(haystack)) {
    return AVATARS.design;
  }
  if (/(signal|comms|social|seo|telegram|discord|broadcast|outreach|signal_spire)/.test(haystack)) {
    return AVATARS.signal;
  }
  if (/(ledger|fin|cost|budget|deal|treasury|legal|compliance|sales|twin_towers)/.test(haystack)) {
    return AVATARS.ledger;
  }
  if (/(data|sql|metric|quant|qa|verify|memory|archiv|octagonal_citadel)/.test(haystack)) {
    return AVATARS.data;
  }
  if (/(content|write|doc|copy|video|studio|support|media|curved_atelier|stacked_stage)/.test(haystack)) {
    return AVATARS.content;
  }
  if (/(research|scout|intel|recon|search|study|observatory_dome)/.test(haystack)) {
    return AVATARS.research;
  }

  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return SPECIALIST_PORTRAIT_POOL[hash % SPECIALIST_PORTRAIT_POOL.length];
}

export const INITIAL_AGENTS: Agent[] = [];

/** 14 ready-made specialist role presets for hiring in 3D Agent City */
export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'preset-security',
    name: 'Sentinel',
    buildingName: 'Security Bastion',
    role: 'Security & Firewall Auditor',
    department: 'Security',
    archetype: 'octagonal_citadel',
    avatarUrl: AVATARS.guardian,
    model: 'combo-best',
    description: 'Audits iptables rules, SSH keys, Tailscale ACLs, and token rotation hygiene.',
    tools: ['ssh_audit', 'acl_verify', 'port_inspect'],
    soulSummary: 'Zero-trust security specialist protecting VPS gateways and secret hygiene.',
  },
  {
    id: 'preset-devops',
    name: 'Deploy',
    buildingName: 'Pipeline Foundry',
    role: 'DevOps & Release Engineer',
    department: 'Engineering',
    archetype: 'ribbed_tower',
    avatarUrl: AVATARS.developer,
    model: 'combo-best',
    description: 'Manages systemd units, zero-downtime restarts, and backup snapshots.',
    tools: ['deploy_check', 'backup_tar', 'service_health'],
    soulSummary: 'Automates reliable releases and rollback-safe server updates.',
  },
  {
    id: 'preset-qa',
    name: 'Verifier',
    buildingName: 'Test Lab',
    role: 'QA & Verification Lead',
    department: 'Quality',
    archetype: 'observatory_dome',
    avatarUrl: AVATARS.data,
    model: 'combo-best',
    description: 'Runs regression suites, checks API latency, and validates agent deliverables.',
    tools: ['test_suite', 'api_probe', 'diff_verify'],
    soulSummary: 'Catches edge cases and verifies every mission report before final delivery.',
  },
  {
    id: 'preset-seo',
    name: 'Beacon',
    buildingName: 'Search Observatory',
    role: 'SEO & Discovery Strategist',
    department: 'Growth',
    archetype: 'signal_spire',
    avatarUrl: AVATARS.signal,
    model: 'combo-best',
    description: 'Maps keyword intent, technical metadata, and organic content clusters.',
    tools: ['serp_scan', 'schema_check', 'content_gap'],
    soulSummary: 'Optimizes discoverability and structured semantic metadata.',
  },
  {
    id: 'preset-marketing',
    name: 'Pulse',
    buildingName: 'Campaign Studio',
    role: 'Growth & Marketing Lead',
    department: 'Growth',
    archetype: 'twin_towers',
    avatarUrl: AVATARS.design,
    model: 'combo-best',
    description: 'Builds launch playbooks, positioning angles, and audience experiments.',
    tools: ['campaign_plan', 'copy_test', 'funnel_read'],
    soulSummary: 'Crafts sharp positioning and measurable growth experiments.',
  },
  {
    id: 'preset-product',
    name: 'Compass',
    buildingName: 'Product Pavilion',
    role: 'Product Strategist',
    department: 'Product',
    archetype: 'cantilever_loft',
    avatarUrl: AVATARS.design,
    model: 'combo-best',
    description: 'Translates operator goals into crisp PRDs, user stories, and prioritized roadmaps.',
    tools: ['prd_draft', 'spec_review', 'backlog_sort'],
    soulSummary: 'Keeps scope sharp and aligned with real operator outcomes.',
  },
  {
    id: 'preset-legal',
    name: 'Counsel',
    buildingName: 'Compliance Hall',
    role: 'Policy & Contract Analyst',
    department: 'Governance',
    archetype: 'stepped_ziggurat',
    avatarUrl: AVATARS.ledger,
    model: 'combo-best',
    description: 'Reviews terms, privacy disclosures, and licensing obligations on third-party tools.',
    tools: ['clause_scan', 'license_audit', 'risk_memo'],
    soulSummary: 'Flags licensing, compliance, and risk clauses in plain language.',
  },
  {
    id: 'preset-support',
    name: 'Concierge',
    buildingName: 'Help Desk Hub',
    role: 'Client Support Specialist',
    department: 'Operations',
    archetype: 'care_pavilion',
    avatarUrl: AVATARS.content,
    model: 'combo-best',
    description: 'Triages incoming requests, drafts empathetic responses, and tracks SLAs.',
    tools: ['ticket_triage', 'kb_search', 'reply_draft'],
    soulSummary: 'Delivers fast, accurate support with zero dropped threads.',
  },
  {
    id: 'preset-scraper',
    name: 'Scout',
    buildingName: 'Recon Outpost',
    role: 'Web Recon & Monitor',
    department: 'Intelligence',
    archetype: 'signal_spire',
    avatarUrl: AVATARS.research,
    model: 'combo-best',
    description: 'Monitors changelogs, competitor releases, and RSS feeds around the clock.',
    tools: ['rss_watch', 'page_diff', 'alert_push'],
    soulSummary: 'Continuously tracks high-signal external changes without noise.',
  },
  {
    id: 'preset-memory',
    name: 'Archivist',
    buildingName: 'Memory Vault',
    role: 'Knowledge & Memory Curator',
    department: 'Intelligence',
    archetype: 'stepped_ziggurat',
    avatarUrl: AVATARS.data,
    model: 'combo-best',
    description: 'Deduplicates vector memories, compacts old sessions, and indexes `~/.hermes/memories`.',
    tools: ['memory_compact', 'index_docs', 'graph_link'],
    soulSummary: 'Keeps long-term fleet memory crisp, accurate, and fast to recall.',
  },
  {
    id: 'preset-video',
    name: 'Director',
    buildingName: 'Motion Stage',
    role: 'Script & Video Producer',
    department: 'Media',
    archetype: 'stacked_stage',
    avatarUrl: AVATARS.design,
    model: 'combo-best',
    description: 'Writes tight visual storyboards, shot lists, and narrated demo scripts.',
    tools: ['script_draft', 'beat_sheet', 'caption_gen'],
    soulSummary: 'Structures visual narratives and high-retention demo walkthroughs.',
  },
  {
    id: 'preset-social',
    name: 'Reach',
    buildingName: 'Broadcast Loft',
    role: 'Social & Community Lead',
    department: 'Communications',
    archetype: 'curved_atelier',
    avatarUrl: AVATARS.signal,
    model: 'combo-best',
    description: 'Adapts long-form docs into clear threads, community digests, and release notes.',
    tools: ['thread_draft', 'digest_pack', 'reply_queue'],
    soulSummary: 'Translates complex builds into clear, high-signal community updates.',
  },
  {
    id: 'preset-finance',
    name: 'Treasury',
    buildingName: 'Reserve Tower',
    role: 'Financial Modeler',
    department: 'Finance',
    archetype: 'twin_towers',
    avatarUrl: AVATARS.ledger,
    model: 'combo-best',
    description: 'Models unit economics, cloud cost scenarios, and monthly burn forecasts.',
    tools: ['sheet_model', 'cost_sim', 'variance_check'],
    soulSummary: 'Builds transparent scenario models and recurring spend trackers.',
  },
  {
    id: 'preset-coach',
    name: 'Mentor',
    buildingName: 'Focus Rotunda',
    role: 'Executive Briefing Coach',
    department: 'Command',
    archetype: 'travel_rotunda',
    avatarUrl: AVATARS.executor,
    model: 'combo-best',
    description: 'Prepares concise daily decision reviews and accountability check-ins.',
    tools: ['daily_brief', 'habit_track', 'priority_rank'],
    soulSummary: 'Protects operator focus by filtering noise into clear daily priorities.',
  },
];

export const INITIAL_MISSIONS: Mission[] = [];

export const INITIAL_CHATS: Record<string, ChatMessage[]> = {};

export const INITIAL_DOCS: DocItem[] = [
  {
    id: 'doc-1',
    title: 'Permanent Operating Rules — Hermes Fleet v3',
    category: 'Governance',
    authorAgentId: 'executor',
    missionCode: 'NX-1008',
    updatedAt: 'Nov 14, 2026',
    wordCount: 312,
    content: `# Permanent Operating Rules — Hermes Fleet v3

## 1. Approval Before Execution
No mission executes without explicit Operator approval on the plan. Any action touching money, external credentials, firewall rules, or destructive shell commands MUST pause at the HITL Gate.

## 2. Announce Intent First
Before modifying any file under \`~/.hermes/\` or restarting a service on \`hermesagent\`, the assigned specialist posts a one-line intent note to the Fleet Activity Bus.

## 3. Honest Failure Reporting
If a probe times out, a Tailscale peer goes offline, or a source cannot be verified, agents report the exact error string immediately. Never fabricate telemetry or silently skip failed checks.

## 4. Isolated Workspaces & Shared Library
Each specialist keeps private scratch state inside its own memory folder, while final deliverables are filed cleanly as Markdown inside the GALAXY Docs Library.

## 5. Token & Cost Discipline
Routine telemetry probes route to low-latency Flash/Mini models via 9Router (:20128); deep architectural reasoning escalates to Frontier tiers only when required.`,
  },
  {
    id: 'doc-2',
    title: 'Oracle Cloud PAYG A1 Flex Guardrails (hermesagent)',
    category: 'Infrastructure',
    authorAgentId: 'research',
    missionCode: 'NX-1012',
    updatedAt: 'Nov 20, 2026',
    wordCount: 248,
    content: `# Oracle Cloud PAYG A1 Flex Guardrails

## Host Specification
- **Hostname**: \`hermesagent\` (Tailscale \`100.72.221.36\`)
- **Compute**: 4 OCPU Ampere A1 ARM64 · 24 GB RAM
- **Storage**: 200 GB Block Volume (31% utilized)
- **Account Tier**: Pay-As-You-Go (PAYG) — exempt from idle instance reclamation

## Always Free Threshold Verification
1. **Compute**: Up to 4 OCPUs and 24 GB memory combined across A1 Flex instances stays at $0.00/mo.
2. **Block Storage**: Keep total boot + attached volumes strictly at or below 200 GB.
3. **Outbound Transfer**: 10 TB/month included; current projected usage is 42 GB/month.

## Recommended Monitoring
Guardian runs a daily disk & egress check at 06:00 via Standing Orders to guarantee zero surprise billing.`,
  },
  {
    id: 'doc-3',
    title: 'Edge TTS Neural Voice Architecture',
    category: 'Engineering',
    authorAgentId: 'studio',
    updatedAt: 'Nov 18, 2026',
    wordCount: 190,
    content: `# Edge TTS Neural Voice Architecture

## Stack Overview
Voice Mode synthesizes natural neural MP3 audio directly through **Microsoft Edge TTS** (\`edge-tts\`) on the GALAXY bridge via \`/api/voice/speak\`, with zero local GPU/VRAM overhead and no separate VoiceStudio daemon required.

## Available Neural Voices
- **id-ID-GadisNeural** & **id-ID-ArdiNeural**: Natural Indonesian female and male neural voices
- **en-US-AriaNeural** & **en-US-GuyNeural**: Expressive English neural voices
- **Browser Web Speech Fallback**: Instant zero-latency fallback if offline

## Operator Tip
Use concise responses in Voice Mode so spoken replies stay crisp while full tables are filed automatically to Docs.`,
  },
  {
    id: 'doc-4',
    title: '9Router (:20128) Multi-Provider Dispatch Map',
    category: 'Analytics',
    authorAgentId: 'data',
    missionCode: 'NX-1011',
    updatedAt: 'Nov 20, 2026',
    wordCount: 186,
    content: `# 9Router (:20128) Dispatch Map

| Agent Profile | Primary Model | Fallback Tier | Avg Latency |
| --- | --- | --- | --- |
| default (Executor) | claude-sonnet-4 | gemini-2.5-pro | 2.8s |
| research | gemini-2.5-pro | gpt-4.1 | 4.9s |
| developer | claude-sonnet-4 | gpt-4.1 | 5.4s |
| vps-guardian | gemini-2.5-flash | gpt-4.1-mini | 1.7s |

## Key Finding
Routing routine cron heartbeats and VPS probes to Flash-tier endpoints reduced monthly token expenditure by **61%** with zero loss in diagnostic accuracy.`,
  },
  {
    id: 'doc-5',
    title: 'Tailscale Private Mesh Hardening Checklist',
    category: 'Infrastructure',
    authorAgentId: 'guardian',
    updatedAt: 'Nov 17, 2026',
    wordCount: 162,
    content: `# Tailscale Private Mesh Hardening Checklist

- Bind Hermes Gateway (\`9119\`) and 9Router (\`20128\`) strictly to loopback or Tailscale IP \`100.72.221.36\`.
- Never expose raw shell or bridge ports to \`0.0.0.0\` public interfaces.
- Keep \`--accept-dns=false\` on companion Ubuntu VPS if provider resolvers conflict with MagicDNS.
- Verify bidirectional reachability weekly with \`tailscale ping -c 3 100.72.221.36\`.`,
  },
  {
    id: 'doc-6',
    title: 'GALAXY 2-Floor 3D AI Agent Office Layout Spec',
    category: 'Design',
    authorAgentId: 'design',
    updatedAt: 'Nov 19, 2026',
    wordCount: 154,
    content: `# GALAXY 2-Floor 3D AI Agent Office Specification

## Spatial Architecture
- **Floor 1 — Workspace & Social Zones**: Features 1:1 workstation desks and ergonomic chairs matching every active Hermes agent, a glass-walled Meeting Room, Pantry & Coffee Bar, Reading Nook, and Living Room Lounge with TV and Pool Table.
- **Floor 2 — Private Dormitory**: Houses 1:1 beds and bedside cabinets synced directly with your active Hermes agent roster so beds scale up or down automatically.
- **Live Telemetry & Human Behavior**:
  - **Working**: Agent walks to their Floor 1 workstation desk, sits down, and shows active thought bubbles above their head.
  - **Idle**: Agent roams naturally — grabbing coffee, watching TV, playing pool, reading, or walking upstairs to nap on Floor 2.
  - **Alert**: High-visibility crimson thought bubble & beacon alerting the Operator for immediate review.`,
  },
];

export const INITIAL_CRON_JOBS: CronJob[] = [];

export const INITIAL_FILES: WorkspaceFile[] = [
  {
    id: 'f-user',
    path: '~/.hermes/USER.md',
    folder: '~/.hermes',
    agentId: 'operator',
    language: 'markdown',
    updatedAt: 'Nov 19, 2026 · 14:22',
    content: `# USER.md — Operator Profile

- **Operator**: Rayden
- **Primary Host**: \`hermesagent\` (Oracle Cloud PAYG ARM64 · 4 vCPU · 24 GB RAM · 200 GB NVMe)
- **Private Mesh**: Tailscale \`100.72.221.36\`
- **Preferences**:
  - Require explicit approval on plans and destructive shell commands.
  - Keep dashboards fast, legible on desktop & mobile, and grounded in real telemetry.`,
  },
  {
    id: 'f-rules',
    path: '~/.hermes/OPERATING_RULES.md',
    folder: '~/.hermes',
    agentId: 'operator',
    language: 'markdown',
    updatedAt: 'Nov 18, 2026 · 09:10',
    content: `# OPERATING_RULES.md

1. **PLAN_APPROVAL**: Every multi-agent mission enters \`Awaiting Approval\` before specialists act.
2. **SHELL_GATE**: Destructive shell operations (\`rm -rf\`, \`systemctl stop\`, \`reboot\`, \`iptables -F\`) require explicit HITL confirmation.
3. **ZERO_FABRICATION**: Report real errors verbatim; never mask offline peers as healthy.
4. **DOC_FILING**: Completed mission outputs are saved automatically to the Docs library.
5. **PRIVACY_BOUNDARY**: Keep internal ports bound strictly to Tailscale / loopback.`,
  },
  {
    id: 'f-config',
    path: '~/.hermes/config.yaml',
    folder: '~/.hermes',
    agentId: 'operator',
    language: 'yaml',
    updatedAt: 'Nov 20, 2026 · 14:58',
    content: `fleet:
  name: GALAXY
  host: hermesagent
  tailscale_ip: 100.72.221.36

services:
  hermes_gateway:
    bind: 100.72.221.36
    port: 9119
  nine_router:
    bind: 127.0.0.1
    port: 20128
  voice_tts:
    engine: edge-tts
    default_voice: id-ID-GadisNeural`,
  },
];

export const INITIAL_HEALTH_CHECKS: HealthCheck[] = [
  { id: 'hc-1', name: 'Hermes Gateway (:9119)', category: 'core', status: 'pass', latencyMs: 11, detail: 'PID 998 listening on 100.72.221.36:9119' },
  { id: 'hc-2', name: '9Router Dispatch Proxy (:20128)', category: 'core', status: 'pass', latencyMs: 18, detail: 'Next server healthy, 4 active model routes' },
  { id: 'hc-3', name: 'Edge TTS Neural Engine', category: 'core', status: 'pass', latencyMs: 16, detail: 'Microsoft Edge neural voices ready (ID & EN)' },
  { id: 'hc-4', name: 'Node MainThread Worker (:9377)', category: 'core', status: 'pass', latencyMs: 9, detail: 'Event loop lag 0.8ms' },
  { id: 'hc-5', name: 'Gateway Unix Socket', category: 'core', status: 'pass', latencyMs: 2, detail: '~/.hermes/gateway.sock responsive' },
  { id: 'hc-6', name: 'Tailscale Control Plane', category: 'network', status: 'pass', latencyMs: 31, detail: 'Connected · Direct peer path active' },
  { id: 'hc-7', name: 'Peer hermesagent (100.72.221.36)', category: 'network', status: 'pass', latencyMs: 24, detail: 'ICMP pong 24ms · 0% packet loss' },
  { id: 'hc-8', name: 'Firewall Tailscale Ingress', category: 'network', status: 'pass', latencyMs: 4, detail: 'Public ports sealed · tailscale0 allowed' },
  { id: 'hc-9', name: 'TLS & Token Handshake', category: 'network', status: 'pass', latencyMs: 14, detail: 'Bearer auth verified' },
  { id: 'hc-10', name: 'DNS Resolution Health', category: 'network', status: 'pass', latencyMs: 19, detail: 'Upstream IPv4 resolver responsive' },
  { id: 'hc-11', name: 'Executor HQ (default)', category: 'agents', status: 'pass', latencyMs: 16, detail: 'Heartbeat OK · Orchestrator active' },
  { id: 'hc-12', name: 'VPS Guardian (vps-guardian)', category: 'agents', status: 'pass', latencyMs: 12, detail: 'Watchdog loop active · 0 alerts' },
  { id: 'hc-13', name: 'Research Institute', category: 'agents', status: 'pass', latencyMs: 21, detail: 'Web fetch & citation cache ready' },
  { id: 'hc-14', name: 'Code Foundry', category: 'agents', status: 'pass', latencyMs: 17, detail: 'Sandbox workspace mounted' },
  { id: 'hc-15', name: 'Data Citadel', category: 'agents', status: 'pass', latencyMs: 13, detail: 'SQLite read pool healthy' },
  { id: 'hc-16', name: 'Content Atelier & Studio', category: 'agents', status: 'pass', latencyMs: 15, detail: 'Docs writer & TTS pipeline ready' },
  { id: 'hc-17', name: 'Kanban SQLite (kanban.db)', category: 'storage', status: 'pass', latencyMs: 5, detail: 'WAL mode · integrity_check OK' },
  { id: 'hc-18', name: 'Shared State (shared-state.db)', category: 'storage', status: 'pass', latencyMs: 6, detail: '184 KB · 0 lock contention' },
  { id: 'hc-19', name: 'Projects Store (projects.db)', category: 'storage', status: 'pass', latencyMs: 4, detail: '45 KB · indexed' },
  { id: 'hc-20', name: 'NVMe Root Volume (200 GB)', category: 'storage', status: 'pass', latencyMs: 3, detail: '62 GB used (31%) · 138 GB free' },
  { id: 'hc-21', name: 'Memory Backups & Cron Dir', category: 'storage', status: 'pass', latencyMs: 7, detail: 'Last snapshot 4h ago' },
];

export const INITIAL_INTER_AGENT_LOGS: InterAgentLog[] = [];

export const INITIAL_INTEGRATIONS: IntegrationService[] = [
  {
    id: 'int-hermes',
    name: 'Hermes Gateway',
    endpoint: 'http://100.72.221.36:9119/api/status',
    category: 'runtime',
    status: 'connected',
    description: 'Core fleet orchestrator API exposing active profiles, sessions, and mission bus.',
    enabled: true,
  },
  {
    id: 'int-9router',
    name: '9Router Model Proxy',
    endpoint: 'http://127.0.0.1:20128/v1/chat/completions',
    category: 'routing',
    status: 'connected',
    description: 'Unified multi-provider LLM router balancing Sonnet, Gemini, and GPT tiers.',
    enabled: true,
  },
  {
    id: 'int-voice',
    name: 'Edge TTS Neural',
    endpoint: '/api/voice/speak (edge-tts)',
    category: 'voice',
    status: 'connected',
    description: 'Microsoft Edge neural speech synthesis (Indonesian & English voices) with browser TTS fallback.',
    enabled: true,
  },
  {
    id: 'int-tailscale',
    name: 'Tailscale Private Mesh',
    endpoint: '100.72.221.36 ↔ 100.85.109.20',
    category: 'network',
    status: 'connected',
    description: 'Encrypted WireGuard peer link isolating mission control from public internet.',
    enabled: true,
  },
  {
    id: 'int-telegram',
    name: 'Telegram Fleet Topics',
    endpoint: 'bot-api / multi-topic router',
    category: 'messaging',
    status: 'standby',
    description: 'Routes specialist updates and mobile approvals to dedicated Telegram supergroup topics.',
    enabled: true,
  },
  {
    id: 'int-discord',
    name: 'Discord Command Bus',
    endpoint: 'webhook / #nexora-ops',
    category: 'messaging',
    status: 'standby',
    description: 'Mirrors delivered mission reports and critical VPS alerts to private ops server.',
    enabled: false,
  },
];

export const DEFAULT_SETTINGS: OperatorSettings = {
  operatorName: 'Rayden',
  cityLabel: 'JAKARTA',
  timezone: 'Asia/Jakarta',
  theme: 'obsidian-ember',
  language: 'id',
  voiceEngine: 'edge-tts',
  edgeVoiceId: 'id-ID-GadisNeural',
  autoSpeakReplies: true,
  bridgeMode: 'demo',
  bridgeUrl: 'http://100.85.109.20:9120',
  bridgeToken: '',
  showOnlyVpsAgents: true,
  dashboardPinEnabled: false,
  dashboardPin: '4820',
};
