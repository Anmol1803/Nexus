import type { Dataset, NumericRanges, RelationshipMap } from "./types";
import { correlationRatio, pearson, quantile } from "./stats";

const NUM_CORR_THRESHOLD = 0.20;
const CAT_INFLUENCE_THRESHOLD = 0.25;
const MAX_FEATURES_PER_TARGET = 4;
const MAX_CARDINALITY = 100;

export function buildRelationships(ds: Dataset): RelationshipMap {
  const out: RelationshipMap = {};
  const numericCols = ds.columns.filter((c) => ds.profiles[c].kind === "numeric");
  const catCols = ds.columns.filter(
    (c) => ds.profiles[c].kind === "categorical" && (ds.profiles[c].cardinality ?? 0) <= MAX_CARDINALITY && (ds.profiles[c].cardinality ?? 0) > 1,
  );

  for (const target of ds.columns) {
    const t = ds.profiles[target];
    if (t.missing === 0) continue; // no need

    const numScores: { col: string; score: number }[] = [];
    const catScores: { col: string; score: number }[] = [];

    if (t.kind === "numeric") {
      // numeric vs numeric
      for (const other of numericCols) {
        if (other === target) continue;
        const a: number[] = [];
        const b: number[] = [];
        for (const r of ds.rows) {
          const x = r[target];
          const y = r[other];
          if (typeof x === "number" && typeof y === "number") { a.push(x); b.push(y); }
        }
        const r = Math.abs(pearson(a, b));
        if (r >= NUM_CORR_THRESHOLD) numScores.push({ col: other, score: r });
      }
      // categorical influence
      for (const c of catCols) {
        const cats: string[] = [];
        const nums: number[] = [];
        for (const r of ds.rows) {
          const x = r[target];
          const y = r[c];
          if (typeof x === "number" && y !== null) { nums.push(x); cats.push(String(y)); }
        }
        const eta = correlationRatio(cats, nums);
        if (eta >= CAT_INFLUENCE_THRESHOLD) catScores.push({ col: c, score: eta });
      }
    } else {
      // categorical target — use cat-cat via Cramer-like via correlation ratio of one-hot? Simplify:
      // Score categorical features by mutual frequency dependency (normalized) using mode purity per group.
      for (const c of catCols) {
        if (c === target) continue;
        const groups = new Map<string, Map<string, number>>();
        let total = 0;
        for (const r of ds.rows) {
          const x = r[target];
          const y = r[c];
          if (x === null || y === null) continue;
          const k = String(y);
          const m = groups.get(k) ?? new Map<string, number>();
          const tv = String(x);
          m.set(tv, (m.get(tv) ?? 0) + 1);
          groups.set(k, m);
          total++;
        }
        if (!total) continue;
        let purity = 0;
        for (const m of groups.values()) {
          let max = 0;
          let sum = 0;
          for (const v of m.values()) { sum += v; if (v > max) max = v; }
          purity += max;
        }
        const score = purity / total;
        if (score >= 0.5) catScores.push({ col: c, score });
      }
      // numeric influence on categorical
      for (const n of numericCols) {
        const cats: string[] = [];
        const nums: number[] = [];
        for (const r of ds.rows) {
          const x = r[target];
          const y = r[n];
          if (x !== null && typeof y === "number") { cats.push(String(x)); nums.push(y); }
        }
        const eta = correlationRatio(cats, nums);
        if (eta >= CAT_INFLUENCE_THRESHOLD) numScores.push({ col: n, score: eta });
      }
    }

    numScores.sort((a, b) => b.score - a.score);
    catScores.sort((a, b) => b.score - a.score);

    // limit total features
    const cat = catScores.slice(0, MAX_FEATURES_PER_TARGET);
    const remaining = Math.max(0, MAX_FEATURES_PER_TARGET - cat.length);
    const num = numScores.slice(0, Math.max(2, remaining));

    out[target] = { categorical: cat, numeric: num };
  }
  return out;
}

export function buildNumericRanges(ds: Dataset, relationships: RelationshipMap): NumericRanges {
  const needed = new Set<string>();
  for (const t of Object.keys(relationships)) {
    for (const f of relationships[t].numeric) needed.add(f.col);
  }
  const ranges: NumericRanges = {};
  for (const col of needed) {
    const vals: number[] = [];
    for (const r of ds.rows) {
      const v = r[col];
      if (typeof v === "number") vals.push(v);
    }
    const sorted = [...vals].sort((a, b) => a - b);
    if (sorted.length < 5) {
      ranges[col] = [sorted[0] ?? 0, sorted[sorted.length - 1] ?? 0];
      continue;
    }
    const nBins = 5;
    const edges: number[] = [];
    for (let i = 0; i <= nBins; i++) edges.push(quantile(sorted, i / nBins));
    // dedupe
    const unique: number[] = [];
    for (const e of edges) if (!unique.length || e > unique[unique.length - 1]) unique.push(e);
    ranges[col] = unique;
  }
  return ranges;
}

export function binNumeric(value: number, edges: number[]): string {
  if (!edges.length) return "*";
  for (let i = 1; i < edges.length; i++) {
    if (value <= edges[i]) return `${formatN(edges[i - 1])}-${formatN(edges[i])}`;
  }
  return `${formatN(edges[edges.length - 2])}-${formatN(edges[edges.length - 1])}`;
}
function formatN(n: number): string {
  if (!Number.isFinite(n)) return "?";
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}