import { useState } from 'react';
import { Download, Edit3, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/translations';
import type { Agent, DocItem } from '../../types/nexora';

interface DocsViewProps {
  docs: DocItem[];
  agents: Agent[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  onSaveDoc: (doc: DocItem) => void;
  onCreateDoc: (title: string, category: string, content: string) => void;
  onDeleteDoc: (id: string) => void;
}

export default function DocsView({
  docs,
  agents,
  selectedDocId,
  onSelectDoc,
  onSaveDoc,
  onCreateDoc,
  onDeleteDoc,
}: DocsViewProps) {
  const { t, docDisplay } = useI18n();
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newContent, setNewContent] = useState('');

  const filtered = docs.filter((d) => {
    const disp = docDisplay(d);
    const matchesAgent = filterAgent === 'all' || d.authorAgentId === filterAgent;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      disp.title.toLowerCase().includes(q) ||
      disp.content.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q);
    return matchesAgent && matchesQuery;
  });

  const activeDoc =
    filtered.find((d) => d.id === selectedDocId) ??
    docs.find((d) => d.id === selectedDocId) ??
    filtered[0] ??
    null;

  const activeDisplay = activeDoc ? docDisplay(activeDoc) : null;

  const startEditing = (doc: DocItem) => {
    const disp = docDisplay(doc);
    setEditTitle(disp.title);
    setEditContent(disp.content);
    setEditing(true);
    setCreating(false);
  };

  const handleSaveEdit = () => {
    if (!activeDoc || !editTitle.trim()) return;
    const words = editContent.trim().split(/\s+/).filter(Boolean).length;
    onSaveDoc({
      ...activeDoc,
      title: editTitle.trim(),
      content: editContent,
      wordCount: words,
      updatedAt: t('commonJustNow'),
    });
    setEditing(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    onCreateDoc(newTitle.trim(), newCategory.trim() || t('docsCategoryDefault'), newContent);
    setNewTitle('');
    setNewCategory('');
    setNewContent('');
    setCreating(false);
  };

  const handleDownload = (doc: DocItem) => {
    const disp = docDisplay(doc);
    const blob = new Blob([disp.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${disp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nx-border)] pb-5">
        <div>
          <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
            {t('docsEyebrow')}
          </p>
          <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
            {t('docsTitlePrefix')}{' '}
            <span className="italic text-[var(--nx-accent)]">{t('docsTitleAccent')}</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">{t('docsSubtitle')}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditing(false);
            setNewCategory(t('docsCategoryDefault'));
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{t('docsNewBtn')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[540px]">
        {/* Left Document Index */}
        <aside className="lg:col-span-4 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="docs-filter-input" className="sr-only">
              {t('docsFilterAria')}
            </label>
            <input
              id="docs-filter-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('docsFilterPlaceholder')}
              className="flex-1 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-1.5 text-xs text-[var(--nx-text)] placeholder:text-[var(--nx-text-subtle)] focus:border-[var(--nx-accent)] focus:outline-none"
            />
            <label htmlFor="docs-agent-select" className="sr-only">
              {t('docsAuthorAria')}
            </label>
            <select
              id="docs-agent-select"
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-2.5 py-1.5 text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
            >
              <option value="all">{t('docsAllCrew')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[520px]">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--nx-text-subtle)]">
                {t('docsNoMatch')}
              </p>
            ) : (
              filtered.map((doc) => {
                const disp = docDisplay(doc);
                const selected = activeDoc?.id === doc.id && !creating;
                const author =
                  agents.find((a) => a.id === doc.authorAgentId)?.name ?? doc.authorAgentId;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      onSelectDoc(doc.id);
                      setEditing(false);
                      setCreating(false);
                    }}
                    className={`w-full text-left rounded-lg border p-3.5 transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)]'
                        : 'border-[var(--nx-border)] bg-[var(--nx-surface)] hover:border-[var(--nx-border-strong)]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[var(--nx-text)] leading-snug">
                      {disp.title}
                    </p>
                    <p className="mt-1.5 text-[11px] text-[var(--nx-text-muted)]">
                      {disp.category} · {author} · {doc.wordCount} {t('commonWords')}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Reader / Editor Pane */}
        <section className="lg:col-span-8 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-6 flex flex-col">
          {creating ? (
            <form onSubmit={handleCreate} className="space-y-4 flex-1 flex flex-col">
              <h2 className="font-editorial text-2xl text-[var(--nx-text)]">
                {t('docsCreatePrefix')}{' '}
                <span className="italic text-[var(--nx-accent)]">{t('docsCreateAccent')}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('docsTitlePlaceholder')}
                  className="sm:col-span-2 rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2 text-sm text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder={t('docsCategoryPlaceholder')}
                  className="rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3.5 py-2 text-sm text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                />
              </div>
              <textarea
                rows={12}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder={t('docsContentPlaceholder')}
                className="flex-1 w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] p-4 font-mono text-xs text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-lg border border-[var(--nx-border-strong)] px-4 py-2 text-xs font-medium text-[var(--nx-text-muted)] cursor-pointer"
                >
                  {t('commonCancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--nx-accent)] px-4 py-2 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] cursor-pointer"
                >
                  {t('docsFileToLibrary')}
                </button>
              </div>
            </form>
          ) : activeDoc && activeDisplay ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--nx-border)] pb-4">
                <div>
                  <p className="text-xs text-[var(--nx-text-muted)]">
                    {activeDisplay.category}
                    {activeDoc.missionCode ? ` · ${activeDoc.missionCode}` : ''} ·{' '}
                    {t('commonUpdated')} {activeDisplay.updatedAt} · {activeDoc.wordCount}{' '}
                    {t('commonWords')}
                  </p>
                  {editing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] px-3 py-1.5 font-editorial text-2xl text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                    />
                  ) : (
                    <h2 className="font-editorial text-2xl mt-1 text-[var(--nx-text)]">
                      {activeDisplay.title}
                    </h2>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--nx-text-muted)] cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{t('commonCancel')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{t('commonSave')}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEditing(activeDoc)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>{t('commonEdit')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(activeDoc)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{t('docsDownloadMd')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDoc(activeDoc.id)}
                        aria-label={t('docsDeleteAria', { title: activeDisplay.title })}
                        className="rounded-lg border border-[var(--nx-border-strong)] p-1.5 text-[var(--nx-text-muted)] hover:text-[var(--nx-alert)] hover:border-[var(--nx-alert)]/40 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-5 flex-1">
                {editing ? (
                  <textarea
                    rows={16}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[360px] rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] p-4 font-mono text-xs leading-relaxed text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
                  />
                ) : (
                  <div className="prose-sm max-w-none space-y-3 text-sm leading-relaxed text-[var(--nx-text)] whitespace-pre-wrap">
                    {activeDisplay.content}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--nx-text-muted)]">
              {t('docsEmptyPane')}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
