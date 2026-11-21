import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import type { Agent, OperatorSettings } from '../../types/nexora';
import { generateAgentReply } from '../../utils/nexoraLogic';

interface VoiceTurn {
  id: string;
  speaker: 'operator' | 'agent';
  agentName: string;
  text: string;
  engine: string;
  timestamp: string;
}

interface VoiceModeViewProps {
  agents: Agent[];
  settings: OperatorSettings;
  bridgeStatus: 'demo' | 'connecting' | 'live' | 'error';
  onUpdateSettings: (patch: Partial<OperatorSettings>) => void;
  onLiveVoiceExchange?: (
    agent: Agent,
    promptText: string,
  ) => Promise<{ replyText: string; audioBlob?: Blob; engineLabel: string }>;
}

const VOICE_ENGINES: Array<{
  id: OperatorSettings['voiceEngine'];
  label: string;
  meta: string;
}> = [
  { id: 'voicestudio', label: 'VoiceStudio :3900', meta: 'Local Uvicorn · ~180ms' },
  { id: 'piper', label: 'Piper Local', meta: 'Fast ARM64 CPU TTS' },
  { id: 'kokoro', label: 'Kokoro v1', meta: 'Expressive Local Neural' },
  { id: 'elevenlabs', label: 'ElevenLabs', meta: 'Cloud Studio Voice' },
];

const QUICK_VOICE_PROMPTS = [
  'Give me a fleet and VPS health status update.',
  'Which missions are waiting for my approval?',
  'Summarize your role and operating rules.',
];

