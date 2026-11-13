import React from 'react';
import {
  Square,
  Circle,
  Triangle,
  Diamond,
  Star,
  Minus,
  ArrowRight,
  MoveHorizontal,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
  RotateCcw,
  RotateCw,
  Lock,
  Unlock,
  Eraser,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PencilStyle,
  PRESET_COLORS,
  ShapeType,
  StrokeStyle,
  TextAlign,
  TextFontFamily,
  ToolSettings,
  ToolType,
  WhiteboardObject,
} from '../types/whiteboard';

interface PropertiesBarProps {
  activeTool: ToolType;
  settings: ToolSettings;
  onUpdateSettings: (patch: Partial<ToolSettings>) => void;
  selectedObjects: WhiteboardObject[];
  onUpdateSelectedObjects: (patch: Partial<WhiteboardObject>) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onLayerChange: (dir: 'front' | 'back') => void;
  onRotateSelected: (deltaDeg: number, reset?: boolean) => void;
  onRequestClearBoard: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const PENCIL_STYLES: { id: PencilStyle; label: string }[] = [
  { id: 'pen', label: 'Pen' },
  { id: 'marker', label: 'Marker' },
  { id: 'brush', label: 'Brush' },
  { id: 'calligraphy', label: 'Calligraphy' },
  { id: 'dashed', label: 'Dashed' },
];

const SHAPE_OPTIONS: {
  id: ShapeType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'rectangle', label: 'Square / Rect', icon: Square },
  { id: 'roundedRect', label: 'Rounded Rect', icon: Square },
  { id: 'circle', label: 'Circle / Oval', icon: Circle },
  { id: 'triangle', label: 'Triangle', icon: Triangle },
  { id: 'diamond', label: 'Diamond', icon: Diamond },
  { id: 'star', label: 'Star', icon: Star },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: ArrowRight },
  { id: 'doubleArrow', label: 'Double Arrow', icon: MoveHorizontal },
];

const FONT_FAMILIES: { id: TextFontFamily; label: string }[] = [
  { id: 'Plus Jakarta Sans', label: 'Sans' },
  { id: 'Lora', label: 'Serif' },
  { id: 'Caveat', label: 'Hand' },
  { id: 'JetBrains Mono', label: 'Mono' },
];

interface ColorPickerRowProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  allowTransparent?: boolean;
}

const ColorPickerRow: React.FC<ColorPickerRowProps> = ({
  label,
  value,
  onChange,
  allowTransparent = false,
}) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {label && (
        <span className="text-[11px] font-medium text-slate-500 mr-1 whitespace-nowrap">
          {label}
        </span>
      )}
      {allowTransparent && (
        <button
          type="button"
          onClick={() => onChange('transparent')}
          title="Transparent / No Fill"
          aria-label="Transparent fill"
          className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 shrink-0 ${
            value === 'transparent'
              ? 'border-blue-600 ring-2 ring-blue-600/30 bg-white text-red-500'
              : 'border-slate-300 bg-white text-slate-400'
          }`}
        >
          /
        </button>
      )}
      {PRESET_COLORS.slice(0, 9).map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            aria-label={`Color ${c}`}
            style={{ backgroundColor: c }}
            className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 shrink-0 ${
              active
                ? 'border-blue-600 ring-2 ring-blue-600/30 scale-110'
                : 'border-slate-300/80'
            }`}
          />
        );
      })}
      {/* Custom HTML5 Color Picker */}
      <label
        title="Custom color picker"
        className="relative w-6 h-6 rounded-full border border-slate-300 overflow-hidden cursor-pointer hover:scale-110 transition-transform shrink-0 flex items-center justify-center bg-gradient-to-tr from-rose-500 via-amber-400 to-blue-600"
      >
        <input
          type="color"
          value={value === 'transparent' ? '#2563EB' : value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom color picker"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
    </div>
  );
};

