import React, { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Table2, Sparkles, Download, RotateCcw, FileSpreadsheet,
  Hash, Type, Calendar, Zap, PieChart, Grid3x3, ClipboardList
} from "lucide-react";
import EDAPanel from "./EDAPanel";
import DataTable from "./DataTable";
import CleaningPanel from "./CleaningPanel";
import TypeConversionPanel from "./TypeConversionPanel";
import TextCleaningPanel from "./TextCleaningPanel";
import DateTimePanel from "./DateTimePanel";
import FeatureEngineeringPanel from "./FeatureEngineeringPanel";
import ChartBuilder from "./ChartBuilder";
import PivotTablePanel from "./PivotTablePanel";
import TransformationHistoryPanel from "./TransformationHistoryPanel";
import { TransformationHistoryProvider } from "@/lib/TransformationHistory";
import { motion } from "framer-motion";
import SmartRecoveryPanel from './smartrecoverypanel';
import { Layers } from "lucide-react";


export default function DataWorkspace({ initialData, columns: initialCols, fileName, onReset }) {
  const [data, setData] = useState(initialData);
  const [columns, setColumns] = useState(initialCols);
  const [activeTab, setActiveTab] = useState("eda");

  const stats = useMemo(() => {
    const totalCells = data.length * columns.length;
    let missingCells = 0;
    data.forEach(row => {
      columns.forEach(col => {
        if (row[col] === "" || row[col] === null || row[col] === undefined) missingCells++;
      });
    });
    return { rows: data.length, cols: columns.length, totalCells, missingCells };
  }, [data, columns]);

  const exportCSV = () => {
    const header = columns.join(",");
    const rows = data.map(row => columns.map(col => {
      const val = String(row[col] ?? "");
      return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cleaned_${fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TransformationHistoryProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground leading-none">Nexus</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.rows} rows × {stats.cols} cols · {stats.missingCells} missing
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onReset}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                New File
              </Button>
              <Button size="sm" onClick={exportCSV}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
              <TabsTrigger value="eda" className="gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" /> EDA
              </TabsTrigger>
              <TabsTrigger value="clean" className="gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Clean & Fill
              </TabsTrigger>
              <TabsTrigger value="recovery" className="gap-1.5 text-xs">
               <Layers className="w-3.5 h-3.5" /> Smart Recovery
              </TabsTrigger>              
              <TabsTrigger value="types" className="gap-1.5 text-xs">
                <Hash className="w-3.5 h-3.5" /> Data Types
              </TabsTrigger>
              <TabsTrigger value="text" className="gap-1.5 text-xs">
                <Type className="w-3.5 h-3.5" /> Text Cleaning
              </TabsTrigger>
              <TabsTrigger value="datetime" className="gap-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5" /> Date & Time
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5" /> Feature Engineering
              </TabsTrigger>
              <TabsTrigger value="charts" className="gap-1.5 text-xs">
                <PieChart className="w-3.5 h-3.5" /> Chart Builder
              </TabsTrigger>
              <TabsTrigger value="pivot" className="gap-1.5 text-xs">
                <Grid3x3 className="w-3.5 h-3.5" /> Pivot Table
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5 text-xs">
                <Table2 className="w-3.5 h-3.5" /> Edit Data
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs">
                <ClipboardList className="w-3.5 h-3.5" /> History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="eda">
              <EDAPanel data={data} columns={columns} fileName={fileName} />
            </TabsContent>
            <TabsContent value="clean">
              <CleaningPanel data={data} columns={columns} setData={setData} setColumns={setColumns} />
            </TabsContent>
            <TabsContent value="recovery">
             <SmartRecoveryPanel 
               data={data} 
               columns={columns} 
               setData={setData} 
               setColumns={setColumns} 
             />
           </TabsContent>            
            <TabsContent value="types">
              <TypeConversionPanel data={data} columns={columns} setData={setData} setColumns={setColumns} />
            </TabsContent>
            <TabsContent value="text">
              <TextCleaningPanel data={data} columns={columns} setData={setData} />
            </TabsContent>
            <TabsContent value="datetime">
              <DateTimePanel data={data} columns={columns} setData={setData} setColumns={setColumns} />
            </TabsContent>
            <TabsContent value="features">
              <FeatureEngineeringPanel data={data} columns={columns} setData={setData} setColumns={setColumns} />
            </TabsContent>
            <TabsContent value="charts">
              <ChartBuilder data={data} columns={columns} />
            </TabsContent>
            <TabsContent value="pivot">
              <PivotTablePanel data={data} columns={columns} />
            </TabsContent>
            <TabsContent value="table">
              <DataTable data={data} columns={columns} setData={setData} setColumns={setColumns} />
            </TabsContent>
            <TabsContent value="history">
              <TransformationHistoryPanel setData={setData} setColumns={setColumns} />
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </TransformationHistoryProvider>
  );
}