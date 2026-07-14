import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Hash, Type, AlertTriangle, BarChart3, TrendingUp, Percent,
  Calendar, Lightbulb, ChevronDown, ChevronRight, Download,
  Activity, Copy, Grid3X3, Settings
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { pearson, cramersV, correlationRatio } from "@/lib/nexus/stats";
import { normalizeValue } from "@/lib/nexus/parser";

const CHART_COLORS = [
  "hsl(245, 58%, 51%)", "hsl(180, 55%, 45%)", "hsl(30, 80%, 55%)",
  "hsl(330, 65%, 55%)", "hsl(145, 55%, 42%)", "hsl(200, 60%, 50%)",
  "hsl(60, 70%, 45%)", "hsl(280, 50%, 55%)"
];

// ---------- Helpers (unchanged) ----------
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function entropy(counts, total) {
  return -Object.values(counts).reduce((acc, c) => {
    const p = c / total;
    return acc + (p > 0 ? p * Math.log2(p) : 0);
  }, 0);
}

function inferColType(values) {
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "empty";
  const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  if (numCount / nonEmpty.length > 0.8) return "numeric";
  const dateCount = nonEmpty.filter(v => !isNaN(Date.parse(v))).length;
  if (dateCount / nonEmpty.length > 0.6) return "date";
  return "categorical";
}

function getNumericStats(values) {
  const nums = values.filter(v => v !== "" && v !== null && v !== undefined).map(Number).filter(n => !isNaN(n));
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
  const skew = std === 0 ? 0 : (() => {
    const n = nums.length;
    const s = nums.reduce((acc, x) => acc + ((x - mean) / std) ** 3, 0);
    return (n / ((n - 1) * (n - 2))) * s;
  })();
  const countMap = {};
  nums.forEach(n => { countMap[n] = (countMap[n] || 0) + 1; });
  const mode = Number(Object.entries(countMap).sort((a, b) => b[1] - a[1])[0]?.[0]);
  return {
    count: nums.length, mean, std, variance, min: nums[0], max: nums[nums.length - 1],
    q1, q2, median: q2, q3, iqr, range: nums[nums.length - 1] - nums[0],
    mode, skew, outlierCount
  };
}

function getCategoricalStats(values) {
  const counts = {};
  values.forEach(v => {
    const key = v === "" || v === null || v === undefined ? "(empty)" : String(v);
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = values.length;
  const entropyVal = entropy(counts, total);
  return { unique: Object.keys(counts).length - (counts["(empty)"] ? 1 : 0), top: sorted.slice(0, 8), entropy: entropyVal };
}

function getDateStats(values) {
  const dates = values.filter(v => v !== "" && v !== null && v !== undefined && !isNaN(Date.parse(v))).map(v => new Date(v));
  if (dates.length === 0) return null;
  dates.sort((a, b) => a - b);
  const yearCounts = {}, monthCounts = {}, weekdayCounts = {};
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  dates.forEach(d => {
    const y = d.getFullYear(); yearCounts[y] = (yearCounts[y] || 0) + 1;
    const m = d.getMonth() + 1; monthCounts[m] = (monthCounts[m] || 0) + 1;
    const wd = days[d.getDay()]; weekdayCounts[wd] = (weekdayCounts[wd] || 0) + 1;
  });
  return {
    min: dates[0].toISOString().split("T")[0],
    max: dates[dates.length - 1].toISOString().split("T")[0],
    rangeYears: ((dates[dates.length - 1] - dates[0]) / (86400000 * 365.25)).toFixed(1),
    yearDist: Object.entries(yearCounts).sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ name: k, count: v })),
    monthDist: Array.from({ length: 12 }, (_, i) => ({ name: i + 1, count: monthCounts[i + 1] || 0 })),
    weekdayDist: days.map(d => ({ name: d, count: weekdayCounts[d] || 0 })),
  };
}

