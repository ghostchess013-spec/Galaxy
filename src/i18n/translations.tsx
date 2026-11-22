import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  Agent,
  AgentStatus,
  BuildingArchetype,
  CronJob,
  DocItem,
  HealthCheck,
  IntegrationService,
  InterAgentLog,
  LanguageId,
  Mission,
  MissionStage,
  NavSection,
  ReportLength,
  RolePreset,
  SearchResult,
  ThemeId,
} from '../types/nexora';

export type IdleActivityKey =
  | 'coffee'
  | 'tv'
  | 'billiard'
  | 'meeting'
  | 'reading'
  | 'stroll'
  | 'nap';

export const OFFICE_IDLE_THOUGHTS: Record<
  LanguageId,
  Record<IdleActivityKey, { emoji: string; lines: string[] }>
> = {
  id: {
    coffee: {
      emoji: '☕',
      lines: [
        'Ngopi dulu ah, lagi santai...',
        'Bikin espresso biar fokus lagi',
        'Cek pantry, butuh kafein',
      ],
    },
    tv: {
      emoji: '📺',
      lines: [
        'Nonton TV bentar, lagi gabut...',
        'Santai di sofa ruang tamu',
        'Lagi kosong nih, nonton dulu',
      ],
    },
    billiard: {
      emoji: '🎱',
      lines: [
        'Main biliar dulu mumpung santai',
        'Bosan nih, latihan sodok bola',
        'Cari inspirasi di meja biliar',
      ],
    },
    meeting: {
      emoji: '📋',
      lines: [
        'Cek papan rencana sebentar...',
        'Mikirin ide peningkatan baru',
        'Tinjau strategi di ruang rapat',
      ],
    },
    reading: {
      emoji: '📖',
      lines: [
        'Baca santai di ruang baca...',
        'Hmm, habis ini tugas apa ya?',
        'Lagi mikir sambil bersantai',
      ],
    },
    stroll: {
      emoji: '🚶',
      lines: [
        'Jalan-jalan bentar, pegal duduk',
        'Lagi gabut keliling kantor...',
        'Peregangan dulu biar segar',
      ],
    },
    nap: {
      emoji: '😴',
      lines: [
        'Zzz... tidur siang di Lantai 2',
        'Rebahan dulu mumpung luang',
        'Isi energi di kasur Lantai 2',
      ],
    },
  },
  en: {
    coffee: {
      emoji: '☕',
      lines: [
        'Grabbing a quick coffee break...',
        'Brewing espresso to stay sharp',
        'Checking the pantry for caffeine',
      ],
    },
    tv: {
      emoji: '📺',
      lines: [
        'Watching lounge TV for a bit...',
        'Chilling on the living room sofa',
        'All clear — catching up on TV',
      ],
    },
    billiard: {
      emoji: '🎱',
      lines: [
        'Playing a quick game of pool',
        'Bored — practicing bank shots',
        'Clearing my head at the pool table',
      ],
    },
    meeting: {
      emoji: '📋',
      lines: [
        'Checking the sprint board...',
        'Brainstorming fresh upgrades',
        'Reviewing strategy in meeting room',
      ],
    },
    reading: {
      emoji: '📖',
      lines: [
        'Reading quietly in the nook...',
        'Hmm, what task is coming next?',
        'Thinking while taking a breather',
      ],
    },
    stroll: {
      emoji: '🚶',
      lines: [
        'Stretching legs around the office',
        'Taking a quick walk between tasks',
        'Strolling through the atrium...',
      ],
    },
    nap: {
      emoji: '😴',
      lines: [
        'Zzz... power napping on Floor 2',
        'Resting upstairs while idle',
        'Recharging in the Floor 2 dorm',
      ],
    },
  },
};

export const OFFICE_WORKING_THOUGHTS: Record<LanguageId, string[]> = {
  id: [
    'Fokus mengeksekusi tugas aktif...',
    'Menyusun hasil kerja terbaik...',
    'Memproses alur 9Router...',
  ],
  en: [
    'Focused on active task execution...',
    'Compiling deliverables at desk...',
    'Processing 9Router workflow...',
  ],
};

export const OFFICE_ALERT_FALLBACK: Record<LanguageId, string> = {
  id: 'Butuh persetujuan Operator!',
  en: 'Needs Operator approval!',
};