export default function VoiceModeView({
  agents,
  settings,
  bridgeStatus,
  onUpdateSettings,
  onLiveVoiceExchange,
}: VoiceModeViewProps) {
  const [activeAgentId, setActiveAgentId] = useState<string>(agents[0]?.id ?? 'executor');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualText, setManualText] = useState('');
  const [statusNote, setStatusNote] = useState('Ready — tap Talk or type a spoken prompt.');
  const [turns, setTurns] = useState<VoiceTurn[]>([
    {
      id: 'vt-init',
      speaker: 'agent',
      agentName: 'Executor',
      text: 'Voice link established on VoiceStudio :3900. All checks on hermesagent are monitored. Ready for your next move.',
      engine: 'VoiceStudio :3900',
      timestamp: 'Now',
    },
  ]);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakOutLoud = (text: string, audioBlob?: Blob) => {
    if (!settings.autoSpeakReplies) return;
    if (audioBlob) {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        void audio.play();
        return;
      } catch {
        setSpeaking(false);
      }
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = settings.voiceEngine === 'piper' ? 1.08 : 0.98;
      utter.pitch = activeAgent.isHQ ? 0.92 : 1.02;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setSpeaking(false);
    }
  };

  const handleVoicePrompt = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean || busy) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const defaultEngineLabel =
      VOICE_ENGINES.find((v) => v.id === settings.voiceEngine)?.label ?? 'VoiceStudio :3900';

    setTurns((prev) => [
      ...prev,
      {
        id: `vt-u-${Date.now()}`,
        speaker: 'operator',
        agentName: settings.operatorName,
        text: clean,
        engine: 'Mic / Transcript',
        timestamp: now,
      },
    ]);

    if (bridgeStatus === 'live' && onLiveVoiceExchange) {
      setBusy(true);
      setStatusNote(`Routing through 9Router & VoiceStudio :3900 for ${activeAgent.name}...`);
      try {
        const res = await onLiveVoiceExchange(activeAgent, clean);
        setTurns((prev) => [
          ...prev,
          {
            id: `vt-a-${Date.now() + 1}`,
            speaker: 'agent',
            agentName: activeAgent.name,
            text: res.replyText,
            engine: res.engineLabel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setStatusNote(`${activeAgent.name} responded via ${res.engineLabel}.`);
        speakOutLoud(res.replyText, res.audioBlob);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setStatusNote(`Live voice error: ${errMsg}`);
        setTurns((prev) => [
          ...prev,
          {
            id: `vt-err-${Date.now() + 1}`,
            speaker: 'agent',
            agentName: activeAgent.name,
            text: `Unable to reach live bridge (${errMsg}).`,
            engine: 'Bridge Error',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }

    const reply = generateAgentReply(activeAgent, clean, agents);
    setTurns((prev) => [
      ...prev,
      {
        id: `vt-a-${Date.now() + 1}`,
        speaker: 'agent',
        agentName: activeAgent.name,
        text: reply.text,
        engine: defaultEngineLabel,
        timestamp: now,
      },
    ]);
    setStatusNote(`${activeAgent.name} responded via ${defaultEngineLabel}.`);
    speakOutLoud(reply.text);
  };

  const toggleMicrophone = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setStatusNote('Microphone stopped.');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };

    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setStatusNote(
        'Browser Speech Recognition unavailable here — use a quick voice prompt or the input bar below to hear spoken replies.',
      );
      return;
    }

    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) {
          handleVoicePrompt(transcript);
        }
      };
      rec.onerror = () => {
        setListening(false);
        setStatusNote('Microphone permission blocked — use the text prompt bar below.');
      };
      rec.onend = () => {
        setListening(false);
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      setStatusNote(`Listening for ${activeAgent.name}... speak clearly.`);
    } catch {
      setListening(false);
      setStatusNote('Could not start microphone — use the prompt bar below.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    handleVoicePrompt(manualText);
    setManualText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
      {/* Main Voice Stage matching NEXORA 3.0 Left Panel */}
      <section className="lg:col-span-7 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 flex flex-col justify-between min-h-[600px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              GALAXY / Voice Mode
            </p>
            <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
              Intelligence,{' '}
              <span className="italic text-[var(--nx-accent)]">within reach.</span>
            </h1>
            <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
              A thought. A question. Your next move.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onUpdateSettings({ autoSpeakReplies: !settings.autoSpeakReplies })}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--nx-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] whitespace-nowrap cursor-pointer"
          >
            {settings.autoSpeakReplies ? (
              <Volume2 className="h-3.5 w-3.5 text-[var(--nx-accent)]" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-[var(--nx-text-muted)]" />
            )}
            <span>{settings.autoSpeakReplies ? 'Spoken Audio On' : 'Audio Muted'}</span>
          </button>
        </div>

        {/* Central Visor Portrait & Acoustic Rings */}
        <div className="my-8 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-72 w-72 rounded-full border border-[var(--nx-accent)]/15"
              aria-hidden="true"
            />
            <div
              className="absolute h-60 w-60 rounded-full border border-[var(--nx-accent)]/30"
              aria-hidden="true"
            />
            <div
              className="relative h-52 w-52 rounded-full border-2 border-[var(--nx-accent)]/70 p-2 overflow-hidden bg-[var(--nx-surface)]"
              style={{
                boxShadow:
                  listening || speaking
                    ? '0 0 65px var(--nx-accent-glow)'
                    : '0 0 36px var(--nx-accent-glow)',
              }}
            >
              <img
                src={activeAgent.avatarUrl}
                alt={`${activeAgent.name} voice avatar`}
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-full object-cover object-top"
              />
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm font-semibold text-[var(--nx-text)]">
              {activeAgent.name} · {activeAgent.buildingName}
            </p>
            <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">{statusNote}</p>
          </div>

          {/* Acoustic Waveform Bars */}
          <div className="mt-4 flex items-center justify-center gap-1 h-7" aria-hidden="true">
            {Array.from({ length: 15 }, (_, idx) => (
              <span
                key={idx}
                className={`w-1 rounded-full transition-all ${
                  listening || speaking ? 'animate-voice-bar bg-[var(--nx-accent)]' : 'bg-[var(--nx-border-strong)]'
                }`}
                style={{
                  height: listening || speaking ? `${12 + ((idx * 7) % 16)}px` : '6px',
                  animationDelay: `${idx * 65}ms`,
                }}
              />
            ))}
          </div>

          {/* Primary Talk Button */}
          <button
            type="button"
            onClick={toggleMicrophone}
            className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-[var(--nx-accent)] px-8 py-3 text-sm font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors whitespace-nowrap cursor-pointer shadow-lg"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>{listening ? 'Stop Listening' : 'Talk'}</span>
          </button>
        </div>

        {/* Crew Portrait Selector Carousel */}
        <div className="border-t border-[var(--nx-border)] pt-4">
          <p className="text-[11px] text-[var(--nx-text-muted)] mb-3">
            Select specialist on voice channel
          </p>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {agents.slice(0, 8).map((agent) => {
              const selected = agent.id === activeAgent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    setActiveAgentId(agent.id);
                    setStatusNote(`Voice channel switched to ${agent.name} (${agent.buildingName}).`);
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
                >
                  <div
                    className={`h-12 w-12 rounded-full overflow-hidden border-2 transition-colors ${
                      selected
                        ? 'border-[var(--nx-accent)]'
                        : 'border-[var(--nx-border-strong)] group-hover:border-[var(--nx-text-muted)]'
                    }`}
                  >
                    <img
                      src={agent.avatarUrl}
                      alt={agent.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  <span
                    className={`text-[11px] font-medium whitespace-nowrap ${
                      selected ? 'text-[var(--nx-accent)]' : 'text-[var(--nx-text-muted)]'
                    }`}
                  >
                    {agent.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right Column: TTS Engine Selection + Live Spoken Transcript */}
      <section className="lg:col-span-5 flex flex-col gap-5">
        <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5">
          <h2 className="font-editorial text-xl text-[var(--nx-text)]">
            Speech <span className="italic text-[var(--nx-accent)]">Engine.</span>
          </h2>
          <p className="text-xs text-[var(--nx-text-muted)] mt-1">
            Route spoken output through local VoiceStudio (:3900), Piper, Kokoro, or ElevenLabs.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {VOICE_ENGINES.map((eng) => {
              const active = settings.voiceEngine === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => onUpdateSettings({ voiceEngine: eng.id })}
                  className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)]'
                      : 'border-[var(--nx-border)] bg-[var(--nx-surface)] hover:border-[var(--nx-border-strong)]'
                  }`}
                >
                  <div className="text-xs font-semibold text-[var(--nx-text)]">{eng.label}</div>
                  <div className="text-[11px] text-[var(--nx-text-muted)] mt-0.5">{eng.meta}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Transcript + Fallback Voice Prompt Input */}
        <div className="flex-1 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5 flex flex-col">
          <h2 className="font-editorial text-xl text-[var(--nx-text)]">
            Live <span className="italic text-[var(--nx-accent)]">Transcript.</span>
          </h2>

          <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[290px] pr-1">
            {turns.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg p-3 border text-xs leading-relaxed ${
                  t.speaker === 'operator'
                    ? 'border-[var(--nx-accent)]/35 bg-[var(--nx-accent-soft)]'
                    : 'border-[var(--nx-border)] bg-[var(--nx-surface)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--nx-text-muted)] mb-1">
                  <span className="font-semibold text-[var(--nx-text)]">{t.agentName}</span>
                  <span>
                    {t.engine} · {t.timestamp}
                  </span>
                </div>
                <p className="text-[var(--nx-text)]">{t.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--nx-border)]">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_VOICE_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleVoicePrompt(q)}
                  className="rounded-md border border-[var(--nx-border)] bg-[var(--nx-surface)] px-2.5 py-1 text-[11px] text-[var(--nx-text-muted)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-text)] transition-colors cursor-pointer text-left"
                >
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
              <label htmlFor="voice-text-fallback" className="sr-only">
                Speak or type prompt to {activeAgent.name}
              </label>
              <input
                id="voice-text-fallback"
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={`Speak or type to ${activeAgent.name}...`}
                className="flex-1 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send spoken prompt"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