function generateInsights(col, values, type, numStats, catStats, dateStats, missingPct) {
  const insights = [];
  if (parseFloat(missingPct) > 20) insights.push({ level: "warn", msg: `${missingPct}% missing values — consider imputation or dropping column` });
  if (type === "numeric" && numStats) {
    if (Math.abs(numStats.skew) > 1) insights.push({ level: "warn", msg: `${numStats.skew > 0 ? "Right" : "Left"}-skewed (skew=${numStats.skew.toFixed(2)}) — median recommended for imputation` });
    if (numStats.outlierCount > 0) insights.push({ level: "warn", msg: `${numStats.outlierCount} outlier(s) detected via IQR` });
    if (numStats.std === 0) insights.push({ level: "info", msg: "Zero variance — column has a single constant value" });
  }
  if (type === "categorical" && catStats) {
    if (catStats.unique > 50) insights.push({ level: "warn", msg: `High cardinality: ${catStats.unique} unique values` });
    if (catStats.entropy < 0.5) insights.push({ level: "info", msg: `Low entropy (${catStats.entropy.toFixed(2)}) — heavily imbalanced distribution` });
  }
  if (type === "date" && dateStats) {
    insights.push({ level: "info", msg: `Date range: ${dateStats.min} to ${dateStats.max} (${dateStats.rangeYears} years)` });
  }
  return insights;
}

function StatGrid({ items }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 text-xs mb-3">
      {items.map(s => (
        <div key={s.label} className="bg-muted rounded-md px-2 py-1.5 text-center">
          <p className="text-muted-foreground text-[9px] uppercase tracking-wide">{s.label}</p>
          <p className="font-mono font-semibold text-foreground text-[11px]">{s.val}</p>
        </div>
      ))}
    </div>
  );
}

