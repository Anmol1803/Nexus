import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Hash, Type, Calendar } from "lucide-react";

const COLORS = ["#6366f1","#06b6d4","#f59e0b","#ec4899","#22c55e","#8b5cf6","#f97316","#14b8a6"];

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function computeSkewness(nums, mean, std) {
  if (std === 0 || nums.length < 3) return 0;
  const n = nums.length;
  const sum = nums.reduce((acc, x) => acc + ((x - mean) / std) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

function computeKurtosis(nums, mean, std) {
  if (std === 0 || nums.length < 4) return 0;
  const n = nums.length;
  const sum = nums.reduce((acc, x) => acc + ((x - mean) / std) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

export default function ColumnEDAPreview({ col, values }) {
  const missing = values.filter(v => v === "" || v === null || v === undefined).length;
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  const missingPct = values.length > 0 ? ((missing / values.length) * 100).toFixed(1) : "0";
  const unique = new Set(nonEmpty.map(String)).size;

  const isNumeric = useMemo(() => {
    if (nonEmpty.length === 0) return false;
    return nonEmpty.filter(v => !isNaN(Number(v))).length / nonEmpty.length > 0.8;
  }, [nonEmpty]);

  const isDate = useMemo(() => {
    if (nonEmpty.length === 0 || isNumeric) return false;
    return nonEmpty.filter(v => !isNaN(Date.parse(v))).length / nonEmpty.length > 0.6;
  }, [nonEmpty, isNumeric]);

  const numStats = useMemo(() => {
    if (!isNumeric) return null;
    const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    nums.sort((a, b) => a - b);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const variance = nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / nums.length;
    const std = Math.sqrt(variance);
    const q1 = quantile(nums, 0.25);
    const q2 = quantile(nums, 0.5);
    const q3 = quantile(nums, 0.75);
    const iqr = q3 - q1;
    const outlierCount = nums.filter(n => n < q1 - 1.5 * iqr || n > q3 + 1.5 * iqr).length;
    const countMap = {};
    nums.forEach(n => { countMap[n] = (countMap[n] || 0) + 1; });
    const mode = Number(Object.entries(countMap).sort((a, b) => b[1] - a[1])[0]?.[0]);
    return {
      count: nums.length, mean, std, variance, min: nums[0], max: nums[nums.length - 1],
      q1, q2, q3, iqr, median: q2, mode,
      range: nums[nums.length - 1] - nums[0],
      skewness: computeSkewness(nums, mean, std),
      kurtosis: computeKurtosis(nums, mean, std),
      outlierCount,
    };
  }, [isNumeric, nonEmpty]);

  const histData = useMemo(() => {
    if (!numStats) return null;
    const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
    const bins = 10;
    const range = numStats.max - numStats.min;
    const binWidth = range === 0 ? 1 : range / bins;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      label: (numStats.min + i * binWidth).toFixed(1), count: 0
    }));
    nums.forEach(n => {
      let idx = range === 0 ? 0 : Math.floor((n - numStats.min) / binWidth);
      if (idx < 0) idx = 0;
      if (idx >= bins) idx = bins - 1;
      buckets[idx].count++;
    });
    return buckets;
  }, [numStats, nonEmpty]);

  const catStats = useMemo(() => {
    if (isNumeric) return null;
    const counts = {};
    nonEmpty.forEach(v => { const k = String(v); counts[k] = (counts[k] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { top: sorted.slice(0, 8), total: nonEmpty.length };
  }, [isNumeric, nonEmpty]);

  const typeLabel = isNumeric ? "Numeric" : isDate ? "Date" : "Categorical";
  const TypeIcon = isNumeric ? Hash : isDate ? Calendar : Type;

  if (nonEmpty.length === 0 && missing === 0) return null;

  return (
    <div className="mt-3 border border-border rounded-xl bg-muted/30 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeIcon className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">{col} — Column Preview</span>
        </div>
        <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {[
          { label: "Total", val: values.length },
          { label: "Missing", val: `${missing} (${missingPct}%)` },
          { label: "Unique", val: unique },
          ...(numStats ? [
            { label: "Mean", val: numStats.mean.toFixed(2) },
            { label: "Median", val: numStats.median.toFixed(2) },
            { label: "Std Dev", val: numStats.std.toFixed(2) },
          ] : [
            { label: "Top Value", val: catStats?.top[0]?.[0]?.slice(0, 10) || "—" },
            { label: "Top Count", val: catStats?.top[0]?.[1] || "—" },
            { label: "Cardinality", val: unique },
          ])
        ].map(s => (
          <div key={s.label} className="bg-background rounded-md px-2 py-1.5 text-center border border-border">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className="text-xs font-semibold font-mono text-foreground truncate">{s.val}</p>
          </div>
        ))}
      </div>

      {numStats && (
        <>
          {/* Extended numeric stats */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Min", val: numStats.min.toFixed(2) },
              { label: "Q1", val: numStats.q1.toFixed(2) },
              { label: "Q3", val: numStats.q3.toFixed(2) },
              { label: "Max", val: numStats.max.toFixed(2) },
              { label: "IQR", val: numStats.iqr.toFixed(2) },
              { label: "Range", val: numStats.range.toFixed(2) },
              { label: "Variance", val: numStats.variance.toFixed(2) },
              { label: "Mode", val: numStats.mode?.toFixed(2) ?? "—" },
            ].map(s => (
              <div key={s.label} className="bg-background rounded-md px-2 py-1 text-center border border-border">
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
                <p className="text-xs font-mono font-semibold">{s.val}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Skewness", val: numStats.skewness.toFixed(3), warn: Math.abs(numStats.skewness) > 1 },
              { label: "Kurtosis", val: numStats.kurtosis.toFixed(3), warn: Math.abs(numStats.kurtosis) > 2 },
              { label: "Outliers (IQR)", val: numStats.outlierCount, warn: numStats.outlierCount > 0 },
            ].map(s => (
              <div key={s.label} className={`rounded-md px-2 py-1 text-center border ${s.warn ? "bg-orange-50 border-orange-200" : "bg-background border-border"}`}>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
                <p className={`text-xs font-mono font-semibold ${s.warn ? "text-orange-700" : ""}`}>{s.val}</p>
              </div>
            ))}
          </div>
          {histData && (
            <div className="h-24">
              <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wide">Distribution</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 8 }} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Insights */}
          <div className="space-y-1">
            {Math.abs(numStats.skewness) > 1 && (
              <div className="flex items-center gap-1.5 text-[10px] text-orange-700 bg-orange-50 rounded px-2 py-1">
                <TrendingUp className="w-3 h-3" />
                {numStats.skewness > 0 ? "Right-skewed" : "Left-skewed"} distribution detected (skew: {numStats.skewness.toFixed(2)}) — consider Median fill
              </div>
            )}
            {numStats.outlierCount > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-orange-700 bg-orange-50 rounded px-2 py-1">
                <AlertTriangle className="w-3 h-3" />
                {numStats.outlierCount} potential outlier{numStats.outlierCount > 1 ? "s" : ""} detected (IQR method)
              </div>
            )}
            {missing / values.length > 0.2 && (
              <div className="flex items-center gap-1.5 text-[10px] text-red-700 bg-red-50 rounded px-2 py-1">
                <AlertTriangle className="w-3 h-3" />
                High missing rate ({missingPct}%) — consider dropping or imputing carefully
              </div>
            )}
          </div>
        </>
      )}

      {catStats && (
        <>
          <div className="h-24">
            <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wide">Value Distribution</p>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catStats.top.map(([name, value]) => ({ name, value }))} cx="50%" cy="50%"
                  innerRadius={18} outerRadius={42} paddingAngle={2} dataKey="value">
                  {catStats.top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-1">
            {catStats.top.slice(0, 5).map(([name, count]) => (
              <Badge key={name} variant="outline" className="text-[9px] font-mono">
                {name.slice(0, 12)}: {count}
              </Badge>
            ))}
          </div>
          {unique > 50 && (
            <div className="flex items-center gap-1.5 text-[10px] text-orange-700 bg-orange-50 rounded px-2 py-1">
              <TrendingDown className="w-3 h-3" />
              High cardinality ({unique} unique values) — may not be suitable for grouping
            </div>
          )}
        </>
      )}
    </div>
  );
}