import React, { useState } from 'react';
import {
  X,
  Plus,
  Copy,
  Trash2,
  FolderOpen,
  Check,
  Pencil,
} from 'lucide-react';
import { WhiteboardProject } from '../types/whiteboard';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: WhiteboardProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, title: string) => void;
}

function formatDate(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  if (!isOpen) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="projects-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Whiteboard Projects
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Auto-saved locally on your device · {projects.length}{' '}
              {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onCreateProject();
                onClose();
              }}
              className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Whiteboard
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Project Grid */}
        <div className="p-5 overflow-y-auto thin-scrollbar flex-1">
          {projects.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">
                No saved whiteboards yet
              </p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Create a new whiteboard to begin drawing and writing.
              </p>
              <button
                type="button"
                onClick={() => {
                  onCreateProject();
                  onClose();
                }}
                className="h-9 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold"
              >
                Create Whiteboard
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => {
                const isActive = proj.id === activeProjectId;
                const isRenaming = renamingId === proj.id;

                return (
                  <div
                    key={proj.id}
                    className={`group rounded-xl border overflow-hidden flex flex-col transition-all ${
                      isActive
                        ? 'border-blue-600 ring-2 ring-blue-600/15 bg-white'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {/* Thumbnail Preview */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(proj.id);
                        onClose();
                      }}
                      className="relative h-36 w-full overflow-hidden border-b border-slate-100 flex items-center justify-center text-left"
                      style={{ backgroundColor: proj.backgroundColor }}
                    >
                      {proj.thumbnail ? (
                        <img
                          src={proj.thumbnail}
                          alt={proj.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">
                          {proj.objects.length === 0
                            ? 'Empty canvas'
                            : `${proj.objects.length} items`}
                        </span>
                      )}
                    </button>

                    {/* Details & Actions */}
                    <div className="p-3 flex flex-col gap-2">
                      {isRenaming ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const t = renameDraft.trim();
                                if (t) onRenameProject(proj.id, t);
                                setRenamingId(null);
                              } else if (e.key === 'Escape') {
                                setRenamingId(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 min-w-0 text-xs font-medium px-2 py-1 rounded-md border border-blue-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const t = renameDraft.trim();
                              if (t) onRenameProject(proj.id, t);
                              setRenamingId(null);
                            }}
                            className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProject(proj.id);
                              onClose();
                            }}
                            className="text-left min-w-0 flex-1"
                          >
                            <div className="font-display text-sm font-semibold text-slate-900 truncate">
                              {proj.title}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <span>{formatDate(proj.updatedAt)}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">
                                {proj.objects.length}{' '}
                                {proj.objects.length === 1 ? 'item' : 'items'}
                              </span>
                              {isActive && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-blue-600 font-medium">
                                    Active
                                  </span>
                                </>
                              )}
                            </div>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProject(proj.id);
                            onClose();
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          {isActive ? 'Continue' : 'Open Board'}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(proj.id);
                              setRenameDraft(proj.title);
                            }}
                            title="Rename project"
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateProject(proj.id)}
                            title="Duplicate project"
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {projects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeleteProject(proj.id)}
                              title="Delete project"
                              className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
