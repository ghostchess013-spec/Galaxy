import { useState } from 'react';
import { Play, Plus, Trash2, X } from 'lucide-react';
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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? 'executor');
  const [cronExpr, setCronExpr] = useState('0 8 * * *');
  const [cadenceLabel, setCadenceLabel] = useState('Daily at 08:00');
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) {
      setError('Enter both a schedule name and command.');
      return;
    }
    onAddCron({
      name: name.trim(),
      agentId,
      cronExpr: cronExpr.trim() || '0 8 * * *',
      cadenceLabel: cadenceLabel.trim() || 'Custom cadence',
      enabled: true,
      command: command.trim(),
    });
    setName('');
    setCommand('');
    setError('');
    setAdding(false);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nx-border)] pb-5">
        <div>
          <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
            GALAXY / Schedule
          </p>
          <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
            Standing <span className="italic text-[var(--nx-accent)]">orders.</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
            Recurring autonomous routines running quietly on ~/.hermes/cron.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Standing Order</span>
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--nx-accent)]/50 bg-[var(--nx-bg-elevated)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl text-[var(--nx-text)]">
              Register <span className="italic text-[var(--nx-accent)]">Cron Job.</span>
            </h2>
            <button
              type="button"
              onClick={() => setAdding(false)}
              aria-label="Close schedule form"
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
              placeholder="Routine title"
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.buildingName})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="Cron e.g. */15 * * * *"
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            <input
              type="text"
              value={cadenceLabel}
              onChange={(e) => setCadenceLabel(e.target.value)}
              placeholder="Human cadence label"
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Command e.g. hermes probe --host 100.72.221.36"
            className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
          />
          {error && <p className="text-xs text-[var(--nx-alert)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-1.5 text-xs text-[var(--nx-text-muted)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--nx-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] cursor-pointer"
            >
              Save Standing Order
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--nx-border)] text-[11px] text-[var(--nx-text-muted)]">
                <th className="py-3 px-4 font-medium">Standing Order</th>
                <th className="py-3 px-4 font-medium">Owner</th>
                <th className="py-3 px-4 font-medium">Cadence</th>
                <th className="py-3 px-4 font-medium">Next Run</th>
                <th className="py-3 px-4 font-medium">Last Run</th>
                <th className="py-3 px-4 font-medium text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nx-border)] text-xs">
              {crons.map((job) => {
                const owner = agents.find((a) => a.id === job.agentId)?.name ?? job.agentId;
                return (
                  <tr key={job.id} className="hover:bg-[var(--nx-surface-hover)]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--nx-text)]">{job.name}</div>
                      <div className="font-mono text-[11px] text-[var(--nx-text-subtle)] mt-0.5 truncate max-w-md">
                        {job.command}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--nx-text-muted)] whitespace-nowrap">
                      {owner}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-[var(--nx-text)]">{job.cadenceLabel}</div>
                      <div className="font-mono text-[10px] text-[var(--nx-text-subtle)]">
                        {job.cronExpr}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[var(--nx-text-muted)] whitespace-nowrap">
                      {job.enabled ? job.nextRun : 'Paused'}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[var(--nx-text-muted)] whitespace-nowrap">
                      {job.lastRun}
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
                          {job.enabled ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRunCronNow(job.id)}
                          aria-label={`Run ${job.name} now`}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--nx-border-strong)] px-2.5 py-1 text-[11px] text-[var(--nx-text)] hover:border-[var(--nx-accent)] cursor-pointer"
                        >
                          <Play className="h-3 w-3" />
                          <span>Run</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCron(job.id)}
                          aria-label={`Delete ${job.name}`}
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
