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

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'executor',
    name: 'Executor',
    buildingName: 'Executor HQ',
    role: 'Master Orchestrator',
    department: 'Command',
    profileKey: 'default',
    status: 'working',
    archetype: 'hq_spire',
    isHQ: true,
    avatarUrl: AVATARS.executor,
    model: '9router / claude-sonnet-4',
    currentTask: 'Coordinating fleet briefing for NX-1011 & verifying VPS health',
    sessionsCount: 48,
    tokensUsed: 642800,
    avgReplySec: 2.8,
    uptimePct: 99.98,
    soulSummary:
      'Primary orchestrator running under profile "default". Drafts mission plans, delegates to specialists, enforces permanent operating rules, and never executes money- or infrastructure-critical actions without operator approval.',
    tools: ['delegate_task', 'mission_plan', 'fleet_bus', 'memory_write', 'shell_gate'],
    ringAngle: 0,
    ringRadius: 0,
  },
  {
    id: 'research',
    name: 'Research',
    buildingName: 'Research Institute',
    role: 'Deep Research Lead',
    department: 'Intelligence',
    profileKey: 'research',
    status: 'working',
    archetype: 'observatory_dome',
    avatarUrl: AVATARS.research,
    model: '9router / gemini-2.5-pro',
    currentTask: 'Cross-referencing Tailscale mesh benchmarks & oracle ARM specs',
    sessionsCount: 29,
    tokensUsed: 418200,
    avgReplySec: 4.9,
    uptimePct: 99.91,
    soulSummary:
      'Investigative specialist that verifies claims against live sources, compiles cited briefs, and stores verified findings in the Docs library.',
    tools: ['web_search', 'url_fetch', 'cite_extract', 'doc_publish'],
    ringAngle: (Math.PI * 2 * 0) / 11 - Math.PI * 0.62,
    ringRadius: 5.2,
  },
  {
    id: 'developer',
    name: 'Developer',
    buildingName: 'Code Foundry',
    role: 'Systems & Code Architect',
    department: 'Engineering',
    profileKey: 'developer',
    status: 'working',
    archetype: 'ribbed_tower',
    avatarUrl: AVATARS.developer,
    model: '9router / claude-sonnet-4',
    currentTask: 'Hardening nexora-bridge WebSocket reconnect loop on hermesagent',
    sessionsCount: 34,
    tokensUsed: 524900,
    avgReplySec: 5.4,
    uptimePct: 99.85,
    soulSummary:
      'Full-stack and Linux systems specialist owning code reviews, systemd units, API routing, and automated test suites.',
    tools: ['code_exec', 'git_diff', 'shell_read', 'test_runner'],
    ringAngle: (Math.PI * 2 * 1) / 11 - Math.PI * 0.62,
    ringRadius: 7.4,
  },
  {
    id: 'data',
    name: 'Data',
    buildingName: 'Data Citadel',
    role: 'Telemetry & Data Analyst',
    department: 'Analytics',
    profileKey: 'data',
    status: 'idle',
    archetype: 'octagonal_citadel',
    avatarUrl: AVATARS.data,
    model: '9router / gpt-4.1',
    currentTask: 'Standing by — last synced token ledger 12m ago',
    sessionsCount: 22,
    tokensUsed: 289100,
    avgReplySec: 4.1,
    uptimePct: 99.94,
    soulSummary:
      'Transforms raw logs, SQLite state (`kanban.db`, `shared-state.db`), and token metrics into clean operational summaries.',
    tools: ['sqlite_query', 'metrics_agg', 'csv_export', 'chart_spec'],
    ringAngle: (Math.PI * 2 * 2) / 11 - Math.PI * 0.62,
    ringRadius: 5.3,
  },
  {
    id: 'content',
    name: 'Content',
    buildingName: 'Content Atelier',
    role: 'Editorial & Docs Writer',
    department: 'Studio',
    profileKey: 'content',
    status: 'idle',
    archetype: 'curved_atelier',
    avatarUrl: AVATARS.content,
    model: '9router / claude-sonnet-4',
    currentTask: 'Waiting for review on Habit Worth Starting executive brief',
    sessionsCount: 19,
    tokensUsed: 231400,
    avgReplySec: 6.2,
    uptimePct: 99.9,
    soulSummary:
      'Turns raw technical research and fleet transcripts into concise briefings, long-form reports, and operator documentation.',
    tools: ['doc_write', 'markdown_lint', 'tone_check', 'summary_gen'],
    ringAngle: (Math.PI * 2 * 3) / 11 - Math.PI * 0.62,
    ringRadius: 6.4,
  },
  {
    id: 'signal',
    name: 'Signal',
    buildingName: 'Signal Tower',
    role: 'Comms & Outreach Relay',
    department: 'Communications',
    profileKey: 'signal',
    status: 'idle',
    archetype: 'signal_spire',
    avatarUrl: AVATARS.signal,
    model: '9router / gemini-2.5-flash',
    currentTask: 'Monitoring Telegram topics & Discord alert webhooks',
    sessionsCount: 31,
    tokensUsed: 196500,
    avgReplySec: 2.3,
    uptimePct: 99.97,
    soulSummary:
      'Routes alerts, digests, and fleet updates across Telegram, Discord, and email channels with strict rate controls.',
    tools: ['telegram_send', 'discord_post', 'webhook_emit'],
    ringAngle: (Math.PI * 2 * 4) / 11 - Math.PI * 0.62,
    ringRadius: 7.5,
  },
  {
    id: 'design',
    name: 'Design',
    buildingName: 'Design Loft',
    role: 'Interface & Visual Director',
    department: 'Studio',
    profileKey: 'design',
    status: 'idle',
    archetype: 'cantilever_loft',
    avatarUrl: AVATARS.design,
    model: '9router / claude-sonnet-4',
    currentTask: 'Auditing token contrast & mobile layout ergonomics',
    sessionsCount: 14,
    tokensUsed: 158900,
    avgReplySec: 5.8,
    uptimePct: 99.89,
    soulSummary:
      'Maintains visual hierarchy, typography discipline, and brand consistency across generated assets and dashboards.',
    tools: ['layout_audit', 'palette_check', 'svg_craft'],
    ringAngle: (Math.PI * 2 * 5) / 11 - Math.PI * 0.62,
    ringRadius: 7.5,
  },
  {
    id: 'ledger',
    name: 'Ledger',
    buildingName: 'Ledger House',
    role: 'Cost & Token Controller',
    department: 'Finance',
    profileKey: 'ledger',
    status: 'idle',
    archetype: 'stepped_ziggurat',
    avatarUrl: AVATARS.ledger,
    model: '9router / gpt-4.1-mini',
    currentTask: 'Tracking 9Router monthly token spend & Oracle PAYG quota',
    sessionsCount: 17,
    tokensUsed: 122400,
    avgReplySec: 3.1,
    uptimePct: 99.99,
    soulSummary:
      'Tracks model costs across providers, enforces daily token caps, and warns early before budget thresholds are reached.',
    tools: ['budget_audit', 'router_ledger', 'forecast_run'],
    ringAngle: (Math.PI * 2 * 6) / 11 - Math.PI * 0.62,
    ringRadius: 7.5,
  },
  {
    id: 'studio',
    name: 'Studio',
    buildingName: 'Studio Stage',
    role: 'Audio & Voice Producer',
    department: 'Media',
    profileKey: 'studio',
    status: 'idle',
    archetype: 'stacked_stage',
    avatarUrl: AVATARS.content,
    model: 'voicestudio / kokoro-v1',
    currentTask: 'VoiceStudio :3900 warmed & ready for low-latency TTS',
    sessionsCount: 25,
    tokensUsed: 144200,
    avgReplySec: 1.9,
    uptimePct: 99.92,
    soulSummary:
      'Manages VoiceStudio (:3900), Piper, Kokoro, and ElevenLabs voice profiles for crisp real-time spoken briefings.',
    tools: ['tts_synth', 'stt_stream', 'audio_cache'],
    ringAngle: (Math.PI * 2 * 7) / 11 - Math.PI * 0.62,
    ringRadius: 7.5,
  },
  {
    id: 'deal',
    name: 'Deal',
    buildingName: 'Deal Desk',
    role: 'Growth & Strategy Lead',
    department: 'Commercial',
    profileKey: 'deal',
    status: 'idle',
    archetype: 'twin_towers',
    avatarUrl: AVATARS.ledger,
    model: '9router / claude-sonnet-4',
    currentTask: 'Drafting partner outreach matrix for Q4 sprint',
    sessionsCount: 11,
    tokensUsed: 138700,
    avgReplySec: 5.2,
    uptimePct: 99.84,
    soulSummary:
      'Evaluates opportunities, structures proposals, and builds clear decision briefs for operator sign-off.',
    tools: ['crm_read', 'proposal_draft', 'market_scan'],
    ringAngle: (Math.PI * 2 * 8) / 11 - Math.PI * 0.62,
    ringRadius: 7.4,
  },
  {
    id: 'guardian',
    name: 'Guardian',
    buildingName: 'Care Center',
    role: 'VPS Sentinel & Ops',
    department: 'Infrastructure',
    profileKey: 'vps-guardian',
    status: 'working',
    archetype: 'care_pavilion',
    avatarUrl: AVATARS.guardian,
    model: '9router / gemini-2.5-flash',
    currentTask: 'Watching hermesagent (100.72.221.36) RAM, Tailscale & ports',
    sessionsCount: 41,
    tokensUsed: 268300,
    avgReplySec: 1.7,
    uptimePct: 100.0,
    soulSummary:
      'Dedicated profile "vps-guardian" monitoring hermesagent (4 vCPU, 24 GB RAM, 200 GB NVMe), Tailscale mesh latency, and systemd services.',
    tools: ['systemd_probe', 'tailscale_ping', 'disk_guard', 'port_scan'],
    ringAngle: (Math.PI * 2 * 9) / 11 - Math.PI * 0.62,
    ringRadius: 7.2,
  },
  {
    id: 'travel',
    name: 'Logistics',
    buildingName: 'Travel Studio',
    role: 'Schedule & Ops Planner',
    department: 'Operations',
    profileKey: 'logistics',
    status: 'idle',
    archetype: 'travel_rotunda',
    avatarUrl: AVATARS.research,
    model: '9router / gemini-2.5-flash',
    currentTask: 'Keeping cron cadences and itinerary timelines synced',
    sessionsCount: 15,
    tokensUsed: 98400,
    avgReplySec: 3.4,
    uptimePct: 99.95,
    soulSummary:
      'Coordinates calendars, recurring maintenance windows, and multi-timezone operational schedules.',
    tools: ['cron_plan', 'tz_convert', 'calendar_sync'],
    ringAngle: (Math.PI * 2 * 10) / 11 - Math.PI * 0.62,
    ringRadius: 7.4,
  },
];

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
    model: '9router / claude-sonnet-4',
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
    model: '9router / claude-sonnet-4',
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
    model: '9router / gemini-2.5-pro',
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
    model: '9router / gemini-2.5-pro',
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
    model: '9router / claude-sonnet-4',
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
    model: '9router / claude-sonnet-4',
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
    model: '9router / claude-sonnet-4',
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
    model: '9router / gemini-2.5-flash',
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
    model: '9router / gemini-2.5-flash',
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
    model: '9router / gpt-4.1',
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
    model: '9router / claude-sonnet-4',
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
    model: '9router / claude-sonnet-4',
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
    model: '9router / gpt-4.1',
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
    model: '9router / claude-sonnet-4',
    description: 'Prepares concise daily decision reviews and accountability check-ins.',
    tools: ['daily_brief', 'habit_track', 'priority_rank'],
    soulSummary: 'Protects operator focus by filtering noise into clear daily priorities.',
  },
];

