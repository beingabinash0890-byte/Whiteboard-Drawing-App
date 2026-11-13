import {
  BackgroundPattern,
  Point,
  ShapeObject,
  StrokeObject,
  TextObject,
  ViewportState,
  WhiteboardObject,
} from '../types/whiteboard';
import { getObjectCenter, getSelectionHandles, isColorDark } from './geometry';

export interface RenderOptions {
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  objects: WhiteboardObject[];
  viewport: ViewportState;
  width: number;
  height: number;
  selectedIds: string[];
  editingTextId: string | null;
  activeStroke?: StrokeObject | null;
  activeShape?: ShapeObject | null;
  marqueeRect?: { x: number; y: number; width: number; height: number } | null;
  eraserCursor?: { x: number; y: number; radius: number } | null;
  showSelectionOverlay?: boolean;
  rotatingAngle?: number | null;
}

export function renderBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  bgColor: string,
  pattern: BackgroundPattern,
  viewport: ViewportState,
  width: number,
  height: number
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  if (pattern === 'blank') return;

  const dark = isColorDark(bgColor);
  const strokeSubtle = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)';
  const strokeMajor = dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.12)';
  const dotColor = dark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.18)';

  const { panX, panY, zoom } = viewport;

  // Adaptive spacing so grid doesn't get overwhelmingly dense when zoomed out
  let step = 32;
  if (zoom < 0.35) step = 128;
  else if (zoom < 0.7) step = 64;

  const worldLeft = -panX / zoom;
  const worldTop = -panY / zoom;
  const worldRight = (width - panX) / zoom;
  const worldBottom = (height - panY) / zoom;

  const startX = Math.floor(worldLeft / step) * step;
  const startY = Math.floor(worldTop / step) * step;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  if (pattern === 'dots') {
    ctx.fillStyle = dotColor;
    const dotRadius = Math.max(1.1, 1.35 / zoom);
    for (let x = startX; x <= worldRight; x += step) {
      for (let y = startY; y <= worldBottom; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'grid') {
    const lineW = 1 / zoom;
    for (let x = startX; x <= worldRight; x += step) {
      const isMajor = Math.round(x / step) % 4 === 0;
      ctx.strokeStyle = isMajor ? strokeMajor : strokeSubtle;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
      ctx.stroke();
    }
    for (let y = startY; y <= worldBottom; y += step) {
      const isMajor = Math.round(y / step) % 4 === 0;
      ctx.strokeStyle = isMajor ? strokeMajor : strokeSubtle;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
      ctx.stroke();
    }
  } else if (pattern === 'ruled') {
    ctx.strokeStyle = dark ? 'rgba(96, 165, 250, 0.16)' : 'rgba(37, 99, 235, 0.11)';
    ctx.lineWidth = 1 / zoom;
    for (let y = startY; y <= worldBottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
      ctx.stroke();
    }
  } else if (pattern === 'isometric') {
    const isoStep = step * 1.5;
    ctx.strokeStyle = strokeSubtle;
    ctx.lineWidth = 1 / zoom;
    const h = worldBottom - worldTop;
    const dx = h / Math.tan(Math.PI / 3); // 60 deg
    const minX = Math.floor((worldLeft - dx) / isoStep) * isoStep;
    const maxX = worldRight + dx;

    ctx.beginPath();
    for (let x = minX; x <= maxX; x += isoStep) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x + dx, worldBottom);
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x - dx, worldBottom);
    }
    for (let y = Math.floor(worldTop / (isoStep * 0.866)) * (isoStep * 0.866); y <= worldBottom; y += isoStep * 0.866) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeObject
) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  const center = getObjectCenter(stroke);
  ctx.translate(center.x, center.y);
  ctx.rotate((stroke.rotation * Math.PI) / 180);
  ctx.translate(-stroke.width / 2, -stroke.height / 2);

  let alpha = stroke.opacity;
  if (stroke.style === 'marker') alpha *= 0.42;
  ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = stroke.style === 'marker' ? 'square' : 'round';
  ctx.lineJoin = 'round';

  if (stroke.style === 'dashed') {
    ctx.setLineDash([stroke.strokeWidth * 2.4, stroke.strokeWidth * 1.8]);
  } else {
    ctx.setLineDash([]);
  }

  if (stroke.style === 'brush') {
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = Math.max(2, stroke.strokeWidth * 0.45);
  }

  if (stroke.style === 'calligraphy') {
    // Nib-angle ribbon simulation (45 deg nib)
    const nibW = stroke.strokeWidth * 1.15;
    const angle = -Math.PI / 4;
    const ox = Math.cos(angle) * (nibW / 2);
    const oy = Math.sin(angle) * (nibW / 2);

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x - ox, pts[0].y - oy);
      ctx.lineTo(pts[0].x + ox, pts[0].y + oy);
      ctx.lineWidth = Math.max(1.5, stroke.strokeWidth * 0.35);
      ctx.stroke();
      ctx.restore();
      return;
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      ctx.beginPath();
      ctx.moveTo(p1.x - ox, p1.y - oy);
      ctx.lineTo(p1.x + ox, p1.y + oy);
      ctx.lineTo(p2.x + ox, p2.y + oy);
      ctx.lineTo(p2.x - ox, p2.y - oy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, Math.max(1, stroke.strokeWidth / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.lineWidth =
    stroke.style === 'marker' ? stroke.strokeWidth * 1.6 : stroke.strokeWidth;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  ctx.stroke();
  ctx.restore();
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeObject) {
  ctx.save();
  const center = getObjectCenter(shape);
  ctx.translate(center.x, center.y);
  ctx.rotate((shape.rotation * Math.PI) / 180);
  ctx.translate(-shape.width / 2, -shape.height / 2);

  ctx.globalAlpha = shape.opacity;
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (shape.strokeStyle === 'dashed') {
    ctx.setLineDash([shape.strokeWidth * 3, shape.strokeWidth * 2]);
  } else if (shape.strokeStyle === 'dotted') {
    ctx.setLineDash([1, shape.strokeWidth * 2.2]);
  } else {
    ctx.setLineDash([]);
  }

  const w = shape.width;
  const h = shape.height;
  const hasFill = shape.fillColor !== 'transparent';
  if (hasFill) {
    ctx.fillStyle = shape.fillColor;
  }

  ctx.beginPath();

  switch (shape.shapeType) {
    case 'rectangle': {
      ctx.rect(0, 0, w, h);
      break;
    }
    case 'roundedRect': {
      const r = Math.min(20, w * 0.2, h * 0.2);
      ctx.roundRect(0, 0, w, h, r);
      break;
    }
    case 'circle': {
      ctx.ellipse(w / 2, h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
      break;
    }
    case 'triangle': {
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      break;
    }
    case 'diamond': {
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w / 2, h);
      ctx.lineTo(0, h / 2);
      ctx.closePath();
      break;
    }
    case 'star': {
      const cx = w / 2;
      const cy = h / 2;
      const outerRx = w / 2;
      const outerRy = h / 2;
      const innerRx = outerRx * 0.42;
      const innerRy = outerRy * 0.42;
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const rx = i % 2 === 0 ? outerRx : innerRx;
        const ry = i % 2 === 0 ? outerRy : innerRy;
        const px = cx + Math.cos(angle) * rx;
        const py = cy + Math.sin(angle) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'line': {
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      break;
    }
    case 'arrow': {
      const y = h / 2;
      const headLen = Math.min(w * 0.45, Math.max(12, shape.strokeWidth * 3.8));
      const headHalf = headLen * 0.58;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(w - headLen, y - headHalf);
      ctx.lineTo(w, y);
      ctx.lineTo(w - headLen, y + headHalf);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'doubleArrow': {
      const y = h / 2;
      const headLen = Math.min(w * 0.35, Math.max(12, shape.strokeWidth * 3.8));
      const headHalf = headLen * 0.58;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(headLen, y - headHalf);
      ctx.lineTo(0, y);
      ctx.lineTo(headLen, y + headHalf);
      ctx.moveTo(w - headLen, y - headHalf);
      ctx.lineTo(w, y);
      ctx.lineTo(w - headLen, y + headHalf);
      ctx.stroke();
      ctx.restore();
      return;
    }
  }

  if (hasFill) ctx.fill();
  if (shape.strokeWidth > 0) ctx.stroke();
  ctx.restore();
}

export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  const safeMax = Math.max(24, maxWidth);

  for (const para of paragraphs) {
    if (para === '') {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= safeMax) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        // Handle super-long single word
        if (ctx.measureText(word).width > safeMax) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > safeMax && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = word;
        }
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

export function drawTextObject(ctx: CanvasRenderingContext2D, obj: TextObject) {
  ctx.save();
  const center = getObjectCenter(obj);
  ctx.translate(center.x, center.y);
  ctx.rotate((obj.rotation * Math.PI) / 180);
  ctx.translate(-obj.width / 2, -obj.height / 2);

  ctx.globalAlpha = obj.opacity;

  if (obj.backgroundColor && obj.backgroundColor !== 'transparent') {
    ctx.fillStyle = obj.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, obj.width, obj.height, 8);
    ctx.fill();
  }

  const fontWeight = obj.bold ? '700' : '400';
  const fontStyle = obj.italic ? 'italic' : 'normal';
  ctx.font = `${fontStyle} ${fontWeight} ${obj.fontSize}px "${obj.fontFamily}", sans-serif`;
  ctx.fillStyle = obj.color;
  ctx.textBaseline = 'top';

  const pad = 8;
  const innerWidth = Math.max(20, obj.width - pad * 2);
  const lines = wrapTextLines(ctx, obj.text || ' ', innerWidth);
  const lineHeight = obj.fontSize * 1.3;

  lines.forEach((line, idx) => {
    const ly = pad + idx * lineHeight;
    let lx = pad;
    const measuredW = ctx.measureText(line).width;

    if (obj.align === 'center') {
      lx = pad + (innerWidth - measuredW) / 2;
    } else if (obj.align === 'right') {
      lx = pad + innerWidth - measuredW;
    }

    ctx.fillText(line, lx, ly);

    if (obj.underline && line.trim().length > 0) {
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = Math.max(1, obj.fontSize * 0.06);
      ctx.beginPath();
      ctx.moveTo(lx, ly + obj.fontSize * 1.05);
      ctx.lineTo(lx + measuredW, ly + obj.fontSize * 1.05);
      ctx.stroke();
    }
  });

  ctx.restore();
}

export function drawWhiteboardObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject
) {
  if (obj.type === 'stroke') drawSmoothStroke(ctx, obj);
  else if (obj.type === 'shape') drawShape(ctx, obj);
  else if (obj.type === 'text') drawTextObject(ctx, obj);
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions
) {
  const {
    backgroundColor,
    backgroundPattern,
    objects,
    viewport,
    width,
    height,
    selectedIds,
    editingTextId,
    activeStroke,
    activeShape,
    marqueeRect,
    eraserCursor,
    showSelectionOverlay = true,
    rotatingAngle = null,
  } = opts;

  ctx.save();
  renderBackgroundPattern(ctx, backgroundColor, backgroundPattern, viewport, width, height);

  // World-space objects
  ctx.save();
  ctx.translate(viewport.panX, viewport.panY);
  ctx.scale(viewport.zoom, viewport.zoom);

  for (const obj of objects) {
    if (obj.id === editingTextId) continue;
    drawWhiteboardObject(ctx, obj);
  }

  if (activeStroke) {
    drawSmoothStroke(ctx, activeStroke);
  }
  if (activeShape) {
    drawShape(ctx, activeShape);
  }

  // Selection Overlays
  if (showSelectionOverlay && selectedIds.length > 0) {
    const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
    for (const obj of selectedObjects) {
      drawSelectionBox(
        ctx,
        obj,
        viewport.zoom,
        selectedObjects.length === 1,
        rotatingAngle
      );
    }
  }

  // Marquee Selection Rectangle
  if (marqueeRect) {
    ctx.save();
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.25 / viewport.zoom;
    ctx.setLineDash([5 / viewport.zoom, 4 / viewport.zoom]);
    ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);
    ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);
    ctx.restore();
  }

  // Eraser Cursor Preview
  if (eraserCursor) {
    ctx.save();
    ctx.strokeStyle = isColorDark(backgroundColor)
      ? 'rgba(255, 255, 255, 0.75)'
      : 'rgba(15, 23, 42, 0.65)';
    ctx.fillStyle = isColorDark(backgroundColor)
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(15, 23, 42, 0.06)';
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.beginPath();
    ctx.arc(eraserCursor.x, eraserCursor.y, eraserCursor.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  zoom: number,
  showHandles: boolean,
  rotatingAngle: number | null
) {
  const center = getObjectCenter(obj);
  const invZ = 1 / zoom;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((obj.rotation * Math.PI) / 180);
  ctx.translate(-obj.width / 2, -obj.height / 2);

  // Bounding outline
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 1.5 * invZ;
  ctx.setLineDash([]);
  ctx.strokeRect(0, 0, obj.width, obj.height);

  if (showHandles) {
    const rotOffset = 28 * invZ;
    // Stem to rotation handle
    ctx.beginPath();
    ctx.moveTo(obj.width / 2, 0);
    ctx.lineTo(obj.width / 2, -rotOffset);
    ctx.stroke();

    // Corner + Edge resize handles
    const handleSize = 9 * invZ;
    const half = handleSize / 2;
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: obj.width / 2, y: 0 },
      { x: obj.width, y: 0 },
      { x: obj.width, y: obj.height / 2 },
      { x: obj.width, y: obj.height },
      { x: obj.width / 2, y: obj.height },
      { x: 0, y: obj.height },
      { x: 0, y: obj.height / 2 },
    ];

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.6 * invZ;

    for (const p of pts) {
      ctx.beginPath();
      ctx.roundRect(p.x - half, p.y - half, handleSize, handleSize, 2 * invZ);
      ctx.fill();
      ctx.stroke();
    }

    // Rotation circular handle
    const rotR = 6 * invZ;
    ctx.beginPath();
    ctx.arc(obj.width / 2, -rotOffset, rotR, 0, Math.PI * 2);
    ctx.fillStyle = '#2563EB';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5 * invZ;
    ctx.stroke();
  }

  ctx.restore();

  // Live rotation degree readout near rotation handle
  if (showHandles && rotatingAngle !== null) {
    const handles = getSelectionHandles(obj, zoom);
    const rh = handles.rotate;
    ctx.save();
    ctx.font = `600 ${12 * invZ}px "JetBrains Mono", monospace`;
    const label = `${Math.round(rotatingAngle)}°`;
    const metrics = ctx.measureText(label);
    const padX = 7 * invZ;
    const boxW = metrics.width + padX * 2;
    const boxH = 22 * invZ;
    const bx = rh.x - boxW / 2;
    const by = rh.y - boxH - 10 * invZ;

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 5 * invZ);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rh.x, by + boxH / 2);
    ctx.restore();
  }
}
