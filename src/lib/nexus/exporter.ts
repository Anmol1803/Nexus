import * as XLSX from "xlsx";
import type { RecoveryRecord, Row } from "./types";

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV(columns: string[], rows: Row[], filename: string): void {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(escape).join(",")];
  for (const r of rows) lines.push(columns.map((c) => escape(r[c])).join(","));
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
}

export function exportXLSX(columns: string[], rows: Row[], filename: string): void {
  const wb = XLSX.utils.book_new();
  const data = [columns, ...rows.map((r) => columns.map((c) => r[c]))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Cleaned");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/octet-stream" }), filename);
}

export function exportAuditCSV(records: RecoveryRecord[]): void {
  const cols = [
    "timestamp",
    "rowIndex",
    "column",
    "recoveredValue",
    "method",
    "aggregation",
    "support",
    "confidence",
    "groupKey",
    "reasoning",
  ];
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of records) {
    lines.push(
      cols
        .map((c) => escape((r as unknown as Record<string, unknown>)[c]))
        .join(","),
    );
  }
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "nexus-audit-log.csv");
}