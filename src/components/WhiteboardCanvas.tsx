import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  BackgroundPattern,
  HandleId,
  Point,
  ShapeObject,
  StrokeObject,
  TextObject,
  ToolSettings,
  ToolType,
  ViewportState,
  WhiteboardObject,
} from '../types/whiteboard';
import {
  buildStrokeObjectFromWorldPoints,
  computeRotatedResize,
  getObjectCenter,
  getObjectWorldAABB,
  hitTestObject,
  hitTestSelectionHandle,
  isColorDark,
  normalizeAngle,
  radToDeg,
  screenToWorld,
  splitStrokeByEraser,
} from '../utils/geometry';
import { renderScene } from '../utils/renderer';
import { createId } from '../utils/storage';

interface WhiteboardCanvasProps {
  objects: WhiteboardObject[];
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  activeTool: ToolType;
  settings: ToolSettings;
  viewport: ViewportState;
  selectedIds: string[];
  onChangeViewport: (vp: ViewportState) => void;
  onChangeSelectedIds: (ids: string[]) => void;
  onCommitObjects: (newObjects: WhiteboardObject[]) => void;
  onLiveObjectsChange: (newObjects: WhiteboardObject[]) => void;
  onSwitchTool?: (tool: ToolType) => void;
}

type DragMode =
  | { type: 'none' }
  | { type: 'pan'; startScreen: Point; startPan: Point }
  | { type: 'pencil'; worldPoints: Point[]; stroke: StrokeObject }
  | {
      type: 'eraser';
      initialObjects: WhiteboardObject[];
      workingObjects: WhiteboardObject[];
      dirty: boolean;
    }
  | {
      type: 'shape';
      startWorld: Point;
      shape: ShapeObject;
    }
  | {
      type: 'move';
      startWorld: Point;
      initialSnapshots: Record<string, WhiteboardObject>;
      moved: boolean;
    }
  | {
      type: 'resize';
      handle: Exclude<HandleId, 'rotate'>;
      initial: WhiteboardObject;
      resized: boolean;
    }
  | {
      type: 'rotate';
      initial: WhiteboardObject;
      startAngleDeg: number;
      rotated: boolean;
    }
  | {
      type: 'marquee';
      startWorld: Point;
      currentWorld: Point;
    };

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  objects,
  backgroundColor,
  backgroundPattern,
  activeTool,
  settings,
  viewport,
  selectedIds,
  onChangeViewport,
  onChangeSelectedIds,
  onCommitObjects,
  onLiveObjectsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [eraserCursor, setEraserCursor] = useState<{
    x: number;
    y: number;
    radius: number;
  } | null>(null);
  const [rotatingAngle, setRotatingAngle] = useState<number | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('default');

  const dragRef = useRef<DragMode>({ type: 'none' });
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    mid: Point;
    viewport: ViewportState;
  } | null>(null);

  const [activeStroke, setActiveStroke] = useState<StrokeObject | null>(null);
  const [activeShape, setActiveShape] = useState<ShapeObject | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Track container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: Math.max(100, entry.contentRect.width),
          height: Math.max(100, entry.contentRect.height),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spacebar temporary pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !editingTextId &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [editingTextId]);

  // Render canvas whenever state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const targetW = Math.round(size.width * dpr);
    const targetH = Math.round(size.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    renderScene(ctx, {
      backgroundColor,
      backgroundPattern,
      objects,
      viewport,
      width: size.width,
      height: size.height,
      selectedIds,
      editingTextId,
      activeStroke,
      activeShape,
      marqueeRect,
      eraserCursor: activeTool === 'eraser' ? eraserCursor : null,
      showSelectionOverlay: true,
      rotatingAngle,
    });
    ctx.restore();
  }, [
    size,
    backgroundColor,
    backgroundPattern,
    objects,
    viewport,
    selectedIds,
    editingTextId,
    activeStroke,
    activeShape,
    marqueeRect,
    eraserCursor,
    activeTool,
    rotatingAngle,
  ]);

  // Commit inline text edit
  const commitTextEdit = useCallback(() => {
    if (!editingTextId) return;
    const target = objects.find((o) => o.id === editingTextId);
    if (target && target.type === 'text') {
      const cleaned = editingDraft.trimEnd();
      if (cleaned.trim().length === 0) {
        onCommitObjects(objects.filter((o) => o.id !== editingTextId));
        onChangeSelectedIds([]);
      } else {
        // Auto-measure height nicely
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        let measuredH = target.height;
        if (ctx) {
          ctx.save();
          const weight = target.bold ? '700' : '400';
          const style = target.italic ? 'italic' : 'normal';
          ctx.font = `${style} ${weight} ${target.fontSize}px "${target.fontFamily}", sans-serif`;
          const lineCount = Math.max(
            cleaned.split('\n').length,
            textAreaRef.current
              ? Math.ceil(
                  textAreaRef.current.scrollHeight /
                    (target.fontSize * 1.3 * viewport.zoom)
                )
              : 1
          );
          measuredH = Math.max(
            target.fontSize * 1.6 + 16,
            lineCount * target.fontSize * 1.3 + 18
          );
          ctx.restore();
        }

        const next = objects.map((o) =>
          o.id === editingTextId
            ? { ...o, text: cleaned, height: measuredH }
            : o
        );
        onCommitObjects(next);
      }
    }
    setEditingTextId(null);
    setEditingDraft('');
  }, [
    editingTextId,
    editingDraft,
    objects,
    onCommitObjects,
    onChangeSelectedIds,
    viewport.zoom,
  ]);

  // Focus textarea when editing text starts
  useEffect(() => {
    if (editingTextId && textAreaRef.current) {
      const el = textAreaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editingTextId]);

  const getLocalScreenPoint = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const applyEraserAt = (
    currentObjects: WhiteboardObject[],
    worldPt: Point
  ): { next: WhiteboardObject[]; changed: boolean } => {
    const radius = settings.eraserSize / 2;
    let changed = false;

    if (settings.eraserMode === 'object') {
      const next = currentObjects.filter((obj) => {
        const hit = hitTestObject(obj, worldPt, Math.max(8, radius));
        if (hit) changed = true;
        return !hit;
      });
      return { next, changed };
    }

    // Precision partial eraser for strokes, plus hit erase if shape/text touched directly inside
    const next: WhiteboardObject[] = [];
    for (const obj of currentObjects) {
      if (obj.type === 'stroke') {
        const split = splitStrokeByEraser(obj, worldPt, radius);
        if (split === null) {
          next.push(obj);
        } else {
          changed = true;
          next.push(...split);
        }
      } else {
        next.push(obj);
      }
    }
    return { next, changed };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return; // ignore right-click

    if (editingTextId) {
      commitTextEdit();
    }

    const screenPt = getLocalScreenPoint(e);
    pointersRef.current.set(e.pointerId, screenPt);
    e.currentTarget.setPointerCapture(e.pointerId);

    // Two-finger pinch zoom & pan
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values()) as Point[];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const mid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      pinchStartRef.current = {
        dist: Math.max(10, dist),
        mid,
        viewport: { ...viewport },
      };
      // Cancel in-progress drawing
      dragRef.current = { type: 'none' };
      setActiveStroke(null);
      setActiveShape(null);
      setMarqueeRect(null);
      return;
    }

    const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);
    const effectiveTool: ToolType =
      spaceDown || e.button === 1 ? 'pan' : activeTool;

    if (effectiveTool === 'pan') {
      dragRef.current = {
        type: 'pan',
        startScreen: screenPt,
        startPan: { x: viewport.panX, y: viewport.panY },
      };
      return;
    }

    if (effectiveTool === 'pencil') {
      const pts = [worldPt];
      const stroke = buildStrokeObjectFromWorldPoints(
        createId('stroke'),
        pts,
        settings.pencilColor,
        settings.pencilSize,
        settings.pencilStyle,
        settings.pencilOpacity
      );
      dragRef.current = { type: 'pencil', worldPoints: pts, stroke };
      setActiveStroke(stroke);
      onChangeSelectedIds([]);
      return;
    }

    if (effectiveTool === 'eraser') {
      setEraserCursor({
        x: worldPt.x,
        y: worldPt.y,
        radius: settings.eraserSize / 2,
      });
      const { next, changed } = applyEraserAt(objects, worldPt);
      dragRef.current = {
        type: 'eraser',
        initialObjects: objects,
        workingObjects: next,
        dirty: changed,
      };
      if (changed) {
        onLiveObjectsChange(next);
      }
      onChangeSelectedIds([]);
      return;
    }

    if (effectiveTool === 'shape') {
      const isLineLike =
        settings.shapeType === 'line' ||
        settings.shapeType === 'arrow' ||
        settings.shapeType === 'doubleArrow';

      const shape: ShapeObject = {
        id: createId('shape'),
        type: 'shape',
        shapeType: settings.shapeType,
        x: worldPt.x,
        y: worldPt.y,
        width: isLineLike ? 4 : 4,
        height: isLineLike ? Math.max(24, settings.shapeStrokeWidth * 4) : 4,
        rotation: 0,
        opacity: 1,
        strokeColor: settings.shapeStrokeColor,
        fillColor: settings.shapeFillColor,
        strokeWidth: settings.shapeStrokeWidth,
        strokeStyle: settings.shapeStrokeStyle,
      };
      dragRef.current = { type: 'shape', startWorld: worldPt, shape };
      setActiveShape(shape);
      onChangeSelectedIds([]);
      return;
    }

    if (effectiveTool === 'text') {
      // Check if clicking an existing text object to edit it
      const hitExisting = [...objects]
        .reverse()
        .find((o) => o.type === 'text' && hitTestObject(o, worldPt, 6));

      if (hitExisting && hitExisting.type === 'text') {
        onChangeSelectedIds([hitExisting.id]);
        setEditingTextId(hitExisting.id);
        setEditingDraft(hitExisting.text);
        return;
      }

      // Create new text box
      const newText: TextObject = {
        id: createId('text'),
        type: 'text',
        x: worldPt.x,
        y: worldPt.y,
        width: 240,
        height: Math.max(48, settings.textFontSize * 1.6 + 18),
        rotation: 0,
        opacity: 1,
        text: '',
        color: settings.textColor,
        backgroundColor: settings.textBgColor,
        fontSize: settings.textFontSize,
        fontFamily: settings.textFontFamily,
        bold: settings.textBold,
        italic: settings.textItalic,
        underline: settings.textUnderline,
        align: settings.textAlign,
      };
      const next = [...objects, newText];
      onLiveObjectsChange(next);
      onChangeSelectedIds([newText.id]);
      setEditingTextId(newText.id);
      setEditingDraft('');
      return;
    }

    if (effectiveTool === 'select') {
      const isTouch = e.pointerType === 'touch';

      // 1. Check transform handles on single selected object
      if (selectedIds.length === 1) {
        const selObj = objects.find((o) => o.id === selectedIds[0]);
        if (selObj) {
          const handle = hitTestSelectionHandle(
            selObj,
            worldPt,
            viewport.zoom,
            isTouch
          );
          if (handle === 'rotate') {
            const c = getObjectCenter(selObj);
            const startAngle = radToDeg(
              Math.atan2(worldPt.y - c.y, worldPt.x - c.x)
            );
            dragRef.current = {
              type: 'rotate',
              initial: structuredClone(selObj),
              startAngleDeg: startAngle,
              rotated: false,
            };
            setRotatingAngle(selObj.rotation);
            return;
          }
          if (handle) {
            dragRef.current = {
              type: 'resize',
              handle,
              initial: structuredClone(selObj),
              resized: false,
            };
            return;
          }
        }
      }

      // 2. Hit test objects top-to-bottom
      const hitObj = [...objects]
        .reverse()
        .find((o) => hitTestObject(o, worldPt, (isTouch ? 14 : 8) / viewport.zoom));

      if (hitObj) {
        let nextSelected = selectedIds;
        if (e.shiftKey) {
          nextSelected = selectedIds.includes(hitObj.id)
            ? selectedIds.filter((id) => id !== hitObj.id)
            : [...selectedIds, hitObj.id];
          onChangeSelectedIds(nextSelected);
        } else if (!selectedIds.includes(hitObj.id)) {
          nextSelected = [hitObj.id];
          onChangeSelectedIds(nextSelected);
        }

        const snapshots: Record<string, WhiteboardObject> = {};
        for (const o of objects) {
          if (nextSelected.includes(o.id)) {
            snapshots[o.id] = structuredClone(o);
          }
        }
        dragRef.current = {
          type: 'move',
          startWorld: worldPt,
          initialSnapshots: snapshots,
          moved: false,
        };
        return;
      }

      // 3. Empty canvas -> start marquee selection
      if (!e.shiftKey) {
        onChangeSelectedIds([]);
      }
      dragRef.current = {
        type: 'marquee',
        startWorld: worldPt,
        currentWorld: worldPt,
      };
      setMarqueeRect({ x: worldPt.x, y: worldPt.y, width: 0, height: 0 });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const screenPt = getLocalScreenPoint(e);
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, screenPt);
    }

    // Pinch-to-zoom & two-finger pan
    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values()) as Point[];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const mid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };

      const start = pinchStartRef.current;
      const scale = dist / start.dist;
      const newZoom = Math.max(0.15, Math.min(4, start.viewport.zoom * scale));

      const worldAtStartMid = screenToWorld(
        start.mid.x,
        start.mid.y,
        start.viewport
      );
      const newPanX = mid.x - worldAtStartMid.x * newZoom;
      const newPanY = mid.y - worldAtStartMid.y * newZoom;

      onChangeViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
      return;
    }

    const worldPt = screenToWorld(screenPt.x, screenPt.y, viewport);

    // Update eraser ring & hover cursor when idle
    if (activeTool === 'eraser') {
      setEraserCursor({
        x: worldPt.x,
        y: worldPt.y,
        radius: settings.eraserSize / 2,
      });
    } else if (eraserCursor) {
      setEraserCursor(null);
    }

    const drag = dragRef.current;

    if (drag.type === 'none') {
      // Update cursor affordance on hover
      if (spaceDown || activeTool === 'pan') {
        setHoverCursor('grab');
      } else if (activeTool === 'pencil' || activeTool === 'shape') {
        setHoverCursor('crosshair');
      } else if (activeTool === 'text') {
        setHoverCursor('text');
      } else if (activeTool === 'eraser') {
        setHoverCursor('none');
      } else if (activeTool === 'select') {
        if (selectedIds.length === 1) {
          const sel = objects.find((o) => o.id === selectedIds[0]);
          if (sel) {
            const h = hitTestSelectionHandle(sel, worldPt, viewport.zoom, false);
            if (h === 'rotate') {
              setHoverCursor('grab');
              return;
            }
            if (h === 'nw' || h === 'se') {
              setHoverCursor('nwse-resize');
              return;
            }
            if (h === 'ne' || h === 'sw') {
              setHoverCursor('nesw-resize');
              return;
            }
            if (h === 'n' || h === 's') {
              setHoverCursor('ns-resize');
              return;
            }
            if (h === 'e' || h === 'w') {
              setHoverCursor('ew-resize');
              return;
            }
          }
        }
        const hit = [...objects]
          .reverse()
          .find((o) => hitTestObject(o, worldPt, 8 / viewport.zoom));
        setHoverCursor(hit ? 'move' : 'default');
      }
      return;
    }

    if (drag.type === 'pan') {
      setHoverCursor('grabbing');
      const dx = screenPt.x - drag.startScreen.x;
      const dy = screenPt.y - drag.startScreen.y;
      onChangeViewport({
        ...viewport,
        panX: drag.startPan.x + dx,
        panY: drag.startPan.y + dy,
      });
      return;
    }

    if (drag.type === 'pencil') {
      const last = drag.worldPoints[drag.worldPoints.length - 1];
      if (Math.hypot(worldPt.x - last.x, worldPt.y - last.y) >= 1.5 / viewport.zoom) {
        drag.worldPoints.push(worldPt);
        const updated = buildStrokeObjectFromWorldPoints(
          drag.stroke.id,
          drag.worldPoints,
          drag.stroke.color,
          drag.stroke.strokeWidth,
          drag.stroke.style,
          drag.stroke.opacity
        );
        drag.stroke = updated;
        setActiveStroke(updated);
      }
      return;
    }

    if (drag.type === 'eraser') {
      const { next, changed } = applyEraserAt(drag.workingObjects, worldPt);
      if (changed) {
        drag.workingObjects = next;
        drag.dirty = true;
        onLiveObjectsChange(next);
      }
      return;
    }

    if (drag.type === 'shape') {
      const s = drag.startWorld;
      let dx = worldPt.x - s.x;
      let dy = worldPt.y - s.y;

      const isLineLike =
        drag.shape.shapeType === 'line' ||
        drag.shape.shapeType === 'arrow' ||
        drag.shape.shapeType === 'doubleArrow';

      if (isLineLike) {
        let angle = Math.atan2(dy, dx);
        let len = Math.hypot(dx, dy);
        if (e.shiftKey) {
          const snap = Math.PI / 4;
          angle = Math.round(angle / snap) * snap;
        }
        const midX = s.x + (Math.cos(angle) * len) / 2;
        const midY = s.y + (Math.sin(angle) * len) / 2;
        const h = Math.max(24, drag.shape.strokeWidth * 4);
        const w = Math.max(4, len);
        const updated: ShapeObject = {
          ...drag.shape,
          x: midX - w / 2,
          y: midY - h / 2,
          width: w,
          height: h,
          rotation: normalizeAngle(radToDeg(angle)),
        };
        drag.shape = updated;
        setActiveShape(updated);
        return;
      }

      if (e.shiftKey) {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        dx = dx >= 0 ? side : -side;
        dy = dy >= 0 ? side : -side;
      }

      const x = dx >= 0 ? s.x : s.x + dx;
      const y = dy >= 0 ? s.y : s.y + dy;
      const width = Math.max(4, Math.abs(dx));
      const height = Math.max(4, Math.abs(dy));

      const updated: ShapeObject = {
        ...drag.shape,
        x,
        y,
        width,
        height,
      };
      drag.shape = updated;
      setActiveShape(updated);
      return;
    }

    if (drag.type === 'move') {
      const dx = worldPt.x - drag.startWorld.x;
      const dy = worldPt.y - drag.startWorld.y;
      if (Math.hypot(dx, dy) > 1) drag.moved = true;
      const next = objects.map((obj) => {
        const snap = drag.initialSnapshots[obj.id];
        if (!snap) return obj;
        return {
          ...obj,
          x: snap.x + dx,
          y: snap.y + dy,
        };
      });
      onLiveObjectsChange(next);
      return;
    }

    if (drag.type === 'resize') {
      drag.resized = true;
      const keepAspect = settings.keepAspectRatio || e.shiftKey;
      const patch = computeRotatedResize(
        drag.initial,
        drag.handle,
        worldPt,
        keepAspect
      );
      const next = objects.map((obj) =>
        obj.id === drag.initial.id ? ({ ...obj, ...patch } as WhiteboardObject) : obj
      );
      onLiveObjectsChange(next);
      return;
    }

    if (drag.type === 'rotate') {
      drag.rotated = true;
      const c = getObjectCenter(drag.initial);
      const currentAngle = radToDeg(
        Math.atan2(worldPt.y - c.y, worldPt.x - c.x)
      );
      let newRot = drag.initial.rotation + (currentAngle - drag.startAngleDeg);
      if (e.shiftKey) {
        newRot = Math.round(newRot / 15) * 15;
      }
      const norm = normalizeAngle(newRot);
      setRotatingAngle(norm);
      const next = objects.map((obj) =>
        obj.id === drag.initial.id ? { ...obj, rotation: norm } : obj
      );
      onLiveObjectsChange(next);
      return;
    }

    if (drag.type === 'marquee') {
      drag.currentWorld = worldPt;
      const x = Math.min(drag.startWorld.x, worldPt.x);
      const y = Math.min(drag.startWorld.y, worldPt.y);
      const width = Math.abs(worldPt.x - drag.startWorld.x);
      const height = Math.abs(worldPt.y - drag.startWorld.y);
      setMarqueeRect({ x, y, width, height });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const drag = dragRef.current;
    dragRef.current = { type: 'none' };
    setRotatingAngle(null);

    if (drag.type === 'pencil') {
      const committed = drag.stroke;
      setActiveStroke(null);
      onCommitObjects([...objects, committed]);
      return;
    }

    if (drag.type === 'eraser') {
      if (drag.dirty) {
        onCommitObjects(drag.workingObjects);
      }
      return;
    }

    if (drag.type === 'shape') {
      let finalShape = drag.shape;
      setActiveShape(null);
      // If user clicked without dragging, drop a clean default-sized shape
      const isLineLike =
        finalShape.shapeType === 'line' ||
        finalShape.shapeType === 'arrow' ||
        finalShape.shapeType === 'doubleArrow';
      if (finalShape.width < 12 && finalShape.height < 12) {
        finalShape = {
          ...finalShape,
          x: finalShape.x - 60,
          y: finalShape.y - (isLineLike ? 12 : 60),
          width: 120,
          height: isLineLike ? 24 : 120,
        };
      } else if (isLineLike && finalShape.width < 12) {
        finalShape = {
          ...finalShape,
          width: 120,
        };
      }
      onCommitObjects([...objects, finalShape]);
      return;
    }

    if (drag.type === 'move') {
      if (drag.moved) {
        onCommitObjects(objects);
      }
      return;
    }

    if (drag.type === 'resize' || drag.type === 'rotate') {
      if (
        (drag.type === 'resize' && drag.resized) ||
        (drag.type === 'rotate' && drag.rotated)
      ) {
        onCommitObjects(objects);
      }
      return;
    }

    if (drag.type === 'marquee') {
      const x1 = Math.min(drag.startWorld.x, drag.currentWorld.x);
      const y1 = Math.min(drag.startWorld.y, drag.currentWorld.y);
      const x2 = Math.max(drag.startWorld.x, drag.currentWorld.x);
      const y2 = Math.max(drag.startWorld.y, drag.currentWorld.y);
      setMarqueeRect(null);

      if (x2 - x1 > 4 || y2 - y1 > 4) {
        const hits = objects
          .filter((o) => {
            const b = getObjectWorldAABB(o);
            return !(
              b.maxX < x1 ||
              b.minX > x2 ||
              b.maxY < y1 ||
              b.minY > y2
            );
          })
          .map((o) => o.id);
        onChangeSelectedIds(hits);
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const worldPt = screenToWorld(
      e.clientX - rect.left,
      e.clientY - rect.top,
      viewport
    );
    const hitText = [...objects]
      .reverse()
      .find((o) => o.type === 'text' && hitTestObject(o, worldPt, 8));
    if (hitText && hitText.type === 'text') {
      onChangeSelectedIds([hitText.id]);
      setEditingTextId(hitText.id);
      setEditingDraft(hitText.text);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.004);
      const newZoom = Math.max(0.15, Math.min(4, viewport.zoom * factor));
      const world = screenToWorld(sx, sy, viewport);
      onChangeViewport({
        zoom: newZoom,
        panX: sx - world.x * newZoom,
        panY: sy - world.y * newZoom,
      });
    } else {
      // Pan with wheel / trackpad
      const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
      const dy = e.shiftKey ? 0 : -e.deltaY;
      onChangeViewport({
        ...viewport,
        panX: viewport.panX + dx,
        panY: viewport.panY + dy,
      });
    }
  };

  const editingObj = editingTextId
    ? (objects.find((o) => o.id === editingTextId && o.type === 'text') as
        | TextObject
        | undefined)
    : undefined;

  const isDarkBg = isColorDark(backgroundColor);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-canvas"
      style={{ backgroundColor }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setEraserCursor(null)}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{ cursor: hoverCursor }}
        className="block w-full h-full touch-canvas"
      />

      {/* Empty Canvas Gentle Hint (disappears immediately when user draws or adds anything) */}
      {objects.length === 0 && !activeStroke && !activeShape && !editingTextId && (
        <div className="no-print pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div
            className={`text-center max-w-xs transition-opacity ${
              isDarkBg ? 'text-slate-400' : 'text-slate-400'
            }`}
          >
            <p className="font-display text-base font-semibold tracking-tight">
              Start drawing or writing anywhere
            </p>
            <p className="text-xs mt-1 leading-relaxed opacity-85">
              Use Pencil, Shapes, or Text from the toolbar. Pinch or scroll to
              zoom and pan.
            </p>
          </div>
        </div>
      )}

      {/* Inline Rotated Text Editor Overlay */}
      {editingObj && (
        <textarea
          ref={textAreaRef}
          value={editingDraft}
          onChange={(e) => setEditingDraft(e.target.value)}
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              commitTextEdit();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              commitTextEdit();
            }
          }}
          placeholder="Type text..."
          style={{
            position: 'absolute',
            left: `${editingObj.x * viewport.zoom + viewport.panX}px`,
            top: `${editingObj.y * viewport.zoom + viewport.panY}px`,
            width: `${Math.max(140, editingObj.width * viewport.zoom)}px`,
            minHeight: `${editingObj.height * viewport.zoom}px`,
            transform: `rotate(${editingObj.rotation}deg)`,
            transformOrigin: 'center center',
            fontFamily: `"${editingObj.fontFamily}", sans-serif`,
            fontSize: `${editingObj.fontSize * viewport.zoom}px`,
            fontWeight: editingObj.bold ? 700 : 400,
            fontStyle: editingObj.italic ? 'italic' : 'normal',
            textDecoration: editingObj.underline ? 'underline' : 'none',
            textAlign: editingObj.align,
            color: editingObj.color,
            backgroundColor:
              editingObj.backgroundColor !== 'transparent'
                ? editingObj.backgroundColor
                : 'rgba(255, 255, 255, 0.85)',
            lineHeight: 1.3,
            padding: `${8 * viewport.zoom}px`,
          }}
          className="z-20 rounded-lg border-2 border-blue-600 shadow-lg outline-none resize-both overflow-hidden"
        />
      )}
    </div>
  );
};
