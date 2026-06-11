import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles, Trash2, ArrowDownUp, Copy, Replace,
  AlertTriangle, CheckCircle2, Loader2, Hash, Type,
  ChevronDown, ChevronUp, Info,
  TrendingDown, Eye
} from "lucide-react";
import ColumnEDAPreview from "./ColumnEDAPreview";
import { toast } from "sonner";
import { useTransformationHistory } from "@/lib/TransformationHistory";

function inferType(values) {
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "empty";
  const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  return numCount / nonEmpty.length > 0.8 ? "numeric" : "categorical";
}

function computeFillPreview(col, values) {
  const type = inferType(values);
  const missing = values.filter(v => v === "" || v === null || v === undefined).length;
  if (missing === 0) return null;

  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);

  if (type === "numeric") {
    const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return { method: "custom", value: "0", missing };
    const mean = (nums.reduce((a, b) => a + b, 0) / nums.length);
    const sorted = [...nums].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    // Use mean unless skewed, then median
    const skew = Math.abs(mean - median) / (nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / nums.length) ** 0.5;
    const useMedian = skew > 1;
    return {
      method: useMedian ? "Median" : "Mean",
      value: (useMedian ? median : mean).toFixed(2),
      type: "numeric",
      missing,
    };
  } else {
    const counts = {};
    nonEmpty.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      method: "Mode",
      value: top[0]?.[0] || "Unknown",
      type: "categorical",
      missing,
    };
  }
}

// --- Outlier helpers ---
function getNumericCols(data, columns) {
  return columns.filter(col => {
    const vals = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
    const numCount = vals.filter(v => !isNaN(Number(v))).length;
    return vals.length > 0 && numCount / vals.length > 0.8;
  });
}

function computeOutliers(data, col, method, threshold) {
  const nums = data.map((row, i) => ({ i, v: Number(row[col]) })).filter(x => !isNaN(x.v));
  if (nums.length === 0) return { outlierIndices: new Set(), lower: null, upper: null };

  const values = nums.map(x => x.v);
  let lower, upper;

  if (method === "iqr") {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    lower = q1 - threshold * iqr;
    upper = q3 + threshold * iqr;
  } else {
    // Z-score
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length) || 1;
    lower = mean - threshold * std;
    upper = mean + threshold * std;
  }

  const outlierIndices = new Set(nums.filter(x => x.v < lower || x.v > upper).map(x => x.i));
  return { outlierIndices, lower, upper };
}

