import {
  HandleId,
  Point,
  ShapeObject,
  StrokeObject,
  ViewportState,
  WhiteboardObject,
} from '../types/whiteboard';

export function screenToWorld(
  sx: number,
  sy: number,
  viewport: ViewportState
): Point {
  return {
    x: (sx - viewport.panX) / viewport.zoom,
    y: (sy - viewport.panY) / viewport.zoom,
  };
}

export function worldToScreen(
  wx: number,
  wy: number,
  viewport: ViewportState
): Point {
  return {
    x: wx * viewport.zoom + viewport.panX,
    y: wy * viewport.zoom + viewport.panY,
  };
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function normalizeAngle(deg: number): number {
  const n = ((deg % 360) + 360) % 360;
  return Math.round(n * 10) / 10;
}

export function rotatePointAround(
  pt: Point,
  center: Point,
  angleDeg: number
): Point {
  if (Math.abs(angleDeg) < 0.0001) return { ...pt };
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getObjectCenter(obj: WhiteboardObject): Point {
  return {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  };
}

/** Distance from point P to segment AB */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** Hit-test an object in world coordinates */
export function hitTestObject(
  obj: WhiteboardObject,
  worldPt: Point,
  tolerance = 8
): boolean {
  const center = getObjectCenter(obj);
  const local = rotatePointAround(worldPt, center, -obj.rotation);
  const lx = local.x - obj.x;
  const ly = local.y - obj.y;

  if (obj.type === 'text') {
    return (
      lx >= -tolerance &&
      lx <= obj.width + tolerance &&
      ly >= -tolerance &&
      ly <= obj.height + tolerance
    );
  }

  if (obj.type === 'stroke') {
    const pad = Math.max(tolerance, obj.strokeWidth / 2 + 4);
    if (
      lx < -pad ||
      lx > obj.width + pad ||
      ly < -pad ||
      ly > obj.height + pad
    ) {
      return false;
    }
    const pts = obj.points;
    if (pts.length === 0) return false;
    if (pts.length === 1) {
      return Math.hypot(lx - pts[0].x, ly - pts[0].y) <= pad;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment({ x: lx, y: ly }, pts[i], pts[i + 1]) <= pad) {
        return true;
      }
    }
    return false;
  }

  if (obj.type === 'shape') {
    return hitTestShapeLocal(obj, lx, ly, tolerance);
  }

  return false;
}

function hitTestShapeLocal(
  shape: ShapeObject,
  lx: number,
  ly: number,
  tolerance: number
): boolean {
  const w = shape.width;
  const h = shape.height;
  const pad = Math.max(tolerance, shape.strokeWidth / 2 + 4);

  if (
    shape.shapeType === 'line' ||
    shape.shapeType === 'arrow' ||
    shape.shapeType === 'doubleArrow'
  ) {
    // Diagonal from (0,0) to (w,h) or stored? Note: line/arrow uses bounding box top-left to bottom-right or flipped?
    // Our line/arrow objects always draw from (0, h/2) or (0,0)->(w,h)? Let's check:
    // Actually we support arbitrary endpoints via width/height, or better: let's draw line/arrow from (0, h/2) to (w, h/2) so rotation handles every angle cleanly!
    // That makes resizing and rotating arrows/lines completely natural!
    return distToSegment({ x: lx, y: ly }, { x: 0, y: h / 2 }, { x: w, y: h / 2 }) <= pad;
  }

  if (
    lx < -pad ||
    lx > w + pad ||
    ly < -pad ||
    ly > h + pad
  ) {
    return false;
  }

  const hasFill = shape.fillColor !== 'transparent';

  if (shape.shapeType === 'circle') {
    const rx = Math.max(1, w / 2);
    const ry = Math.max(1, h / 2);
    const nx = (lx - rx) / rx;
    const ny = (ly - ry) / ry;
    const dist = Math.hypot(nx, ny);
    if (hasFill) return dist <= 1 + pad / Math.min(rx, ry);
    const tolNorm = pad / Math.min(rx, ry);
    return Math.abs(dist - 1) <= tolNorm;
  }

  if (hasFill) {
    return lx >= -pad && lx <= w + pad && ly >= -pad && ly <= h + pad;
  }

  // Hollow polygon/rect border hit test
  if (shape.shapeType === 'triangle') {
    const p1 = { x: w / 2, y: 0 };
    const p2 = { x: w, y: h };
    const p3 = { x: 0, y: h };
    return (
      distToSegment({ x: lx, y: ly }, p1, p2) <= pad ||
      distToSegment({ x: lx, y: ly }, p2, p3) <= pad ||
      distToSegment({ x: lx, y: ly }, p3, p1) <= pad
    );
  }

  if (shape.shapeType === 'diamond') {
    const p1 = { x: w / 2, y: 0 };
    const p2 = { x: w, y: h / 2 };
    const p3 = { x: w / 2, y: h };
    const p4 = { x: 0, y: h / 2 };
    return (
      distToSegment({ x: lx, y: ly }, p1, p2) <= pad ||
      distToSegment({ x: lx, y: ly }, p2, p3) <= pad ||
      distToSegment({ x: lx, y: ly }, p3, p4) <= pad ||
      distToSegment({ x: lx, y: ly }, p4, p1) <= pad
    );
  }

  // Rectangle / roundedRect / star: allow border or inside slight ease
  const nearLeft = Math.abs(lx) <= pad;
  const nearRight = Math.abs(lx - w) <= pad;
  const nearTop = Math.abs(ly) <= pad;
  const nearBottom = Math.abs(ly - h) <= pad;
  if (shape.shapeType === 'star') {
    return lx >= -pad && lx <= w + pad && ly >= -pad && ly <= h + pad;
  }
  return nearLeft || nearRight || nearTop || nearBottom;
}

export function getObjectRotatedCorners(obj: WhiteboardObject): Point[] {
  const c = getObjectCenter(obj);
  const corners: Point[] = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height },
  ];
  return corners.map((p) => rotatePointAround(p, c, obj.rotation));
}

