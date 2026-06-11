import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, Undo2, Sparkles, Hash, Type, Trash2,
  ArrowDownUp, Replace, TrendingDown, Zap, Calendar,
  RefreshCw, GitMerge, ChevronDown, ChevronUp, Download, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useTransformationHistory } from "@/lib/TransformationHistory";

const SOURCE_CONFIG = {
  clean:    { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: ArrowDownUp, label: "Cleaning" },
  fill:     { color: "bg-blue-100 text-blue-700 border-blue-200",         icon: Hash,         label: "Fill" },
  ai_fill:  { color: "bg-violet-100 text-violet-700 border-violet-200",   icon: Sparkles,     label: "AI Fill" },
  ai_bulk:  { color: "bg-violet-200 text-violet-800 border-violet-300",   icon: Sparkles,     label: "AI Bulk" },
  outlier:  { color: "bg-orange-100 text-orange-700 border-orange-200",   icon: TrendingDown, label: "Outlier" },
  types:    { color: "bg-cyan-100 text-cyan-700 border-cyan-200",         icon: RefreshCw,    label: "Type Conv." },
  text:     { color: "bg-pink-100 text-pink-700 border-pink-200",         icon: Type,         label: "Text Clean" },
  datetime: { color: "bg-yellow-100 text-yellow-700 border-yellow-200",   icon: Calendar,     label: "DateTime" },
  feature:  { color: "bg-indigo-100 text-indigo-700 border-indigo-200",   icon: Zap,          label: "Feature Eng." },
  formula:  { color: "bg-purple-100 text-purple-700 border-purple-200",   icon: Zap,          label: "Formula" },
  pivot:    { color: "bg-teal-100 text-teal-700 border-teal-200",         icon: GitMerge,     label: "Pivot" },
};

function LogEntry({ entry, onUndo }) {
  const cfg = SOURCE_CONFIG[entry.source] || SOURCE_CONFIG.clean;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-foreground">{entry.description}</p>
          <Badge variant="outline" className={`text-[10px] border ${cfg.color}`}>{cfg.label}</Badge>
          {entry.rowsAffected !== undefined && (
            <Badge variant="secondary" className="text-[10px]">{entry.rowsAffected} rows</Badge>
          )}
        </div>
        {entry.detail && <p className="text-[11px] text-muted-foreground mt-0.5">{entry.detail}</p>}
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {format(new Date(entry.timestamp), "MMM d, HH:mm:ss")}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {entry.snapshot && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onUndo(entry)}
          >
            <Undo2 className="w-3 h-3 mr-1" />
            Undo
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default function TransformationHistoryPanel({ setData, setColumns }) {
  const { history, removeEntry, clearHistory } = useTransformationHistory();
  const [collapsed, setCollapsed] = useState(false);
  const [filterSource, setFilterSource] = useState("all");

  const handleUndo = (entry) => {
    if (!entry.snapshot) return;
    setData(entry.snapshot.data);
    if (entry.snapshot.columns && setColumns) setColumns(entry.snapshot.columns);
    removeEntry(entry.id);
  };

  const exportLog = () => {
    const rows = [
      ["Timestamp", "Source", "Description", "Detail", "Rows Affected"],
      ...history.map(e => [
        format(new Date(e.timestamp), "yyyy-MM-dd HH:mm:ss"),
        e.source,
        e.description,
        e.detail || "",
        e.rowsAffected ?? ""
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "transformation_history.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const sources = ["all", ...Object.keys(SOURCE_CONFIG)];
  const filtered = filterSource === "all" ? history : history.filter(e => e.source === filterSource);

  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Transformation History
            {history.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{history.length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={exportLog}>
                  <Download className="w-3 h-3 mr-1" /> Export
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive/70 hover:text-destructive" onClick={clearHistory}>
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </>
            )}
            <button onClick={() => setCollapsed(v => !v)} className="text-muted-foreground hover:text-foreground ml-1">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          All transformations across every panel — undo any step, or export the full audit trail.
        </p>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0 space-y-3">
          {/* Filter bar */}
          {history.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sources.map(s => {
                const cfg = SOURCE_CONFIG[s];
                const count = s === "all" ? history.length : history.filter(e => e.source === s).length;
                if (count === 0 && s !== "all") return null;
                return (
                  <button
                    key={s}
                    onClick={() => setFilterSource(s)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      filterSource === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {s === "all" ? "All" : cfg?.label || s} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No transformations yet. Apply any operation across any panel to see it logged here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {filtered.map(entry => (
                  <LogEntry key={entry.id} entry={entry} onUndo={handleUndo} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}