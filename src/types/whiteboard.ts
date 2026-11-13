export type ToolType = 'select' | 'pan' | 'pencil' | 'eraser' | 'text' | 'shape';

export type PencilStyle = 'pen' | 'marker' | 'brush' | 'dashed' | 'calligraphy';

export type EraserMode = 'precision' | 'object';

export type ShapeType =
  | 'rectangle'
  | 'roundedRect'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'line'
  | 'arrow'
  | 'doubleArrow';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type TextFontFamily =
  | 'Plus Jakarta Sans'
  | 'Lora'
  | 'Caveat'
  | 'JetBrains Mono';

export type TextAlign = 'left' | 'center' | 'right';

export type BackgroundPattern = 'blank' | 'dots' | 'grid' | 'ruled' | 'isometric';

export interface Point {
  x: number;
  y: number;
}

export interface BaseObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees 0-360
  opacity: number; // 0-1
}

export interface StrokeObject extends BaseObject {
  type: 'stroke';
  /** Points stored in local object coordinates [0..width, 0..height] */
  points: Point[];
  color: string;
  strokeWidth: number;
  style: PencilStyle;
}

export interface ShapeObject extends BaseObject {
  type: 'shape';
  shapeType: ShapeType;
  strokeColor: string;
  fillColor: string; // 'transparent' or hex
  strokeWidth: number;
  strokeStyle: StrokeStyle;
}

export interface TextObject extends BaseObject {
  type: 'text';
  text: string;
  color: string;
  backgroundColor: string; // 'transparent' or hex
  fontSize: number;
  fontFamily: TextFontFamily;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
}

export type WhiteboardObject = StrokeObject | ShapeObject | TextObject;

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number; // 0.1 to 4.0
}

export interface ToolSettings {
  // Pencil
  pencilStyle: PencilStyle;
  pencilSize: number;
  pencilColor: string;
  pencilOpacity: number;
  // Eraser
  eraserMode: EraserMode;
  eraserSize: number;
  // Shape
  shapeType: ShapeType;
  shapeStrokeColor: string;
  shapeFillColor: string;
  shapeStrokeWidth: number;
  shapeStrokeStyle: StrokeStyle;
  // Text
  textColor: string;
  textBgColor: string;
  textFontSize: number;
  textFontFamily: TextFontFamily;
  textBold: boolean;
  textItalic: boolean;
  textUnderline: boolean;
  textAlign: TextAlign;
  // Transform
  keepAspectRatio: boolean;
}

export interface WhiteboardProject {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  objects: WhiteboardObject[];
  thumbnail?: string;
}

export type HandleId =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate';

export type PaperSize = 'a4' | 'letter' | 'legal' | 'a3';
export type PaperOrientation = 'auto' | 'portrait' | 'landscape';

export const PRESET_COLORS = [
  '#0F172A', // Slate Ink
  '#334155', // Charcoal
  '#DC2626', // Crimson
  '#EA580C', // Burnt Orange
  '#D97706', // Amber
  '#16A34A', // Emerald
  '#0D9488', // Teal
  '#2563EB', // Royal Blue
  '#4F46E5', // Indigo
  '#9333EA', // Violet
  '#DB2777', // Rose
  '#FFFFFF', // Pure White
];

export const CANVAS_BG_PRESETS = [
  { label: 'Pure White', color: '#FFFFFF', dark: false },
  { label: 'Warm Paper', color: '#FAF8F5', dark: false },
  { label: 'Cool Mist', color: '#F1F5F9', dark: false },
  { label: 'Soft Sage', color: '#F0FDF4', dark: false },
  { label: 'Chalkboard', color: '#1E293B', dark: true },
  { label: 'Blueprint', color: '#0F172A', dark: true },
];
