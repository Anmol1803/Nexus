import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, GitMerge, ToggleLeft } from "lucide-react";
import FormulaEngine from "./FormulaEngine";
import { toast } from "sonner";
import { useTransformationHistory } from "@/lib/TransformationHistory";

function inferType(values) {
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "text";
  const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  return numCount / nonEmpty.length > 0.8 ? "numeric" : "categorical";
}

export default function FeatureEngineeringPanel({ data, columns, setData, setColumns }) {
  const { addEntry } = useTransformationHistory();
  const numericCols = useMemo(() => columns.filter(c => inferType(data.map(r => r[c])) === "numeric"), [data, columns]);
  const textCols = useMemo(() => columns.filter(c => inferType(data.map(r => r[c])) === "categorical"), [data, columns]);

  // Math operation
  const [mathColA, setMathColA] = useState(numericCols[0] || "");
  const [mathOp, setMathOp] = useState("+");
  const [mathColB, setMathColB] = useState(numericCols[1] || numericCols[0] || "");
  const [mathConstant, setMathConstant] = useState("");
  const [mathMode, setMathMode] = useState("col"); // "col" | "const"
  const [mathNewCol, setMathNewCol] = useState("");

  // Conditional
  const [condCol, setCondCol] = useState(numericCols[0] || columns[0] || "");
  const [condOp, setCondOp] = useState(">");
  const [condVal, setCondVal] = useState("");
  const [condThen, setCondThen] = useState("High");
  const [condElse, setCondElse] = useState("Low");
  const [condNewCol, setCondNewCol] = useState("");

  // Concatenate
  const [concatCols, setConcatCols] = useState(textCols.slice(0, 2).map(c => c) || []);
  const [concatSep, setConcatSep] = useState(" ");
  const [concatNewCol, setConcatNewCol] = useState("");

  const mathPreview = useMemo(() => {
    return data.slice(0, 4).map(row => {
      const a = Number(row[mathColA]);
      const b = mathMode === "col" ? Number(row[mathColB]) : Number(mathConstant);
      if (isNaN(a) || isNaN(b)) return null;
      switch (mathOp) {
        case "+": return (a + b).toFixed(4);
        case "-": return (a - b).toFixed(4);
        case "*": return (a * b).toFixed(4);
        case "/": return b === 0 ? "÷0" : (a / b).toFixed(4);
        case "%": return b === 0 ? "mod0" : (a % b).toFixed(4);
        case "**": return (a ** b).toFixed(4);
        default: return null;
      }
    });
  }, [data, mathColA, mathColB, mathOp, mathMode, mathConstant]);

  const applyMath = () => {
    const newColName = mathNewCol.trim() || `${mathColA}_${mathOp}_${mathMode === "col" ? mathColB : mathConstant}`;
    if (columns.includes(newColName)) { toast.error("Column already exists"); return; }
    const newData = data.map(row => {
      const a = Number(row[mathColA]);
      const b = mathMode === "col" ? Number(row[mathColB]) : Number(mathConstant);
      let result = null;
      if (!isNaN(a) && !isNaN(b)) {
        switch (mathOp) {
          case "+": result = a + b; break;
          case "-": result = a - b; break;
          case "*": result = a * b; break;
          case "/": result = b !== 0 ? a / b : null; break;
          case "%": result = b !== 0 ? a % b : null; break;
          case "**": result = a ** b; break;
        }
      }
      return { ...row, [newColName]: result !== null ? Number(result.toFixed(6)) : null };
    });
    setData(newData);
    setColumns(prev => [...prev, newColName]);
    addEntry({ source: "feature", description: `Math: ${mathColA} ${mathOp} ${mathMode === "col" ? mathColB : mathConstant} → "${newColName}"`, detail: "Arithmetic column created", snapshot: { data: data.map(r => ({ ...r })), columns: [...columns] } });
    toast.success(`Created column "${newColName}"`);
    setMathNewCol("");
  };

  const condPreview = useMemo(() => {
    return data.slice(0, 4).map(row => {
      const v = row[condCol];
      const num = Number(v);
      const comparator = isNaN(num) ? String(v) : num;
      const threshold = isNaN(Number(condVal)) ? condVal : Number(condVal);
      let passes = false;
      switch (condOp) {
        case ">": passes = comparator > threshold; break;
        case ">=": passes = comparator >= threshold; break;
        case "<": passes = comparator < threshold; break;
        case "<=": passes = comparator <= threshold; break;
        case "==": passes = String(comparator) === String(threshold); break;
        case "!=": passes = String(comparator) !== String(threshold); break;
      }
      return { val: v, result: passes ? condThen : condElse };
    });
  }, [data, condCol, condOp, condVal, condThen, condElse]);

  const applyConditional = () => {
    const newColName = condNewCol.trim() || `${condCol}_flag`;
    if (columns.includes(newColName)) { toast.error("Column already exists"); return; }
    const newData = data.map(row => {
      const v = row[condCol];
      const comparator = isNaN(Number(v)) ? String(v) : Number(v);
      const threshold = isNaN(Number(condVal)) ? condVal : Number(condVal);
      let passes = false;
      switch (condOp) {
        case ">": passes = comparator > threshold; break;
        case ">=": passes = comparator >= threshold; break;
        case "<": passes = comparator < threshold; break;
        case "<=": passes = comparator <= threshold; break;
        case "==": passes = String(comparator) === String(threshold); break;
        case "!=": passes = String(comparator) !== String(threshold); break;
      }
      return { ...row, [newColName]: passes ? condThen : condElse };
    });
    setData(newData);
    setColumns(prev => [...prev, newColName]);
    addEntry({ source: "feature", description: `Conditional: IF ${condCol} ${condOp} ${condVal} → "${newColName}"`, detail: `"${condThen}" / "${condElse}"`, snapshot: { data: data.map(r => ({ ...r })), columns: [...columns] } });
    toast.success(`Created conditional column "${newColName}"`);
    setCondNewCol("");
  };

  const applyConcat = () => {
    if (concatCols.length < 2) { toast.error("Select at least 2 columns"); return; }
    const newColName = concatNewCol.trim() || concatCols.join("_");
    if (columns.includes(newColName)) { toast.error("Column already exists"); return; }
    const newData = data.map(row => ({
      ...row,
      [newColName]: concatCols.map(c => String(row[c] ?? "")).join(concatSep)
    }));
    setData(newData);
    setColumns(prev => [...prev, newColName]);
    addEntry({ source: "feature", description: `Concat: [${concatCols.join(", ")}] → "${newColName}"`, detail: `Separator: "${concatSep}"`, snapshot: { data: data.map(r => ({ ...r })), columns: [...columns] } });
    toast.success(`Created concatenated column "${newColName}"`);
    setConcatNewCol("");
  };

  const toggleConcatCol = (col) => {
    setConcatCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  return (
    <div className="space-y-4">
      {/* Formula Engine - top of the page */}
      <FormulaEngine data={data} columns={columns} setData={setData} setColumns={setColumns} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Math Operation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Math Operation
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Create a new column from arithmetic on existing columns</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <Label className="text-xs">Column A</Label>
                <Select value={mathColA} onValueChange={setMathColA}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Operator</Label>
                <Select value={mathOp} onValueChange={setMathOp}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+">+ (add)</SelectItem>
                    <SelectItem value="-">− (subtract)</SelectItem>
                    <SelectItem value="*">× (multiply)</SelectItem>
                    <SelectItem value="/">÷ (divide)</SelectItem>
                    <SelectItem value="%">% (modulo)</SelectItem>
                    <SelectItem value="**">^ (power)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Operand</Label>
                <Select value={mathMode} onValueChange={setMathMode}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="col">Column B</SelectItem>
                    <SelectItem value="const">Constant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {mathMode === "col" ? (
              <div>
                <Label className="text-xs">Column B</Label>
                <Select value={mathColB} onValueChange={setMathColB}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Constant Value</Label>
                <Input type="number" className="mt-1 text-xs" placeholder="e.g. 100" value={mathConstant} onChange={e => setMathConstant(e.target.value)} />
              </div>
            )}
            <div className="bg-muted/50 rounded-lg p-2 space-y-1">
              {mathPreview.map((v, i) => (
                <div key={i} className="text-xs font-mono text-foreground">{v ?? "(invalid)"}</div>
              ))}
            </div>
            <div>
              <Label className="text-xs">New Column Name</Label>
              <Input className="mt-1 text-xs" placeholder={`${mathColA}_${mathOp}_result`} value={mathNewCol} onChange={e => setMathNewCol(e.target.value)} />
            </div>
            <Button onClick={applyMath} size="sm" className="w-full">Create Column</Button>
          </CardContent>
        </Card>

        {/* Conditional Column */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ToggleLeft className="w-4 h-4 text-primary" /> Conditional Column
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">IF (column op value) THEN "X" ELSE "Y"</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Column</Label>
                <Select value={condCol} onValueChange={setCondCol}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{columns.filter(c => c !== "").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Operator</Label>
                <Select value={condOp} onValueChange={setCondOp}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">"> &gt; greater</SelectItem>
                    <SelectItem value=">=">&gt;= greater/eq</SelectItem>
                    <SelectItem value="<">&lt; less</SelectItem>
                    <SelectItem value="<=">&lt;= less/eq</SelectItem>
                    <SelectItem value="==">== equals</SelectItem>
                    <SelectItem value="!=">!= not equal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Value / Threshold</Label>
                <Input className="mt-1 text-xs" placeholder="e.g. 100" value={condVal} onChange={e => setCondVal(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Then (true)</Label>
                <Input className="mt-1 text-xs" placeholder="High" value={condThen} onChange={e => setCondThen(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Else (false)</Label>
                <Input className="mt-1 text-xs" placeholder="Low" value={condElse} onChange={e => setCondElse(e.target.value)} />
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 space-y-1">
              {condPreview.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-muted-foreground truncate w-20">{String(p.val ?? "")}</span>
                  <span>→</span>
                  <Badge variant="outline" className="text-[10px]">{p.result}</Badge>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs">New Column Name</Label>
              <Input className="mt-1 text-xs" placeholder={`${condCol}_flag`} value={condNewCol} onChange={e => setCondNewCol(e.target.value)} />
            </div>
            <Button onClick={applyConditional} size="sm" className="w-full">Create Conditional Column</Button>
          </CardContent>
        </Card>
      </div>

      {/* Concatenate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary" /> Concatenate Columns
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Combine multiple text columns into a single new column</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="sm:col-span-2">
              <Label className="text-xs mb-2 block">Select Columns to Concatenate (in order)</Label>
              <div className="flex flex-wrap gap-2">
                {columns.map(col => (
                  <button
                    key={col}
                    onClick={() => toggleConcatCol(col)}
                    className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                      concatCols.includes(col)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {col} {concatCols.includes(col) && <span className="ml-1 opacity-70">#{concatCols.indexOf(col) + 1}</span>}
                  </button>
                ))}
              </div>
              {concatCols.length > 0 && (
                <div className="mt-3 bg-muted/50 rounded-lg p-2 space-y-1">
                  {data.slice(0, 3).map((row, i) => (
                    <div key={i} className="text-xs font-mono text-foreground">
                      {concatCols.map(c => String(row[c] ?? "")).join(concatSep || " ")}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Separator</Label>
                <Input className="mt-1 text-xs" placeholder="space, _, -, /" value={concatSep} onChange={e => setConcatSep(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">New Column Name</Label>
                <Input className="mt-1 text-xs" placeholder={concatCols.join("_") || "new_column"} value={concatNewCol} onChange={e => setConcatNewCol(e.target.value)} />
              </div>
              <Button onClick={applyConcat} size="sm" className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Column
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}