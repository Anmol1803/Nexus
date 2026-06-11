import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Scissors, Minus } from "lucide-react";
import { toast } from "sonner";
import { useTransformationHistory } from "@/lib/TransformationHistory";

const COMPONENTS = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month (1–12)" },
  { value: "month_name", label: "Month Name" },
  { value: "day", label: "Day of Month" },
  { value: "weekday", label: "Weekday Name" },
  { value: "hour", label: "Hour" },
  { value: "minute", label: "Minute" },
  { value: "quarter", label: "Quarter" },
];

function extractComponent(dateStr, comp) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  switch (comp) {
    case "year": return d.getFullYear();
    case "month": return d.getMonth() + 1;
    case "month_name": return d.toLocaleString("default", { month: "long" });
    case "day": return d.getDate();
    case "weekday": return d.toLocaleString("default", { weekday: "long" });
    case "hour": return d.getHours();
    case "minute": return d.getMinutes();
    case "quarter": return Math.ceil((d.getMonth() + 1) / 3);
    default: return null;
  }
}

export default function DateTimePanel({ data, columns, setData, setColumns }) {
  const { addEntry } = useTransformationHistory();
  // Detect likely date columns
  const dateCols = useMemo(() => {
    return columns.filter(col => {
      const vals = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
      if (vals.length === 0) return false;
      const dateCount = vals.filter(v => !isNaN(Date.parse(v))).length;
      return dateCount / vals.length > 0.6;
    });
  }, [data, columns]);

  const [parseCol, setParseCol] = useState(dateCols[0] || columns[0] || "");
  const [parseFormat, setParseFormat] = useState("auto");

  const [extractCol, setExtractCol] = useState(dateCols[0] || columns[0] || "");
  const [extractComp, setExtractComp] = useState("year");
  const [extractNewCol, setExtractNewCol] = useState("");

  const [diffCol1, setDiffCol1] = useState(dateCols[0] || columns[0] || "");
  const [diffCol2, setDiffCol2] = useState(dateCols[1] || columns[1] || "");
  const [diffUnit, setDiffUnit] = useState("days");
  const [diffNewCol, setDiffNewCol] = useState("");

  const parsePreview = useMemo(() => {
    return data.slice(0, 5).map(row => {
      const v = row[parseCol];
      if (!v) return { orig: v, parsed: null };
      const d = new Date(v);
      return { orig: v, parsed: isNaN(d.getTime()) ? "INVALID" : d.toISOString().split("T")[0] };
    });
  }, [data, parseCol]);

  const applyParse = () => {
    const newData = data.map(row => {
      const v = row[parseCol];
      if (!v && v !== 0) return row;
      const d = new Date(v);
      return { ...row, [parseCol]: isNaN(d.getTime()) ? null : d.toISOString().split("T")[0] };
    });
    addEntry({ source: "datetime", description: `Parse "${parseCol}" to YYYY-MM-DD`, detail: `Date normalization applied`, snapshot: { data: data.map(r => ({ ...r })) } });
    setData(newData);
    toast.success(`Parsed "${parseCol}" to YYYY-MM-DD`);
  };

  const applyExtract = () => {
    const newColName = extractNewCol.trim() || `${extractCol}_${extractComp}`;
    if (columns.includes(newColName)) { toast.error(`Column "${newColName}" already exists`); return; }
    const newData = data.map(row => ({
      ...row,
      [newColName]: extractComponent(row[extractCol], extractComp)
    }));
    setData(newData);
    setColumns(prev => [...prev, newColName]);
    addEntry({ source: "datetime", description: `Extract ${extractComp} from "${extractCol}" → "${newColName}"`, detail: `New column added`, snapshot: { data: data.map(r => ({ ...r })), columns: [...columns] } });
    toast.success(`Extracted "${extractComp}" from "${extractCol}" → new column "${newColName}"`);
    setExtractNewCol("");
  };

  const applyDiff = () => {
    const unitDiv = { days: 86400000, hours: 3600000, minutes: 60000 };
    const newColName = diffNewCol.trim() || `${diffCol1}_minus_${diffCol2}_${diffUnit}`;
    if (columns.includes(newColName)) { toast.error(`Column "${newColName}" already exists`); return; }
    const newData = data.map(row => {
      const d1 = new Date(row[diffCol1]);
      const d2 = new Date(row[diffCol2]);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return { ...row, [newColName]: null };
      return { ...row, [newColName]: ((d1 - d2) / unitDiv[diffUnit]).toFixed(2) };
    });
    setData(newData);
    setColumns(prev => [...prev, newColName]);
    addEntry({ source: "datetime", description: `Date diff: "${diffCol1}" − "${diffCol2}" → "${newColName}"`, detail: `Unit: ${diffUnit}`, snapshot: { data: data.map(r => ({ ...r })), columns: [...columns] } });
    toast.success(`Calculated date difference → "${newColName}"`);
    setDiffNewCol("");
  };

  return (
    <div className="space-y-4">
      {dateCols.length === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" />
          No date columns auto-detected. You can still manually select any column to parse.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Parse Date */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Parse / Normalize Dates
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Normalize a date column to standard YYYY-MM-DD format</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Column</Label>
              <Select value={parseCol} onValueChange={setParseCol}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c} {dateCols.includes(c) && "📅"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 space-y-1">
              {parsePreview.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-muted-foreground truncate w-28">{String(p.orig ?? "(empty)")}</span>
                  <span>→</span>
                  <span className={p.parsed === "INVALID" ? "text-destructive" : "text-green-700"}>{p.parsed ?? "(empty)"}</span>
                </div>
              ))}
            </div>
            <Button onClick={applyParse} size="sm" className="w-full">Normalize to YYYY-MM-DD</Button>
          </CardContent>
        </Card>

        {/* Extract Component */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" /> Extract Date Component
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Add a new column with extracted year, month, day, etc.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Date Column</Label>
              <Select value={extractCol} onValueChange={setExtractCol}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c} {dateCols.includes(c) && "📅"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Component to Extract</Label>
              <Select value={extractComp} onValueChange={setExtractComp}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPONENTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">New Column Name (optional)</Label>
              <Input className="mt-1 text-xs" placeholder={`${extractCol}_${extractComp}`} value={extractNewCol} onChange={e => setExtractNewCol(e.target.value)} />
            </div>
            <div className="bg-muted/50 rounded-lg p-2 space-y-1">
              {data.slice(0, 4).map((row, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-muted-foreground truncate w-28">{String(row[extractCol] ?? "")}</span>
                  <span>→</span>
                  <span className="text-foreground">{String(extractComponent(row[extractCol], extractComp) ?? "(invalid)")}</span>
                </div>
              ))}
            </div>
            <Button onClick={applyExtract} size="sm" className="w-full">Extract Component</Button>
          </CardContent>
        </Card>
      </div>

      {/* Date Difference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Minus className="w-4 h-4 text-primary" /> Calculate Date Difference
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Create a new column = Column A − Column B in days, hours, or minutes</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Date Column A</Label>
              <Select value={diffCol1} onValueChange={setDiffCol1}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date Column B</Label>
              <Select value={diffCol2} onValueChange={setDiffCol2}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={diffUnit} onValueChange={setDiffUnit}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">New Column Name</Label>
              <Input className="mt-1 text-xs" placeholder={`${diffCol1}_minus_${diffCol2}_days`} value={diffNewCol} onChange={e => setDiffNewCol(e.target.value)} />
            </div>
          </div>
          <Button onClick={applyDiff} size="sm" className="mt-4">
            <Minus className="w-3.5 h-3.5 mr-1.5" /> Calculate Difference
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}