import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Palette,
} from 'lucide-react';
import {
  BackgroundPattern,
  CANVAS_BG_PRESETS,
} from '../types/whiteboard';

interface ZoomAndBgBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToContent: () => void;
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  onChangeBackground: (color: string, pattern: BackgroundPattern) => void;
}

const PATTERNS: { id: BackgroundPattern; label: string }[] = [
  { id: 'blank', label: 'Blank' },
  { id: 'dots', label: 'Dot Grid' },
  { id: 'grid', label: 'Square Grid' },
  { id: 'ruled', label: 'Ruled' },
  { id: 'isometric', label: 'Isometric' },
];

export const ZoomAndBgBar: React.FC<ZoomAndBgBarProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToContent,
  backgroundColor,
  backgroundPattern,
  onChangeBackground,
}) => {
  const [bgOpen, setBgOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bgOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setBgOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [bgOpen]);

  return (
    <div
      ref={popRef}
      className="no-print fixed bottom-[72px] md:bottom-4 right-3 md:right-4 z-20 flex items-center gap-2"
    >
      {/* Background Settings Popover */}
      {bgOpen && (
        <div className="absolute bottom-12 right-0 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-30">
          <div className="mb-3">
            <div className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-500" />
              Canvas Background Color
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {CANVAS_BG_PRESETS.map((preset) => {
                const active =
                  backgroundColor.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() =>
                      onChangeBackground(preset.color, backgroundPattern)
                    }
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-all text-left ${
                      active
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-medium'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
              <span>Custom Color</span>
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-[11px] text-slate-500 uppercase">
                  {backgroundColor}
                </span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) =>
                    onChangeBackground(e.target.value, backgroundPattern)
                  }
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
              </div>
            </label>
          </div>

          <div className="pt-2.5 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-slate-500" />
              Canvas Pattern
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PATTERNS.map((pat) => {
                const active = backgroundPattern === pat.id;
                return (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() =>
                      onChangeBackground(backgroundColor, pat.id)
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {pat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Background Trigger Button */}
      <button
        type="button"
        onClick={() => setBgOpen((v) => !v)}
        title="Canvas Background & Grid"
        aria-label="Canvas background and pattern"
        className={`h-10 px-3 rounded-xl border shadow-md shadow-slate-900/5 backdrop-blur-md flex items-center gap-1.5 text-xs font-medium transition-colors ${
          bgOpen
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white/95 text-slate-700 border-slate-200/90 hover:bg-white'
        }`}
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
          style={{ backgroundColor }}
        />
        <span className="hidden sm:inline">Canvas</span>
      </button>

      {/* Zoom Controls */}
      <div className="h-10 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-md shadow-slate-900/5 px-1 flex items-center gap-0.5">
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom Out (-)"
          aria-label="Zoom out"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onResetZoom}
          title="Click to reset zoom to 100%"
          className="px-2 h-8 rounded-lg hover:bg-slate-100 text-xs font-mono-tabular font-medium text-slate-800 min-w-[52px] text-center transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom In (+)"
          aria-label="Zoom in"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5 hidden sm:block" />

        <button
          type="button"
          onClick={onFitToContent}
          title="Fit all drawings to screen"
          aria-label="Fit to content"
          className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
