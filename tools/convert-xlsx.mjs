// Einmaliges Konvertierungsskript: liest eine Excel-Export-Datei im Format von
// "Sport (1).xlsx" (Sheet "Daten": Zeile 1 = Datums-Spalten B..., danach je 2 Zeilen
// pro Übung: kg-Zeile mit Übungsname in Spalte A, direkt gefolgt von der zugehörigen
// Wdh-Zeile) und schreibt js/seed-data.js neu.
//
// Nur Node-Bordmittel, keine npm-Pakete. Ausführen mit:
//   node tools/convert-xlsx.mjs "<Pfad zur xlsx-Datei>"
//
// Läuft nur während der Entwicklung (z.B. wenn die Trainingshistorie erneut aus einem
// Excel-Export aktualisiert werden soll). Ist kein Teil der Laufzeit-App.

import { readFile, writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

// Übungsname -> Muskelgruppe. Bei neuen, unbekannten Übungsnamen in zukünftigen
// Excel-Exports muss diese Tabelle ergänzt werden (das Skript bricht sonst mit einer
// klaren Fehlermeldung ab, statt eine Übung stillschweigend falsch einzuordnen).
const GROUP_BY_NAME = {
  "Rücken unten": "Rücken",
  "Rudern frei": "Rücken",
  "Rudern Turm": "Rücken",
  "Rudern MTS": "Rücken",
  "Rudern Maschine": "Rücken",
  "Klimmzüge": "Rücken",
  "Lat-Zug": "Rücken",
  "Brustpresse": "Brust",
  "Brust Bankdrücken": "Brust",
  "Schultern drücken": "Schultern",
  "Schultern Maschine": "Schultern",
  "Schultern Seite Maschine": "Schultern",
  "Schultern Seitheben frei": "Schultern",
  "Bizeps Hanteln": "Arme",
  "Bizeps Maschine": "Arme",
  "Trizeps Kabel leicht": "Arme",
  "Trizeps Kabel schwer": "Arme",
  "Trizeps super schwer": "Arme",
  "Beinpresse": "Beine",
  "Beinbeuger": "Beine",
  "Beinstrecker": "Beine",
};

// Feste Anzeige-Reihenfolge der Übungen: nach Gruppe (Rücken, Brust, Schultern, Arme,
// Beine), innerhalb der Gruppe in der Reihenfolge, in der sie im Original-Export
// auftauchen.
const GROUP_ORDER = ["Rücken", "Brust", "Schultern", "Arme", "Beine"];

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    console.error('Bitte Pfad zur xlsx-Datei angeben: node tools/convert-xlsx.mjs "<Pfad>"');
    process.exit(1);
  }

  const entries = await readZipEntries(xlsxPath);
  const sharedStrings = parseSharedStrings(entries["xl/sharedStrings.xml"]);
  const sheetPath = await resolveDatenSheetPath(entries, sharedStrings);
  const sheetXml = entries[sheetPath];
  if (!sheetXml) throw new Error(`Sheet "${sheetPath}" nicht im Workbook gefunden.`);

  const rows = parseRows(sheetXml.toString("utf8"));
  const dateByCol = parseHeaderDates(rows[1]);
  const exercisesByName = parseExercisePairs(rows, sharedStrings, dateByCol);

  const ordered = orderExercises(exercisesByName);
  const js = renderSeedDataJs(ordered);

  const outPath = path.join(process.cwd(), "js", "seed-data.js");
  await writeFile(outPath, js, "utf8");
  console.log(`Geschrieben: ${outPath} (${ordered.length} Übungen)`);
}

// --- Minimaler ZIP-Reader (nur was xlsx braucht: zentrales Verzeichnis, DEFLATE) ---

async function readZipEntries(filePath) {
  const buf = await readFile(filePath);
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === eocdSig) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error("Keine gültige ZIP/EOCD-Struktur gefunden – ist das wirklich eine xlsx-Datei?");

  const entryCount = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries = {};
  let offset = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x02014b50) throw new Error("Unerwartete Central-Directory-Signatur.");
    const compMethod = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);

    const data = readLocalEntryData(buf, localHeaderOffset, compMethod, compSize);
    entries[name] = data;

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readLocalEntryData(buf, localOffset, compMethod, compSize) {
  const nameLen = buf.readUInt16LE(localOffset + 26);
  const extraLen = buf.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + compSize);
  if (compMethod === 0) return raw; // stored, unkomprimiert
  if (compMethod === 8) return inflateRawSync(raw); // deflate
  throw new Error(`Unbekannte ZIP-Kompressionsmethode: ${compMethod}`);
}

// --- XML-Parsing (bewusst minimal: nur die Tags, die wir brauchen) ---

function parseSharedStrings(xmlBuf) {
  if (!xmlBuf) return [];
  const xml = xmlBuf.toString("utf8");
  const strings = [];
  const re = /<si>(.*?)<\/si>/gs;
  let m;
  while ((m = re.exec(xml))) {
    const tMatches = [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)];
    strings.push(tMatches.map((tm) => tm[1]).join("").trim());
  }
  return strings;
}

