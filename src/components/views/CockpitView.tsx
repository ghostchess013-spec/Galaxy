import { useCallback } from 'react';
import { ArrowUpRight, Check, Mic, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type {
  Agent,
  BridgeTelemetry,
  HealthCheck,
  InterAgentLog,
  Mission,
  NavSection,
  ThemeId,
} from '../../types/nexora';
import { calculateHealthSummary } from '../../utils/nexoraLogic';
import AgentOffice3D from '../AgentOffice3D';
import HealthDial from '../HealthDial';

interface CockpitViewProps {
  agents: Agent[];
  missions: Mission[];
  healthChecks: HealthCheck[];
  interAgentLogs: InterAgentLog[];
  liveTelemetry: BridgeTelemetry | null;
  theme: ThemeId;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onApproveMission: (id: string) => void;
  onNavigate: (section: NavSection) => void;
  onOpenChat: (agentId: string) => void;
  onOpenAsk: () => void;
  onOpenAddAgent: () => void;
}

export default function CockpitView({
  agents,
  missions,
  healthChecks,
  interAgentLogs,
  liveTelemetry,
  theme,
  selectedAgentId,
  onSelectAgent,
  onApproveMission,
  onNavigate,
  onOpenChat,
  onOpenAsk,
  onOpenAddAgent,
}: CockpitViewProps) {
  const { t, statusLabel, agentDisplay, missionDisplay, logMessageDisplay } = useI18n();
  const workingAgents = agents.filter((a) => a.status === 'working');
  const alertAgents = agents.filter((a) => a.status === 'alert');
  const pendingApprovals = missions.filter((m) => m.stage === 'approval');
  const reviewMissions = missions.filter((m) => m.stage === 'review');
  const decisionsCount = pendingApprovals.length + reviewMissions.length;
  const totalTokens = agents.reduce((acc, a) => acc + a.tokensUsed, 0);
  const totalSessions = agents.reduce((acc, a) => acc + a.sessionsCount, 0);
  const avgReply =
    agents.length > 0
      ? (agents.reduce((acc, a) => acc + a.avgReplySec, 0) / agents.length).toFixed(1)
      : '0.0';
  const health = calculateHealthSummary(healthChecks);
  const executor = agents.find((a) => a.isHQ) ?? agents[0];

  const handleSelectOfficeAgent = useCallback(
    (id: string) => {
      onSelectAgent(id);
      onNavigate('city');
    },
    [onSelectAgent, onNavigate],
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Main 3-Column Mission Control Command Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Voice Mode Quick Launch */}
        <section className="xl:col-span-3 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5 flex flex-col justify-between">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              {t('cockpitVoiceEyebrow')}
            </p>
            <h2 className="font-editorial text-3xl leading-[1.12] mt-2 text-[var(--nx-text)]">
              {t('cockpitVoiceTitle')}{' '}
              <span className="italic text-[var(--nx-accent)]">{t('cockpitVoiceAccent')}</span>
            </h2>
            <p className="mt-2 text-xs text-[var(--nx-text-muted)] leading-relaxed">
              {t('cockpitVoiceDesc')}
            </p>
          </div>

          <div className="my-4 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <div
                className="h-40 w-40 rounded-full border border-[var(--nx-accent)]/35 p-2 flex items-center justify-center"
                style={{ boxShadow: '0 0 42px var(--nx-accent-glow)' }}
              >
                <div className="h-full w-full overflow-hidden rounded-full border border-[var(--nx-border-strong)] bg-[var(--nx-surface)]">
                  <img
                    src={executor.avatarUrl}
                    alt={executor.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('voice')}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--nx-accent)] px-6 py-2 text-sm font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer shadow-lg"
            >
              <Mic className="h-4 w-4" />
              <span>{t('cockpitTalkBtn')}</span>
            </button>
          </div>

          {/* Mini Crew Avatar Switcher */}
          <div>
            <div className="grid grid-cols-5 gap-2">
              {agents.slice(0, 5).map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onOpenChat(agent.id)}
                  className="group flex flex-col items-center gap-1.5 text-center cursor-pointer"
                  aria-label={t('cockpitChatWithAria', { name: agent.name })}
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-[var(--nx-border-strong)] group-hover:border-[var(--nx-accent)] transition-colors bg-[var(--nx-surface)]">
                    <img
                      src={agent.avatarUrl}
                      alt={agent.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  <span className="text-[10px] text-[var(--nx-text-muted)] group-hover:text-[var(--nx-text)] truncate w-full">
                    {agent.name}
                  </span>
                </button>
              ))}
              {agents.length < 5 && (
                <button
                  type="button"
                  onClick={onOpenAddAgent}
                  className="group flex flex-col items-center gap-1.5 text-center cursor-pointer"
                  aria-label={t('cockpitAddAria')}
                >
                  <div className="h-10 w-10 rounded-full border border-dashed border-[var(--nx-border-strong)] group-hover:border-[var(--nx-accent)] group-hover:text-[var(--nx-accent)] flex items-center justify-center text-[var(--nx-text-muted)] transition-colors bg-[var(--nx-surface)]">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] text-[var(--nx-text-muted)] group-hover:text-[var(--nx-text)] truncate w-full">
                    {t('cockpitAddShort')}
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Center Column: 2-Floor 3D AI Agent Office Hero Stage + 4-KPI Strip */}
        <section className="xl:col-span-6 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] flex flex-col overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-[var(--nx-border)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
                  {t('cockpitOfficeEyebrow')}
                </p>
                <h1 className="font-editorial text-3xl leading-tight mt-1 text-[var(--nx-text)]">
                  {t('cockpitCrewTitle')}{' '}
                  <span className="italic text-[var(--nx-accent)]">
                    {workingAgents.length > 0
                      ? t('cockpitCrewWorking')
                      : t('cockpitCrewRelaxing')}
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onOpenAddAgent}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{t('cockpitAddAgentBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('city')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <span>{t('cockpitOpenOfficeBtn')}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 4-Column Crew Telemetry Strip */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                  {t('cockpitKpiWorking')}
                </p>
                <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] mt-1 tabular-nums">
                  {workingAgents.length}
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)] mt-0.5 truncate">
                  {alertAgents.length > 0
                    ? t('cockpitKpiAlertReview', { count: alertAgents.length })
                    : t('cockpitKpiDesksBeds', { count: agents.length })}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                  {t('cockpitKpiSessions')}
                </p>
                <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] mt-1 tabular-nums">
                  {totalSessions}
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)] mt-0.5 truncate">
                  {t('cockpitKpiAcrossProfiles', { count: agents.length })}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                  {t('cockpitKpiAvgReply')}
                </p>
                <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] mt-1 tabular-nums">
                  {avgReply}s
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)] mt-0.5 truncate">
                  {t('cockpitKpiViaRouter')}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--nx-text-muted)]">
                  {t('cockpitKpiTokens')}
                </p>
                <p className="font-mono text-2xl font-semibold text-[var(--nx-text)] mt-1 tabular-nums">
                  {(totalTokens / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)] mt-0.5 truncate">
                  {t('cockpitKpiCrewTime')}
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-[360px] [contain:layout_style]">
            <AgentOffice3D
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={handleSelectOfficeAgent}
              theme={theme}
              compact
            />
          </div>
        </section>

        {/* Right Column: System Health Dial + Pending Decisions */}
        <div className="xl:col-span-3 flex flex-col gap-5">
          {/* System Health Card */}
          <section className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
                {t('cockpitHealthTitle')}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('health')}
                className="text-xs text-[var(--nx-text-muted)] hover:text-[var(--nx-accent)] transition-colors cursor-pointer whitespace-nowrap"
              >
                {t('cockpitInspectBtn')}
              </button>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-editorial text-xl leading-snug text-[var(--nx-text)]">
                  {t('cockpitMachinePrefix')}{' '}
                  <span className="italic text-[var(--nx-accent)]">
                    {health.label === 'Optimal'
                      ? t('cockpitMachineWell')
                      : t('cockpitMachineWarn')}
                  </span>
                </h2>
                <p className="mt-2 font-mono text-[11px] text-[var(--nx-text-muted)] truncate">
                  {liveTelemetry?.host ?? 'hermesagent · 100.72.221.36'}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--nx-text-subtle)] tabular-nums">
                  {liveTelemetry?.connected
                    ? `${liveTelemetry.cpu.percent}% CPU · ${liveTelemetry.ram.used_gb} / ${liveTelemetry.ram.total_gb} GB RAM`
                    : '4 vCPU · 5.4 / 24 GB RAM'}
                </p>
              </div>
              <HealthDial
                passed={health.passed}
                total={health.total}
                label={health.label}
                size={122}
              />
            </div>
          </section>

          {/* Pending Decisions Card */}
          <section className="flex-1 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
                  {t('cockpitMissionsEyebrow')}
                </p>
                <span className="font-mono text-lg font-semibold text-[var(--nx-text)] tabular-nums">
                  {decisionsCount}
                </span>
              </div>
              <h2 className="font-editorial text-2xl leading-tight mt-1 text-[var(--nx-text)]">
                {decisionsCount === 0
                  ? t('cockpitDecisionsNone')
                  : decisionsCount === 1
                    ? t('cockpitDecisionsCount', { count: decisionsCount })
                    : t('cockpitDecisionsCountPlural', { count: decisionsCount })}{' '}
                <span className="italic text-[var(--nx-accent)]">
                  {decisionsCount === 0
                    ? t('cockpitDecisionsSettled')
                    : t('cockpitDecisionsNeedYou')}
                </span>
              </h2>
              <p className="mt-1.5 text-xs text-[var(--nx-text-muted)]">
                {t('cockpitDecisionsSub', {
                  approvals: pendingApprovals.length,
                  reviews: reviewMissions.length,
                })}
              </p>

              <div className="mt-4 space-y-3">
                {pendingApprovals.slice(0, 2).map((mission, idx) => {
                  const mDisp = missionDisplay(mission);
                  return (
                    <div
                      key={mission.id}
                      className={`rounded-lg p-4 border transition-colors ${
                        idx === 0
                          ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)] border-transparent'
                          : 'bg-[var(--nx-surface)] text-[var(--nx-text)] border-[var(--nx-border-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider opacity-85">
                        <span>{t('cockpitApproveTag', { code: mission.code })}</span>
                        <span>{mDisp.updatedAgo}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold leading-snug">
                        {t('cockpitApproveTitle', { title: mDisp.title })}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onApproveMission(mission.id)}
                          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            idx === 0
                              ? 'bg-black/85 text-white hover:bg-black'
                              : 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)]'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{t('cockpitApproveBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('missions')}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                            idx === 0
                              ? 'text-white/90 hover:bg-black/15'
                              : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                          }`}
                        >
                          {t('cockpitReviewBriefBtn')}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {pendingApprovals.length === 0 && (
                  <div className="rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-[var(--nx-text)]">
                      <ShieldCheck className="h-4 w-4 text-[var(--nx-idle)]" />
                      <span>{t('cockpitNoBlockedTitle')}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--nx-text-muted)]">
                      {t('cockpitNoBlockedDesc')}
                    </p>
                    <button
                      type="button"
                      onClick={onOpenAsk}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--nx-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t('cockpitNewMissionBtn')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('missions')}
              className="mt-4 w-full rounded-lg border border-[var(--nx-border-strong)] py-2 text-xs font-medium text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] transition-colors cursor-pointer"
            >
              {t('cockpitViewAllMissions', { count: missions.length })}
            </button>
          </section>
        </div>
      </div>

      {/* Secondary Row: Active Crew Table + Inter-Agent Bus */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--nx-border)]">
            <div>
              <h3 className="font-editorial text-xl text-[var(--nx-text)]">
                {t('cockpitRosterTitle')}{' '}
                <span className="italic text-[var(--nx-accent)]">{t('cockpitRosterAccent')}</span>
              </h3>
              <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">
                {t('cockpitRosterSub', { count: agents.length })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('city')}
              className="text-xs font-medium text-[var(--nx-accent)] hover:underline whitespace-nowrap cursor-pointer"
            >
              {t('cockpitManageOfficeBtn')}
            </button>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--nx-border)] text-[11px] text-[var(--nx-text-muted)]">
                  <th className="py-2.5 pr-3 font-medium">{t('cockpitColSpecialist')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('cockpitColWorkstation')}</th>
                  <th className="py-2.5 px-3 font-medium">{t('cockpitColStatus')}</th>
                  <th className="py-2.5 px-3 font-medium text-right">{t('cockpitColSessions')}</th>
                  <th className="py-2.5 pl-3 font-medium text-right">{t('cockpitColAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--nx-border)] text-xs">
                {agents.slice(0, 6).map((agent) => {
                  const disp = agentDisplay(agent);
                  return (
                    <tr
                      key={agent.id}
                      className="hover:bg-[var(--nx-surface-hover)]/60 transition-colors"
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-[var(--nx-text)]">{agent.name}</div>
                        <div className="text-[11px] text-[var(--nx-text-subtle)]">{disp.role}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--nx-text-muted)] whitespace-nowrap">
                        {disp.workstation}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className="font-mono text-[11px] font-medium uppercase"
                          style={{
                            color:
                              agent.status === 'alert'
                                ? 'var(--nx-alert)'
                                : agent.status === 'working'
                                  ? 'var(--nx-working)'
                                  : 'var(--nx-idle)',
                          }}
                        >
                          {statusLabel(agent.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--nx-text-muted)]">
                        {agent.sessionsCount}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenChat(agent.id)}
                          className="text-xs font-medium text-[var(--nx-text)] hover:text-[var(--nx-accent)] whitespace-nowrap cursor-pointer"
                        >
                          {t('cockpitMessageBtn')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--nx-border)]">
            <div>
              <h3 className="font-editorial text-xl text-[var(--nx-text)]">
                {t('cockpitBusTitle')}{' '}
                <span className="italic text-[var(--nx-accent)]">{t('cockpitBusAccent')}</span>
              </h3>
              <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">{t('cockpitBusSub')}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('health')}
              className="text-xs font-medium text-[var(--nx-accent)] hover:underline whitespace-nowrap cursor-pointer"
            >
              {t('cockpitFullLogBtn')}
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {interAgentLogs.slice(0, 4).map((entry) => {
              const from = agents.find((a) => a.id === entry.fromAgentId)?.name ?? entry.fromAgentId;
              const to = agents.find((a) => a.id === entry.toAgentId)?.name ?? entry.toAgentId;
              return (
                <div
                  key={entry.id}
                  className="border-b border-[var(--nx-border)] pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--nx-text-muted)]">
                    <span className="font-medium text-[var(--nx-text)]">
                      {from} → {to}
                    </span>
                    <span className="font-mono tabular-nums">{entry.timestamp}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--nx-text-muted)] leading-relaxed">
                    {logMessageDisplay(entry)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
