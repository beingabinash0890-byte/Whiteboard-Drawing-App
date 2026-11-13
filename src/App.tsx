import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BackgroundPattern,
  PaperOrientation,
  PaperSize,
  ToolSettings,
  ToolType,
  ViewportState,
  WhiteboardObject,
  WhiteboardProject,
} from './types/whiteboard';
import {
  createBlankProject,
  createId,
  deleteProjectById,
  getActiveProjectId,
  loadAllProjects,
  saveProjectSnapshot,
  setActiveProjectId,
} from './utils/storage';
import { getCombinedWorldAABB, normalizeAngle } from './utils/geometry';
import { TopBar } from './components/TopBar';
import { ToolDock } from './components/ToolDock';
import { PropertiesBar } from './components/PropertiesBar';
import { ZoomAndBgBar } from './components/ZoomAndBgBar';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { ProjectsModal } from './components/ProjectsModal';
import { ExportPrintModal } from './components/ExportPrintModal';
import { ConfirmModal } from './components/ConfirmModal';
import { RewardedAdModal } from './components/RewardedAdModal';
import {
  ADMOB_REWARDED_TEST_AD_UNIT_ID,
  grantRewardUnlock,
  hasNativeAndroidAdsBridge,
  isRewardUnlocked,
  showNativeAndroidRewardedAd,
} from './utils/rewardedAds';

const DEFAULT_SETTINGS: ToolSettings = {
  pencilStyle: 'pen',
  pencilSize: 4,
  pencilColor: '#0F172A',
  pencilOpacity: 1,
  eraserMode: 'precision',
  eraserSize: 24,
  shapeType: 'rectangle',
  shapeStrokeColor: '#0F172A',
  shapeFillColor: 'transparent',
  shapeStrokeWidth: 3,
  shapeStrokeStyle: 'solid',
  textColor: '#0F172A',
  textBgColor: 'transparent',
  textFontSize: 24,
  textFontFamily: 'Plus Jakarta Sans',
  textBold: false,
  textItalic: false,
  textUnderline: false,
  textAlign: 'left',
  keepAspectRatio: false,
};

function initProjectState(): {
  projects: WhiteboardProject[];
  active: WhiteboardProject;
} {
  const existing = loadAllProjects();
  const activeId = getActiveProjectId();
  if (existing.length > 0) {
    const found = existing.find((p) => p.id === activeId) ?? existing[0];
    return { projects: existing, active: found };
  }
  const fresh = createBlankProject('Untitled Whiteboard', '#FFFFFF', 'dots');
  const saved = saveProjectSnapshot(fresh);
  return { projects: saved, active: fresh };
}

