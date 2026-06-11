import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Hash, Type, Calendar, ToggleLeft, AlertTriangle, CheckCircle2, RefreshCw, Percent, Clock, Tag } from "lucide-react";
import { toast } from "sonner";
import { useTransformationHistory } from "@/lib/TransformationHistory";

const TYPE_ICONS = {
  number: Hash,
  float: Hash,
  integer: Hash,
  text: Type,
  category: Tag,
  date: Calendar,
  datetime: Clock,
  boolean: ToggleLeft,
  percentage: Percent,
};

function inferType(values) {
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "text";
  const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  if (numCount / nonEmpty.length > 0.8) return "number";
  const dateCount = nonEmpty.filter(v => !isNaN(Date.parse(v))).length;
  if (dateCount / nonEmpty.length > 0.8) return "date";
  const boolVals = new Set(["true", "false", "yes", "no", "1", "0", "y", "n"]);
  const boolCount = nonEmpty.filter(v => boolVals.has(String(v).toLowerCase())).length;
  if (boolCount / nonEmpty.length > 0.8) return "boolean";
  return "text";
}

function convertValue(val, targetType, onError) {
  if (val === "" || val === null || val === undefined) return val;

  if (targetType === "number" || targetType === "float") {
    const cleaned = String(val).replace(/[$,€£%]/g, "").trim();
    const n = Number(cleaned);
    if (isNaN(n)) {
      if (onError === "null") return null;
      if (onError === "keep") return val;
      return "INVALID";
    }
    return targetType === "float" ? parseFloat(n.toFixed(6)) : n;
  }

  if (targetType === "integer") {
    const cleaned = String(val).replace(/[$,€£%]/g, "").trim();
    const n = parseInt(cleaned, 10);
    if (isNaN(n)) {
      if (onError === "null") return null;
      if (onError === "keep") return val;
      return "INVALID";
    }
    return n;
  }

  if (targetType === "date") {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      if (onError === "null") return null;
      if (onError === "keep") return val;
      return "INVALID";
    }
    return d.toISOString().split("T")[0];
  }

  if (targetType === "datetime") {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      if (onError === "null") return null;
      if (onError === "keep") return val;
      return "INVALID";
    }
    return d.toISOString();
  }

  if (targetType === "boolean") {
    const s = String(val).toLowerCase();
    if (["true", "yes", "1", "y"].includes(s)) return "true";
    if (["false", "no", "0", "n"].includes(s)) return "false";
    if (onError === "null") return null;
    if (onError === "keep") return val;
    return "INVALID";
  }

  if (targetType === "category") {
    return String(val).trim(); // stored as text, but signals low-cardinality
  }

  if (targetType === "percentage") {
    const cleaned = String(val).replace(/%/g, "").trim();
    const n = Number(cleaned);
    if (isNaN(n)) {
      if (onError === "null") return null;
      if (onError === "keep") return val;
      return "INVALID";
    }
    return n <= 1 ? `${(n * 100).toFixed(2)}%` : `${n.toFixed(2)}%`;
  }

  // text / string
  return String(val);
}

export default function TypeConversionPanel({ data, columns, setData, setColumns }) {
  const { addEntry } = useTransformationHistory();
  const [selectedCol, setSelectedCol] = useState(columns[0] || "");
  const [targetType, setTargetType] = useState("number");
  const [onError, setOnError] = useState("null");

  const colTypes = useMemo(() => {
    const result = {};
    columns.forEach(col => {
      result[col] = inferType(data.map(r => r[col]));
    });
    return result;
  }, [data, columns]);

  const preview = useMemo(() => {
    if (!selectedCol) return { errors: 0, valid: 0 };
    let errors = 0, valid = 0;
    data.forEach(row => {
      const v = row[selectedCol];
      if (v === "" || v === null || v === undefined) return;
      const converted = convertValue(v, targetType, "mark");
      if (converted === "INVALID") errors++;
      else valid++;
    });
    return { errors, valid };
  }, [data, selectedCol, targetType]);

  const applyConversion = () => {
    const snapshot = data.map(r => ({ ...r }));
    const newData = data.map(row => ({
      ...row,
      [selectedCol]: convertValue(row[selectedCol], targetType, onError)
    }));
    setData(newData);
    addEntry({ source: "types", description: `Convert "${selectedCol}" → ${targetType}`, detail: `${preview.valid} ok, ${preview.errors} errors (${onError})`, snapshot: { data: snapshot } });
    toast.success(`Converted "${selectedCol}" to ${targetType} (${preview.errors} errors handled)`);
  };

  const IconComp = TYPE_ICONS[targetType] || Type;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversion Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" /> Convert Data Type
            </CardTitle>
            <p className="text-xs text-muted-foreground">Explicitly set the data type for a column</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Column</Label>
              <Select value={selectedCol} onValueChange={setSelectedCol}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.filter(col => col !== "").map(col => (
                    <SelectItem key={col} value={col}>
                      <span className="flex items-center gap-2">{col}
                        <Badge variant="outline" className="text-[10px]">{colTypes[col]}</Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Convert To</Label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="integer">Integer (whole number)</SelectItem>
                  <SelectItem value="float">Float (decimal)</SelectItem>
                  <SelectItem value="number">Number (auto int/float)</SelectItem>
                  <SelectItem value="text">Text (string)</SelectItem>
                  <SelectItem value="category">Category (low-cardinality text)</SelectItem>
                  <SelectItem value="date">Date (YYYY-MM-DD)</SelectItem>
                  <SelectItem value="datetime">DateTime (ISO 8601)</SelectItem>
                  <SelectItem value="boolean">Boolean (true / false)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">On Conversion Error</Label>
              <Select value={onError} onValueChange={setOnError}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Replace with null (empty)</SelectItem>
                  <SelectItem value="keep">Keep original value</SelectItem>
                  <SelectItem value="mark">Mark as INVALID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={applyConversion} className="w-full" size="sm">
              <IconComp className="w-3.5 h-3.5 mr-1.5" />
              Apply Conversion
            </Button>
          </CardContent>
        </Card>

        {/* Preview + Schema */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Conversion Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-green-700">{preview.valid}</p>
                <p className="text-xs text-green-600">Will convert OK</p>
              </div>
              <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <AlertTriangle className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-orange-700">{preview.errors}</p>
                <p className="text-xs text-orange-600">Conversion errors</p>
              </div>
            </div>
            <div className="border border-border rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto">
              {data.slice(0, 8).map((row, i) => {
                const orig = row[selectedCol];
                const converted = convertValue(orig, targetType, onError);
                const isError = converted === "INVALID";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-muted-foreground truncate w-28">{String(orig ?? "(empty)")}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={isError ? "text-destructive font-bold" : "text-foreground"}>
                      {converted === null ? "(null)" : converted === undefined ? "(empty)" : String(converted)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Column Types Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Column Type Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {columns.map(col => {
              const t = colTypes[col];
              const Icon = TYPE_ICONS[t] || Type;
              return (
                <button
                  key={col}
                  onClick={() => setSelectedCol(col)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                    selectedCol === col ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 border-border hover:bg-muted"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">{col}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{t}</Badge>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}