import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  PieChart, Pie, Cell, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ZAxis
} from "recharts";
import { BarChart3, TrendingUp, Circle, Layers, Download, Filter, BookmarkPlus, Trash2, Eye } from "lucide-react";

const COLORS = [
  "#6366f1","#06b6d4","#f59e0b","#ec4899","#22c55e",
  "#8b5cf6","#f97316","#14b8a6","#e11d48","#84cc16",
  "#3b82f6","#a855f7","#14532d","#7c3aed"
];

function inferType(values) {
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "text";
  const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  return numCount / nonEmpty.length > 0.8 ? "numeric" : "categorical";
}

const CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "stacked_bar", label: "Stacked Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "scatter", label: "Scatter" },
  { value: "bubble", label: "Bubble" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
  { value: "histogram", label: "Histogram" },
  { value: "radar", label: "Radar" },
];

const AGG_FUNCS = ["sum", "mean", "count", "min", "max", "median"];

function aggregate(values, func) {
  const nums = values.map(Number).filter(n => !isNaN(n));
  if (nums.length === 0) return 0;
  switch (func) {
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "mean": return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "count": return values.length;
    case "min": return Math.min(...nums);
    case "max": return Math.max(...nums);
    case "median": {
      const s = [...nums].sort((a, b) => a - b);
      return s.length % 2 === 0 ? (s[s.length/2-1]+s[s.length/2])/2 : s[Math.floor(s.length/2)];
    }
    default: return 0;
  }
}

