import * as XLSX from 'xlsx';

/**
 * Build a single worksheet from a list of students.
 *
 * @param {Array}  students      - student objects for this sheet
 * @param {Array}  sortedExams   - active exams, sorted alphabetically by exam_name
 * @param {Object} attendanceMap - { "studentId:examId": true }
 * @returns XLSX worksheet
 */
function buildSheet(students, sortedExams, attendanceMap) {
  const examHeaders = sortedExams.map(e => e.exam_name);
  const headers     = ['No', 'Adı', 'Soyadı', ...examHeaders];

  const rows = students.map((student, index) => {
    const row = {
      No:    index + 1,   // Sequential row number — NOT a DB id
      'Adı':    student.name,
      'Soyadı': student.surname,
    };

    sortedExams.forEach(exam => {
      const key = `${student.id}:${exam.id}`;
      // "+" if present; completely blank (empty string) if absent
      row[exam.exam_name] = attendanceMap[key] ? '+' : '';
    });

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 20 },  // Adı
    { wch: 20 },  // Soyadı
    ...sortedExams.map(() => ({ wch: 14 })),
  ];

  // Bold the header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = { font: { bold: true } };
  }

  return ws;
}

/**
 * Export attendance to a two-sheet Excel workbook.
 *
 * Sheet 1 "Ana Liste"  — students where is_guest = false
 * Sheet 2 "Misafirler" — students where is_guest = true (omitted if empty)
 *
 * Columns: No | Adı | Soyadı | [active exam 1] | [active exam 2] | ...
 *   - "V"  if the student has an attendance record for that exam
 *   - ""   (blank) if absent — never "0", "X", or any other text
 *
 * @param {Array}  students      - ALL students from state (including pending)
 * @param {Array}  activeExams   - exams where is_active = true
 * @param {Object} attendanceMap - { "studentId:examId": true }
 */
export async function exportToExcel(students, activeExams, attendanceMap) {
  // Sort exams alphabetically so TYT/AYT variants stay grouped
  const sortedExams = [...activeExams].sort((a, b) =>
    a.exam_name.localeCompare(b.exam_name, 'tr', { sensitivity: 'base' })
  );

  // Split students by type
  // Exclude _isPending guests (no real DB id, their attendance key is a UUID)
  const regularStudents = students.filter(s => !s.is_guest && !s._isPending);
  const guestStudents   = students.filter(s =>  s.is_guest && !s._isPending);

  // Build workbook
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Ana Liste ────────────────────────────────────────────────────
  const ws1 = buildSheet(regularStudents, sortedExams, attendanceMap);
  XLSX.utils.book_append_sheet(wb, ws1, 'Ana Liste');

  // ── Sheet 2: Misafirler (only if there are guests) ────────────────────────
  if (guestStudents.length > 0) {
    const ws2 = buildSheet(guestStudents, sortedExams, attendanceMap);
    XLSX.utils.book_append_sheet(wb, ws2, 'Misafirler');
  }

  // ── Download ─────────────────────────────────────────────────────────────
  // Simple, robust: XLSX.writeFile handles everything correctly in Chrome & mobile.
  // Filename is strictly ASCII with no special characters, spaces, or locale-specific chars.
  XLSX.writeFile(wb, 'Yoklama_Listesi.xlsx');
}
