import { useState } from 'react';
import { FileCode2, RefreshCw, RotateCcw, Save } from 'lucide-react';
import type { BridgeConnectionStatus, WorkspaceFile } from '../../types/nexora';

interface FilesViewProps {
  files: WorkspaceFile[];
  selectedFileId: string | null;
  bridgeStatus: BridgeConnectionStatus;
  onSelectFile: (id: string) => void;
  onSaveFile: (fileId: string, content: string) => void | Promise<void>;
  onSyncLiveFiles?: () => Promise<void>;
}

export default function FilesView({
  files,
  selectedFileId,
  bridgeStatus,
  onSelectFile,
  onSaveFile,
  onSyncLiveFiles,
}: FilesViewProps) {
  const activeFile = files.find((f) => f.id === selectedFileId) ?? files[0];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState('');
  const [syncing, setSyncing] = useState(false);

  const currentValue = drafts[activeFile.id] ?? activeFile.content;
  const isDirty = currentValue !== activeFile.content;

  const handleSave = async () => {
    await onSaveFile(activeFile.id, currentValue);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activeFile.id];
      return next;
    });
    setSavedNotice(
      bridgeStatus === 'live'
        ? `Saved ${activeFile.path} on hermesagent`
        : `Saved ${activeFile.path}`,
    );
    window.setTimeout(() => setSavedNotice(''), 2800);
  };

  const handleSync = async () => {
    if (!onSyncLiveFiles) return;
    setSyncing(true);
    try {
      await onSyncLiveFiles();
      setSavedNotice('Synced ~/.hermes/ from hermesagent');
      window.setTimeout(() => setSavedNotice(''), 2400);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nx-border)] pb-5">
        <div>
          <p className="text-[11px] tracking-[0.14em] uppercase text-[var(--nx-text-muted)]">
            Manage / Files · {bridgeStatus === 'live' ? 'Live hermesagent' : 'Local Workspace'}
          </p>
          <h1 className="font-editorial text-4xl leading-tight mt-1 text-[var(--nx-text)]">
            Their <span className="italic text-[var(--nx-accent)]">files.</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--nx-text-muted)]">
            Inspect and edit SOUL.md, USER.md, OPERATING_RULES.md, and Hermes config files directly.
          </p>
        </div>

        {bridgeStatus === 'live' && onSyncLiveFiles && (
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSync()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3.5 py-1.5 text-xs font-medium text-[var(--nx-text)] hover:bg-[var(--nx-surface-hover)] disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync from hermesagent'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[540px]">
        <aside className="lg:col-span-4 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-4 space-y-2">
          <p className="text-[11px] font-mono text-[var(--nx-text-muted)] px-2 pb-1">
            ~/.hermes/
          </p>
          {files.map((file) => {
            const active = file.id === activeFile.id;
            const dirty = drafts[file.id] !== undefined && drafts[file.id] !== file.content;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => onSelectFile(file.id)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)]'
                    : 'border-[var(--nx-border)] bg-[var(--nx-surface)] hover:border-[var(--nx-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-3.5 w-3.5 text-[var(--nx-accent)] shrink-0" />
                  <span className="font-mono text-xs font-medium text-[var(--nx-text)] truncate">
                    {file.path.replace('~/.hermes/', '')}
                  </span>
                  {dirty && (
                    <span className="ml-auto text-[10px] font-mono text-[var(--nx-accent)]">
                      modified
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[var(--nx-text-subtle)]">{file.updatedAt}</p>
              </button>
            );
          })}
        </aside>

        <section className="lg:col-span-8 rounded-xl border border-[var(--nx-border)] bg-[var(--nx-bg-elevated)] p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--nx-border)] pb-3.5">
            <div>
              <p className="font-mono text-xs font-semibold text-[var(--nx-text)]">
                {activeFile.path}
              </p>
              <p className="text-[11px] text-[var(--nx-text-muted)] mt-0.5">
                {activeFile.language} · Updated {activeFile.updatedAt}
                {savedNotice ? ` · ${savedNotice}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isDirty && (
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((prev) => {
                      const next = { ...prev };
                      delete next[activeFile.id];
                      return next;
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nx-border-strong)] px-3 py-1.5 text-xs text-[var(--nx-text-muted)] hover:text-[var(--nx-text)] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Revert</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--nx-accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--nx-accent-fg)] hover:bg-[var(--nx-accent-hover)] disabled:opacity-45 whitespace-nowrap cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save File</span>
              </button>
            </div>
          </div>

          <label htmlFor="workspace-file-editor" className="sr-only">
            Edit {activeFile.path}
          </label>
          <textarea
            id="workspace-file-editor"
            value={currentValue}
            onChange={(e) =>
              setDrafts((prev) => ({
                ...prev,
                [activeFile.id]: e.target.value,
              }))
            }
            className="mt-4 flex-1 w-full min-h-[400px] rounded-lg border border-[var(--nx-border-strong)] bg-[var(--nx-surface)] p-4 font-mono text-xs leading-relaxed text-[var(--nx-text)] focus:border-[var(--nx-accent)] focus:outline-none"
          />
        </section>
      </div>
    </div>
  );
}