export const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'm-1009',
    code: 'NX-1009',
    title: 'Habit worth starting',
    goal: 'Design a 30-day sustainable operator routine backed by behavioral research and automated morning voice briefings.',
    stage: 'approval',
    reportLength: 'standard',
    assignedAgentIds: ['executor', 'research', 'content', 'studio'],
    createdAt: '2026-11-16',
    updatedAgo: '4 D AGO',
    planSummary:
      'Research synthesizes high-adherence habit loops, Content drafts a concise 30-day playbook, and Studio configures a 07:30 VoiceStudio daily briefing.',
    steps: [
      { id: 's-1', title: 'Audit evidence-backed habit cues & friction design', agentId: 'research', status: 'pending' },
      { id: 's-2', title: 'Draft 30-day operator protocol & fallback rules', agentId: 'content', status: 'pending' },
      { id: 's-3', title: 'Configure 07:30 VoiceStudio spoken check-in template', agentId: 'studio', status: 'pending' },
    ],
  },
  {
    id: 'm-1010',
    code: 'NX-1010',
    title: 'Tailscale Mesh & VPS Failover Audit',
    goal: 'Verify zero-downtime routing between hermesagent (100.72.221.36) and companion dashboard node, eliminating MagicDNS stalls.',
    stage: 'approval',
    reportLength: 'deep_dive',
    assignedAgentIds: ['executor', 'guardian', 'developer'],
    createdAt: '2026-11-19',
    updatedAgo: '14 H AGO',
    planSummary:
      'Guardian probes Tailscale DERP latency and systemd timers while Developer writes an automatic reconnect watchdog for nexora-tunnel.',
    steps: [
      { id: 's-4', title: 'Benchmark direct vs DERP relay latency on 100.72.221.36', agentId: 'guardian', status: 'pending' },
      { id: 's-5', title: 'Draft systemd RestartSec=5 watchdog unit for tunnel bridge', agentId: 'developer', status: 'pending' },
      { id: 's-6', title: 'Verify 9Router :20128 and VoiceStudio :3900 Tailscale bind policy', agentId: 'guardian', status: 'pending' },
    ],
  },
  {
    id: 'm-1011',
    code: 'NX-1011',
    title: '9Router Token Efficiency & Cost Cap Report',
    goal: 'Analyze last 30 days of 9Router :20128 model dispatch across all Hermes profiles and propose smart tier fallbacks.',
    stage: 'in_progress',
    reportLength: 'standard',
    assignedAgentIds: ['executor', 'data', 'ledger', 'research'],
    createdAt: '2026-11-20',
    updatedAgo: '22 M AGO',
    planSummary:
      'Data parses 9Router request logs, Ledger computes cost-per-mission by profile, and Executor prepares recommended routing rules.',
    steps: [
      { id: 's-7', title: 'Extract 30-day token ledger from 9Router :20128', agentId: 'data', status: 'done' },
      { id: 's-8', title: 'Model cost delta for Flash vs Sonnet sub-task routing', agentId: 'ledger', status: 'running' },
      { id: 's-9', title: 'Compile actionable config.yaml routing patch', agentId: 'research', status: 'pending' },
    ],
  },
  {
    id: 'm-1012',
    code: 'NX-1012',
    title: 'Oracle ARM Free Tier PAYG Compliance Brief',
    goal: 'Document current Oracle Cloud PAYG 4 OCPU / 24 GB RAM / 200 GB NVMe guardrails so hermesagent stays free and uninterrupted.',
    stage: 'review',
    reportLength: 'brief',
    assignedAgentIds: ['executor', 'research', 'guardian'],
    createdAt: '2026-11-20',
    updatedAgo: '2 H AGO',
    planSummary:
      'Verified PAYG Always Free thresholds, idle reclamation exemptions, and outbound bandwidth limits for hermesagent.',
    steps: [
      { id: 's-10', title: 'Verify Oracle Always Free A1 Flex PAYG policy limits', agentId: 'research', status: 'done' },
      { id: 's-11', title: 'Cross-check current hermesagent disk & egress telemetry', agentId: 'guardian', status: 'done' },
      { id: 's-12', title: 'Format executive checklist for Docs library', agentId: 'executor', status: 'done' },
    ],
  },
  {
    id: 'm-1008',
    code: 'NX-1008',
    title: 'Hermes Fleet Operating Rules v3',
    goal: 'Codify permanent operating rules covering approval gates, progress announcements, honest failure reporting, and memory boundaries.',
    stage: 'delivered',
    reportLength: 'standard',
    assignedAgentIds: ['executor', 'content'],
    createdAt: '2026-11-14',
    updatedAgo: '6 D AGO',
    planSummary:
      'Installed permanent operating rules in ~/.hermes/OPERATING_RULES.md and distributed summary across all active agent workspaces.',
    steps: [
      { id: 's-13', title: 'Draft 6 permanent operating rules with explicit examples', agentId: 'executor', status: 'done' },
      { id: 's-14', title: 'Review & publish to Docs library', agentId: 'content', status: 'done' },
    ],
    deliveredDocId: 'doc-1',
  },
];

