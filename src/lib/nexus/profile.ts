import type { CellValue, ColumnKind, ColumnProfile, Dataset, Row } from "./types";
import { kurtosis, mean, median, mode, quantile, skewness, std } from "./stats";

function detectKind(rows: Row[], col: string): ColumnKind {
  let num = 0;
  let nonNull = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null) continue;
    nonNull++;
    if (typeof v === "number") num++;
  }
  if (nonNull === 0) return "categorical";
  return num / nonNull >= 0.8 ? "numeric" : "categorical";
}

function numericValues(rows: Row[], col: string): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = r[col];
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}
function stringValues(rows: Row[], col: string): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const v = r[col];
    if (v !== null && v !== undefined) out.push(String(v));
  }
  return out;
}

export function profileDataset(columns: string[], rows: Row[]): Dataset {
  const profiles: Record<string, ColumnProfile> = {};
  for (const col of columns) {
    const missing = rows.reduce((a, r) => a + (r[col] === null ? 1 : 0), 0);
    const kind = detectKind(rows, col);
    const base: ColumnProfile = {
      name: col,
      kind,
      missing,
      missingPct: rows.length ? missing / rows.length : 0,
    };
    if (kind === "numeric") {
      const xs = numericValues(rows, col);
      const sorted = [...xs].sort((a, b) => a - b);
      const q1 = quantile(sorted, 0.25);
      const q3 = quantile(sorted, 0.75);
      const iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      const outliers = xs.filter((x) => x < lo || x > hi).length;
      const sk = skewness(xs);
      base.mean = mean(xs);
      base.median = median(xs);
      base.std = std(xs);
      base.min = sorted[0];
      base.max = sorted[sorted.length - 1];
      base.skewness = sk;
      base.kurtosis = kurtosis(xs);
      base.iqr = iqr;
      base.outliers = outliers;
      // EDA strategy
      const outlierRatio = xs.length ? outliers / xs.length : 0;
      base.aggStrategy = Math.abs(sk) > 1 || outlierRatio > 0.05 ? "Median" : "Mean";
    } else {
      const vs = stringValues(rows, col);
      const m = mode(vs);
      const freq = new Map<string, number>();
      for (const v of vs) freq.set(v, (freq.get(v) ?? 0) + 1);
      const top = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }));
      base.cardinality = freq.size;
      base.topValues = top;
      base.mode = m?.value;
    }
    profiles[col] = base;
  }
  return { columns, rows, profiles };
}

export function isMissing(v: CellValue): boolean {
  return v === null || v === undefined;
}