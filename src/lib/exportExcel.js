// Task 8: Use xlsx-js-style (drop-in replacement for xlsx) for cell border support.
import * as XLSX from 'xlsx-js-style';

// ─── Border style applied to every data cell ─────────────────────────────────
const THIN_BORDER = {
  top:    { style: 'thin', color: { rgb: 'AAAAAA' } },
  bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
  left:   { style: 'thin', color: { rgb: 'AAAAAA' } },
  right:  { style: 'thin', color: { rgb: 'AAAAAA' } },
};

const HEADER_STYLE = {
  font:   { bold: true },
  fill:   { fgColor: { rgb: '1E293B' } },  // slate-800 background
  border: THIN_BORDER,
};

const CELL_STYLE = {
  border: THIN_BORDER,
};

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

  // Task 8: Apply borders to ALL cells in the data range
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (!ws[cellRef]) {
        // Create empty cell so we can style it
        ws[cellRef] = { v: '', t: 's' };
      }
      // Header row gets bold + filled background; data rows get plain border
      ws[cellRef].s = row === 0 ? HEADER_STYLE : CELL_STYLE;
    }
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
 *   - "+"  if the student has an attendance record for that exam
 *   - ""   (blank) if absent — never "0", "X", or any other text
 *
 * @param {Array}  students      - ALL students from state (including pending)
 * @param {Array}  activeExams   - exams where is_active = true
 * @param {Object} attendanceMap - { "studentId:examId": true }
 */
export async function exportToExcel(students, activeExams, attendanceMap) {
  // Use the custom exam order provided by state
  const orderedExams = [...activeExams];

  // Split students by type
  // Exclude _isPending guests (no real DB id, their attendance key is a UUID)
  const regularStudents = students.filter(s => !s.is_guest && !s._isPending);
  const guestStudents   = students.filter(s =>  s.is_guest && !s._isPending);

  // Build workbook
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Ana Liste ────────────────────────────────────────────────────
  const ws1 = buildSheet(regularStudents, orderedExams, attendanceMap);
  XLSX.utils.book_append_sheet(wb, ws1, 'Ana Liste');

  // ── Sheet 2: Misafirler (only if there are guests) ────────────────────────
  if (guestStudents.length > 0) {
    // Alphabetical sort by name then surname (Turkish locale, case-insensitive)
    const sortedGuests = [...guestStudents].sort((a, b) => {
      const nameA = (a.name || '').toLocaleLowerCase('tr-TR');
      const nameB = (b.name || '').toLocaleLowerCase('tr-TR');
      if (nameA !== nameB) return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
      const surnameA = (a.surname || '').toLocaleLowerCase('tr-TR');
      const surnameB = (b.surname || '').toLocaleLowerCase('tr-TR');
      return surnameA.localeCompare(surnameB, 'tr', { sensitivity: 'base' });
    });
    const ws2 = buildSheet(sortedGuests, orderedExams, attendanceMap);
    XLSX.utils.book_append_sheet(wb, ws2, 'Misafirler');
  }

  // ── Download ─────────────────────────────────────────────────────────────
  // Use writeFile with cellStyles: true so xlsx-js-style applies the .s properties.
  XLSX.writeFile(wb, 'Yoklama_Listesi.xlsx', { cellStyles: true });
}
