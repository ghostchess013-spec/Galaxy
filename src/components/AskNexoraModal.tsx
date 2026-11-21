import { useState } from 'react';
import { ArrowRight, MessageSquare, Mic, Rocket, X } from 'lucide-react';
import type { NavSection, ReportLength } from '../types/nexora';

interface AskNexoraModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchMission: (title: string, goal: string, length: ReportLength) => void;
  onQuickChat: (agentId: string, prompt: string) => void;
  onNavigate: (section: NavSection) => void;
}

export default function AskNexoraModal({
  open,
  onClose,
  onLaunchMission,
  onQuickChat,
  onNavigate,
}: AskNexoraModalProps) {
  const [mode, setMode] = useState<'mission' | 'chat'>('mission');
  const [input, setInput] = useState('');
  const [length, setLength] = useState<ReportLength>('standard');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Enter a goal or directive for Executor.');
      return;
    }
    setError('');
    if (mode === 'mission') {
      const title = trimmed.length > 52 ? `${trimmed.slice(0, 52)}...` : trimmed;
      onLaunchMission(title, trimmed, length);
      setInput('');
      onClose();
      onNavigate('missions');
    } else {
      onQuickChat('executor', trimmed);
      setInput('');
      onClose();
      onNavigate('chat');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-nexora-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              GALAXY / Direct Command
            </p>
            <h2 id="ask-nexora-title" className="font-editorial text-2xl mt-1 text-[var(--nx-text)]">
              Brief <span className="italic text-[var(--nx-accent)]">Executor.</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Ask GALAXY dialog"
            className="rounded-lg p-2 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2 border-b border-[var(--nx-border)] pb-3">
          <button
            type="button"
            onClick={() => setMode('mission')}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              mode === 'mission'
                ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                : 'text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)]'
            }`}
          >
            <Rocket className="h-3.5 w-3.5" />
            Draft Mission Plan
          </button>
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              mode === 'chat'
                ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                : 'text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Direct Chat
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('voice');
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] whitespace-nowrap transition-colors cursor-pointer"
          >
            <Mic className="h-3.5 w-3.5" />
            Switch to Voice
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="ask-nexora-input" className="sr-only">
              Goal or message for Executor
            </label>
            <textarea
              id="ask-nexora-input"
              rows={3}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError('');
              }}
              placeholder={
                mode === 'mission'
                  ? 'Describe the outcome you want. Executor will assemble specialists and wait for your approval before running...'
                  : 'Ask Executor anything about your Hermes fleet, VPS telemetry, or active missions...'
              }
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2.5 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            {error && <p className="mt-1.5 text-xs text-[var(--nx-alert)]">{error}</p>}
          </div>

          {mode === 'mission' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[var(--nx-text-muted)]">Finished report length</span>
              <div className="flex items-center gap-1 rounded-lg bg-[var(--nx-surface)] p-1 border border-[var(--nx-border)]">
                {(['brief', 'standard', 'deep_dive'] as ReportLength[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLength(opt)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      length === opt
                        ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                        : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                    }`}
                  >
                    {opt === 'brief' ? 'Brief' : opt === 'standard' ? 'Standard' : 'Deep Dive'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[var(--nx-text-muted)]">
              {mode === 'mission'
                ? 'Nothing runs without your approval on the plan.'
                : 'Routed to Executor HQ via 9Router (:20128).'}
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>{mode === 'mission' ? 'Draft Plan' : 'Send to Executor'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
