import { useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type {
  Agent,
  BridgeConnectionStatus,
  BridgeTelemetry,
  HealthCheck,
  InterAgentLog,
} from '../../types/nexora';
import { calculateHealthSummary } from '../../utils/nexoraLogic';
import HealthDial from '../HealthDial';

interface HealthViewProps {
  checks: HealthCheck[];
  agents: Agent[];
  interAgentLogs: InterAgentLog[];
  liveTelemetry: BridgeTelemetry | null;
  bridgeStatus: BridgeConnectionStatus;
  onRunDiagnostics: () => void;
  onRestartService?: (unit: string) => Promise<void>;
}

export default function HealthView({
  checks,
  agents,
  interAgentLogs,
  liveTelemetry,
  bridgeStatus,
  onRunDiagnostics,
  onRestartService,
}: HealthViewProps) {
  const { t, lang, healthCheckDisplay, logMessageDisplay } = useI18n();
  const [catFilter, setCatFilter] = useState<'all' | HealthCheck['category']>('all');
  const [running, setRunning] = useState(false);
  const [restartingUnit, setRestartingUnit] = useState<string | null>(null);

  const summary = calculateHealthSummary(checks);
  const filteredChecks =
    catFilter === 'all' ? checks : checks.filter((c) => c.category === catFilter);

  const triggerProbe = () => {
    setRunning(true);
    onRunDiagnostics();
    window.setTimeout(() => setRunning(false), 450);
  };

  const handleRestart = async (unit: string) => {
    if (!onRestartService) return;
    setRestartingUnit(unit);
    try {
      await onRestartService(unit);
    } finally {
      setRestartingUnit(null);
    }
  };

  const cpuPct = liveTelemetry?.connected ? `${liveTelemetry.cpu.percent}%` : '18%';
  const cpuSub = liveTelemetry?.connected
    ? `${liveTelemetry.cpu.cores} OCPU ARM64`
    : '4 OCPU ARM64';
  const ramUsed = liveTelemetry?.connected ? `${liveTelemetry.ram.used_gb} GB` : '5.4 GB';
  const ramSub = liveTelemetry?.connected
    ? t('healthOfRam', { total: liveTelemetry.ram.total_gb })
    : t('healthOfRam', { total: 24 });
  const diskPct = liveTelemetry?.connected ? `${liveTelemetry.disk.percent}%` : '31%';
  const diskSub = liveTelemetry?.connected
    ? `${liveTelemetry.disk.used_gb} / ${liveTelemetry.disk.total_gb} GB`
    : '62 / 200 GB';
  const vps2Stat = liveTelemetry?.command_node
    ? `${liveTelemetry.command_node.cpu_percent}%`
    : '24ms';
  const vps2Label = liveTelemetry?.command_node ? t('healthVps2Cpu') : t('healthMeshRtt');
  const vps2Sub = liveTelemetry?.command_node
    ? `${liveTelemetry.command_node.ram_used_gb} / ${liveTelemetry.command_node.ram_total_gb} GB RAM`
    : t('healthDirectPeer');

  const categoryLabels: Record<'all' | HealthCheck['category'], string> = {
    all: t('healthCatAll'),
    core: t('healthCatCore'),
    network: t('healthCatNetwork'),
    agents: t('healthCatAgents'),
    storage: t('healthCatStorage'),
  };

  const localizeUnitState = (state: string) => {
    if (lang !== 'id') return state;
    const low = state.toLowerCase();
    if (low === 'active' || low === 'running') return 'aktif';
    if (low === 'inactive' || low === 'dead' || low === 'stopped') return 'nonaktif';
    if (low === 'failed') return 'gagal';
    return state;
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              {bridgeStatus === 'live' ? t('healthEyebrowLive') : t('healthEyebrowDemo')}
            </p>
            <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
              {t('cockpitMachinePrefix')}{' '}
              <span className="italic text-[var(--nx-accent)]">
                {summary.label === 'Optimal'
                  ? t('cockpitMachineWell')
                  : t('cockpitMachineWarn')}
              </span>
            </h1>
            <p className="mt-2 text-sm text-[var(--nx-text-muted)]">
              {t('healthLiveHostPrefix')}{' '}
              <span className="font-mono text-[var(--nx-text)]">
                {liveTelemetry?.host ?? 'hermesagent (100.72.221.36)'}
              </span>{' '}
              · Oracle PAYG ARM64.
            </p>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">
                  {t('healthCpuLoad')}
                </p>
                <p className="font-mono text-xl font-semibold text-[var(--nx-text)] tabular-nums mt-0.5">
                  {cpuPct}
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)]">{cpuSub}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">
                  {t('healthMemory')}
                </p>
                <p className="font-mono text-xl font-semibold text-[var(--nx-text)] tabular-nums mt-0.5">
                  {ramUsed}
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)]">{ramSub}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">
                  {t('healthNvmeDisk')}
                </p>
                <p className="font-mono text-xl font-semibold text-[var(--nx-text)] tabular-nums mt-0.5">
                  {diskPct}
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)]">{diskSub}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">
                  {vps2Label}
                </p>
                <p className="font-mono text-xl font-semibold text-[var(--nx-text)] tabular-nums mt-0.5">
                  {vps2Stat}
                </p>
                <p className="text-[11px] text-[var(--nx-text-subtle)]">{vps2Sub}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <HealthDial
              passed={summary.passed}
              total={summary.total}
              label={summary.label}
              size={174}
            />
            <button
              type="button"
              onClick={triggerProbe}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
              <span>{t('healthRunDiagBtn')}</span>
            </button>
          </div>
        </div>

        {/* Live Systemd Service Controls when connected to VPS 2 Bridge */}
        {liveTelemetry?.services && liveTelemetry.services.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[var(--nx-border)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-medium text-[var(--nx-text)]">
                {t('healthSystemdTitle')}
              </p>
              <span className="font-mono text-[11px] text-[var(--nx-text-subtle)]">
                {t('healthSyncedAt', { ts: liveTelemetry.timestamp })}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {liveTelemetry.services.map((svc) => (
                <div
                  key={svc.unit}
                  className="rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-3 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-[var(--nx-text)] truncate">
                      {svc.name}
                    </p>
                    <p
                      className="font-mono text-[10px] uppercase mt-0.5"
                      style={{ color: svc.healthy ? 'var(--nx-idle)' : 'var(--nx-alert)' }}
                    >
                      {localizeUnitState(svc.state)}
                      {svc.latency_ms ? ` · ${svc.latency_ms}ms` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={restartingUnit === svc.unit}
                    onClick={() => handleRestart(svc.unit)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--nx-border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--nx-text-muted)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-text)] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw
                      className={`h-3 w-3 ${restartingUnit === svc.unit ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {restartingUnit === svc.unit ? t('healthRestarting') : t('healthRestart')}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 21 Checks Matrix */}
        <section className="lg:col-span-7 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--nx-border)]">
            <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
              {t('healthProbesPrefix')}{' '}
              <span className="italic text-[var(--nx-accent)]">{t('healthProbesAccent')}</span>
            </h2>
            <div className="flex items-center gap-1 rounded-lg bg-[var(--nx-surface)] p-1 border border-[var(--nx-border)]">
              {(['all', 'core', 'network', 'agents', 'storage'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCatFilter(cat)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap cursor-pointer ${
                    catFilter === cat
                      ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                      : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                  }`}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 divide-y divide-[var(--nx-border)] max-h-[460px] overflow-y-auto">
            {filteredChecks.map((check) => {
              const hc = healthCheckDisplay(check);
              return (
                <div key={check.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--nx-text)]">{hc.name}</p>
                    <p className="text-[11px] text-[var(--nx-text-muted)] truncate">{hc.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className="font-mono text-[11px] font-semibold uppercase"
                      style={{
                        color:
                          check.status === 'fail'
                            ? 'var(--nx-alert)'
                            : check.status === 'warn'
                              ? '#f59e0b'
                              : 'var(--nx-idle)',
                      }}
                    >
                      {hc.statusText}
                    </span>
                    <p className="font-mono text-[10px] text-[var(--nx-text-subtle)] tabular-nums">
                      {check.latencyMs}ms
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Inter-Agent Comms Log */}
        <section className="lg:col-span-5 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5">
          <div className="pb-4 border-b border-[var(--nx-border)]">
            <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
              {t('healthCommsTitlePrefix')}{' '}
              <span className="italic text-[var(--nx-accent)]">{t('healthCommsTitleAccent')}</span>
            </h2>
            <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">{t('healthCommsSub')}</p>
          </div>

          <div className="mt-3 space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
            {interAgentLogs.map((log) => {
              const from = agents.find((a) => a.id === log.fromAgentId)?.name ?? log.fromAgentId;
              const to = agents.find((a) => a.id === log.toAgentId)?.name ?? log.toAgentId;
              return (
                <article
                  key={log.id}
                  className="rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-[var(--nx-text)]">
                      {from} → {to}
                    </span>
                    <span className="font-mono text-[var(--nx-text-subtle)] tabular-nums">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-[var(--nx-accent)]">
                    #{log.channel}
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--nx-text-muted)] leading-relaxed">
                    {logMessageDisplay(log)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
