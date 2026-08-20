// One-time script: derives a blank version of each real DepEd workbook in
// files/ (gitignored, real learner data) by clearing every literal data-cell
// value in the ranges below. Formula cells are always left untouched — this
// is checked per cell, not just by excluding formula columns from a range —
// so it's safe to sweep a whole data block without hand-picking columns.
//
// Run once per template (or whenever a template is replaced):
//   node scripts/blank-xlsx-template.mjs
//
// Output goes to public/templates/, committed to the repo. files/ itself
// stays gitignored — it holds real learner data, not to be committed.
import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const JOBS = [
  {
    src: "files/CRLA2_TagalogSchoolSummary_v1.xlsx",
    dest: "public/templates/CRLA2_TagalogSchoolSummary_blank.xlsx",
    clears: [{ sheet: "Class Results", rows: [8, 355], cols: ["A", "T"] }],
  },
  {
    src: "files/107460_PANAY-ES-RMAT-BOSY-KEY-STAGE-1.xlsx",
    dest: "public/templates/RMA_KeyStage1_blank.xlsx",
    clears: [{ sheet: "Class Results", rows: [10, 362], cols: ["A", "X"] }],
  },
  {
    src: "files/PANAY-ES-MPS-SY-2025-2026.xlsx",
    dest: "public/templates/MPS_blank.xlsx",
    clears: [5, 17, 29, 41].map((headerRow) => ({
      sheet: null, // applied to every subject sheet below
      rows: [headerRow + 4, headerRow + 9],
      cols: ["A", "H"],
    })),
    allSheets: true,
  },
  {
    src: "files/SY-2022-2023-Phil-IRI-Pre-Test-Result.xlsx",
    dest: "public/templates/PhilIRI_blank.xlsx",
    // Column A ("IV"/"V"/"VI" grade labels, "Total") is left alone — the
    // writer never touches it, relying on the template's own static labels.
    clears: [{ sheet: "Summary", rows: [4, 11], cols: ["B", "V"] }],
  },
];

function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function numToCol(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function clearRange(sheet, [fromRow, toRow], [fromCol, toCol]) {
  const fromColNum = colToNum(fromCol);
  const toColNum = colToNum(toCol);
  let cleared = 0;
  for (let r = fromRow; r <= toRow; r++) {
    const row = sheet.getRow(r);
    for (let c = fromColNum; c <= toColNum; c++) {
      const cell = row.getCell(numToCol(c));
      const isFormula =
        cell.value !== null &&
        typeof cell.value === "object" &&
        "formula" in cell.value;
      if (isFormula) continue;
      if (cell.value !== null && cell.value !== undefined) {
        cell.value = null;
        cleared++;
      }
    }
  }
  return cleared;
}

for (const job of JOBS) {
  const srcPath = path.join(ROOT, job.src);
  const destPath = path.join(ROOT, job.dest);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(srcPath);

  let totalCleared = 0;
  for (const clear of job.clears) {
    const sheets = job.allSheets
      ? workbook.worksheets
      : [workbook.getWorksheet(clear.sheet)];
    for (const sheet of sheets) {
      if (!sheet) continue;
      totalCleared += clearRange(sheet, clear.rows, clear.cols);
    }
  }

  await workbook.xlsx.writeFile(destPath);
  console.log(`${job.dest}: cleared ${totalCleared} literal cells (from ${job.src})`);
}