export const TRANSLATIONS = {
  en: {
    // Brand & Shell
    brandSubtitle: 'Operator System',
    manageHeader: 'Manage',
    askGalaxyBtn: 'Ask GALAXY',
    searchPlaceholder: 'Search agents, missions, docs, files...',
    searchAria: 'Search agents, missions, docs, or files',
    searchEmpty: 'No matching agents, missions, or docs found.',
    searchTypeAgent: 'AGENT',
    searchTypeMission: 'MISSION',
    searchTypeDoc: 'DOC',
    searchTypeSchedule: 'SCHEDULE',
    searchTypeFile: 'FILE',
    operatorRole: 'Operator',
    openNavAria: 'Open navigation menu',
    closeNavAria: 'Close navigation menu',
    dismissNavAria: 'Dismiss navigation backdrop',
    openSettingsAria: 'Open Operator Settings',
    switchLangAria: 'Switch dashboard language',

    // Navigation
    navCockpit: 'Cockpit',
    navVoice: 'Voice Mode',
    navChat: 'Chat',
    navMissions: 'Missions',
    navDocs: 'Docs',
    navSchedule: 'Schedule',
    navOffice: 'Agent Office',
    navHealth: 'Health',
    navFiles: 'Files',
    navTerminal: 'Terminal',
    navIntegrations: 'Integrations',
    navGuide: 'Guide',
    navSettings: 'Settings',

    // Top Bridge Badge
    bridgeLive: 'LIVE BRIDGE',
    bridgeConnecting: 'CONNECTING',
    bridgeOffline: 'BRIDGE OFFLINE',
    bridgePreview: 'PREVIEW MODE',
    bridgeDeployCta: 'Deploy to VPS 2',
    bridgeConfigTitle: 'Configure Live VPS Bridge or VPS 2 Migration',

    // Lock Screen
    lockEyebrow: 'GALAXY Operator System',
    lockTitlePrefix: 'Dashboard',
    lockTitleAccent: 'Locked.',
    lockPlaceholder: 'Enter access PIN',
    lockInvalidPin: 'Invalid PIN. Try again.',
    lockUnlockBtn: 'Unlock Mission Control',

    // Common
    commonCancel: 'Cancel',
    commonSave: 'Save',
    commonSend: 'Send',
    commonEdit: 'Edit',
    commonClear: 'Clear',
    commonRun: 'Run',
    commonAll: 'All',
    commonActive: 'Active',
    commonPaused: 'Paused',
    commonEnabled: 'Enabled',
    commonEnable: 'Enable',
    commonDisabled: 'Disabled',
    commonWords: 'words',
    commonJustNow: 'Just now',
    commonNever: 'Never',
    commonScheduled: 'Scheduled',
    commonAttachment: 'Attachment',
    commonAttached: 'Attached',
    commonRemoveAttachment: 'Remove attachment',
    commonAttachFile: 'Attach file',
    commonTools: 'Tools',
    commonUpdated: 'Updated',
    commonProfile: 'Profile',
    commonStatusIdle: 'Idle',
    commonStatusWorking: 'Working',
    commonStatusAlert: 'Alert',
    commonPass: 'PASS',
    commonWarn: 'WARN',
    commonFail: 'FAIL',
    commonConnected: 'Connected',
    commonStandby: 'Standby',
    commonSimulated: 'Simulated',
    commonMsgShort: 'msg',
    commonFloorShort: 'F',
    commonBrief: 'Brief',
    commonStandard: 'Standard',
    commonDeepDive: 'Deep Dive',

    // Health Dial
    healthOverall: 'Overall',
    healthOptimal: 'Optimal',
    healthDegraded: 'Degraded',
    healthCritical: 'Critical',
    healthOfPass: '{passed} of {total} pass',
    healthAria: 'System health {label}, {passed} of {total} checks passing',

    // Cockpit View
    cockpitVoiceEyebrow: 'GALAXY / Voice Mode',
    cockpitVoiceTitle: 'Intelligence,',
    cockpitVoiceAccent: 'within reach.',
    cockpitVoiceDesc: 'A thought. A question. Your next move.',
    cockpitTalkBtn: 'Talk',
    cockpitAddShort: 'Add',
    cockpitAddAria: 'Add new Hermes agent',
    cockpitChatWithAria: 'Chat with {name}',
    cockpitOfficeEyebrow: 'GALAXY / Agent Office · 2 Floors',
    cockpitCrewTitle: 'Your crew is',
    cockpitCrewWorking: 'working.',
    cockpitCrewRelaxing: 'relaxing.',
    cockpitCrewReady: 'ready.',
    cockpitAddAgentBtn: 'Add Agent',
    cockpitOpenOfficeBtn: 'Open Full Office',
    cockpitKpiWorking: 'Working right now',
    cockpitKpiAlertReview: '{count} alert requiring review',
    cockpitKpiDesksBeds: '{count} desks & beds (1:1)',
    cockpitKpiSessions: 'Sessions (7 days)',
    cockpitKpiAcrossProfiles: 'Across {count} Hermes profiles',
    cockpitKpiAvgReply: 'Average reply',
    cockpitKpiViaRouter: 'Via 9Router :20128',
    cockpitKpiTokens: 'Tokens this month',
    cockpitKpiCrewTime: 'Active dashboard crew',
    cockpitHealthTitle: 'System Health',
    cockpitInspectBtn: 'Inspect',
    cockpitMachinePrefix: 'The machine is',
    cockpitMachineWell: 'quiet and well.',
    cockpitMachineWarn: 'flagging a warning.',
    cockpitMissionsEyebrow: 'GALAXY / Missions',
    cockpitDecisionsNone: 'All decisions',
    cockpitDecisionsCount: '{count} decision',
    cockpitDecisionsCountPlural: '{count} decisions',
    cockpitDecisionsSettled: 'settled.',
    cockpitDecisionsNeedYou: 'need you.',
    cockpitDecisionsSub: '{approvals} plan(s) to approve · {reviews} result(s) to review',
    cockpitApproveTag: 'Approve · {code}',
    cockpitApproveTitle: 'Approve the plan for {title}',
    cockpitApproveBtn: 'Approve plan',
    cockpitReviewBriefBtn: 'Review brief',
    cockpitNoBlockedTitle: 'No plans blocked on approval',
    cockpitNoBlockedDesc: 'Launch a new mission whenever you want your crew to draft and execute a plan.',
    cockpitNewMissionBtn: 'New Mission',
    cockpitViewAllMissions: 'View All {count} Missions',
    cockpitRosterTitle: 'Fleet Roster',
    cockpitRosterAccent: 'at a glance.',
    cockpitRosterSub: '{count} specialists deployed · click any unit to message or inspect',
    cockpitRosterEmptyTitle: 'No agents in this dashboard yet',
    cockpitRosterEmptyDesc:
      'Your 2 main Telegram agents remain completely isolated. Add new agents here dedicated to this dashboard.',
    cockpitManageOfficeBtn: 'Manage in Office',
    cockpitColSpecialist: 'Specialist',
    cockpitColWorkstation: 'Workstation',
    cockpitColStatus: 'Status',
    cockpitColSessions: 'Sessions',
    cockpitColAction: 'Action',
    cockpitMessageBtn: 'Message',
    cockpitBusTitle: 'What they said',
    cockpitBusAccent: 'to each other.',
    cockpitBusSub: 'Live inter-agent dispatch bus',
    cockpitBusEmpty: 'No inter-agent messages yet. Activity will appear once your agents collaborate.',
    cockpitFullLogBtn: 'Full Log',

    // Agent Office View (3D)
    officeEyebrow: 'GALAXY / 3D AI Agent Office · 2 Floors',
    officeTitle: 'Your office is',
    officeTitleAlive: 'alive.',
    officeTitleRelaxing: 'relaxing.',
    officeTitleEmpty: 'ready.',
    officeEmptyTitle: 'Your 3D Agent Office is empty & ready.',
    officeEmptyDesc:
      'Your 2 main Telegram agents stay isolated. Add a new agent to spawn their 1:1 Floor 1 desk and Floor 2 bed.',
    officeChatNoAgentsTitle: 'No agents in office yet.',
    officeChatNoAgentsDesc:
      'Create your first dashboard agent to chat live while watching them work at their Floor 1 desk.',
    officeKpiDesksBeds: 'Desks & Beds (1:1)',
    officeKpiWorkingIdle: 'Working / Idle',
    officeKpiSessions7d: 'Sessions (7d)',
    officeKpiTokensMonth: 'Tokens this month',
    officeHideChat: 'Hide Chat',
    officeLiveChat: 'Live Chat',
    officeShowControls: 'Show Office Controls',
    officeHideControls: 'Hide Office Controls',
    officeFloorAria: 'Floor view mode',
    officeFloorAll: '2 Floors',
    officeFloorAllShort: '2 Floors',
    officeFloor1: 'Floor 1 · Office',
    officeFloor1Short: 'F1 Office',
    officeFloor2: 'Floor 2 · Dormitory',
    officeFloor2Short: 'F2 Dorm',
    officeCamOverview: 'Overview',
    officeCamFocus: 'Focus',
    officeCamMeeting: 'Meeting',
    officeCamLounge: 'Lounge',
    officeCamDorm: 'F2 Dorm',
    officeChangePortraitTitle: 'Change agent portrait',
    officeChangePortraitAria: 'Change portrait for {name}',
    officeSetStatusAria: 'Set status for {name}',
    officeBtnChat: 'Chat',
    officeBtnBrief: 'Brief',
    officeDeleteAgentAria: 'Delete agent {name}',
    officeChatPanelAria: 'In-Office Live Chat',
    officeChatHeader: 'Live Office Chat · {count} Agents',
    officeChatOpenFull: 'Open full-screen Chat view',
    officeChatHideTitle: 'Hide in-office chat',
    officeChatClearTitle: 'Clear thread',
    officeChatClearAria: 'Clear chat thread with {name}',
    officeChatEmptyTitle: 'Chat directly with',
    officeChatEmptyDesc:
      'Send a message here — if relaxing or napping on Floor 2, {name} will walk straight to their Floor 1 desk to work on your request.',
    officeChatWorkingBubble: '💻 {name} is working at their desk & preparing a reply...',
    officeChatInputPlaceholder: 'Chat with {name}...',
    officeChatInputAria: 'Chat directly with {name}',
    officePortraitEyebrow: 'Agent Portrait · {profile}',
    officePortraitTitle: 'Update',
    officePortraitCloseAria: 'Close portrait dialog',
    officePortraitHint: 'Saved to ~/.hermes/ metadata when Live',
    officePortraitUploadBtn: 'Upload Custom Photo',
    officePortraitError: 'Could not process photo. Choose a JPG, PNG, or WebP image.',
    officeDeleteEyebrow: 'Delete Approval Required',
    officeDeleteTitle: 'Delete',
    officeDeleteCloseAria: 'Close delete confirmation dialog',
    officeDeleteDesc:
      'This will remove the agent profile in Hermes, their Floor 1 workstation desk, their Floor 2 dormitory bed, and local chat history from the dashboard. Confirm to prevent accidental deletion.',
    officeDeleteConfirmBtn: 'Yes, Delete Agent',

    // Add Agent Modal (3D Office Workstation Copy — Zero Building/Tower wording)
    addModalEyebrowLive: 'Live VPS Provisioning · ~/.hermes/profiles/',
    addModalEyebrowDemo: '3D Agent Office · Expand Your Team',
    addModalTitlePrefix: 'Add an',
    addModalTitleAccent: 'AI Agent.',
    addModalCloseAria: 'Close add agent modal',
    addModalTabPresets: 'Specialist Presets ({count})',
    addModalTabCustom: 'Custom Agent',
    addModalPresetHeading: 'Workstation & Identity Setup',
    addModalAgentNameLabel: 'Agent Name',
    addModalWorkstationLabel: 'Workstation / Desk Label',
    addModalWorkstationPlaceholder: 'e.g. Security Desk',
    addModalPortraitLabel: 'Agent Portrait (Preset or Upload Photo)',
    addModalUploadPhoto: 'Upload Photo',
    addModalProvisionInfo:
      'Adds 1 Floor 1 desk & 1 Floor 2 bed ({workstation}) with Hermes skills & {model}',
    addModalAddPresetBtn: 'Add to Office',
    addModalCustomNameLabel: 'Agent Name *',
    addModalCustomNamePlaceholder: 'e.g. Alpha, Scout, DevOps',
    addModalCustomWorkstationLabel: 'Workstation / Division Label',
    addModalCustomWorkstationPlaceholder: 'e.g. Alpha Desk, Backend Pod',
    addModalCustomRoleLabel: 'Role / Specialty *',
    addModalCustomRolePlaceholder: 'e.g. Full-Stack Systems Engineer',
    addModalCustomDeptLabel: 'Department / Team',
    addModalCustomDeptPlaceholder: 'e.g. Engineering, Security, Ops',
    addModalCustomModelLabel: 'Model Route (9Router)',
    addModalCustomStyleLabel: 'Workstation & Desk Accent',
    addModalCustomSoulLabel: 'SOUL.md Identity & Operating Instructions',
    addModalCustomSoulPlaceholder:
      'Describe how this agent behaves, what tools it owns, and what rules it follows...',
    addModalCustomErrorName: 'Please enter an agent name.',
    addModalCustomErrorRole: 'Please describe the agent role or specialty.',
    addModalCustomPhotoError: 'Could not read image file. Please select a JPG, PNG, or WebP photo.',
    addModalCustomFooterLive:
      'Creates ~/.hermes/profiles/ with shared Hermes skills & spawns 1:1 Floor 1 desk + Floor 2 bed (isolated from Telegram bots).',
    addModalCustomFooterDemo: 'Adds a 1:1 Floor 1 workstation & Floor 2 bed in your 3D Agent Office.',
    addModalCreateCustomBtn: 'Create Custom Agent',

    // Workstation style labels (replacing old building architecture names)
    styleExecutive: 'Executive Corner Desk',
    styleResearch: 'Research & Intel Pod',
    styleEngineering: 'Dual-Monitor Dev Station',
    styleSecurity: 'Security Ops Console',
    styleCreative: 'Editorial & Studio Desk',
    styleComms: 'Comms & Signal Desk',
    styleDesign: 'Design Studio Table',
    styleFinance: 'Analytics & Ledger Desk',
    styleMedia: 'Audio & Media Booth',
    styleStrategy: 'Strategy & Growth Pod',
    styleOps: 'Infrastructure Ops Desk',
    stylePlanning: 'Schedule & Planning Desk',

    // Ask GALAXY Modal
    askEyebrow: 'GALAXY / Direct Command',
    askTitlePrefix: 'Brief',
    askTitleAccent: 'GALAXY.',
    askCloseAria: 'Close Ask GALAXY dialog',
    askTabMission: 'Draft Mission Plan',
    askTabChat: 'Direct Chat',
    askSwitchVoice: 'Switch to Voice',
    askInputAria: 'Goal or message for GALAXY',
    askPlaceholderMission:
      'Describe the outcome you want. GALAXY will draft a step-by-step plan and wait for your approval before running...',
    askPlaceholderChat:
      'Send a direct message to your active dashboard agent...',
    askErrorEmpty: 'Enter a goal or directive first.',
    askNoAgentsNotice: 'Add at least one agent first before sending a direct chat.',
    askReportLength: 'Finished report length',
    askFootMission: 'Nothing runs without your approval on the plan.',
    askFootChat: 'Routed to {name} via Hermes runtime & 9Router (:20128).',
    askBtnMission: 'Draft Plan',
    askBtnChat: 'Send Message',

    // Voice Mode View
    voiceEyebrow: 'GALAXY / Voice Mode',
    voiceTitlePrefix: 'Intelligence,',
    voiceTitleAccent: 'within reach.',
    voiceSubtitle: 'A thought. A question. Your next move.',
    voiceAudioOn: 'Spoken Audio On',
    voiceAudioMuted: 'Audio Muted',
    voiceStatusReady: 'Ready — tap Talk or type a spoken prompt.',
    voiceStatusRouting: 'Routing through 9Router & VoiceStudio :3900 for {name}...',
    voiceStatusResponded: '{name} responded via {engine}.',
    voiceStatusLiveErr: 'Live voice error: {err}',
    voiceStatusMicStopped: 'Microphone stopped.',
    voiceStatusSrUnavailable:
      'Browser Speech Recognition unavailable here — use a quick voice prompt or the input bar below to hear spoken replies.',
    voiceStatusMicBlocked: 'Microphone permission blocked — use the text prompt bar below.',
    voiceStatusListening: 'Listening for {name}... speak clearly.',
    voiceStatusMicFailed: 'Could not start microphone — use the prompt bar below.',
    voiceStatusSwitched: 'Voice channel switched to {name} ({workstation}).',
    voiceInitGreeting:
      'Voice link established on VoiceStudio :3900. All checks on hermesagent are monitored. Ready for your next move.',
    voiceInitTime: 'Now',
    voiceEngineMic: 'Mic / Transcript',
    voiceEngineBridgeErr: 'Bridge Error',
    voiceLiveErrReply: 'Unable to reach live bridge ({err}).',
    voiceStopListening: 'Stop Listening',
    voiceTalkBtn: 'Talk',
    voiceSelectSpecialist: 'Select specialist on voice channel',
    voiceSpeechTitlePrefix: 'Speech',
    voiceSpeechTitleAccent: 'Engine.',
    voiceSpeechDesc:
      'Route spoken output through local VoiceStudio (:3900), Piper, Kokoro, or ElevenLabs.',
    voiceEngineVoicestudioMeta: 'Local Uvicorn · ~180ms',
    voiceEnginePiperMeta: 'Fast ARM64 CPU TTS',
    voiceEngineKokoroMeta: 'Expressive Local Neural',
    voiceEngineElevenlabsMeta: 'Cloud Studio Voice',
    voiceTranscriptPrefix: 'Live',
    voiceTranscriptAccent: 'Transcript.',
    voiceQuickPrompt1: 'Give me a fleet and VPS health status update.',
    voiceQuickPrompt2: 'Which missions are waiting for my approval?',
    voiceQuickPrompt3: 'Summarize your role and operating rules.',
    voiceInputAria: 'Speak or type prompt to {name}',
    voiceInputPlaceholder: 'Speak or type to {name}...',
    voiceSendAria: 'Send spoken prompt',
    voiceNoAgentsTitle: 'No voice agents yet.',
    voiceNoAgentsDesc:
      'Your 2 main Telegram bots stay isolated. Add a new agent to this dashboard to start voice sessions.',

    // Chat View
    chatEyebrow: 'GALAXY / Chat',
    chatTitlePrefix: 'Direct',
    chatTitleAccent: 'line.',
    chatAgentsCount: '{count} agents available · full history persisted',
    chatForgetThread: 'Forget Thread',
    chatEmptyTitle: 'Start a session with',
    chatNoAgentsTitle: 'No agents in this dashboard yet.',
    chatNoAgentsDesc:
      'Your 2 main Telegram agents are intentionally kept separate. Create a new agent here to start chatting with Hermes skills & tools.',
    chatRoutingNotice: 'Routing prompt via Hermes runtime & 9Router (:20128)...',
    chatInputAria: 'Message {name}',
    chatInputPlaceholder: 'Message {name} ({profile})...',

    // Missions View
    missionsEyebrow: 'GALAXY / Missions',
    missionsTitlePrefix: 'The mission',
    missionsTitleAccent: 'board.',
    missionsSubtitle: 'Every mission, from briefing to delivered. Nothing runs without your OK.',
    missionsFilterAll: 'All',
    missionsFilterApproval: 'Approval',
    missionsFilterActive: 'Active',
    missionsFilterReview: 'Review',
    missionsFilterDelivered: 'Delivered',
    missionsLaunchBtn: 'Launch Mission',
    missionsComposerPrefix: 'New Mission',
    missionsComposerAccent: 'Briefing.',
    missionsComposerDesc:
      'Draft a step-by-step plan for your dashboard crew and pause for your approval before running.',
    missionsComposerCloseAria: 'Close new mission composer',
    missionsFieldTitle: 'Mission Title',
    missionsFieldTitlePlaceholder: 'e.g. Audit VPS Security & SSL Renewal',
    missionsFieldLength: 'Finished Report Length',
    missionsLengthBriefShort: 'Brief (1p)',
    missionsFieldGoal: 'Objective & Constraints',
    missionsFieldGoalPlaceholder:
      'Explain what outcome you want, which servers/files matter, and any guardrails...',
    missionsFormError: 'Please provide both a mission title and an objective.',
    missionsSubmitBtn: 'Draft Mission Plan',
    missionsColApproval: 'Awaiting Approval',
    missionsColApprovalSub: 'Nothing runs without your OK',
    missionsColProgress: 'In Progress',
    missionsColProgressSub: 'Specialists actively executing',
    missionsColReview: 'Ready for Review',
    missionsColReviewSub: 'Awaiting final sign-off',
    missionsColDelivered: 'Delivered',
    missionsColDeliveredSub: 'Filed in Docs Library',
    missionsEmptyCol: 'No missions in {col}.',
    missionsCrewPrefix: 'Crew',
    missionsApproveBtn: 'Approve plan',
    missionsReviseBtn: 'Revise',
    missionsRevisePlaceholder: 'Adjustment note for the plan...',
    missionsCancelAria: 'Cancel mission {code}',
    missionsAdvanceBtn: 'Advance Active Step',
    missionsDeliverBtn: 'Accept & File Report to Docs',
    missionsReadDocBtn: 'Read Filed Deliverable',

    // Docs View
    docsEyebrow: 'GALAXY / Docs',
    docsTitlePrefix: 'The',
    docsTitleAccent: 'library.',
    docsSubtitle:
      'Everything your agents write, filed in one vault—ready to read, edit, or download.',
    docsNewBtn: 'New Document',
    docsFilterPlaceholder: 'Filter library...',
    docsFilterAria: 'Filter documents',
    docsAuthorAria: 'Filter by author agent',
    docsAllCrew: 'All crew',
    docsNoMatch: 'No documents match that filter.',
    docsCreatePrefix: 'Create',
    docsCreateAccent: 'Document.',
    docsTitlePlaceholder: 'Document title...',
    docsCategoryPlaceholder: 'Category',
    docsCategoryDefault: 'Briefing',
    docsContentPlaceholder: '# Markdown content...',
    docsFileToLibrary: 'File to Library',
    docsDownloadMd: 'Download .md',
    docsDeleteAria: 'Delete {title}',
    docsEmptyPane: 'Select a document or create a new one.',

    // Schedule View
    scheduleEyebrow: 'GALAXY / Schedule',
    scheduleTitlePrefix: 'Standing',
    scheduleTitleAccent: 'orders.',
    scheduleSubtitle: 'Recurring autonomous routines running quietly on ~/.hermes/cron.',
    scheduleNewBtn: 'New Standing Order',
    scheduleFormPrefix: 'Register',
    scheduleFormAccent: 'Cron Job.',
    scheduleFormCloseAria: 'Close schedule form',
    scheduleFieldTitlePlaceholder: 'Routine title',
    scheduleFieldCronPlaceholder: 'Cron e.g. */15 * * * *',
    scheduleFieldCadencePlaceholder: 'Human cadence label',
    scheduleFieldCadenceDefault: 'Daily at 08:00',
    scheduleFieldCommandPlaceholder: 'Command e.g. hermes probe --host 100.72.221.36',
    scheduleErrorEmpty: 'Enter both a schedule name and command.',
    scheduleSaveBtn: 'Save Standing Order',
    scheduleColOrder: 'Standing Order',
    scheduleColOwner: 'Owner',
    scheduleColCadence: 'Cadence',
    scheduleColNext: 'Next Run',
    scheduleColLast: 'Last Run',
    scheduleColControls: 'Controls',
    scheduleRunAria: 'Run {name} now',
    scheduleDeleteAria: 'Delete {name}',
    scheduleEmptyTitle: 'No scheduled routines yet.',
    scheduleEmptyDesc:
      'Click New Standing Order above whenever you want to add an automated cron job on ~/.hermes/cron.',

    // Health View
    healthEyebrowLive: 'GALAXY / System Health · Live Bridge',
    healthEyebrowDemo: 'GALAXY / System Health · Demo Snapshot',
    healthLiveHostPrefix: 'Live telemetry for primary host',
    healthCpuLoad: 'CPU Load',
    healthMemory: 'Memory',
    healthOfRam: 'of {total} GB RAM',
    healthNvmeDisk: 'NVMe Disk',
    healthVps2Cpu: 'VPS 2 CPU',
    healthMeshRtt: 'Mesh RTT',
    healthDirectPeer: 'Direct peer',
    healthRunDiagBtn: 'Run 21-Point Diagnostic',
    healthSystemdTitle: 'Live Systemd Services on hermesagent',
    healthSyncedAt: 'Synced {ts} UTC',
    healthRestarting: 'Restarting...',
    healthRestart: 'Restart',
    healthProbesPrefix: 'Service',
    healthProbesAccent: 'Probes.',
    healthCatAll: 'All',
    healthCatCore: 'Core',
    healthCatNetwork: 'Network',
    healthCatAgents: 'Agents',
    healthCatStorage: 'Storage',
    healthCommsTitlePrefix: 'What they said',
    healthCommsTitleAccent: 'to each other.',
    healthCommsSub: 'Audited inter-agent handoffs across Hermes channels',

    // Files View
    filesEyebrowLive: 'Manage / Files · Live hermesagent',
    filesEyebrowDemo: 'Manage / Files · Local Workspace',
    filesTitlePrefix: 'Their',
    filesTitleAccent: 'files.',
    filesSubtitle:
      'Inspect and edit SOUL.md, USER.md, OPERATING_RULES.md, and Hermes config files directly.',
    filesSyncing: 'Syncing...',
    filesSyncBtn: 'Sync from hermesagent',
    filesModified: 'modified',
    filesRevert: 'Revert',
    filesSaveBtn: 'Save File',
    filesSavedLive: 'Saved {path} on hermesagent',
    filesSavedLocal: 'Saved {path}',
    filesSyncedNotice: 'Synced ~/.hermes/ from hermesagent',
    filesEditAria: 'Edit {path}',

    // Terminal View
    terminalEyebrowLive: 'Manage / Terminal · Live SSH',
    terminalEyebrowDemo: 'Manage / Terminal · Local Simulator',
    terminalTitlePrefix: 'A real',
    terminalTitleAccent: 'shell.',
    terminalSubtitlePre: 'Direct console to',
    terminalSubtitlePost:
      'protected by a Human-in-the-Loop Gate for destructive operations.',
    terminalWelcomeLive:
      'GALAXY Live SSH Shell connected to ubuntu@hermesagent (100.72.221.36) via nexora-bridge. Dangerous commands pause at the server HITL Gate.',
    terminalWelcomeDemo:
      'GALAXY Shell attached to ubuntu@hermesagent (100.72.221.36 · Demo mode). Type "help" for available commands.',
    terminalGateBannerTitle: 'HITL Approval Required — Risky Shell Command Held',
    terminalGateServerReason: 'Held by server-side HITL Gate [{id}] on nexora-bridge.',
    terminalGateServerLog:
      '[HITL GATE {id}] Command requires explicit Operator approval before SSH execution.',
    terminalNoOutput: '(command completed with no output)',
    terminalBridgeError: 'Bridge error: {err}',
    terminalGateRejectedServer: '[GATE BLOCKED] Rejected "{cmd}" on server.',
    terminalGateApprovedServer: '[APPROVED] Executed "{cmd}".',
    terminalGateFailed: 'Approval resolution failed: {err}',
    terminalGateRejectedLocal: '[GATE BLOCKED] Operator rejected "{cmd}".',
    terminalBlockBtn: 'Block',
    terminalApproveExecBtn: 'Approve & Execute',
    terminalInputAria: 'Terminal command input',
    terminalInputPlaceholder: 'Type a command (e.g. hermes fleet, ss -tulnp, help)...',

    // Integrations View
    intEyebrow: 'Manage / Integrations',
    intTitlePrefix: 'Connected',
    intTitleAccent: 'channels & bridge.',
    intSubtitlePre: 'Connects directly to your',
    intSubtitleMid: '(:9120) on',
    intSubtitlePost: 'and SSH tunnel to',
    intBridgeCardPrefix: 'GALAXY',
    intBridgeCardAccent: 'Bridge Mode.',
    intStatusLabel: 'Status:',
    intStatusLive: 'Connected live to hermesagent via nexora-bridge (:9120)',
    intStatusConnecting: 'Connecting WebSocket telemetry stream...',
    intStatusErrorFallback: 'Bridge unreachable — verify Tailscale link and Bearer token',
    intStatusDemo: 'Demo mode active — switch to Live VPS Bridge when accessing over Tailscale',
    intModeDemo: 'Demo Simulation',
    intModeLive: 'Live VPS Bridge',
    intBridgeUrlLabel: 'Bridge Base URL (Leave blank for same-origin on VPS 2 :9120)',
    intSessionTokenLabel:
      'Session Token (Persisted securely via HttpOnly cookie across refreshes)',
    intTokenCookiePlaceholder:
      'Active via HttpOnly session cookie (paste new token only to rotate)',
    intTokenPastePlaceholder: 'Paste NEXORA_TOKEN from nexora-bridge.service',
    intSync1to1Pre: '1:1 sync with live',
    intSync1to1Post:
      'profiles in 3D Agent Office when connected (default — hide unprovisioned demo agents)',
    intVerifying: 'Verifying...',
    intTestSyncBtn: 'Test & Sync Bridge',
    intDeployEyebrow: 'VPS 2 Deployment · vm-23-58-ubuntu (Port 9120)',
    intDeployTitlePrefix: 'Replace legacy dashboard in',
    intDeployTitleAccent: 'one command.',
    intDeployDescPre: 'Preserves your existing',
    intDeployDescMid: 'and SSH key, and saves a timestamped backup automatically before upgrading port 9120.',
    intRepoLabel: 'Your Exported GitHub Repository URL',
    intRunOnVps2: 'Run on ubuntu@VM-23-58-ubuntu (VPS 2)',
    intCopied: 'Copied',
    intCopyCommand: 'Copy Command',
    intGalaxyUpdatePre: 'Installs permanent command',
    intGalaxyUpdateMid: 'on VPS 2 — for all future updates, push to GitHub and just run',

    // Guide View
    guideEyebrow: 'Manage / Guide',
    guideTitlePrefix: 'Operator',
    guideTitleAccent: 'manual.',
    guideSubtitle:
      'Permanent operating rules and workflow architecture for running your Hermes agent fleet.',
    guideCh1Title: 'Cockpit & Executive Decisions',
    guideCh1Summary:
      'Open Cockpit to see your entire team in a single frame—who is working, system health checks, and every plan waiting on your sign-off.',
    guideCh1Bullet1:
      'Pending mission plans appear immediately in the right rail with one-click Approve Plan controls.',
    guideCh1Bullet2:
      'Use Ask GALAXY in the lower-left corner from any screen to brief Executor directly.',
    guideCh1Action: 'Open Cockpit',
    guideCh2Title: '2-Floor 3D AI Agent Office — Add, Chat & Manage',
    guideCh2Summary:
      'Every active Hermes agent has a 1:1 Floor 1 workstation desk and a 1:1 Floor 2 dormitory bed. Idle agents roam the lounge, watch TV, grab coffee, play pool, or nap upstairs.',
    guideCh2Bullet1:
      'Click any agent to focus the camera, watch live thought bubbles, and chat side-by-side right inside the 3D office.',
    guideCh2Bullet2:
      'Click Add Agent to hire from 14 specialist presets or create a custom agent; delete non-core agents safely with confirmation.',
    guideCh2Action: 'Enter Agent Office',
    guideCh3Title: 'Missions & The Approval Contract',
    guideCh3Summary:
      'Give Executor a goal and choose the deliverable depth (Brief, Standard, or Deep Dive). Nothing executes until you explicitly approve the plan.',
    guideCh3Bullet1:
      'Executor automatically assigns specialists and outlines discrete execution steps.',
    guideCh3Bullet2:
      'Completed missions are accepted into the Docs Library as downloadable Markdown deliverables.',
    guideCh3Action: 'Open Missions',
    guideCh4Title: 'Voice Mode & Direct Chat',
    guideCh4Summary:
      'Speak out loud to any specialist via Web Speech API + local VoiceStudio (:3900), Piper, Kokoro, or ElevenLabs, or maintain persistent threads in Chat.',
    guideCh4Bullet1:
      'Switch speakers seamlessly using the portrait carousel at the base of Voice Mode.',
    guideCh4Bullet2:
      'All Chat threads persist locally and display the underlying model and tool calls used.',
    guideCh4Action: 'Launch Voice Mode',
    guideCh5Title: 'Machine Health, Files & Shell Gate',
    guideCh5Summary:
      'Monitor hermesagent (100.72.221.36) across 21 diagnostic checks, edit SOUL.md or config.yaml directly, and operate a guarded shell.',
    guideCh5Bullet1:
      'Destructive commands (rm -rf, systemctl stop/restart, iptables flush, reboot) automatically pause for HITL confirmation.',
    guideCh5Bullet2:
      'Configure your private Tailscale bridge endpoint anytime under Integrations.',
    guideCh5Action: 'Open Terminal',
    guideCh6Title: 'Replace Legacy Dashboard on VPS 2 (Port 9120)',
    guideCh6Summary:
      'Export this project to GitHub and run the included 1-command upgrade script on vm-23-58-ubuntu to replace the previous single-file dashboard in place.',
    guideCh6Bullet1:
      'Automatically preserves your existing NEXORA_TOKEN, SSH key, and nexora-tunnel.service (ports 20128, 3900, 9377).',
    guideCh6Bullet2:
      'Creates a timestamped backup folder (~/nexora-bridge.bak-*) before switching port 9120 to GALAXY.',
    guideCh6Bullet3:
      'Open your existing Tailscale link (http://100.85.109.20:9120/?token=...) — the token loads into memory and stays authenticated via cookie.',
    guideCh6Action: 'Copy Deploy Command',

    // Settings View
    settingsEyebrow: 'Manage / Settings',
    settingsTitlePrefix: 'Make it',
    settingsTitleAccent: 'yours.',
    settingsSubtitle:
      'Customize dashboard language, operator identity, palette theme, voice defaults, and lock protection.',
    settingsLangTitlePrefix: 'Language &',
    settingsLangTitleAccent: 'Locale.',
    settingsLangDesc:
      'Switches every label, menu, modal, status, and 3D Agent Office thought bubble across the entire dashboard.',
    settingsLangIdTitle: 'Indonesian',
    settingsLangIdDesc: '100% Indonesian interface across all panels and 3D office thoughts.',
    settingsLangEnTitle: 'English',
    settingsLangEnDesc: '100% English interface across all panels and 3D office thoughts.',
    settingsPaletteTitlePrefix: 'Palette &',
    settingsPaletteTitleAccent: 'Atmosphere.',
    settingsPaletteDesc:
      'Applies across the full dashboard and dynamically restyles the 2-Floor 3D AI Agent Office.',
    settingsThemeObsidianName: 'Obsidian Ember',
    settingsThemeObsidianDesc: 'Signature GALAXY dark obsidian with warm ember orange.',
    settingsThemeAlabasterName: 'Editorial Alabaster',
    settingsThemeAlabasterDesc:
      'Warm cream broadsheet canvas with crisp ink and ember highlights.',
    settingsThemePhosphorName: 'Tactical Phosphor',
    settingsThemePhosphorDesc:
      'High-contrast obsidian console with phosphor green & electric blue.',
    settingsIdentityPrefix: 'Operator',
    settingsIdentityAccent: 'Identity.',
    settingsOperatorName: 'Operator Name',
    settingsClockCity: 'Clock City Label',
    settingsTimezone: 'Timezone',
    settingsLockTitle: 'Dashboard Lock (Optional PIN Gate)',
    settingsLockDesc: 'Require a 4-digit PIN when opening GALAXY on shared devices.',
    settingsLockEnabled: 'Lock Enabled',
    settingsLockEnable: 'Enable Lock',
    settingsPinLabel: '4-Digit Access PIN',
    settingsResetTitle: 'Reset Dashboard Workspace',
    settingsResetDesc:
      'Clears local missions, schedules, added agents, and chats while keeping the Docs library.',
    settingsResetBtn: 'Reset Workspace',

    // App dynamic runtime notices
    appChatProcessing: 'Processing chat: "{preview}"',
    appChatFinished: 'Finished replying: "{preview}"',
    appLiveBridgeErr: 'Live bridge error: {err}',
    appStatusWorkingTask: 'Executing live priority dispatch from Operator',
    appStatusAlertTask: 'Flagged for manual inspection by Operator',
    appStatusIdleTask: 'Relaxing in the 3D Agent Office',
    appBridgeErrTokenMissing:
      'Enter your NEXORA_TOKEN in Integrations or open via ?token= link.',
    appBridgeErrWs:
      'Unable to reach nexora-bridge WebSocket — check Tailscale & port 9120.',
    appBridgeErr401:
      'Invalid NEXORA_TOKEN (401). Update your session token in Integrations.',
    appVerifyDemo:
      'Demo Simulation active — switch to Live VPS Bridge when accessing via Tailscale.',
    appVerifyUnreachable:
      'Could not reach /api/health at {url}. Ensure Tailscale is active and nexora-bridge is running on port 9120.',
    appVerifyNeedToken:
      'Bridge v{version} online ({host}), but Session Token is empty.',
    appVerifyConnected:
      'Live connected to {host} (Bridge v{version}) · CPU {cpu}%, RAM {ramUsed}/{ramTotal} GB.',
    appVerifyWaitingSsh: 'Bridge reachable, waiting on SSH link: {err}',
    appVerifyAuthErr: 'Auth/status error: {err}',
    appFileSavedNow: 'Saved just now',
  },

  id: {
    // Brand & Shell
    brandSubtitle: 'Sistem Operator',
    manageHeader: 'Kelola',
    askGalaxyBtn: 'Tanya GALAXY',
    searchPlaceholder: 'Cari agen, misi, dokumen, berkas...',
    searchAria: 'Cari agen, misi, dokumen, atau berkas',
    searchEmpty: 'Tidak ada agen, misi, atau dokumen yang cocok.',
    searchTypeAgent: 'AGEN',
    searchTypeMission: 'MISI',
    searchTypeDoc: 'DOKUMEN',
    searchTypeSchedule: 'JADWAL',
    searchTypeFile: 'BERKAS',
    operatorRole: 'Operator',
    openNavAria: 'Buka menu navigasi',
    closeNavAria: 'Tutup menu navigasi',
    dismissNavAria: 'Tutup latar belakang navigasi',
    openSettingsAria: 'Buka Pengaturan Operator',
    switchLangAria: 'Ubah bahasa dasbor',

    // Navigation
    navCockpit: 'Kokpit',
    navVoice: 'Mode Suara',
    navChat: 'Obrolan',
    navMissions: 'Misi',
    navDocs: 'Dokumen',
    navSchedule: 'Jadwal',
    navOffice: 'Kantor Agen',
    navHealth: 'Kesehatan',
    navFiles: 'Berkas',
    navTerminal: 'Terminal',
    navIntegrations: 'Integrasi',
    navGuide: 'Panduan',
    navSettings: 'Pengaturan',

    // Top Bridge Badge
    bridgeLive: 'JEMBATAN AKTIF',
    bridgeConnecting: 'MENGHUBUNGKAN',
    bridgeOffline: 'JEMBATAN LURING',
    bridgePreview: 'MODE PRATINJAU',
    bridgeDeployCta: 'Pasang ke VPS 2',
    bridgeConfigTitle: 'Atur Jembatan VPS Langsung atau Migrasi VPS 2',

    // Lock Screen
    lockEyebrow: 'Sistem Operator GALAXY',
    lockTitlePrefix: 'Dasbor',
    lockTitleAccent: 'Terkunci.',
    lockPlaceholder: 'Masukkan PIN akses',
    lockInvalidPin: 'PIN tidak valid. Silakan coba lagi.',
    lockUnlockBtn: 'Buka Pusat Kendali',

    // Common
    commonCancel: 'Batal',
    commonSave: 'Simpan',
    commonSend: 'Kirim',
    commonEdit: 'Ubah',
    commonClear: 'Bersihkan',
    commonRun: 'Jalankan',
    commonAll: 'Semua',
    commonActive: 'Aktif',
    commonPaused: 'Dijeda',
    commonEnabled: 'Aktif',
    commonEnable: 'Aktifkan',
    commonDisabled: 'Nonaktif',
    commonWords: 'kata',
    commonJustNow: 'Baru saja',
    commonNever: 'Belum pernah',
    commonScheduled: 'Terjadwal',
    commonAttachment: 'Lampiran',
    commonAttached: 'Terlampir',
    commonRemoveAttachment: 'Hapus lampiran',
    commonAttachFile: 'Lampirkan berkas',
    commonTools: 'Perangkat',
    commonUpdated: 'Diperbarui',
    commonProfile: 'Profil',
    commonStatusIdle: 'Santai',
    commonStatusWorking: 'Bekerja',
    commonStatusAlert: 'Peringatan',
    commonPass: 'LULUS',
    commonWarn: 'PERINGATAN',
    commonFail: 'GAGAL',
    commonConnected: 'Terhubung',
    commonStandby: 'Siaga',
    commonSimulated: 'Simulasi',
    commonMsgShort: 'pesan',
    commonFloorShort: 'L',
    commonBrief: 'Ringkas',
    commonStandard: 'Standar',
    commonDeepDive: 'Mendalam',

    // Health Dial
    healthOverall: 'Keseluruhan',
    healthOptimal: 'Optimal',
    healthDegraded: 'Menurun',
    healthCritical: 'Kritis',
    healthOfPass: '{passed} dari {total} lulus',
    healthAria: 'Kesehatan sistem {label}, {passed} dari {total} pemeriksaan lulus',

    // Cockpit View
    cockpitVoiceEyebrow: 'GALAXY / Mode Suara',
    cockpitVoiceTitle: 'Kecerdasan,',
    cockpitVoiceAccent: 'dalam genggaman.',
    cockpitVoiceDesc: 'Satu ide. Satu pertanyaan. Langkah Anda berikutnya.',
    cockpitTalkBtn: 'Bicara',
    cockpitAddShort: 'Tambah',
    cockpitAddAria: 'Tambah agen Hermes baru',
    cockpitChatWithAria: 'Obrolan dengan {name}',
    cockpitOfficeEyebrow: 'GALAXY / Kantor Agen · 2 Lantai',
    cockpitCrewTitle: 'Tim Anda sedang',
    cockpitCrewWorking: 'bekerja.',
    cockpitCrewRelaxing: 'bersantai.',
    cockpitCrewReady: 'siap.',
    cockpitAddAgentBtn: 'Tambah Agen',
    cockpitOpenOfficeBtn: 'Buka Kantor Penuh',
    cockpitKpiWorking: 'Bekerja saat ini',
    cockpitKpiAlertReview: '{count} peringatan perlu ditinjau',
    cockpitKpiDesksBeds: '{count} meja & kasur (1:1)',
    cockpitKpiSessions: 'Sesi (7 hari)',
    cockpitKpiAcrossProfiles: 'Dari {count} profil Hermes',
    cockpitKpiAvgReply: 'Rata-rata balas',
    cockpitKpiViaRouter: 'Lewat 9Router :20128',
    cockpitKpiTokens: 'Token bulan ini',
    cockpitKpiCrewTime: 'Tim aktif dasbor ini',
    cockpitHealthTitle: 'Kesehatan Sistem',
    cockpitInspectBtn: 'Periksa',
    cockpitMachinePrefix: 'Kondisi mesin',
    cockpitMachineWell: 'tenang dan sehat.',
    cockpitMachineWarn: 'memunculkan peringatan.',
    cockpitMissionsEyebrow: 'GALAXY / Misi',
    cockpitDecisionsNone: 'Semua keputusan',
    cockpitDecisionsCount: '{count} keputusan',
    cockpitDecisionsCountPlural: '{count} keputusan',
    cockpitDecisionsSettled: 'selesai.',
    cockpitDecisionsNeedYou: 'menunggu Anda.',
    cockpitDecisionsSub: '{approvals} rencana menunggu persetujuan · {reviews} hasil siap ditinjau',
    cockpitApproveTag: 'Setujui · {code}',
    cockpitApproveTitle: 'Setujui rencana untuk {title}',
    cockpitApproveBtn: 'Setujui rencana',
    cockpitReviewBriefBtn: 'Tinjau ringkasan',
    cockpitNoBlockedTitle: 'Tidak ada rencana tertahan',
    cockpitNoBlockedDesc: 'Mulai misi baru kapan saja agar tim agen Anda menyusun dan menjalankan rencana.',
    cockpitNewMissionBtn: 'Misi Baru',
    cockpitViewAllMissions: 'Lihat Semua {count} Misi',
    cockpitRosterTitle: 'Daftar Armada',
    cockpitRosterAccent: 'sekilas.',
    cockpitRosterSub: '{count} spesialis aktif · klik unit mana pun untuk mengirim pesan',
    cockpitRosterEmptyTitle: 'Belum ada agen di dasbor ini',
    cockpitRosterEmptyDesc:
      '2 agen Telegram utama Anda tetap terpisah total. Buat agen baru di sini khusus untuk dasbor ini.',
    cockpitManageOfficeBtn: 'Kelola di Kantor',
    cockpitColSpecialist: 'Spesialis',
    cockpitColWorkstation: 'Meja Kerja',
    cockpitColStatus: 'Status',
    cockpitColSessions: 'Sesi',
    cockpitColAction: 'Aksi',
    cockpitMessageBtn: 'Pesan',
    cockpitBusTitle: 'Percakapan antar',
    cockpitBusAccent: 'sesama agen.',
    cockpitBusSub: 'Alur koordinasi langsung antar-agen',
    cockpitBusEmpty:
      'Belum ada catatan antar-agen. Aktivitas akan muncul setelah agen baru Anda mulai berkolaborasi.',
    cockpitFullLogBtn: 'Catatan Lengkap',

    // Agent Office View (3D)
    officeEyebrow: 'GALAXY / Kantor 3D Agen AI · 2 Lantai',
    officeTitle: 'Kantor Anda sedang',
    officeTitleAlive: 'hidup.',
    officeTitleRelaxing: 'santai.',
    officeTitleEmpty: 'siap.',
    officeEmptyTitle: 'Kantor 3D Agen AI masih kosong & siap digunakan.',
    officeEmptyDesc:
      '2 agen Telegram utama Anda tetap terpisah. Tambah agen baru untuk menghadirkan 1 meja Lantai 1 dan 1 kasur Lantai 2.',
    officeChatNoAgentsTitle: 'Belum ada agen di kantor.',
    officeChatNoAgentsDesc:
      'Buat agen pertama Anda di dasbor ini untuk mulai mengobrol langsung sambil melihat mereka bekerja di Lantai 1.',
    officeKpiDesksBeds: 'Meja & Kasur (1:1)',
    officeKpiWorkingIdle: 'Bekerja / Santai',
    officeKpiSessions7d: 'Sesi (7h)',
    officeKpiTokensMonth: 'Token bulan ini',
    officeHideChat: 'Tutup Obrolan',
    officeLiveChat: 'Obrolan Langsung',
    officeShowControls: 'Tampilkan Kontrol Kantor',
    officeHideControls: 'Sembunyikan Kontrol Kantor',
    officeFloorAria: 'Mode tampilan lantai',
    officeFloorAll: '2 Lantai',
    officeFloorAllShort: '2 Lantai',
    officeFloor1: 'Lantai 1 · Kantor',
    officeFloor1Short: 'L1 Kantor',
    officeFloor2: 'Lantai 2 · Kamar Tidur',
    officeFloor2Short: 'L2 Kamar',
    officeCamOverview: 'Ringkasan',
    officeCamFocus: 'Fokus',
    officeCamMeeting: 'Ruang Rapat',
    officeCamLounge: 'Ruang Tamu',
    officeCamDorm: 'Kamar L2',
    officeChangePortraitTitle: 'Ubah potret agen',
    officeChangePortraitAria: 'Ubah potret untuk {name}',
    officeSetStatusAria: 'Atur status untuk {name}',
    officeBtnChat: 'Obrolan',
    officeBtnBrief: 'Arahan',
    officeDeleteAgentAria: 'Hapus agen {name}',
    officeChatPanelAria: 'Obrolan Langsung di Kantor',
    officeChatHeader: 'Obrolan Kantor Langsung · {count} Agen',
    officeChatOpenFull: 'Buka halaman Obrolan layar penuh',
    officeChatHideTitle: 'Sembunyikan panel obrolan',
    officeChatClearTitle: 'Hapus riwayat obrolan',
    officeChatClearAria: 'Hapus riwayat obrolan dengan {name}',
    officeChatEmptyTitle: 'Obrolan langsung dengan',
    officeChatEmptyDesc:
      'Kirim pesan di sini — jika sedang santai atau tidur di Lantai 2, {name} akan langsung menuju meja kerjanya di Lantai 1 untuk mengerjakan tugas Anda.',
    officeChatWorkingBubble: '💻 {name} sedang bekerja di meja & menyiapkan balasan...',
    officeChatInputPlaceholder: 'Kirim pesan ke {name}...',
    officeChatInputAria: 'Kirim pesan langsung ke {name}',
    officePortraitEyebrow: 'Potret Agen · {profile}',
    officePortraitTitle: 'Perbarui',
    officePortraitCloseAria: 'Tutup dialog potret',
    officePortraitHint: 'Disimpan ke metadata ~/.hermes/ saat Jembatan Aktif',
    officePortraitUploadBtn: 'Unggah Foto Kustom',
    officePortraitError: 'Gagal memproses foto. Pilih gambar JPG, PNG, atau WebP.',
    officeDeleteEyebrow: 'Persetujuan Penghapusan',
    officeDeleteTitle: 'Hapus',
    officeDeleteCloseAria: 'Tutup dialog konfirmasi hapus',
    officeDeleteDesc:
      'Tindakan ini akan menghapus profil agen di Hermes, meja kerjanya di Lantai 1, kasurnya di Lantai 2, serta riwayat obrolan lokalnya dari dasbor. Pastikan Anda tidak salah tekan.',
    officeDeleteConfirmBtn: 'Ya, Hapus Agen',

    // Add Agent Modal (100% 3D Office Workstation Copy)
    addModalEyebrowLive: 'Penyediaan VPS Langsung · ~/.hermes/profiles/',
    addModalEyebrowDemo: 'Kantor 3D Agen AI · Tambah Anggota Tim',
    addModalTitlePrefix: 'Tambah',
    addModalTitleAccent: 'Agen AI.',
    addModalCloseAria: 'Tutup jendela tambah agen',
    addModalTabPresets: 'Templat Spesialis ({count})',
    addModalTabCustom: 'Agen Kustom',
    addModalPresetHeading: 'Pengaturan Meja Kerja & Identitas',
    addModalAgentNameLabel: 'Nama Agen',
    addModalWorkstationLabel: 'Nama Meja / Divisi Kerja',
    addModalWorkstationPlaceholder: 'mis. Meja Keamanan',
    addModalPortraitLabel: 'Potret Agen (Pilih Templat atau Unggah Foto)',
    addModalUploadPhoto: 'Unggah Foto',
    addModalProvisionInfo:
      'Menambahkan 1 meja Lantai 1 & 1 kasur Lantai 2 ({workstation}) dengan skill Hermes & {model}',
    addModalAddPresetBtn: 'Tambahkan ke Kantor',
    addModalCustomNameLabel: 'Nama Agen *',
    addModalCustomNamePlaceholder: 'mis. Alpha, Peneliti, DevOps',
    addModalCustomWorkstationLabel: 'Nama Meja / Divisi Kerja',
    addModalCustomWorkstationPlaceholder: 'mis. Meja Alpha, Divisi Backend',
    addModalCustomRoleLabel: 'Peran / Keahlian *',
    addModalCustomRolePlaceholder: 'mis. Insinyur Sistem & Kode',
    addModalCustomDeptLabel: 'Departemen / Tim',
    addModalCustomDeptPlaceholder: 'mis. Rekayasa, Keamanan, Operasi',
    addModalCustomModelLabel: 'Rute Model (9Router)',
    addModalCustomStyleLabel: 'Gaya Meja & Zona Kantor',
    addModalCustomSoulLabel: 'Identitas SOUL.md & Instruksi Kerja',
    addModalCustomSoulPlaceholder:
      'Jelaskan cara kerja agen ini, perangkat yang dikuasai, dan aturan operasional yang wajib dipatuhi...',
    addModalCustomErrorName: 'Silakan masukkan nama agen terlebih dahulu.',
    addModalCustomErrorRole: 'Silakan jelaskan peran atau keahlian agen.',
    addModalCustomPhotoError: 'Gagal membaca berkas gambar. Pilih foto berformat JPG, PNG, atau WebP.',
    addModalCustomFooterLive:
      'Membuat ~/.hermes/profiles/ dengan skill Hermes bersama & menambah 1 meja Lantai 1 + 1 kasur Lantai 2 (terpisah dari bot Telegram).',
    addModalCustomFooterDemo:
      'Menambahkan 1 meja kerja Lantai 1 & 1 kasur Lantai 2 di Kantor 3D Agen AI Anda.',
    addModalCreateCustomBtn: 'Buat Agen Kustom',

    // Workstation style labels
    styleExecutive: 'Meja Sudut Eksekutif',
    styleResearch: 'Meja Riset & Intelijen',
    styleEngineering: 'Stasiun Pengembang Monitor Ganda',
    styleSecurity: 'Konsol Operasi Keamanan',
    styleCreative: 'Meja Editorial & Konten',
    styleComms: 'Meja Komunikasi & Sinyal',
    styleDesign: 'Meja Studio Desain',
    styleFinance: 'Meja Analitik & Keuangan',
    styleMedia: 'Ruang Audio & Media',
    styleStrategy: 'Meja Strategi & Pertumbuhan',
    styleOps: 'Meja Operasi Infrastruktur',
    stylePlanning: 'Meja Jadwal & Perencanaan',

    // Ask GALAXY Modal
    askEyebrow: 'GALAXY / Perintah Langsung',
    askTitlePrefix: 'Beri Arahan ke',
    askTitleAccent: 'GALAXY.',
    askCloseAria: 'Tutup jendela Tanya GALAXY',
    askTabMission: 'Susun Rencana Misi',
    askTabChat: 'Obrolan Langsung',
    askSwitchVoice: 'Pindah ke Suara',
    askInputAria: 'Tujuan atau pesan untuk GALAXY',
    askPlaceholderMission:
      'Jelaskan hasil yang Anda inginkan. GALAXY akan menyusun langkah kerja dan menunggu persetujuan Anda sebelum berjalan...',
    askPlaceholderChat:
      'Kirim pesan langsung ke agen aktif di dasbor Anda...',
    askErrorEmpty: 'Masukkan tujuan atau instruksi terlebih dahulu.',
    askNoAgentsNotice: 'Tambahkan minimal satu agen terlebih dahulu sebelum mengirim obrolan langsung.',
    askReportLength: 'Kedalaman laporan akhir',
    askFootMission: 'Tidak ada tugas yang berjalan tanpa persetujuan rencana dari Anda.',
    askFootChat: 'Diteruskan ke {name} melalui runtime Hermes & 9Router (:20128).',
    askBtnMission: 'Susun Rencana',
    askBtnChat: 'Kirim Pesan',

    // Voice Mode View
    voiceEyebrow: 'GALAXY / Mode Suara',
    voiceTitlePrefix: 'Kecerdasan,',
    voiceTitleAccent: 'dalam genggaman.',
    voiceSubtitle: 'Satu ide. Satu pertanyaan. Langkah Anda berikutnya.',
    voiceAudioOn: 'Suara Aktif',
    voiceAudioMuted: 'Suara Dibisukan',
    voiceStatusReady: 'Siap — ketuk Bicara atau ketik perintah suara.',
    voiceStatusRouting: 'Meneruskan lewat 9Router & VoiceStudio :3900 untuk {name}...',
    voiceStatusResponded: '{name} merespons melalui {engine}.',
    voiceStatusLiveErr: 'Galat suara langsung: {err}',
    voiceStatusMicStopped: 'Mikrofon dihentikan.',
    voiceStatusSrUnavailable:
      'Pengenalan Suara peramban tidak tersedia di sini — gunakan perintah cepat atau kolom ketik di bawah untuk mendengar balasan suara.',
    voiceStatusMicBlocked: 'Izin mikrofon diblokir — gunakan kolom ketik di bawah.',
    voiceStatusListening: 'Mendengarkan untuk {name}... bicaralah dengan jelas.',
    voiceStatusMicFailed: 'Tidak dapat memulai mikrofon — gunakan kolom ketik di bawah.',
    voiceStatusSwitched: 'Saluran suara dialihkan ke {name} ({workstation}).',
    voiceInitGreeting:
      'Tautan suara terhubung melalui VoiceStudio :3900. Seluruh pemeriksaan pada hermesagent terpantau aman. Siap menerima arahan Anda.',
    voiceInitTime: 'Sekarang',
    voiceEngineMic: 'Mikrofon / Transkrip',
    voiceEngineBridgeErr: 'Galat Jembatan',
    voiceLiveErrReply: 'Tidak dapat menjangkau jembatan langsung ({err}).',
    voiceStopListening: 'Berhenti Mendengar',
    voiceTalkBtn: 'Bicara',
    voiceSelectSpecialist: 'Pilih spesialis pada saluran suara',
    voiceSpeechTitlePrefix: 'Mesin',
    voiceSpeechTitleAccent: 'Suara.',
    voiceSpeechDesc:
      'Arahkan keluaran suara lewat VoiceStudio lokal (:3900), Piper, Kokoro, atau ElevenLabs.',
    voiceEngineVoicestudioMeta: 'Uvicorn Lokal · ~180md',
    voiceEnginePiperMeta: 'TTS CPU ARM64 Cepat',
    voiceEngineKokoroMeta: 'Suara Neural Lokal Ekspresif',
    voiceEngineElevenlabsMeta: 'Suara Studio Awan',
    voiceTranscriptPrefix: 'Transkrip',
    voiceTranscriptAccent: 'Langsung.',
    voiceQuickPrompt1: 'Berikan laporan status armada dan kesehatan VPS saat ini.',
    voiceQuickPrompt2: 'Misi mana saja yang sedang menunggu persetujuan saya?',
    voiceQuickPrompt3: 'Ringkas peran dan aturan operasi kamu.',
    voiceInputAria: 'Ucapkan atau ketik perintah untuk {name}',
    voiceInputPlaceholder: 'Ucapkan atau ketik ke {name}...',
    voiceSendAria: 'Kirim perintah suara',
    voiceNoAgentsTitle: 'Belum ada agen suara.',
    voiceNoAgentsDesc:
      '2 agen Telegram utama Anda tetap terpisah. Tambahkan agen baru ke dasbor ini untuk memulai sesi suara.',

    // Chat View
    chatEyebrow: 'GALAXY / Obrolan',
    chatTitlePrefix: 'Jalur',
    chatTitleAccent: 'langsung.',
    chatAgentsCount: '{count} agen tersedia · riwayat lengkap tersimpan',
    chatForgetThread: 'Hapus Riwayat',
    chatEmptyTitle: 'Mulai sesi obrolan dengan',
    chatNoAgentsTitle: 'Belum ada agen di dasbor ini.',
    chatNoAgentsDesc:
      '2 agen Telegram utama sengaja dipisahkan. Buat agen baru di sini untuk mulai mengobrol dengan skill & perangkat Hermes.',
    chatRoutingNotice: 'Meneruskan pesan lewat runtime Hermes & 9Router (:20128)...',
    chatInputAria: 'Kirim pesan ke {name}',
    chatInputPlaceholder: 'Kirim pesan ke {name} ({profile})...',

    // Missions View
    missionsEyebrow: 'GALAXY / Misi',
    missionsTitlePrefix: 'Papan',
    missionsTitleAccent: 'misi.',
    missionsSubtitle:
      'Setiap misi dari pengarahan hingga selesai. Tidak ada yang berjalan tanpa persetujuan Anda.',
    missionsFilterAll: 'Semua',
    missionsFilterApproval: 'Persetujuan',
    missionsFilterActive: 'Aktif',
    missionsFilterReview: 'Tinjauan',
    missionsFilterDelivered: 'Selesai',
    missionsLaunchBtn: 'Buat Misi',
    missionsComposerPrefix: 'Pengarahan Misi',
    missionsComposerAccent: 'Baru.',
    missionsComposerDesc:
      'Susun rencana langkah kerja untuk tim agen dasbor Anda dan jeda hingga Anda menyetujuinya.',
    missionsComposerCloseAria: 'Tutup formulir misi baru',
    missionsFieldTitle: 'Judul Misi',
    missionsFieldTitlePlaceholder: 'mis. Audit Keamanan VPS & Pembaruan SSL',
    missionsFieldLength: 'Kedalaman Laporan Akhir',
    missionsLengthBriefShort: 'Ringkas (1 hal)',
    missionsFieldGoal: 'Tujuan & Batasan',
    missionsFieldGoalPlaceholder:
      'Jelaskan hasil yang diharapkan, server atau berkas terkait, serta batasan keamanannya...',
    missionsFormError: 'Mohon isi judul misi dan tujuannya terlebih dahulu.',
    missionsSubmitBtn: 'Susun Rencana Misi',
    missionsColApproval: 'Menunggu Persetujuan',
    missionsColApprovalSub: 'Tidak berjalan tanpa izin Anda',
    missionsColProgress: 'Sedang Berjalan',
    missionsColProgressSub: 'Spesialis sedang mengeksekusi',
    missionsColReview: 'Siap Ditinjau',
    missionsColReviewSub: 'Menunggu konfirmasi akhir',
    missionsColDelivered: 'Selesai',
    missionsColDeliveredSub: 'Tersimpan di Pustaka Dokumen',
    missionsEmptyCol: 'Belum ada misi di kolom {col}.',
    missionsCrewPrefix: 'Tim',
    missionsApproveBtn: 'Setujui rencana',
    missionsReviseBtn: 'Revisi',
    missionsRevisePlaceholder: 'Catatan penyesuaian untuk rencana...',
    missionsCancelAria: 'Batalkan misi {code}',
    missionsAdvanceBtn: 'Lanjutkan Langkah Aktif',
    missionsDeliverBtn: 'Terima & Simpan ke Dokumen',
    missionsReadDocBtn: 'Baca Laporan Tersimpan',

    // Docs View
    docsEyebrow: 'GALAXY / Dokumen',
    docsTitlePrefix: 'Pustaka',
    docsTitleAccent: 'dokumen.',
    docsSubtitle:
      'Seluruh laporan yang ditulis agen tersimpan rapi—siap dibaca, diubah, atau diunduh.',
    docsNewBtn: 'Dokumen Baru',
    docsFilterPlaceholder: 'Saring pustaka...',
    docsFilterAria: 'Saring dokumen',
    docsAuthorAria: 'Saring berdasarkan agen penulis',
    docsAllCrew: 'Semua tim',
    docsNoMatch: 'Tidak ada dokumen yang sesuai pencarian.',
    docsCreatePrefix: 'Buat',
    docsCreateAccent: 'Dokumen.',
    docsTitlePlaceholder: 'Judul dokumen...',
    docsCategoryPlaceholder: 'Kategori',
    docsCategoryDefault: 'Ringkasan',
    docsContentPlaceholder: '# Isi dokumen Markdown...',
    docsFileToLibrary: 'Simpan ke Pustaka',
    docsDownloadMd: 'Unduh .md',
    docsDeleteAria: 'Hapus {title}',
    docsEmptyPane: 'Pilih dokumen atau buat dokumen baru.',

    // Schedule View
    scheduleEyebrow: 'GALAXY / Jadwal',
    scheduleTitlePrefix: 'Tugas',
    scheduleTitleAccent: 'berkala.',
    scheduleSubtitle: 'Rutinitas otonom berkala yang berjalan tenang di ~/.hermes/cron.',
    scheduleNewBtn: 'Tugas Berkala Baru',
    scheduleFormPrefix: 'Daftarkan',
    scheduleFormAccent: 'Jadwal Cron.',
    scheduleFormCloseAria: 'Tutup formulir jadwal',
    scheduleFieldTitlePlaceholder: 'Nama rutinitas',
    scheduleFieldCronPlaceholder: 'Ekspresi cron mis. */15 * * * *',
    scheduleFieldCadencePlaceholder: 'Label frekuensi jadwal',
    scheduleFieldCadenceDefault: 'Setiap hari pukul 08:00',
    scheduleFieldCommandPlaceholder: 'Perintah mis. hermes probe --host 100.72.221.36',
    scheduleErrorEmpty: 'Masukkan nama jadwal dan perintahnya.',
    scheduleSaveBtn: 'Simpan Jadwal',
    scheduleColOrder: 'Tugas Berkala',
    scheduleColOwner: 'Penanggung Jawab',
    scheduleColCadence: 'Frekuensi',
    scheduleColNext: 'Eksekusi Berikutnya',
    scheduleColLast: 'Eksekusi Terakhir',
    scheduleColControls: 'Kontrol',
    scheduleRunAria: 'Jalankan {name} sekarang',
    scheduleDeleteAria: 'Hapus {name}',
    scheduleEmptyTitle: 'Belum ada jadwal rutin.',
    scheduleEmptyDesc:
      'Klik Tugas Berkala Baru di atas kapan saja untuk menambahkan jadwal cron otomatis di ~/.hermes/cron.',

    // Health View
    healthEyebrowLive: 'GALAXY / Kesehatan Sistem · Jembatan Aktif',
    healthEyebrowDemo: 'GALAXY / Kesehatan Sistem · Pratinjau Demo',
    healthLiveHostPrefix: 'Telemetri langsung untuk host utama',
    healthCpuLoad: 'Beban CPU',
    healthMemory: 'Memori',
    healthOfRam: 'dari {total} GB RAM',
    healthNvmeDisk: 'Disk NVMe',
    healthVps2Cpu: 'CPU VPS 2',
    healthMeshRtt: 'Latensi Jaringan',
    healthDirectPeer: 'Koneksi langsung',
    healthRunDiagBtn: 'Jalankan Diagnostik 21 Titik',
    healthSystemdTitle: 'Layanan Systemd Langsung di hermesagent',
    healthSyncedAt: 'Disinkronkan {ts} UTC',
    healthRestarting: 'Memulai ulang...',
    healthRestart: 'Mulai Ulang',
    healthProbesPrefix: 'Pemeriksaan',
    healthProbesAccent: 'Layanan.',
    healthCatAll: 'Semua',
    healthCatCore: 'Inti',
    healthCatNetwork: 'Jaringan',
    healthCatAgents: 'Agen',
    healthCatStorage: 'Penyimpanan',
    healthCommsTitlePrefix: 'Percakapan antar',
    healthCommsTitleAccent: 'sesama agen.',
    healthCommsSub: 'Catatan serah terima antar-agen di seluruh saluran Hermes',

    // Files View
    filesEyebrowLive: 'Kelola / Berkas · hermesagent Langsung',
    filesEyebrowDemo: 'Kelola / Berkas · Ruang Kerja Lokal',
    filesTitlePrefix: 'Berkas',
    filesTitleAccent: 'mereka.',
    filesSubtitle:
      'Periksa dan sunting SOUL.md, USER.md, OPERATING_RULES.md, serta berkas konfigurasi Hermes secara langsung.',
    filesSyncing: 'Menyinkronkan...',
    filesSyncBtn: 'Sinkronkan dari hermesagent',
    filesModified: 'diubah',
    filesRevert: 'Batalkan',
    filesSaveBtn: 'Simpan Berkas',
    filesSavedLive: 'Berhasil menyimpan {path} di hermesagent',
    filesSavedLocal: 'Berhasil menyimpan {path}',
    filesSyncedNotice: 'Berhasil menyinkronkan ~/.hermes/ dari hermesagent',
    filesEditAria: 'Sunting {path}',

    // Terminal View
    terminalEyebrowLive: 'Kelola / Terminal · SSH Langsung',
    terminalEyebrowDemo: 'Kelola / Terminal · Simulator Lokal',
    terminalTitlePrefix: 'Konsol',
    terminalTitleAccent: 'langsung.',
    terminalSubtitlePre: 'Konsol langsung menuju',
    terminalSubtitlePost:
      'yang dilindungi Gerbang Persetujuan Manusia untuk perintah berisiko.',
    terminalWelcomeLive:
      'Terminal SSH Langsung GALAXY terhubung ke ubuntu@hermesagent (100.72.221.36) melalui nexora-bridge. Perintah berbahaya akan tertahan di Gerbang Persetujuan server.',
    terminalWelcomeDemo:
      'Terminal GALAXY terhubung ke ubuntu@hermesagent (100.72.221.36 · Mode Demo). Ketik "help" untuk melihat daftar perintah.',
    terminalGateBannerTitle: 'Persetujuan Diperlukan — Perintah Terminal Berisiko Ditahan',
    terminalGateServerReason: 'Ditahan oleh Gerbang Persetujuan server [{id}] pada nexora-bridge.',
    terminalGateServerLog:
      '[GERBANG {id}] Perintah memerlukan persetujuan eksplisit Operator sebelum dieksekusi lewat SSH.',
    terminalNoOutput: '(perintah selesai tanpa keluaran teks)',
    terminalBridgeError: 'Galat jembatan: {err}',
    terminalGateRejectedServer: '[DITOLAK] Perintah "{cmd}" dibatalkan di server.',
    terminalGateApprovedServer: '[DISETUJUI] Berhasil mengeksekusi "{cmd}".',
    terminalGateFailed: 'Gagal memproses persetujuan: {err}',
    terminalGateRejectedLocal: '[DITOLAK] Operator menolak perintah "{cmd}".',
    terminalBlockBtn: 'Blokir',
    terminalApproveExecBtn: 'Setujui & Jalankan',
    terminalInputAria: 'Kolom perintah terminal',
    terminalInputPlaceholder: 'Ketik perintah (mis. hermes fleet, ss -tulnp, help)...',

    // Integrations View
    intEyebrow: 'Kelola / Integrasi',
    intTitlePrefix: 'Saluran &',
    intTitleAccent: 'jembatan terhubung.',
    intSubtitlePre: 'Terhubung langsung ke',
    intSubtitleMid: '(:9120) di',
    intSubtitlePost: 'serta terowongan SSH menuju',
    intBridgeCardPrefix: 'Mode Jembatan',
    intBridgeCardAccent: 'GALAXY.',
    intStatusLabel: 'Status:',
    intStatusLive: 'Terhubung langsung ke hermesagent lewat nexora-bridge (:9120)',
    intStatusConnecting: 'Menghubungkan aliran telemetri WebSocket...',
    intStatusErrorFallback: 'Jembatan tidak terjangkau — periksa koneksi Tailscale & token sesi',
    intStatusDemo: 'Mode simulasi aktif — beralih ke Jembatan VPS Langsung saat mengakses lewat Tailscale',
    intModeDemo: 'Simulasi Demo',
    intModeLive: 'Jembatan VPS Langsung',
    intBridgeUrlLabel: 'URL Dasar Jembatan (Kosongkan jika sama-asal di VPS 2 :9120)',
    intSessionTokenLabel:
      'Token Sesi (Disimpan aman lewat kuki HttpOnly agar tetap terhubung saat muat ulang)',
    intTokenCookiePlaceholder:
      'Aktif lewat kuki sesi HttpOnly (tempel token baru hanya jika ingin mengganti)',
    intTokenPastePlaceholder: 'Tempel NEXORA_TOKEN dari nexora-bridge.service',
    intSync1to1Pre: 'Sinkronisasi 1:1 dengan profil',
    intSync1to1Post:
      'asli di Kantor 3D Agen AI saat terhubung (bawaan — sembunyikan agen demo)',
    intVerifying: 'Memeriksa...',
    intTestSyncBtn: 'Uji & Sinkronkan Jembatan',
    intDeployEyebrow: 'Pemasangan VPS 2 · vm-23-58-ubuntu (Port 9120)',
    intDeployTitlePrefix: 'Perbarui dasbor lama dalam',
    intDeployTitleAccent: 'satu perintah.',
    intDeployDescPre: 'Mempertahankan',
    intDeployDescMid:
      'dan kunci SSH yang ada, serta otomatis membuat cadangan bertanggal sebelum memperbarui port 9120.',
    intRepoLabel: 'URL Repositori GitHub Proyek Anda',
    intRunOnVps2: 'Jalankan di ubuntu@VM-23-58-ubuntu (VPS 2)',
    intCopied: 'Tersalin',
    intCopyCommand: 'Salin Perintah',
    intGalaxyUpdatePre: 'Memasang perintah permanen',
    intGalaxyUpdateMid:
      'di VPS 2 — untuk pembaruan berikutnya, cukup unggah ke GitHub lalu jalankan',

    // Guide View
    guideEyebrow: 'Kelola / Panduan',
    guideTitlePrefix: 'Panduan',
    guideTitleAccent: 'operator.',
    guideSubtitle:
      'Aturan operasi permanen dan alur kerja untuk mengendalikan seluruh armada agen Hermes Anda.',
    guideCh1Title: 'Kokpit & Keputusan Eksekutif',
    guideCh1Summary:
      'Buka Kokpit untuk melihat seluruh tim dalam satu layar—siapa yang sedang bekerja, kesehatan sistem, dan semua rencana yang menunggu persetujuan Anda.',
    guideCh1Bullet1:
      'Rencana misi yang tertunda langsung tampil di sisi kanan lengkap dengan tombol Setujui Rencana satu klik.',
    guideCh1Bullet2:
      'Gunakan tombol Tanya GALAXY di pojok kiri bawah dari halaman mana saja untuk memberi arahan langsung ke Executor.',
    guideCh1Action: 'Buka Kokpit',
    guideCh2Title: 'Kantor 3D Agen AI 2 Lantai — Tambah, Obrolan & Kelola',
    guideCh2Summary:
      'Setiap agen Hermes memiliki 1 meja kerja di Lantai 1 dan 1 kasur tidur di Lantai 2 secara 1:1. Saat luang, agen akan bersantai di ruang tamu, menonton TV, ngopi, main biliar, atau tidur di Lantai 2.',
    guideCh2Bullet1:
      'Klik agen mana saja untuk memfokuskan kamera, membaca gelembung pikirannya, dan mengobrol langsung sambil melihatnya bekerja.',
    guideCh2Bullet2:
      'Klik Tambah Agen untuk merekrut dari 14 templat spesialis atau membuat agen kustom; hapus agen non-inti dengan aman lewat dialog konfirmasi.',
    guideCh2Action: 'Masuk Kantor Agen',
    guideCh3Title: 'Misi & Kontrak Persetujuan',
    guideCh3Summary:
      'Berikan tujuan ke Executor lalu pilih kedalaman laporan (Ringkas, Standar, atau Mendalam). Tidak ada tugas yang dijalankan sebelum Anda menyetujui rencananya.',
    guideCh3Bullet1:
      'Executor otomatis memilih spesialis yang tepat dan memecah langkah pengerjaan secara terstruktur.',
    guideCh3Bullet2:
      'Misi yang selesai akan diarsipkan ke Pustaka Dokumen sebagai laporan Markdown yang dapat diunduh.',
    guideCh3Action: 'Buka Misi',
    guideCh4Title: 'Mode Suara & Obrolan Langsung',
    guideCh4Summary:
      'Berbicaralah langsung ke spesialis mana pun melalui Web Speech API + VoiceStudio lokal (:3900), Piper, Kokoro, atau ElevenLabs, atau gunakan utas teks di halaman Obrolan.',
    guideCh4Bullet1:
      'Ganti lawan bicara dengan cepat lewat deretan potret agen di bagian bawah Mode Suara.',
    guideCh4Bullet2:
      'Semua riwayat Obrolan tersimpan secara lokal lengkap dengan informasi model dan perangkat yang dipakai.',
    guideCh4Action: 'Buka Mode Suara',
    guideCh5Title: 'Kesehatan Mesin, Berkas & Gerbang Terminal',
    guideCh5Summary:
      'Pantau hermesagent (100.72.221.36) lewat 21 titik diagnostik, sunting SOUL.md atau config.yaml secara langsung, dan jalankan terminal yang terjaga aman.',
    guideCh5Bullet1:
      'Perintah destruktif (rm -rf, systemctl stop/restart, iptables flush, reboot) otomatis ditahan hingga Anda menyetujuinya.',
    guideCh5Bullet2:
      'Atur alamat jembatan Tailscale pribadi Anda kapan saja di menu Integrasi.',
    guideCh5Action: 'Buka Terminal',
    guideCh6Title: 'Ganti Dasbor Lama di VPS 2 (Port 9120)',
    guideCh6Summary:
      'Unggah proyek ini ke GitHub lalu jalankan skrip pembaruan 1 perintah di vm-23-58-ubuntu untuk mengganti dasbor lama secara otomatis.',
    guideCh6Bullet1:
      'Otomatis mempertahankan NEXORA_TOKEN, kunci SSH, dan nexora-tunnel.service (port 20128, 3900, 9377) yang sudah ada.',
    guideCh6Bullet2:
      'Membuat folder cadangan bertanggal (~/nexora-bridge.bak-*) sebelum mengalihkan port 9120 ke GALAXY.',
    guideCh6Bullet3:
      'Buka tautan Tailscale Anda (http://100.85.109.20:9120/?token=...) — sesi langsung aktif dan tetap terhubung lewat kuki saat tab dimuat ulang.',
    guideCh6Action: 'Salin Perintah Pasang',

    // Settings View
    settingsEyebrow: 'Kelola / Pengaturan',
    settingsTitlePrefix: 'Sesuaikan',
    settingsTitleAccent: 'selera Anda.',
    settingsSubtitle:
      'Atur bahasa dasbor, identitas operator, tema warna, pengaturan suara, dan kunci pengaman dasbor.',
    settingsLangTitlePrefix: 'Bahasa &',
    settingsLangTitleAccent: 'Wilayah.',
    settingsLangDesc:
      'Mengubah seluruh label, menu, jendela dialog, status, hingga isi pikiran agen di Kantor 3D secara menyeluruh.',
    settingsLangIdTitle: 'Bahasa Indonesia',
    settingsLangIdDesc: 'Antarmuka 100% Bahasa Indonesia di seluruh panel dan pikiran agen 3D.',
    settingsLangEnTitle: 'Bahasa Inggris',
    settingsLangEnDesc: 'Antarmuka 100% Bahasa Inggris di seluruh panel dan pikiran agen 3D.',
    settingsPaletteTitlePrefix: 'Palet &',
    settingsPaletteTitleAccent: 'Suasana.',
    settingsPaletteDesc:
      'Berlaku ke seluruh dasbor dan secara dinamis menyesuaikan pencahayaan Kantor 3D Agen AI 2 Lantai.',
    settingsThemeObsidianName: 'Obsidian Bara',
    settingsThemeObsidianDesc: 'Tema gelap obsidian khas GALAXY dengan aksen jingga bara hangat.',
    settingsThemeAlabasterName: 'Alabaster Editorial',
    settingsThemeAlabasterDesc:
      'Kanvas krem terang hangat dengan tinta tajam dan aksen jingga menyala.',
    settingsThemePhosphorName: 'Fosfor Taktis',
    settingsThemePhosphorDesc:
      'Konsol obsidian kontras tinggi dengan hijau fosfor dan biru elektrik.',
    settingsIdentityPrefix: 'Identitas',
    settingsIdentityAccent: 'Operator.',
    settingsOperatorName: 'Nama Operator',
    settingsClockCity: 'Label Kota Jam',
    settingsTimezone: 'Zona Waktu',
    settingsLockTitle: 'Kunci Dasbor (Gerbang PIN Opsional)',
    settingsLockDesc: 'Minta PIN 4 digit saat membuka GALAXY di perangkat bersama.',
    settingsLockEnabled: 'Kunci Aktif',
    settingsLockEnable: 'Aktifkan Kunci',
    settingsPinLabel: 'PIN Akses 4 Digit',
    settingsResetTitle: 'Atur Ulang Ruang Kerja Dasbor',
    settingsResetDesc:
      'Mengosongkan misi lokal, jadwal, agen tambahan, dan obrolan sambil tetap menyimpan Pustaka Dokumen.',
    settingsResetBtn: 'Atur Ulang Ruang Kerja',

    // App dynamic runtime notices
    appChatProcessing: 'Memproses obrolan: "{preview}"',
    appChatFinished: 'Selesai menjawab: "{preview}"',
    appLiveBridgeErr: 'Galat jembatan langsung: {err}',
    appStatusWorkingTask: 'Menjalankan tugas prioritas langsung dari Operator',
    appStatusAlertTask: 'Ditandai untuk pemeriksaan manual oleh Operator',
    appStatusIdleTask: 'Sedang bersantai di Kantor 3D Agen AI',
    appBridgeErrTokenMissing:
      'Masukkan NEXORA_TOKEN di menu Integrasi atau buka melalui tautan ?token=.',
    appBridgeErrWs:
      'Tidak dapat menjangkau WebSocket nexora-bridge — periksa Tailscale & port 9120.',
    appBridgeErr401:
      'NEXORA_TOKEN tidak valid (401). Perbarui token sesi Anda di menu Integrasi.',
    appVerifyDemo:
      'Simulasi Demo aktif — beralih ke Jembatan VPS Langsung saat mengakses lewat Tailscale.',
    appVerifyUnreachable:
      'Tidak dapat menjangkau /api/health di {url}. Pastikan Tailscale aktif dan nexora-bridge berjalan di port 9120.',
    appVerifyNeedToken:
      'Jembatan v{version} daring ({host}), tetapi Token Sesi masih kosong.',
    appVerifyConnected:
      'Terhubung langsung ke {host} (Jembatan v{version}) · CPU {cpu}%, RAM {ramUsed}/{ramTotal} GB.',
    appVerifyWaitingSsh: 'Jembatan terjangkau, menunggu tautan SSH: {err}',
    appVerifyAuthErr: 'Galat autentikasi/status: {err}',
    appFileSavedNow: 'Baru saja disimpan',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

// Seed data localized lookups for Indonesian mode so demo content has zero stray English
const ID_AGENT_OVERRIDES: Record<
  string,
  { role: string; workstation: string; task: string; soul: string }
> = {
  executor: {
    role: 'Orkestrator Utama',
    workstation: 'Meja Komando Utama',
    task: 'Mengoordinasikan pengarahan armada NX-1011 & memeriksa kesehatan VPS',
    soul: 'Orkestrator utama di profil "default". Menyusun rencana misi, mendelegasikan spesialis, menegakkan aturan permanen, dan tidak pernah menjalankan aksi kritis tanpa persetujuan Operator.',
  },
  research: {
    role: 'Ketua Riset Mendalam',
    workstation: 'Meja Riset & Intelijen',
    task: 'Membandingkan tolok ukur jaringan Tailscale & spesifikasi ARM Oracle',
    soul: 'Spesialis investigasi yang memverifikasi fakta dari sumber langsung, menyusun ringkasan berreferensi, dan menyimpannya ke Pustaka Dokumen.',
  },
  developer: {
    role: 'Arsitek Sistem & Kode',
    workstation: 'Meja Rekayasa Kode',
    task: 'Memperkuat pemulihan otomatis WebSocket nexora-bridge di hermesagent',
    soul: 'Spesialis sistem Linux dan aplikasi penuh yang menangani tinjauan kode, layanan systemd, perutean API, dan pengujian otomatis.',
  },
  data: {
    role: 'Analis Data & Telemetri',
    workstation: 'Meja Analitik Data',
    task: 'Siaga — sinkronisasi catatan token terakhir 12 menit lalu',
    soul: 'Mengubah log mentah, basis data SQLite, dan metrik token menjadi ringkasan operasional yang rapi.',
  },
  content: {
    role: 'Penulis Editorial & Dokumen',
    workstation: 'Meja Studio Konten',
    task: 'Menunggu tinjauan ringkasan eksekutif Kebiasaan Produktif',
    soul: 'Mengubah riset teknis dan transkrip armada menjadi laporan terstruktur, ringkasan, dan dokumentasi operator.',
  },
  signal: {
    role: 'Penghubung Komunikasi & Sinyal',
    workstation: 'Meja Sinyal & Notifikasi',
    task: 'Memantau topik Telegram & webhook peringatan Discord',
    soul: 'Mengarahkan peringatan, rangkuman, dan pembaruan armada melalui Telegram, Discord, dan surel secara terkendali.',
  },
  design: {
    role: 'Direktur Visual & Antarmuka',
    workstation: 'Meja Studio Desain',
    task: 'Mengaudit kontras warna & ergonomi tampilan seluler',
    soul: 'Menjaga hierarki visual, disiplin tipografi, dan konsistensi desain di seluruh dasbor.',
  },
  ledger: {
    role: 'Pengendali Biaya & Token',
    workstation: 'Meja Keuangan & Token',
    task: 'Memantau pemakaian token bulanan 9Router & kuota Oracle PAYG',
    soul: 'Memantau biaya model lintas penyedia, menjaga batas token harian, dan memberi peringatan dini sebelum batas tercapai.',
  },
  studio: {
    role: 'Produser Audio & Suara',
    workstation: 'Meja Studio Suara',
    task: 'VoiceStudio :3900 hangat & siap untuk sintesis suara latensi rendah',
    soul: 'Mengelola profil suara VoiceStudio (:3900), Piper, Kokoro, dan ElevenLabs untuk pengarahan suara seketika.',
  },
  deal: {
    role: 'Ketua Strategi & Pertumbuhan',
    workstation: 'Meja Strategi Bisnis',
    task: 'Menyusun matriks penjangkauan mitra untuk sprint kuartal ini',
    soul: 'Mengevaluasi peluang, merancang proposal, dan menyiapkan ringkasan keputusan untuk persetujuan Operator.',
  },
  guardian: {
    role: 'Penjaga VPS & Operasi',
    workstation: 'Meja Pengawas VPS',
    task: 'Memantau RAM hermesagent (100.72.221.36), Tailscale & port aktif',
    soul: 'Profil khusus "vps-guardian" yang memantau hermesagent (4 vCPU, 24 GB RAM, 200 GB NVMe), latensi Tailscale, dan layanan systemd.',
  },
  travel: {
    role: 'Perencana Jadwal & Operasi',
    workstation: 'Meja Jadwal & Logistik',
    task: 'Menjaga jadwal cron dan lini masa operasi tetap sinkron',
    soul: 'Mengoordinasikan kalender, jadwal pemeliharaan berkala, dan agenda lintas zona waktu.',
  },
};

const ID_PRESET_OVERRIDES: Record<
  string,
  { role: string; workstation: string; description: string; department: string }
> = {
  'preset-security': {
    role: 'Auditor Keamanan & Firewall',
    workstation: 'Meja Keamanan',
    department: 'Keamanan',
    description: 'Mengaudit aturan iptables, kunci SSH, ACL Tailscale, dan kebersihan rotasi token.',
  },
  'preset-devops': {
    role: 'Insinyur DevOps & Rilis',
    workstation: 'Meja Rilis & Pipeline',
    department: 'Rekayasa',
    description: 'Mengelola layanan systemd, pembaruan tanpa henti, dan cadangan snapshot server.',
  },
  'preset-qa': {
    role: 'Ketua QA & Verifikasi',
    workstation: 'Meja Uji Kualitas',
    department: 'Kualitas',
    description: 'Menjalankan pengujian regresi, mengecek latensi API, dan memvalidasi hasil kerja agen.',
  },
  'preset-seo': {
    role: 'Ahli Strategi SEO & Pencarian',
    workstation: 'Meja Analitik Pencarian',
    department: 'Pertumbuhan',
    description: 'Memetakan kata kunci, metadata teknis, dan klaster konten organik.',
  },
  'preset-marketing': {
    role: 'Ketua Pertumbuhan & Pemasaran',
    workstation: 'Meja Kampanye',
    department: 'Pertumbuhan',
    description: 'Menyusun panduan peluncuran, sudut pemasaran, dan eksperimen audiens.',
  },
  'preset-product': {
    role: 'Ahli Strategi Produk',
    workstation: 'Meja Strategi Produk',
    department: 'Produk',
    description: 'Menerjemahkan tujuan operator menjadi spesifikasi produk dan peta jalan prioritas.',
  },
  'preset-legal': {
    role: 'Analis Kebijakan & Kontrak',
    workstation: 'Meja Kepatuhan',
    department: 'Tata Kelola',
    description: 'Meninjau ketentuan layanan, privasi, dan kewajiban lisensi perangkat pihak ketiga.',
  },
  'preset-support': {
    role: 'Spesialis Dukungan Klien',
    workstation: 'Meja Layanan Bantuan',
    department: 'Operasi',
    description: 'Memilah permintaan masuk, menyusun jawaban empatik, dan memantau batas waktu layanan.',
  },
  'preset-scraper': {
    role: 'Pemantau Web & Intelijen',
    workstation: 'Meja Pantau Web',
    department: 'Intelijen',
    description: 'Memantau catatan rilis, pembaruan kompetitor, dan umpan berita sepanjang waktu.',
  },
  'preset-memory': {
    role: 'Kurator Pengetahuan & Memori',
    workstation: 'Meja Arsip Memori',
    department: 'Intelijen',
    description: 'Merapikan memori vektor, memadatkan sesi lama, dan mengindeks ~/.hermes/memories.',
  },
  'preset-video': {
    role: 'Produser Naskah & Video',
    workstation: 'Meja Produksi Video',
    department: 'Media',
    description: 'Menulis papan cerita visual, daftar adegan, dan naskah demo bernarasi.',
  },
  'preset-social': {
    role: 'Ketua Media Sosial & Komunitas',
    workstation: 'Meja Siaran Komunitas',
    department: 'Komunikasi',
    description: 'Mengubah dokumen panjang menjadi utas ringkas, rangkuman komunitas, dan catatan rilis.',
  },
  'preset-finance': {
    role: 'Analis Pemodelan Keuangan',
    workstation: 'Meja Keuangan & Anggaran',
    department: 'Keuangan',
    description: 'Memodelkan ekonomi unit, skenario biaya awan, dan proyeksi pengeluaran bulanan.',
  },
  'preset-coach': {
    role: 'Pelatih Ringkasan Eksekutif',
    workstation: 'Meja Fokus Eksekutif',
    department: 'Komando',
    description: 'Menyiapkan tinjauan keputusan harian yang ringkas dan evaluasi prioritas.',
  },
};

const ID_INTEGRATION_OVERRIDES: Record<string, { name: string; description: string }> = {
  'int-hermes': {
    name: 'Gerbang Hermes',
    description: 'API orkestrator armada inti yang menampilkan profil aktif, sesi, dan jalur misi.',
  },
  'int-9router': {
    name: 'Proksi Model 9Router',
    description: 'Perute LLM multi-penyedia terpadu yang menyeimbangkan kelas Sonnet, Gemini, dan GPT.',
  },
  'int-voice': {
    name: 'VoiceStudio TTS / STT',
    description: 'Server sintesis suara Piper & Kokoro lokal dengan cadangan awan ElevenLabs.',
  },
  'int-tailscale': {
    name: 'Jaringan Privat Tailscale',
    description: 'Tautan WireGuard terenkripsi yang mengisolasi pusat kendali dari internet publik.',
  },
  'int-telegram': {
    name: 'Topik Armada Telegram',
    description: 'Mengarahkan pembaruan spesialis dan persetujuan seluler ke topik grup Telegram khusus.',
  },
  'int-discord': {
    name: 'Saluran Perintah Discord',
    description: 'Meneruskan laporan misi selesai dan peringatan kritis VPS ke server operasi privat.',
  },
};

const ID_HEALTH_CHECK_OVERRIDES: Record<string, { name: string; detail: string }> = {
  'hc-1': { name: 'Gerbang Hermes (:9119)', detail: 'PID 998 aktif mendengarkan di 100.72.221.36:9119' },
  'hc-2': { name: 'Proksi 9Router (:20128)', detail: 'Server aktif sehat, 4 rute model terhubung' },
  'hc-3': { name: 'VoiceStudio TTS (:3900)', detail: 'Pekerja Uvicorn siap (Kokoro / Piper aktif)' },
  'hc-4': { name: 'Pekerja Utama Node (:9377)', detail: 'Jeda putaran kejadian 0,8 md' },
  'hc-5': { name: 'Soket Unix Gerbang', detail: '~/.hermes/gateway.sock merespons normal' },
  'hc-6': { name: 'Bidang Kontrol Tailscale', detail: 'Terhubung · Jalur langsung antar-rekan aktif' },
  'hc-7': { name: 'Rekan hermesagent (100.72.221.36)', detail: 'Balasan ICMP 24 md · 0% kehilangan paket' },
  'hc-8': { name: 'Firewall Masuk Tailscale', detail: 'Port publik tertutup · tailscale0 diizinkan' },
  'hc-9': { name: 'Jabat Tangan TLS & Token', detail: 'Autentikasi token terverifikasi' },
  'hc-10': { name: 'Kesehatan Resolusi DNS', detail: 'Resolver IPv4 hulu merespons normal' },
  'hc-11': { name: 'Executor HQ (default)', detail: 'Detak jantung normal · Orkestrator aktif' },
  'hc-12': { name: 'Penjaga VPS (vps-guardian)', detail: 'Pengawas aktif · 0 peringatan' },
  'hc-13': { name: 'Meja Riset & Intelijen', detail: 'Pengambil web & tembolok rujukan siap' },
  'hc-14': { name: 'Meja Rekayasa Kode', detail: 'Ruang kerja terisolasi terpasang' },
  'hc-15': { name: 'Meja Analitik Data', detail: 'Kumpulan baca SQLite sehat' },
  'hc-16': { name: 'Meja Konten & Studio', detail: 'Penulis dokumen & jalur suara siap' },
  'hc-17': { name: 'SQLite Kanban (kanban.db)', detail: 'Mode WAL · pemeriksaan integritas normal' },
  'hc-18': { name: 'Status Bersama (shared-state.db)', detail: '184 KB · 0 konflik kunci' },
  'hc-19': { name: 'Penyimpanan Proyek (projects.db)', detail: '45 KB · terindeks rapi' },
  'hc-20': { name: 'Volume Root NVMe (200 GB)', detail: '62 GB terpakai (31%) · 138 GB tersedia' },
  'hc-21': { name: 'Cadangan Memori & Direktori Cron', detail: 'Cadangan terakhir 4 jam lalu' },
};

const ID_MISSION_OVERRIDES: Record<
  string,
  { title: string; planSummary: string; updatedAgo: string; steps: Record<string, string> }
> = {
  'm-1009': {
    title: 'Kebiasaan produktif yang layak dimulai',
    planSummary:
      'Research merangkum pola kebiasaan efektif, Content menyusun panduan 30 hari, dan Studio menyiapkan pengarahan suara VoiceStudio pukul 07:30.',
    updatedAgo: '4 HARI LALU',
    steps: {
      's-1': 'Audit pemicu kebiasaan berbasis bukti & pengurangan hambatan',
      's-2': 'Susun protokol operator 30 hari & aturan cadangan',
      's-3': 'Atur templat laporan suara VoiceStudio pukul 07:30',
    },
  },
  'm-1010': {
    title: 'Audit Jaringan Tailscale & Pemulihan VPS',
    planSummary:
      'Guardian menguji latensi Tailscale & pewaktu systemd sementara Developer menulis pengawas sambung ulang otomatis untuk nexora-tunnel.',
    updatedAgo: '14 JAM LALU',
    steps: {
      's-4': 'Uji latensi langsung vs relai DERP di 100.72.221.36',
      's-5': 'Susun unit pengawas systemd RestartSec=5 untuk jembatan terowongan',
      's-6': 'Verifikasi kebijakan ikatan Tailscale untuk 9Router :20128 & VoiceStudio :3900',
    },
  },
  'm-1011': {
    title: 'Laporan Efisiensi Token & Batas Biaya 9Router',
    planSummary:
      'Data mengurai log permintaan 9Router, Ledger menghitung biaya per misi tiap profil, dan Executor menyiapkan aturan perutean baru.',
    updatedAgo: '22 MNT LALU',
    steps: {
      's-7': 'Ekstrak catatan token 30 hari dari 9Router :20128',
      's-8': 'Hitung selisih biaya perutean sub-tugas kelas Flash vs Sonnet',
      's-9': 'Susun pembaruan rute config.yaml yang siap diterapkan',
    },
  },
  'm-1012': {
    title: 'Ringkasan Kepatuhan Oracle ARM Free Tier PAYG',
    planSummary:
      'Memverifikasi ambang batas Oracle Always Free PAYG, pengecualian penghentian saat santai, dan batas lebar pita keluar untuk hermesagent.',
    updatedAgo: '2 JAM LALU',
    steps: {
      's-10': 'Verifikasi batas kebijakan Oracle Always Free A1 Flex PAYG',
      's-11': 'Periksa silang telemetri disk & trafik keluar hermesagent',
      's-12': 'Format daftar periksa eksekutif untuk Pustaka Dokumen',
    },
  },
  'm-1008': {
    title: 'Aturan Operasi Armada Hermes v3',
    planSummary:
      'Memasang aturan operasi permanen di ~/.hermes/OPERATING_RULES.md dan membagikan ringkasannya ke seluruh ruang kerja agen aktif.',
    updatedAgo: '6 HARI LALU',
    steps: {
      's-13': 'Susun 6 aturan operasi permanen beserta contoh nyatanya',
      's-14': 'Tinjau & terbitkan ke Pustaka Dokumen',
    },
  },
};

const ID_CRON_OVERRIDES: Record<
  string,
  { name: string; cadenceLabel: string; nextRun: string; lastRun: string }
> = {
  'cron-1': {
    name: 'Pemindaian Telemetri & Port VPS',
    cadenceLabel: 'Setiap 5 menit',
    nextRun: 'Dalam 2m 18d',
    lastRun: '2 mnt lalu',
  },
  'cron-2': {
    name: 'Pengarahan Suara Eksekutif Pagi',
    cadenceLabel: 'Harian pukul 07:30',
    nextRun: 'Besok 07:30',
    lastRun: '12 jam lalu',
  },
  'cron-3': {
    name: 'Rekap Token & Biaya 9Router',
    cadenceLabel: 'Setiap jam',
    nextRun: 'Dalam 2m 11d',
    lastRun: '57 mnt lalu',
  },
  'cron-4': {
    name: 'Detak Jantung Rekan Tailscale & Terowongan',
    cadenceLabel: 'Setiap 15 menit',
    nextRun: 'Dalam 11m 04d',
    lastRun: '4 mnt lalu',
  },
  'cron-5': {
    name: 'Pemadatan Memori & Vakum SQLite',
    cadenceLabel: 'Minggu pukul 03:00',
    nextRun: 'Min 03:00',
    lastRun: '5 hari lalu',
  },
  'cron-6': {
    name: 'Rangkuman Mingguan Armada AI ke Telegram',
    cadenceLabel: 'Jumat pukul 18:00',
    nextRun: 'Jum 18:00',
    lastRun: '2 jam lalu',
  },
};

const ID_LOG_OVERRIDES: Record<string, string> = {
  'log-1':
    'Pemeriksaan hermesagent selesai: CPU 18%, RAM 5,4/24 GB, latensi Tailscale 24 md. Seluruh 4 port inti aktif.',
  'log-2':
    'Mengunggah ekspor permintaan 9Router 30 hari (1,9 juta token di 12 profil). Siap untuk pemodelan biaya.',
  'log-3':
    'Memperbarui jeda sambung ulang WebSocket di nexora-bridge. Menunggu persetujuan Operator pada NX-1010 sebelum dimuat ulang.',
  'log-4':
    'Rujukan pola kebiasaan sudah disiapkan di ruang kerja. Menahan draf hingga Operator menyetujui NX-1009.',
  'log-5':
    'Tahan notifikasi Telegram non-mendesak saat jam tenang; teruskan hanya peringatan kritis VPS.',
};

const ID_DOC_OVERRIDES: Record<
  string,
  { title: string; category: string; updatedAt: string; content: string }
> = {
  'doc-1': {
    title: 'Aturan Operasi Permanen — Armada Hermes v3',
    category: 'Tata Kelola',
    updatedAt: '14 Nov 2026',
    content: `# Aturan Operasi Permanen — Armada Hermes v3

## 1. Persetujuan Sebelum Eksekusi
Tidak ada misi yang berjalan tanpa persetujuan langsung dari Operator atas rencana kerja. Setiap tindakan yang menyentuh biaya, kredensial eksternal, aturan firewall, atau perintah shell berisiko WAJIB berhenti di Gerbang Persetujuan (HITL).

## 2. Umumkan Niat Terlebih Dahulu
Sebelum mengubah berkas apa pun di dalam \`~/.hermes/\` atau memulai ulang layanan di \`hermesagent\`, spesialis yang bertugas wajib menulis catatan niat satu baris ke Alur Aktivitas Armada.

## 3. Pelaporan Kegagalan Secara Jujur
Jika pemeriksaan melewati batas waktu, rekan Tailscale luring, atau sumber tidak dapat diverifikasi, agen wajib melaporkan pesan kesalahan asli segera. Jangan pernah memalsukan telemetri atau melewati pemeriksaan yang gagal.

## 4. Ruang Kerja Terisolasi & Pustaka Bersama
Setiap spesialis menyimpan draf sementara di folder memorinya sendiri, sementara hasil akhir disimpan rapi sebagai dokumen Markdown di Pustaka Dokumen GALAXY.

## 5. Disiplin Token & Biaya
Pemeriksaan telemetri rutin diarahkan ke model cepat (Flash/Mini) melalui 9Router (:20128); penalaran arsitektur mendalam hanya naik ke model kelas utama bila dibutuhkan.`,
  },
  'doc-2': {
    title: 'Batasan Aman Oracle Cloud PAYG A1 Flex (hermesagent)',
    category: 'Infrastruktur',
    updatedAt: '20 Nov 2026',
    content: `# Batasan Aman Oracle Cloud PAYG A1 Flex

## Spesifikasi Host
- **Nama Host**: \`hermesagent\` (Tailscale \`100.72.221.36\`)
- **Komputasi**: 4 OCPU Ampere A1 ARM64 · 24 GB RAM
- **Penyimpanan**: Volume Blok 200 GB (31% terpakai)
- **Tingkat Akun**: Bayar Sesuai Pakai (PAYG) — bebas dari penghentian otomatis saat santai

## Verifikasi Ambang Batas Gratis Selamanya
1. **Komputasi**: Total hingga 4 OCPU dan 24 GB memori gabungan pada instans A1 Flex tetap $0,00/bulan.
2. **Penyimpanan Blok**: Jaga total volume boot dan tambahan maksimal 200 GB.
3. **Transfer Keluar**: Termasuk 10 TB/bulan; proyeksi penggunaan saat ini sekitar 42 GB/bulan.

## Pemantauan yang Disarankan
Guardian menjalankan pemeriksaan disk dan trafik keluar setiap hari pukul 06:00 lewat Jadwal Rutin agar tidak ada tagihan tak terduga.`,
  },
  'doc-3': {
    title: 'Arsitektur Suara Latensi Rendah VoiceStudio (:3900)',
    category: 'Rekayasa',
    updatedAt: '18 Nov 2026',
    content: `# Arsitektur Suara Latensi Rendah VoiceStudio (:3900)

## Ringkasan Tumpukan
VoiceStudio berjalan lewat \`uvicorn\` di \`127.0.0.1:3900\` (terhubung privat lewat Tailscale) dan menyediakan titik akhir \`/v1/audio/speech\` yang kompatibel dengan standar OpenAI.

## Mesin Suara yang Didukung
- **Piper Lokal**: Sintesis suara CPU sangat cepat (~180 md pada ARM64)
- **Kokoro v1**: Intonasi alami yang ekspresif untuk pengarahan eksekutif panjang
- **ElevenLabs Awan**: Cadangan kloning suara studio opsional saat kunci API diatur

## Kiat Operator
Gunakan jawaban ringkas di Mode Suara agar balasan lisan tetap di bawah 15 detik, sementara tabel lengkap disimpan otomatis ke Pustaka Dokumen.`,
  },
  'doc-4': {
    title: 'Peta Perutean Multi-Penyedia 9Router (:20128)',
    category: 'Analitik',
    updatedAt: '20 Nov 2026',
    content: `# Peta Perutean 9Router (:20128)

| Profil Agen | Model Utama | Lapisan Cadangan | Rata-rata Latensi |
| --- | --- | --- | --- |
| default (Executor) | claude-sonnet-4 | gemini-2.5-pro | 2,8 dtk |
| research | gemini-2.5-pro | gpt-4.1 | 4,9 dtk |
| developer | claude-sonnet-4 | gpt-4.1 | 5,4 dtk |
| vps-guardian | gemini-2.5-flash | gpt-4.1-mini | 1,7 dtk |

## Temuan Utama
Mengarahkan pemeriksaan rutin cron dan pemantauan VPS ke model kelas Flash berhasil memangkas pengeluaran token bulanan sebesar **61%** tanpa menurunkan akurasi diagnostik.`,
  },
  'doc-5': {
    title: 'Daftar Periksa Keamanan Jaringan Privat Tailscale',
    category: 'Infrastruktur',
    updatedAt: '17 Nov 2026',
    content: `# Daftar Periksa Keamanan Jaringan Privat Tailscale

- Ikat Gerbang Hermes (\`9119\`), 9Router (\`20128\`), dan VoiceStudio (\`3900\`) hanya ke loopback atau IP Tailscale \`100.72.221.36\`.
- Jangan pernah membuka port shell atau jembatan langsung ke antarmuka publik \`0.0.0.0\`.
- Pertahankan \`--accept-dns=false\` pada VPS Ubuntu pendamping jika resolver penyedia bentrok dengan MagicDNS.
- Verifikasi konektivitas dua arah setiap minggu dengan \`tailscale ping -c 3 100.72.221.36\`.`,
  },
  'doc-6': {
    title: 'Spesifikasi Tata Letak Kantor 3D Agen AI GALAXY',
    category: 'Desain',
    updatedAt: '19 Nov 2026',
    content: `# Spesifikasi Kantor 3D Agen AI GALAXY (2 Lantai)

## Arsitektur Ruang
- **Lantai 1 — Ruang Kerja & Area Sosial**: Memiliki meja kerja dan kursi ergonomis 1:1 sesuai jumlah agen Hermes aktif, Ruang Rapat berdinding kaca, Pantry & Bar Kopi, Sudut Baca, serta Ruang Tamu dengan TV dan Meja Biliar.
- **Lantai 2 — Kamar Tidur**: Menyediakan kasur dan nakas 1:1 yang sinkron langsung dengan jumlah agen Hermes aktif sehingga otomatis bertambah atau berkurang.
- **Telemetri Langsung & Perilaku Alami**:
  - **Bekerja**: Agen berjalan ke meja kerjanya di Lantai 1, duduk, dan menampilkan gelembung pikiran aktif di atas kepala.
  - **Santai**: Agen beraktivitas alami — membuat kopi, menonton TV, bermain biliar, membaca, atau naik tangga untuk tidur siang di Lantai 2.
  - **Peringatan**: Gelembung merah menyala yang langsung memberi tahu Operator untuk segera meninjau.`,
  },
};

const ID_PORTRAIT_LABELS: Record<string, string> = {
  executor: 'Eksekutor',
  guardian: 'Penjaga',
  developer: 'Pengembang',
  research: 'Peneliti',
  data: 'Data',
  design: 'Desain',
  content: 'Editorial',
  signal: 'Sinyal',
  ledger: 'Keuangan',
};

const ID_CHAT_SEED_OVERRIDES: Record<string, string> = {
  'c-1':
    'Selamat malam, Operator. Seluruh 21 pemeriksaan sistem di hermesagent (100.72.221.36) lulus normal. Dua rencana misi (NX-1009 dan NX-1010) menunggu persetujuan Anda, sedangkan NX-1011 sedang dikerjakan oleh Data dan Ledger. Bagian mana yang ingin Anda fokuskan terlebih dahulu?',
  'c-2':
    'Meja Riset aktif. Saya telah menyelesaikan verifikasi Oracle PAYG Always Free dan menyiapkan rujukan untuk NX-1009. Silakan minta saya meneliti topik, tolok ukur, atau arsitektur teknis apa pun.',
  'c-3':
    'Meja Rekayasa Kode siap. Cabang proyek di hermesagent bersih; hermes :9119, 9router :20128, dan voicestudio :3900 berjalan normal. Siap memeriksa log atau menulis kode.',
  'c-4':
    'Penjaga VPS melapor: hermesagent (4 vCPU ARM64, 24 GB RAM, 200 GB NVMe) berada di beban CPU 18% dan RAM terpakai 5,4 GB. Latensi rekan Tailscale 24 md. Nol percobaan SSH tidak sah dalam 24 jam terakhir.',
};

const ARCHETYPE_STYLE_KEYS: Record<BuildingArchetype, TranslationKey> = {
  hq_spire: 'styleExecutive',
  observatory_dome: 'styleResearch',
  ribbed_tower: 'styleEngineering',
  octagonal_citadel: 'styleSecurity',
  curved_atelier: 'styleCreative',
  signal_spire: 'styleComms',
  cantilever_loft: 'styleDesign',
  stepped_ziggurat: 'styleFinance',
  stacked_stage: 'styleMedia',
  twin_towers: 'styleStrategy',
  care_pavilion: 'styleOps',
  travel_rotunda: 'stylePlanning',
};

export function formatMessage(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

export interface I18nContextValue {
  lang: LanguageId;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  navLabel: (section: NavSection) => string;
  statusLabel: (status: AgentStatus) => string;
  healthLabel: (label: 'Optimal' | 'Degraded' | 'Critical') => string;
  reportLengthLabel: (len: ReportLength) => string;
  missionStageLabel: (stage: MissionStage) => string;
  searchTypeLabel: (type: SearchResult['type']) => string;
  archetypeStyleLabel: (arch: BuildingArchetype) => string;
  themeLabel: (theme: ThemeId) => { name: string; desc: string };
  agentDisplay: (agent: Agent) => {
    role: string;
    workstation: string;
    task: string;
    soul: string;
  };
  presetDisplay: (preset: RolePreset) => {
    role: string;
    workstation: string;
    department: string;
    description: string;
  };
  integrationDisplay: (svc: IntegrationService) => {
    name: string;
    description: string;
    statusText: string;
  };
  healthCheckDisplay: (check: HealthCheck) => {
    name: string;
    detail: string;
    statusText: string;
  };
  missionDisplay: (mission: Mission) => {
    title: string;
    planSummary: string;
    updatedAgo: string;
    stepTitle: (stepId: string, fallback: string) => string;
  };
  cronDisplay: (job: CronJob) => {
    name: string;
    cadenceLabel: string;
    nextRun: string;
    lastRun: string;
  };
  logMessageDisplay: (log: InterAgentLog) => string;
  docDisplay: (doc: DocItem) => {
    title: string;
    category: string;
    updatedAt: string;
    content: string;
  };
  chatMessageDisplay: (msgId: string, content: string) => string;
  portraitLabel: (id: string, fallback: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function createI18nValue(lang: LanguageId): I18nContextValue {
  const dict = TRANSLATIONS[lang];
  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    formatMessage(dict[key], params);

  return {
    lang,
    t,
    navLabel: (section) => {
      const map: Record<NavSection, TranslationKey> = {
        cockpit: 'navCockpit',
        voice: 'navVoice',
        chat: 'navChat',
        missions: 'navMissions',
        docs: 'navDocs',
        schedule: 'navSchedule',
        city: 'navOffice',
        health: 'navHealth',
        files: 'navFiles',
        terminal: 'navTerminal',
        integrations: 'navIntegrations',
        guide: 'navGuide',
        settings: 'navSettings',
      };
      return t(map[section]);
    },
    statusLabel: (status) => {
      if (status === 'working') return t('commonStatusWorking');
      if (status === 'alert') return t('commonStatusAlert');
      return t('commonStatusIdle');
    },
    healthLabel: (label) => {
      if (label === 'Critical') return t('healthCritical');
      if (label === 'Degraded') return t('healthDegraded');
      return t('healthOptimal');
    },
    reportLengthLabel: (len) => {
      if (len === 'brief') return t('commonBrief');
      if (len === 'deep_dive') return t('commonDeepDive');
      return t('commonStandard');
    },
    missionStageLabel: (stage) => {
      if (stage === 'approval') return t('missionsColApproval');
      if (stage === 'in_progress') return t('missionsColProgress');
      if (stage === 'review') return t('missionsColReview');
      return t('missionsColDelivered');
    },
    searchTypeLabel: (type) => {
      if (type === 'agent') return t('searchTypeAgent');
      if (type === 'mission') return t('searchTypeMission');
      if (type === 'doc') return t('searchTypeDoc');
      if (type === 'schedule') return t('searchTypeSchedule');
      return t('searchTypeFile');
    },
    archetypeStyleLabel: (arch) => t(ARCHETYPE_STYLE_KEYS[arch] ?? 'styleEngineering'),
    themeLabel: (theme) => {
      if (theme === 'editorial-alabaster') {
        return {
          name: t('settingsThemeAlabasterName'),
          desc: t('settingsThemeAlabasterDesc'),
        };
      }
      if (theme === 'tactical-phosphor') {
        return {
          name: t('settingsThemePhosphorName'),
          desc: t('settingsThemePhosphorDesc'),
        };
      }
      return {
        name: t('settingsThemeObsidianName'),
        desc: t('settingsThemeObsidianDesc'),
      };
    },
    agentDisplay: (agent) => {
      if (lang === 'en') {
        return {
          role: agent.role,
          workstation: agent.buildingName,
          task: agent.currentTask,
          soul: agent.soulSummary,
        };
      }
      const ov = ID_AGENT_OVERRIDES[agent.id];
      return {
        role: ov?.role ?? agent.role,
        workstation: ov?.workstation ?? agent.buildingName,
        task: ov && agent.currentTask === getEnglishDefaultTask(agent.id) ? ov.task : agent.currentTask,
        soul: ov?.soul ?? agent.soulSummary,
      };
    },
    presetDisplay: (preset) => {
      if (lang === 'en') {
        return {
          role: preset.role,
          workstation: preset.buildingName,
          department: preset.department,
          description: preset.description,
        };
      }
      const ov = ID_PRESET_OVERRIDES[preset.id];
      return {
        role: ov?.role ?? preset.role,
        workstation: ov?.workstation ?? preset.buildingName,
        department: ov?.department ?? preset.department,
        description: ov?.description ?? preset.description,
      };
    },
    integrationDisplay: (svc) => {
      const ov = lang === 'id' ? ID_INTEGRATION_OVERRIDES[svc.id] : undefined;
      const statusText = !svc.enabled
        ? t('commonDisabled')
        : svc.status === 'connected'
          ? t('commonConnected')
          : svc.status === 'standby'
            ? t('commonStandby')
            : t('commonSimulated');
      return {
        name: ov?.name ?? svc.name,
        description: ov?.description ?? svc.description,
        statusText,
      };
    },
    healthCheckDisplay: (check) => {
      const ov = lang === 'id' ? ID_HEALTH_CHECK_OVERRIDES[check.id] : undefined;
      const statusText =
        check.status === 'fail'
          ? t('commonFail')
          : check.status === 'warn'
            ? t('commonWarn')
            : t('commonPass');
      return {
        name: ov?.name ?? check.name,
        detail: ov?.detail ?? check.detail,
        statusText,
      };
    },
    missionDisplay: (mission) => {
      const ov = lang === 'id' ? ID_MISSION_OVERRIDES[mission.id] : undefined;
      return {
        title: ov?.title ?? mission.title,
        planSummary: ov?.planSummary ?? mission.planSummary,
        updatedAgo:
          lang === 'id'
            ? ov?.updatedAgo ??
              (mission.updatedAgo === 'JUST NOW'
                ? 'BARU SAJA'
                : mission.updatedAgo === 'DELIVERED'
                  ? 'SELESAI'
                  : mission.updatedAgo === 'REVISED NOW'
                    ? 'DIREVISI'
                    : mission.updatedAgo)
            : mission.updatedAgo,
        stepTitle: (stepId, fallback) => ov?.steps[stepId] ?? fallback,
      };
    },
    cronDisplay: (job) => {
      const ov = lang === 'id' ? ID_CRON_OVERRIDES[job.id] : undefined;
      const translateTimestamp = (val: string) => {
        if (lang !== 'id') return val;
        if (val === 'Just now') return 'Baru saja';
        if (val === 'Never') return 'Belum pernah';
        if (val === 'Scheduled') return 'Terjadwal';
        return val;
      };
      return {
        name: ov?.name ?? job.name,
        cadenceLabel: ov?.cadenceLabel ?? job.cadenceLabel,
        nextRun: ov?.nextRun ?? translateTimestamp(job.nextRun),
        lastRun: ov?.lastRun ?? translateTimestamp(job.lastRun),
      };
    },
    logMessageDisplay: (log) => {
      if (lang === 'id' && ID_LOG_OVERRIDES[log.id]) {
        return ID_LOG_OVERRIDES[log.id];
      }
      return log.message;
    },
    docDisplay: (doc) => {
      const isUserEdited = doc.updatedAt === 'Just now' || doc.updatedAt === 'Baru saja';
      const ov = lang === 'id' && !isUserEdited ? ID_DOC_OVERRIDES[doc.id] : undefined;
      return {
        title: ov?.title ?? doc.title,
        category: ov?.category ?? doc.category,
        updatedAt:
          lang === 'id'
            ? ov?.updatedAt ?? (doc.updatedAt === 'Just now' ? 'Baru saja' : doc.updatedAt)
            : doc.updatedAt === 'Baru saja'
              ? 'Just now'
              : doc.updatedAt,
        content: ov?.content ?? doc.content,
      };
    },
    chatMessageDisplay: (msgId, content) => {
      if (lang === 'id' && ID_CHAT_SEED_OVERRIDES[msgId]) {
        return ID_CHAT_SEED_OVERRIDES[msgId];
      }
      return content;
    },
    portraitLabel: (id, fallback) => {
      if (lang === 'id' && ID_PORTRAIT_LABELS[id]) {
        return ID_PORTRAIT_LABELS[id];
      }
      return fallback;
    },
  };
}

const DEFAULT_EN_TASKS: Record<string, string> = {
  executor: 'Coordinating fleet briefing for NX-1011 & verifying VPS health',
  research: 'Cross-referencing Tailscale mesh benchmarks & oracle ARM specs',
  developer: 'Hardening nexora-bridge WebSocket reconnect loop on hermesagent',
  data: 'Standing by — last synced token ledger 12m ago',
  content: 'Waiting for review on Habit Worth Starting executive brief',
  signal: 'Monitoring Telegram topics & Discord alert webhooks',
  design: 'Auditing token contrast & mobile layout ergonomics',
  ledger: 'Tracking 9Router monthly token spend & Oracle PAYG quota',
  studio: 'VoiceStudio :3900 warmed & ready for low-latency TTS',
  deal: 'Drafting partner outreach matrix for Q4 sprint',
  guardian: 'Watching hermesagent (100.72.221.36) RAM, Tailscale & ports',
  travel: 'Keeping cron cadences and itinerary timelines synced',
};

function getEnglishDefaultTask(agentId: string): string {
  return DEFAULT_EN_TASKS[agentId] ?? '';
}

export function I18nProvider({
  language,
  children,
}: {
  language: LanguageId;
  children: ReactNode;
}) {
  const value = useMemo(() => createI18nValue(language), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return createI18nValue('en');
  }
  return ctx;
}
