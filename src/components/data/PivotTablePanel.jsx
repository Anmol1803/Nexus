// src/components/data/PivotTablePanel.jsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Download, RotateCcw, LayoutDashboard, Table2, BarChart3,
  GripVertical, X, Settings, Search, ChevronDown, ChevronRight,
  AlertTriangle, ChevronsUpDown
} from "lucide-react";
import { toast } from "sonner";
import { computePivot, applyGroupTransform } from "@/lib/pivotutils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { evaluate } from "mathjs";

/* ========================================================================== */
/*  Helpers                                                                   */
/* ========================================================================== */
function formatNumber(value, formatStr) {
  if (value == null) return '';
  if (!formatStr) return value.toFixed(2);
  try {
    if (formatStr === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    if (formatStr === 'percent') return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 }).format(value);
    if (formatStr.includes('%')) return (value * 100).toFixed(2) + '%';
    if (formatStr.match(/^#,##0\.00$/)) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value.toLocaleString('en-US');
  } catch {
    return value;
  }
}

const AGGREGATIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'count', label: 'Count Numbers' },
  { value: 'countAll', label: 'Count All' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'median', label: 'Median' },
  { value: 'distinctCount', label: 'Distinct Count' },
];
const AGG_LABEL_MAP = Object.fromEntries(AGGREGATIONS.map(a => [a.value, a.label]));

function getValueLabel(item) {
  if (item.caption) return item.caption;
  const aggLabel = AGG_LABEL_MAP[item.aggregation] || item.aggregation;
  return `${aggLabel} of ${item.field}`;
}

function evaluateFormula(formula, columnValues, columnNames) {
  try {
    const scope = {};
    columnNames.forEach((col, i) => { scope[col] = columnValues[i]; });
    return evaluate(formula, scope);
  } catch {
    return '#ERROR';
  }
}

/* ========================================================================== */
/*  DropZone                                                                  */
/* ========================================================================== */
const DropZone = ({
  title, zone, items, onDrop, onRemove, onReorder,
  onOpenSettings, emptyMessage, isField = false
}) => {
  const [dragIndex, setDragIndex] = useState(null);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = (e) => {
    e.preventDefault();
    const field = e.dataTransfer.getData("text/plain");
    if (field) onDrop(zone, field);
  };
  const moveItem = (from, to) => { if (from !== to) onReorder(zone, from, to); };

  return (
    <div className="border border-border rounded-lg p-2 bg-background min-h-[60px]"
      onDragOver={handleDragOver} onDrop={handleDrop}>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div
              key={isField ? item.field : item.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", isField ? item.field : item.field); setDragIndex(idx); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const d = dragIndex;
                if (d !== null && d !== idx) moveItem(d, idx);
                setDragIndex(null);
              }}
              className="flex items-center justify-between p-1.5 rounded bg-muted/50 border border-transparent hover:border-primary/50 transition-colors cursor-grab group"
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                <span className="text-xs font-medium">{isField ? item.field : getValueLabel(item)}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-1" onClick={(e) => { e.stopPropagation(); onOpenSettings(zone, idx); }}>
                  <Settings className="w-3 h-3" />
                </Button>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onRemove(zone, idx); }}
                className="text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ========================================================================== */
