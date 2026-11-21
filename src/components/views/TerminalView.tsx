import { useRef, useState } from 'react';
import { Check, ShieldAlert, Terminal as TerminalIcon, X } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type {
  Agent,
  BridgeConnectionStatus,
  PendingGateCommand,
  TerminalEntry,
} from '../../types/nexora';
import { evaluateTerminalCommand } from '../../utils/nexoraLogic';

interface LiveShellResult {
  ok: boolean;
  status?: string;
  approval_id?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
}

interface TerminalViewProps {
  agents: Agent[];
  bridgeStatus: BridgeConnectionStatus;
  onExecuteLiveShell?: (command: string) => Promise<LiveShellResult>;
  onResolveLiveApproval?: (
    approvalId: string,
    decision: 'approve' | 'reject',
  ) => Promise<LiveShellResult>;
}

const QUICK_COMMANDS = [
  'hermes status',
  'hermes fleet',
  'tailscale status',
  'ss -tulnp',
  'free -h',
  'df -h',
  'sudo systemctl restart hermes-gateway',
];

export default function TerminalView({
  agents,
  bridgeStatus,
  onExecuteLiveShell,
  onResolveLiveApproval,
}: TerminalViewProps) {
  const { t } = useI18n();
  const isLive = bridgeStatus === 'live' && Boolean(onExecuteLiveShell);
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 't-welcome',
      kind: 'system',
      text: '',
      timestamp: '19:58:00',
    },
  ]);
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [pendingGate, setPendingGate] = useState<
    (PendingGateCommand & { liveApprovalId?: string }) | null
  >(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const nowStr = () => new Date().toLocaleTimeString([], { hour12: false });

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    });
  };

  const runCommand = async (raw: string, bypassGate = false) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (trimmed === 'clear') {
      setEntries([]);
      setPendingGate(null);
      return;
    }

    const ts = nowStr();

    // Live Bridge SSH execution
    if (isLive && onExecuteLiveShell) {
      setEntries((prev) => [
        ...prev,
        { id: `in-${Date.now()}`, kind: 'input', text: trimmed, timestamp: ts },
      ]);
      setRunning(true);
      scrollToBottom();
      try {
        const res = await onExecuteLiveShell(trimmed);
        if (res.status === 'approval_required' && res.approval_id) {
          const approvalId = res.approval_id;
          setPendingGate({
            id: `gate-${approvalId}`,
            liveApprovalId: approvalId,
            command: trimmed,
            reason: t('terminalGateServerReason', { id: approvalId }),
            requestedAt: ts,
          });
          setEntries((prev) => [
            ...prev,
            {
              id: `gt-${Date.now() + 1}`,
              kind: 'gate',
              text: t('terminalGateServerLog', { id: approvalId }),
              timestamp: nowStr(),
            },
          ]);
        } else {
          const outText = res.stdout || res.stderr || t('terminalNoOutput');
          setEntries((prev) => [
            ...prev,
            {
              id: `out-${Date.now() + 1}`,
              kind: res.ok ? 'output' : 'error',
              text: outText,
              timestamp: nowStr(),
            },
          ]);
        }
      } catch (err) {
        setEntries((prev) => [
          ...prev,
          {
            id: `err-${Date.now() + 1}`,
            kind: 'error',
            text: t('terminalBridgeError', {
              err: err instanceof Error ? err.message : String(err),
            }),
            timestamp: nowStr(),
          },
        ]);
      } finally {
        setRunning(false);
        scrollToBottom();
      }
      return;
    }

    // Local Demo Simulator fallback
    const res = evaluateTerminalCommand(trimmed, agents, bypassGate);
    if (res.clear) {
      setEntries([]);
      setPendingGate(null);
      return;
    }

    if (res.requiresGate && res.gateReason) {
      setPendingGate({
        id: `gate-${Date.now()}`,
        command: trimmed,
        reason: res.gateReason,
        requestedAt: ts,
      });
      setEntries((prev) => [
        ...prev,
        { id: `in-${Date.now()}`, kind: 'input', text: trimmed, timestamp: ts },
        { id: `gt-${Date.now() + 1}`, kind: 'gate', text: res.output, timestamp: ts },
      ]);
      scrollToBottom();
      return;
    }

    setEntries((prev) => [
      ...prev,
      ...(bypassGate
        ? []
        : [{ id: `in-${Date.now()}`, kind: 'input' as const, text: trimmed, timestamp: ts }]),
      {
        id: `out-${Date.now() + 1}`,
        kind: res.isError ? 'error' : 'output',
        text: res.output,
        timestamp: ts,
      },
    ]);
    scrollToBottom();
  };

  const handleResolveGate = async (decision: 'approve' | 'reject') => {
    if (!pendingGate) return;
    const gate = pendingGate;
    setPendingGate(null);

    if (gate.liveApprovalId && onResolveLiveApproval) {
      setRunning(true);
      try {
        const res = await onResolveLiveApproval(gate.liveApprovalId, decision);
        setEntries((prev) => [
          ...prev,
          {
            id: `res-${Date.now()}`,
            kind: decision === 'reject' ? 'error' : res.ok ? 'output' : 'error',
            text:
              decision === 'reject'
                ? t('terminalGateRejectedServer', { cmd: gate.command })
                : res.stdout ||
                  res.stderr ||
                  t('terminalGateApprovedServer', { cmd: gate.command }),
            timestamp: nowStr(),
          },
        ]);
      } catch (err) {
        setEntries((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            kind: 'error',
            text: t('terminalGateFailed', {
              err: err instanceof Error ? err.message : String(err),
            }),
            timestamp: nowStr(),
          },
        ]);
      } finally {
        setRunning(false);
        scrollToBottom();
      }
      return;
    }

    if (decision === 'reject') {
      setEntries((prev) => [
        ...prev,
        {
          id: `blk-${Date.now()}`,
          kind: 'error',
          text: t('terminalGateRejectedLocal', { cmd: gate.command }),
          timestamp: nowStr(),
        },
      ]);
      scrollToBottom();
    } else {
      void runCommand(gate.command, true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || running) return;
    setHistory((prev) => [command.trim(), ...prev].slice(0, 30));
    setHistoryIdx(-1);
    void runCommand(command);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setCommand(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setCommand('');
      } else {
        const next = historyIdx - 1;
        setHistoryIdx(next);
        setCommand(history[next]);
      }
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nx-border)] pb-5">
        <div>
          <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
            {isLive ? t('terminalEyebrowLive') : t('terminalEyebrowDemo')}
          </p>
          <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
            {t('terminalTitlePrefix')}{' '}
            <span className="italic text-[var(--nx-accent)]">{t('terminalTitleAccent')}</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
            {t('terminalSubtitlePre')}{' '}
            <span className="font-mono text-[var(--nx-text)]">ubuntu@hermesagent</span>{' '}
            {t('terminalSubtitlePost')}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_COMMANDS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={running}
              onClick={() => void runCommand(q)}
              className="rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-2.5 py-1 font-mono text-[11px] text-[var(--nx-text-muted)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-text)] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* HITL Risk Gate Banner */}
      {pendingGate && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--nx-alert)]/60 bg-[var(--nx-alert)]/10 p-4 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-[var(--nx-alert)] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[var(--nx-text)]">
                {t('terminalGateBannerTitle')}
              </p>
              <p className="font-mono text-xs text-[var(--nx-accent)] mt-0.5">
                {pendingGate.command}
              </p>
              <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">{pendingGate.reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleResolveGate('reject')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>{t('terminalBlockBtn')}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleResolveGate('approve')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{t('terminalApproveExecBtn')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Terminal Screen */}
      <section className="rounded-xl border border-[var(--nx-border-strong)] bg-[#0b0b0d] text-[#ece9e2] overflow-hidden flex flex-col h-[500px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-[11px] font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-3.5 w-3.5 text-[var(--nx-accent)]" />
            <span>ubuntu@hermesagent: ~ (tailscale 100.72.221.36)</span>
          </div>
          <button
            type="button"
            onClick={() => setEntries([])}
            className="hover:text-white cursor-pointer"
          >
            {t('commonClear')}
          </button>
        </div>

        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-2.5"
        >
          {entries.map((entry) => {
            const displayText =
              entry.id === 't-welcome'
                ? isLive
                  ? t('terminalWelcomeLive')
                  : t('terminalWelcomeDemo')
                : entry.text;
            return (
              <div key={entry.id}>
                {entry.kind === 'input' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--nx-accent)]">ubuntu@hermesagent:~$</span>
                    <span className="text-white">{displayText}</span>
                  </div>
                ) : (
                  <pre
                    className={`whitespace-pre-wrap break-words font-mono ${
                      entry.kind === 'error'
                        ? 'text-red-400'
                        : entry.kind === 'gate'
                          ? 'text-amber-300'
                          : entry.kind === 'system'
                            ? 'text-neutral-400'
                            : 'text-emerald-300/95'
                    }`}
                  >
                    {displayText}
                  </pre>
                )}
              </div>
            );
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-white/10 px-4 py-3 flex items-center gap-2 font-mono text-xs"
        >
          <span className="text-[var(--nx-accent)] shrink-0">ubuntu@hermesagent:~$</span>
          <label htmlFor="terminal-cmd-input" className="sr-only">
            {t('terminalInputAria')}
          </label>
          <input
            id="terminal-cmd-input"
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('terminalInputPlaceholder')}
            className="flex-1 bg-transparent text-white placeholder:text-neutral-500 focus:outline-none"
            autoComplete="off"
          />
          <button
            type="submit"
            className="rounded-md bg-[var(--nx-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] cursor-pointer"
          >
            {t('commonRun')}
          </button>
        </form>
      </section>
    </div>
  );
}
