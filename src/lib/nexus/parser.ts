import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { Row, CellValue } from "./types";

export { normalizeCell as normalizeValue };

function normalizeCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "" || /^(na|n\/a|null|none|nan|-)$/i.test(t)) return null;

    // Remove currency symbols, percent, and thousand separators
    let cleaned = t
      .replace(/[$€£¥%]/g, "")
      .replace(/,/g, "")
      .trim();

    // Remove all spaces (they might be thousand separators)
    cleaned = cleaned.replace(/\s/g, "");

    // Handle multiple dots: keep only the last one
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      const last = parts.pop();
      const integerPart = parts.join('');
      cleaned = integerPart + '.' + last;
    }

    // Try to parse as number
    const n = Number(cleaned);
    if (!Number.isNaN(n) && cleaned !== "") {
      return n;
    }

    // Ultimate fallback: remove everything except digits, dot, and minus
    // This handles "123abc", "1-2", etc.
    const numericOnly = cleaned.replace(/[^0-9.\-]/g, "");
    const n2 = Number(numericOnly);
    if (!Number.isNaN(n2) && numericOnly !== "") {
      return n2;
    }

    // If still not a number, return the trimmed string
    return t;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return String(v);
}

export async function parseFile(file: File): Promise<{ columns: string[]; rows: Row[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const res = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const columns = res.meta.fields ?? [];
    const rows: Row[] = res.data.map((r) => {
      const out: Row = {};
      for (const c of columns) out[c] = normalizeCell(r[c]);
      return out;
    });
    return { columns, rows };
  }
  // xlsx / xls
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const columns = json.length ? Object.keys(json[0]) : [];
  const rows: Row[] = json.map((r) => {
    const out: Row = {};
    for (const c of columns) out[c] = normalizeCell(r[c]);
    return out;
  });
  return { columns, rows };
}