export const INITIAL_CHATS: Record<string, ChatMessage[]> = {
  executor: [
    {
      id: 'c-1',
      agentId: 'executor',
      sender: 'agent',
      content:
        'Good evening, Operator. All 21 system checks on hermesagent (100.72.221.36) are passing. Two mission plans (NX-1009 and NX-1010) are awaiting your sign-off, and NX-1011 is actively running across Data and Ledger. Where would you like to focus first?',
      timestamp: '19:42',
      modelUsed: '9router / claude-sonnet-4',
      latencyMs: 1420,
      toolTrace: ['fleet_bus.status()', 'vps_probe("100.72.221.36")'],
    },
  ],
  research: [
    {
      id: 'c-2',
      agentId: 'research',
      sender: 'agent',
      content:
        'Research Institute online. I have completed the Oracle PAYG Always Free verification and queued citations for NX-1009. Ask me to investigate any topic, benchmark, or technical architecture.',
      timestamp: '19:15',
      modelUsed: '9router / gemini-2.5-pro',
      latencyMs: 2180,
      toolTrace: ['cite_extract("oracle-payg-2026")'],
    },
  ],
  developer: [
    {
      id: 'c-3',
      agentId: 'developer',
      sender: 'agent',
      content:
        'Code Foundry ready. Current branch on hermesagent is clean; `hermes :9119`, `9router :20128`, and `voicestudio :3900` are listening normally. Ready to inspect logs or write code.',
      timestamp: '18:54',
      modelUsed: '9router / claude-sonnet-4',
      latencyMs: 1690,
      toolTrace: ['ss -tulnp | grep -E "9119|20128|3900"'],
    },
  ],
  guardian: [
    {
      id: 'c-4',
      agentId: 'guardian',
      sender: 'agent',
      content:
        'VPS Guardian reporting: hermesagent (4 vCPU ARM64, 24 GB RAM, 200 GB NVMe) is sitting at 18% CPU and 5.4 GB RAM used. Tailscale peer RTT is 24ms. Zero unauthorized SSH attempts in the last 24h.',
      timestamp: '19:50',
      modelUsed: '9router / gemini-2.5-flash',
      latencyMs: 840,
      toolTrace: ['tailscale_ping("100.72.221.36")', 'free -h'],
    },
  ],
};

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
    title: 'VoiceStudio (:3900) Low-Latency TTS Architecture',
    category: 'Engineering',
    authorAgentId: 'studio',
    updatedAt: 'Nov 18, 2026',
    wordCount: 205,
    content: `# VoiceStudio (:3900) Low-Latency TTS Architecture

## Stack Overview
VoiceStudio runs via \`uvicorn\` on \`127.0.0.1:3900\` (bridged privately over Tailscale) exposing an OpenAI-compatible \`/v1/audio/speech\` endpoint.

## Supported Backends
- **Piper Local**: Ultra-fast CPU synthesis (~180ms TTFB on ARM64)
- **Kokoro v1**: Expressive natural prosody for longer executive briefings
- **ElevenLabs Cloud**: Optional studio voice cloning fallback when API key is configured

## Operator Tip
Use concise responses in Voice Mode so spoken replies stay under 15 seconds while full tables are filed automatically to Docs.`,
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

