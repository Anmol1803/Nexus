import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTransformationHistory } from "@/lib/TransformationHistory";

const FUNCTIONS = [
  { name: "IF", sig: "IF(condition, value_if_true, value_if_false)", cat: "Logical", desc: "Conditional evaluation" },
  { name: "IFS", sig: "IFS(cond1, val1, cond2, val2, ...)", cat: "Logical", desc: "Multiple conditions" },
  { name: "AND", sig: "AND(cond1, cond2, ...)", cat: "Logical", desc: "All conditions must be true" },
  { name: "OR", sig: "OR(cond1, cond2, ...)", cat: "Logical", desc: "Any condition must be true" },
  { name: "NOT", sig: "NOT(condition)", cat: "Logical", desc: "Negate a condition" },
  { name: "CONCAT", sig: "CONCAT(text1, text2, ...)", cat: "Text", desc: "Join text values" },
  { name: "TEXTJOIN", sig: "TEXTJOIN(separator, text1, text2, ...)", cat: "Text", desc: "Join with separator" },
  { name: "LEFT", sig: "LEFT(text, n)", cat: "Text", desc: "First N characters" },
  { name: "RIGHT", sig: "RIGHT(text, n)", cat: "Text", desc: "Last N characters" },
  { name: "MID", sig: "MID(text, start, length)", cat: "Text", desc: "Substring" },
  { name: "TRIM", sig: "TRIM(text)", cat: "Text", desc: "Remove extra spaces" },
  { name: "UPPER", sig: "UPPER(text)", cat: "Text", desc: "Convert to uppercase" },
  { name: "LOWER", sig: "LOWER(text)", cat: "Text", desc: "Convert to lowercase" },
  { name: "PROPER", sig: "PROPER(text)", cat: "Text", desc: "Title case" },
  { name: "LEN", sig: "LEN(text)", cat: "Text", desc: "String length" },
  { name: "REPLACE", sig: "REPLACE(text, find, replace)", cat: "Text", desc: "Find and replace" },
  { name: "SUM", sig: "SUM(col1, col2, ...)", cat: "Math", desc: "Sum of values" },
  { name: "ROUND", sig: "ROUND(number, decimals)", cat: "Math", desc: "Round to N decimals" },
  { name: "ABS", sig: "ABS(number)", cat: "Math", desc: "Absolute value" },
  { name: "CEILING", sig: "CEILING(number)", cat: "Math", desc: "Round up" },
  { name: "FLOOR", sig: "FLOOR(number)", cat: "Math", desc: "Round down" },
  { name: "MOD", sig: "MOD(number, divisor)", cat: "Math", desc: "Remainder" },
  { name: "SQRT", sig: "SQRT(number)", cat: "Math", desc: "Square root" },
  { name: "POWER", sig: "POWER(base, exponent)", cat: "Math", desc: "Exponentiation" },
  { name: "LOG", sig: "LOG(number)", cat: "Math", desc: "Natural logarithm" },
  { name: "YEAR", sig: "YEAR(date)", cat: "Date", desc: "Extract year" },
  { name: "MONTH", sig: "MONTH(date)", cat: "Date", desc: "Extract month (1-12)" },
  { name: "DAY", sig: "DAY(date)", cat: "Date", desc: "Extract day" },
  { name: "WEEKDAY", sig: "WEEKDAY(date)", cat: "Date", desc: "Day of week name" },
  { name: "DATEDIFF", sig: "DATEDIFF(date1, date2, unit)", cat: "Date", desc: "Difference between dates (days/months/years)" },
  { name: "AVG", sig: "AVG(col1, col2, ...)", cat: "Statistical", desc: "Average of values" },
  { name: "MEDIAN", sig: "MEDIAN(col)", cat: "Statistical", desc: "Median value" },
  { name: "MIN", sig: "MIN(col1, col2, ...)", cat: "Statistical", desc: "Minimum value" },
  { name: "MAX", sig: "MAX(col1, col2, ...)", cat: "Statistical", desc: "Maximum value" },
  { name: "COUNT", sig: "COUNT(col)", cat: "Statistical", desc: "Count non-empty values" },
  { name: "COALESCE", sig: "COALESCE(val1, val2, ...)", cat: "Logical", desc: "First non-empty value" },
  { name: "ISNULL", sig: "ISNULL(value)", cat: "Logical", desc: "Check if value is empty" },
  { name: "ISNUMBER", sig: "ISNUMBER(value)", cat: "Logical", desc: "Check if value is numeric" },
];

