import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3
              id="confirm-title"
              className="font-display text-base font-bold text-slate-900"
            >
              {title}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