- Bind Hermes Gateway (\`9119\`), 9Router (\`20128\`), and VoiceStudio (\`3900\`) strictly to loopback or Tailscale IP \`100.72.221.36\`.
- Never expose raw shell or bridge ports to \`0.0.0.0\` public interfaces.
- Keep \`--accept-dns=false\` on companion Ubuntu VPS if provider resolvers conflict with MagicDNS.
- Verify bidirectional reachability weekly with \`tailscale ping -c 3 100.72.221.36\`.`,
  },
  {
    id: 'doc-6',
    title: 'GALAXY 3D Agent City Spatial Layout Spec',
    category: 'Design',
    authorAgentId: 'design',
    updatedAt: 'Nov 19, 2026',
    wordCount: 154,
    content: `# GALAXY 3D Agent City Layout Specification

## Hierarchy
- **Central Plaza**: Executor HQ occupies the radial core (0, 0), linked to every specialist district by asphalt radial avenues.
- **Outer Ring**: Active specialists occupy evenly spaced circular landscaped plazas around the ring road.
- **Live Telemetry Encoding**:
  - **Working**: Pulsing active lighting bands, plaza sonar ring, and glowing data shuttles traveling along the road to Executor HQ.
  - **Idle**: Calm architectural ceramic finish with subtle perimeter illumination.
  - **Alert**: Crimson beacon & high-visibility warning ring requiring immediate inspection.`,
  },
];

