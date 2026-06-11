import React, { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, ArrowRight, BarChart3, Sparkles, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { data: [], columns: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const delimiters = [",", ";", "\t", "|"];
  let delimiter = ",";
  let maxCount = 0;
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(d === "|" ? "\\|" : d === "\t" ? "\t" : d, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = d;
    }
  }

  const parseLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const columns = parseLine(lines[0]);
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    columns.forEach((col, idx) => {
      row[col] = values[idx] !== undefined ? values[idx] : "";
    });
    data.push(row);
  }
  return { data, columns };
}

export default function FileUpload({ onDataLoaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback((file) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { data, columns } = parseCSV(text);
      onDataLoaded(data, columns, file.name);
      setIsLoading(false);
    };
    reader.readAsText(file);
  }, [onDataLoaded]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const features = [
  { icon: BarChart3, title: "Auto EDA", desc: "Instant statistical analysis" },
  { icon: Sparkles, title: "Smart Fill", desc: "AI-powered missing data imputation" },
  { icon: Table2, title: "Manual Edit", desc: "Full cell-level data editing" }];


return (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-background">
    {/* Logo - extreme top right */}
    <div className="absolute top-4 left-4 z-10">
      <img 
        src="/Nexus.png" 
        alt="Nexus Logo" 
        className="w-20 h-20 object-contain"
      />
    </div>

    {/* Centered content (your existing motion.div) */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl"
    >
      {/* Badge, headline, upload box... (remove the old centered logo) */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-3">
          Upload Clean <span className="text-primary">Transform</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Clean, analyze, and transform your data — all in one place.
        </p>
      </div>

        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group ${
          isDragging ?
          "border-primary bg-accent scale-[1.02]" :
          "border-border hover:border-primary/50 hover:bg-accent/50"}`
          }
          onDragOver={(e) => {e.preventDefault();setIsDragging(true);}}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input").click()}>
          
          <input
            id="file-input"
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFileInput} />
          
          
          {isLoading ?
          <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-muted-foreground font-medium">Processing your file...</p>
            </div> :

          <>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="text-foreground font-semibold text-lg mb-1">
                Drop your CSV file here
              </p>
              <p className="text-muted-foreground text-sm mb-5">
                or click to browse — supports CSV, TSV formats
              </p>
              <Button variant="outline" size="sm" className="pointer-events-none">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Select File
              </Button>
            </>
          }
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8">
          {features.map((f, i) =>
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-card rounded-xl p-4 border border-border text-center">
            
              <f.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>);

}