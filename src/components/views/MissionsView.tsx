import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  FileText,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Agent, Mission, MissionStage, ReportLength } from '../../types/nexora';

interface MissionsViewProps {
  missions: Mission[];
  agents: Agent[];
  onCreateMission: (title: string, goal: string, length: ReportLength) => void;
  onApproveMission: (id: string) => void;
  onReviseMission: (id: string, note: string) => void;
  onRejectMission: (id: string) => void;
  onAdvanceMission: (id: string) => void;
  onDeliverMission: (id: string) => void;
  onOpenDoc: (docId: string) => void;
}

const COLUMNS: Array<{ stage: MissionStage; label: string; subtitle: string }> = [
  { stage: 'approval', label: 'Awaiting Approval', subtitle: 'Nothing runs without your OK' },
  { stage: 'in_progress', label: 'In Progress', subtitle: 'Specialists actively executing' },
  { stage: 'review', label: 'Ready for Review', subtitle: 'Awaiting final sign-off' },
  { stage: 'delivered', label: 'Delivered', subtitle: 'Filed in Docs Library' },
];

export default function MissionsView({
  missions,
  agents,
  onCreateMission,
  onApproveMission,
  onReviseMission,
  onRejectMission,
  onAdvanceMission,
  onDeliverMission,
  onOpenDoc,
}: MissionsViewProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [length, setLength] = useState<ReportLength>('standard');
  const [formError, setFormError] = useState('');
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | MissionStage>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !goal.trim()) {
      setFormError('Please provide both a mission title and an objective.');
      return;
    }
    onCreateMission(title, goal, length);
    setTitle('');
    setGoal('');
    setLength('standard');
    setFormError('');
    setComposerOpen(false);
  };

  const visibleColumns =
    stageFilter === 'all' ? COLUMNS : COLUMNS.filter((c) => c.stage === stageFilter);

  return (
    <div className="space-y-6 pb-8">
      {/* Header matching hq3.jpg "The mission board." */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nx-border)] pb-5">
        <div>
          <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
            GALAXY / Missions
          </p>
          <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
            The mission <span className="italic text-[var(--nx-accent)]">board.</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
            Every mission, from briefing to delivered. Nothing runs without your OK.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-1">
            {(['all', 'approval', 'in_progress', 'review', 'delivered'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStageFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  stageFilter === st
                    ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                }`}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'approval'
                    ? 'Approval'
                    : st === 'in_progress'
                      ? 'Active'
                      : st === 'review'
                        ? 'Review'
                        : 'Delivered'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Launch Mission</span>
          </button>
        </div>
      </div>

      {/* New Mission Composer Panel */}
      {composerOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--nx-accent)]/50 bg-[var(--nx-bg-elevated)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
                New Mission <span className="italic text-[var(--nx-accent)]">Briefing.</span>
              </h2>
              <p className="text-xs text-[var(--nx-text-muted)]">
                Executor will select the specialists, draft a step-by-step plan, and pause for your approval.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              aria-label="Close new mission composer"
              className="rounded-lg p-1.5 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mission-title" className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5">
                Mission Title
              </label>
              <input
                id="mission-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="e.g. Audit VPS Security & SSL Renewal"
                className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5">
                Finished Report Length
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] p-1">
                {(['brief', 'standard', 'deep_dive'] as ReportLength[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLength(opt)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      length === opt
                        ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                        : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                    }`}
                  >
                    {opt === 'brief' ? 'Brief (1p)' : opt === 'standard' ? 'Standard' : 'Deep Dive'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="mission-goal" className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5">
              Objective & Constraints
            </label>
            <textarea
              id="mission-goal"
              rows={3}
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder="Explain what outcome you want, which servers/files matter, and any guardrails..."
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>

          {formError && <p className="text-xs text-[var(--nx-alert)]">{formError}</p>}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="rounded-lg border border-[var(--nx-border-strong)] px-4 py-2 text-xs font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
            >
              Draft Plan with Executor
            </button>
          </div>
        </form>
      )}

      {/* Kanban Board Columns */}
      <div
        className={`grid grid-cols-1 gap-5 ${
          visibleColumns.length === 1 ? 'max-w-3xl' : 'md:grid-cols-2 xl:grid-cols-4'
        }`}
      >
        {visibleColumns.map((col) => {
          const items = missions.filter((m) => m.stage === col.stage);
          return (
            <div
              key={col.stage}
              className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-4 flex flex-col gap-3"
            >
              <div className="border-b border-[var(--nx-border)] pb-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[var(--nx-text)]">{col.label}</h2>
                  <span className="font-mono text-xs text-[var(--nx-text-muted)] tabular-nums">
                    {items.length}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--nx-text-subtle)] mt-0.5">{col.subtitle}</p>
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--nx-border)] p-5 text-center text-xs text-[var(--nx-text-subtle)]">
                  No missions in {col.label.toLowerCase()}.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((mission) => {
                    const team = mission.assignedAgentIds
                      .map((id) => agents.find((a) => a.id === id)?.name ?? id)
                      .join(' · ');

                    return (
                      <article
                        key={mission.id}
                        className="rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--nx-text-muted)]">
                          <span>
                            {mission.code} · {mission.reportLength.replace('_', ' ')}
                          </span>
                          <span>{mission.updatedAgo}</span>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-[var(--nx-text)] leading-snug">
                            {mission.title}
                          </h3>
                          <p className="mt-1 text-xs text-[var(--nx-text-muted)] leading-relaxed">
                            {mission.planSummary}
                          </p>
                        </div>

                        <p className="text-[11px] text-[var(--nx-text-subtle)]">Crew: {team}</p>

                        {/* Step Progress Checklist */}
                        <ul className="space-y-1.5 border-t border-[var(--nx-border)] pt-2.5">
                          {mission.steps.map((step) => (
                            <li
                              key={step.id}
                              className="flex items-start gap-2 text-[11px] text-[var(--nx-text-muted)]"
                            >
                              <span
                                className="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    step.status === 'done'
                                      ? 'var(--nx-idle)'
                                      : step.status === 'running'
                                        ? 'var(--nx-accent)'
                                        : 'var(--nx-border-strong)',
                                }}
                                aria-hidden="true"
                              />
                              <span
                                className={
                                  step.status === 'done'
                                    ? 'line-through opacity-75'
                                    : step.status === 'running'
                                      ? 'text-[var(--nx-text)] font-medium'
                                      : ''
                                }
                              >
                                {step.title}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {/* Stage-specific Actions */}
                        {mission.stage === 'approval' && (
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onApproveMission(mission.id)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--nx-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Approve plan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevisingId(revisingId === mission.id ? null : mission.id)
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--nx-border-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] whitespace-nowrap cursor-pointer"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Revise</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectMission(mission.id)}
                                aria-label={`Cancel mission ${mission.code}`}
                                className="ml-auto rounded-md p-1.5 text-[var(--nx-text-subtle)] hover:text-[var(--nx-alert)] cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {revisingId === mission.id && (
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  value={revisionNote}
                                  onChange={(e) => setRevisionNote(e.target.value)}
                                  placeholder="Adjustment for Executor..."
                                  className="flex-1 rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!revisionNote.trim()) return;
                                    onReviseMission(mission.id, revisionNote);
                                    setRevisionNote('');
                                    setRevisingId(null);
                                  }}
                                  className="rounded-md bg-[var(--nx-surface-hover)] px-2.5 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-accent)] hover:text-[var(--nx-accent-fg)] cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {mission.stage === 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => onAdvanceMission(mission.id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--nx-accent)]/60 bg-[var(--nx-accent-soft)] py-1.5 text-xs font-semibold text-[var(--nx-accent)] hover:bg-[var(--nx-accent)] hover:text-[var(--nx-accent-fg)] transition-colors cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Advance Active Step</span>
                          </button>
                        )}

                        {mission.stage === 'review' && (
                          <button
                            type="button"
                            onClick={() => onDeliverMission(mission.id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--nx-accent)] py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Accept & File Report to Docs</span>
                          </button>
                        )}

                        {mission.stage === 'delivered' && mission.deliveredDocId && (
                          <button
                            type="button"
                            onClick={() => onOpenDoc(mission.deliveredDocId!)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--nx-border-strong)] py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] transition-colors cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5 text-[var(--nx-accent)]" />
                            <span>Read Filed Deliverable</span>
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
