import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Loads a blank template workbook from public/templates/. exceljs preserves
 * every style, merge and formula already in the file — we only ever set
 * individual cell values on top of it, never rebuild sheets.
 */
export async function loadTemplate(filename: string): Promise<ExcelJS.Workbook> {
  const buffer = await readFile(path.join(process.cwd(), "public", "templates", filename));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

/**
 * exceljs never evaluates formulas — it just writes them back out with
 * whatever cached <v> value the template last had (usually 0, from when the
 * template was blanked). Without this, Excel shows those stale cached values
 * until the user manually forces a recalculation. Setting this flag makes
 * Excel recalculate everything the moment the file opens.
 */
export function forceRecalcOnOpen(workbook: ExcelJS.Workbook) {
  workbook.calcProperties.fullCalcOnLoad = true;
}

/**
 * A Blob, not Node's Buffer — it's an unambiguous Response() body in every
 * lib.dom.d.ts BodyInit overload, sidestepping the ArrayBufferView generic
 * mismatches between Node's Buffer/Uint8Array and the DOM types.
 */
export async function toBlob(workbook: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: XLSX_CONTENT_TYPE });
}