export default function App() {
  const initial = useRef(initProjectState());

  const [projects, setProjects] = useState<WhiteboardProject[]>(
    initial.current.projects
  );
  const [project, setProject] = useState<WhiteboardProject>(
    initial.current.active
  );
  const [objects, setObjects] = useState<WhiteboardObject[]>(
    initial.current.active.objects
  );

  // Undo / Redo Stacks
  const [past, setPast] = useState<WhiteboardObject[][]>([]);
  const [future, setFuture] = useState<WhiteboardObject[][]>([]);

  const [activeTool, setActiveTool] = useState<ToolType>('pencil');
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_SETTINGS);
  const [viewport, setViewport] = useState<ViewportState>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  // Modals & UI drawers
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Rewarded Test Ad State
  const [rewardUnlocked, setRewardUnlocked] = useState<boolean>(() =>
    isRewardUnlocked()
  );
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const pendingRewardCallbackRef = useRef<(() => void) | null>(null);

  const handleWatchRewardedAd = useCallback(async (onGranted: () => void) => {
    if (hasNativeAndroidAdsBridge()) {
      const result = await showNativeAndroidRewardedAd(
        ADMOB_REWARDED_TEST_AD_UNIT_ID
      );
      if (result.rewarded) {
        grantRewardUnlock();
        setRewardUnlocked(true);
        onGranted();
      }
      return;
    }

    pendingRewardCallbackRef.current = onGranted;
    setRewardModalOpen(true);
  }, []);

  // Print sheet state
  const [printSheet, setPrintSheet] = useState<{
    url: string;
    paperSize: PaperSize;
    orientation: PaperOrientation;
  } | null>(null);

  // Auto-save debounce whenever objects, title, or background changes
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    setSaveState('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const updatedProj: WhiteboardProject = {
        ...project,
        objects,
        updatedAt: Date.now(),
      };
      const all = saveProjectSnapshot(updatedProj);
      setProjects(all);
      setSaveState('saved');
    }, 380);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [objects, project]);

  // Commit objects with Undo history entry
  const commitObjects = useCallback(
    (nextObjects: WhiteboardObject[]) => {
      setPast((prev) => [...prev.slice(-60), objects]);
      setFuture([]);
      setObjects(nextObjects);
    },
    [objects]
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [objects, ...f]);
    setObjects(prev);
    setSelectedIds([]);
  }, [past, objects]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, objects]);
    setObjects(next);
    setSelectedIds([]);
  }, [future, objects]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const next = objects.filter((o) => !selectedIds.includes(o.id));
    commitObjects(next);
    setSelectedIds([]);
  }, [selectedIds, objects, commitObjects]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const clones = objects
      .filter((o) => selectedIds.includes(o.id))
      .map((o) => ({
        ...structuredClone(o),
        id: createId(o.type),
        x: o.x + 24,
        y: o.y + 24,
      }));
    commitObjects([...objects, ...clones]);
    setSelectedIds(clones.map((c) => c.id));
  }, [selectedIds, objects, commitObjects]);

  const handleUpdateSelectedObjects = useCallback(
    (patch: Partial<WhiteboardObject>) => {
      if (selectedIds.length === 0) return;
      const next = objects.map((o) =>
        selectedIds.includes(o.id)
          ? ({ ...o, ...patch } as WhiteboardObject)
          : o
      );
      commitObjects(next);
    },
    [selectedIds, objects, commitObjects]
  );

  const handleLayerChange = useCallback(
    (dir: 'front' | 'back') => {
      if (selectedIds.length === 0) return;
      const sel = objects.filter((o) => selectedIds.includes(o.id));
      const rest = objects.filter((o) => !selectedIds.includes(o.id));
      const next = dir === 'front' ? [...rest, ...sel] : [...sel, ...rest];
      commitObjects(next);
    },
    [selectedIds, objects, commitObjects]
  );

  const handleRotateSelected = useCallback(
    (deltaDeg: number, reset = false) => {
      if (selectedIds.length === 0) return;
      const next = objects.map((o) =>
        selectedIds.includes(o.id)
          ? {
              ...o,
              rotation: reset ? 0 : normalizeAngle(o.rotation + deltaDeg),
            }
          : o
      );
      commitObjects(next);
    },
    [selectedIds, objects, commitObjects]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (isTyping) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (isTyping) return;
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (isTyping) return;
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      if (isTyping) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'v') setActiveTool('select');
      else if (k === 'h') setActiveTool('pan');
      else if (k === 'p') setActiveTool('pencil');
      else if (k === 'e') setActiveTool('eraser');
      else if (k === 't') setActiveTool('text');
      else if (k === 's') setActiveTool('shape');
      else if (k === '=' || k === '+') {
        setViewport((vp) => ({
          ...vp,
          zoom: Math.min(4, Math.round((vp.zoom + 0.15) * 100) / 100),
        }));
      } else if (k === '-') {
        setViewport((vp) => ({
          ...vp,
          zoom: Math.max(0.15, Math.round((vp.zoom - 0.15) * 100) / 100),
        }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleDuplicateSelected,
    selectedIds.length,
  ]);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback if iframe disallows browser fullscreen
      setIsFullscreen((v) => !v);
    }
  };

  // Zoom Helpers (zoom centered on viewport center)
  const zoomCentered = (newZoom: number) => {
    const clamped = Math.max(0.15, Math.min(4, newZoom));
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const wx = (cx - viewport.panX) / viewport.zoom;
    const wy = (cy - viewport.panY) / viewport.zoom;
    setViewport({
      zoom: clamped,
      panX: cx - wx * clamped,
      panY: cy - wy * clamped,
    });
  };

  const handleFitToContent = () => {
    const bounds = getCombinedWorldAABB(objects);
    if (!bounds) {
      setViewport({ panX: 0, panY: 0, zoom: 1 });
      return;
    }
    const pad = 90;
    const availW = Math.max(200, window.innerWidth - pad * 2);
    const availH = Math.max(200, window.innerHeight - pad * 2);
    const zoom = Math.max(
      0.15,
      Math.min(2, Math.min(availW / bounds.width, availH / bounds.height))
    );
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    setViewport({
      zoom,
      panX: window.innerWidth / 2 - cx * zoom,
      panY: window.innerHeight / 2 - cy * zoom,
    });
  };

  // Project Management Handlers
  const switchToProject = (proj: WhiteboardProject) => {
    setProject(proj);
    setObjects(proj.objects);
    setPast([]);
    setFuture([]);
    setSelectedIds([]);
    setViewport({ panX: 0, panY: 0, zoom: 1 });
    setActiveProjectId(proj.id);
  };

  const handleCreateNewProject = () => {
    const count = projects.length + 1;
    const fresh = createBlankProject(
      `Whiteboard ${count}`,
      '#FFFFFF',
      'dots'
    );
    const all = saveProjectSnapshot(fresh);
    setProjects(all);
    switchToProject(fresh);
  };

  const handleSelectProjectById = (id: string) => {
    const found = projects.find((p) => p.id === id);
    if (found) switchToProject(found);
  };

  const handleDuplicateProject = (id: string) => {
    const src = projects.find((p) => p.id === id);
    if (!src) return;
    const copy: WhiteboardProject = {
      ...structuredClone(src),
      id: createId('proj'),
      title: `${src.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const all = saveProjectSnapshot(copy);
    setProjects(all);
  };

  const handleDeleteProject = (id: string) => {
    const remaining = deleteProjectById(id);
    setProjects(remaining);
    if (id === project.id && remaining.length > 0) {
      switchToProject(remaining[0]);
    }
  };

  const handleRenameProject = (id: string, title: string) => {
    if (id === project.id) {
      setProject((p) => ({ ...p, title }));
    } else {
      const target = projects.find((p) => p.id === id);
      if (target) {
        const all = saveProjectSnapshot({
          ...target,
          title,
          updatedAt: Date.now(),
        });
        setProjects(all);
      }
    }
  };

  // Trigger print once printSheet image finishes loading
  const handlePrintSheetReady = (
    url: string,
    paperSize: PaperSize,
    orientation: PaperOrientation
  ) => {
    setPrintSheet({ url, paperSize, orientation });
  };

  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 select-none">
      {/* Top Bar */}
      <TopBar
        title={project.title}
        onRename={(newTitle) =>
          setProject((p) => ({ ...p, title: newTitle }))
        }
        saveState={saveState}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenProjects={() => setProjectsModalOpen(true)}
        onNewProject={handleCreateNewProject}
        onOpenExport={() => setExportModalOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Main Full-Viewport Interactive Canvas */}
      <main className="no-print w-full h-full pt-[52px]">
        <WhiteboardCanvas
          objects={objects}
          backgroundColor={project.backgroundColor}
          backgroundPattern={project.backgroundPattern}
          activeTool={activeTool}
          settings={settings}
          viewport={viewport}
          selectedIds={selectedIds}
          onChangeViewport={setViewport}
          onChangeSelectedIds={setSelectedIds}
          onCommitObjects={commitObjects}
          onLiveObjectsChange={setObjects}
          onSwitchTool={setActiveTool}
        />
      </main>

      {/* Primary Drawing Tool Dock (Desktop left / Mobile bottom thumb zone) */}
      <ToolDock
        activeTool={activeTool}
        onSelectTool={(t) => {
          setActiveTool(t);
          if (t !== 'select') setSelectedIds([]);
        }}
        mobileOptionsOpen={mobileOptionsOpen}
        onToggleMobileOptions={() => setMobileOptionsOpen((v) => !v)}
      />

      {/* Contextual Tool & Selection Properties Bar */}
      <PropertiesBar
        activeTool={activeTool}
        settings={settings}
        onUpdateSettings={(patch) =>
          setSettings((s) => ({ ...s, ...patch }))
        }
        selectedObjects={selectedObjects}
        onUpdateSelectedObjects={handleUpdateSelectedObjects}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onLayerChange={handleLayerChange}
        onRotateSelected={handleRotateSelected}
        onRequestClearBoard={() => setClearConfirmOpen(true)}
        mobileOpen={mobileOptionsOpen}
        onCloseMobile={() => setMobileOptionsOpen(false)}
      />

      {/* Zoom, Fit & Canvas Background Bar */}
      <ZoomAndBgBar
        zoom={viewport.zoom}
        onZoomIn={() => zoomCentered(viewport.zoom + 0.2)}
        onZoomOut={() => zoomCentered(viewport.zoom - 0.2)}
        onResetZoom={() => zoomCentered(1)}
        onFitToContent={handleFitToContent}
        backgroundColor={project.backgroundColor}
        backgroundPattern={project.backgroundPattern}
        onChangeBackground={(backgroundColor, backgroundPattern: BackgroundPattern) =>
          setProject((p) => ({ ...p, backgroundColor, backgroundPattern }))
        }
      />

      {/* Saved Projects Modal */}
      <ProjectsModal
        isOpen={projectsModalOpen}
        onClose={() => setProjectsModalOpen(false)}
        projects={projects}
        activeProjectId={project.id}
        onSelectProject={handleSelectProjectById}
        onCreateProject={handleCreateNewProject}
        onDuplicateProject={handleDuplicateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
      />

      {/* Export, Share & Print Modal */}
      <ExportPrintModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={project.title}
        objects={objects}
        backgroundColor={project.backgroundColor}
        backgroundPattern={project.backgroundPattern}
        fallbackViewport={{
          width: window.innerWidth,
          height: window.innerHeight,
          viewport,
        }}
        onPrintSheetReady={handlePrintSheetReady}
        rewardUnlocked={rewardUnlocked}
        onWatchRewardedAd={handleWatchRewardedAd}
      />

      {/* AdMob Rewarded Test Ad Player Modal */}
      <RewardedAdModal
        isOpen={rewardModalOpen}
        rewardLabel="4K Ultra-HD PNG Export (24h)"
        onComplete={(result) => {
          setRewardModalOpen(false);
          if (result.rewarded) {
            grantRewardUnlock();
            setRewardUnlocked(true);
            pendingRewardCallbackRef.current?.();
          }
          pendingRewardCallbackRef.current = null;
        }}
        onCancel={() => {
          setRewardModalOpen(false);
          pendingRewardCallbackRef.current = null;
        }}
      />

      {/* Clear Board Confirmation Dialog */}
      <ConfirmModal
        isOpen={clearConfirmOpen}
        title="Clear entire whiteboard?"
        message="All drawings, shapes, and text on this whiteboard will be removed. You can still Undo right after clearing."
        confirmLabel="Clear Board"
        onConfirm={() => {
          commitObjects([]);
          setSelectedIds([]);
          setClearConfirmOpen(false);
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />

      {/* Hidden Print Sheet rendered only during window.print() */}
      {printSheet && (
        <div className="hidden print-only-sheet">
          <style>{`@media print { @page { size: ${printSheet.paperSize} ${
            printSheet.orientation === 'auto' ? '' : printSheet.orientation
          }; margin: 8mm; } }`}</style>
          <img
            src={printSheet.url}
            alt={project.title}
            onLoad={() => {
              window.print();
              setTimeout(() => setPrintSheet(null), 500);
            }}
          />
        </div>
      )}
    </div>
  );
}
