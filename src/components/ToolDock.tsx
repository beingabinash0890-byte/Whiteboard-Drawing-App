import React from 'react';
import {
  MousePointer2,
  Hand,
  Pencil,
  Eraser,
  Type,
  Shapes,
  SlidersHorizontal,
} from 'lucide-react';
import { ToolType } from '../types/whiteboard';

interface ToolDockProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  mobileOptionsOpen: boolean;
  onToggleMobileOptions: () => void;
}

const TOOLS: {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'select', label: 'Select & Move', shortcut: 'V', icon: MousePointer2 },
  { id: 'pan', label: 'Pan Canvas', shortcut: 'H', icon: Hand },
  { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: Pencil },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'shape', label: 'Shapes', shortcut: 'S', icon: Shapes },
];

export const ToolDock: React.FC<ToolDockProps> = ({
  activeTool,
  onSelectTool,
  mobileOptionsOpen,
  onToggleMobileOptions,
}) => {
  return (
    <>
      {/* Desktop & Tablet Left Floating Vertical Dock */}
      <aside
        aria-label="Drawing tools"
        className="no-print hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-20 flex-col gap-1.5 p-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-lg shadow-slate-900/5"
      >
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
              aria-label={tool.label}
              aria-pressed={active}
              className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span
                className={`pointer-events-none absolute left-full ml-2.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-40 ${
                  active ? 'hidden' : ''
                }`}
              >
                {tool.label}{' '}
                <span className="text-slate-400 font-mono-tabular ml-1">
                  {tool.shortcut}
                </span>
              </span>
            </button>
          );
        })}
      </aside>

      {/* Mobile Bottom Ergonomic Thumb-Zone Dock */}
      <nav
        aria-label="Mobile drawing tools"
        className="no-print md:hidden fixed bottom-2.5 left-2.5 right-2.5 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg shadow-slate-900/10 px-1.5 py-1 flex items-center justify-between gap-0.5"
      >
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              aria-label={tool.label}
              aria-pressed={active}
              className={`min-h-[44px] min-w-[44px] flex-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 active:bg-slate-100'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-medium leading-none tracking-tight">
                {tool.id === 'select'
                  ? 'Move'
                  : tool.id === 'pan'
                  ? 'Pan'
                  : tool.id === 'shape'
                  ? 'Shape'
                  : tool.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onToggleMobileOptions}
          aria-label="Tool Options"
          aria-expanded={mobileOptionsOpen}
          className={`min-h-[44px] min-w-[44px] px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 border-l border-slate-100 transition-colors ${
            mobileOptionsOpen
              ? 'text-blue-600 bg-blue-50'
              : 'text-slate-600 active:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="w-[18px] h-[18px]" />
          <span className="text-[10px] font-medium leading-none tracking-tight">
            Style
          </span>
        </button>
      </nav>
    </>
  );
};
