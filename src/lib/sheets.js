import { unzipSync, strFromU8 } from "fflate";

// Reads a spreadsheet in the browser: .xlsx (Excel, Google Sheets export) or
// .csv. Returns [{ name, rows }] where rows are arrays of cell strings
// (row/column positions kept, empty cells as ""). Dates stay as Excel's
// day numbers — lib/clientImport.js knows which columns hold dates.

export function readSpreadsheet(buffer, fileName = "") {
  if (/\.csv$/i.test(fileName)) return [{ name: fileName.replace(/\.csv$/i, ""), rows: parseCsv(new TextDecoder().decode(buffer)) }];
  return readXlsx(new Uint8Array(buffer));
}

function xml(files, path) {
  const bytes = files[path];
  return bytes ? new DOMParser().parseFromString(strFromU8(bytes), "application/xml") : null;
}

// Element children by local name, whatever the XML namespace prefix.
const byName = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));

function readXlsx(bytes) {
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("not_a_spreadsheet");
  }
  const workbook = xml(files, "xl/workbook.xml");
  if (!workbook) throw new Error("not_a_spreadsheet");

  const rels = xml(files, "xl/_rels/workbook.xml.rels");
  const targets = new Map(byName(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target")]));

  const shared = [];
  const sst = xml(files, "xl/sharedStrings.xml");
  if (sst) {
    for (const si of byName(sst, "si")) shared.push(byName(si, "t").map((t) => t.textContent).join(""));
  }

  return byName(workbook, "sheet").map((sheet) => {
    const rid = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sheet.getAttribute("r:id");
    const target = (targets.get(rid) || "").replace(/^\/?(xl\/)?/, "");
    const doc = xml(files, `xl/${target}`);
    return { name: sheet.getAttribute("name"), rows: doc ? sheetRows(doc, shared) : [] };
  });
}

function columnIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function sheetRows(doc, shared) {
  const rows = [];
  for (const row of byName(doc, "row")) {
    const r = Number(row.getAttribute("r")) - 1;
    const cells = [];
    for (const c of byName(row, "c")) {
      const type = c.getAttribute("t");
      let value = "";
      if (type === "inlineStr") value = byName(c, "t").map((t) => t.textContent).join("");
      else {
        const v = byName(c, "v")[0]?.textContent ?? "";
        value = type === "s" ? (shared[Number(v)] ?? "") : type === "b" ? (v === "1" ? "TRUE" : "FALSE") : v;
      }
      cells[columnIndex(c.getAttribute("r") || "A")] = value;
    }
    rows[r] = Array.from(cells, (v) => v ?? "");
  }
  return Array.from(rows, (row) => row ?? []);
}

// RFC 4180 CSV: quoted fields, doubled quotes, commas/semicolons, CRLF.
function parseCsv(text) {
  const delimiter = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
