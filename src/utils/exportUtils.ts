import { jsPDF } from 'jspdf';
import {
  BackgroundPattern,
  PaperOrientation,
  PaperSize,
  ViewportState,
  WhiteboardObject,
} from '../types/whiteboard';
import { getCombinedWorldAABB } from './geometry';
import { renderScene } from './renderer';

export interface ExportSceneOptions {
  objects: WhiteboardObject[];
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  includePattern?: boolean;
  transparentBg?: boolean;
  scale?: number;
  padding?: number;
  fallbackViewport?: { width: number; height: number; viewport: ViewportState };
}

export function renderOffscreenCanvas(opts: ExportSceneOptions): HTMLCanvasElement {
  const {
    objects,
    backgroundColor,
    backgroundPattern,
    includePattern = true,
    transparentBg = false,
    scale = 2,
    padding = 48,
    fallbackViewport,
  } = opts;

  const bounds = getCombinedWorldAABB(objects);

  let worldX = 0;
  let worldY = 0;
  let worldW = fallbackViewport?.width ?? 1280;
  let worldH = fallbackViewport?.height ?? 800;

  if (bounds) {
    worldX = bounds.x - padding;
    worldY = bounds.y - padding;
    worldW = Math.max(320, bounds.width + padding * 2);
    worldH = Math.max(240, bounds.height + padding * 2);
  } else if (fallbackViewport) {
    worldX = -fallbackViewport.viewport.panX / fallbackViewport.viewport.zoom;
    worldY = -fallbackViewport.viewport.panY / fallbackViewport.viewport.zoom;
    worldW = fallbackViewport.width / fallbackViewport.viewport.zoom;
    worldH = fallbackViewport.height / fallbackViewport.viewport.zoom;
  }

  // Cap max pixel dimensions to avoid browser canvas memory limits
  const maxDim = 4096;
  const effectiveScale = Math.min(
    scale,
    maxDim / Math.max(1, worldW),
    maxDim / Math.max(1, worldH)
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(worldW * effectiveScale));
  canvas.height = Math.max(1, Math.round(worldH * effectiveScale));

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (transparentBg) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(effectiveScale, effectiveScale);
    ctx.translate(-worldX, -worldY);
    renderScene(ctx, {
      backgroundColor: 'rgba(0,0,0,0)',
      backgroundPattern: 'blank',
      objects,
      viewport: { panX: 0, panY: 0, zoom: 1 },
      width: worldW,
      height: worldH,
      selectedIds: [],
      editingTextId: null,
      showSelectionOverlay: false,
    });
    ctx.restore();
  } else {
    renderScene(ctx, {
      backgroundColor,
      backgroundPattern: includePattern ? backgroundPattern : 'blank',
      objects,
      viewport: {
        panX: -worldX * effectiveScale,
        panY: -worldY * effectiveScale,
        zoom: effectiveScale,
      },
      width: canvas.width,
      height: canvas.height,
      selectedIds: [],
      editingTextId: null,
      showSelectionOverlay: false,
    });
  }

  return canvas;
}

export function generateProjectThumbnail(
  objects: WhiteboardObject[],
  backgroundColor: string,
  backgroundPattern: BackgroundPattern
): string {
  const canvas = renderOffscreenCanvas({
    objects,
    backgroundColor,
    backgroundPattern,
    includePattern: true,
    scale: 0.35,
    padding: 36,
  });

  // Normalize thumbnail to max 320px wide
  const maxThumbW = 320;
  if (canvas.width <= maxThumbW) {
    return canvas.toDataURL('image/jpeg', 0.72);
  }
  const ratio = maxThumbW / canvas.width;
  const thumb = document.createElement('canvas');
  thumb.width = maxThumbW;
  thumb.height = Math.max(1, Math.round(canvas.height * ratio));
  const tctx = thumb.getContext('2d');
  if (tctx) {
    tctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  }
  return thumb.toDataURL('image/jpeg', 0.72);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function sanitizeFilename(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'smart-whiteboard'
  );
}

export function exportAsPNG(
  title: string,
  opts: ExportSceneOptions
): void {
  const canvas = renderOffscreenCanvas({ ...opts, scale: 2 });
  const url = canvas.toDataURL('image/png');
  downloadDataUrl(url, `${sanitizeFilename(title)}.png`);
}

export function exportAs4KPNG(
  title: string,
  opts: ExportSceneOptions
): void {
  const canvas = renderOffscreenCanvas({ ...opts, scale: 4 });
  const url = canvas.toDataURL('image/png');
  downloadDataUrl(url, `${sanitizeFilename(title)}-4k.png`);
}

export function exportAsJPG(
  title: string,
  opts: ExportSceneOptions
): void {
  const canvas = renderOffscreenCanvas({
    ...opts,
    transparentBg: false,
    scale: 2,
  });
  const url = canvas.toDataURL('image/jpeg', 0.94);
  downloadDataUrl(url, `${sanitizeFilename(title)}.jpg`);
}

export function exportAsPDF(
  title: string,
  opts: ExportSceneOptions,
  paperSize: PaperSize = 'a4',
  orientation: PaperOrientation = 'auto'
): void {
  const canvas = renderOffscreenCanvas({
    ...opts,
    transparentBg: false,
    scale: 2,
  });

  const resolvedOrientation: 'portrait' | 'landscape' =
    orientation === 'auto'
      ? canvas.width >= canvas.height
        ? 'landscape'
        : 'portrait'
      : orientation;

  const pdf = new jsPDF({
    orientation: resolvedOrientation,
    unit: 'mm',
    format: paperSize,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;

  const imgRatio = canvas.width / Math.max(1, canvas.height);
  let drawW = availW;
  let drawH = drawW / imgRatio;
  if (drawH > availH) {
    drawH = availH;
    drawW = drawH * imgRatio;
  }

  const offsetX = (pageW - drawW) / 2;
  const offsetY = (pageH - drawH) / 2;

  // Fill page background subtly if board is dark
  if (opts.backgroundColor && opts.backgroundColor !== '#FFFFFF') {
    pdf.setFillColor(opts.backgroundColor);
    pdf.rect(0, 0, pageW, pageH, 'F');
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.94);
  pdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH);
  pdf.save(`${sanitizeFilename(title)}.pdf`);
}

export async function shareWhiteboardImage(
  title: string,
  opts: ExportSceneOptions
): Promise<'shared' | 'downloaded'> {
  const canvas = renderOffscreenCanvas({ ...opts, transparentBg: false, scale: 2 });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );

  if (blob && typeof navigator !== 'undefined' && navigator.share) {
    const file = new File([blob], `${sanitizeFilename(title)}.png`, {
      type: 'image/png',
    });
    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title,
          text: `Whiteboard: ${title}`,
          files: [file],
        });
        return 'shared';
      } catch (err) {
        // User cancelled or share unsupported in iframe -> fall back to download
        if ((err as Error)?.name === 'AbortError') {
          return 'shared';
        }
      }
    }
  }

  const url = canvas.toDataURL('image/png');
  downloadDataUrl(url, `${sanitizeFilename(title)}.png`);
  return 'downloaded';
}