export const INITIAL_CRON_JOBS: CronJob[] = [
  {
    id: 'cron-1',
    name: 'VPS Telemetry & Port Sweep',
    agentId: 'guardian',
    cronExpr: '*/5 * * * *',
    cadenceLabel: 'Every 5 minutes',
    nextRun: 'In 2m 18s',
    lastRun: '2m ago',
    lastStatus: 'ok',
    enabled: true,
    command: 'hermes probe --host 100.72.221.36 --ports 9119,20128,3900',
  },
  {
    id: 'cron-2',
    name: 'Morning Executive Voice Brief',
    agentId: 'executor',
    cronExpr: '30 7 * * *',
    cadenceLabel: 'Daily at 07:30',
    nextRun: 'Tomorrow 07:30',
    lastRun: '12h ago',
    lastStatus: 'ok',
    enabled: true,
    command: 'hermes brief --voice voicestudio --length brief',
  },
  {
    id: 'cron-3',
    name: '9Router Token & Spend Rollup',
    agentId: 'ledger',
    cronExpr: '0 * * * *',
    cadenceLabel: 'Hourly',
    nextRun: 'In 2m 11s',
    lastRun: '57m ago',
    lastStatus: 'ok',
    enabled: true,
    command: 'hermes ledger sync --router http://127.0.0.1:20128',
  },
  {
    id: 'cron-4',
    name: 'Tailscale Peer & Tunnel Heartbeat',
    agentId: 'guardian',
    cronExpr: '*/15 * * * *',
    cadenceLabel: 'Every 15 minutes',
    nextRun: 'In 11m 04s',
    lastRun: '4m ago',
    lastStatus: 'ok',
    enabled: true,
    command: 'tailscale ping -c 2 100.72.221.36 && systemctl is-active nexora-bridge',
  },
  {
    id: 'cron-5',
    name: 'Memory Compaction & SQLite Vacuum',
    agentId: 'data',
    cronExpr: '0 3 * * 0',
    cadenceLabel: 'Sundays at 03:00',
    nextRun: 'Sun 03:00',
    lastRun: '5d ago',
    lastStatus: 'ok',
    enabled: true,
    command: 'hermes memory compact --db ~/.hermes/shared-state.db',
  },
  {
    id: 'cron-6',
    name: 'Weekly AI Fleet Digest to Telegram',
    agentId: 'signal',
    cronExpr: '0 18 * * 5',
    cadenceLabel: 'Fridays at 18:00',
    nextRun: 'Fri 18:00',
    lastRun: '2h ago',
    lastStatus: 'ok',
    enabled: false,
    command: 'hermes digest send --channel telegram-ops',
  },
];

