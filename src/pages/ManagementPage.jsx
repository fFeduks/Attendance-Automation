import React, { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, BookOpen, Loader2, AlertCircle, GripVertical } from 'lucide-react';
import { useAttendance } from '../store/useAttendanceStore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function ManagementPage() {
  const { exams, addExam, toggleExamActive, reorderExams } = useAttendance();
  const [examName, setExamName] = useState('');
  const [adding, setAdding]     = useState(false);
  const [error, setError]       = useState(null);
  const [togglingId, setTogglingId] = useState(null);

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

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
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

  const activeCount   = exams.filter(e => e.is_active).length;
  const inactiveCount = exams.filter(e => !e.is_active).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 pt-5 pb-24 space-y-6">
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

        {/* Exam List */}
        <div>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookOpen size={13} />
            Tüm Sınavlar ({exams.length})
          </h2>

          {exams.length === 0 ? (
            <div className="card p-8 flex flex-col items-center gap-3 text-center">
              <BookOpen size={28} className="text-slate-600" />
              <p className="text-slate-500 text-sm">
                Henüz sınav eklenmemiş.
              </p>
            </div>
          ) : (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={exams.map(e => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {exams.map(exam => (
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
      </div>
    </div>
  );
}

// ── Exam Row ────────────────────────────────────────────────────────────────
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
      <div
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors duration-300 ${
          exam.is_active ? 'bg-emerald-400' : 'bg-slate-600'
        }`}
      />

      {/* Exam name */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{exam.exam_name}</p>
        <p className={`text-xs mt-0.5 ${exam.is_active ? 'text-emerald-500' : 'text-slate-500'}`}>
          {exam.is_active ? 'Aktif — Yoklamada görünür' : 'Pasif — Yoklamada gizli'}
        </p>
      </div>

      {/* Toggle switch */}
      <button
        id={`exam-toggle-${exam.id}`}
        onClick={() => onToggle(exam)}
        disabled={toggling}
        className="relative flex-shrink-0 focus:outline-none"
        aria-label={`${exam.exam_name} ${exam.is_active ? 'pasif yap' : 'aktif yap'}`}
        aria-checked={exam.is_active}
        role="switch"
      >
        {toggling ? (
          <Loader2 size={20} className="animate-spin text-indigo-400" />
        ) : exam.is_active ? (
          <ToggleRight size={32} className="text-indigo-500 transition-colors" />
        ) : (
          <ToggleLeft size={32} className="text-slate-600 transition-colors" />
        )}
      </button>
    </div>
  );
}
