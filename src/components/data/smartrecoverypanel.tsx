import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Layers, Activity, AlertCircle, CheckCircle2, Download,
  ChevronDown, ChevronUp, Sparkles, Settings
} from "lucide-react";
import { toast } from "sonner";
import { useTransformationHistory } from "@/lib/TransformationHistory";

// Nexus imports
import { profileDataset } from "@/lib/nexus/profile";
import { buildRelationships, buildNumericRanges } from "@/lib/nexus/relationships";
import { runRecovery } from "@/lib/nexus/recover";
import { exportAuditCSV } from "@/lib/nexus/exporter";
import type { CellValue, Row, Dataset, RelationshipMap } from "@/lib/nexus/types";

// Shadcn UI components
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

// --- Normalization from parser.ts ---
function normalizeValue(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "" || /^(na|n\/a|null|none|nan|-)$/i.test(t)) return null;
    const n = Number(t);
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(t)) return n;
    return t;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return String(v);
}

function ConfidencePill({ v }: { v: number }) {
  const cls =
    v >= 80 ? "bg-accent/15 text-accent ring-accent/30"
    : v >= 55 ? "bg-primary/15 text-primary ring-primary/30"
    : "bg-destructive/15 text-destructive ring-destructive/30";
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ring-1 ${cls}`}>{v}%</span>;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "primary" | "accent" }) {
  const color = accent === "primary" ? "text-primary" : accent === "accent" ? "text-accent" : "text-foreground";
  return (
    <Card className="border-border/60 bg-card/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-2xl ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export default function SmartRecoveryPanel({ data, columns, setData, setColumns }) {
  const { addEntry } = useTransformationHistory();
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [relationships, setRelationships] = useState<RelationshipMap | null>(null);
  const [showAudit, setShowAudit] = useState(true);

  // Advanced options
  const [excludeColumns, setExcludeColumns] = useState<string[]>([]);
  const [minSupport, setMinSupport] = useState<number | undefined>(undefined);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [allowGlobalFallback, setAllowGlobalFallback] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Normalize data
  const normalizedData = useMemo(() => {
    return data.map(row => {
      const newRow: Row = {};
      columns.forEach(col => {
        newRow[col] = normalizeValue(row[col]);
      });
      return newRow;
    });
  }, [data, columns]);

  // Missing stats
  const missingStats = useMemo(() => {
    let totalCells = data.length * columns.length;
    let missingCells = 0;
    normalizedData.forEach(row => {
      columns.forEach(col => {
        if (row[col] === null || row[col] === undefined) missingCells++;
      });
    });
    return { totalCells, missingCells, missingPct: totalCells ? (missingCells / totalCells) * 100 : 0 };
  }, [normalizedData, columns]);

  const hasMissing = missingStats.missingCells > 0;

  const runRecoveryPipeline = useCallback(async () => {
    if (!hasMissing) {
      toast.info("No missing values to recover!");
      return;
    }
    setStage("running");
    setError(null);
    setResult(null);
    setDataset(null);
    setRelationships(null);
    try {
      setProgress("Profiling columns…");
      await new Promise(r => setTimeout(r, 50));

      const ds = profileDataset(columns, normalizedData);
      setDataset(ds);

      setProgress("Discovering relationships…");
      await new Promise(r => setTimeout(r, 50));
      const rel = buildRelationships(ds);
      setRelationships(rel);

      setProgress("Building numeric ranges…");
      await new Promise(r => setTimeout(r, 50));
      const ranges = buildNumericRanges(ds, rel);

      setProgress("Running context-aware recovery…");
      await new Promise(r => setTimeout(r, 50));
      const recoveryResult = await runRecovery(ds, rel, ranges, {
        enableML: false,
        excludeColumns,
        minSupport,
        minConfidence,
        allowGlobalFallback,
      });

      setResult(recoveryResult);
      setStage("done");
      setProgress("");
      toast.success(`Recovered ${recoveryResult.recoveries.length} missing values`);
    } catch (err) {
      setError(err.message || "Recovery failed");
      setStage("idle");
    }
  }, [normalizedData, columns, hasMissing, excludeColumns, minSupport, minConfidence, allowGlobalFallback]);

  const applyRecovery = useCallback(() => {
    if (!result) return;
    const snapshot = data.map(r => ({ ...r }));
    const snapshotCols = [...columns];

    const finalRows = result.recoveredRows.map(row => {
      const newRow = {};
      columns.forEach(col => {
        const val = row[col];
        newRow[col] = (val === null || val === undefined) ? "" : val;
      });
      return newRow;
    });

    setData(finalRows);

    addEntry({
      source: "clean",
      description: `Nexus Smart Recovery — ${result.recoveries.length} missing cells filled`,
      detail: `Context-aware imputation · ${result.passes} passes · ${result.impact.afterCompletenessPct.toFixed(1)}% completeness`,
      rowsAffected: result.recoveries.length,
      snapshot: { data: snapshot, columns: snapshotCols },
    });

    toast.success(`Applied recovery: ${result.recoveries.length} cells filled`);
    setStage("idle");
    setResult(null);
    setDataset(null);
    setRelationships(null);
  }, [result, data, columns, setData, addEntry]);

  const reset = () => {
    setStage("idle");
    setResult(null);
    setDataset(null);
    setRelationships(null);
    setError(null);
    setProgress("");
  };

  const stats = useMemo(() => {
    if (!result) return null;
    let high = 0, med = 0, low = 0;
    const methods: Record<string, number> = {};
    let context = 0, global = 0;
    for (const r of result.recoveries) {
      if (r.confidence >= 80) high++;
      else if (r.confidence >= 55) med++;
      else low++;
      methods[r.method] = (methods[r.method] ?? 0) + 1;
      if (r.method === "Global Fallback") global++; else context++;
    }
    return { recovered: result.recoveries.length, high, med, low, methods, context, global };
  }, [result]);

  // Per‑column method breakdown
  const columnMethodStats = useMemo(() => {
    if (!result) return {};
    const stats: Record<string, { _total: number; [method: string]: number }> = {};
    for (const r of result.recoveries) {
      const col = r.column;
      if (!stats[col]) stats[col] = { _total: 0 };
      stats[col]._total++;
      stats[col][r.method] = (stats[col][r.method] ?? 0) + 1;
    }
    const out: Record<string, Record<string, number>> = {};
    for (const [col, data] of Object.entries(stats)) {
      out[col] = { _total: data._total };
      for (const [method, count] of Object.entries(data)) {
        if (method === '_total') continue;
        out[col][method] = (count / data._total) * 100;
      }
    }
    return out;
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Smart Recovery Engine
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {missingStats.missingCells} missing cells ({missingStats.missingPct.toFixed(1)}%)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Context‑aware missing‑value recovery using automatic group profiling. Every imputation is auditable.
          </p>
        </CardHeader>
        <CardContent>
          {stage === "idle" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm">
                  {hasMissing
                    ? `Found ${missingStats.missingCells} missing values across ${columns.filter(c => normalizedData.some(r => r[c] === null)).length} columns.`
                    : "Your dataset is already complete — no missing values to recover."}
                </p>

                {/* Advanced Options */}
                <div className="mt-4 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Advanced Options {showAdvanced ? '▲' : '▼'}
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 space-y-3 bg-muted/20 p-3 rounded-lg">
                      {/* Exclude columns */}
                      <div>
                        <Label className="text-xs">Exclude columns (skip imputation)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start text-xs font-normal h-8">
                              {excludeColumns.length === 0
                                ? 'No columns excluded'
                                : `${excludeColumns.length} column(s) excluded`}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2 max-h-60 overflow-auto">
                            <div className="space-y-1">
                              {columns.map(col => (
                                <label key={col} className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={excludeColumns.includes(col)}
                                    onChange={() => {
                                      setExcludeColumns(prev =>
                                        prev.includes(col)
                                          ? prev.filter(c => c !== col)
                                          : [...prev, col]
                                      );
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  {col}
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Selected columns will be left unchanged.
                        </p>
                      </div>

                      {/* Minimum support */}
                      <div>
                        <Label className="text-xs">Minimum support (group size)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            className="h-8 w-24 text-xs"
                            placeholder="Auto"
                            value={minSupport ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : undefined;
                              setMinSupport(val);
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            Leave empty for automatic (adaptive)
                          </span>
                        </div>
                      </div>

                      {/* Minimum confidence */}
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Minimum confidence</Label>
                          <span className="text-xs font-mono">{minConfidence}%</span>
                        </div>
                        <Slider
                          value={[minConfidence]}
                          onValueChange={([v]) => setMinConfidence(v)}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Only apply imputations with confidence ≥ this value.
                        </p>
                      </div>

                      {/* Allow global fallback */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="allowGlobalFallback"
                          checked={allowGlobalFallback}
                          onChange={(e) => setAllowGlobalFallback(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="allowGlobalFallback" className="text-xs cursor-pointer">
                          Allow global fallback (fill remaining with mean/mode)
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={runRecoveryPipeline} disabled={!hasMissing || stage === "running"}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Run Smart Recovery
              </Button>
            </div>
          )}
          {stage === "running" && (
            <div className="flex items-center gap-3 text-sm">
              <Activity className="w-4 h-4 animate-spin text-accent" />
              <span>{progress}</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && stats && stage === "done" && (
        <div className="space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Missing values" value={result.totalMissing.toLocaleString()} accent="primary" />
            <StatCard label="Recovered" value={stats.recovered.toLocaleString()} sub={`${result.passes} passes`} accent="accent" />
            <StatCard label="High confidence" value={stats.high.toLocaleString()} sub="≥ 80%" />
            <StatCard label="Medium confidence" value={stats.med.toLocaleString()} sub="55–79%" />
          </div>

          {/* Method breakdown + Context vs global + Completeness impact */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Method breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Recovery Methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(["Exact Group Match", "Partial Group Match", "Reduced Group Match", "Reduced Partial Match", "Global Fallback", "ML Imputation", "Special Column"] as const).map((m) => {
                  const c = stats.methods[m] ?? 0;
                  const pct = stats.recovered ? (c / stats.recovered) * 100 : 0;
                  return (
                    <div key={m}>
                      <div className="flex justify-between text-xs">
                        <span>{m}</span>
                        <span className="text-muted-foreground">{c} · {pct.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-border/40">
                        <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Context vs global */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Context vs Global</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recovered > 0 ? (
                  <>
                    <div className="grid place-items-center">
                      <div className="font-mono text-4xl text-accent">
                        {((stats.context / stats.recovered) * 100).toFixed(0)}%
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">context‑aware recovery</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-center font-mono text-xs">
                      <div className="rounded border border-border/60 p-2">
                        <div className="text-accent">{stats.context}</div>
                        <div className="text-[10px] text-muted-foreground">contextual</div>
                      </div>
                      <div className="rounded border border-border/60 p-2">
                        <div className="text-primary">{stats.global}</div>
                        <div className="text-[10px] text-muted-foreground">global fallback</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No recoveries to show.</p>
                )}
              </CardContent>
            </Card>

            {/* Completeness impact */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Completeness Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="rounded border border-border/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Before</p>
                    <p className="mt-1 text-2xl text-primary">{result.impact.beforeCompletenessPct.toFixed(1)}%</p>
                  </div>
                  <div className="rounded border border-border/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">After</p>
                    <p className="mt-1 text-2xl text-accent">{result.impact.afterCompletenessPct.toFixed(1)}%</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  +{(result.impact.afterCompletenessPct - result.impact.beforeCompletenessPct).toFixed(2)} pts gained.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Confidence Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Confidence Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "High (≥80%)", min: 80 },
                  { label: "Medium (55–79%)", min: 55, max: 79 },
                  { label: "Low (<55%)", max: 54 },
                ].map(({ label, min, max }) => {
                  const count = result.recoveries.filter(r => {
                    if (min !== undefined && r.confidence < min) return false;
                    if (max !== undefined && r.confidence > max) return false;
                    return true;
                  }).length;
                  const pct = result.recoveries.length ? (count / result.recoveries.length) * 100 : 0;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs w-28">{label}</span>
                      <div className="flex-1 h-2 rounded bg-border/40 overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Per-column impact */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Per‑column Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ScrollArea className="h-full">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                      <tr>
                        <th className="py-1 text-left pr-4">Column</th>
                        <th className="py-1 text-left pr-4">Before</th>
                        <th className="py-1 text-left pr-4">After</th>
                        <th className="py-1 text-left pr-4">Recovered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.impact.perColumn.filter(p => p.recovered > 0).map(p => (
                        <tr key={p.column} className="border-t border-border/40">
                          <td className="py-1 text-primary">{p.column}</td>
                          <td className="py-1">{p.missingBefore}</td>
                          <td className="py-1">{p.missingAfter}</td>
                          <td className="py-1 text-accent">{p.recovered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* Per-column method breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Per‑column Recovery Method Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">How missing values in each column were recovered.</p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ScrollArea className="h-full">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                      <tr>
                        <th className="py-1 text-left pr-4">Column</th>
                        <th className="py-1 text-left pr-4">Recovered</th>
                        <th className="py-1 text-left pr-4">Exact</th>
                        <th className="py-1 text-left pr-4">Partial</th>
                        <th className="py-1 text-left pr-4">Reduced</th>
                        <th className="py-1 text-left pr-4">Reduced Partial</th>
                        <th className="py-1 text-left pr-4">Global</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(columnMethodStats).map(([col, stats]) => (
                        <tr key={col} className="border-t border-border/40">
                          <td className="py-1 text-primary">{col}</td>
                          <td className="py-1">{stats._total}</td>
                          <td className="py-1">{stats["Exact Group Match"]?.toFixed(1) ?? 0}%</td>
                          <td className="py-1">{stats["Partial Group Match"]?.toFixed(1) ?? 0}%</td>
                          <td className="py-1">{stats["Reduced Group Match"]?.toFixed(1) ?? 0}%</td>
                          <td className="py-1">{stats["Reduced Partial Match"]?.toFixed(1) ?? 0}%</td>
                          <td className="py-1">{stats["Global Fallback"]?.toFixed(1) ?? 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* Column profile */}
          {dataset && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Column Profile</CardTitle>
                <p className="text-xs text-muted-foreground">Type, missingness, and chosen aggregation per column.</p>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ScrollArea className="h-full">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                        <tr>
                          <th className="py-2 pr-2 text-left">Column</th>
                          <th className="py-2 pr-2 text-left">Type</th>
                          <th className="py-2 pr-2 text-left">Missing</th>
                          <th className="py-2 pr-2 text-left">Agg / Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.columns.map(c => {
                          const p = dataset.profiles[c];
                          return (
                            <tr key={c} className="border-t border-border/40">
                              <td className="py-1.5 pr-2">{c}</td>
                              <td className="py-1.5 pr-2">
                                <Badge variant="secondary" className="font-mono text-[10px]">{p.kind}</Badge>
                              </td>
                              <td className="py-1.5 pr-2">{p.missing} <span className="text-muted-foreground">({(p.missingPct * 100).toFixed(1)}%)</span></td>
                              <td className="py-1.5 pr-2">{p.kind === "numeric" ? p.aggStrategy : p.mode ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Discovered relationships */}
          {relationships && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Discovered Relationships</CardTitle>
                <p className="text-xs text-muted-foreground">Features used to recover each target column.</p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 font-mono text-xs pr-4">
                      {Object.entries(relationships).map(([target, rel]) => (
                        <div key={target} className="rounded-md border border-border/60 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-primary">{target}</span>
                            <span className="text-[10px] text-muted-foreground">{dataset?.profiles[target]?.missing ?? 0} missing</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[...rel.categorical, ...rel.numeric].map((f) => (
                              <Badge key={f.col} variant="secondary" className="font-mono text-[10px]">
                                {f.col} · {f.score.toFixed(2)}
                              </Badge>
                            ))}
                            {!rel.categorical.length && !rel.numeric.length && (
                              <span className="text-muted-foreground">No strong features — using global fallback.</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {!Object.keys(relationships).length && (
                        <p className="text-muted-foreground">No missing values to recover. Your dataset is clean.</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recovery audit log */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Recovery Audit Log</CardTitle>
                  <p className="text-xs text-muted-foreground">Every recovered cell — full reasoning available.</p>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">{result.recoveries.length} entries</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <Button variant="outline" size="sm" onClick={() => exportAuditCSV(result.recoveries)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
                <button
                  onClick={() => setShowAudit(v => !v)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              {showAudit && (
                <div className="h-[28rem]">
                  <ScrollArea className="h-full">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card/80 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="py-2 pr-2 text-left">Row</th>
                            <th className="py-2 pr-2 text-left">Column</th>
                            <th className="py-2 pr-2 text-left">Recovered</th>
                            <th className="py-2 pr-2 text-left">Method</th>
                            <th className="py-2 pr-2 text-left">Agg</th>
                            <th className="py-2 pr-2 text-left">Support</th>
                            <th className="py-2 pr-2 text-left">Conf.</th>
                            <th className="py-2 pr-2 text-left">Group</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {result.recoveries.slice(0, 500).map((r, i) => (
                            <tr key={i} className="border-t border-border/40 align-top">
                              <td className="py-1.5 pr-2 text-muted-foreground">{r.rowIndex + 1}</td>
                              <td className="py-1.5 pr-2 text-primary">{r.column}</td>
                              <td className="py-1.5 pr-2">{String(r.recoveredValue ?? "—")}</td>
                              <td className="py-1.5 pr-2 text-[11px]">{r.method}</td>
                              <td className="py-1.5 pr-2 text-[11px]">{r.aggregation}</td>
                              <td className="py-1.5 pr-2">{r.support}</td>
                              <td className="py-1.5 pr-2"><ConfidencePill v={r.confidence} /></td>
                              <td className="py-1.5 pr-2 max-w-[24rem] truncate text-[11px] text-muted-foreground" title={r.groupKey}>{r.groupKey || "—"}</td>
                            </tr>
                          ))}
                          {result.recoveries.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                                <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-accent" />
                                No missing values were recovered — dataset already complete.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {result.recoveries.length > 500 && (
                        <p className="py-3 text-center text-[11px] text-muted-foreground">
                          Showing first 500 of {result.recoveries.length} entries — download full audit CSV above.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={applyRecovery} size="default">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Apply Recovery
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              Discard & Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}