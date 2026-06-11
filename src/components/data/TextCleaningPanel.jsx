import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Type, Replace, Tag, Shuffle, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useTransformationHistory } from "@/lib/TransformationHistory";

export default function TextCleaningPanel({ data, columns, setData }) {
  const { addEntry } = useTransformationHistory();
  // Case conversion
  const [caseCol, setCaseCol] = useState(columns[0] || "");
  const [caseMode, setCaseMode] = useState("lower");

  // Regex find/replace
  const [regexCol, setRegexCol] = useState("__all__");
  const [regexPattern, setRegexPattern] = useState("");
  const [regexReplace, setRegexReplace] = useState("");
  const [regexFlags, setRegexFlags] = useState("gi");
  const [regexError, setRegexError] = useState("");

  // Value standardization
  const [stdCol, setStdCol] = useState(columns[0] || "");
  const [mappings, setMappings] = useState([{ from: "", to: "" }]);

  // Auto-detect categorical cols for standardization
  const categoricalCols = useMemo(() => {
    return columns.filter(col => {
      const vals = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
      const numCount = vals.filter(v => !isNaN(Number(v))).length;
      return vals.length > 0 && numCount / vals.length <= 0.5;
    });
  }, [data, columns]);

  const uniqueValsForStd = useMemo(() => {
    if (!stdCol) return [];
    const counts = {};
    data.forEach(row => {
      const v = row[stdCol];
      if (v !== "" && v !== null && v !== undefined) counts[String(v)] = (counts[String(v)] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [data, stdCol]);

  const applyCase = () => {
    const snapshot = data.map(r => ({ ...r }));
    const transform = { lower: s => s.toLowerCase(), upper: s => s.toUpperCase(), title: s => s.replace(/\b\w/g, c => c.toUpperCase()) };
    const fn = transform[caseMode];
    const newData = data.map(row => ({
      ...row,
      [caseCol]: typeof row[caseCol] === "string" ? fn(row[caseCol]) : row[caseCol]
    }));
    setData(newData);
    addEntry({ source: "text", description: `Case: ${caseMode} on "${caseCol}"`, detail: `Applied ${caseMode} case conversion`, snapshot: { data: snapshot } });
    toast.success(`Applied ${caseMode}case to "${caseCol}"`);
  };

  const applyRegex = () => {
    setRegexError("");
    let re;
    try { re = new RegExp(regexPattern, regexFlags); } catch (e) { setRegexError(e.message); return; }

    const cols = regexCol === "__all__" ? columns : [regexCol];
    const newData = data.map(row => {
      const newRow = { ...row };
      cols.forEach(col => {
        if (typeof newRow[col] === "string") newRow[col] = newRow[col].replace(re, regexReplace);
      });
      return newRow;
    });
    addEntry({ source: "text", description: `Regex /${regexPattern}/ → "${regexReplace}"`, detail: `Applied to ${regexCol === "__all__" ? "all columns" : `"${regexCol}"`}`, snapshot: { data: data.map(r => ({ ...r })) } });
    setData(newData);
    toast.success(`Regex replace applied to ${regexCol === "__all__" ? "all columns" : `"${regexCol}"`}`);
  };

  const applyStandardize = () => {
    const validMappings = mappings.filter(m => m.from.trim());
    if (validMappings.length === 0) { toast.error("Add at least one mapping"); return; }
    const map = {};
    validMappings.forEach(m => { map[m.from.trim()] = m.to.trim(); });
    let count = 0;
    const newData = data.map(row => {
      const v = row[stdCol];
      if (v !== null && v !== undefined && map[String(v)] !== undefined) {
        count++;
        return { ...row, [stdCol]: map[String(v)] };
      }
      return row;
    });
    addEntry({ source: "text", description: `Standardize values in "${stdCol}"`, detail: `${count} values remapped`, rowsAffected: count, snapshot: { data: data.map(r => ({ ...r })) } });
    setData(newData);
    toast.success(`Standardized ${count} values in "${stdCol}"`);
  };

  const addMapping = () => setMappings(prev => [...prev, { from: "", to: "" }]);
  const removeMapping = (i) => setMappings(prev => prev.filter((_, idx) => idx !== i));
  const updateMapping = (i, field, val) => setMappings(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  const autoLoadTopValues = () => {
    const top = uniqueValsForStd.slice(0, 5).map(([v]) => ({ from: v, to: "" }));
    setMappings(top.length > 0 ? top : [{ from: "", to: "" }]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Case Conversion */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" /> Case Conversion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Column</Label>
              <Select value={caseCol} onValueChange={setCaseCol}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                  </Select>
                  </div>
                  <div>
                  <Label className="text-xs">Convert To</Label>
              <Select value={caseMode} onValueChange={setCaseMode}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lower">lowercase</SelectItem>
                  <SelectItem value="upper">UPPERCASE</SelectItem>
                  <SelectItem value="title">Title Case</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-xs font-mono space-y-1">
              {data.slice(0, 4).map((row, i) => {
                const v = row[caseCol];
                const t = typeof v === "string"
                  ? caseMode === "lower" ? v.toLowerCase()
                  : caseMode === "upper" ? v.toUpperCase()
                  : v.replace(/\b\w/g, c => c.toUpperCase())
                  : v;
                return <div key={i} className="flex gap-2"><span className="text-muted-foreground truncate w-24">{String(v ?? "")}</span><span>→</span><span className="text-foreground truncate">{String(t ?? "")}</span></div>;
              })}
            </div>
            <Button onClick={applyCase} size="sm" className="w-full">Apply Case Conversion</Button>
          </CardContent>
        </Card>

        {/* Regex Find & Replace */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Replace className="w-4 h-4 text-primary" /> Regex Find & Replace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Apply To</Label>
              <Select value={regexCol} onValueChange={setRegexCol}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Columns</SelectItem>
                  {columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Regex Pattern</Label>
              <Input className="mt-1 font-mono text-xs" placeholder="e.g. \s+|[^a-zA-Z0-9]|\d+" value={regexPattern} onChange={e => { setRegexPattern(e.target.value); setRegexError(""); }} />
            </div>
            <div>
              <Label className="text-xs">Replace With</Label>
              <Input className="mt-1 font-mono text-xs" placeholder="e.g. _ or (empty to delete)" value={regexReplace} onChange={e => setRegexReplace(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Flags</Label>
              <Select value={regexFlags} onValueChange={setRegexFlags}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">g — global</SelectItem>
                  <SelectItem value="gi">gi — global + case insensitive</SelectItem>
                  <SelectItem value="i">i — case insensitive (first only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {regexError && <p className="text-xs text-destructive">Invalid regex: {regexError}</p>}
            <Button onClick={applyRegex} size="sm" className="w-full" disabled={!regexPattern}>Apply Regex Replace</Button>
          </CardContent>
        </Card>
      </div>

      {/* Value Standardization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-primary" /> Categorical Value Standardization
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Map inconsistent values to a standard form (e.g. "USA", "U.S.A" → "United States")</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Column</Label>
                <Select value={stdCol} onValueChange={val => { setStdCol(val); setMappings([{ from: "", to: "" }]); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(categoricalCols.length > 0 ? categoricalCols : columns).filter(c => c !== "").map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Value Mappings</Label>
                  <div className="flex gap-2">
                    <button onClick={autoLoadTopValues} className="text-[10px] text-primary hover:underline">Load top values</button>
                    <button onClick={addMapping} className="text-[10px] text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add row</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {mappings.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="text-xs h-7" placeholder="From value..." value={m.from} onChange={e => updateMapping(i, "from", e.target.value)} />
                      <span className="text-muted-foreground text-xs shrink-0">→</span>
                      <Input className="text-xs h-7" placeholder="To value..." value={m.to} onChange={e => updateMapping(i, "to", e.target.value)} />
                      <button onClick={() => removeMapping(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={applyStandardize} size="sm" className="w-full">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Apply Standardization
              </Button>
            </div>

            {/* Existing values */}
            <div>
              <Label className="text-xs mb-2 block">Existing Values in "{stdCol}"</Label>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {uniqueValsForStd.map(([val, count]) => (
                  <div key={val} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/50 gap-2">
                    <span className="text-xs font-mono truncate flex-1">{val}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{count}</Badge>
                    <button
                      onClick={() => setMappings(prev => [...prev.filter(m => m.from !== val), { from: val, to: "" }])}
                      className="text-[10px] text-primary hover:underline shrink-0"
                    >map</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}