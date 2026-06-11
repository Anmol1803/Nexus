import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Undo2, Sparkles, Hash, Type, ChevronDown, ChevronUp, Trash2, ArrowDownUp, Replace, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

const typeConfig = {
  ai_fill:  { color: "bg-violet-100 text-violet-700 border-violet-200",    icon: Sparkles,     label: "AI Fill" },
  ai_bulk:  { color: "bg-violet-200 text-violet-800 border-violet-300",    icon: Sparkles,     label: "AI Bulk" },
  fill:     { color: "bg-blue-100 text-blue-700 border-blue-200",          icon: Hash,         label: "Fill" },
  clean:    { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: ArrowDownUp,  label: "Clean" },
  outlier:  { color: "bg-orange-100 text-orange-700 border-orange-200",    icon: TrendingDown, label: "Outlier" },
};

function LogEntry({ log, onUndo }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig[log.type] || typeConfig.clean;
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
          <p className="text-xs font-semibold text-foreground">{log.description}</p>
          <Badge variant="outline" className={`text-[10px] border ${cfg.color}`}>{cfg.label}</Badge>
          {log.filled !== undefined && (
            <Badge variant="secondary" className="text-[10px]">{log.filled} cells</Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{log.detail}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {format(new Date(log.timestamp), "HH:mm:ss")}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {log.snapshot && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onUndo(log.id)}
          >
            <Undo2 className="w-3 h-3 mr-1" />
            Undo
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default function ActivityLog({ logs, onUndo }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Activity Log
            {logs.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{logs.length}</Badge>
            )}
          </CardTitle>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Every action is logged here — click "Undo" to revert any step.
        </p>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No actions yet. Fill or clean your data to see logs here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {logs.map(log => (
                  <LogEntry key={log.id} log={log} onUndo={onUndo} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}