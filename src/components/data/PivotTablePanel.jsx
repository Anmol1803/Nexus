import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table2, Grid3x3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

function inferType(values) {
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "text";
  const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  return numCount / nonEmpty.length > 0.8 ? "numeric" : "categorical";
}

const COLORS = ["#6366f1","#06b6d4","#f59e0b","#ec4899","#22c55e","#8b5cf6","#f97316","#14b8a6"];

export default function PivotTablePanel({ data, columns }) {
  const numericCols = useMemo(() => columns.filter(c => inferType(data.map(r => r[c])) === "numeric"), [data, columns]);
  const categoricalCols = useMemo(() => columns.filter(c => inferType(data.map(r => r[c])) === "categorical"), [data, columns]);

  const [rowField, setRowField] = useState(categoricalCols[0] || columns[0] || "");
  const [colField, setColField] = useState(categoricalCols[1] || "__none__");
  const [valueField, setValueField] = useState(numericCols[0] || columns[0] || "");
  const [aggFunc, setAggFunc] = useState("sum");

  function aggregate(values) {
    const nums = values.map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    switch (aggFunc) {
      case "sum": return nums.reduce((a, b) => a + b, 0);
      case "mean": return nums.reduce((a, b) => a + b, 0) / nums.length;
      case "count": return values.length;
      case "min": return Math.min(...nums);
      case "max": return Math.max(...nums);
    }
    return null;
  }

  const pivotResult = useMemo(() => {
    const rowVals = [...new Set(data.map(r => String(r[rowField] ?? "(empty)")))].slice(0, 30);
    const colVals = colField === "__none__"
      ? ["Value"]
      : [...new Set(data.map(r => String(r[colField] ?? "(empty)")))].slice(0, 12);

    // Build grouped data
    const cells = {};
    rowVals.forEach(rv => {
      cells[rv] = {};
      colVals.forEach(cv => { cells[rv][cv] = []; });
    });

    data.forEach(row => {
      const rv = String(row[rowField] ?? "(empty)");
      const cv = colField === "__none__" ? "Value" : String(row[colField] ?? "(empty)");
      if (cells[rv] && cells[rv][cv] !== undefined) {
        const val = aggFunc === "count" ? 1 : row[valueField];
        cells[rv][cv].push(val);
      }
    });

    // Aggregate
    const table = rowVals.map(rv => {
      const rowData = { _row: rv };
      let rowTotal = 0;
      colVals.forEach(cv => {
        const agg = aggregate(cells[rv][cv]);
        rowData[cv] = agg !== null ? Number(agg.toFixed(3)) : null;
        if (agg !== null) rowTotal += agg;
      });
      rowData._total = Number(rowTotal.toFixed(3));
      return rowData;
    });

    // Column totals
    const totals = { _row: "Grand Total" };
    colVals.forEach(cv => {
      const allVals = data.map(r => {
        if (colField !== "__none__" && String(r[colField] ?? "(empty)") !== cv) return undefined;
        return aggFunc === "count" ? 1 : r[valueField];
      }).filter(v => v !== undefined);
      const agg = aggregate(allVals);
      totals[cv] = agg !== null ? Number(agg.toFixed(3)) : null;
    });
    totals._total = colVals.reduce((s, cv) => s + (totals[cv] || 0), 0);

    return { table, colVals, totals };
  }, [data, rowField, colField, valueField, aggFunc]);

  // Chart from pivot (top rows)
  const chartData = useMemo(() => {
    return pivotResult.table.slice(0, 20).map(row => {
      const d = { name: String(row._row).slice(0, 20) };
      pivotResult.colVals.forEach(cv => { d[cv] = row[cv] ?? 0; });
      return d;
    });
  }, [pivotResult]);

  const fmt = (v) => {
    if (v === null || v === undefined) return "–";
    if (typeof v === "number") return v >= 1000 ? v.toLocaleString() : v;
    return String(v).slice(0, 20);
  };

  const exportPivotCSV = () => {
    const header = [rowField, ...pivotResult.colVals, "Total"];
    const rows = pivotResult.table.map(row => [row._row, ...pivotResult.colVals.map(cv => row[cv] ?? ""), row._total]);
    const totalRow = ["Grand Total", ...pivotResult.colVals.map(cv => pivotResult.totals[cv] ?? ""), pivotResult.totals._total];
    const csv = [header, ...rows, totalRow].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "pivot_table.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const getHeatColor = (val, max) => {
    if (val === null || max === 0) return "";
    const pct = Math.min(Math.abs(val) / max, 1);
    const alpha = Math.round(pct * 60);
    return `rgba(99, 102, 241, ${alpha / 100})`;
  };

  const maxVal = useMemo(() => {
    let m = 0;
    pivotResult.table.forEach(row => {
      pivotResult.colVals.forEach(cv => { if (row[cv] !== null) m = Math.max(m, Math.abs(row[cv])); });
    });
    return m;
  }, [pivotResult]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-primary" /> Pivot Table Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Row (Group by)</Label>
              <Select value={rowField} onValueChange={setRowField}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Column (Split by)</Label>
              <Select value={colField} onValueChange={setColField}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None (single column)</SelectItem>
                  {columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Select value={valueField} onValueChange={setValueField}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Aggregate</Label>
              <Select value={aggFunc} onValueChange={setAggFunc}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="mean">Mean / Average</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="min">Min</SelectItem>
                  <SelectItem value="max">Max</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pivot Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Table2 className="w-4 h-4 text-primary" /> Pivot Table
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{pivotResult.table.length} rows</Badge>
              <Badge variant="outline">{pivotResult.colVals.length} cols</Badge>
              <Button size="sm" variant="outline" onClick={exportPivotCSV} className="text-xs h-7">
                <Download className="w-3 h-3 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="bg-muted/70">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground border-b border-r border-border sticky left-0 bg-muted/70 z-10">
                    {rowField}
                  </th>
                  {pivotResult.colVals.map(cv => (
                    <th key={cv} className="text-right px-3 py-2 font-semibold text-muted-foreground border-b border-r border-border whitespace-nowrap">
                      {String(cv).slice(0, 18)}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-bold text-foreground border-b border-border bg-muted">Total</th>
                </tr>
              </thead>
              <tbody>
                {pivotResult.table.map((row, ri) => (
                  <tr key={ri} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground border-r border-border border-b sticky left-0 bg-card z-10 whitespace-nowrap max-w-[160px] truncate">
                      {String(row._row).slice(0, 30)}
                    </td>
                    {pivotResult.colVals.map(cv => (
                      <td
                        key={cv}
                        className="text-right px-3 py-2 font-mono border-r border-b border-border whitespace-nowrap"
                        style={{ backgroundColor: getHeatColor(row[cv], maxVal) }}
                      >
                        {fmt(row[cv])}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 font-bold font-mono border-b border-border bg-muted/30 whitespace-nowrap">
                      {fmt(row._total)}
                    </td>
                  </tr>
                ))}
                {/* Grand total row */}
                <tr className="bg-muted/60 font-bold">
                  <td className="px-3 py-2 text-foreground border-r border-border sticky left-0 bg-muted/60 z-10">Grand Total</td>
                  {pivotResult.colVals.map(cv => (
                    <td key={cv} className="text-right px-3 py-2 font-mono border-r border-border">{fmt(pivotResult.totals[cv])}</td>
                  ))}
                  <td className="text-right px-3 py-2 font-mono">{fmt(pivotResult.totals._total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Heat-map shading indicates relative value magnitude. Hover cells for exact values.
          </p>
        </CardContent>
      </Card>

      {/* Pivot Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pivot Visualization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                {pivotResult.colVals.map((cv, i) => (
                  <Bar key={cv} dataKey={cv} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} stackId={colField === "__none__" ? undefined : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}