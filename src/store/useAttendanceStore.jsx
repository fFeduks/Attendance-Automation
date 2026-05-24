import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import {
  fetchStudents,
  fetchExams,
  fetchAttendance,
  upsertAttendance,
  deleteAttendance,
  insertExam,
  updateExamActive,
  insertGuestStudent,
  deleteStudent,
  deleteExamById,
} from '../lib/supabase';
import {
  loadAttendanceMap,
  saveAttendanceMap,
  getAttendanceKey,
  loadPendingDeletes,
  savePendingDeletes,
  loadPendingGuests,
  savePendingGuests,
  clearPending,
  loadExamOrder,
  saveExamOrder,
} from '../lib/localStorage';

// ─── Turkish-Aware Search Normalizer ─────────────────────────────────────────
// `toLocaleLowerCase('tr-TR')` is not reliable in all WebView/mobile environments.
// Instead, we explicitly map all 4 Turkish I variants to a single char so that
// "zahide" / "zahİde" / "ZAHİDE" / "ZAHIDE" all resolve to the same string.
function trNormalize(str) {
  return (str || '')
    .replace(/İ/g, 'i')   // U+0130 Capital dotted I  → i
    .replace(/I/g, 'i')   // U+0049 Capital plain I   → i (search-safe equivalence)
    .replace(/ı/g, 'i')   // U+0131 Lowercase dotless → i (search-safe equivalence)
    .toLowerCase();        // Handle all remaining characters
}

// ─── Initial State ────────────────────────────────────────────────────────────
const initialState = {
  students: [],
  /**
   * students array contains:
   *   - Remote synced students: { id: number, name, surname, is_guest: boolean }
   *   - Pending local guests:   { id: string (UUID), name, surname, is_guest: true, _isPending: true }
   *
   * The attendanceMap uses the student's id (number or UUID string) as the key prefix.
   */
  exams: [],
  attendanceMap: {},  // { "studentId:examId": true } (local + remote)
  dbAttendanceMap: {}, // { "studentId:examId": true } (verified remote only)
  searchQuery: '',
  syncStatus: 'synced',
  loading: true,
  error: null,
};