/*  FieldList                                                                 */
/* ========================================================================== */
const FieldList = ({ columns, filters, rows, cols, values, onAdd, onRemove, onReorder, onOpenSettings }) => {
  const [search, setSearch] = useState("");
  const filtered = columns.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search fields..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
      </div>
      <ScrollArea className="h-36">
        <div className="space-y-1">
          {filtered.map(col => (
            <div key={col} draggable onDragStart={e => e.dataTransfer.setData("text/plain", col)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 border border-border cursor-grab hover:bg-accent hover:border-primary/50 text-xs font-medium">
              <GripVertical className="w-3 h-3 text-muted-foreground" />{col}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="space-y-2">
        <DropZone title="Filters" zone="filters" items={filters} onDrop={onAdd} onRemove={onRemove} onReorder={onReorder} onOpenSettings={onOpenSettings} emptyMessage="Drag fields here" isField={true} />
        <DropZone title="Rows" zone="rows" items={rows} onDrop={onAdd} onRemove={onRemove} onReorder={onReorder} onOpenSettings={onOpenSettings} emptyMessage="Drag fields here" isField={true} />
        <DropZone title="Columns" zone="cols" items={cols} onDrop={onAdd} onRemove={onRemove} onReorder={onReorder} onOpenSettings={onOpenSettings} emptyMessage="Drag fields here" isField={true} />
        <DropZone title="Values" zone="values" items={values} onDrop={onAdd} onRemove={onRemove} onReorder={onReorder} onOpenSettings={onOpenSettings} emptyMessage="Drag fields here" />
      </div>
    </div>
  );
};

/* ========================================================================== */  
const PivotGrid = React.memo(({ pivotResult, expandedRows, toggleExpand, onCellDoubleClick, onExpandAll, onCollapseAll, valueConfigs }) => {
  // Safe fallback
  const safeResult = pivotResult || {
    rowTree: null,
    valueConfigs: [],
    rowFields: [],
    colFields: [],
    leafGrid: [],
    rowLeaves: [],
    colLeaves: [],
    grandTotal: {},
    colGrandTotals: [],
    colTruncated: false,
    rowTruncated: false,
    rowTotals: [],
    rankMaps: {},
  };

  const {
    rowTree,
    valueConfigs: vcs,
    rowFields,
    colFields,
    leafGrid,
    rowLeaves,
    colLeaves,
    grandTotal,
    colGrandTotals,
    colTruncated,
    rowTruncated,
    rowTotals,
    rankMaps,
  } = safeResult;

  const hideGrandTotal = false; // always show grand total

  // ---- Header rows ----
  const colHeaderRows = useMemo(() => {
    const rows = [];
    const topRow = [];
    // Row field placeholders (span 2 rows)
    for (let i = 0; i < rowFields.length; i++) {
      topRow.push({ text: '', colSpan: 1, rowSpan: 2 });
    }
    // Column leaves
    if (colFields.length > 0) {
      colLeaves.forEach(leaf => {
        topRow.push({ text: leaf.path.join(' / '), colSpan: valueConfigs.length, rowSpan: 1 });
      });
    } else {
      topRow.push({ text: '', colSpan: valueConfigs.length, rowSpan: 1 });
    }
    // Grand total header
    if (!hideGrandTotal) {
      topRow.push({ text: 'Grand Total', colSpan: valueConfigs.length, rowSpan: 1 });
    }
    rows.push(topRow);

    // Second header row – value labels (no row field placeholders)
    const subRow = [];
    if (colFields.length === 0) {
      valueConfigs.forEach(vc => {
        subRow.push({ text: getValueLabel(vc), colSpan: 1, rowSpan: 1 });
      });
    } else {
      colLeaves.forEach(() => {
        valueConfigs.forEach(vc => {
          subRow.push({ text: getValueLabel(vc), colSpan: 1, rowSpan: 1 });
        });
      });
    }
    if (!hideGrandTotal) {
      valueConfigs.forEach(vc => {
        subRow.push({ text: getValueLabel(vc), colSpan: 1, rowSpan: 1 });
      });
    }
    rows.push(subRow);
    return rows;
  }, [rowFields, colFields, colLeaves, valueConfigs, hideGrandTotal]);

  // ---- Flat row list for rendering ----
  const flatRows = useMemo(() => {
    if (!rowTree) return [];
    const list = [];
    const traverse = (node, path, depth) => {
      const nodeKey = path.join('|');
      const hasChildren = node.children?.size > 0;
      const isExpanded = expandedRows[nodeKey] === true; // collapsed by default
      if (hasChildren && !colTruncated && node.subtotalGrid) {
        list.push({ type: 'subtotal', nodeKey, path, depth, expanded: isExpanded, node });
      }
      if (!hasChildren && node.leafIndex !== undefined) {
        list.push({ type: 'leaf', leafIndex: node.leafIndex, path, depth, nodeKey });
      } else if (hasChildren && isExpanded) {
        node.children.forEach((child, key) => traverse(child, [...path, key], depth + 1));
      }
    };
    if (rowTree.children) {
      rowTree.children.forEach((child, key) => traverse(child, [key], 1));
    }
    return list;
  }, [rowTree, expandedRows, colTruncated]);

  // ---- Render helpers ----
  const renderCell = (cell, vc, rowLeafIndex, colIndex) => {
    let rawVal = cell?.[vc.key];
    let displayVal = rawVal;
    const grandTotalVal = grandTotal[vc.key];
    const rowTotal = rowTotals[rowLeafIndex]?.[vc.key];
    const colGrandTotal = colGrandTotals[colIndex]?.[vc.key];

    if (vc.showAs === 'percentOfGrand' && grandTotalVal) {
      displayVal = rawVal != null ? rawVal / grandTotalVal : null;
    } else if (vc.showAs === 'percentOfRow' && rowTotal) {
      displayVal = rawVal != null ? rawVal / rowTotal : null;
    } else if (vc.showAs === 'percentOfCol' && colGrandTotal) {
      displayVal = rawVal != null ? rawVal / colGrandTotal : null;
    } else if (vc.showAs === 'rank') {
      displayVal = rankMaps[vc.key]?.get(rawVal) ?? '';
    }
    // runningTotal not implemented here for brevity
    return displayVal != null ? formatNumber(displayVal, vc.numberFormat) : '';
  };

  const renderRow = (item) => {
    if (item.type === 'subtotal') {
      const { node, path, depth, nodeKey, expanded } = item;
      const subtotalGrid = node.subtotalGrid || [];
      // Row label cells
      const labelCells = path.map((val, d) => {
        const isLast = d === depth - 1;
        return (
          <td key={`label-${d}`} className="px-2 py-1 font-medium whitespace-nowrap border-r border-border">
            {isLast ? (
              <button onClick={() => toggleExpand(nodeKey)} className="inline-flex items-center gap-1 hover:text-primary">
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {val}
              </button>
            ) : val}
          </td>
        );
      });
      // Fill empty cells for remaining row hierarchy levels
      for (let d = depth; d < rowFields.length; d++) {
        labelCells.push(<td key={`label-empty-${d}`} className="px-2 py-1 border-r border-border" />);
      }

      // Data cells
      const dataCells = [];
      for (let ci = 0; ci < colLeaves.length; ci++) {
        const cell = subtotalGrid[ci] || {};
        valueConfigs.forEach((vc, vi) => {
          dataCells.push(
            <td key={`sub-${ci}-${vi}`} className="text-right px-3 py-1 font-mono border-r border-border">
              {renderCell(cell, vc, -1, ci)}
            </td>
          );
        });
      }

      // Grand total cells
      const grandTotalCells = [];
      if (!hideGrandTotal) {
        valueConfigs.forEach((vc, vi) => {
          const val = node.rowTotal?.[vc.key];
          grandTotalCells.push(
            <td key={`gt-${vi}`} className="text-right px-3 py-1 font-mono border-r border-border">
              {val != null ? formatNumber(val, vc.numberFormat) : ''}
            </td>
          );
        });
      }

      return (
        <tr key={nodeKey} className="bg-muted/20 font-medium border-b border-border">
          {labelCells}
          {dataCells}
          {grandTotalCells}
        </tr>
      );
    } else {
      // Leaf row
      const { leafIndex, path, depth } = item;
      const cells = leafGrid[leafIndex] || [];
      // Row label cells
      const labelCells = path.map((val, d) => (
        <td key={`label-${d}`} className="px-2 py-1 font-medium whitespace-nowrap border-r border-border">
          {val}
        </td>
      ));
      for (let d = depth; d < rowFields.length; d++) {
        labelCells.push(<td key={`label-empty-${d}`} className="px-2 py-1 border-r border-border" />);
      }

      // Data cells
      const dataCells = [];
      for (let ci = 0; ci < colLeaves.length; ci++) {
        const cell = cells[ci] || {};
        valueConfigs.forEach((vc, vi) => {
          dataCells.push(
            <td
              key={`leaf-${ci}-${vi}`}
              className="text-right px-3 py-1 font-mono border-r border-border cursor-pointer"
              onDoubleClick={() => onCellDoubleClick(leafIndex, ci)}
            >
              {renderCell(cell, vc, leafIndex, ci)}
            </td>
          );
        });
      }

      // Grand total cells
      const grandTotalCells = [];
      if (!hideGrandTotal) {
        valueConfigs.forEach((vc, vi) => {
          const val = rowTotals[leafIndex]?.[vc.key];
          grandTotalCells.push(
            <td key={`gt-${vi}`} className="text-right px-3 py-1 font-mono border-r border-border">
              {val != null ? formatNumber(val, vc.numberFormat) : ''}
            </td>
          );
        });
      }

      return (
        <tr key={leafIndex} className="hover:bg-muted/20 even:bg-muted/5 border-b border-border">
          {labelCells}
          {dataCells}
          {grandTotalCells}
        </tr>
      );
    }
  };

  // ---- Main render ----
  if (!pivotResult) {
    return <div className="py-12 text-center text-muted-foreground">No data to display.</div>;
  }

  return (
    <div className="w-full">
      {(colTruncated || rowTruncated) && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>
            {colTruncated && `Only the first ${colLeaves.length} columns are shown. `}
            {rowTruncated && `Only the first ${rowLeaves.length} rows are shown. `}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={onExpandAll}>
          <ChevronsUpDown className="w-3.5 h-3.5 mr-1" /> Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={onCollapseAll}>
          <ChevronsUpDown className="w-3.5 h-3.5 mr-1" /> Collapse All
        </Button>
      </div>
      <div className="overflow-auto rounded-lg border border-border max-h-[70vh]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            {colHeaderRows.map((row, idx) => (
              <tr key={idx} className="bg-muted/50">
                {row.map((cell, ci) => (
                  <th
                    key={ci}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className="border-r border-b border-border px-2 py-1 text-xs font-medium text-center"
                  >
                    {cell.text}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {flatRows.map((item, idx) => renderRow(item))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
/* ========================================================================== */
/*  FieldSettingsDialog                                                       */
/* ========================================================================== */
const FieldSettingsDialog = ({ zone, index, rows, cols, values, filters, data, distinctValuesMap, onUpdate, onClose }) => {
  const array = zone === 'rows' ? rows : zone === 'cols' ? cols : zone === 'values' ? values : filters;
  const invalid = !array || index < 0 || index >= array.length;

  useEffect(() => {
    if (invalid) {
      onClose();
    }
  }, [invalid, onClose]);

  if (invalid) return null;

  const current = array[index];
  const [settings, setSettings] = useState({ ...current });
  const isValue = zone === 'values';
  const groupBy = settings.groupBy || {};

  const distinctValues = useMemo(() => {
    if (isValue || !settings.field) return [];
    const field = settings.field;
    if (groupBy.type) {
      const groupedVals = new Set();
      data.forEach(row => {
        const raw = row[field] ?? '(blank)';
        groupedVals.add(applyGroupTransform(raw, groupBy));
      });
      return [...groupedVals].sort();
    }
    return distinctValuesMap[field] || [];
  }, [isValue, settings.field, data, distinctValuesMap, groupBy]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Field Settings: {isValue ? (settings.caption || settings.field) : settings.field}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isValue && (
            <>
              <div>
                <Label className="text-xs">Custom Name</Label>
                <Input className="h-8 mt-1" value={settings.caption || ''} onChange={e => setSettings({ ...settings, caption: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Summarize by</Label>
                <Select value={settings.aggregation} onValueChange={v => setSettings({ ...settings, aggregation: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map(agg => <SelectItem key={agg.value} value={agg.value}>{agg.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Show Values As</Label>
                <Select value={settings.showAs || 'normal'} onValueChange={v => setSettings({ ...settings, showAs: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">No Calculation</SelectItem>
                    <SelectItem value="percentOfGrand">% of Grand Total</SelectItem>
                    <SelectItem value="percentOfRow">% of Row Total</SelectItem>
                    <SelectItem value="percentOfCol">% of Column Total</SelectItem>
                    <SelectItem value="runningTotal">Running Total</SelectItem>
                    <SelectItem value="rank">Rank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Number Format</Label>
                <Select
                  value={settings.numberFormat || 'auto'}
                  onValueChange={v => setSettings({ ...settings, numberFormat: v === 'auto' ? '' : v })}
                >
                  <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="decimal">Decimal</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {!isValue && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Sort</Label>
                <Select value={settings.sort} onValueChange={v => setSettings({ ...settings, sort: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Manual</SelectItem>
                    <SelectItem value="asc">A to Z</SelectItem>
                    <SelectItem value="desc">Z to A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Filter items</Label>
                <div className="max-h-32 overflow-y-auto border rounded p-1 mt-1 space-y-0.5">
                  {distinctValues.map(val => (
                    <label key={val} className="flex items-center gap-1.5 text-xs py-0.5">
                      <Checkbox
                        checked={!settings.filterValues || settings.filterValues.includes(val)}
                        onCheckedChange={() => {
                          const current = settings.filterValues || [];
                          if (current.includes(val)) setSettings({ ...settings, filterValues: current.filter(v => v !== val) });
                          else setSettings({ ...settings, filterValues: [...current, val] });
                        }}
                      />
                      {val}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Group by</Label>
                <Select value={groupBy.type || 'none'} onValueChange={v => {
                  if (v === 'none') setSettings({ ...settings, groupBy: undefined });
                  else if (v === 'date') setSettings({ ...settings, groupBy: { type: 'date', period: 'month' } });
                  else if (v === 'numeric') setSettings({ ...settings, groupBy: { type: 'numeric', step: 10 } });
                }}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="numeric">Numeric Buckets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {groupBy.type === 'date' && (
                <div>
                  <Label className="text-xs">Period</Label>
                  <Select value={groupBy.period || 'month'} onValueChange={v => setSettings({ ...settings, groupBy: { ...groupBy, period: v } })}>
                    <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {groupBy.type === 'numeric' && (
                <div>
                  <Label className="text-xs">Bucket Size</Label>
                  <Input type="number" className="h-8 mt-1" value={groupBy.step || 10} onChange={e => setSettings({ ...settings, groupBy: { ...groupBy, step: Number(e.target.value) } })} />
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onUpdate(zone, index, settings); onClose(); }}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ========================================================================== */
/*  DrillDownModal                                                            */
/* ========================================================================== */
const DrillDownModal = ({ records, rowPath, colPath, columns, onClose }) => (
  <Dialog open onOpenChange={onClose}>
    <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
      <DialogHeader>
        <DialogTitle className="text-sm">Drill Down: {rowPath.join(' / ')} × {colPath.join(' / ')}</DialogTitle>
      </DialogHeader>
      <div className="overflow-auto max-h-96">
        {records && records.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                {columns.map(col => <th key={col} className="border-b border-r px-2 py-1 text-left">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.map((rec, i) => (
                <tr key={i} className="even:bg-muted/10">
                  {columns.map(col => <td key={col} className="border-b border-r px-2 py-1">{String(rec[col] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-muted-foreground p-2">No detail data available.</p>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

/* ========================================================================== */
/*  PivotChartView                                                            */
/* ========================================================================== */
const PivotChartView = ({ pivotResult, valueConfigs }) => {
  if (!pivotResult) return <div className="py-12 text-center text-muted-foreground">No data to chart.</div>;
  const data = pivotResult.rowLeaves.map(leaf => ({
    name: leaf.path.join(' / '),
    ...Object.fromEntries(valueConfigs.map(vc => [vc.key, pivotResult.leafGrid[leaf.leafIndex]?.[0]?.[vc.key] ?? 0]))
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        {valueConfigs.map((vc, i) => (
          <Bar key={vc.key} dataKey={vc.key} fill={`hsl(${(i * 60) % 360}, 70%, 50%)`} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

/* ========================================================================== */
/*  Main PivotTablePanel                                                      */
/* ========================================================================== */
export default function PivotTablePanel({ data, columns, columnTypes = {} }) {
  const [filters, setFilters] = useState([]);
  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState([]);
  const [values, setValues] = useState([]);
  const [valueFilters, setValueFilters] = useState([]);
  const [drillDown, setDrillDown] = useState(null);
  const [settingsField, setSettingsField] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [calculatedFields, setCalculatedFields] = useState([]);
  const [pivotError, setPivotError] = useState(null);
  const idRef = useRef(0);
  const generateId = () => `item-${++idRef.current}`;

  const distinctValuesMap = useMemo(() => {
    const map = {};
    columns.forEach(col => {
      const vals = new Set();
      data.forEach(row => {
        vals.add(String(row[col] ?? '(blank)'));
      });
      map[col] = [...vals].sort();
    });
    return map;
  }, [data, columns]);

  const addTo = useCallback((zone, field) => {
    const id = generateId();
    if (zone === 'rows') setRows(prev => [...prev, { id, field, sort: 'none', subtotals: true }]);
    else if (zone === 'cols') setCols(prev => [...prev, { id, field, sort: 'none', subtotals: true }]);
    else if (zone === 'values') {
      const key = `${field}_${id}`;
      setValues(prev => [...prev, { id, key, field, aggregation: 'sum', caption: undefined, showAs: 'normal', numberFormat: '' }]);
    } else if (zone === 'filters') setFilters(prev => [...prev, { id, field, filterValues: undefined }]);
  }, []);

  const removeFrom = useCallback((zone, idx) => {
    if (zone === 'rows') setRows(prev => prev.filter((_, i) => i !== idx));
    else if (zone === 'cols') setCols(prev => prev.filter((_, i) => i !== idx));
    else if (zone === 'values') setValues(prev => prev.filter((_, i) => i !== idx));
    else if (zone === 'filters') setFilters(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const reorder = useCallback((zone, from, to) => {
    if (zone === 'rows') setRows(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    else if (zone === 'cols') setCols(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    else if (zone === 'values') setValues(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    else if (zone === 'filters') setFilters(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }, []);

  const updateField = useCallback((zone, index, settings) => {
    if (zone === 'rows') setRows(prev => prev.map((item, i) => i === index ? settings : item));
    else if (zone === 'cols') setCols(prev => prev.map((item, i) => i === index ? settings : item));
    else if (zone === 'values') setValues(prev => prev.map((item, i) => i === index ? settings : item));
    else if (zone === 'filters') setFilters(prev => prev.map((item, i) => i === index ? settings : item));
  }, []);

  const pivotResult = useMemo(() => {
    try {
      if (!(rows.length || cols.length)) return null;
      let extendedData = data;
      if (calculatedFields.length > 0) {
        extendedData = data.map(row => {
          const newRow = { ...row };
          calculatedFields.forEach(cf => {
            const vals = cf.sourceFields.map(f => row[f] ?? 0);
            newRow[cf.name] = evaluateFormula(cf.formula, vals, cf.sourceFields);
          });
          return newRow;
        });
      }
      return computePivot(extendedData, rows, cols, values, filters, valueFilters);
    } catch (err) {
      console.error('Pivot computation failed:', err);
      return { __error: err.message };
    }
  }, [data, rows, cols, values, filters, valueFilters, calculatedFields]);

  useEffect(() => {
    if (pivotResult?.__error) {
      setPivotError(pivotResult.__error);
    } else {
      setPivotError(null);
    }
  }, [pivotResult]);

// Toggle: if key is true, set to false, else true
// Toggle: if key is true, set to false, else true
const toggleExpand = useCallback((key) => {
  setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
}, []);

// Expand All: set all to true
const handleExpandAll = () => {
  const allKeys = {};
  const traverse = (node, path = []) => {
    if (node.children) {
      const key = path.join('|');
      if (key) allKeys[key] = true;
      node.children.forEach((child, k) => traverse(child, [...path, k]));
    }
  };
  if (pivotResult?.rowTree) traverse(pivotResult.rowTree);
  setExpandedRows(allKeys);
};

// Collapse All: set all to false
const handleCollapseAll = () => {
  const allKeys = {};
  const traverse = (node, path = []) => {
    if (node.children) {
      const key = path.join('|');
      if (key) allKeys[key] = false;
      node.children.forEach((child, k) => traverse(child, [...path, k]));
    }
  };
  if (pivotResult?.rowTree) traverse(pivotResult.rowTree);
  setExpandedRows(allKeys);
};


  const handleCellDoubleClick = useCallback((leafIndex, colIndex) => {
    if (!pivotResult || pivotResult.__error) return;
    const rowLeaf = pivotResult.rowLeaves[leafIndex];
    const colLeaf = pivotResult.colLeaves[colIndex];
    const records = rowLeaf.records.filter(r => colLeaf.records.includes(r));
    setDrillDown({ records, rowPath: rowLeaf.path, colPath: colLeaf.path });
  }, [pivotResult]);

  const exportCSV = () => {
    if (!pivotResult || pivotResult.__error) return;
    toast.success('Exported (demo)');
  };

  const validPivot = pivotResult && !pivotResult.__error ? pivotResult : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-primary" /> Pivot Table</h2>
          <p className="text-xs text-muted-foreground">Drag fields to build your pivot. Use value filters on aggregated results.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setRows([]); setCols([]); setValues([]); setFilters([]); setValueFilters([]); toast.info('Pivot reset'); }}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset</Button>
          <Button size="sm" onClick={exportCSV} disabled={!validPivot}><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-sm">PivotTable Fields</CardTitle></CardHeader>
          <CardContent className="p-3">
            <FieldList
              columns={columns}
              filters={filters}
              rows={rows}
              cols={cols}
              values={values}
              onAdd={addTo}
              onRemove={removeFrom}
              onReorder={reorder}
              onOpenSettings={(z, i) => setSettingsField({ zone: z, index: i })}
            />
            <div className="mt-4 pt-2 border-t">
              <h4 className="text-xs font-semibold mb-1">Calculated Fields</h4>
              {calculatedFields.map((cf, i) => (
                <div key={i} className="text-xs flex justify-between items-center">
                  {cf.name}
                  <Button variant="ghost" size="sm" onClick={() => setCalculatedFields(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                const name = prompt('Field name?');
                const formula = prompt('Formula (e.g., Sales / Customers)?');
                if (name && formula) {
                  const sourceFields = columns.filter(c => formula.includes(c));
                  setCalculatedFields(prev => [...prev, { name, formula, sourceFields }]);
                }
              }}>+ Calc Field</Button>
            </div>
            <div className="mt-4 pt-2 border-t">
              <h4 className="text-xs font-semibold mb-1">Value Filters</h4>
              {valueFilters.map((vf, idx) => (
                <div key={idx} className="flex items-center gap-1 text-xs mb-1">
                  <Select value={vf.valueConfigKey} onValueChange={v => {
                    const updated = [...valueFilters];
                    updated[idx].valueConfigKey = v;
                    setValueFilters(updated);
                  }}>
                    <SelectTrigger className="h-6 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {values.map(vc => <SelectItem key={vc.key} value={vc.key}>{getValueLabel(vc)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={vf.operator} onValueChange={v => {
                    const updated = [...valueFilters];
                    updated[idx].operator = v;
                    setValueFilters(updated);
                  }}>
                    <SelectTrigger className="h-6 w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gt">{'>'}</SelectItem>
                      <SelectItem value="gte">{'≥'}</SelectItem>
                      <SelectItem value="lt">{'<'}</SelectItem>
                      <SelectItem value="lte">{'≤'}</SelectItem>
                      <SelectItem value="eq">=</SelectItem>
                      <SelectItem value="neq">≠</SelectItem>
                      <SelectItem value="top">Top N</SelectItem>
                      <SelectItem value="bottom">Bottom N</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="h-6 w-16" type="number" value={vf.value} onChange={e => {
                    const updated = [...valueFilters];
                    updated[idx].value = Number(e.target.value);
                    setValueFilters(updated);
                  }} />
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setValueFilters(prev => prev.filter((_, i) => i !== idx))}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setValueFilters(prev => [...prev, { valueConfigKey: values[0]?.key, operator: 'gt', value: 0 }])} disabled={!values.length}>
                + Add Value Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {pivotError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-300 rounded text-xs text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Pivot could not be computed: {pivotError}</span>
            </div>
          )}
          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table"><Table2 className="w-3.5 h-3.5 mr-1" /> Table</TabsTrigger>
              <TabsTrigger value="chart"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Chart</TabsTrigger>
            </TabsList>
            <TabsContent value="table" className="mt-2">
<PivotGrid
  pivotResult={validPivot}
  expandedRows={expandedRows}
  toggleExpand={toggleExpand}
  onCellDoubleClick={handleCellDoubleClick}
  onExpandAll={handleExpandAll}
  onCollapseAll={handleCollapseAll}
  valueConfigs={values}
/>
            </TabsContent>
            <TabsContent value="chart" className="mt-2">
              <PivotChartView pivotResult={validPivot} valueConfigs={values} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {settingsField && (
        <FieldSettingsDialog
          {...settingsField}
          rows={rows} cols={cols} values={values} filters={filters}
          data={data}
          distinctValuesMap={distinctValuesMap}
          onUpdate={updateField}
          onClose={() => setSettingsField(null)}
        />
      )}
      {drillDown && <DrillDownModal {...drillDown} columns={columns} onClose={() => setDrillDown(null)} />}
    </div>
  );
}