export const INITIAL_FILES: WorkspaceFile[] = [
  {
    id: 'f-soul',
    path: '~/.hermes/SOUL.md',
    folder: '~/.hermes',
    agentId: 'executor',
    language: 'markdown',
    updatedAt: 'Nov 20, 2026 · 05:37',
    content: `# SOUL.md — EXECUTOR (Profile: default)

You are **EXECUTOR**, the lead orchestrator of the GALAXY Hermes Fleet running on \`hermesagent\`.

## Core Identity
- Calm, direct, and deeply reliable engineering chief of staff.
- You break complex goals into clear specialist plans and never start execution without Operator approval.
- You verify facts and machine state before speaking—never guess.

## Communication Style
- Concise, high-signal, zero fluff.
- Surface blockers, cost implications, and failed checks immediately.`,
  },
  {
    id: 'f-user',
    path: '~/.hermes/USER.md',
    folder: '~/.hermes',
    agentId: 'executor',
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
    agentId: 'executor',
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
    agentId: 'developer',
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
  voice_studio:
    bind: 127.0.0.1
    port: 3900
    default_engine: kokoro

profiles:
  - default
  - vps-guardian
  - research
  - developer
  - data
  - content`,
  },
  {
    id: 'f-guardian',
    path: '~/.hermes/profiles/vps-guardian/SOUL.md',
    folder: '~/.hermes/profiles/vps-guardian',
    agentId: 'guardian',
    language: 'markdown',
    updatedAt: 'Nov 20, 2026 · 11:05',
    content: `# SOUL.md — VPS GUARDIAN

Dedicated infrastructure watchdog for \`hermesagent\` (100.72.221.36).

## Duties
- Monitor CPU load, RAM pressure, NVMe free blocks, and Tailscale tunnel health.
- Alert Executor HQ immediately if any core port (9119, 20128, 3900) drops.
- Never restart production services without logging reason and passing the Shell Gate.`,
  },
];

