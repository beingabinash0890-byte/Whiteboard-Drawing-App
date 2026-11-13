import React, { useState, useRef, useEffect } from 'react';
import {
  Undo2,
  Redo2,
  FolderOpen,
  Download,
  Maximize2,
  Minimize2,
  Check,
  PencilLine,
  Plus,
} from 'lucide-react';

interface TopBarProps {
  title: string;
  onRename: (newTitle: string) => void;
  saveState: 'saved' | 'saving';
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenProjects: () => void;
  onNewProject: () => void;
  onOpenExport: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onRename,
  saveState,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenProjects,
  onNewProject,
  onOpenExport,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed);
    } else {
      setDraft(title);
    }
  };

  return (
    <header className="no-print fixed top-0 left-0 right-0 z-30 h-[52px] bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
      {/* Zone 1: Brand & Editable Board Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm"
          aria-hidden="true"
        >
          <PencilLine className="w-4 h-4" />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraft(title);
                  setEditing(false);
                }
              }}
              className="font-display font-semibold text-sm text-slate-900 bg-slate-100 border border-blue-500 rounded-md px-2 py-1 outline-none w-36 sm:w-52"
              aria-label="Whiteboard title"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Click to rename whiteboard"
              className="font-display font-semibold text-sm text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-md truncate max-w-[130px] sm:max-w-[220px] transition-colors text-left"
            >
              {title}
            </button>
          )}

          <span className="hidden lg:inline-flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap shrink-0">
            <span aria-hidden="true">·</span>
            {saveState === 'saving' ? (
              <span>Saving…</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Check className="w-3 h-3 text-emerald-600" />
                Saved
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Zone 2: Undo / Redo Cluster */}
      <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-lg border border-slate-200/70 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-xs disabled:opacity-35 disabled:pointer-events-none transition-all whitespace-nowrap shrink-0"
        >
          <Undo2 className="w-4 h-4" />
          <span className="hidden md:inline">Undo</span>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-md flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-900 hover:shadow-xs disabled:opacity-35 disabled:pointer-events-none transition-all whitespace-nowrap shrink-0"
        >
          <Redo2 className="w-4 h-4" />
          <span className="hidden md:inline">Redo</span>
        </button>
      </div>

      {/* Zone 3: Projects, New, Fullscreen, Primary Export/Print CTA */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onNewProject}
          title="New Whiteboard"
          aria-label="New Whiteboard"
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200/80 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>

        <button
          type="button"
          onClick={onOpenProjects}
          title="Saved Projects"
          aria-label="Open saved projects"
          className="inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200/80 transition-colors whitespace-nowrap shrink-0"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Projects</span>
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Drawing Mode'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200/80 transition-colors shrink-0"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          title="Export, Share & Print"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 sm:px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold shadow-sm transition-all whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden xs:inline sm:inline">Export &amp; Print</span>
          <span className="xs:hidden sm:hidden">Save</span>
        </button>
      </div>
    </header>
  );
};
