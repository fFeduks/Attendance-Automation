import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle } from 'lucide-react';
import { useAttendance } from '../store/useAttendanceStore';

// localStorage key for remembering the last selected exam
const LAST_EXAM_KEY = 'attendance_last_exam_id';

/**
 * AddGuestModal
 * @param {Function} onClose       - close callback
 * @param {string}   initialQuery  - Task 6: pre-fill name/surname from search query
 */
export default function AddGuestModal({ onClose, initialQuery = '' }) {
  const { activeExams, addGuest } = useAttendance();

  // ── Task 6: Parse initialQuery into name/surname ────────────────────────
  // Split by spaces; last word → surname, rest → name
  // e.g. "Ahmet Yılmaz Can" → name: "Ahmet Yılmaz", surname: "Can"
  const parseQuery = (query) => {
    const parts = query.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { parsedName: '', parsedSurname: '' };
    if (parts.length === 1) return { parsedName: parts[0], parsedSurname: '' };
    const parsedSurname = parts[parts.length - 1];
    const parsedName    = parts.slice(0, -1).join(' ');
    return { parsedName, parsedSurname };
  };

  const { parsedName, parsedSurname } = parseQuery(initialQuery);

  const [name,    setName]    = useState(parsedName);
  const [surname, setSurname] = useState(parsedSurname);

  // ── Task 7: Remember last selected exam ────────────────────────────────
  const getInitialExamId = () => {
    if (activeExams.length === 0) return '';
    const stored = localStorage.getItem(LAST_EXAM_KEY);
    if (stored) {
      const storedNum = Number(stored);
      const found = activeExams.find(e => e.id === storedNum);
      if (found) return String(found.id);
    }
    return String(activeExams[0].id);
  };

  const [examId, setExamId] = useState(getInitialExamId);

  // Keep examId in sync if activeExams loads after mount (edge case)
  useEffect(() => {
    if (!examId && activeExams.length > 0) {
      setExamId(getInitialExamId());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExams]);

  const handleExamChange = (e) => {
    const val = e.target.value;
    setExamId(val);
    // Task 7: persist selection
    localStorage.setItem(LAST_EXAM_KEY, val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !surname.trim() || !examId) return;
    // Normalize to Turkish uppercase before saving
    const formattedName    = name.trim().toLocaleUpperCase('tr-TR');
    const formattedSurname = surname.trim().toLocaleUpperCase('tr-TR');
    // Also persist the chosen exam for next time
    localStorage.setItem(LAST_EXAM_KEY, examId);
    // addGuest handles both inserting the student and marking attendance
    addGuest(formattedName, formattedSurname, examId);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-indigo-900/60 flex items-center justify-center flex-shrink-0">
            <UserPlus size={18} className="text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-semibold text-lg leading-tight">Öğrenci Ekle</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">

          {/* Name */}
          <div>
            <label htmlFor="guest-name" className="block text-xs text-slate-400 mb-1 font-medium">
              Ad
            </label>
            <input
              id="guest-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Öğrencinin adı"
              className="input-field"
              autoFocus
              required
            />
          </div>

          {/* Surname */}
          <div>
            <label htmlFor="guest-surname" className="block text-xs text-slate-400 mb-1 font-medium">
              Soyad
            </label>
            <input
              id="guest-surname"
              type="text"
              value={surname}
              onChange={e => setSurname(e.target.value)}
              placeholder="Öğrencinin soyadı"
              className="input-field"
              required
            />
          </div>

          {/* Exam selector */}
          {activeExams.length > 0 ? (
            <div>
              <label htmlFor="guest-exam" className="block text-xs text-slate-400 mb-1 font-medium">
                Sınav
              </label>
              <select
                id="guest-exam"
                value={examId}
                onChange={handleExamChange}
                className="input-field appearance-none"
                required
              >
                {activeExams.map(exam => (
                  <option key={exam.id} value={exam.id}>
                    {exam.exam_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-amber-400 text-sm bg-amber-900/20 border border-amber-800/40 rounded-xl px-3 py-2.5">
              Aktif sınav bulunamadı. Önce Yönetim ekranından bir sınav ekleyin.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              İptal
            </button>
            <button
              id="add-guest-submit"
              type="submit"
              className="btn-primary flex-1"
              disabled={!name.trim() || !surname.trim() || !examId}
            >
              <UserPlus size={16} />
              Ekle
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
