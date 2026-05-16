// ─── Storage Keys ─────────────────────────────────────────────────────────────
const KEYS = {
  ATTENDANCE:      'yks_attendance',
  PENDING_DELETE:  'yks_pending_delete',
  PENDING_GUESTS:  'yks_pending_guests',
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────
function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed:', e);
  }
}

// ─── Attendance Map ───────────────────────────────────────────────────────────
// Shape: { "studentId:examId": true }
// studentId can be an integer (synced) or a UUID string (pending guest).
export function loadAttendanceMap() {
  return load(KEYS.ATTENDANCE) || {};
}

export function saveAttendanceMap(map) {
  save(KEYS.ATTENDANCE, map);
}

export function getAttendanceKey(studentId, examId) {
  return `${studentId}:${examId}`;
}

// ─── Pending Attendance Deletes ───────────────────────────────────────────────
// Array of { student_id: number, exam_id: number }
export function loadPendingDeletes() {
  return load(KEYS.PENDING_DELETE) || [];
}

export function savePendingDeletes(rows) {
  save(KEYS.PENDING_DELETE, rows);
}

// ─── Pending Guest Students ───────────────────────────────────────────────────
// These are guest students added locally but not yet inserted into Supabase.
// Shape: [{ _localId: string (UUID), name: string, surname: string, exam_id: number }]
//
// In state, these appear as student objects with id = _localId and _isPending = true.
// On "Kaydet", they are inserted into the students table and their attendance is created.
// After sync the attendanceMap keys are remapped from _localId → real SERIAL id.
export function loadPendingGuests() {
  return load(KEYS.PENDING_GUESTS) || [];
}

export function savePendingGuests(guests) {
  save(KEYS.PENDING_GUESTS, guests);
}

// ─── Clear all pending state after a successful sync ─────────────────────────
export function clearPending() {
  localStorage.removeItem(KEYS.PENDING_DELETE);
  localStorage.removeItem(KEYS.PENDING_GUESTS);
}
