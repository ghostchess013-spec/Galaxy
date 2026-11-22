import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, UserPlus, Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type { Agent, OperatorSettings } from '../../types/nexora';
import { generateAgentReply } from '../../utils/nexoraLogic';

interface VoiceTurn {
  id: string;
  speaker: 'operator' | 'agent';
  agentName: string;
  text: string;
  engine: string;
  timestamp: string;
  isInit?: boolean;
}

interface VoiceModeViewProps {
  agents: Agent[];
  settings: OperatorSettings;
  bridgeStatus: 'demo' | 'connecting' | 'live' | 'error';
  onUpdateSettings: (patch: Partial<OperatorSettings>) => void;
  onOpenAddAgent: () => void;
  onLiveVoiceExchange?: (
    agent: Agent,
    promptText: string,
  ) => Promise<{ replyText: string; audioBlob?: Blob; engineLabel: string }>;
}

export default function VoiceModeView({
  agents,
  settings,
  bridgeStatus,
  onUpdateSettings,
  onOpenAddAgent,
  onLiveVoiceExchange,
}: VoiceModeViewProps) {
  const { lang, t, agentDisplay } = useI18n();
  const [activeAgentId, setActiveAgentId] = useState<string>(agents[0]?.id ?? '');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualText, setManualText] = useState('');
  const [customStatusNote, setCustomStatusNote] = useState<string | null>(null);
  const [turns, setTurns] = useState<VoiceTurn[]>([
    {
      id: 'vt-init',
      speaker: 'agent',
      agentName: agents[0]?.name ?? 'GALAXY',
      text: '',
      engine: 'Edge TTS',
      timestamp: '',
      isInit: true,
    },
  ]);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];
  const activeDisp = activeAgent ? agentDisplay(activeAgent) : null;

  const edgeVoices: Array<{
    id: string;
    label: string;
    meta: string;
    langTag: string;
  }> = [
    { id: 'id-ID-GadisNeural', label: 'Gadis Neural (ID)', meta: t('voiceEdgeGadisMeta'), langTag: 'id-ID' },
    { id: 'id-ID-ArdiNeural', label: 'Ardi Neural (ID)', meta: t('voiceEdgeArdiMeta'), langTag: 'id-ID' },
    { id: 'en-US-AriaNeural', label: 'Aria Neural (EN)', meta: t('voiceEdgeAriaMeta'), langTag: 'en-US' },
    { id: 'en-US-GuyNeural', label: 'Guy Neural (EN)', meta: t('voiceEdgeGuyMeta'), langTag: 'en-US' },
  ];
  const selectedVoiceId = settings.edgeVoiceId || 'id-ID-GadisNeural';
  const selectedVoiceMeta = edgeVoices.find((v) => v.id === selectedVoiceId) ?? edgeVoices[0];

  const quickVoicePrompts = [
    t('voiceQuickPrompt1'),
    t('voiceQuickPrompt2'),
    t('voiceQuickPrompt3'),
  ];

  useEffect(() => {
    setCustomStatusNote(null);
  }, [lang]);

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
      utter.lang = selectedVoiceMeta?.langTag ?? (lang === 'id' ? 'id-ID' : 'en-US');
      utter.rate = 1.0;
      utter.pitch = activeAgent?.isHQ ? 0.94 : 1.0;
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
    if (!clean || busy || !activeAgent) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const defaultEngineLabel = `Edge TTS · ${selectedVoiceMeta.label}`;

    setTurns((prev) => [
      ...prev,
      {
        id: `vt-u-${Date.now()}`,
        speaker: 'operator',
        agentName: settings.operatorName,
        text: clean,
        engine: t('voiceEngineMic'),
        timestamp: now,
      },
    ]);

    if (bridgeStatus === 'live' && onLiveVoiceExchange) {
      setBusy(true);
      setCustomStatusNote(t('voiceStatusRouting', { name: activeAgent.name }));
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
        setCustomStatusNote(
          t('voiceStatusResponded', { name: activeAgent.name, engine: res.engineLabel }),
        );
        speakOutLoud(res.replyText, res.audioBlob);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setCustomStatusNote(t('voiceStatusLiveErr', { err: errMsg }));
        setTurns((prev) => [
          ...prev,
          {
            id: `vt-err-${Date.now() + 1}`,
            speaker: 'agent',
            agentName: activeAgent.name,
            text: t('voiceLiveErrReply', { err: errMsg }),
            engine: t('voiceEngineBridgeErr'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }

    const reply = generateAgentReply(activeAgent, clean, agents, lang);
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
    setCustomStatusNote(
      t('voiceStatusResponded', { name: activeAgent.name, engine: defaultEngineLabel }),
    );
    speakOutLoud(reply.text);
  };

  const toggleMicrophone = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setCustomStatusNote(t('voiceStatusMicStopped'));
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
      setCustomStatusNote(t('voiceStatusSrUnavailable'));
      return;
    }

    try {
      const rec = new SR();
      rec.lang = lang === 'id' ? 'id-ID' : 'en-US';
      rec.interimResults = false;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) {
          void handleVoicePrompt(transcript);
        }
      };
      rec.onerror = () => {
        setListening(false);
        setCustomStatusNote(t('voiceStatusMicBlocked'));
      };
      rec.onend = () => {
        setListening(false);
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      setCustomStatusNote(t('voiceStatusListening', { name: activeAgent?.name ?? 'GALAXY' }));
    } catch {
      setListening(false);
      setCustomStatusNote(t('voiceStatusMicFailed'));
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    void handleVoicePrompt(manualText);
    setManualText('');
  };

  const statusNote = customStatusNote ?? t('voiceStatusReady');

  if (!activeAgent || !activeDisp) {
    return (
      <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-10 min-h-[460px] flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-full border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] flex items-center justify-center text-[var(--nx-accent)] mb-4">
          <Mic className="h-6 w-6" />
        </div>
        <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
          {t('voiceEyebrow')}
        </p>
        <h1 className="font-editorial text-3xl mt-1 text-[var(--nx-text)]">
          {t('voiceNoAgentsTitle')}
        </h1>
        <p className="mt-2 text-sm text-[var(--nx-text-muted)] max-w-md leading-relaxed">
          {t('voiceNoAgentsDesc')}
        </p>
        <button
          type="button"
          onClick={onOpenAddAgent}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] transition-colors cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>{t('cockpitAddAgentBtn')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
      {/* Main Voice Stage */}
      <section className="lg:col-span-7 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 flex flex-col justify-between min-h-[600px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
              {t('voiceEyebrow')}
            </p>
            <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
              {t('voiceTitlePrefix')}{' '}
              <span className="italic text-[var(--nx-accent)]">{t('voiceTitleAccent')}</span>
            </h1>
            <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">{t('voiceSubtitle')}</p>
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
            <span>{settings.autoSpeakReplies ? t('voiceAudioOn') : t('voiceAudioMuted')}</span>
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
                alt={activeAgent.name}
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-full object-cover object-top"
              />
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm font-semibold text-[var(--nx-text)]">
              {activeAgent.name} · {activeDisp.workstation}
            </p>
            <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">{statusNote}</p>
          </div>

          {/* Acoustic Waveform Bars */}
          <div className="mt-4 flex items-center justify-center gap-1 h-7" aria-hidden="true">
            {Array.from({ length: 15 }, (_, idx) => (
              <span
                key={idx}
                className={`w-1 rounded-full transition-all ${
                  listening || speaking
                    ? 'animate-voice-bar bg-[var(--nx-accent)]'
                    : 'bg-[var(--nx-border-strong)]'
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
            <span>{listening ? t('voiceStopListening') : t('voiceTalkBtn')}</span>
          </button>
        </div>

        {/* Crew Portrait Selector Carousel */}
        <div className="border-t border-[var(--nx-border)] pt-4">
          <p className="text-[11px] text-[var(--nx-text-muted)] mb-3">
            {t('voiceSelectSpecialist')}
          </p>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {agents.slice(0, 8).map((agent) => {
              const selected = agent.id === activeAgent.id;
              const disp = agentDisplay(agent);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    setActiveAgentId(agent.id);
                    setCustomStatusNote(
                      t('voiceStatusSwitched', {
                        name: agent.name,
                        workstation: disp.workstation,
                      }),
                    );
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
            {t('voiceSpeechTitlePrefix')}{' '}
            <span className="italic text-[var(--nx-accent)]">{t('voiceSpeechTitleAccent')}</span>
          </h2>
          <p className="text-xs text-[var(--nx-text-muted)] mt-1">{t('voiceSpeechDesc')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {edgeVoices.map((voiceOpt) => {
              const active = selectedVoiceId === voiceOpt.id;
              return (
                <button
                  key={voiceOpt.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ voiceEngine: 'edge-tts', edgeVoiceId: voiceOpt.id })
                  }
                  className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)]'
                      : 'border-[var(--nx-border)] bg-[var(--nx-surface)] hover:border-[var(--nx-border-strong)]'
                  }`}
                >
                  <div className="text-xs font-semibold text-[var(--nx-text)]">{voiceOpt.label}</div>
                  <div className="text-[11px] text-[var(--nx-text-muted)] mt-0.5">{voiceOpt.meta}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Transcript + Fallback Voice Prompt Input */}
        <div className="flex-1 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5 flex flex-col">
          <h2 className="font-editorial text-xl text-[var(--nx-text)]">
            {t('voiceTranscriptPrefix')}{' '}
            <span className="italic text-[var(--nx-accent)]">{t('voiceTranscriptAccent')}</span>
          </h2>

          <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[290px] pr-1">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`rounded-lg p-3 border text-xs leading-relaxed ${
                  turn.speaker === 'operator'
                    ? 'border-[var(--nx-accent)]/35 bg-[var(--nx-accent-soft)]'
                    : 'border-[var(--nx-border)] bg-[var(--nx-surface)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--nx-text-muted)] mb-1">
                  <span className="font-semibold text-[var(--nx-text)]">{turn.agentName}</span>
                  <span>
                    {turn.engine} · {turn.isInit ? t('voiceInitTime') : turn.timestamp}
                  </span>
                </div>
                <p className="text-[var(--nx-text)]">
                  {turn.isInit ? t('voiceInitGreeting') : turn.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--nx-border)]">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {quickVoicePrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void handleVoicePrompt(q)}
                  className="rounded-md border border-[var(--nx-border)] bg-[var(--nx-surface)] px-2.5 py-1 text-[11px] text-[var(--nx-text-muted)] hover:border-[var(--nx-accent)] hover:text-[var(--nx-text)] transition-colors cursor-pointer text-left"
                >
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
              <label htmlFor="voice-text-fallback" className="sr-only">
                {t('voiceInputAria', { name: activeAgent.name })}
              </label>
              <input
                id="voice-text-fallback"
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={t('voiceInputPlaceholder', { name: activeAgent.name })}
                className="flex-1 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-2 text-xs text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
              />
              <button
                type="submit"
                aria-label={t('voiceSendAria')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{t('commonSend')}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