// ─── Helper to Sort Exams ───────────────────────────────────────────────────────
function sortExams(exams, orderMap) {
  // orderMap is an array of exam ids. We sort by indexOf. If not found, put at end.
  // Task 3: for exams not in the saved order, sort newest-first (b.id - a.id).
  return [...exams].sort((a, b) => {
    const iA = orderMap.indexOf(a.id);
    const iB = orderMap.indexOf(b.id);
    if (iA !== -1 && iB !== -1) return iA - iB;
    if (iA !== -1) return -1;
    if (iB !== -1) return 1;
    return b.id - a.id; // Task 3: newest-first fallback for unordered exams
  });
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'SET_INIT_DATA': {
      const order = loadExamOrder();
      return {
        ...state,
        students: action.students,
        exams: sortExams(action.exams, order),
        attendanceMap: action.attendanceMap,
        dbAttendanceMap: action.dbAttendanceMap,
        loading: false,
        syncStatus: action.hasPending ? 'local' : 'synced',
      };
    }

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };

    case 'TOGGLE_ATTENDANCE': {
      const { studentId, examId } = action;
      const key = getAttendanceKey(studentId, examId);
      const newMap = { ...state.attendanceMap };
      if (newMap[key]) {
        delete newMap[key];
      } else {
        newMap[key] = true;
      }
      return { ...state, attendanceMap: newMap, syncStatus: 'local' };
    }

    case 'ADD_GUEST_STUDENT': {
      // Add as a pending local student with UUID id
      const newStudent = {
        id: action._localId,
        name: action.name,
        surname: action.surname,
        is_guest: true,
        _isPending: true,
      };
      const key = getAttendanceKey(action._localId, action.examId);
      return {
        ...state,
        students: [...state.students, newStudent],
        attendanceMap: { ...state.attendanceMap, [key]: true },
        syncStatus: 'local',
      };
    }

    case 'REMOVE_STUDENT': {
      // Remove student and all their attendance entries
      const newStudents = state.students.filter(s => String(s.id) !== String(action.studentId));
      const newMap = { ...state.attendanceMap };
      Object.keys(newMap).forEach(key => {
        if (key.startsWith(`${action.studentId}:`)) delete newMap[key];
      });
      return { ...state, students: newStudents, attendanceMap: newMap, syncStatus: 'local' };
    }

    case 'SYNC_COMPLETE': {
      // Replace pending guest students with their real DB rows
      // and remap their attendance keys
      const localIdToReal = Object.fromEntries(
        action.insertedGuests.map(ig => [ig._localId, ig.student])
      );
      const newStudents = state.students.map(s => {
        const real = localIdToReal[s.id];
        return real ? { ...real } : s;
      });
      return {
        ...state,
        students: newStudents,
        attendanceMap: action.newAttendanceMap,
        dbAttendanceMap: action.newAttendanceMap,
        syncStatus: 'synced',
      };
    }

    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.status };

    case 'ADD_EXAM': {
      // Task 3: new exam goes to the front (newest-first)
      const newExams = [action.exam, ...state.exams];
      saveExamOrder(newExams.map(e => e.id));
      return { ...state, exams: newExams };
    }

    case 'REORDER_EXAMS': {
      const { oldIndex, newIndex } = action;
      const newExams = [...state.exams];
      const [removed] = newExams.splice(oldIndex, 1);
      newExams.splice(newIndex, 0, removed);
      
      // Save new order to local storage
      saveExamOrder(newExams.map(e => e.id));
      return { ...state, exams: newExams };
    }

    case 'UPDATE_EXAM_ACTIVE':
      return {
        ...state,
        exams: state.exams.map(e =>
          e.id === action.id ? { ...e, is_active: action.is_active } : e
        ),
      };

    // Task 5: permanently remove exam from state
    case 'DELETE_EXAM': {
      const remaining = state.exams.filter(e => e.id !== action.id);
      saveExamOrder(remaining.map(e => e.id));
      // Also clean up attendance map entries for this exam
      const newMap = { ...state.attendanceMap };
      const newDbMap = { ...state.dbAttendanceMap };
      Object.keys(newMap).forEach(key => {
        if (key.endsWith(`:${action.id}`)) delete newMap[key];
      });
      Object.keys(newDbMap).forEach(key => {
        if (key.endsWith(`:${action.id}`)) delete newDbMap[key];
      });
      return {
        ...state,
        exams: remaining,
        attendanceMap: newMap,
        dbAttendanceMap: newDbMap,
      };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AttendanceContext = createContext(null);

export function AttendanceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Keep ref to latest students for callbacks that capture state
  const studentsRef = useRef(state.students);
  useEffect(() => { studentsRef.current = state.students; }, [state.students]);

  // ── Bootstrap: localStorage first, then Supabase merge ──────────────────
  useEffect(() => {
    async function init() {
      const localMap = loadAttendanceMap();
      const pendingDels = loadPendingDeletes();
      const pendingGuests = loadPendingGuests();

      // Reconstruct pending guest students as local student objects
      const localGuestStudents = pendingGuests.map(pg => ({
        id: pg._localId,
        name: pg.name,
        surname: pg.surname,
        is_guest: true,
        _isPending: true,
      }));

      try {
        const [remoteStudents, exams, remoteAttendance] = await Promise.all([
          fetchStudents(),
          fetchExams(),
          fetchAttendance(),
        ]);

        // Build remote attendance map
        const remoteMap = {};
        remoteAttendance.forEach(a => {
          remoteMap[getAttendanceKey(a.student_id, a.exam_id)] = true;
        });

        // Merge: local overrides remote (handles offline changes)
        const mergedMap = { ...remoteMap, ...localMap };

        // Apply pending deletes
        pendingDels.forEach(({ student_id, exam_id }) => {
          delete mergedMap[getAttendanceKey(student_id, exam_id)];
        });

        // Students: remote (authoritative for synced) + pending local guests
        // Avoid duplicating pending guests that may already have been synced
        const allStudents = [...remoteStudents, ...localGuestStudents];

        const hasPending = pendingDels.length > 0 || pendingGuests.length > 0;

        dispatch({
          type: 'SET_INIT_DATA',
          students: allStudents,
          exams,
          attendanceMap: mergedMap,
          dbAttendanceMap: remoteMap,
          hasPending,
        });

        saveAttendanceMap(mergedMap);

      } catch (err) {
        console.error('Supabase init failed, using localStorage fallback:', err);
        // Offline: show only pending local data
        dispatch({
          type: 'SET_INIT_DATA',
          students: localGuestStudents,
          exams: [],
          attendanceMap: localMap,
          dbAttendanceMap: localMap, // Fallback: assume local was synced previously
          hasPending: pendingDels.length > 0 || pendingGuests.length > 0,
        });
      }
    }

    init();
  }, []);

  // ── Persist attendance map to localStorage on every change ───────────────
  useEffect(() => {
    if (!state.loading) {
      saveAttendanceMap(state.attendanceMap);
    }
  }, [state.attendanceMap, state.loading]);

  // ── Toggle attendance ─────────────────────────────────────────────────────
  const toggleAttendance = useCallback((studentId, examId) => {
    const key = getAttendanceKey(studentId, examId);
    const currentMap = loadAttendanceMap();

    if (currentMap[key]) {
      // Present → removing → track as pending delete (only for synced/integer ids)
      const isInteger = !isNaN(Number(studentId));
      if (isInteger) {
        const dels = loadPendingDeletes();
        const alreadyQueued = dels.some(
          d => String(d.student_id) === String(studentId) && String(d.exam_id) === String(examId)
        );
        if (!alreadyQueued) {
          savePendingDeletes([...dels, { student_id: Number(studentId), exam_id: Number(examId) }]);
        }
      }
    } else {
      // Absent → marking present → remove from pending deletes if it was there
      const dels = loadPendingDeletes();
      savePendingDeletes(dels.filter(
        d => !(String(d.student_id) === String(studentId) && String(d.exam_id) === String(examId))
      ));
    }

    dispatch({ type: 'TOGGLE_ATTENDANCE', studentId, examId });
  }, []);

  // ── Add Guest Student (local-first, auto-attendance) ─────────────────────
  const addGuest = useCallback((name, surname, examId) => {
    const _localId = crypto.randomUUID();
    const examIdNum = Number(examId);

    // Normalize: uppercase with Turkish locale before persisting
    const formattedName = name.trim().toLocaleUpperCase('tr-TR');
    const formattedSurname = surname.trim().toLocaleUpperCase('tr-TR');

    // Persist to localStorage
    const existing = loadPendingGuests();
    savePendingGuests([...existing, { _localId, name: formattedName, surname: formattedSurname, exam_id: examIdNum }]);

    dispatch({ type: 'ADD_GUEST_STUDENT', _localId, name: formattedName, surname: formattedSurname, examId: examIdNum });
  }, []);

  // ── Remove a guest student ────────────────────────────────────────────────
  const removeGuest = useCallback(async (studentId) => {
    const student = studentsRef.current.find(s => String(s.id) === String(studentId));
    if (!student?.is_guest) return;

    if (student._isPending) {
      // Never synced — just remove from localStorage
      const pending = loadPendingGuests();
      savePendingGuests(pending.filter(g => g._localId !== studentId));
    } else {
      // In Supabase — delete (CASCADE removes attendance too)
      try {
        await deleteStudent(Number(studentId));
      } catch (e) {
        console.error('Failed to delete guest student:', e);
      }
    }

    dispatch({ type: 'REMOVE_STUDENT', studentId });
  }, []);

  // ── Kaydet: bulk sync to Supabase ─────────────────────────────────────────
  const syncToSupabase = useCallback(async () => {
    dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' });
    try {
      // 1. Execute pending attendance deletes
      const pendingDels = loadPendingDeletes();
      for (const { student_id, exam_id } of pendingDels) {
        await deleteAttendance(Number(student_id), Number(exam_id));
      }

      // 2. Get pending guests (to exclude their UUID keys from attendance upsert)
      const pendingGuests = loadPendingGuests();
      const pendingLocalIds = new Set(pendingGuests.map(g => g._localId));

      // 3. Upsert attendance for all SYNCED students (integer ids only)
      const regularRows = Object.keys(state.attendanceMap)
        .filter(key => {
          const [sid] = key.split(':');
          return !pendingLocalIds.has(sid); // skip UUID keys for pending guests
        })
        .map(key => {
          const [sid, eid] = key.split(':');
          return { student_id: Number(sid), exam_id: Number(eid) };
        });

      await upsertAttendance(regularRows);

      // 4. Insert each pending guest student → auto-create their attendance
      const newMap = { ...state.attendanceMap };
      const insertedGuests = [];

      for (const pg of pendingGuests) {
        // Insert student with is_guest = true
        const newStudent = await insertGuestStudent(pg.name, pg.surname);

        // Insert their pre-selected exam attendance
        await upsertAttendance([{ student_id: newStudent.id, exam_id: Number(pg.exam_id) }]);

        // Remap attendance key: UUID → real SERIAL id
        const oldKey = getAttendanceKey(pg._localId, pg.exam_id);
        const newKey = getAttendanceKey(newStudent.id, pg.exam_id);
        if (newMap[oldKey]) {
          newMap[newKey] = true;
          delete newMap[oldKey];
        }

        insertedGuests.push({ _localId: pg._localId, student: newStudent });
      }

      clearPending();
      saveAttendanceMap(newMap);

      dispatch({ type: 'SYNC_COMPLETE', newAttendanceMap: newMap, insertedGuests });

    } catch (err) {
      console.error('Sync failed:', err);
      dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
    }
  }, [state.attendanceMap]);

  // ── Discard local changes and re-fetch from Supabase ──────────────────────
  const discardChanges = useCallback(async () => {
    dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' });
    try {
      clearPending();
      
      const [remoteStudents, exams, remoteAttendance] = await Promise.all([
        fetchStudents(),
        fetchExams(),
        fetchAttendance(),
      ]);

      const remoteMap = {};
      remoteAttendance.forEach(a => {
        remoteMap[getAttendanceKey(a.student_id, a.exam_id)] = true;
      });

      saveAttendanceMap(remoteMap);

      dispatch({
        type: 'SET_INIT_DATA',
        students: remoteStudents,
        exams,
        attendanceMap: remoteMap,
        dbAttendanceMap: remoteMap,
        hasPending: false,
      });

    } catch (err) {
      console.error('Discard failed:', err);
      dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
    }
  }, []);

  // ── Exam management ───────────────────────────────────────────────────────
  const addExam = useCallback(async (examName) => {
    const exam = await insertExam(examName);
    dispatch({ type: 'ADD_EXAM', exam });
    return exam;
  }, []);

  const reorderExams = useCallback((oldIndex, newIndex) => {
    dispatch({ type: 'REORDER_EXAMS', oldIndex, newIndex });
  }, []);

  const toggleExamActive = useCallback(async (id, is_active) => {
    await updateExamActive(id, is_active);
    dispatch({ type: 'UPDATE_EXAM_ACTIVE', id, is_active });
  }, []);

  // Task 5: permanently delete an exam
  const deleteExam = useCallback(async (id) => {
    await deleteExamById(id);
    dispatch({ type: 'DELETE_EXAM', id });
  }, []);

  const setSearch = useCallback((query) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  // Task 1: Multi-word search — combine name + surname, split query by spaces,
  // every word in the query must match somewhere in the full name.
  const filteredStudents = state.students.filter(s => {
    if (!state.searchQuery.trim()) return true;

    const fullName = trNormalize(s.name + ' ' + s.surname);
    const words = trNormalize(state.searchQuery).split(/\s+/).filter(Boolean);
    return words.every(word => fullName.includes(word));
  });

  const activeExams = state.exams.filter(e => e.is_active);

  const value = {
    ...state,
    filteredStudents,
    activeExams,
    toggleAttendance,
    syncToSupabase,
    addGuest,
    removeGuest,
    addExam,
    reorderExams,
    toggleExamActive,
    deleteExam,
    setSearch,
    discardChanges,
  };

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used inside AttendanceProvider');
  return ctx;
}