export function getObjectWorldAABB(obj: WhiteboardObject): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const corners = getObjectRotatedCorners(obj);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function getCombinedWorldAABB(objects: WhiteboardObject[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (objects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const obj of objects) {
    const b = getObjectWorldAABB(obj);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function getSelectionHandles(
  obj: WhiteboardObject,
  zoom: number
): Record<HandleId, Point> {
  const c = getObjectCenter(obj);
  const rotateOffset = 28 / zoom;
  const localHandles: Record<HandleId, Point> = {
    nw: { x: obj.x, y: obj.y },
    n: { x: obj.x + obj.width / 2, y: obj.y },
    ne: { x: obj.x + obj.width, y: obj.y },
    e: { x: obj.x + obj.width, y: obj.y + obj.height / 2 },
    se: { x: obj.x + obj.width, y: obj.y + obj.height },
    s: { x: obj.x + obj.width / 2, y: obj.y + obj.height },
    sw: { x: obj.x, y: obj.y + obj.height },
    w: { x: obj.x, y: obj.y + obj.height / 2 },
    rotate: { x: obj.x + obj.width / 2, y: obj.y - rotateOffset },
  };

  const result = {} as Record<HandleId, Point>;
  for (const key of Object.keys(localHandles) as HandleId[]) {
    result[key] = rotatePointAround(localHandles[key], c, obj.rotation);
  }
  return result;
}

export function hitTestSelectionHandle(
  obj: WhiteboardObject,
  worldPt: Point,
  zoom: number,
  isTouch = false
): HandleId | null {
  const handles = getSelectionHandles(obj, zoom);
  const hitRadius = (isTouch ? 18 : 11) / zoom;
  const order: HandleId[] = ['rotate', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
  for (const id of order) {
    const h = handles[id];
    if (Math.hypot(worldPt.x - h.x, worldPt.y - h.y) <= hitRadius) {
      return id;
    }
  }
  return null;
}

/**
 * Anchor-pinned rotated resize:
 * Given the initial object snapshot, handle being dragged, and current pointer in world coords,
 * returns updated { x, y, width, height, points? } while keeping the opposite anchor fixed in world space.
 */
export function computeRotatedResize(
  initial: WhiteboardObject,
  handle: Exclude<HandleId, 'rotate'>,
  worldPt: Point,
  keepAspect: boolean
): Partial<WhiteboardObject> {
  const center = getObjectCenter(initial);
  const localPt = rotatePointAround(worldPt, center, -initial.rotation);

  const minSize = initial.type === 'text' ? 32 : 12;

  let left = initial.x;
  let right = initial.x + initial.width;
  let top = initial.y;
  let bottom = initial.y + initial.height;

  const hasW = handle.includes('w');
  const hasE = handle.includes('e');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');

  if (hasW) left = Math.min(localPt.x, right - minSize);
  if (hasE) right = Math.max(localPt.x, left + minSize);
  if (hasN) top = Math.min(localPt.y, bottom - minSize);
  if (hasS) bottom = Math.max(localPt.y, top + minSize);

  let newW = right - left;
  let newH = bottom - top;

  const isCorner = (hasW || hasE) && (hasN || hasS);
  if (keepAspect && isCorner && initial.width > 0 && initial.height > 0) {
    const ratio = initial.width / initial.height;
    if (newW / newH > ratio) {
      newH = newW / ratio;
      if (hasN) top = bottom - newH;
      else bottom = top + newH;
    } else {
      newW = newH * ratio;
      if (hasW) left = right - newW;
      else right = left + newW;
    }
  }

  // Keep opposite anchor point pinned in world space
  let anchorLocal: Point;
  if (hasW && hasN) anchorLocal = { x: initial.x + initial.width, y: initial.y + initial.height };
  else if (hasE && hasN) anchorLocal = { x: initial.x, y: initial.y + initial.height };
  else if (hasE && hasS) anchorLocal = { x: initial.x, y: initial.y };
  else if (hasW && hasS) anchorLocal = { x: initial.x + initial.width, y: initial.y };
  else if (hasN) anchorLocal = { x: initial.x + initial.width / 2, y: initial.y + initial.height };
  else if (hasS) anchorLocal = { x: initial.x + initial.width / 2, y: initial.y };
  else if (hasW) anchorLocal = { x: initial.x + initial.width, y: initial.y + initial.height / 2 };
  else anchorLocal = { x: initial.x, y: initial.y + initial.height / 2 };

  const anchorWorldBefore = rotatePointAround(anchorLocal, center, initial.rotation);

  const newCenterLocal = { x: left + newW / 2, y: top + newH / 2 };
  const newCenterWorld = rotatePointAround(newCenterLocal, center, initial.rotation);

  // Anchor relative to new local box
  let newAnchorLocal: Point;
  if (hasW && hasN) newAnchorLocal = { x: left + newW, y: top + newH };
  else if (hasE && hasN) newAnchorLocal = { x: left, y: top + newH };
  else if (hasE && hasS) newAnchorLocal = { x: left, y: top };
  else if (hasW && hasS) newAnchorLocal = { x: left + newW, y: top };
  else if (hasN) newAnchorLocal = { x: left + newW / 2, y: top + newH };
  else if (hasS) newAnchorLocal = { x: left + newW / 2, y: top };
  else if (hasW) newAnchorLocal = { x: left + newW, y: top + newH / 2 };
  else newAnchorLocal = { x: left, y: top + newH / 2 };

  const anchorWorldAfter = rotatePointAround(newAnchorLocal, newCenterWorld, initial.rotation);
  const dx = anchorWorldBefore.x - anchorWorldAfter.x;
  const dy = anchorWorldBefore.y - anchorWorldAfter.y;

  const finalX = left + dx;
  const finalY = top + dy;

  if (initial.type === 'stroke') {
    const sx = initial.width > 0.5 ? newW / initial.width : 1;
    const sy = initial.height > 0.5 ? newH / initial.height : 1;
    const scaledPoints = initial.points.map((p) => ({
      x: p.x * sx,
      y: p.y * sy,
    }));
    return {
      x: finalX,
      y: finalY,
      width: newW,
      height: newH,
      points: scaledPoints,
    } as Partial<StrokeObject>;
  }

  return {
    x: finalX,
    y: finalY,
    width: newW,
    height: newH,
  };
}

/**
 * Create a clean StrokeObject from world-space points.
 */
export function buildStrokeObjectFromWorldPoints(
  id: string,
  worldPoints: Point[],
  color: string,
  strokeWidth: number,
  style: StrokeObject['style'],
  opacity: number
): StrokeObject {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of worldPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const padX = rawW < 4 ? (4 - rawW) / 2 : 0;
  const padY = rawH < 4 ? (4 - rawH) / 2 : 0;

  const x = minX - padX;
  const y = minY - padY;
  const width = Math.max(4, rawW);
  const height = Math.max(4, rawH);

  const localPoints = worldPoints.map((p) => ({
    x: p.x - x,
    y: p.y - y,
  }));

  return {
    id,
    type: 'stroke',
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity,
    points: localPoints,
    color,
    strokeWidth,
    style,
  };
}

/**
 * Precision partial eraser: removes points/segments inside eraser circle (worldPt, radius)
 * and splits remaining segments into new StrokeObjects, preserving stroke style & color.
 */
export function splitStrokeByEraser(
  stroke: StrokeObject,
  worldPt: Point,
  eraserRadius: number
): StrokeObject[] | null {
  const center = getObjectCenter(stroke);
  const effectiveRadius = eraserRadius + stroke.strokeWidth * 0.25;

  // Quick bounding check
  const aabb = getObjectWorldAABB(stroke);
  if (
    worldPt.x < aabb.minX - effectiveRadius - 10 ||
    worldPt.x > aabb.maxX + effectiveRadius + 10 ||
    worldPt.y < aabb.minY - effectiveRadius - 10 ||
    worldPt.y > aabb.maxY + effectiveRadius + 10
  ) {
    return null; // Untouched
  }

  // Convert stroke points to world space
  const worldPts = stroke.points.map((p) =>
    rotatePointAround({ x: stroke.x + p.x, y: stroke.y + p.y }, center, stroke.rotation)
  );

  // Subdivide long segments slightly so eraser cuts cleanly even on fast straight strokes
  const densePts: Point[] = [];
  for (let i = 0; i < worldPts.length; i++) {
    densePts.push(worldPts[i]);
    if (i < worldPts.length - 1) {
      const a = worldPts[i];
      const b = worldPts[i + 1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const step = Math.max(4, eraserRadius * 0.45);
      if (dist > step) {
        const steps = Math.min(40, Math.floor(dist / step));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          densePts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
    }
  }

  let anyErased = false;
  const groups: Point[][] = [];
  let current: Point[] = [];

  for (const pt of densePts) {
    const d = Math.hypot(pt.x - worldPt.x, pt.y - worldPt.y);
    if (d <= effectiveRadius) {
      anyErased = true;
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(pt);
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }

  if (!anyErased) return null;

  return groups
    .filter((g) => g.length >= 2 || (g.length === 1 && densePts.length === 1))
    .map((g, idx) =>
      buildStrokeObjectFromWorldPoints(
        idx === 0 ? stroke.id : `${stroke.id}_seg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        g,
        stroke.color,
        stroke.strokeWidth,
        stroke.style,
        stroke.opacity
      )
    );
}

/** Check if a color hex is dark (for adjusting grid/dots/selection contrast on dark boards) */
export function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
}
