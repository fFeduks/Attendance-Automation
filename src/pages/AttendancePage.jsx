import React, { useState, useRef } from 'react';
import { Search, UserPlus, Download, Save, X, Check, Trash2, Loader2, Undo, CornerUpLeft } from 'lucide-react';
import { useAttendance } from '../store/useAttendanceStore';
import { getAttendanceKey } from '../lib/localStorage';
import { exportToExcel } from '../lib/exportExcel';
import AddGuestModal from '../components/AddGuestModal';
import SyncStatus from '../components/SyncStatus';

export default function AttendancePage() {
  const {
    filteredStudents, activeExams, attendanceMap, dbAttendanceMap,
    students, searchQuery, syncStatus, loading,
    setSearch, toggleAttendance, syncToSupabase, removeGuest, discardChanges,
  } = useAttendance();

  const [confirmRemoveGuest, setConfirmRemoveGuest] = useState(null);
  const [confirmDiscard,     setConfirmDiscard]     = useState(false);
  const [showGuestModal,     setShowGuestModal]     = useState(false);
  const [exporting,          setExporting]          = useState(false);
  const [pendingDeleteKey,   setPendingDeleteKey]   = useState(null);

  // Task 12: track last search query for undo
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // Task 2: ref to re-focus the search input after toggle
  const searchInputRef = useRef(null);

  // Used to avoid clearing search on the very next focus after a blur
  const shouldClearOnFocus = useRef(false);
  const deleteTimeoutRef   = useRef(null);

  // e is passed from the toggle button click to allow e.preventDefault()
  const handleToggle = (student, exam, e) => {
    // Task 2: Prevent the button from stealing focus from the search input.
    // Calling preventDefault() on the mousedown/touchstart event stops the
    // browser from blurring the currently-focused element (our search box),
    // keeping the mobile keyboard visible.
    e?.preventDefault();

    const key = getAttendanceKey(student.id, exam.id);
    const isMarked = !!attendanceMap[key];
    const isSaved  = !!dbAttendanceMap[key];

    if (!isMarked) {
      // Absent -> Unsaved (Yellow)
      toggleAttendance(student.id, exam.id);
    } else if (isMarked && !isSaved) {
      // Unsaved (Yellow) -> Absent (Gray)
      toggleAttendance(student.id, exam.id);
    } else {
      // Saved (Green)
      if (pendingDeleteKey !== key) {
        // First click: Ask for confirmation inline
        setPendingDeleteKey(key);
        if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = setTimeout(() => {
          setPendingDeleteKey(null);
        }, 3000);
      } else {
        // Second click: Confirmed
        if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
        setPendingDeleteKey(null);
        toggleAttendance(student.id, exam.id);
      }
    }

    // Task 12: clear search immediately and save it for undo
    if (searchQuery) {
      setLastSearchQuery(searchQuery);
      setSearch('');
      shouldClearOnFocus.current = false;
    }

    // Task 2: Synchronous focus (no rAF) — the keyboard never closes because
    // preventDefault() above already blocked the blur. This call just ensures
    // focus is confirmed on the input after React's state update.
    searchInputRef.current?.focus();
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
      await exportToExcel(students, activeExams, dbAttendanceMap);
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
    <div className="fixed inset-0 flex flex-col bg-slate-950 overflow-hidden">

      {/* ═══════════════════════════════════════════════
          HEADER — pinned, never scrolls
      ═══════════════════════════════════════════════ */}
      <header className="flex-shrink-0 bg-slate-950 border-b border-slate-800 px-3 pb-2 space-y-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">

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

        {/* Search bar — Task 2, 12 */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            ref={searchInputRef}
            id="search-students"
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearch(e.target.value);
              // If user starts typing again, forget the last search
              if (e.target.value) setLastSearchQuery('');
            }}
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
            placeholder="Öğrenci ara..."
            // Task 12: always reserve right padding for the icon slot so
            // placeholder text never overlaps the X or undo button.
            className="input-field pl-9 pr-10 text-sm"
          />

          {/* X button when there's active search */}
          {searchQuery && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSearch('');
                shouldClearOnFocus.current = false;
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="Aramayı temizle"
            >
              <X size={14} />
            </button>
          )}

          {/* Task 12: Undo button when search was just cleared by toggle */}
          {!searchQuery && lastSearchQuery && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSearch(lastSearchQuery);
                setLastSearchQuery('');
                shouldClearOnFocus.current = false;
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 transition-colors"
              aria-label="Aramayı geri al"
              title={`"${lastSearchQuery}" aramasına geri dön`}
            >
              <CornerUpLeft size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════
          MAIN — flex-1, only this section scrolls
      ═══════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto pb-[60vh]">

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
              {/* Task 6: show "Add Student" hint when searching with no results */}
              {searchQuery && (
                <button
                  onClick={() => setShowGuestModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                >
                  <UserPlus size={15} />
                  Öğrenci Ekle
                </button>
              )}
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
                    dbAttendanceMap={dbAttendanceMap}
                    pendingDeleteKey={pendingDeleteKey}
                    onToggle={handleToggle}
                    onRemoveGuest={s => setConfirmRemoveGuest({
                      studentId:   s.id,
                      studentName: `${s.name} ${s.surname}`,
                    })}
                  />
                ))}
                {/* Task 11: bottom padding row so last student isn't hidden under the footer/keyboard */}
                <tr aria-hidden="true">
                  <td colSpan={activeExams.length + 2} className="h-32" />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Floating Save/Sync Pill ── */}
      {syncStatus !== 'synced' && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 pr-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.5)] animate-slide-up">
          <SyncStatus status={syncStatus} />
          
          {syncStatus === 'local' && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/60">
              <button
                id="discard-btn"
                onClick={() => setConfirmDiscard(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                title="Vazgeç"
              >
                <Undo size={14} />
              </button>
              <button
                id="save-btn"
                onClick={syncToSupabase}
                className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-900/20"
                title="Kaydet"
              >
                <Save size={13} />
                <span>Kaydet</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════ */}

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

      {/* Discard confirmation */}
      {confirmDiscard && (
        <div className="modal-backdrop" onClick={() => setConfirmDiscard(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <Undo size={18} className="text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-white font-semibold">Değişikliklerden Vazgeç</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Emin misiniz? Henüz kaydedilmeyen tüm yoklama değişiklikleri silinecek ve veritabanındaki haline geri dönülecek.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDiscard(false)} className="btn-ghost flex-1">
                İptal
              </button>
              <button onClick={() => { discardChanges(); setConfirmDiscard(false); }} className="btn-danger flex-1">
                <Undo size={14} /> Evet, Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 6: pass searchQuery so the modal can pre-fill name/surname */}
      {showGuestModal && (
        <AddGuestModal
          onClose={() => setShowGuestModal(false)}
          initialQuery={searchQuery}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STUDENT ROW — ultra-compact, zebra-striped
   ⚠️ Scroll-safety: toggle buttons use active:scale-90 CSS only.
      No pointer-event overrides. The table container handles scroll.
═══════════════════════════════════════════════════════════════════════════ */
function StudentRow({ student, isEven, activeExams, attendanceMap, dbAttendanceMap, pendingDeleteKey, onToggle, onRemoveGuest }) {
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
        const isMarked  = !!attendanceMap[key];
        const isSaved   = !!dbAttendanceMap[key];
        const isPendingDelete = pendingDeleteKey === key;

        let btnClass = 'bg-slate-800 border border-slate-700 text-slate-600'; // Absent
        let Icon = null;

        if (isMarked) {
          if (!isSaved) {
            // Unsaved (Yellow)
            btnClass = 'bg-amber-500 text-white shadow-md shadow-amber-900/50';
            Icon = <Check size={16} strokeWidth={2.5} />;
          } else if (isPendingDelete) {
            // Pending Delete (Red) — two-step confirm preserved
            btnClass = 'bg-red-500 text-white shadow-md shadow-red-900/50 animate-pulse';
            Icon = <X size={16} strokeWidth={3} />;
          } else {
            // Saved (Green)
            btnClass = 'bg-emerald-500 text-white shadow-md shadow-emerald-900/50';
            Icon = <Check size={16} strokeWidth={2.5} />;
          }
        }

        return (
          <td
            key={exam.id}
            className="px-0.5 py-1.5 text-center border-b border-slate-800/40"
          >
            <button
              id={`toggle-${student.id}-${exam.id}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => onToggle(student, exam, e)}
              aria-label={`${exam.exam_name}: ${isMarked ? 'Katıldı' : 'Katılmadı'}`}
              aria-pressed={isMarked}
              title={`${student.name} ${student.surname} — ${exam.exam_name}`}
              className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center active:scale-90 ${btnClass}`}
            >
              {Icon}
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
