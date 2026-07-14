import type {
  CellValue,
  Dataset,
  GroupProfileStats,
  GroupProfileTable,
  ImpactReport,
  NumericRanges,
  RecoveryRecord,
  RelationshipMap,
  Row,
} from "./types";
import { mean, median, mode, std, skewness } from "./stats";
import { binNumeric } from "./relationships";
import { isMissing } from "./profile";
import { runMLImputation } from "./mlImpute";

// ============================================================
// Adaptive Min Support
// ============================================================
function dynamicMinSupport(totalRows: number, missingPct: number): number {
  let base = totalRows < 500 ? 2 : totalRows < 5000 ? 3 : 5;
  if (missingPct > 0.7) {
    base = Math.max(2, Math.floor(base * 0.5));
  } else if (missingPct > 0.5) {
    base = Math.max(2, Math.floor(base * 0.7));
  } else if (missingPct > 0.3) {
    base = Math.max(2, Math.floor(base * 0.9));
  }
  return Math.max(2, base);
}

// ============================================================
// Special Column Handling
// ============================================================
function handleSpecialColumns(
  ds: Dataset,
  rows: Row[],
  baseRecoveries: RecoveryRecord[] = []
): { handledColumns: Set<string>; updatedRows: Row[]; recoveries: RecoveryRecord[] } {
  const handled = new Set<string>();
  const updated = rows.map((r) => ({ ...r }));
  const recoveries: RecoveryRecord[] = [...baseRecoveries];
  const totalRows = ds.rows.length;

  for (const col of ds.columns) {
    const prof = ds.profiles[col];
    if (prof.missing === 0) continue;

    const uniqueCount = prof.cardinality ?? 0;
    const nonNullCount = totalRows - prof.missing;

    // --- 1. Non‑imputable (high cardinality > 90%) ---
    if (uniqueCount / totalRows > 0.9) {
      const fillVal = prof.kind === "numeric" ? null : "N/A";
      for (let i = 0; i < updated.length; i++) {
        if (isMissing(updated[i][col])) {
          updated[i][col] = fillVal;
          recoveries.push({
            rowIndex: i,
            column: col,
            originalValue: null,
            recoveredValue: fillVal,
            method: "Special Column",
            groupKey: "*special",
            dimensions: [],
            support: 0,
            aggregation: "Placeholder",
            confidence: 100,
            reasoning: `High‑cardinality column → filled with "${fillVal}"`,
            timestamp: new Date().toISOString(),
            pass: 0,
            reliability: 1,
            globalEstimate: fillVal,
          });
        }
      }
      handled.add(col);
      continue;
    }

    // --- 2. Heuristic based on column name ---
    const lowerCol = col.toLowerCase();
    if (['id','seq','uid','gmail','email','phone','name','contact','uuid','mobile','mob','phone_no','user','username','full_name','first_name','last_name'].some(k => lowerCol.includes(k))) {
      const fillVal = prof.kind === "numeric" ? null : "N/A";
      for (let i = 0; i < updated.length; i++) {
        if (isMissing(updated[i][col])) {
          updated[i][col] = fillVal;
          recoveries.push({
            rowIndex: i,
            column: col,
            originalValue: null,
            recoveredValue: fillVal,
            method: "Special Column",
            groupKey: "*special",
            dimensions: [],
            support: 0,
            aggregation: "Placeholder",
            confidence: 100,
            reasoning: `Column name heuristic → filled with "${fillVal}"`,
            timestamp: new Date().toISOString(),
            pass: 0,
            reliability: 1,
            globalEstimate: fillVal,
          });
        }
      }
      handled.add(col);
      continue;
    }

    // --- 3. Numeric sequence detection ---
    const values: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < updated.length; i++) {
      const v = updated[i][col];
      if (typeof v === 'number' && Number.isFinite(v)) {
        values.push(v);
        indices.push(i);
      }
    }
    if (values.length >= 3) {
      const step = values[1] - values[0];
      let isSeq = true;
      for (let j = 2; j < values.length; j++) {
        if (Math.abs((values[j] - values[j - 1]) - step) > 1e-9) {
          isSeq = false;
          break;
        }
      }
      if (isSeq) {
        for (let i = 0; i < updated.length; i++) {
          if (isMissing(updated[i][col])) {
            let prevIdx = -1;
            for (let j = i - 1; j >= 0; j--) {
              if (!isMissing(updated[j][col])) { prevIdx = j; break; }
            }
            let nextIdx = -1;
            for (let j = i + 1; j < updated.length; j++) {
              if (!isMissing(updated[j][col])) { nextIdx = j; break; }
            }
            let newVal: number;
            if (prevIdx !== -1 && nextIdx !== -1) {
              const prevVal = updated[prevIdx][col] as number;
              const nextVal = updated[nextIdx][col] as number;
              const gap = nextIdx - prevIdx;
              const slope = (nextVal - prevVal) / gap;
              newVal = prevVal + slope * (i - prevIdx);
            } else if (prevIdx !== -1) {
              const prevVal = updated[prevIdx][col] as number;
              const knownIndices = indices.filter(idx => idx < i);
              if (knownIndices.length >= 2) {
                const last = knownIndices[knownIndices.length - 1];
                const prev = knownIndices[knownIndices.length - 2];
                const stepVal = ((updated[last][col] as number) - (updated[prev][col] as number)) / (last - prev);
                newVal = (updated[last][col] as number) + stepVal * (i - last);
              } else {
                newVal = prevVal + step * (i - prevIdx);
              }
            } else if (nextIdx !== -1) {
              const nextVal = updated[nextIdx][col] as number;
              const knownIndices = indices.filter(idx => idx > i);
              if (knownIndices.length >= 2) {
                const first = knownIndices[0];
                const second = knownIndices[1];
                const stepVal = ((updated[second][col] as number) - (updated[first][col] as number)) / (second - first);
                newVal = (updated[first][col] as number) - stepVal * (first - i);
              } else {
                newVal = nextVal - step * (nextIdx - i);
              }
            } else {
              continue;
            }
            updated[i][col] = Math.round(newVal * 100) / 100;
            recoveries.push({
              rowIndex: i,
              column: col,
              originalValue: null,
              recoveredValue: updated[i][col],
              method: "Special Column",
              groupKey: "*sequence",
              dimensions: [],
              support: 0,
              aggregation: "Sequence",
              confidence: 95,
              reasoning: `Numeric sequence detected → filled with interpolated value`,
              timestamp: new Date().toISOString(),
              pass: 0,
              reliability: 1,
              globalEstimate: null,
            });
          }
        }
        handled.add(col);
        continue;
      }
    }

    // --- 4. Alphanumeric sequence (prefix + incrementing number) ---
    const stringVals: string[] = [];
    const strIndices: number[] = [];
    for (let i = 0; i < updated.length; i++) {
      const v = updated[i][col];
      if (typeof v === 'string' && v.trim() !== '') {
        stringVals.push(v);
        strIndices.push(i);
      }
    }
    if (stringVals.length >= 2) {
      const firstMatch = stringVals[0].match(/^([a-zA-Z_]*)(\d+)$/);
      if (firstMatch) {
        const prefix = firstMatch[1];
        const nums = stringVals.map(s => {
          const m = s.match(/^([a-zA-Z_]*)(\d+)$/);
          return m ? parseInt(m[2], 10) : NaN;
        });
        if (nums.every(n => !isNaN(n))) {
          const sorted = [...nums].sort((a, b) => a - b);
          let isSeq = true;
          for (let j = 1; j < sorted.length; j++) {
            if (sorted[j] - sorted[j - 1] !== 1) { isSeq = false; break; }
          }
          if (isSeq) {
            const numMap = new Map<number, number>();
            for (let i = 0; i < strIndices.length; i++) {
              numMap.set(strIndices[i], nums[i]);
            }
            for (let i = 0; i < updated.length; i++) {
              if (isMissing(updated[i][col])) {
                let prevIdx = -1;
                for (let j = i - 1; j >= 0; j--) {
                  if (numMap.has(j)) { prevIdx = j; break; }
                }
                let nextIdx = -1;
                for (let j = i + 1; j < updated.length; j++) {
                  if (numMap.has(j)) { nextIdx = j; break; }
                }
                let newNum: number;
                if (prevIdx !== -1 && nextIdx !== -1) {
                  const prevNum = numMap.get(prevIdx)!;
                  const nextNum = numMap.get(nextIdx)!;
                  const gap = nextIdx - prevIdx;
                  const stepVal = (nextNum - prevNum) / gap;
                  newNum = prevNum + stepVal * (i - prevIdx);
                } else if (prevIdx !== -1) {
                  const prevNum = numMap.get(prevIdx)!;
                  const knownIndices = Array.from(numMap.keys()).filter(idx => idx < i).sort((a, b) => a - b);
                  if (knownIndices.length >= 2) {
                    const last = knownIndices[knownIndices.length - 1];
                    const prev = knownIndices[knownIndices.length - 2];
                    const stepVal = (numMap.get(last)! - numMap.get(prev)!) / (last - prev);
                    newNum = numMap.get(last)! + stepVal * (i - last);
                  } else {
                    newNum = prevNum + 1 * (i - prevIdx);
                  }
                } else if (nextIdx !== -1) {
                  const nextNum = numMap.get(nextIdx)!;
                  const knownIndices = Array.from(numMap.keys()).filter(idx => idx > i).sort((a, b) => a - b);
                  if (knownIndices.length >= 2) {
                    const first = knownIndices[0];
                    const second = knownIndices[1];
                    const stepVal = (numMap.get(second)! - numMap.get(first)!) / (second - first);
                    newNum = numMap.get(first)! - stepVal * (first - i);
                  } else {
                    newNum = nextNum - 1 * (nextIdx - i);
                  }
                } else {
                  continue;
                }
                newNum = Math.max(1, Math.round(newNum));
                updated[i][col] = prefix + newNum;
                numMap.set(i, newNum);
                recoveries.push({
                  rowIndex: i,
                  column: col,
                  originalValue: null,
                  recoveredValue: updated[i][col],
                  method: "Special Column",
                  groupKey: "*sequence",
                  dimensions: [],
                  support: 0,
                  aggregation: "Sequence",
                  confidence: 95,
                  reasoning: `Alphanumeric sequence detected → filled with "${prefix}${newNum}"`,
                  timestamp: new Date().toISOString(),
                  pass: 0,
                  reliability: 1,
                  globalEstimate: null,
                });
              }
            }
            handled.add(col);
            continue;
          }
        }
      }
    }
  }

  return { handledColumns: handled, updatedRows: updated, recoveries };
}