export const PropertiesBar: React.FC<PropertiesBarProps> = ({
  activeTool,
  settings,
  onUpdateSettings,
  selectedObjects,
  onUpdateSelectedObjects,
  onDeleteSelected,
  onDuplicateSelected,
  onLayerChange,
  onRotateSelected,
  onRequestClearBoard,
  mobileOpen,
  onCloseMobile,
}) => {
  const singleSelected =
    selectedObjects.length === 1 ? selectedObjects[0] : null;
  const hasSelection = selectedObjects.length > 0;

  // Determine whether we have something meaningful to display
  const showBar =
    activeTool === 'pencil' ||
    activeTool === 'eraser' ||
    activeTool === 'shape' ||
    activeTool === 'text' ||
    (activeTool === 'select' && hasSelection);

  if (!showBar) return null;

  const renderContent = () => {
    // 1. Selected object inspector (takes precedence when in Select mode with selection)
    if (activeTool === 'select' && hasSelection) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          {/* Edit stroke/color of single selected object */}
          {singleSelected?.type === 'stroke' && (
            <>
              <ColorPickerRow
                label="Ink"
                value={singleSelected.color}
                onChange={(color) => onUpdateSelectedObjects({ color })}
              />
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span className="whitespace-nowrap">Size</span>
                <input
                  type="range"
                  min={1}
                  max={36}
                  value={singleSelected.strokeWidth}
                  onChange={(e) =>
                    onUpdateSelectedObjects({
                      strokeWidth: Number(e.target.value),
                    })
                  }
                  className="w-20 accent-blue-600"
                />
                <span className="font-mono-tabular w-6 text-right text-slate-800">
                  {singleSelected.strokeWidth}
                </span>
              </label>
            </>
          )}

          {singleSelected?.type === 'shape' && (
            <>
              <ColorPickerRow
                label="Stroke"
                value={singleSelected.strokeColor}
                onChange={(strokeColor) =>
                  onUpdateSelectedObjects({ strokeColor })
                }
              />
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <ColorPickerRow
                label="Fill"
                value={singleSelected.fillColor}
                onChange={(fillColor) => onUpdateSelectedObjects({ fillColor })}
                allowTransparent
              />
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>Width</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={singleSelected.strokeWidth}
                  onChange={(e) =>
                    onUpdateSelectedObjects({
                      strokeWidth: Number(e.target.value),
                    })
                  }
                  className="w-16 accent-blue-600"
                />
              </label>
            </>
          )}

          {singleSelected?.type === 'text' && (
            <>
              <ColorPickerRow
                label="Text"
                value={singleSelected.color}
                onChange={(color) => onUpdateSelectedObjects({ color })}
              />
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <select
                value={singleSelected.fontFamily}
                onChange={(e) =>
                  onUpdateSelectedObjects({
                    fontFamily: e.target.value as TextFontFamily,
                  })
                }
                aria-label="Text font family"
                className="h-8 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 outline-none focus:border-blue-500"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>Size</span>
                <input
                  type="number"
                  min={12}
                  max={120}
                  value={singleSelected.fontSize}
                  onChange={(e) =>
                    onUpdateSelectedObjects({
                      fontSize: Math.max(12, Math.min(120, Number(e.target.value) || 20)),
                    })
                  }
                  className="w-14 h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono-tabular text-slate-800"
                />
              </label>
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSelectedObjects({ bold: !singleSelected.bold })
                  }
                  className={`w-7 h-7 rounded-md flex items-center justify-center ${
                    singleSelected.bold
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSelectedObjects({ italic: !singleSelected.italic })
                  }
                  className={`w-7 h-7 rounded-md flex items-center justify-center ${
                    singleSelected.italic
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {/* Common Transform & Layering Controls */}
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ keepAspectRatio: !settings.keepAspectRatio })
              }
              title={
                settings.keepAspectRatio
                  ? 'Proportions locked on resize'
                  : 'Free resize (click to lock proportions)'
              }
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors whitespace-nowrap ${
                settings.keepAspectRatio
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {settings.keepAspectRatio ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              <span className="hidden lg:inline">Ratio</span>
            </button>

            <button
              type="button"
              onClick={() => onRotateSelected(-90)}
              title="Rotate 90° Counter-Clockwise"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRotateSelected(90)}
              title="Rotate 90° Clockwise"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            {singleSelected && Math.round(singleSelected.rotation) !== 0 && (
              <button
                type="button"
                onClick={() => onRotateSelected(0, true)}
                title="Reset rotation to 0°"
                className="h-8 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono-tabular text-slate-700"
              >
                {Math.round(singleSelected.rotation)}°
              </button>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onLayerChange('front')}
              title="Bring to Front"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onLayerChange('back')}
              title="Send to Back"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDuplicateSelected}
              title="Duplicate (Ctrl+D)"
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              title="Delete Selected (Del)"
              className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    }

    // 2. Pencil Tool Properties
    if (activeTool === 'pencil') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            {PENCIL_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onUpdateSettings({ pencilStyle: st.id })}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  settings.pencilStyle === st.id
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <ColorPickerRow
            value={settings.pencilColor}
            onChange={(pencilColor) => onUpdateSettings({ pencilColor })}
          />

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="whitespace-nowrap">Size</span>
            <input
              type="range"
              min={1}
              max={40}
              value={settings.pencilSize}
              onChange={(e) =>
                onUpdateSettings({ pencilSize: Number(e.target.value) })
              }
              className="w-20 sm:w-24 accent-blue-600"
            />
            <span className="font-mono-tabular w-7 text-right text-slate-800 font-medium">
              {settings.pencilSize}px
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="whitespace-nowrap">Opacity</span>
            <input
              type="range"
              min={20}
              max={100}
              value={Math.round(settings.pencilOpacity * 100)}
              onChange={(e) =>
                onUpdateSettings({
                  pencilOpacity: Number(e.target.value) / 100,
                })
              }
              className="w-16 accent-blue-600"
            />
            <span className="font-mono-tabular w-9 text-right text-slate-800">
              {Math.round(settings.pencilOpacity * 100)}%
            </span>
          </label>
        </div>
      );
    }

    // 3. Eraser Tool Properties
    if (activeTool === 'eraser') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateSettings({ eraserMode: 'precision' })}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                settings.eraserMode === 'precision'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              Part Eraser
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ eraserMode: 'object' })}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                settings.eraserMode === 'object'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Object Eraser
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="whitespace-nowrap">Eraser Size</span>
            <input
              type="range"
              min={6}
              max={64}
              value={settings.eraserSize}
              onChange={(e) =>
                onUpdateSettings({ eraserSize: Number(e.target.value) })
              }
              className="w-24 accent-blue-600"
            />
            <span className="font-mono-tabular w-8 text-right text-slate-800 font-medium">
              {settings.eraserSize}px
            </span>
          </label>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <button
            type="button"
            onClick={onRequestClearBoard}
            className="h-8 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Whiteboard
          </button>
        </div>
      );
    }

    // 4. Shape Tool Properties
    if (activeTool === 'shape') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg overflow-x-auto max-w-full">
            {SHAPE_OPTIONS.map((sh) => {
              const Icon = sh.icon;
              const active = settings.shapeType === sh.id;
              return (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => onUpdateSettings({ shapeType: sh.id })}
                  title={sh.label}
                  aria-label={sh.label}
                  className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    active
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  } ${sh.id === 'roundedRect' ? '[&_svg]:rounded-sm' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <ColorPickerRow
            label="Stroke"
            value={settings.shapeStrokeColor}
            onChange={(shapeStrokeColor) =>
              onUpdateSettings({ shapeStrokeColor })
            }
          />

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <ColorPickerRow
            label="Fill"
            value={settings.shapeFillColor}
            onChange={(shapeFillColor) => onUpdateSettings({ shapeFillColor })}
            allowTransparent
          />

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Width</span>
              <input
                type="range"
                min={1}
                max={16}
                value={settings.shapeStrokeWidth}
                onChange={(e) =>
                  onUpdateSettings({ shapeStrokeWidth: Number(e.target.value) })
                }
                className="w-16 accent-blue-600"
              />
              <span className="font-mono-tabular w-6 text-slate-800">
                {settings.shapeStrokeWidth}
              </span>
            </label>

            <select
              value={settings.shapeStrokeStyle}
              onChange={(e) =>
                onUpdateSettings({
                  shapeStrokeStyle: e.target.value as StrokeStyle,
                })
              }
              aria-label="Shape line style"
              className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 outline-none"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
        </div>
      );
    }

    // 5. Text Tool Properties
    if (activeTool === 'text') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <ColorPickerRow
            label="Color"
            value={settings.textColor}
            onChange={(textColor) => onUpdateSettings({ textColor })}
          />

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <select
            value={settings.textFontFamily}
            onChange={(e) =>
              onUpdateSettings({
                textFontFamily: e.target.value as TextFontFamily,
              })
            }
            aria-label="Font family"
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Size</span>
            <input
              type="range"
              min={14}
              max={72}
              value={settings.textFontSize}
              onChange={(e) =>
                onUpdateSettings({ textFontSize: Number(e.target.value) })
              }
              className="w-16 accent-blue-600"
            />
            <span className="font-mono-tabular w-7 text-slate-800">
              {settings.textFontSize}
            </span>
          </label>

          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateSettings({ textBold: !settings.textBold })}
              title="Bold"
              className={`w-7 h-7 rounded-md flex items-center justify-center ${
                settings.textBold
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ textItalic: !settings.textItalic })
              }
              title="Italic"
              className={`w-7 h-7 rounded-md flex items-center justify-center ${
                settings.textItalic
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ textUnderline: !settings.textUnderline })
              }
              title="Underline"
              className={`w-7 h-7 rounded-md flex items-center justify-center ${
                settings.textUnderline
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {(
              [
                { id: 'left', icon: AlignLeft },
                { id: 'center', icon: AlignCenter },
                { id: 'right', icon: AlignRight },
              ] as { id: TextAlign; icon: React.ComponentType<{ className?: string }> }[]
            ).map((al) => {
              const Icon = al.icon;
              return (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => onUpdateSettings({ textAlign: al.id })}
                  title={`Align ${al.id}`}
                  className={`w-7 h-7 rounded-md flex items-center justify-center ${
                    settings.textAlign === al.id
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Desktop & Tablet Contextual Floating Bar */}
      <div className="no-print hidden md:flex fixed top-[64px] left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-160px)] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg shadow-slate-900/5 px-3.5 py-2 overflow-x-auto thin-scrollbar">
        {renderContent()}
      </div>

      {/* Mobile Bottom Sheet for Tool Properties */}
      {mobileOpen && (
        <div className="no-print md:hidden fixed inset-x-2.5 bottom-[68px] z-30 bg-white/98 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-3.5 max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
            <span className="font-display text-xs font-semibold text-slate-800 capitalize">
              {activeTool === 'select' && hasSelection
                ? 'Object Transform & Style'
                : `${activeTool} Settings`}
            </span>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close options"
              className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {renderContent()}
        </div>
      )}
    </>
  );
};