function ColumnCard({ col, values }) {
  const [expanded, setExpanded] = useState(false);
  const type = inferColType(values);
  const missing = values.filter(v => v === "" || v === null || v === undefined).length;
  const missingPct = ((missing / values.length) * 100).toFixed(1);

  const numStats = type === "numeric" ? getNumericStats(values) : null;
  const catStats = (type === "categorical" || type === "empty") ? getCategoricalStats(values) : null;
  const dateStats = type === "date" ? getDateStats(values) : null;

  const insights = useMemo(() =>
    generateInsights(col, values, type, numStats, catStats, dateStats, missingPct),
    [col, values, type, numStats, catStats, dateStats, missingPct]
  );

  const histData = useMemo(() => {
    if (!numStats) return null;
    const nums = values.map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    const bins = 10;
    const range = numStats.max - numStats.min;
    const binWidth = range === 0 ? 1 : range / bins;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      label: (numStats.min + i * binWidth).toFixed(1),
      count: 0
    }));
    nums.forEach(n => {
      let idx = range === 0 ? 0 : Math.floor((n - numStats.min) / binWidth);
      if (idx < 0) idx = 0;
      if (idx >= bins) idx = bins - 1;
      buckets[idx].count++;
    });
    return buckets;
  }, [values, numStats]);

  const TypeIcon = type === "numeric" ? Hash : type === "date" ? Calendar : Type;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">{col}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {insights.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
            <Badge variant="secondary" className="text-[10px]">{type}</Badge>
            <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground ml-1">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className="flex items-center gap-1.5 text-xs mb-3">
          {missing > 0 ? (
            <><AlertTriangle className="w-3 h-3 text-destructive" /><span className="text-destructive font-medium">{missing} missing ({missingPct}%)</span></>
          ) : (
            <><Percent className="w-3 h-3 text-green-600" /><span className="text-green-600 font-medium">No missing values</span></>
          )}
        </div>

        {numStats && (
          <>
            <StatGrid items={[
              { label: "Mean", val: numStats.mean.toFixed(2) },
              { label: "Median", val: numStats.median.toFixed(2) },
              { label: "Std Dev", val: numStats.std.toFixed(2) },
              { label: "Min", val: numStats.min },
              { label: "Max", val: numStats.max },
              { label: "Count", val: numStats.count },
            ]} />
            {expanded && (
              <StatGrid items={[
                { label: "Q1", val: numStats.q1.toFixed(2) },
                { label: "Q3", val: numStats.q3.toFixed(2) },
                { label: "IQR", val: numStats.iqr.toFixed(2) },
                { label: "Range", val: numStats.range.toFixed(2) },
                { label: "Variance", val: numStats.variance.toFixed(2) },
                { label: "Skewness", val: numStats.skew.toFixed(3) },
                { label: "Mode", val: numStats.mode?.toFixed(2) ?? "—" },
                { label: "Outliers", val: numStats.outlierCount },
              ]} />
            )}
            {histData && (
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="count" fill="hsl(245, 58%, 51%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {catStats && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span>{catStats.unique} unique values</span>
              {expanded && <span>· Entropy: {catStats.entropy.toFixed(2)}</span>}
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catStats.top.map(([name, value]) => ({ name, value }))}
                    cx="50%" cy="50%" innerRadius={25} outerRadius={48}
                    paddingAngle={2} dataKey="value">
                    {catStats.top.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {catStats.top.slice(0, 5).map(([name, count]) => (
                <Badge key={name} variant="outline" className="text-[10px] font-mono">
                  {name.length > 12 ? name.slice(0, 12) + "…" : name}: {count}
                </Badge>
              ))}
            </div>
          </>
        )}

        {dateStats && expanded && (
          <>
            <StatGrid items={[
              { label: "Min Date", val: dateStats.min },
              { label: "Max Date", val: dateStats.max },
              { label: "Span (yrs)", val: dateStats.rangeYears },
            ]} />
            <div className="h-24 mt-2">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Year distribution</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dateStats.yearDist} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 8 }} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="count" fill="hsl(180, 55%, 45%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-20 mt-2">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Weekday distribution</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dateStats.weekdayDist} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 8 }} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="count" fill="hsl(30, 80%, 55%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {dateStats && !expanded && (
          <p className="text-xs text-muted-foreground">{dateStats.min} → {dateStats.max} ({dateStats.rangeYears} yrs)</p>
        )}

        {insights.length > 0 && (
          <div className="mt-2 space-y-1">
            {insights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-1.5 text-[10px] rounded px-2 py-1 ${ins.level === "warn" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
                <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                {ins.msg}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function generateReportCSV(data, columns) {
  const rows = [["Column", "Type", "Count", "Missing", "Missing%", "Unique", "Mean", "Median", "Std", "Min", "Max", "Q1", "Q3", "IQR", "Skewness", "Outliers_IQR"]];
  columns.filter(c => c !== "").forEach(col => {
    const values = data.map(r => r[col]);
    const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
    const missing = values.length - nonEmpty.length;
    const missingPct = ((missing / values.length) * 100).toFixed(1);
    const unique = new Set(nonEmpty.map(String)).size;
    const numericCheck = nonEmpty.filter(v => !isNaN(Number(v)));
    const isNum = numericCheck.length / (nonEmpty.length || 1) > 0.8;
    const dateCheck = nonEmpty.filter(v => !isNaN(Date.parse(v)));
    const isDate = !isNum && dateCheck.length / (nonEmpty.length || 1) > 0.6;
    const type = isNum ? "numeric" : isDate ? "date" : "categorical";

    let mean = "", median = "", std = "", min = "", max = "", q1 = "", q3 = "", iqr = "", skew = "", outliers = "";
    if (isNum) {
      const nums = nonEmpty.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length) {
        const s = nums.reduce((a, b) => a + b, 0);
        const m = s / nums.length;
        const v = nums.reduce((acc, n) => acc + (n - m) ** 2, 0) / nums.length;
        const sd = Math.sqrt(v);
        const q1v = nums[Math.floor(nums.length * 0.25)];
        const q3v = nums[Math.floor(nums.length * 0.75)];
        const iqrv = q3v - q1v;
        const med = nums.length % 2 === 0 ? (nums[nums.length/2-1]+nums[nums.length/2])/2 : nums[Math.floor(nums.length/2)];
        const sk = sd === 0 ? 0 : (() => {
          const n = nums.length;
          return (n / ((n-1)*(n-2))) * nums.reduce((acc, x) => acc + ((x-m)/sd)**3, 0);
        })();
        const outs = nums.filter(n => n < q1v - 1.5*iqrv || n > q3v + 1.5*iqrv).length;
        mean = m.toFixed(4); median = med.toFixed(4); std = sd.toFixed(4);
        min = nums[0]; max = nums[nums.length-1]; q1 = q1v.toFixed(4); q3 = q3v.toFixed(4);
        iqr = iqrv.toFixed(4); skew = sk.toFixed(4); outliers = outs;
      }
    }
    rows.push([col, type, nonEmpty.length, missing, missingPct, unique, mean, median, std, min, max, q1, q3, iqr, skew, outliers]);
  });
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ---------- Column Type Override Panel ----------
function TypeOverridePanel({ columns, overrides, onOverrideChange, autoTypes }) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="text-xs">
        <Settings className="w-3.5 h-3.5 mr-1" /> Column Type Overrides
      </Button>
    );
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold">Column Type Overrides</h4>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="h-6 px-2 text-xs">
          Close
        </Button>
      </div>
      <div className="overflow-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 text-left">Column</th>
              <th className="py-1 pr-2 text-left">Auto Type</th>
              <th className="py-1 pr-2 text-left">Override</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(col => {
              const currentOverride = overrides[col] || 'auto';
              const autoType = autoTypes[col] || 'unknown';
              return (
                <tr key={col} className="border-t border-border/40">
                  <td className="py-1 pr-2">{col}</td>
                  <td className="py-1 pr-2">
                    <Badge variant="outline" className="text-[9px]">{autoType}</Badge>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      value={currentOverride}
                      onChange={(e) => onOverrideChange(col, e.target.value)}
                      className="text-xs border border-border rounded px-1 py-0.5 bg-background"
                    >
                      <option value="auto">Auto</option>
                      <option value="numeric">Numeric</option>
                      <option value="categorical">Categorical</option>
                      <option value="exclude">Exclude</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onOverrideChange('__reset__')} className="text-xs h-7">
          Reset All
        </Button>
      </div>
    </div>
  );
}

// ---------- Enhanced Association Matrix (with overrides) ----------
function CorrelationHeatmap({ data, columns, overrides = {}, onOverrideChange }) {
  // ----- Clean data -----
  const cleanedData = useMemo(() => {
    return data.map(row => {
      const newRow = {};
      columns.forEach(col => {
        try {
          newRow[col] = normalizeValue(row[col]);
        } catch (e) {
          newRow[col] = null;
        }
      });
      return newRow;
    });
  }, [data, columns]);

  // ----- Auto‑detect types (based on cleaned data) -----
  const autoTypes = useMemo(() => {
    const types = {};
    columns.forEach(col => {
      const vals = cleanedData.map(r => r[col]);
      types[col] = inferColType(vals);
    });
    return types;
  }, [cleanedData, columns]);

  // ----- Resolve effective type (override > auto) -----
  const getEffectiveType = (col) => {
    const override = overrides[col];
    if (override === 'numeric') return 'numeric';
    if (override === 'categorical') return 'categorical';
    if (override === 'exclude') return 'exclude';
    return autoTypes[col] || 'categorical';
  };

  // ----- Build numeric and categorical lists based on effective type -----
  const numericCols = useMemo(() => {
    return columns.filter(col => getEffectiveType(col) === 'numeric');
  }, [columns, overrides, autoTypes]);

  const categoricalCols = useMemo(() => {
    return columns.filter(col => getEffectiveType(col) === 'categorical');
  }, [columns, overrides, autoTypes]);

  // ----- Excluded columns -----
  const excludedCols = useMemo(() => {
    return columns.filter(col => getEffectiveType(col) === 'exclude');
  }, [columns, overrides, autoTypes]);

  const [view, setView] = useState("mixed");
  const [showAll, setShowAll] = useState(false);

  const displayCols = useMemo(() => {
    let cols = [];
    if (view === "numeric") cols = numericCols;
    else if (view === "categorical") cols = categoricalCols;
    else cols = [...numericCols, ...categoricalCols];
    if (!showAll && cols.length > 20) return cols.slice(0, 20);
    return cols;
  }, [view, numericCols, categoricalCols, showAll]);

  // ----- Compute matrix (uses cleanedData) -----
  const associationMatrix = useMemo(() => {
    if (displayCols.length < 2) return null;
    const mat = {};
    for (let i = 0; i < displayCols.length; i++) {
      const col1 = displayCols[i];
      mat[col1] = {};
      for (let j = 0; j < displayCols.length; j++) {
        const col2 = displayCols[j];
        if (col1 === col2) {
          mat[col1][col2] = 1;
          continue;
        }

        const col1Type = getEffectiveType(col1);
        const col2Type = getEffectiveType(col2);
        const pairs = [];
        for (let k = 0; k < cleanedData.length; k++) {
          const a = cleanedData[k][col1];
          const b = cleanedData[k][col2];
          if (a !== null && a !== undefined && b !== null && b !== undefined) {
            pairs.push({ a, b });
          }
        }
        if (pairs.length < 2) {
          mat[col1][col2] = 0;
          continue;
        }

        let val = 0;
        if (col1Type === 'numeric' && col2Type === 'numeric') {
          const a = pairs.map(p => p.a);
          const b = pairs.map(p => p.b);
          val = pearson(a, b);
          if (view === 'mixed') val = Math.abs(val);
        } else if (col1Type === 'categorical' && col2Type === 'categorical') {
          const cats1 = pairs.map(p => String(p.a));
          const cats2 = pairs.map(p => String(p.b));
          val = cramersV(cats1, cats2);
        } else {
          // Mixed: numeric vs categorical
          const numericCol = col1Type === 'numeric' ? col1 : col2;
          const catCol = col1Type === 'categorical' ? col1 : col2;
          const nums = pairs.map(p => (col1Type === 'numeric' ? p.a : p.b));
          const cats = pairs.map(p => (col1Type === 'categorical' ? p.a : p.b));
          const uniqueCats = new Set(cats);
          if (uniqueCats.size >= 2 && uniqueCats.size <= 50) {
            val = correlationRatio(cats, nums);
          }
        }
        mat[col1][col2] = isNaN(val) ? 0 : val;
      }
    }
    return mat;
  }, [displayCols, cleanedData, view, overrides, autoTypes]);

  const getColor = (val) => {
    if (view === 'numeric') {
      if (val === 0) return "#ffffff";
      const abs = Math.abs(val);
      const t = Math.min(1, abs);
      if (val > 0) {
        const r = 255;
        const g = Math.round(255 * (1 - t));
        const b = Math.round(255 * (1 - t));
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        const r = Math.round(255 * (1 - t));
        const g = Math.round(255 * (1 - t));
        const b = 255;
        return `rgb(${r}, ${g}, ${b})`;
      }
    } else {
      const t = Math.min(1, val);
      const r = 255;
      const g = Math.round(255 * (1 - t));
      const b = Math.round(255 * (1 - t));
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  const formatVal = (v) => v.toFixed(2);
  const getViewLabel = () => {
    switch (view) {
      case 'numeric': return 'Numeric (Pearson)';
      case 'categorical': return 'Categorical (Cramer\'s V)';
      default: return 'Mixed (Best Measure)';
    }
  };

  const downloadMatrixCSV = () => {
    if (!associationMatrix) return;
    const rows = [["", ...displayCols]];
    for (const col1 of displayCols) {
      const row = [col1];
      for (const col2 of displayCols) {
        row.push(associationMatrix[col1]?.[col2]?.toFixed(4) ?? "");
      }
      rows.push(row);
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `association_matrix_${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (displayCols.length < 2) {
    let msg = '';
    if (view === 'numeric') msg = 'No numeric columns found.';
    else if (view === 'categorical') msg = 'No categorical columns found.';
    else msg = 'Need at least 2 columns to compute associations.';
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-primary" /> Association Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{msg}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-primary" /> Association Matrix
              <Badge variant="secondary" className="text-[10px]">{getViewLabel()}</Badge>
            </CardTitle>
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background"
            >
              <option value="numeric">Numeric (Pearson)</option>
              <option value="categorical">Categorical (Cramer's V)</option>
              <option value="mixed">Mixed (Best Measure)</option>
            </select>
            <TypeOverridePanel
              columns={columns}
              overrides={overrides}
              onOverrideChange={onOverrideChange}
              autoTypes={autoTypes}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadMatrixCSV} className="text-xs h-7">
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
            {displayCols.length > 20 && (
              <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs h-7">
                {showAll ? "Show fewer" : "Show all"}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {view === 'numeric' && 'Pearson correlation (signed). Red = positive, blue = negative, white = none.'}
          {view === 'categorical' && 'Cramer\'s V (0 = independent, 1 = fully associated). Darker = stronger.'}
          {view === 'mixed' && 'Numeric↔numeric: Pearson (absolute); categorical↔categorical: Cramer\'s V; mixed: correlation ratio. Darker = stronger (0–1).'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[600px]">
          <div className="min-w-[800px]">
            <div className="flex items-center border-b border-border">
              <div className="w-24 shrink-0 px-2 py-1 text-xs font-medium text-muted-foreground sticky left-0 bg-background z-10">
                Column
              </div>
              {displayCols.map(col => (
                <div
                  key={col}
                  className="w-20 shrink-0 text-center text-xs font-medium text-muted-foreground truncate px-1"
                  title={col}
                >
                  {col}
                </div>
              ))}
            </div>
            {displayCols.map(col1 => (
              <div key={col1} className="flex items-center border-b border-border/40">
                <div className="w-24 shrink-0 px-2 py-1 text-xs font-medium truncate sticky left-0 bg-background z-10" title={col1}>
                  {col1}
                </div>
                {displayCols.map(col2 => {
                  const val = associationMatrix[col1]?.[col2] ?? 0;
                  const absVal = Math.abs(val);
                  return (
                    <div
                      key={col2}
                      className="w-20 h-8 shrink-0 flex items-center justify-center text-[10px] font-mono"
                      style={{ backgroundColor: getColor(val), color: absVal > 0.6 ? "#fff" : "#000" }}
                      title={`${col1} vs ${col2}: ${val.toFixed(3)}`}
                    >
                      {formatVal(val)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Data Quality Dashboard (unchanged) ----------
function DataQualityDashboard({ data, columns }) {
  const totalCells = data.length * columns.length;
  const missingCells = useMemo(() => {
    let count = 0;
    data.forEach(row => columns.forEach(col => {
      if (row[col] === "" || row[col] === null || row[col] === undefined) count++;
    }));
    return count;
  }, [data, columns]);

  const duplicateRows = useMemo(() => {
    const unique = new Set(data.map(row => JSON.stringify(row)));
    return data.length - unique.size;
  }, [data]);

  const constantCols = useMemo(() => {
    let count = 0;
    columns.forEach(col => {
      const nonNull = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
      if (nonNull.length > 0) {
        const unique = new Set(nonNull);
        if (unique.size === 1) count++;
      }
    });
    return count;
  }, [data, columns]);

  const avgCardinality = useMemo(() => {
    let totalUnique = 0;
    let catCols = 0;
    columns.forEach(col => {
      const nonNull = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
      if (nonNull.length > 0) {
        const unique = new Set(nonNull);
        const type = inferColType(data.map(r => r[col]));
        if (type === "categorical") {
          totalUnique += unique.size;
          catCols++;
        }
      }
    });
    return catCols > 0 ? totalUnique / catCols : 0;
  }, [data, columns]);

  const highCardCols = useMemo(() => {
    let count = 0;
    columns.forEach(col => {
      const nonNull = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
      if (nonNull.length > 0) {
        const unique = new Set(nonNull);
        const type = inferColType(data.map(r => r[col]));
        if (type === "categorical" && unique.size > 50) count++;
      }
    });
    return count;
  }, [data, columns]);

  const missingPct = totalCells ? ((missingCells / totalCells) * 100) : 0;
  const duplicatePct = data.length ? ((duplicateRows / data.length) * 100) : 0;

  const metrics = [
    { label: "Missing Cells", value: `${missingPct.toFixed(1)}%`, icon: Percent },
    { label: "Duplicate Rows", value: `${duplicatePct.toFixed(1)}%`, icon: Copy },
    { label: "Constant Columns", value: constantCols, icon: Activity },
    { label: "Avg Cardinality", value: avgCardinality.toFixed(1), icon: Hash },
    { label: "High-Cardinality Columns", value: highCardCols, icon: AlertTriangle },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map(m => (
        <Card key={m.label} className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <m.icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
              <p className="text-base font-bold text-foreground">{m.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Main EDAPanel ----------
export default function EDAPanel({ data, columns, fileName }) {
  const [search, setSearch] = useState("");
  const [columnOverrides, setColumnOverrides] = useState({});

  const handleOverrideChange = (col, value) => {
    if (col === '__reset__') {
      setColumnOverrides({});
      return;
    }
    setColumnOverrides(prev => ({ ...prev, [col]: value === 'auto' ? undefined : value }));
  };

  const downloadReport = () => {
    const csv = generateReportCSV(data, columns);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eda_report_${(fileName || "data").replace(/\.[^.]+$/, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const missingCells = useMemo(() => {
    let count = 0;
    data.forEach(row => columns.forEach(col => {
      if (row[col] === "" || row[col] === null || row[col] === undefined) count++;
    }));
    return count;
  }, [data, columns]);

  const colTypes = useMemo(() => {
    const res = {};
    columns.forEach(col => { res[col] = inferColType(data.map(r => r[col])); });
    return res;
  }, [data, columns]);

  const typeCounts = useMemo(() => {
    const counts = { numeric: 0, categorical: 0, date: 0, empty: 0 };
    Object.values(colTypes).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    return counts;
  }, [colTypes]);

  const filteredCols = columns.filter(c => c !== "" && c.toLowerCase().includes(search.toLowerCase()));

  const overviewStats = [
    { label: "Rows", value: data.length, icon: TrendingUp },
    { label: "Columns", value: columns.length, icon: BarChart3 },
    { label: "Numeric", value: typeCounts.numeric, icon: Hash },
    { label: "Categorical", value: typeCounts.categorical, icon: Type },
    { label: "Date", value: typeCounts.date, icon: Calendar },
    { label: "Missing", value: `${missingCells} (${((missingCells / (data.length * columns.length || 1)) * 100).toFixed(1)}%)`, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {overviewStats.map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-base font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Data Quality Dashboard
        </h2>
        <DataQualityDashboard data={data} columns={columns} />
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-primary" /> Correlation Analysis
        </h2>
        <CorrelationHeatmap
          data={data}
          columns={columns}
          overrides={columnOverrides}
          onOverrideChange={handleOverrideChange}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold text-foreground">Column Analysis</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search columns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background w-40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" variant="outline" onClick={downloadReport} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download Report
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">Click the arrow on each card for detailed stats & date distributions.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCols.map(col => (
            <ColumnCard key={col} col={col} values={data.map(row => row[col])} />
          ))}
        </div>
      </div>
    </div>
  );
}