import { ArrowRight } from 'lucide-react';
import type { NavSection } from '../../types/nexora';

interface GuideViewProps {
  onNavigate: (section: NavSection) => void;
}

const CHAPTERS: Array<{
  num: string;
  title: string;
  summary: string;
  bullets: string[];
  actionLabel: string;
  target: NavSection;
}> = [
  {
    num: '01.',
    title: 'Cockpit & Executive Decisions',
    summary:
      'Open Cockpit to see your entire fleet in a single frame—who is working, system health checks, and every plan waiting on your sign-off.',
    bullets: [
      'Pending mission plans appear immediately in the right rail with one-click Approve Plan controls.',
      'Use Ask GALAXY in the lower-left corner from any screen to brief Executor directly.',
    ],
    actionLabel: 'Open Cockpit',
    target: 'cockpit',
  },
  {
    num: '02.',
    title: '3D Agent City — Hire, Inspect & Retire',
    summary:
      'Every active Hermes agent owns an architectural tower around Executor HQ. Roads and data shuttles animate whenever specialists are actively processing tasks.',
    bullets: [
      'Click any 3D tower or floating label to focus the camera and test Idle, Working, or Alert states.',
      'Click Hire Specialist to expand your crew from 14 ready-made specialist roles, or Retire non-HQ specialists anytime.',
    ],
    actionLabel: 'Enter Agent City',
    target: 'city',
  },
  {
    num: '03.',
    title: 'Missions & The Approval Contract',
    summary:
      'Give Executor a goal and choose the deliverable depth (Brief, Standard, or Deep Dive). Nothing executes until you explicitly approve the plan.',
    bullets: [
      'Executor automatically assigns specialists and outlines discrete execution steps.',
      'Completed missions are accepted into the Docs Library as downloadable Markdown deliverables.',
    ],
    actionLabel: 'Open Missions',
    target: 'missions',
  },
  {
    num: '04.',
    title: 'Voice Mode & Direct Chat',
    summary:
      'Speak out loud to any specialist via Web Speech API + local VoiceStudio (:3900), Piper, Kokoro, or ElevenLabs, or maintain persistent threads in Chat.',
    bullets: [
      'Switch speakers seamlessly using the portrait carousel at the base of Voice Mode.',
      'All Chat threads persist locally and display the underlying model and tool calls used.',
    ],
    actionLabel: 'Launch Voice Mode',
    target: 'voice',
  },
  {
    num: '05.',
    title: 'Machine Health, Files & Shell Gate',
    summary:
      'Monitor hermesagent (100.72.221.36) across 21 diagnostic checks, edit SOUL.md or config.yaml directly, and operate a guarded shell.',
    bullets: [
      'Destructive commands (rm -rf, systemctl stop/restart, iptables flush, reboot) automatically pause for HITL confirmation.',
      'Configure your private Tailscale bridge endpoint anytime under Integrations.',
    ],
    actionLabel: 'Open Terminal',
    target: 'terminal',
  },
  {
    num: '06.',
    title: 'Replace Legacy Dashboard on VPS 2 (Port 9120)',
    summary:
      'Export this project to GitHub and run the included 1-command upgrade script on vm-23-58-ubuntu to replace the previous single-file dashboard in place.',
    bullets: [
      'Automatically preserves your existing NEXORA_TOKEN, SSH key, and nexora-tunnel.service (ports 20128, 3900, 9377).',
      'Creates a timestamped backup folder (~/nexora-bridge.bak-*) before switching port 9120 to GALAXY.',
      'Open your existing Tailscale link (http://100.85.109.20:9120/?token=...) — the token loads into memory and strips cleanly from the URL.',
    ],
    actionLabel: 'Copy Deploy Command',
    target: 'integrations',
  },
];

export default function GuideView({ onNavigate }: GuideViewProps) {
  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      <div className="border-b border-[var(--nx-border)] pb-5">
        <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
          Manage / Guide
        </p>
        <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
          Operator <span className="italic text-[var(--nx-accent)]">manual.</span>
        </h1>
        <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
          Permanent operating rules and workflow architecture for running your Hermes agent fleet.
        </p>
      </div>

      <div className="space-y-4">
        {CHAPTERS.map((ch) => (
          <section
            key={ch.num}
            className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
                  <span className="text-[var(--nx-accent)] mr-2">{ch.num}</span>
                  {ch.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--nx-text-muted)] leading-relaxed">
                  {ch.summary}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-[var(--nx-text-muted)] list-disc pl-4">
                  {ch.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(ch.target)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-2 text-xs font-medium text-[var(--nx-text)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-accent)] whitespace-nowrap cursor-pointer"
              >
                <span>{ch.actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