// ============================================================
// Exact key builder
// ============================================================
function rowDimensionsValue(row: Row, dims: string[], ranges: NumericRanges, ds: Dataset): string | null {
  const parts: string[] = [];
  for (const d of dims) {
    const v = row[d];
    if (v === null) return null;
    if (ds.profiles[d].kind === "numeric" && typeof v === "number") {
      parts.push(`${d}=${binNumeric(v, ranges[d] ?? [])}`);
    } else {
      parts.push(`${d}=${String(v)}`);
    }
  }
  return parts.join("|");
}

// ============================================================
// Build group table (with skewness)
// ============================================================
function buildGroupTable(
  ds: Dataset,
  target: string,
  dims: string[],
  ranges: NumericRanges,
  numericStatsCols: string[],
  categoricalStatsCols: string[],
  rows: Row[],
  minSupport: number,
): GroupProfileTable {
  const buckets = new Map<string, Row[]>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (isMissing(r[target])) continue;
    const k = rowDimensionsValue(r, dims, ranges, ds);
    if (k === null) continue;
    const arr = buckets.get(k) ?? [];
    arr.push(r);
    buckets.set(k, arr);
  }
  const profiles = new Map<string, GroupProfileStats>();
  for (const [k, brows] of buckets) {
    if (brows.length < minSupport) continue;
    const numeric: GroupProfileStats["numeric"] = {};
    for (const c of numericStatsCols) {
      const xs: number[] = [];
      for (const r of brows) {
        const v = r[c];
        if (typeof v === "number") xs.push(v);
      }
      if (xs.length) {
        const trimmed = iqrTrim(xs);
        numeric[c] = {
          mean: mean(trimmed),
          median: median(trimmed),
          std: std(trimmed),
          skewness: skewness(trimmed),
        };
      }
    }
    const categorical: GroupProfileStats["categorical"] = {};
    for (const c of categoricalStatsCols) {
      const vs: string[] = [];
      for (const r of brows) {
        const v = r[c];
        if (v !== null) vs.push(String(v));
      }
      const m = mode(vs);
      if (m) categorical[c] = { mode: m.value, modeFreq: m.count };
    }
    const stat: GroupProfileStats = { count: brows.length, numeric, categorical };
    const tProf = ds.profiles[target];
    let stability = 1;
    if (tProf.kind === "numeric") {
      const s = numeric[target];
      const gStd = tProf.std ?? 0;
      if (s && gStd > 0) stability = Math.max(0.1, 1 - Math.min(1, s.std / gStd));
    } else {
      const s = categorical[target];
      if (s) stability = s.modeFreq / brows.length;
    }
    const supportScore = Math.min(1, brows.length / 30);
    stat.reliability = Math.round((supportScore * 0.4 + stability * 0.6) * 100) / 100;
    profiles.set(k, stat);
  }
  return { dimensions: dims, profiles };
}

