import { useState } from 'react';
import { Check, Copy, PlugZap, RefreshCw, Terminal, Wifi } from 'lucide-react';
import type {
  BridgeConnectionStatus,
  IntegrationService,
  OperatorSettings,
} from '../../types/nexora';

interface IntegrationsViewProps {
  integrations: IntegrationService[];
  settings: OperatorSettings;
  bridgeStatus: BridgeConnectionStatus;
  bridgeError: string;
  sessionToken: string;
  onUpdateSessionToken: (token: string) => void;
  onVerifyBridge: () => Promise<string>;
  onToggleIntegration: (id: string) => void;
  onUpdateSettings: (patch: Partial<OperatorSettings>) => void;
}

export default function IntegrationsView({
  integrations,
  settings,
  bridgeStatus,
  bridgeError,
  sessionToken,
  onUpdateSessionToken,
  onVerifyBridge,
  onToggleIntegration,
  onUpdateSettings,
}: IntegrationsViewProps) {
  const [pingResult, setPingResult] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [repoUrl, setRepoUrl] = useState('https://github.com/USERNAME/nexora-mission-control.git');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const migrateCommand = `git clone --depth 1 "${repoUrl.trim() || 'https://github.com/USERNAME/nexora-mission-control.git'}" ~/nexora-v3-src 2>/dev/null || (git -C ~/nexora-v3-src fetch --all && git -C ~/nexora-v3-src reset --hard origin/HEAD) && bash ~/nexora-v3-src/deploy/migrate-vps2.sh "${repoUrl.trim() || 'https://github.com/USERNAME/nexora-mission-control.git'}"`;

  const handleTestBridge = async () => {
    setChecking(true);
    try {
      const msg = await onVerifyBridge();
      setPingResult(msg);
    } finally {
      setChecking(false);
    }
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(migrateCommand);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2200);
    } catch {
      setCopiedCmd(false);
    }
  };

  const statusText =
    bridgeStatus === 'live'
      ? 'Connected live to hermesagent via nexora-bridge (:9120)'
      : bridgeStatus === 'connecting'
        ? 'Connecting WebSocket telemetry stream...'
        : bridgeStatus === 'error'
          ? bridgeError || 'Bridge unreachable — verify Tailscale link and Bearer token'
          : 'Demo mode active — switch to Live VPS Bridge when accessing over Tailscale';

  return (
    <div className="space-y-6 pb-8">
      <div className="border-b border-[var(--nx-border)] pb-5">
        <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
          Manage / Integrations
        </p>
        <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
          Connected <span className="italic text-[var(--nx-accent)]">channels & bridge.</span>
        </h1>
        <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
          Connects directly to your <span className="font-mono text-[var(--nx-text)]">nexora-bridge</span> (:9120) on{' '}
          <span className="font-mono text-[var(--nx-text)]">vm-23-58-ubuntu</span> and SSH tunnel to{' '}
          <span className="font-mono text-[var(--nx-text)]">hermesagent</span>.
        </p>
      </div>

      {/* Live VPS Bridge Configuration Card */}
      <section className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--nx-border)]">
          <div>
            <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
              GALAXY <span className="italic text-[var(--nx-accent)]">Bridge Mode.</span>
            </h2>
            <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">
              Status:{' '}
              <span
                className="font-mono uppercase"
                style={{
                  color:
                    bridgeStatus === 'live'
                      ? 'var(--nx-idle)'
                      : bridgeStatus === 'error'
                        ? 'var(--nx-alert)'
                        : 'var(--nx-accent)',
                }}
              >
                {bridgeStatus}
              </span>{' '}
              · {statusText}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--nx-border)] bg-[var(--nx-surface)] p-1">
            {(['demo', 'live'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onUpdateSettings({ bridgeMode: m })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  settings.bridgeMode === m
                    ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                }`}
              >
                {m === 'demo' ? 'Demo Simulation' : 'Live VPS Bridge'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="bridge-url-input"
              className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
            >
              Bridge Base URL (Leave blank for same-origin on VPS 2 :9120)
            </label>
            <input
              id="bridge-url-input"
              type="text"
              value={settings.bridgeUrl}
              onChange={(e) => onUpdateSettings({ bridgeUrl: e.target.value })}
              placeholder="http://100.85.109.20:9120"
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="bridge-token-input"
              className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
            >
              Session Bearer Token (Memory-only · auto-loaded from ?token=)
            </label>
            <input
              id="bridge-token-input"
              type="password"
              value={sessionToken}
              onChange={(e) => onUpdateSessionToken(e.target.value)}
              placeholder="Paste NEXORA_TOKEN from nexora-bridge.service"
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--nx-border)]">
          <label className="inline-flex items-center gap-2.5 text-xs text-[var(--nx-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showOnlyVpsAgents}
              onChange={(e) => onUpdateSettings({ showOnlyVpsAgents: e.target.checked })}
              className="accent-[var(--nx-accent)] h-3.5 w-3.5"
            />
            <span>
              1:1 sync with live <span className="font-mono text-[var(--nx-text)]">~/.hermes/</span>{' '}
              profiles in 3D Agent City when connected (default — hide unprovisioned preset towers)
            </span>
          </label>

          <button
            type="button"
            disabled={checking}
            onClick={() => void handleTestBridge()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            {checking ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--nx-accent)]" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-[var(--nx-accent)]" />
            )}
            <span>{checking ? 'Verifying...' : 'Test & Sync Bridge'}</span>
          </button>
        </div>

        {pingResult && (
          <p className="text-xs font-mono text-[var(--nx-text-muted)] bg-[var(--nx-surface)] border border-[var(--nx-border)] rounded-lg px-3.5 py-2">
            {pingResult}
          </p>
        )}
      </section>

      {/* 1-Command VPS 2 In-Place Upgrade Card */}
      <section className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              VPS 2 Deployment · vm-23-58-ubuntu (Port 9120)
            </p>
            <h2 className="font-editorial text-2xl mt-0.5 text-[var(--nx-text)]">
              Replace legacy dashboard in{' '}
              <span className="italic text-[var(--nx-accent)]">one command.</span>
            </h2>
            <p className="text-xs text-[var(--nx-text-muted)] mt-1">
              Preserves your existing <span className="font-mono text-[var(--nx-text)]">NEXORA_TOKEN</span>,{' '}
              <span className="font-mono text-[var(--nx-text)]">nexora-tunnel.service</span>, and SSH key, and saves a timestamped backup automatically before upgrading port 9120.
            </p>
          </div>
          <Terminal className="h-5 w-5 text-[var(--nx-accent)] shrink-0" />
        </div>

        <div>
          <label
            htmlFor="github-repo-input"
            className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5"
          >
            Your Exported GitHub Repository URL
          </label>
          <input
            id="github-repo-input"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
          />
        </div>

        <div className="rounded-lg border border-[var(--nx-border-strong)] bg-[#0b0b0d] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-neutral-400">
            <span>Run on ubuntu@VM-23-58-ubuntu (VPS 2)</span>
            <button
              type="button"
              onClick={() => void handleCopyCommand()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-white hover:border-[var(--nx-accent)] hover:text-[var(--nx-accent)] whitespace-nowrap cursor-pointer"
            >
              {copiedCmd ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedCmd ? 'Copied' : 'Copy Command'}</span>
            </button>
          </div>
          <pre className="font-mono text-xs text-emerald-300/95 whitespace-pre-wrap break-all leading-relaxed">
            {migrateCommand}
          </pre>
          <p className="text-[11px] text-neutral-400 pt-1 border-t border-white/10">
            Installs permanent command{' '}
            <span className="font-mono text-emerald-300">galaxy-update</span> on VPS 2 — for all
            future updates, push to GitHub and just run{' '}
            <span className="font-mono text-white">galaxy-update</span>.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((svc) => (
          <article
            key={svc.id}
            className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--nx-text)]">{svc.name}</h3>
                  <p className="font-mono text-[11px] text-[var(--nx-accent)] mt-0.5 break-all">
                    {svc.endpoint}
                  </p>
                </div>
                <PlugZap className="h-4 w-4 text-[var(--nx-text-subtle)] shrink-0" />
              </div>
              <p className="mt-2.5 text-xs text-[var(--nx-text-muted)] leading-relaxed">
                {svc.description}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--nx-border)] pt-3 text-xs">
              <span className="font-mono text-[11px] uppercase text-[var(--nx-text-muted)]">
                {svc.enabled ? svc.status : 'disabled'}
              </span>
              <button
                type="button"
                onClick={() => onToggleIntegration(svc.id)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                  svc.enabled
                    ? 'border-[var(--nx-idle)]/40 text-[var(--nx-idle)]'
                    : 'border-[var(--nx-border-strong)] text-[var(--nx-text-muted)] hover:text-[var(--nx-text)]'
                }`}
              >
                {svc.enabled && <Check className="h-3 w-3" />}
                <span>{svc.enabled ? 'Enabled' : 'Enable'}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
