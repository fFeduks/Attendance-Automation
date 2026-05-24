import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Students ─────────────────────────────────────────────────────────────────
// Fetches ALL students (both regular and guests). is_guest field distinguishes them.
export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, surname, is_guest')
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Insert a guest student into the students table with is_guest = true.
 * Returns the inserted row including the auto-generated SERIAL id.
 */
export async function insertGuestStudent(name, surname) {
  const { data, error } = await supabase
    .from('students')
    .insert({ name, surname, is_guest: true })
    .select('id, name, surname, is_guest')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a student by id. The ON DELETE CASCADE on attendance
 * will automatically remove their attendance records.
 */
export async function deleteStudent(id) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Exams ────────────────────────────────────────────────────────────────────
// Task 3: Order by id DESC so newest exams appear first by default.
export async function fetchExams() {
  const { data, error } = await supabase
    .from('exams')
    .select('id, exam_name, is_active, created_at')
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertExam(exam_name) {
  const { data, error } = await supabase
    .from('exams')
    .insert({ exam_name, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExamActive(id, is_active) {
  const { error } = await supabase
    .from('exams')
    .update({ is_active })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Task 5: Permanently delete an exam and all its attendance records.
 * We delete attendance first to be safe regardless of CASCADE setting.
 */
export async function deleteExamById(id) {
  // Step 1: delete all attendance records for this exam
  const { error: attErr } = await supabase
    .from('attendance')
    .delete()
    .eq('exam_id', id);
  if (attErr) throw attErr;

  // Step 2: delete the exam itself
  const { error: examErr } = await supabase
    .from('exams')
    .delete()
    .eq('id', id);
  if (examErr) throw examErr;
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export async function fetchAttendance() {
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, exam_id');
  if (error) throw error;
  return data;
}

/**
 * Bulk upsert attendance rows.
 * rows = [{ student_id: number, exam_id: number }]
 */
export async function upsertAttendance(rows) {
  if (!rows.length) return;
  const { error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'student_id,exam_id', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Delete attendance for a specific student+exam pair.
 */
export async function deleteAttendance(student_id, exam_id) {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('student_id', student_id)
    .eq('exam_id', exam_id);
  if (error) throw error;
}
