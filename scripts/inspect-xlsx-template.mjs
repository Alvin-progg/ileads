// Dumps a worksheet's merged-cell ranges and every non-empty cell (formula + cached value,
// or literal value) to stdout, resolving shared strings. No dependencies.
//
// Usage:
//   unzip -o -q path/to/workbook.xlsx -d /tmp/extracted
//   node scripts/inspect-xlsx-template.mjs /tmp/extracted/xl/worksheets/sheet2.xml /tmp/extracted/xl/sharedStrings.xml
//
// Cross-reference /tmp/extracted/xl/workbook.xml (<sheet name="..." r:id="rIdN"/>) with
// /tmp/extracted/xl/_rels/workbook.xml.rels (rIdN -> worksheets/sheetM.xml) to find which
// sheetM.xml corresponds to which sheet name — sheet order in the UI does not always match
// the sheetN.xml filename numbering.
import { readFileSync } from "node:fs";

const [, , sheetPath, sharedStringsPath] = process.argv;
if (!sheetPath) {
  console.error("Usage: node inspect-xlsx-template.mjs <sheetN.xml> [sharedStrings.xml]");
  process.exit(1);
}

function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(xml))) {
    const inner = m[1];
    const texts = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]);
    const joined = texts
      .join("")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    strings.push(joined);
  }
  return strings;
}

const sheetXml = readFileSync(sheetPath, "utf8");
const sharedXml = sharedStringsPath ? readFileSync(sharedStringsPath, "utf8") : null;
const shared = parseSharedStrings(sharedXml);

const mergeCells = [...sheetXml.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map((m) => m[1]);

const cellRegex = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const rows = new Map();
let cm;
while ((cm = cellRegex.exec(sheetXml))) {
  const [, col, rowNum, attrs, inner] = cm;
  const typeMatch = attrs.match(/t="([^"]+)"/);
  const type = typeMatch ? typeMatch[1] : null;
  let value = null;
  if (inner) {
    const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
    const fMatch = inner.match(/<f[^>]*>([\s\S]*?)<\/f>/);
    const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/); // inlineStr
    let cached = null;
    if (vMatch) {
      const raw = vMatch[1];
      cached = type === "s" ? (shared[Number(raw)] ?? `#SHARED${raw}`) : raw;
    } else if (tMatch) {
      cached = tMatch[1];
    }
    if (fMatch) {
      value = cached !== null ? `=${fMatch[1]} [cached: ${cached}]` : `=${fMatch[1]}`;
    } else {
      value = cached;
    }
  }
  if (value !== null && value !== "") {
    const r = Number(rowNum);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push({ col, colNum: colToNum(col), ref: `${col}${rowNum}`, value });
  }
}

const sortedRows = [...rows.keys()].sort((a, b) => a - b);
console.log("=== MERGED CELLS ===");
console.log(mergeCells.join(", "));
console.log("\n=== NON-EMPTY CELLS BY ROW ===");
for (const r of sortedRows) {
  const cells = rows.get(r).sort((a, b) => a.colNum - b.colNum);
  const line = cells.map((c) => `${c.ref}=${JSON.stringify(c.value)}`).join("  ");
  console.log(`Row ${r}: ${line}`);
}