async function resolveDatenSheetPath(entries, _sharedStrings) {
  const workbookXml = entries["xl/workbook.xml"]?.toString("utf8") ?? "";
  const relsXml = entries["xl/_rels/workbook.xml.rels"]?.toString("utf8") ?? "";

  const sheetMatch = [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)]
    .find(([, name]) => name === "Daten");
  if (!sheetMatch) throw new Error('Sheet "Daten" nicht im Workbook gefunden.');
  const rId = sheetMatch[2];

  const relMatch = [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)]
    .find(([, id]) => id === rId);
  if (!relMatch) throw new Error(`Relationship ${rId} nicht gefunden.`);
  return `xl/${relMatch[2]}`;
}

// Liefert { [rowNumber]: { [col]: { value, isSharedString } } }
function parseRows(sheetXmlStr) {
  const rows = {};
  const rowRe = /<row r="(\d+)">(.*?)<\/row>/gs;
  let rm;
  while ((rm = rowRe.exec(sheetXmlStr))) {
    const rowNum = Number(rm[1]);
    const cells = {};
    const cellRe = /<c r="([A-Z]+)\d+"(?:\s+[a-zA-Z:]+="[^"]*")*?(?:\/>|>(?:<v>([^<]*)<\/v>)?<\/c>)/g;
    const cellTypeRe = /<c r="([A-Z]+)\d+"[^>]*\bt="(\w+)"[^>]*(?:\/>|>(?:<v>([^<]*)<\/v>)?<\/c>)/g;
    let cm;
    // erst generisch alle Zellen mit Wert einsammeln
    while ((cm = cellRe.exec(rm[2]))) {
      const [, col, val] = cm;
      if (val === undefined) continue;
      cells[col] = { value: val, isSharedString: false };
    }
    // dann die mit t="s" (sharedString) als solche markieren
    while ((cm = cellTypeRe.exec(rm[2]))) {
      const [, col, type, val] = cm;
      if (type === "s" && val !== undefined) cells[col] = { value: val, isSharedString: true };
    }
    rows[rowNum] = cells;
  }
  return rows;
}

function parseHeaderDates(headerRow) {
  const dateByCol = {};
  for (const [col, cell] of Object.entries(headerRow)) {
    if (col === "A") continue;
    const serial = Number(cell.value);
    dateByCol[col] = excelSerialToDate(serial);
  }
  return dateByCol;
}

function excelSerialToDate(serial) {
  const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function parseExercisePairs(rows, sharedStrings, dateByCol) {
  const rowNumbers = Object.keys(rows).map(Number).filter((n) => n > 1).sort((a, b) => a - b);
  const exercises = [];

  let i = 0;
  while (i < rowNumbers.length) {
    const kgRowNum = rowNumbers[i];
    const kgRow = rows[kgRowNum];
    const aCell = kgRow["A"];
    if (!aCell || !aCell.isSharedString) { i++; continue; } // keine Übungs-Startzeile

    const name = sharedStrings[Number(aCell.value)].trim();
    const repsRowNum = rowNumbers[i + 1];
    const repsRow = repsRowNum !== undefined ? rows[repsRowNum] : {};

    const sessions = [];
    for (const [col, dateStr] of Object.entries(dateByCol)) {
      const kgCell = kgRow[col];
      const rCell = repsRow[col];
      if (!kgCell || !rCell) continue;
      const kg = Number(kgCell.value);
      const r = Number(rCell.value);
      if (!(kg > 0)) continue;
      sessions.push({ d: dateStr, kg, r });
    }
    // neueste zuerst (Sessions sind aktuell in willkürlicher Spaltenreihenfolge,
    // daher explizit nach Datum sortieren statt sich auf Spaltenreihenfolge zu verlassen)
    sessions.sort((a, b) => parseDmy(b.d) - parseDmy(a.d));

    const grp = GROUP_BY_NAME[name];
    if (!grp) throw new Error(`Unbekannte Übung "${name}" – bitte in GROUP_BY_NAME ergänzen.`);

    exercises.push({ name, grp, img: null, sessions });
    i += 2;
  }
  return exercises;
}

function parseDmy(d) {
  const [dd, mm, yyyy] = d.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd).getTime();
}

function orderExercises(exercises) {
  return GROUP_ORDER.flatMap((grp) => exercises.filter((e) => e.grp === grp));
}

function renderSeedDataJs(exercises) {
  const lines = [];
  lines.push('// Auto-generiert aus "Sport (1).xlsx" via tools/convert-xlsx.mjs – nicht händisch editieren.');
  lines.push("export const seedExercises = [");
  for (const ex of exercises) {
    lines.push("  {");
    lines.push(`    name: ${JSON.stringify(ex.name)},`);
    lines.push(`    grp: ${JSON.stringify(ex.grp)},`);
    lines.push("    img: null,");
    lines.push("    sessions: [");
    for (const s of ex.sessions) {
      lines.push(`      { d: ${JSON.stringify(s.d)}, kg: ${s.kg}, r: ${s.r} },`);
    }
    lines.push("    ],");
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
