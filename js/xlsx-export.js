// Eigener, abhängigkeitsfreier XLSX-Export: baut einen minimalen, gültigen
// .xlsx-Container (ZIP mit Compression-Method "Store", keine Kompression nötig) direkt
// im Browser. Kein externer Dependency, passend zur "100% lokal"-Philosophie der App.

export function exportRowsAsXlsx(rows, filename = "Datentabelle.xlsx") {
  const sheetXml = buildSheetXml(rows);
  const files = [
    { name: "[Content_Types].xml", data: textToBytes(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: textToBytes(RELS_XML) },
    { name: "xl/workbook.xml", data: textToBytes(WORKBOOK_XML) },
    { name: "xl/_rels/workbook.xml.rels", data: textToBytes(WORKBOOK_RELS_XML) },
    { name: "xl/worksheets/sheet1.xml", data: textToBytes(sheetXml) },
  ];

  const blob = buildZipBlob(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildSheetXml(rows) {
  const header = ["Datum", "Übung", "Gruppe", "Kg", "Wdh"];
  const headerRow = rowXml(1, [
    inlineStrCell("A1", header[0]),
    inlineStrCell("B1", header[1]),
    inlineStrCell("C1", header[2]),
    inlineStrCell("D1", header[3]),
    inlineStrCell("E1", header[4]),
  ]);

  const dataRows = rows.map((row, i) => {
    const r = i + 2;
    return rowXml(r, [
      inlineStrCell(`A${r}`, row.d),
      inlineStrCell(`B${r}`, row.exerciseName),
      inlineStrCell(`C${r}`, row.grp),
      numberCell(`D${r}`, row.kg),
      numberCell(`E${r}`, row.r),
    ]);
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
}

function rowXml(r, cells) {
  return `<row r="${r}">${cells.join("")}</row>`;
}

function inlineStrCell(ref, value) {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function numberCell(ref, value) {
  return `<c r="${ref}"><v>${value}</v></c>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToBytes(str) {
  return new TextEncoder().encode(str);
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Datentabelle" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

// --- Minimaler ZIP-Writer (nur Compression-Method "Store" = 0, kein Deflate nötig) ---

function buildZipBlob(files) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  const records = [];

  for (const f of files) {
    const nameBytes = textToBytes(f.name);
    const data = f.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true); // Store, keine Kompression
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    records.push({ nameBytes, crc, size: data.length, offset });
    localChunks.push(local, data);
    offset += local.length + data.length;
  }

  const centralOffset = offset;
  for (const r of records) {
    const central = new Uint8Array(46 + r.nameBytes.length);
    const dv = new DataView(central.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0, true);
    dv.setUint32(16, r.crc, true);
    dv.setUint32(20, r.size, true);
    dv.setUint32(24, r.size, true);
    dv.setUint16(28, r.nameBytes.length, true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(38, 0, true);
    dv.setUint32(42, r.offset, true);
    central.set(r.nameBytes, 46);
    centralChunks.push(central);
  }
  const centralSize = centralChunks.reduce((sum, c) => sum + c.length, 0);

  const eocd = new Uint8Array(22);
  const dv = new DataView(eocd.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, records.length, true);
  dv.setUint16(10, records.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, centralOffset, true);

  return new Blob([...localChunks, ...centralChunks, eocd], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
