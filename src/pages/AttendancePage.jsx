import React, { useState, useRef } from 'react';
import { Search, UserPlus, Download, Save, X, Check, Trash2, Loader2 } from 'lucide-react';
import { useAttendance } from '../store/useAttendanceStore';
import { getAttendanceKey } from '../lib/localStorage';
import { exportToExcel } from '../lib/exportExcel';
import ConfirmModal from '../components/ConfirmModal';
import AddGuestModal from '../components/AddGuestModal';
import SyncStatus from '../components/SyncStatus';

export default function AttendancePage() {
  const {
    filteredStudents, activeExams, attendanceMap,
    students, searchQuery, syncStatus, loading,
    setSearch, toggleAttendance, syncToSupabase, removeGuest,
  } = useAttendance();

  const [confirmState,       setConfirmState]       = useState(null);
  const [confirmRemoveGuest, setConfirmRemoveGuest] = useState(null);
  const [showGuestModal,     setShowGuestModal]     = useState(false);
  const [exporting,          setExporting]          = useState(false);

  // Auto-clear: when user blurs the search box and later refocuses, start fresh
  const shouldClearOnFocus = useRef(false);

  const handleToggle = (student, exam) => {
    const key = getAttendanceKey(student.id, exam.id);
    if (attendanceMap[key]) {
      setConfirmState({
        studentId:   student.id,
        examId:      exam.id,
        studentName: `${student.name} ${student.surname}`,
        examName:    exam.exam_name,
      });
    } else {
      toggleAttendance(student.id, exam.id);
    }
  };

  const handleConfirmRemove = () => {
    if (confirmState) {
      toggleAttendance(confirmState.studentId, confirmState.examId);
      setConfirmState(null);
    }
  };

  const handleConfirmRemoveGuest = async () => {
    if (confirmRemoveGuest) {
      await removeGuest(confirmRemoveGuest.studentId);
      setConfirmRemoveGuest(null);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportToExcel(students, activeExams, attendanceMap);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  const guestCount   = (filteredStudents || []).filter(s =>  s.is_guest).length;
  const regularCount = (filteredStudents || []).filter(s => !s.is_guest).length;

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-950">
        <div className="w-12 h-12 rounded-2xl bg-indigo-900/50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">

      {/* ═══════════════════════════════════════════════
          HEADER — pinned, never scrolls
      ═══════════════════════════════════════════════ */}
      <header className="flex-shrink-0 bg-slate-950 border-b border-slate-800 px-3 pt-3 pb-2 space-y-2">

        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-white font-bold text-base leading-tight">Yoklama</h1>
            <p className="text-slate-500 text-[11px]">
              {regularCount} öğrenci
              {guestCount > 0 && ` · ${guestCount} misafir`}
              {searchQuery && ' (filtrelendi)'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              id="add-guest-btn"
              onClick={() => setShowGuestModal(true)}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
              title="Hızlı Öğrenci Ekle"
            >
              <UserPlus size={16} />
            </button>
            <button
              id="export-excel-btn"
              onClick={handleExport}
              disabled={exporting}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors disabled:opacity-50"
              title="Excel'e Aktar"
            >
              {exporting
                ? <Loader2 size={15} className="animate-spin" />
                : <Download size={16} />
              }
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            id="search-students"
            type="text"
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            onBlur={() => {
              // Mark that next focus should clear the field
              if (searchQuery.trim()) shouldClearOnFocus.current = true;
            }}
            onFocus={() => {
              if (shouldClearOnFocus.current) {
                shouldClearOnFocus.current = false;
                setSearch('');
              }
            }}
            placeholder="Öğrenci ara... (misafirler dahil)"
            className="input-field pl-9 pr-9 text-sm"
          />
          {searchQuery && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSearch('');
                shouldClearOnFocus.current = false;
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="Aramayı temizle"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════
          MAIN — flex-1, only this section scrolls
      ═══════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">

          {filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 pb-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                <Search size={20} className="text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm text-center px-8">
                {searchQuery
                  ? `"${searchQuery}" ile eşleşen öğrenci yok`
                  : 'Henüz öğrenci yok'}
              </p>
            </div>
          ) : (
            /*
             * TABLE LAYOUT
             * ─ The <div> above handles overflow:auto for BOTH axes.
             * ─ The table uses w-max so it expands as needed horizontally.
             * ─ min-w-full ensures it fills the container when few exams exist.
             * ─ <thead> is sticky top-0 (relative to the scrolling div).
             * ─ First <td>/<th> is sticky left-0 (relative to same container).
             */
            <table
              className="w-max min-w-full"
              style={{ borderSpacing: 0, borderCollapse: 'separate' }}
            >
              {/* ── Column Headers ───────────────────────────────────────── */}
              <thead className="sticky top-0 z-20">
                <tr>
                  {/* Sticky corner: "Öğrenci" */}
                  <th
                    className="sticky left-0 z-30 bg-slate-900 w-24 min-w-[6rem] max-w-[6rem] px-2 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-r border-slate-700"
                    style={{ boxShadow: '3px 0 10px rgba(0,0,0,0.45)' }}
                  >
                    Öğrenci
                  </th>

                  {/* One column per active exam */}
                  {activeExams.map(exam => (
                    <th
                      key={exam.id}
                      className="bg-slate-900 px-1 py-2 text-center text-[10px] font-semibold text-slate-400 uppercase w-14 min-w-[3.5rem] border-b border-slate-700"
                      title={exam.exam_name}
                    >
                      <span className="block whitespace-normal break-words leading-tight max-w-[52px] mx-auto">
                        {exam.exam_name}
                      </span>
                    </th>
                  ))}

                  {/* Spacer for remove-guest button */}
                  <th className="bg-slate-900 w-8 border-b border-slate-700" />
                </tr>
              </thead>

              {/* ── Student Rows ──────────────────────────────────────────── */}
              <tbody>
                {filteredStudents.map((student, idx) => (
                  <StudentRow
                    key={String(student.id)}
                    student={student}
                    isEven={idx % 2 === 0}
                    activeExams={activeExams}
                    attendanceMap={attendanceMap}
                    onToggle={handleToggle}
                    onRemoveGuest={s => setConfirmRemoveGuest({
                      studentId:   s.id,
                      studentName: `${s.name} ${s.surname}`,
                    })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════
          FOOTER — pinned, never scrolls
      ═══════════════════════════════════════════════ */}
      <footer
        className="flex-shrink-0 bg-slate-950 border-t border-slate-800 px-4 py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <SyncStatus status={syncStatus} />
          </div>
          <button
            id="save-btn"
            onClick={syncToSupabase}
            disabled={syncStatus === 'syncing' || syncStatus === 'synced'}
            className="btn-primary px-5 flex-shrink-0"
          >
            <Save size={15} />
            Kaydet
          </button>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════ */}

      {/* Uncheck attendance confirmation */}
      {confirmState && (
        <ConfirmModal
          studentName={confirmState.studentName}
          examName={confirmState.examName}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Remove guest confirmation */}
      {confirmRemoveGuest && (
        <div className="modal-backdrop" onClick={() => setConfirmRemoveGuest(null)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-white font-semibold">Misafiri Kaldır</h2>
                <p className="text-slate-400 text-sm mt-1">
                  <span className="text-white">{confirmRemoveGuest.studentName}</span>{' '}
                  adlı misafir ve tüm yoklama kayıtları silinecek.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemoveGuest(null)} className="btn-ghost flex-1">
                İptal
              </button>
              <button onClick={handleConfirmRemoveGuest} className="btn-danger flex-1">
                <Trash2 size={14} /> Kaldır
              </button>
            </div>
          </div>
        </div>
      )}

      {showGuestModal && <AddGuestModal onClose={() => setShowGuestModal(false)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STUDENT ROW — ultra-compact, zebra-striped
═══════════════════════════════════════════════════════════════════════════ */
function StudentRow({ student, isEven, activeExams, attendanceMap, onToggle, onRemoveGuest }) {
  const isGuest   = !!student.is_guest;
  const isPending = !!student._isPending;

  // Zebra stripe base colours
  const rowBg    = isGuest
    ? (isEven ? 'bg-indigo-950/60' : 'bg-indigo-900/25')
    : (isEven ? 'bg-slate-950'     : 'bg-slate-900/70');

  // Sticky cell must be fully opaque to cover scrolling content beneath it
  const stickyBg = isGuest
    ? (isEven ? 'bg-indigo-950'    : 'bg-[#171d38]')
    : (isEven ? 'bg-slate-950'     : 'bg-slate-900');

  return (
    <tr className={rowBg}>

      {/* ── Sticky Name Column (w-24 / 6rem) ─────────────────────────── */}
      <td
        className={`sticky left-0 z-10 ${stickyBg}
          w-24 min-w-[6rem] max-w-[6rem] px-2 py-2.5
          border-b border-r border-slate-800/60`}
        style={{ boxShadow: '3px 0 10px rgba(0,0,0,0.4)' }}
      >
        {/* Name + surname stacked vertically */}
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-white font-bold text-[11px] truncate">
            {student.name}
          </span>
          <span className="text-slate-400 text-[10px] truncate">
            {student.surname}
          </span>
          {/* Guest badge on its own line */}
          {isGuest && (
            <span className={`mt-0.5 self-start text-[9px] px-1 py-0.5 rounded font-semibold leading-none
              ${isPending
                ? 'bg-amber-900/60 text-amber-300'
                : 'bg-indigo-900/70 text-indigo-300'
              }`}
            >
              {isPending ? '⏳ Kaydedilmedi' : 'Misafir'}
            </span>
          )}
        </div>
      </td>

      {/* ── Exam Toggle Cells ─────────────────────────────────────────── */}
      {activeExams.map(exam => {
        const key       = getAttendanceKey(student.id, exam.id);
        const isPresent = !!attendanceMap[key];

        return (
          <td
            key={exam.id}
            className="px-0.5 py-1.5 text-center border-b border-slate-800/40"
          >
            <button
              id={`toggle-${student.id}-${exam.id}`}
              onClick={() => onToggle(student, exam)}
              aria-label={`${exam.exam_name}: ${isPresent ? 'Katıldı' : 'Katılmadı'}`}
              aria-pressed={isPresent}
              title={`${student.name} ${student.surname} — ${exam.exam_name}`}
              className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center
                transition-transform duration-75 active:scale-90
                ${isPresent
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/50'
                  : 'bg-slate-800 border border-slate-700 text-slate-600'
                }`}
            >
              {isPresent && <Check size={16} strokeWidth={2.5} />}
            </button>
          </td>
        );
      })}

      {/* ── Guest Remove Button ───────────────────────────────────────── */}
      <td className="px-1 py-1.5 text-center border-b border-slate-800/40">
        {isGuest && (
          <button
            onClick={() => onRemoveGuest(student)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-900/50 flex items-center justify-center mx-auto text-slate-600 hover:text-red-400 transition-colors"
            aria-label={`${student.name} ${student.surname} misafirini kaldır`}
          >
            <Trash2 size={12} />
          </button>
        )}
      </td>
    </tr>
  );
}
