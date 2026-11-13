import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Printer,
  Share2,
  FileText,
  Image as ImageIcon,
  Check,
  Copy,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  BackgroundPattern,
  PaperOrientation,
  PaperSize,
  ViewportState,
  WhiteboardObject,
} from '../types/whiteboard';
import {
  exportAs4KPNG,
  exportAsJPG,
  exportAsPDF,
  exportAsPNG,
  renderOffscreenCanvas,
  shareWhiteboardImage,
} from '../utils/exportUtils';
import { ADMOB_REWARDED_TEST_AD_UNIT_ID } from '../utils/rewardedAds';

interface ExportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  objects: WhiteboardObject[];
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  fallbackViewport: { width: number; height: number; viewport: ViewportState };
  onPrintSheetReady: (dataUrl: string, paperSize: PaperSize, orientation: PaperOrientation) => void;
  rewardUnlocked: boolean;
  onWatchRewardedAd: (onGranted: () => void) => void;
}

export const ExportPrintModal: React.FC<ExportPrintModalProps> = ({
  isOpen,
  onClose,
  title,
  objects,
  backgroundColor,
  backgroundPattern,
  fallbackViewport,
  onPrintSheetReady,
  rewardUnlocked,
  onWatchRewardedAd,
}) => {
  const [includePattern, setIncludePattern] = useState(true);
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<PaperOrientation>('auto');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = renderOffscreenCanvas({
      objects,
      backgroundColor,
      backgroundPattern,
      includePattern,
      scale: 1,
      padding: 40,
      fallbackViewport,
    });
    setPreviewUrl(canvas.toDataURL('image/png'));
  }, [isOpen, objects, backgroundColor, backgroundPattern, includePattern, fallbackViewport]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const exportOpts = {
    objects,
    backgroundColor,
    backgroundPattern,
    includePattern,
    fallbackViewport,
  };

  const handleCopyClipboard = async () => {
    try {
      const canvas = renderOffscreenCanvas({ ...exportOpts, scale: 2 });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (blob && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        showToast('Copied image to clipboard');
      } else {
        exportAsPNG(title, exportOpts);
        showToast('Downloaded PNG');
      }
    } catch {
      exportAsPNG(title, exportOpts);
      showToast('Downloaded PNG');
    }
  };

  const handleShare = async () => {
    const res = await shareWhiteboardImage(title, exportOpts);
    showToast(res === 'shared' ? 'Shared whiteboard' : 'Downloaded PNG to share');
  };

  const handlePrint = () => {
    const canvas = renderOffscreenCanvas({
      ...exportOpts,
      transparentBg: false,
      scale: 2,
    });
    const url = canvas.toDataURL('image/png');
    onPrintSheetReady(url, paperSize, orientation);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2
              id="export-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Export, Share &amp; Print
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {title} · High-resolution output
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto thin-scrollbar space-y-5">
          {/* Live Preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center gap-2.5">
            <div className="w-full h-44 rounded-lg overflow-hidden border border-slate-200/80 bg-white flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Whiteboard export preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">Rendering preview…</span>
              )}
            </div>
            <div className="w-full flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePattern}
                  onChange={(e) => setIncludePattern(e.target.checked)}
                  className="rounded accent-blue-600 w-4 h-4"
                />
                <span>Include canvas grid / pattern</span>
              </label>

              {feedback && (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  {feedback}
                </span>
              )}
            </div>
          </div>

          {/* Image & Share Actions */}
          <div>
            <h3 className="text-xs font-semibold text-slate-800 mb-2.5">
              Download Image &amp; Share
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  exportAsPNG(title, exportOpts);
                  showToast('Saved PNG image');
                }}
                className="h-10 px-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Download PNG
              </button>

              <button
                type="button"
                onClick={() => {
                  exportAsPNG(`${title}-transparent`, {
                    ...exportOpts,
                    transparentBg: true,
                  });
                  showToast('Saved transparent PNG');
                }}
                className="h-10 px-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-slate-600" />
                Transparent PNG
              </button>

              <button
                type="button"
                onClick={() => {
                  exportAsJPG(title, exportOpts);
                  showToast('Saved JPG image');
                }}
                className="h-10 px-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-amber-600" />
                Download JPG
              </button>

              <button
                type="button"
                onClick={handleCopyClipboard}
                className="h-10 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Copy className="w-4 h-4 text-slate-500" />
                Copy Image
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="col-span-1 sm:col-span-2 h-10 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4 text-blue-600" />
                Share File
              </button>
            </div>

            {/* Rewarded Test Ad — 4K Ultra-HD PNG Export */}
            <div className="mt-3 rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>4K Ultra-HD PNG Export</span>
                  {rewardUnlocked && (
                    <span className="text-emerald-700 font-medium">
                      · Unlocked
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Rewarded Test Ad · {ADMOB_REWARDED_TEST_AD_UNIT_ID}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {rewardUnlocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        exportAs4KPNG(title, exportOpts);
                        showToast('Saved 4K Ultra-HD PNG');
                      }}
                      className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download 4K PNG
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onWatchRewardedAd(() => {
                          showToast('Rewarded test ad completed');
                        })
                      }
                      className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3 h-3" />
                      Test Ad
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onWatchRewardedAd(() => {
                        exportAs4KPNG(title, exportOpts);
                        showToast('Unlocked & saved 4K Ultra-HD PNG');
                      })
                    }
                    className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Watch Ad to Unlock 4K
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* PDF & Direct Print */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-800 mb-2.5">
              PDF Document &amp; Direct Print
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                <span>Paper Size</span>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium outline-none focus:border-blue-500"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                  <option value="legal">US Legal (8.5 × 14 in)</option>
                  <option value="a3">A3 (297 × 420 mm)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-600">
                <span>Orientation</span>
                <select
                  value={orientation}
                  onChange={(e) =>
                    setOrientation(e.target.value as PaperOrientation)
                  }
                  className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium outline-none focus:border-blue-500"
                >
                  <option value="auto">Auto-fit</option>
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  exportAsPDF(title, exportOpts, paperSize, orientation);
                  showToast(`Saved ${paperSize.toUpperCase()} PDF`);
                }}
                className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                Save as PDF ({paperSize.toUpperCase()})
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Whiteboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
