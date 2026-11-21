import { Lock, RotateCcw } from 'lucide-react';
import type { OperatorSettings, ThemeId } from '../../types/nexora';

interface SettingsViewProps {
  settings: OperatorSettings;
  onUpdateSettings: (patch: Partial<OperatorSettings>) => void;
  onResetWorkspace: () => void;
}

const THEMES: Array<{
  id: ThemeId;
  name: string;
  desc: string;
  bgSwatch: string;
  accentSwatch: string;
}> = [
  {
    id: 'obsidian-ember',
    name: 'Obsidian Ember',
    desc: 'Signature GALAXY dark obsidian with warm ember orange.',
    bgSwatch: '#09090b',
    accentSwatch: '#ff5a1f',
  },
  {
    id: 'editorial-alabaster',
    name: 'Editorial Alabaster',
    desc: 'Warm cream broadsheet canvas with crisp ink and ember highlights.',
    bgSwatch: '#f5f2ec',
    accentSwatch: '#e64c15',
  },
  {
    id: 'tactical-phosphor',
    name: 'Tactical Phosphor',
    desc: 'High-contrast obsidian console with phosphor green & electric blue.',
    bgSwatch: '#050706',
    accentSwatch: '#00e864',
  },
];

export default function SettingsView({
  settings,
  onUpdateSettings,
  onResetWorkspace,
}: SettingsViewProps) {
  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      <div className="border-b border-[var(--nx-border)] pb-5">
        <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
          Manage / Settings
        </p>
        <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
          Make it <span className="italic text-[var(--nx-accent)]">yours.</span>
        </h1>
        <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
          Customize operator identity, palette theme, voice defaults, and dashboard lock protection.
        </p>
      </div>

      {/* Palette & Appearance */}
      <section className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 space-y-4">
        <div>
          <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
            Palette & <span className="italic text-[var(--nx-accent)]">Atmosphere.</span>
          </h2>
          <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">
            Applies across the full dashboard and dynamically restyles the 3D Agent City island.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {THEMES.map((t) => {
            const active = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onUpdateSettings({ theme: t.id })}
                className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)]'
                    : 'border-[var(--nx-border)] bg-[var(--nx-surface)] hover:border-[var(--nx-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="h-5 w-5 rounded-full border border-white/20"
                    style={{ backgroundColor: t.bgSwatch }}
                    aria-hidden="true"
                  />
                  <span
                    className="h-5 w-5 rounded-full border border-white/20"
                    style={{ backgroundColor: t.accentSwatch }}
                    aria-hidden="true"
                  />
                </div>
                <div className="text-sm font-semibold text-[var(--nx-text)]">{t.name}</div>
                <p className="text-xs text-[var(--nx-text-muted)] mt-1 leading-relaxed">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Operator Identity */}
      <section className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 space-y-4">
        <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
          Operator <span className="italic text-[var(--nx-accent)]">Identity.</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="settings-op-name" className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5">
              Operator Name
            </label>
            <input
              id="settings-op-name"
              type="text"
              value={settings.operatorName}
              onChange={(e) => onUpdateSettings({ operatorName: e.target.value })}
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="settings-city" className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5">
              Clock City Label
            </label>
            <input
              id="settings-city"
              type="text"
              value={settings.cityLabel}
              onChange={(e) => onUpdateSettings({ cityLabel: e.target.value.toUpperCase() })}
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 font-mono text-sm text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="settings-tz" className="block text-xs font-medium text-[var(--nx-text-muted)] mb-1.5">
              Timezone
            </label>
            <select
              id="settings-tz"
              value={settings.timezone}
              onChange={(e) => onUpdateSettings({ timezone: e.target.value })}
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-sm text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            >
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </section>

      {/* Dashboard Lock & Reset */}
      <section className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-[var(--nx-accent)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--nx-text)]">
                Dashboard Lock (Optional PIN Gate)
              </h2>
              <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">
                Require a 4-digit PIN when opening GALAXY on shared devices.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ dashboardPinEnabled: !settings.dashboardPinEnabled })
            }
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
              settings.dashboardPinEnabled
                ? 'border-[var(--nx-accent)] bg-[var(--nx-accent)] text-[var(--nx-accent-fg)]'
                : 'border-[var(--nx-border-strong)] text-[var(--nx-text-muted)]'
            }`}
          >
            {settings.dashboardPinEnabled ? 'Lock Enabled' : 'Enable Lock'}
          </button>
        </div>

        {settings.dashboardPinEnabled && (
          <div className="max-w-xs">
            <label htmlFor="settings-pin" className="block text-xs text-[var(--nx-text-muted)] mb-1">
              4-Digit Access PIN
            </label>
            <input
              id="settings-pin"
              type="text"
              maxLength={6}
              value={settings.dashboardPin}
              onChange={(e) => onUpdateSettings({ dashboardPin: e.target.value })}
              className="w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-1.5 font-mono text-sm text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
          </div>
        )}

        <div className="border-t border-[var(--nx-border)] pt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[var(--nx-text)]">Restore Default Fleet Seed</p>
            <p className="text-xs text-[var(--nx-text-subtle)]">
              Resets local missions, hired towers, chats, and settings back to initial demo state.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetWorkspace}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-alert)]/40 px-3.5 py-1.5 text-xs font-medium text-[var(--nx-alert)] hover:bg-[var(--nx-alert)]/10 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Workspace</span>
          </button>
        </div>
      </section>
    </div>
  );
}
