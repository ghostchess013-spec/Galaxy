import { useRef, useState } from 'react';
import { Paperclip, Send, Trash2, X } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type { Agent, ChatMessage } from '../../types/nexora';

interface ChatViewProps {
  agents: Agent[];
  activeAgentId: string;
  onSelectAgent: (id: string) => void;
  chats: Record<string, ChatMessage[]>;
  sendingAgentId?: string | null;
  onSendMessage: (agentId: string, content: string, attachmentName?: string) => void;
  onClearThread: (agentId: string) => void;
}

export default function ChatView({
  agents,
  activeAgentId,
  onSelectAgent,
  chats,
  sendingAgentId,
  onSendMessage,
  onClearThread,
}: ChatViewProps) {
  const { t, statusLabel, agentDisplay, chatMessageDisplay } = useI18n();
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];
  const activeDisp = agentDisplay(activeAgent);
  const thread = chats[activeAgent.id] ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(activeAgent.id, draft, attachment ?? undefined);
    setDraft('');
    setAttachment(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-[calc(100vh-5.5rem)] lg:min-h-[600px]">
      {/* Left Agent Thread Selector */}
      <aside className="lg:col-span-4 xl:col-span-3 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] flex flex-col overflow-hidden max-h-[280px] lg:max-h-none">
        <div className="px-4 py-4 border-b border-[var(--nx-border)]">
          <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
            {t('chatEyebrow')}
          </p>
          <h1 className="font-editorial text-2xl mt-0.5 text-[var(--nx-text)]">
            {t('chatTitlePrefix')}{' '}
            <span className="italic text-[var(--nx-accent)]">{t('chatTitleAccent')}</span>
          </h1>
          <p className="text-xs text-[var(--nx-text-muted)] mt-0.5">
            {t('chatAgentsCount', { count: agents.length })}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--nx-border)]">
          {agents.map((agent) => {
            const active = agent.id === activeAgent.id;
            const count = chats[agent.id]?.length ?? 0;
            const disp = agentDisplay(agent);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--nx-accent-soft)]'
                    : 'hover:bg-[var(--nx-surface-hover)]/60'
                }`}
              >
                <img
                  src={agent.avatarUrl}
                  alt={agent.name}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover object-top border border-[var(--nx-border-strong)] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold truncate ${
                        active ? 'text-[var(--nx-accent)]' : 'text-[var(--nx-text)]'
                      }`}
                    >
                      {agent.name}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--nx-text-subtle)] tabular-nums">
                      {count} {t('commonMsgShort')}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--nx-text-muted)] truncate">
                    {disp.workstation} · {statusLabel(agent.status)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Active Conversation Stream */}
      <section className="lg:col-span-8 xl:col-span-9 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] flex flex-col overflow-hidden min-h-[520px] lg:min-h-0">
        <div className="px-5 py-3.5 border-b border-[var(--nx-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={activeAgent.avatarUrl}
              alt={activeAgent.name}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-full object-cover object-top border border-[var(--nx-border-strong)] shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--nx-text)] truncate">
                  {activeAgent.name} — {activeDisp.workstation}
                </h2>
                <span className="text-xs text-[var(--nx-text-muted)]">·</span>
                <span className="font-mono text-[11px] text-[var(--nx-text-muted)]">
                  {activeAgent.model}
                </span>
              </div>
              <p className="text-xs text-[var(--nx-text-subtle)] truncate">
                {activeDisp.role} · {t('commonProfile')}: {activeAgent.profileKey}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClearThread(activeAgent.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--nx-text-muted)] hover:text-[var(--nx-alert)] hover:border-[var(--nx-alert)]/40 whitespace-nowrap cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t('chatForgetThread')}</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {thread.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
              <img
                src={activeAgent.avatarUrl}
                alt={activeAgent.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full object-cover object-top border border-[var(--nx-border-strong)] mb-4"
              />
              <h3 className="font-editorial text-2xl text-[var(--nx-text)]">
                {t('chatEmptyTitle')}{' '}
                <span className="italic text-[var(--nx-accent)]">{activeAgent.name}.</span>
              </h3>
              <p className="mt-2 text-xs text-[var(--nx-text-muted)] leading-relaxed">
                {activeDisp.soul}
              </p>
            </div>
          ) : (
            thread.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'operator' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed border ${
                    msg.sender === 'operator'
                      ? 'bg-[var(--nx-accent)] text-[var(--nx-accent-fg)] border-transparent'
                      : 'bg-[var(--nx-surface)] text-[var(--nx-text)] border-[var(--nx-border)]'
                  }`}
                >
                  {msg.attachmentName && (
                    <p className="text-[11px] font-mono opacity-85 mb-1.5">
                      {t('commonAttachment')}: {msg.attachmentName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{chatMessageDisplay(msg.id, msg.content)}</p>

                  {msg.toolTrace && msg.toolTrace.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[var(--nx-border)] text-[11px] font-mono text-[var(--nx-text-muted)]">
                      {t('commonTools')}: {msg.toolTrace.join(' · ')}
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[10px] font-mono text-[var(--nx-text-subtle)]">
                  {msg.sender === 'operator' ? t('operatorRole') : activeAgent.name} ·{' '}
                  {msg.timestamp}
                  {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ''}
                </span>
              </div>
            ))
          )}

          {sendingAgentId === activeAgent.id && (
            <div className="flex flex-col items-start">
              <div className="rounded-xl px-4 py-3 text-xs font-mono border border-[var(--nx-border)] bg-[var(--nx-surface)] text-[var(--nx-text-muted)]">
                {t('chatRoutingNotice')}
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={handleSubmit} className="border-t border-[var(--nx-border)] p-4">
          {attachment && (
            <div className="mb-2 flex items-center justify-between rounded-md border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-1.5 text-xs text-[var(--nx-text-muted)]">
              <span className="font-mono truncate">
                {t('commonAttached')}: {attachment}
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label={t('commonRemoveAttachment')}
                className="p-0.5 hover:text-[var(--nx-text)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAttachment(f.name);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t('commonAttachFile')}
              className="rounded-lg border border-[var(--nx-border-strong)] p-2.5 text-[var(--nx-text-muted)] hover:bg-[var(--nx-surface-hover)] hover:text-[var(--nx-text)] cursor-pointer"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <label htmlFor="chat-message-input" className="sr-only">
              {t('chatInputAria', { name: activeAgent.name })}
            </label>
            <input
              id="chat-message-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('chatInputPlaceholder', {
                name: activeAgent.name,
                profile: activeAgent.profileKey,
              })}
              className="flex-1 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2.5 text-sm text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{t('commonSend')}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
