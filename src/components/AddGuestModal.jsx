import React, { useState } from 'react';
import { X, UserPlus, CheckCircle } from 'lucide-react';
import { useAttendance } from '../store/useAttendanceStore';

export default function AddGuestModal({ onClose }) {
  const { activeExams, addGuest } = useAttendance();

  const [name, setName]       = useState('');
  const [surname, setSurname] = useState('');
  const [examId, setExamId]   = useState(activeExams[0]?.id ?? '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !surname.trim() || !examId) return;
    // Normalize to Turkish uppercase before saving
    const formattedName    = name.trim().toLocaleUpperCase('tr-TR');
    const formattedSurname = surname.trim().toLocaleUpperCase('tr-TR');
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
                onChange={e => setExamId(e.target.value)}
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