const CATS = ["Logical", "Text", "Math", "Date", "Statistical"];

function evalFormula(formula, row, columns) {
  // Replace column references with values
  let expr = formula;
  
  // Sort columns by length desc to avoid partial replacement
  const sortedCols = [...columns].sort((a, b) => b.length - a.length);
  sortedCols.forEach(col => {
    const val = row[col];
    const num = Number(val);
    const replacement = !isNaN(num) && val !== "" && val !== null && val !== undefined
      ? String(num)
      : `"${String(val ?? "").replace(/"/g, '\\"')}"`;
    expr = expr.replace(new RegExp(`\\b${col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), replacement);
  });

  // Replace formula functions with JS equivalents
  expr = expr
    .replace(/\bIF\s*\(/gi, '__IF(')
    .replace(/\bIFS\s*\(/gi, '__IFS(')
    .replace(/\bAND\s*\(/gi, '__AND(')
    .replace(/\bOR\s*\(/gi, '__OR(')
    .replace(/\bNOT\s*\(/gi, '__NOT(')
    .replace(/\bCONCAT\s*\(/gi, '__CONCAT(')
    .replace(/\bTEXTJOIN\s*\(/gi, '__TEXTJOIN(')
    .replace(/\bLEFT\s*\(/gi, '__LEFT(')
    .replace(/\bRIGHT\s*\(/gi, '__RIGHT(')
    .replace(/\bMID\s*\(/gi, '__MID(')
    .replace(/\bTRIM\s*\(/gi, '__TRIM(')
    .replace(/\bUPPER\s*\(/gi, '__UPPER(')
    .replace(/\bLOWER\s*\(/gi, '__LOWER(')
    .replace(/\bPROPER\s*\(/gi, '__PROPER(')
    .replace(/\bLEN\s*\(/gi, '__LEN(')
    .replace(/\bREPLACE\s*\(/gi, '__REPLACE(')
    .replace(/\bROUND\s*\(/gi, '__ROUND(')
    .replace(/\bABS\s*\(/gi, '__ABS(')
    .replace(/\bCEILING\s*\(/gi, '__CEILING(')
    .replace(/\bFLOOR\s*\(/gi, '__FLOOR(')
    .replace(/\bMOD\s*\(/gi, '__MOD(')
    .replace(/\bSQRT\s*\(/gi, '__SQRT(')
    .replace(/\bPOWER\s*\(/gi, '__POWER(')
    .replace(/\bLOG\s*\(/gi, '__LOG(')
    .replace(/\bYEAR\s*\(/gi, '__YEAR(')
    .replace(/\bMONTH\s*\(/gi, '__MONTH(')
    .replace(/\bDAY\s*\(/gi, '__DAY(')
    .replace(/\bWEEKDAY\s*\(/gi, '__WEEKDAY(')
    .replace(/\bDATEDIFF\s*\(/gi, '__DATEDIFF(')
    .replace(/\bAVG\s*\(/gi, '__AVG(')
    .replace(/\bMEDIAN\s*\(/gi, '__MEDIAN(')
    .replace(/\bMIN\s*\(/gi, '__MIN(')
    .replace(/\bMAX\s*\(/gi, '__MAX(')
    .replace(/\bCOUNT\s*\(/gi, '__COUNT(')
    .replace(/\bCOALESCE\s*\(/gi, '__COALESCE(')
    .replace(/\bISNULL\s*\(/gi, '__ISNULL(')
    .replace(/\bISNUMBER\s*\(/gi, '__ISNUMBER(')
    .replace(/\bSUM\s*\(/gi, '__SUM(');

  const helpers = {
    __IF: (cond, t, f) => cond ? t : f,
    __IFS: (...args) => { for (let i = 0; i < args.length - 1; i += 2) if (args[i]) return args[i + 1]; return null; },
    __AND: (...args) => args.every(Boolean),
    __OR: (...args) => args.some(Boolean),
    __NOT: (v) => !v,
    __CONCAT: (...args) => args.map(a => a ?? "").join(""),
    __TEXTJOIN: (sep, ...args) => args.map(a => a ?? "").join(sep),
    __LEFT: (s, n) => String(s ?? "").slice(0, n),
    __RIGHT: (s, n) => String(s ?? "").slice(-n),
    __MID: (s, start, len) => String(s ?? "").slice(start - 1, start - 1 + len),
    __TRIM: (s) => String(s ?? "").trim(),
    __UPPER: (s) => String(s ?? "").toUpperCase(),
    __LOWER: (s) => String(s ?? "").toLowerCase(),
    __PROPER: (s) => String(s ?? "").replace(/\b\w/g, c => c.toUpperCase()),
    __LEN: (s) => String(s ?? "").length,
    __REPLACE: (s, f, r) => String(s ?? "").split(f).join(r),
    __ROUND: (n, d = 0) => Number(Number(n).toFixed(d)),
    __ABS: (n) => Math.abs(Number(n)),
    __CEILING: (n) => Math.ceil(Number(n)),
    __FLOOR: (n) => Math.floor(Number(n)),
    __MOD: (n, d) => Number(n) % Number(d),
    __SQRT: (n) => Math.sqrt(Number(n)),
    __POWER: (b, e) => Math.pow(Number(b), Number(e)),
    __LOG: (n) => Math.log(Number(n)),
    __YEAR: (d) => new Date(d).getFullYear(),
    __MONTH: (d) => new Date(d).getMonth() + 1,
    __DAY: (d) => new Date(d).getDate(),
    __WEEKDAY: (d) => new Date(d).toLocaleString("default", { weekday: "long" }),
    __DATEDIFF: (d1, d2, unit = "days") => {
      const diff = new Date(d1) - new Date(d2);
      if (unit === "days") return Math.round(diff / 86400000);
      if (unit === "months") return Math.round(diff / (86400000 * 30.44));
      if (unit === "years") return Math.round(diff / (86400000 * 365.25));
      return diff;
    },
    __AVG: (...args) => { const nums = args.map(Number).filter(n => !isNaN(n)); return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; },
    __MEDIAN: (...args) => { const s = args.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b); return s.length ? (s.length % 2 === 0 ? (s[s.length/2-1]+s[s.length/2])/2 : s[Math.floor(s.length/2)]) : null; },
    __MIN: (...args) => Math.min(...args.map(Number).filter(n => !isNaN(n))),
    __MAX: (...args) => Math.max(...args.map(Number).filter(n => !isNaN(n))),
    __SUM: (...args) => args.map(Number).filter(n => !isNaN(n)).reduce((a, b) => a + b, 0),
    __COUNT: (...args) => args.filter(a => a !== null && a !== undefined && a !== "").length,
    __COALESCE: (...args) => args.find(a => a !== null && a !== undefined && a !== "") ?? null,
    __ISNULL: (v) => v === null || v === undefined || v === "",
    __ISNUMBER: (v) => !isNaN(Number(v)) && v !== "" && v !== null && v !== undefined,
  };

  // eslint-disable-next-line no-new-func
  const fn = new Function(...Object.keys(helpers), `"use strict"; return (${expr});`);
  return fn(...Object.values(helpers));
}

export default function FormulaEngine({ data, columns, setData, setColumns }) {
  const { addEntry } = useTransformationHistory();
  const [formula, setFormula] = useState("");
  const [newColName, setNewColName] = useState("");
  const [hint, setHint] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showFnList, setShowFnList] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Logical");
  const inputRef = useRef(null);

  const preview = useMemo(() => {
    if (!formula) return [];
    return data.slice(0, 5).map(row => {
      try { return { value: evalFormula(formula, row, columns), error: false }; }
      catch (e) { return { value: e.message, error: true }; }
    });
  }, [formula, data, columns]);

  const handleFormulaChange = (val) => {
    setFormula(val);
    // Detect function being typed
    const match = val.match(/([A-Z_]+)\s*\($/i);
    if (match) {
      const fn = FUNCTIONS.find(f => f.name === match[1].toUpperCase());
      setHint(fn || null);
    } else {
      setHint(null);
    }
    // Autocomplete suggestions
    const word = val.match(/([A-Z_]{2,})$/i)?.[1]?.toUpperCase();
    if (word && word.length >= 2) {
      setSuggestions(FUNCTIONS.filter(f => f.name.startsWith(word)).slice(0, 6));
    } else {
      setSuggestions([]);
    }
  };

  const applySuggestion = (fn) => {
    const word = formula.match(/([A-Z_]+)$/i)?.[1] || "";
    const newFormula = formula.slice(0, formula.length - word.length) + fn.name + "(";
    setFormula(newFormula);
    setSuggestions([]);
    setHint(fn);
    inputRef.current?.focus();
  };

  const applyFormula = () => {
    const colName = newColName.trim() || "formula_result";
    if (columns.includes(colName)) { toast.error(`Column "${colName}" already exists`); return; }
    let errorCount = 0;
    const newData = data.map(row => {
      try { return { ...row, [colName]: evalFormula(formula, row, columns) }; }
      catch { errorCount++; return { ...row, [colName]: null }; }
    });
    setData(newData);
    setColumns(prev => [...prev, colName]);
    addEntry({ source: "formula", description: `Formula: ${formula.slice(0, 60)} → "${colName}"`, detail: errorCount > 0 ? `${errorCount} errors → null` : "All rows computed successfully", snapshot: { data: data.map(r => ({ ...r })), columns: [...columns] } });
    toast.success(`Created column "${colName}"${errorCount > 0 ? ` (${errorCount} errors → null)` : ""}`);
    setFormula("");
    setNewColName("");
    setHint(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Formula Builder
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Excel-style formulas — use column names directly. e.g. <code className="bg-muted px-1 rounded text-[10px]">IF(Sales &gt; 1000, "High", "Low")</code>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Column name */}
        <div>
          <Label className="text-xs">New Column Name</Label>
          <Input className="mt-1 text-xs" placeholder="formula_result" value={newColName} onChange={e => setNewColName(e.target.value)} />
        </div>

        {/* Formula input */}
        <div className="relative">
          <Label className="text-xs">Formula</Label>
          <Input
            ref={inputRef}
            className="mt-1 text-xs font-mono"
            placeholder='e.g. IF(Age > 18, "Adult", "Minor")'
            value={formula}
            onChange={e => handleFormulaChange(e.target.value)}
          />
          {/* Hint bar */}
          {hint && (
            <div className="mt-1 px-2 py-1.5 bg-accent rounded-md text-[10px] font-mono text-accent-foreground">
              <span className="font-bold text-primary">{hint.name}</span>
              <span className="text-muted-foreground"> — {hint.desc}</span>
              <div className="mt-0.5 text-foreground">{hint.sig}</div>
            </div>
          )}
          {/* Autocomplete */}
          {suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              {suggestions.map(fn => (
                <button
                  key={fn.name}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted text-xs"
                  onMouseDown={e => { e.preventDefault(); applySuggestion(fn); }}
                >
                  <span className="font-mono font-bold text-primary">{fn.name}</span>
                  <span className="text-muted-foreground text-[10px]">{fn.desc}</span>
                  <Badge variant="outline" className="ml-auto text-[9px]">{fn.cat}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Available columns */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">Available columns (click to insert):</p>
          <div className="flex flex-wrap gap-1">
            {columns.filter(c => c !== "").map(col => (
              <button
                key={col}
                onClick={() => { setFormula(f => f + col); inputRef.current?.focus(); }}
                className="px-2 py-0.5 text-[10px] bg-muted rounded border border-border hover:bg-primary/10 hover:border-primary/40 font-mono transition-colors"
              >
                {col}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {preview.length > 0 && formula && (
          <div className="bg-muted/50 rounded-lg p-2 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Preview (first 5 rows)</p>
            {preview.map((p, i) => (
              <div key={i} className={`text-xs font-mono px-1 ${p.error ? "text-destructive" : "text-foreground"}`}>
                Row {i + 1}: {p.error ? `Error: ${String(p.value).slice(0, 60)}` : String(p.value ?? "(null)")}
              </div>
            ))}
          </div>
        )}

        <Button onClick={applyFormula} disabled={!formula} size="sm" className="w-full">
          <Zap className="w-3.5 h-3.5 mr-1.5" /> Create Column
        </Button>

        {/* Function reference toggle */}
        <button
          className="w-full flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground pt-1 border-t border-border"
          onClick={() => setShowFnList(v => !v)}
        >
          {showFnList ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Function reference ({FUNCTIONS.length} functions)
        </button>

        {showFnList && (
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              {CATS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] border ${activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {FUNCTIONS.filter(f => f.cat === activeCategory).map(fn => (
                <button
                  key={fn.name}
                  className="w-full flex items-start gap-3 px-2 py-1.5 rounded hover:bg-muted text-left"
                  onClick={() => applySuggestion(fn)}
                >
                  <span className="font-mono font-bold text-primary text-[11px] shrink-0">{fn.name}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{fn.sig}</p>
                    <p className="text-[9px] text-muted-foreground">{fn.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}