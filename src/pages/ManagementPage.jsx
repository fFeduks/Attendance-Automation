import React, { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, BookOpen, Loader2, AlertCircle, GripVertical, Trash2, ChevronDown } from 'lucide-react';
import { useAttendance } from '../store/useAttendanceStore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function ManagementPage() {
  const { exams, addExam, toggleExamActive, reorderExams, deleteExam } = useAttendance();
  const [examName,    setExamName]    = useState('');
  const [adding,      setAdding]      = useState(false);
  const [error,       setError]       = useState(null);
  const [togglingId,  setTogglingId]  = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);

  // Task 4: accordion state for disabled exams (closed by default)
  const [showDisabled, setShowDisabled] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // prevents accidental drag when tapping
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Task 4: separate active and inactive exams for rendering
  const activeExams   = exams.filter(e =>  e.is_active);
  const inactiveExams = exams.filter(e => !e.is_active);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      // Drag only within active exams; find indices in the full exams array
      const oldIndex = exams.findIndex((e) => e.id === active.id);
      const newIndex = exams.findIndex((e) => e.id === over.id);
      reorderExams(oldIndex, newIndex);
    }
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    if (!examName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addExam(examName.trim());
      setExamName('');
    } catch (err) {
      setError('Sınav eklenemedi. Supabase bağlantısını kontrol edin.');
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (exam) => {
    setTogglingId(exam.id);
    try {
      await toggleExamActive(exam.id, !exam.is_active);
    } catch (err) {
      console.error('Toggle failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // Task 5: permanently delete a disabled exam
  const handleDeleteExam = async (exam) => {
    const confirmed = window.confirm(
      `"${exam.exam_name}" sınavını kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz. Tüm yoklama kayıtları da silinecektir.`
    );
    if (!confirmed) return;

    setDeletingId(exam.id);
    try {
      await deleteExam(exam.id);
    } catch (err) {
      console.error('Delete exam failed:', err);
      alert('Sınav silinemedi. Lütfen tekrar deneyin.');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount   = activeExams.length;
  const inactiveCount = inactiveExams.length;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 pb-24 space-y-6 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
        {/* Page Header */}
        <div>
          <h1 className="text-white font-bold text-xl">Yönetim</h1>
          <p className="text-slate-500 text-sm mt-0.5">Sınav yönetimi</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Aktif Sınavlar</p>
            <p className="text-emerald-400 font-bold text-3xl mt-1">{activeCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Pasif Sınavlar</p>
            <p className="text-slate-400 font-bold text-3xl mt-1">{inactiveCount}</p>
          </div>
        </div>

        {/* Add Exam Form */}
        <div className="card p-4">
          <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
            <Plus size={16} className="text-indigo-400" />
            Yeni Sınav Ekle
          </h2>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-900/40 rounded-xl px-3 py-2.5 mb-3">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleAddExam} className="flex gap-2">
            <input
              id="exam-name-input"
              type="text"
              value={examName}
              onChange={e => setExamName(e.target.value)}
              placeholder="Sınav adı (örn: TYT, AYT)"
              className="input-field flex-1"
              disabled={adding}
            />
            <button
              id="add-exam-submit"
              type="submit"
              disabled={adding || !examName.trim()}
              className="btn-primary px-4 flex-shrink-0"
            >
              {adding
                ? <Loader2 size={16} className="animate-spin" />
                : <Plus size={16} />
              }
            </button>
          </form>
        </div>

        {/* ── Active Exam List (draggable) ─────────────────────────────── */}
        <div>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookOpen size={13} />
            Aktif Sınavlar ({activeCount})
          </h2>

          {activeExams.length === 0 ? (
            <div className="card p-8 flex flex-col items-center gap-3 text-center">
              <BookOpen size={28} className="text-slate-600" />
              <p className="text-slate-500 text-sm">
                Henüz aktif sınav yok.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeExams.map(e => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {activeExams.map(exam => (
                    <SortableExamRow
                      key={exam.id}
                      exam={exam}
                      toggling={togglingId === exam.id}
                      onToggle={handleToggleActive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Task 4: Disabled exams accordion ──────────────────────────── */}
        {inactiveCount > 0 && (
          <div>
            {/* Accordion toggle header */}
            <button
              onClick={() => setShowDisabled(v => !v)}
              className="w-full flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3 hover:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <BookOpen size={13} />
                Pasif Sınavlar ({inactiveCount})
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showDisabled ? 'rotate-180' : ''}`}
              />
            </button>

            {showDisabled && (
              <div className="space-y-2">
                {inactiveExams.map(exam => (
                  <InactiveExamRow
                    key={exam.id}
                    exam={exam}
                    toggling={togglingId === exam.id}
                    deleting={deletingId === exam.id}
                    onToggle={handleToggleActive}
                    onDelete={handleDeleteExam}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active Exam Row (sortable / draggable) ───────────────────────────────────
function SortableExamRow({ exam, toggling, onToggle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exam.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="card px-4 py-3 flex items-center gap-3 transition-all duration-200">
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-1 -ml-2 touch-none"
      >
        <GripVertical size={18} />
      </div>

      {/* Status dot */}
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-emerald-400" />

      {/* Exam name */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{exam.exam_name}</p>
        <p className="text-xs mt-0.5 text-emerald-500">
          Aktif — Yoklamada görünür
        </p>
      </div>

      {/* Toggle switch */}
      <button
        id={`exam-toggle-${exam.id}`}
        onClick={() => onToggle(exam)}
        disabled={toggling}
        className="relative flex-shrink-0 focus:outline-none"
        aria-label={`${exam.exam_name} pasif yap`}
        aria-checked={true}
        role="switch"
      >
        {toggling ? (
          <Loader2 size={20} className="animate-spin text-indigo-400" />
        ) : (
          <ToggleRight size={32} className="text-indigo-500 transition-colors" />
        )}
      </button>
    </div>
  );
}

// Task 4 & 5: Inactive (disabled) exam row with hard-delete button ────────────
function InactiveExamRow({ exam, toggling, deleting, onToggle, onDelete }) {
  return (
    <div className="card px-4 py-3 flex items-center gap-3 opacity-70 transition-all duration-200">
      {/* Status dot — gray for inactive */}
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-slate-600" />

      {/* Exam name */}
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 font-medium text-sm truncate">{exam.exam_name}</p>
        <p className="text-xs mt-0.5 text-slate-600">
          Pasif — Yoklamada gizli
        </p>
      </div>

      {/* Task 5: Hard delete button */}
      <button
        id={`exam-delete-${exam.id}`}
        onClick={() => onDelete(exam)}
        disabled={deleting || toggling}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 text-red-400 hover:text-red-300 text-xs font-medium transition-colors disabled:opacity-40 flex-shrink-0"
        title="Kalıcı Olarak Sil"
      >
        {deleting ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
        <span className="hidden sm:inline">Kalıcı Sil</span>
      </button>

      {/* Toggle switch to re-activate */}
      <button
        id={`exam-toggle-${exam.id}`}
        onClick={() => onToggle(exam)}
        disabled={toggling || deleting}
        className="relative flex-shrink-0 focus:outline-none"
        aria-label={`${exam.exam_name} aktif yap`}
        aria-checked={false}
        role="switch"
      >
        {toggling ? (
          <Loader2 size={20} className="animate-spin text-indigo-400" />
        ) : (
          <ToggleLeft size={32} className="text-slate-600 transition-colors" />
        )}
      </button>
    </div>
  );
}