export default function CleaningPanel({ data, columns, setData, setColumns }) {
  const { addEntry } = useTransformationHistory();
  const [selectedCol, setSelectedCol] = useState(columns[0] || "");
  const [fillMethod, setFillMethod] = useState("mean");
  const [customValue, setCustomValue] = useState("");
  const [findVal, setFindVal] = useState("");
  const [replaceVal, setReplaceVal] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // Outlier state
  const [outlierCol, setOutlierCol] = useState("");
  const [outlierMethod, setOutlierMethod] = useState("iqr");
  const [outlierThreshold, setOutlierThreshold] = useState("1.5");
  const [outlierAction, setOutlierAction] = useState("remove");

  const numericCols = useMemo(() => getNumericCols(data, columns), [data, columns]);

  // Auto-select first numeric col for outlier panel
  useMemo(() => {
    if (!outlierCol && numericCols.length > 0) setOutlierCol(numericCols[0]);
  }, [numericCols]);

  const outlierPreview = useMemo(() => {
    if (!outlierCol) return null;
    const thresh = parseFloat(outlierThreshold) || (outlierMethod === "iqr" ? 1.5 : 3);
    return computeOutliers(data, outlierCol, outlierMethod, thresh);
  }, [data, outlierCol, outlierMethod, outlierThreshold]);

  const missingByCol = useMemo(() => {
    const result = {};
    columns.forEach(col => {
      result[col] = data.filter(row => row[col] === "" || row[col] === null || row[col] === undefined).length;
    });
    return result;
  }, [data, columns]);

  const totalMissing = Object.values(missingByCol).reduce((a, b) => a + b, 0);

  // Preview what AI/auto fill would do per column
  const fillPreviews = useMemo(() => {
    const previews = {};
    columns.forEach(col => {
      const values = data.map(r => r[col]);
      const preview = computeFillPreview(col, values);
      if (preview) previews[col] = preview;
    });
    return previews;
  }, [data, columns]);

  const addLog = (entry) => {
    addEntry({
      ...entry,
      source: entry.type || "clean",
      description: entry.description,
      detail: entry.detail,
      rowsAffected: entry.filled,
      snapshot: entry.snapshot ? { data: entry.snapshot, columns } : null,
    });
  };

  // Fill missing values for selected column
  const fillMissing = () => {
    if (!selectedCol) return;
    const values = data.map(r => r[selectedCol]);
    const type = inferType(values);
    const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
    const snapshot = data.map(r => ({ ...r }));
    let fillValue = "";
    let methodLabel = "";

    if (fillMethod === "mean" && type === "numeric") {
      const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
      fillValue = String((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
      methodLabel = `Mean (${fillValue})`;
    } else if (fillMethod === "median" && type === "numeric") {
      const nums = nonEmpty.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
      fillValue = String(nums.length % 2 === 0
        ? ((nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2).toFixed(2)
        : nums[Math.floor(nums.length / 2)]);
      methodLabel = `Median (${fillValue})`;
    } else if (fillMethod === "mode") {
      const counts = {};
      nonEmpty.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      fillValue = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      methodLabel = `Mode ("${fillValue}")`;
    } else if (fillMethod === "forward") {
      const newData = data.map(r => ({ ...r }));
      let lastValid = "";
      let filled = 0;
      newData.forEach(row => {
        if (row[selectedCol] !== "" && row[selectedCol] !== null && row[selectedCol] !== undefined) {
          lastValid = row[selectedCol];
        } else { row[selectedCol] = lastValid; filled++; }
      });
      setData(newData);
      addLog({ type: "fill", source: "fill", description: `"${selectedCol}" — Forward Fill`, detail: `Filled ${filled} cells by copying preceding value`, col: selectedCol, snapshot, filled });
      toast.success(`Forward filled "${selectedCol}"`);
      return;
    } else if (fillMethod === "backward") {
      const newData = data.map(r => ({ ...r }));
      let lastValid = "";
      let filled = 0;
      for (let i = newData.length - 1; i >= 0; i--) {
        if (newData[i][selectedCol] !== "" && newData[i][selectedCol] !== null && newData[i][selectedCol] !== undefined) {
          lastValid = newData[i][selectedCol];
        } else { newData[i][selectedCol] = lastValid; filled++; }
      }
      setData(newData);
      addLog({ type: "fill", description: `"${selectedCol}" — Backward Fill`, detail: `Filled ${filled} cells by copying following value`, col: selectedCol, snapshot, filled });
      toast.success(`Backward filled "${selectedCol}"`);
      return;
    } else if (fillMethod === "custom") {
      fillValue = customValue;
      methodLabel = `Custom ("${fillValue}")`;
    } else {
      fillValue = "0";
      methodLabel = `Default (0)`;
    }

    const filled = missingByCol[selectedCol];
    const newData = data.map(row => ({
      ...row,
      [selectedCol]: (row[selectedCol] === "" || row[selectedCol] === null || row[selectedCol] === undefined)
        ? fillValue : row[selectedCol]
    }));
    setData(newData);
    addLog({ type: "fill", description: `"${selectedCol}" — ${methodLabel}`, detail: `Filled ${filled} missing cells`, col: selectedCol, snapshot, filled });
    toast.success(`Filled ${filled} missing values in "${selectedCol}"`);
  };

  // AI-powered fill
  const aiFill = async () => {
    if (totalMissing === 0) { toast.info("No missing values to fill!"); return; }
    setIsAiFilling(true);
    const snapshot = data.map(r => ({ ...r }));

    const colSummary = columns.map(col => {
      const vals = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
      return `${col} (${inferType(data.map(r => r[col]))}): ${vals.slice(0, 8).join(", ")}`;
    }).join("\n");

    const prompt = `You are a data scientist. Given this dataset, determine the best single fill value for each column that has missing data.

Columns with sample values:
${colSummary}

First 10 rows: ${JSON.stringify(data.slice(0, 10), null, 1)}

For each column with missing values, return:
- fill_value: the actual value to fill (string)
- method: the method used (e.g. "Mean", "Median", "Mode", "Constant", "Inferred from context")
- reason: brief explanation (max 10 words)

Only include columns that have missing data: ${columns.filter(c => missingByCol[c] > 0).join(", ")}`;

    const schema = {
      type: "object",
      properties: columns.filter(c => missingByCol[c] > 0).reduce((acc, col) => {
        acc[col] = {
          type: "object",
          properties: {
            fill_value: { type: "string" },
            method: { type: "string" },
            reason: { type: "string" }
          }
        };
        return acc;
      }, {})
    };

    const result = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });

    const newData = data.map(row => {
      const newRow = { ...row };
      columns.forEach(col => {
        if ((newRow[col] === "" || newRow[col] === null || newRow[col] === undefined) && result[col]?.fill_value) {
          newRow[col] = result[col].fill_value;
        }
      });
      return newRow;
    });

    setData(newData);

    // Add one log per filled column
    const filledCols = columns.filter(c => missingByCol[c] > 0 && result[c]);
    filledCols.forEach((col, i) => {
      const info = result[col];
      addLog({
        type: "ai_fill",
        description: `"${col}" — AI: ${info.method || "Smart Fill"}`,
        detail: `Filled ${missingByCol[col]} cells with "${info.fill_value}" · ${info.reason || ""}`,
        col,
        snapshot: i === 0 ? snapshot : null, // only first log has the full snapshot for bulk undo
        filled: missingByCol[col],
        aiMethod: info.method,
        fillValue: info.fill_value,
      });
    });

    // Add a bulk undo entry at top
    addLog({
      type: "ai_bulk",
      description: `AI Smart Fill — ${filledCols.length} columns`,
      detail: `Total ${totalMissing} missing cells filled across ${filledCols.length} columns`,
      snapshot,
      filled: totalMissing,
      isBulk: true,
    });

    setIsAiFilling(false);
    toast.success(`AI filled ${totalMissing} missing values across ${filledCols.length} columns`);
  };

  const removeDuplicates = () => {
    const snapshot = data.map(r => ({ ...r }));
    const seen = new Set();
    const newData = data.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const removed = data.length - newData.length;
    setData(newData);
    addLog({ type: "clean", description: `Remove Duplicates`, detail: `Removed ${removed} duplicate rows`, snapshot });
    toast.success(`Removed ${removed} duplicate rows`);
  };

  const dropMissingRows = () => {
    const snapshot = data.map(r => ({ ...r }));
    const newData = data.filter(row => columns.every(col => row[col] !== "" && row[col] !== null && row[col] !== undefined));
    addLog({ type: "clean", description: `Drop Rows with Missing`, detail: `Removed ${data.length - newData.length} rows`, snapshot });
    toast.success(`Removed ${data.length - newData.length} rows`);
    setData(newData);
  };

  const dropColumn = () => {
    if (!selectedCol) return;
    const snapshot = data.map(r => ({ ...r }));
    const snapCols = [...columns];
    const newCols = columns.filter(c => c !== selectedCol);
    const newData = data.map(row => { const r = { ...row }; delete r[selectedCol]; return r; });
    setColumns(newCols);
    setData(newData);
    setSelectedCol(newCols[0] || "");
    addLog({ type: "clean", description: `Drop Column "${selectedCol}"`, detail: `Column removed permanently`, snapshot, snapCols });
    toast.success(`Dropped column "${selectedCol}"`);
  };

  const handleFindReplace = () => {
    if (!findVal) return;
    const snapshot = data.map(r => ({ ...r }));
    let count = 0;
    const newData = data.map(row => {
      const newRow = { ...row };
      columns.forEach(col => { if (String(newRow[col]) === findVal) { newRow[col] = replaceVal; count++; } });
      return newRow;
    });
    setData(newData);
    addLog({ type: "clean", description: `Find & Replace`, detail: `"${findVal}" → "${replaceVal}" (${count} cells)`, snapshot });
    toast.success(`Replaced ${count} occurrences`);
  };

  const trimWhitespace = () => {
    const snapshot = data.map(r => ({ ...r }));
    const newData = data.map(row => {
      const newRow = {};
      columns.forEach(col => { newRow[col] = typeof row[col] === "string" ? row[col].trim() : row[col]; });
      return newRow;
    });
    setData(newData);
    addLog({ type: "clean", description: `Trim Whitespace`, detail: `Trimmed all string cells`, snapshot });
    toast.success("Trimmed whitespace from all cells");
  };

  // --- Outlier removal ---
  const removeOutliers = () => {
    if (!outlierCol || !outlierPreview) return;
    const { outlierIndices, lower, upper } = outlierPreview;
    if (outlierIndices.size === 0) { toast.info("No outliers found with current settings!"); return; }

    const snapshot = data.map(r => ({ ...r }));
    const thresh = parseFloat(outlierThreshold);

    if (outlierAction === "remove") {
      const newData = data.filter((_, i) => !outlierIndices.has(i));
      setData(newData);
      addLog({
        type: "outlier",
        description: `"${outlierCol}" — Remove Outliers (${outlierMethod.toUpperCase()})`,
        detail: `Removed ${outlierIndices.size} rows · bounds [${lower?.toFixed(2)}, ${upper?.toFixed(2)}] · threshold ${thresh}`,
        col: outlierCol, snapshot, filled: outlierIndices.size,
      });
      toast.success(`Removed ${outlierIndices.size} outlier rows from "${outlierCol}"`);
    } else {
      // Replace with median
      const vals = data.map(r => Number(r[outlierCol])).filter(n => !isNaN(n)).sort((a, b) => a - b);
      const median = vals.length % 2 === 0
        ? (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
        : vals[Math.floor(vals.length / 2)];
      const newData = data.map((row, i) => {
        if (!outlierIndices.has(i)) return row;
        return { ...row, [outlierCol]: String(median.toFixed(2)) };
      });
      setData(newData);
      addLog({
        type: "outlier",
        description: `"${outlierCol}" — Cap Outliers → Median (${outlierMethod.toUpperCase()})`,
        detail: `Replaced ${outlierIndices.size} outliers with median ${median.toFixed(2)} · bounds [${lower?.toFixed(2)}, ${upper?.toFixed(2)}]`,
        col: outlierCol, snapshot, filled: outlierIndices.size,
      });
      toast.success(`Capped ${outlierIndices.size} outliers in "${outlierCol}" with median`);
    }
  };

  const colsWithMissing = columns.filter(col => missingByCol[col] > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Smart Fill Preview */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Auto Fill Preview
              </CardTitle>
              <button onClick={() => setShowPreview(v => !v)} className="text-muted-foreground hover:text-foreground">
                {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              How each column will be filled if you click "AI Smart Fill"
            </p>
          </CardHeader>
          {showPreview && (
            <CardContent className="space-y-2 pt-0">
              {colsWithMissing.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-7 h-7 text-green-500 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No missing values!</p>
                </div>
              ) : (
                colsWithMissing.map(col => {
                  const preview = fillPreviews[col];
                  return (
                    <div key={col} className="flex items-start justify-between p-2.5 rounded-lg bg-muted/50 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {preview?.type === "numeric"
                          ? <Hash className="w-3 h-3 text-primary shrink-0" />
                          : <Type className="w-3 h-3 text-primary shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{col}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {missingByCol[col]} missing
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px] mb-0.5">
                          {preview?.method || "Mode"}
                        </Badge>
                        <p className="text-[10px] font-mono text-foreground truncate max-w-[80px]">
                          → {preview?.value || "?"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          )}
        </Card>

        {/* Manual Fill */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Fill Column Manually</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Column</Label>
              <Select value={selectedCol} onValueChange={setSelectedCol}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.filter(col => col !== "").map(col => (
                    <SelectItem key={col} value={col}>
                      {col} {missingByCol[col] > 0 && `(${missingByCol[col]} missing)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={fillMethod} onValueChange={setFillMethod}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mean">Mean (numeric)</SelectItem>
                  <SelectItem value="median">Median (numeric)</SelectItem>
                  <SelectItem value="mode">Mode (most frequent)</SelectItem>
                  <SelectItem value="forward">Forward Fill</SelectItem>
                  <SelectItem value="backward">Backward Fill</SelectItem>
                  <SelectItem value="custom">Custom Value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fillMethod === "custom" && (
              <Input placeholder="Enter value..." value={customValue} onChange={e => setCustomValue(e.target.value)} />
            )}
            <Button onClick={fillMissing} size="sm" className="w-full">
              Apply Fill to "{selectedCol}"
            </Button>
            {selectedCol && (
              <ColumnEDAPreview col={selectedCol} values={data.map(r => r[selectedCol])} />
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={removeDuplicates}>
              <Copy className="w-3.5 h-3.5 mr-2" /> Remove Duplicates
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={dropMissingRows}>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Drop Rows with Missing
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={trimWhitespace}>
              <ArrowDownUp className="w-3.5 h-3.5 mr-2" /> Trim Whitespace
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-destructive" onClick={dropColumn}>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Drop Column: {selectedCol}
            </Button>
            <div className="border-t border-border pt-3 mt-1">
              <Label className="text-xs font-semibold">Find & Replace</Label>
              <div className="flex gap-2 mt-2">
                <Input placeholder="Find..." value={findVal} onChange={e => setFindVal(e.target.value)} className="text-xs" />
                <Input placeholder="Replace..." value={replaceVal} onChange={e => setReplaceVal(e.target.value)} className="text-xs" />
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleFindReplace}>
                <Replace className="w-3.5 h-3.5 mr-1.5" /> Replace All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outlier Removal */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            Outlier Removal
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Detect and handle outliers in numeric columns using IQR or Z-Score method.
          </p>
        </CardHeader>
        <CardContent>
          {numericCols.length === 0 ? (
            <p className="text-xs text-muted-foreground">No numeric columns detected.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              {/* Column */}
              <div>
                <Label className="text-xs">Numeric Column</Label>
                <Select value={outlierCol} onValueChange={setOutlierCol}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {numericCols.filter(col => col !== "").map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Method */}
              <div>
                <Label className="text-xs">Detection Method</Label>
                <Select value={outlierMethod} onValueChange={setOutlierMethod}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iqr">IQR (Interquartile Range)</SelectItem>
                    <SelectItem value="zscore">Z-Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Threshold */}
              <div>
                <Label className="text-xs">
                  Threshold {outlierMethod === "iqr" ? "(IQR multiplier, default 1.5)" : "(std devs, default 3)"}
                </Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={outlierThreshold}
                  onChange={e => setOutlierThreshold(e.target.value)}
                  placeholder={outlierMethod === "iqr" ? "1.5" : "3"}
                />
              </div>

              {/* Action */}
              <div>
                <Label className="text-xs">Action</Label>
                <Select value={outlierAction} onValueChange={setOutlierAction}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remove">Remove rows</SelectItem>
                    <SelectItem value="cap">Cap with median</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Live preview */}
          {outlierPreview && outlierCol && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
                outlierPreview.outlierIndices.size > 0
                  ? "bg-orange-50 border-orange-200 text-orange-700"
                  : "bg-green-50 border-green-200 text-green-700"
              }`}>
                <Eye className="w-4 h-4" />
                {outlierPreview.outlierIndices.size > 0
                  ? `${outlierPreview.outlierIndices.size} outlier${outlierPreview.outlierIndices.size > 1 ? "s" : ""} detected`
                  : "No outliers detected"}
              </div>
              {outlierPreview.lower !== null && (
                <span className="text-xs text-muted-foreground font-mono">
                  Valid range: [{outlierPreview.lower.toFixed(2)}, {outlierPreview.upper.toFixed(2)}]
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={removeOutliers}
                disabled={outlierPreview.outlierIndices.size === 0}
                className="ml-auto"
              >
                <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                {outlierAction === "remove" ? "Remove Outliers" : "Cap Outliers"} ({outlierPreview.outlierIndices.size})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity log is now in the global History tab */}
    </div>
  );
}