function iqrTrim(xs: number[]): number[] {
  if (xs.length < 8) return xs;
  const sorted = [...xs].sort((a, b) => a - b);
  const q = (p: number) => {
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  const trimmed = sorted.filter((x) => x >= lo && x <= hi);
  return trimmed.length >= Math.max(4, Math.floor(sorted.length * 0.5)) ? trimmed : sorted;
}

// ============================================================
// Partial matching: find best group
// ============================================================
function findBestGroup(
  row: Row,
  table: GroupProfileTable,
  ds: Dataset,
  ranges: NumericRanges,
  minSupport: number
): { group: GroupProfileStats; key: string; matchCount: number } | null {
  let best = null;
  let bestMatchCount = -1;
  for (const [key, group] of table.profiles) {
    if (group.count < minSupport) continue;
    const parts = key.split('|');
    let matchCount = 0;
    let valid = true;
    for (const part of parts) {
      const [dim, val] = part.split('=');
      const rowVal = row[dim];
      if (rowVal === null || rowVal === undefined) continue;
      let rowStr: string;
      if (ds.profiles[dim].kind === "numeric" && typeof rowVal === "number") {
        rowStr = binNumeric(rowVal, ranges[dim] ?? []);
      } else {
        rowStr = String(rowVal);
      }
      if (rowStr === val) {
        matchCount++;
      } else {
        valid = false;
        break;
      }
    }
    if (valid && matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      best = { group, key, matchCount };
    }
  }
  return best;
}

// ============================================================
// Main recovery function
// ============================================================
export interface RecoveryOptions {
  enableML?: boolean;
  excludeColumns?: string[];
  minSupport?: number;
  minConfidence?: number;
  allowGlobalFallback?: boolean;
}

export interface RecoveryResult {
  recoveries: RecoveryRecord[];
  recoveredRows: Row[];
  totalMissing: number;
  impact: ImpactReport;
  passes: number;
}

export async function runRecovery(
  ds: Dataset,
  relationships: RelationshipMap,
  ranges: NumericRanges,
  options: RecoveryOptions = {}
): Promise<RecoveryResult> {
  const {
    enableML = false,
    excludeColumns = [],
    minSupport: userMinSupport,
    minConfidence = 0,
    allowGlobalFallback = true,
  } = options;

  // 1) ML PRE‑PASS (disabled by default)
  let preImputedRows: Row[] = ds.rows.map((r) => ({ ...r }));
  let allRecoveries: RecoveryRecord[] = [];

  if (enableML) {
    const targets = ds.columns.filter((c) => ds.profiles[c].missing > 0 && !excludeColumns.includes(c));
    for (const target of targets) {
      try {
        const mlResult = await runMLImputation(
          preImputedRows,
          ds.columns,
          target,
          30,
          0.2
        );
        if (mlResult) {
          for (const rec of mlResult.recoveries) {
            preImputedRows[rec.rowIndex][target] = rec.value;
            allRecoveries.push({
              rowIndex: rec.rowIndex,
              column: target,
              originalValue: null,
              recoveredValue: rec.value,
              method: "ML Imputation",
              groupKey: "*ml",
              dimensions: [],
              support: 0,
              aggregation: "",
              confidence: Math.round(rec.confidence * 100),
              reasoning: `ML Imputation (Random Forest) with confidence ${Math.round(rec.confidence * 100)}%`,
              timestamp: new Date().toISOString(),
              pass: 0,
              reliability: rec.confidence,
              globalEstimate: null,
            });
          }
        }
      } catch (e) {
        console.warn(`ML imputation failed for ${target}`, e);
      }
    }
  }

  // 2) PRE‑IMPUTE any remaining missing features (global fill)
  for (const col of ds.columns) {
    const prof = ds.profiles[col];
    if (prof.missing === 0) continue;
    let fillVal: CellValue;
    if (prof.kind === "numeric") {
      const strategy = prof.aggStrategy ?? "Median";
      fillVal = strategy === "Mean" ? (prof.mean ?? 0) : (prof.median ?? 0);
      if (typeof fillVal === "number") fillVal = Math.round(fillVal * 100) / 100;
    } else {
      fillVal = prof.mode ?? null;
    }
    for (let i = 0; i < preImputedRows.length; i++) {
      if (isMissing(preImputedRows[i][col])) {
        preImputedRows[i][col] = fillVal;
      }
    }
  }

  // 3) SPECIAL COLUMN HANDLING
  const specialResult = handleSpecialColumns(ds, preImputedRows, allRecoveries);
  const handledColumns = specialResult.handledColumns;
  preImputedRows = specialResult.updatedRows;
  allRecoveries = specialResult.recoveries;

  // Apply special handling to final recovered rows
  const recovered = ds.rows.map((r) => ({ ...r }));
  for (const col of handledColumns) {
    for (let i = 0; i < recovered.length; i++) {
      if (isMissing(recovered[i][col])) {
        recovered[i][col] = preImputedRows[i][col];
      }
    }
  }

  // 4) BUILD TARGETS (exclude handled and user‑excluded columns)
  const totalMissing = ds.columns.reduce((sum, c) => sum + ds.profiles[c].missing, 0);
  const perColumnBefore: Record<string, number> = {};
  for (const c of ds.columns) {
    perColumnBefore[c] = ds.profiles[c].missing;
  }

  const targets = ds.columns
    .filter((c) => ds.profiles[c].missing > 0 && !handledColumns.has(c) && !excludeColumns.includes(c))
    .map((c) => {
      const rel = relationships[c];
      const relStrength = rel
        ? [...rel.categorical, ...rel.numeric].reduce((a, b) => a + b.score, 0)
        : 0;
      return { col: c, miss: ds.profiles[c].missingPct, rel: relStrength };
    })
    .sort((a, b) => a.miss - b.miss || b.rel - a.rel)
    .map((t) => t.col);

  const recoveries: RecoveryRecord[] = [...allRecoveries];
  let pass = 0;
  const MAX_PASSES = 3;

  while (pass < MAX_PASSES) {
    pass++;
    let progressed = 0;
    for (const target of targets) {
      const prof = ds.profiles[target];
      // Determine min support: user override or adaptive
      const minSupport = userMinSupport !== undefined ? userMinSupport : dynamicMinSupport(ds.rows.length, prof.missingPct);
      const stillMissing = recovered.reduce((a, r) => a + (isMissing(r[target]) ? 1 : 0), 0);
      if (!stillMissing) continue;
      const rel = relationships[target];
      const fullDims = rel ? [...rel.categorical.map((c) => c.col), ...rel.numeric.map((c) => c.col)] : [];
      if (!fullDims.length) {
        if (allowGlobalFallback) {
          const before = stillMissing;
          fillGlobal(target, recovered, recoveries, prof, ds.rows.length - prof.missing, pass);
          progressed += before;
        }
        continue;
      }
      const numericStatsCols = prof.kind === "numeric" ? [target] : [];
      const categoricalStatsCols = prof.kind === "categorical" ? [target] : [];
      const ordered = [
        ...rel.categorical.map((x) => ({ col: x.col, score: x.score })),
        ...rel.numeric.map((x) => ({ col: x.col, score: x.score })),
      ].sort((a, b) => b.score - a.score);

      // Build tables using preImputedRows
      const tables: GroupProfileTable[] = [];
      let dims = [...fullDims];
      tables.push(buildGroupTable(ds, target, dims, ranges, numericStatsCols, categoricalStatsCols, preImputedRows, minSupport));
      const dropOrder = [...ordered].reverse().map((o) => o.col);
      for (const drop of dropOrder) {
        dims = dims.filter((d) => d !== drop);
        if (!dims.length) break;
        tables.push(buildGroupTable(ds, target, dims, ranges, numericStatsCols, categoricalStatsCols, preImputedRows, minSupport));
      }

      for (let i = 0; i < recovered.length; i++) {
        const row = recovered[i];
        if (!isMissing(row[target])) continue;

        const originalRow = ds.rows[i];
        let missingFeatureCount = 0;
        for (const d of fullDims) {
          if (isMissing(originalRow[d])) missingFeatureCount++;
        }
        const missingFeatureRatio = fullDims.length > 0 ? missingFeatureCount / fullDims.length : 0;
        const preImputePenalty = 1 - missingFeatureRatio * 0.5;

        let resolved = false;
        for (let t = 0; t < tables.length && !resolved; t++) {
          const tbl = tables[t];
          const preRow = preImputedRows[i];
          // Exact match
          const exactKey = rowDimensionsValue(preRow, tbl.dimensions, ranges, ds);
          if (exactKey !== null) {
            const g = tbl.profiles.get(exactKey);
            if (g) {
              const method = t === 0 ? "Exact Group Match" : "Reduced Group Match";
              applyRecovery(
                target, prof, g, tbl.dimensions, exactKey,
                row, i, recoveries, method, pass, t,
                preImputePenalty, 1.0,
                minConfidence
              );
              resolved = true;
              progressed++;
              continue;
            }
          }

          // Partial match
          const partialMatch = findBestGroup(preRow, tbl, ds, ranges, minSupport);
          if (partialMatch) {
            const method = t === 0 ? "Partial Group Match" : "Reduced Partial Match";
            const dimScoreFactor = partialMatch.matchCount / Math.max(1, partialMatch.key.split('|').length);
            applyRecovery(
              target, prof, partialMatch.group, tbl.dimensions, partialMatch.key,
              row, i, recoveries, method, pass, t,
              preImputePenalty, dimScoreFactor,
              minConfidence
            );
            resolved = true;
            progressed++;
            continue;
          }
        }
        // If not resolved, it will be caught by global fallback later (if allowed)
      }
    }
    if (!progressed) break;
  }

  // Final pass: global fallback for remaining targets (if allowed)
  if (allowGlobalFallback) {
    for (const target of targets) {
      const prof = ds.profiles[target];
      for (let i = 0; i < recovered.length; i++) {
        if (!isMissing(recovered[i][target])) continue;
        fillGlobalForRow(target, recovered[i], i, recoveries, prof, ds.rows.length - prof.missing, pass + 1);
      }
    }
  } else {
    // If global fallback is disabled, we still need to record skipped cells
    for (const target of targets) {
      const prof = ds.profiles[target];
      for (let i = 0; i < recovered.length; i++) {
        if (!isMissing(recovered[i][target])) continue;
        // Record a skipped entry (no value filled)
        recoveries.push({
          rowIndex: i,
          column: target,
          originalValue: null,
          recoveredValue: null,
          method: "Skipped (low confidence)",
          groupKey: "*",
          dimensions: [],
          support: 0,
          aggregation: "",
          confidence: 0,
          reasoning: `Skipped – global fallback disabled and no group found.`,
          timestamp: new Date().toISOString(),
          pass: pass + 1,
          reliability: 0,
          globalEstimate: null,
        });
      }
    }
  }

  // Impact report
  const totalCells = ds.rows.length * ds.columns.length;
  const beforeFilled = totalCells - totalMissing;
  let afterMissing = 0;
  const perColumn: ImpactReport["perColumn"] = [];
  for (const c of ds.columns) {
    const after = recovered.reduce((a, r) => a + (isMissing(r[c]) ? 1 : 0), 0);
    afterMissing += after;
    perColumn.push({
      column: c,
      missingBefore: perColumnBefore[c],
      missingAfter: after,
      recovered: perColumnBefore[c] - after,
    });
  }
  const impact: ImpactReport = {
    beforeCompletenessPct: totalCells ? (beforeFilled / totalCells) * 100 : 100,
    afterCompletenessPct: totalCells ? ((totalCells - afterMissing) / totalCells) * 100 : 100,
    perColumn,
  };

  return { recoveries, recoveredRows: recovered, totalMissing, impact, passes: pass };
}

// ============================================================
// Apply recovery with group‑specific aggregation and penalties
// ============================================================
function applyRecovery(
  target: string,
  prof: { kind: string; aggStrategy?: "Mean" | "Median"; std?: number; mean?: number; median?: number; mode?: string; skewness?: number },
  g: GroupProfileStats,
  dims: string[],
  key: string,
  row: Row,
  rowIndex: number,
  out: RecoveryRecord[],
  method: RecoveryRecord["method"],
  pass: number,
  fallbackDepth: number,
  preImputePenalty: number,
  dimScoreFactor: number,
  minConfidence: number,
): void {
  let value: CellValue = null;
  let agg = "";
  let globalEst: CellValue = null;

  if (prof.kind === "numeric") {
    const s = g.numeric[target];
    if (!s) return;
    const groupSkew = s.skewness ?? 0;
    const groupSize = g.count;
    const useMedian = (groupSize >= 10 && Math.abs(groupSkew) > 1) || prof.aggStrategy === "Median";
    agg = useMedian ? "Median" : "Mean";
    value = useMedian ? round(s.median) : round(s.mean);
    globalEst = round(prof.aggStrategy === "Mean" ? (prof.mean ?? 0) : (prof.median ?? 0));
  } else {
    const s = g.categorical[target];
    if (!s) return;
    agg = "Mode";
    value = s.mode;
    globalEst = prof.mode ?? null;
  }

  const supportScore = Math.min(1, g.count / 30);
  const stabilityScore = (() => {
    if (prof.kind === "numeric") {
      const s = g.numeric[target];
      const globalStd = prof.std ?? 0;
      if (globalStd > 0 && s) {
        const cvRatio = Math.min(1.5, s.std / globalStd);
        return Math.max(0.1, 1 - cvRatio * 0.6);
      }
      return 1;
    } else {
      const s = g.categorical[target];
      if (s) return Math.min(1, s.modeFreq / g.count);
      return 1;
    }
  })();

  let varianceScore = (() => {
    if (prof.kind === "numeric") {
      const s = g.numeric[target];
      const globalStd = prof.std ?? 0;
      if (globalStd > 0 && s) {
        const cvRatio = Math.min(1.5, s.std / globalStd);
        return Math.max(0.1, 1 - cvRatio * 0.4);
      }
      return 1;
    } else {
      return stabilityScore;
    }
  })();

  if (prof.kind === "numeric" && Math.abs(prof.skewness ?? 0) > 1.5) varianceScore *= 0.85;

  const depthPenalty = Math.max(0.5, 1 - fallbackDepth * 0.08);
  const raw =
    supportScore * 0.3 +
    dimScoreFactor * 0.2 +
    stabilityScore * 0.25 +
    varianceScore * 0.25;
  let confidence = Math.max(5, Math.min(99, Math.round(raw * depthPenalty * preImputePenalty * 100)));

  // Apply min confidence filter
  if (confidence < minConfidence) {
    // Skip – record as skipped
    out.push({
      rowIndex,
      column: target,
      originalValue: null,
      recoveredValue: null,
      method: "Skipped (low confidence)",
      groupKey: key,
      dimensions: dims,
      support: g.count,
      aggregation: agg,
      confidence: confidence,
      reasoning: `Skipped – confidence ${confidence}% below threshold ${minConfidence}%.`,
      timestamp: new Date().toISOString(),
      pass,
      reliability: g.reliability,
      globalEstimate: globalEst,
    });
    return;
  }

  row[target] = value;
  out.push({
    rowIndex,
    column: target,
    originalValue: null,
    recoveredValue: value,
    method,
    groupKey: key,
    dimensions: dims,
    support: g.count,
    aggregation: agg,
    confidence,
    reasoning: `Pass ${pass} · ${method} using ${dims.join(" + ") || "n/a"} → ${agg} of ${g.count} similar records (reliability ${(g.reliability ?? 0).toFixed(2)}). Pre‑impute penalty: ${Math.round((1 - preImputePenalty) * 100)}%`,
    timestamp: new Date().toISOString(),
    pass,
    reliability: g.reliability,
    globalEstimate: globalEst,
  });
}

// ============================================================
// Helpers
// ============================================================
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function fillGlobal(
  target: string,
  recovered: Row[],
  out: RecoveryRecord[],
  prof: { kind: string; aggStrategy?: "Mean" | "Median"; mean?: number; median?: number; mode?: string },
  support: number,
  pass: number,
): void {
  for (let i = 0; i < recovered.length; i++) {
    if (!isMissing(recovered[i][target])) continue;
    fillGlobalForRow(target, recovered[i], i, out, prof, support, pass);
  }
}

function fillGlobalForRow(
  target: string,
  row: Row,
  rowIndex: number,
  out: RecoveryRecord[],
  prof: { kind: string; aggStrategy?: "Mean" | "Median"; mean?: number; median?: number; mode?: string },
  support: number,
  pass: number,
): void {
  let value: CellValue = null;
  let agg = "";
  if (prof.kind === "numeric") {
    agg = prof.aggStrategy ?? "Median";
    value = round(agg === "Mean" ? (prof.mean ?? 0) : (prof.median ?? 0));
  } else {
    agg = "Mode";
    value = prof.mode ?? null;
  }
  row[target] = value;
  out.push({
    rowIndex,
    column: target,
    originalValue: null,
    recoveredValue: value,
    method: "Global Fallback",
    groupKey: "*",
    dimensions: [],
    support,
    aggregation: agg,
    confidence: 35,
    reasoning: `Pass ${pass} · no reliable group found. Used global column ${agg}.`,
    timestamp: new Date().toISOString(),
    pass,
    globalEstimate: value,
  });
}