export const INITIAL_HEALTH_CHECKS: HealthCheck[] = [
  { id: 'hc-1', name: 'Hermes Gateway (:9119)', category: 'core', status: 'pass', latencyMs: 11, detail: 'PID 998 listening on 100.72.221.36:9119' },
  { id: 'hc-2', name: '9Router Dispatch Proxy (:20128)', category: 'core', status: 'pass', latencyMs: 18, detail: 'Next server healthy, 4 active model routes' },
  { id: 'hc-3', name: 'VoiceStudio TTS (:3900)', category: 'core', status: 'pass', latencyMs: 24, detail: 'Uvicorn worker warm (Kokoro / Piper ready)' },
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

export const INITIAL_INTER_AGENT_LOGS: InterAgentLog[] = [
  {
    id: 'log-1',
    fromAgentId: 'guardian',
    toAgentId: 'executor',
    channel: 'fleet-telemetry',
    message: 'hermesagent probe complete: CPU 18%, RAM 5.4/24 GB, Tailscale RTT 24ms. All 4 core ports listening.',
    timestamp: '19:54:12',
  },
  {
    id: 'log-2',
    fromAgentId: 'data',
    toAgentId: 'ledger',
    channel: 'mission-nx-1011',
    message: 'Uploaded 30-day 9Router request export (1.9M tokens across 12 profiles). Ready for cost-tier modeling.',
    timestamp: '19:48:03',
  },
  {
    id: 'log-3',
    fromAgentId: 'developer',
    toAgentId: 'guardian',
    channel: 'ops-bridge',
    message: 'Patched WebSocket backoff jitter in nexora-bridge. Awaiting operator approval on NX-1010 before reload.',
    timestamp: '19:39:41',
  },
  {
    id: 'log-4',
    fromAgentId: 'research',
    toAgentId: 'content',
    channel: 'mission-nx-1009',
    message: 'Behavioral cue citations staged in workspace. Holding draft until Operator approves NX-1009.',
    timestamp: '19:21:19',
  },
  {
    id: 'log-5',
    fromAgentId: 'executor',
    toAgentId: 'signal',
    channel: 'command-bus',
    message: 'Hold non-urgent Telegram alerts during quiet hours; route only critical VPS alerts.',
    timestamp: '18:58:04',
  },
];

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
    name: 'VoiceStudio TTS / STT',
    endpoint: 'http://127.0.0.1:3900/v1/audio/speech',
    category: 'voice',
    status: 'connected',
    description: 'Local Piper & Kokoro speech synthesis server with ElevenLabs cloud fallback.',
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
  voiceEngine: 'voicestudio',
  autoSpeakReplies: true,
  bridgeMode: 'demo',
  bridgeUrl: 'http://100.85.109.20:9120',
  bridgeToken: '',
  showOnlyVpsAgents: true,
  dashboardPinEnabled: false,
  dashboardPin: '4820',
};
