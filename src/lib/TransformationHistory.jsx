// Global Transformation History Context
// Provides shared undo/redo history across ALL panels

import React, { createContext, useContext, useState, useCallback } from "react";

const HistoryContext = createContext(null);

export function TransformationHistoryProvider({ children }) {
  const [history, setHistory] = useState([]); // [{id, timestamp, action, source, snapshot, description, detail}]

  const addEntry = useCallback((entry) => {
    setHistory(prev => [{
      ...entry,
      id: Date.now() + Math.random(),
      timestamp: new Date(),
    }, ...prev]);
  }, []);

  const removeEntry = useCallback((id) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <HistoryContext.Provider value={{ history, addEntry, removeEntry, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useTransformationHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useTransformationHistory must be used within TransformationHistoryProvider");
  return ctx;
}