export default function ChartBuilder({ data, columns }) {
  const validCols = columns.filter(c => c !== "");
  const [chartType, setChartType] = useState("bar");
  const [xCol, setXCol] = useState(validCols[0] || "");
  const [yCol, setYCol] = useState(validCols[1] || validCols[0] || "");
  const [sizeCol, setSizeCol] = useState("__none__");
  const [colorCol, setColorCol] = useState("__none__");
  const [yAgg, setYAgg] = useState("sum");
  const [sortOrder, setSortOrder] = useState("none");
  const [maxBars, setMaxBars] = useState(30);
  const [chartTitle, setChartTitle] = useState("");
  const [filterCol, setFilterCol] = useState("__none__");
  const [filterVal, setFilterVal] = useState("");
  const [savedCharts, setSavedCharts] = useState([]);
  const [viewingSaved, setViewingSaved] = useState(null);

  const numericCols = useMemo(() => validCols.filter(c => inferType(data.map(r => r[c])) === "numeric"), [data, validCols]);

  const saveChart = () => {
    const name = chartTitle.trim() || `Chart ${savedCharts.length + 1}`;
    setSavedCharts(prev => [...prev, {
      id: Date.now(), name, chartType, xCol, yCol, sizeCol, colorCol, yAgg, sortOrder, maxBars, filterCol, filterVal
    }]);
  };

  const deleteChart = (id) => setSavedCharts(prev => prev.filter(c => c.id !== id));

  const loadChart = (c) => {
    setChartType(c.chartType); setXCol(c.xCol); setYCol(c.yCol);
    setSizeCol(c.sizeCol); setColorCol(c.colorCol); setYAgg(c.yAgg);
    setSortOrder(c.sortOrder); setMaxBars(c.maxBars); setFilterCol(c.filterCol); setFilterVal(c.filterVal);
    setChartTitle(c.name); setViewingSaved(null);
  };

  const filteredData = useMemo(() => {
    if (filterCol === "__none__" || !filterVal) return data;
    return data.filter(row => String(row[filterCol] ?? "").toLowerCase().includes(filterVal.toLowerCase()));
  }, [data, filterCol, filterVal]);

  const chartData = useMemo(() => {
    if (!xCol || !yCol) return [];

    if (chartType === "scatter" || chartType === "bubble") {
      return filteredData.slice(0, 500).map(row => ({
        x: Number(row[xCol]),
        y: Number(row[yCol]),
        z: sizeCol !== "__none__" ? Math.max(Number(row[sizeCol]) || 10, 5) : 50,
        label: colorCol !== "__none__" ? String(row[colorCol] ?? "") : undefined,
      })).filter(d => !isNaN(d.x) && !isNaN(d.y));
    }

    if (chartType === "histogram") {
      const nums = filteredData.map(r => Number(r[xCol])).filter(n => !isNaN(n));
      if (nums.length === 0) return [];
      nums.sort((a, b) => a - b);
      const min = nums[0]; const max = nums[nums.length - 1];
      const bins = 15; const binWidth = (max - min) === 0 ? 1 : (max - min) / bins;
      const buckets = Array.from({ length: bins }, (_, i) => ({
        label: (min + i * binWidth).toFixed(1), count: 0
      }));
      nums.forEach(n => {
        let idx = (max - min) === 0 ? 0 : Math.floor((n - min) / binWidth);
        if (idx < 0) idx = 0; if (idx >= bins) idx = bins - 1;
        buckets[idx].count++;
      });
      return buckets;
    }

    if (chartType === "pie" || chartType === "donut") {
      const counts = {};
      filteredData.forEach(row => {
        const k = String(row[xCol] ?? "(empty)");
        const v = Number(row[yCol]);
        counts[k] = (counts[k] || 0) + (isNaN(v) ? 1 : v);
      });
      let arr = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
      return arr;
    }

    if (chartType === "stacked_bar" && colorCol !== "__none__") {
      const groups = {};
      const seriesSet = new Set();
      filteredData.forEach(row => {
        const k = String(row[xCol] ?? "(empty)");
        const s = String(row[colorCol] ?? "(empty)");
        seriesSet.add(s);
        if (!groups[k]) groups[k] = {};
        if (!groups[k][s]) groups[k][s] = [];
        const v = Number(row[yCol]);
        if (!isNaN(v)) groups[k][s].push(v);
      });
      const series = [...seriesSet].slice(0, 8);
      let arr = Object.entries(groups).slice(0, maxBars).map(([key, seriesData]) => {
        const d = { name: key };
        series.forEach(s => { d[s] = aggregate(seriesData[s] || [], yAgg); });
        return d;
      });
      if (sortOrder === "asc") arr.sort((a, b) => (a[series[0]] || 0) - (b[series[0]] || 0));
      if (sortOrder === "desc") arr.sort((a, b) => (b[series[0]] || 0) - (a[series[0]] || 0));
      return { data: arr, series };
    }

    if (chartType === "radar") {
      const groups = {};
      filteredData.forEach(row => {
        const k = String(row[xCol] ?? "(empty)");
        const v = Number(row[yCol]);
        if (!groups[k]) groups[k] = [];
        if (!isNaN(v)) groups[k].push(v);
      });
      return Object.entries(groups).slice(0, 10).map(([key, vals]) => ({
        subject: key, value: Number(aggregate(vals, yAgg).toFixed(2))
      }));
    }

    // Default: grouped bar/line/area
    const groups = {};
    filteredData.forEach(row => {
      const k = String(row[xCol] ?? "(empty)");
      const v = Number(row[yCol]);
      if (!groups[k]) groups[k] = { values: [], count: 0 };
      if (!isNaN(v)) groups[k].values.push(v);
      groups[k].count++;
    });

    let arr = Object.entries(groups).slice(0, maxBars).map(([key, g]) => ({
      name: key, value: Number(aggregate(g.values, yAgg).toFixed(3))
    }));

    if (sortOrder === "asc") arr.sort((a, b) => a.value - b.value);
    if (sortOrder === "desc") arr.sort((a, b) => b.value - a.value);

    return arr;
  }, [filteredData, xCol, yCol, yAgg, chartType, colorCol, sizeCol, sortOrder, maxBars]);

  const isStackedWithSeries = chartType === "stacked_bar" && colorCol !== "__none__" && chartData?.series;

  const renderChart = () => {
    const d = isStackedWithSeries ? chartData.data : chartData;
    if (!d || d.length === 0) return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data with current settings</div>
    );
    const common = { data: d, margin: { top: 10, right: 20, left: 0, bottom: 55 } };

    if (chartType === "bar") return (
      <BarChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    );

    if (chartType === "stacked_bar") {
      if (isStackedWithSeries) {
        return (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend />
            {chartData.series.map((s, i) => (
              <Bar key={s} dataKey={s} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );
      }
      return (
        <BarChart {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="value" fill={COLORS[0]} />
        </BarChart>
      );
    }

    if (chartType === "line") return (
      <LineChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    );

    if (chartType === "area") return (
      <AreaChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill={COLORS[0] + "33"} strokeWidth={2} />
      </AreaChart>
    );

    if (chartType === "scatter") return (
      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} label={{ value: xCol, position: "bottom", fontSize: 12 }} />
        <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={d} fill={COLORS[0]} fillOpacity={0.75} />
      </ScatterChart>
    );

    if (chartType === "bubble") return (
      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} />
        <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
        <ZAxis dataKey="z" range={[20, 400]} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={d} fill={COLORS[0]} fillOpacity={0.6} />
      </ScatterChart>
    );

    if (chartType === "pie" || chartType === "donut") return (
      <PieChart>
        <Pie data={d} cx="50%" cy="50%"
          outerRadius={130}
          innerRadius={chartType === "donut" ? 65 : 0}
          dataKey="value"
          label={({ name, percent }) => `${String(name).slice(0, 12)} (${(percent * 100).toFixed(0)}%)`}
          labelLine fontSize={10}
        >
          {d.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend />
      </PieChart>
    );

    if (chartType === "histogram") return (
      <BarChart {...{ data: d, margin: { top: 10, right: 20, left: 0, bottom: 30 } }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" fill={COLORS[2]} radius={[2, 2, 0, 0]} />
      </BarChart>
    );

    if (chartType === "radar") return (
      <RadarChart cx="50%" cy="50%" outerRadius={130} data={d}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
        <Radar name={yCol} dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
      </RadarChart>
    );
  };

  const showSizeCol = chartType === "bubble";
  const showColorCol = ["scatter", "bubble", "stacked_bar"].includes(chartType);
  const showAgg = !["scatter", "bubble", "histogram"].includes(chartType);
  const showSort = !["pie", "donut", "scatter", "bubble", "histogram", "radar"].includes(chartType);

  return (
    <div className="space-y-4">
      {/* Saved Charts Gallery */}
      {savedCharts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-primary" /> Saved Charts ({savedCharts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedCharts.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50">
                  <span className="text-xs font-medium">{c.name}</span>
                  <Badge variant="outline" className="text-[10px]">{c.chartType}</Badge>
                  <button onClick={() => loadChart(c)} className="text-primary hover:text-primary/80" title="Load">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteChart(c.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Chart Builder
          </CardTitle>
          <p className="text-xs text-muted-foreground">Build interactive charts — {CHART_TYPES.length} chart types available</p>
        </CardHeader>
        <CardContent>
          {/* Chart type selector */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {CHART_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setChartType(ct.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  chartType === ct.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>

          {/* Config grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <div>
              <Label className="text-xs">{chartType === "histogram" ? "Column" : "X Axis"}</Label>
              <Select value={xCol} onValueChange={setXCol}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{validCols.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {chartType !== "histogram" && (
              <div>
                <Label className="text-xs">Y Axis</Label>
                <Select value={yCol} onValueChange={setYCol}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{validCols.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {showAgg && (
              <div>
                <Label className="text-xs">Aggregation</Label>
                <Select value={yAgg} onValueChange={setYAgg}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGG_FUNCS.map(a => <SelectItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showColorCol && (
              <div>
                <Label className="text-xs">Color / Series</Label>
                <Select value={colorCol} onValueChange={setColorCol}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None</SelectItem>
                    {validCols.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showSizeCol && (
              <div>
                <Label className="text-xs">Bubble Size</Label>
                <Select value={sizeCol} onValueChange={setSizeCol}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None</SelectItem>
                    {numericCols.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showSort && (
              <div>
                <Label className="text-xs">Sort</Label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Default</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Filter + Title row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <div>
              <Label className="text-xs flex items-center gap-1"><Filter className="w-3 h-3" /> Filter Column</Label>
              <Select value={filterCol} onValueChange={setFilterCol}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No filter</SelectItem>
                  {validCols.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {filterCol !== "__none__" && (
              <div>
                <Label className="text-xs">Filter Value (contains)</Label>
                <Input className="mt-1 h-8 text-xs" placeholder="Filter..." value={filterVal} onChange={e => setFilterVal(e.target.value)} />
              </div>
            )}
            <div>
              <Label className="text-xs">Chart Title</Label>
              <Input className="mt-1 h-8 text-xs" placeholder="My Chart..." value={chartTitle} onChange={e => setChartTitle(e.target.value)} />
            </div>
          </div>

          {chartTitle && <h3 className="text-sm font-bold text-center text-foreground mb-2">{chartTitle}</h3>}

          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Badge variant="outline">{isStackedWithSeries ? chartData.data.length : (chartData?.length ?? 0)} data points</Badge>
            <span>·</span>
            <span>{chartType}</span>
            {filterCol !== "__none__" && filterVal && (
              <><span>·</span><Badge variant="secondary">Filtered: {filterCol} contains "{filterVal}"</Badge></>
            )}
            <Button size="sm" variant="outline" className="ml-auto text-xs h-7" onClick={saveChart}>
              <BookmarkPlus className="w-3.5 h-3.5 mr-1" /> Save Chart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}