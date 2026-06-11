import React, { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Search, ChevronLeft, ChevronRight,
  ArrowUpDown, PencilLine, Filter, X, Download, Zap, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import EditCellModal from "./EditCellModal";
import AddColumnModal from "./AddColumnModal";

const PAGE_SIZE = 25;

// ---- Column Filter Popover ----
function ColumnFilterPopover({ col, filter, onChange, onClear, data }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Unique values for "equals" quick-pick
  const uniqueVals = useMemo(() => {
    const s = new Set();
    data.forEach(r => { if (r[col] !== "" && r[col] !== null && r[col] !== undefined) s.add(String(r[col])); });
    return [...s].slice(0, 20);
  }, [data, col]);

  const isNumeric = useMemo(() => {
    const nonEmpty = data.map(r => r[col]).filter(v => v !== "" && v !== null && v !== undefined);
    return nonEmpty.length > 0 && nonEmpty.filter(v => !isNaN(Number(v))).length / nonEmpty.length > 0.8;
  }, [data, col]);

  const active = filter && (filter.value !== "" || filter.value2 !== "");

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`ml-1 p-0.5 rounded hover:bg-muted transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
        title="Filter this column"
      >
        <Filter className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 bg-card border border-border rounded-xl shadow-xl p-3 w-56 mt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Filter: {col}</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <Select value={filter?.op || "contains"} onValueChange={v => onChange({ ...filter, op: v, value: filter?.value || "" })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="not_contains">Does not contain</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="not_equals">Not equals</SelectItem>
                <SelectItem value="starts_with">Starts with</SelectItem>
                <SelectItem value="ends_with">Ends with</SelectItem>
                <SelectItem value="is_empty">Is empty</SelectItem>
                <SelectItem value="is_not_empty">Is not empty</SelectItem>
                {isNumeric && <>
                  <SelectItem value="gt">Greater than</SelectItem>
                  <SelectItem value="gte">Greater or equal</SelectItem>
                  <SelectItem value="lt">Less than</SelectItem>
                  <SelectItem value="lte">Less or equal</SelectItem>
                  <SelectItem value="between">Between</SelectItem>
                </>}
              </SelectContent>
            </Select>

            {filter?.op !== "is_empty" && filter?.op !== "is_not_empty" && (
              <Input
                className="h-7 text-xs"
                placeholder="Value..."
                value={filter?.value || ""}
                onChange={e => onChange({ ...filter, value: e.target.value })}
              />
            )}

            {filter?.op === "between" && (
              <Input
                className="h-7 text-xs"
                placeholder="Max value..."
                value={filter?.value2 || ""}
                onChange={e => onChange({ ...filter, value2: e.target.value })}
              />
            )}

            {filter?.op === "equals" && uniqueVals.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {uniqueVals.map(v => (
                  <button
                    key={v}
                    onClick={() => onChange({ ...filter, value: v })}
                    className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-muted font-mono truncate"
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 pt-1">
              <Button size="sm" className="flex-1 h-6 text-xs" onClick={() => setOpen(false)}>Apply</Button>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => { onClear(); setOpen(false); }}>Clear</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Formula Column Modal ----
function FormulaColumnModal({ columns, data, onAdd, onClose }) {
  const [colName, setColName] = useState("");
  const [formula, setFormula] = useState("");
  const [error, setError] = useState("");

  // Evaluate formula for a row: replaces column names with values
  const evalFormula = (row, f) => {
    let expr = f;
    // Sort by length descending to avoid partial replacements
    [...columns].sort((a, b) => b.length - a.length).forEach(col => {
      const safeVal = Number(row[col]);
      expr = expr.replaceAll(`[${col}]`, isNaN(safeVal) ? `"${String(row[col] ?? "")}"` : safeVal);
    });
    // Safely evaluate math + logic
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${expr})`)();
  };

  const preview = useMemo(() => {
    if (!formula) return [];
    return data.slice(0, 5).map(row => {
      try { return { ok: true, val: evalFormula(row, formula) }; }
      catch (e) { return { ok: false, val: e.message }; }
    });
  }, [formula, data, columns]);

  const handleAdd = () => {
    setError("");
    const name = colName.trim();
    if (!name) { setError("Column name required"); return; }
    if (columns.includes(name)) { setError("Column already exists"); return; }
    if (!formula) { setError("Formula required"); return; }
    // Test on first row
    try { evalFormula(data[0] || {}, formula); }
    catch (e) { setError(`Formula error: ${e.message}`); return; }
    onAdd(name, formula);
  };

  const exampleCols = columns.slice(0, 3).map(c => `[${c}]`).join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Formula Column</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Syntax: wrap column names in [brackets]</p>
          <p>Example: <code className="font-mono bg-muted px-1 rounded">[Price] * [Quantity]</code></p>
          <p>Example: <code className="font-mono bg-muted px-1 rounded">[Revenue] - [Cost]</code></p>
          <p>Example: <code className="font-mono bg-muted px-1 rounded">([Score] / 100) * 5</code></p>
          <p className="text-[10px]">Available: {exampleCols}{columns.length > 3 ? ` +${columns.length - 3} more` : ""}</p>
        </div>

        <div>
          <Label className="text-xs">New Column Name</Label>
          <Input className="mt-1 text-xs" placeholder="e.g. Total Sales" value={colName} onChange={e => setColName(e.target.value)} />
        </div>

        <div>
          <Label className="text-xs">Formula</Label>
          <Input className="mt-1 text-xs font-mono" placeholder="e.g. [Price] * [Quantity]" value={formula} onChange={e => setFormula(e.target.value)} />
        </div>

        {/* Column chips for quick insert */}
        <div>
          <Label className="text-xs mb-1 block">Click to insert column</Label>
          <div className="flex flex-wrap gap-1.5">
            {columns.map(col => (
              <button
                key={col}
                onClick={() => setFormula(f => f + `[${col}]`)}
                className="px-2 py-0.5 rounded border border-border bg-muted text-[10px] font-mono hover:bg-primary/10 hover:border-primary transition-colors"
              >
                {col}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Preview (first 5 rows)</p>
            {preview.map((p, i) => (
              <div key={i} className={`text-xs font-mono ${p.ok ? "text-foreground" : "text-destructive"}`}>
                Row {i + 1}: {p.ok ? String(p.val) : `Error — ${p.val}`}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleAdd} size="sm" className="flex-1">
            <Zap className="w-3.5 h-3.5 mr-1.5" /> Create Column
          </Button>
          <Button onClick={onClose} variant="outline" size="sm">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ---- Main DataTable ----
function applyFilter(val, filter) {
  if (!filter) return true;
  const { op, value, value2 } = filter;
  const strVal = String(val ?? "").toLowerCase();
  const filterVal = String(value ?? "").toLowerCase();
  const num = Number(val);
  const filterNum = Number(value);

  switch (op) {
    case "contains": return strVal.includes(filterVal);
    case "not_contains": return !strVal.includes(filterVal);
    case "equals": return strVal === filterVal;
    case "not_equals": return strVal !== filterVal;
    case "starts_with": return strVal.startsWith(filterVal);
    case "ends_with": return strVal.endsWith(filterVal);
    case "is_empty": return val === "" || val === null || val === undefined;
    case "is_not_empty": return val !== "" && val !== null && val !== undefined;
    case "gt": return !isNaN(num) && num > filterNum;
    case "gte": return !isNaN(num) && num >= filterNum;
    case "lt": return !isNaN(num) && num < filterNum;
    case "lte": return !isNaN(num) && num <= filterNum;
    case "between": return !isNaN(num) && num >= filterNum && num <= Number(value2 ?? "");
    default: return true;
  }
}

export default function DataTable({ data, columns, setData, setColumns }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [editCell, setEditCell] = useState(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  // { [col]: { op, value, value2 } }
  const [colFilters, setColFilters] = useState({});

  const activeFilterCount = Object.values(colFilters).filter(f => f && (f.value !== "" || f.op === "is_empty" || f.op === "is_not_empty")).length;

  // Global search + column filters
  const filtered = useMemo(() => {
    return data.filter(row => {
      const matchSearch = !search || columns.some(col => String(row[col] ?? "").toLowerCase().includes(search.toLowerCase()));
      const matchFilters = columns.every(col => {
        const f = colFilters[col];
        if (!f || (!f.value && f.op !== "is_empty" && f.op !== "is_not_empty")) return true;
        return applyFilter(row[col], f);
      });
      return matchSearch && matchFilters;
    });
  }, [data, columns, search, colFilters]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [filtered, sortCol, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
    setPage(0);
  };

  const updateCell = useCallback((rowIdx, col, value) => {
    const actualIdx = data.indexOf(sorted[page * PAGE_SIZE + rowIdx]);
    if (actualIdx === -1) return;
    const newData = [...data];
    newData[actualIdx] = { ...newData[actualIdx], [col]: value };
    setData(newData);
  }, [data, sorted, page, setData]);

  const addRow = () => {
    const newRow = {};
    columns.forEach(col => { newRow[col] = ""; });
    setData([...data, newRow]);
    toast.success("New row added");
  };

  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    const indicesToDelete = new Set();
    selectedRows.forEach(pageIdx => {
      const actualIdx = data.indexOf(sorted[page * PAGE_SIZE + pageIdx]);
      if (actualIdx !== -1) indicesToDelete.add(actualIdx);
    });
    setData(data.filter((_, i) => !indicesToDelete.has(i)));
    setSelectedRows(new Set());
    toast.success(`Deleted ${indicesToDelete.size} rows`);
  };

  const addColumn = (colName) => {
    if (columns.includes(colName)) { toast.error("Column already exists"); return; }
    setColumns([...columns, colName]);
    setData(data.map(row => ({ ...row, [colName]: "" })));
    setShowAddCol(false);
    toast.success(`Added column "${colName}"`);
  };

  const addFormulaColumn = (colName, formula) => {
    const evalFormula = (row) => {
      let expr = formula;
      [...columns].sort((a, b) => b.length - a.length).forEach(col => {
        const safeVal = Number(row[col]);
        expr = expr.replaceAll(`[${col}]`, isNaN(safeVal) ? `"${String(row[col] ?? "")}"` : safeVal);
      });
      // eslint-disable-next-line no-new-func
      return Function(`"use strict"; return (${expr})`)();
    };
    const newData = data.map(row => {
      try { return { ...row, [colName]: evalFormula(row) }; }
      catch { return { ...row, [colName]: null }; }
    });
    setData(newData);
    setColumns(prev => [...prev, colName]);
    setShowFormula(false);
    toast.success(`Created formula column "${colName}"`);
  };

  const exportCSV = () => {
    const header = columns.join(",");
    const rows = sorted.map(row => columns.map(col => {
      const val = String(row[col] ?? "");
      return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "data_export.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sorted.length} rows`);
  };

  const toggleRow = (idx) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setSelectedRows(newSet);
  };

  const isMissing = (val) => val === "" || val === null || val === undefined;

  const clearAllFilters = () => { setColFilters({}); setSearch(""); setPage(0); };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PencilLine className="w-4 h-4 text-primary" />
                Data Editor — {data.length} rows
              </CardTitle>
              {(activeFilterCount > 0 || search) && (
                <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={clearAllFilters}>
                  {activeFilterCount + (search ? 1 : 0)} filter(s) active · clear ×
                </Badge>
              )}
              {filtered.length !== data.length && (
                <Badge variant="outline" className="text-[10px]">{filtered.length} shown</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search all..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  className="pl-8 h-8 w-40 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFormula(true)}>
                <Zap className="w-3.5 h-3.5 mr-1" /> Formula
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddCol(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Column
              </Button>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Row
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
              </Button>
              {selectedRows.size > 0 && (
                <Button variant="destructive" size="sm" onClick={deleteSelectedRows}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete ({selectedRows.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === pageData.length && pageData.length > 0}
                      onChange={e => {
                        if (e.target.checked) setSelectedRows(new Set(pageData.map((_, i) => i)));
                        else setSelectedRows(new Set());
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-12">#</th>
                  {columns.map(col => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className="cursor-pointer hover:text-primary flex items-center gap-1 transition-colors"
                          onClick={() => handleSort(col)}
                        >
                          {col}
                          <ArrowUpDown className={`w-3 h-3 ${sortCol === col ? "text-primary" : "text-muted-foreground"}`} />
                        </span>
                        <ColumnFilterPopover
                          col={col}
                          filter={colFilters[col]}
                          data={data}
                          onChange={f => { setColFilters(prev => ({ ...prev, [col]: f })); setPage(0); }}
                          onClear={() => { setColFilters(prev => { const n = { ...prev }; delete n[col]; return n; }); setPage(0); }}
                        />
                        {colFilters[col] && (colFilters[col].value || colFilters[col].op === "is_empty" || colFilters[col].op === "is_not_empty") && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="text-center py-10 text-muted-foreground text-xs">
                      No rows match the current filters.
                    </td>
                  </tr>
                ) : pageData.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${selectedRows.has(idx) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={selectedRows.has(idx)} onChange={() => toggleRow(idx)} className="rounded" />
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono">{page * PAGE_SIZE + idx + 1}</td>
                    {columns.map(col => (
                      <td
                        key={col}
                        className={`px-3 py-1.5 cursor-pointer max-w-[200px] truncate font-mono ${
                          isMissing(row[col]) ? "bg-destructive/5 text-destructive italic" : "hover:bg-accent"
                        }`}
                        onClick={() => setEditCell({ rowIdx: idx, col })}
                        title={String(row[col] ?? "")}
                      >
                        {isMissing(row[col]) ? "(empty)" : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {sorted.length === data.length
                ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, sorted.length)} of ${sorted.length}`
                : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, sorted.length)} of ${sorted.length} (filtered from ${data.length})`
              }
            </p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-medium px-2">{page + 1} / {totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {editCell && (
        <EditCellModal
          value={pageData[editCell.rowIdx]?.[editCell.col] ?? ""}
          column={editCell.col}
          onSave={(val) => { updateCell(editCell.rowIdx, editCell.col, val); setEditCell(null); }}
          onClose={() => setEditCell(null)}
        />
      )}

      {showAddCol && (
        <AddColumnModal onAdd={addColumn} onClose={() => setShowAddCol(false)} />
      )}

      {showFormula && (
        <FormulaColumnModal
          columns={columns}
          data={data}
          onAdd={addFormulaColumn}
          onClose={() => setShowFormula(false)}
        />
      )}
    </>
  );
}