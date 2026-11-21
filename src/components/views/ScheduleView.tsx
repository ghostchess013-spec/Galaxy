import { useState } from 'react';
import { Play, Plus, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type { Agent, CronJob } from '../../types/nexora';

interface ScheduleViewProps {
  crons: CronJob[];
  agents: Agent[];
  onToggleCron: (id: string) => void;
  onRunCronNow: (id: string) => void;
  onAddCron: (job: Omit<CronJob, 'id' | 'lastRun' | 'lastStatus' | 'nextRun'>) => void;
  onDeleteCron: (id: string) => void;
}

export default function ScheduleView({
  crons,
  agents,
  onToggleCron,
  onRunCronNow,
  onAddCron,
  onDeleteCron,
}: ScheduleViewProps) {
  const { t, cronDisplay, agentDisplay } = useI18n();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? 'executor');
  const [cronExpr, setCronExpr] = useState('0 8 * * *');
  const [cadenceLabel, setCadenceLabel] = useState('');
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) {
      setError(t('scheduleErrorEmpty'));
      return;
    }
    onAddCron({
      name: name.trim(),
      agentId,
      cronExpr: cronExpr.trim() || '0 8 * * *',
      cadenceLabel: cadenceLabel.trim() || t('scheduleFieldCadenceDefault'),
      enabled: true,
      command: command.trim(),
    });
    setName('');
    setCommand('');
    setCadenceLabel('');
    setError('');
    setAdding(false);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nx-border)] pb-5">
        <div>
          <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
            {t('scheduleEyebrow')}
          </p>
          <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
            {t('scheduleTitlePrefix')}{' '}
            <span className="italic text-[var(--nx-accent)]">{t('scheduleTitleAccent')}</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">{t('scheduleSubtitle')}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setCadenceLabel(t('scheduleFieldCadenceDefault'));
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{t('scheduleNewBtn')}</span>
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--nx-accent)]/50 bg-[var(--nx-bg-elevated)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl text-[var(--nx-text)]">
              {t('scheduleFormPrefix')}{' '}
              <span className="italic text-[var(--nx-accent)]">{t('scheduleFormAccent')}</span>
            </h2>
            <button
              type="button"
              onClick={() => setAdding(false)}
              aria-label={t('scheduleFormCloseAria')}
              className="p-1.5 text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('scheduleFieldTitlePlaceholder')}
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({agentDisplay(a).workstation})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder={t('scheduleFieldCronPlaceholder')}
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            <input
              type="text"
              value={cadenceLabel}
              onChange={(e) => setCadenceLabel(e.target.value)}
              placeholder={t('scheduleFieldCadencePlaceholder')}
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t('scheduleFieldCommandPlaceholder')}
            className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
          />
          {error && <p className="text-xs text-[var(--nx-alert)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-1.5 text-xs text-[var(--nx-text-muted)] cursor-pointer"
            >
              {t('commonCancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--nx-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] cursor-pointer"
            >
              {t('scheduleSaveBtn')}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--nx-border)] text-[11px] text-[var(--nx-text-muted)]">
                <th className="py-3 px-4 font-medium">{t('scheduleColOrder')}</th>
                <th className="py-3 px-4 font-medium">{t('scheduleColOwner')}</th>
                <th className="py-3 px-4 font-medium">{t('scheduleColCadence')}</th>
                <th className="py-3 px-4 font-medium">{t('scheduleColNext')}</th>
                <th className="py-3 px-4 font-medium">{t('scheduleColLast')}</th>
                <th className="py-3 px-4 font-medium text-right">{t('scheduleColControls')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nx-border)] text-xs">
              {crons.map((job) => {
                const c = cronDisplay(job);
                const owner = agents.find((a) => a.id === job.agentId)?.name ?? job.agentId;
                return (
                  <tr
                    key={job.id}
                    className="hover:bg-[var(--nx-surface-hover)]/50 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--nx-text)]">{c.name}</div>
                      <div className="font-mono text-[11px] text-[var(--nx-text-subtle)] mt-0.5 truncate max-w-md">
                        {job.command}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--nx-text-muted)] whitespace-nowrap">
                      {owner}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-[var(--nx-text)]">{c.cadenceLabel}</div>
                      <div className="font-mono text-[10px] text-[var(--nx-text-subtle)]">
                        {job.cronExpr}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[var(--nx-text-muted)] whitespace-nowrap">
                      {job.enabled ? c.nextRun : t('commonPaused')}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[var(--nx-text-muted)] whitespace-nowrap">
                      {c.lastRun}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleCron(job.id)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                            job.enabled
                              ? 'border-[var(--nx-idle)]/40 text-[var(--nx-idle)]'
                              : 'border-[var(--nx-border-strong)] text-[var(--nx-text-muted)]'
                          }`}
                        >
                          {job.enabled ? t('commonActive') : t('commonPaused')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRunCronNow(job.id)}
                          aria-label={t('scheduleRunAria', { name: c.name })}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--nx-border-strong)] px-2.5 py-1 text-[11px] text-[var(--nx-text)] hover:border-[var(--nx-accent)] cursor-pointer"
                        >
                          <Play className="h-3 w-3" />
                          <span>{t('commonRun')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCron(job.id)}
                          aria-label={t('scheduleDeleteAria', { name: c.name })}
                          className="rounded-md p-1.5 text-[var(--nx-text-subtle)] hover:text-[var(--nx-alert)] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
