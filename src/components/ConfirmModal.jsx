import React from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

/**
 * Confirmation modal shown when user tries to un-check an attendance.
 *
 * @param {string}   studentName
 * @param {string}   examName
 * @param {function} onConfirm  - called when user confirms removal
 * @param {function} onCancel   - called when user cancels
 */
export default function ConfirmModal({ studentName, examName, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-900/40 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-lg leading-tight">
              Yoklamayı Kaldır?
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Bu işlem geri alınamaz.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Student + Exam info */}
        <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-slate-700">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <span>Öğrenci</span>
          </div>
          <p className="text-white font-semibold">{studentName}</p>
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-3 mb-1">
            <span>Sınav</span>
          </div>
          <p className="text-indigo-300 font-medium">{examName}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            id="confirm-modal-cancel"
            onClick={onCancel}
            className="btn-ghost flex-1"
          >
            İptal
          </button>
          <button
            id="confirm-modal-remove"
            onClick={onConfirm}
            className="btn-danger flex-1"
          >
            <Trash2 size={16} />
            Kaldır
          </button>
        </div>
      </div>
    </div>
  );
}
