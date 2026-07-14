export type CellValue = string | number | null;
export type Row = Record<string, CellValue>;

export type ColumnKind = "numeric" | "categorical" | "date";

export interface ColumnProfile {
  name: string;
  kind: ColumnKind;
  missing: number;
  missingPct: number;
  // numeric
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  skewness?: number;
  kurtosis?: number;
  iqr?: number;
  outliers?: number;
  aggStrategy?: "Mean" | "Median";
  // categorical
  cardinality?: number;
  topValues?: { value: string; count: number }[];
  mode?: string;
}

export interface Dataset {
  columns: string[];
  rows: Row[];
  profiles: Record<string, ColumnProfile>;
}

export interface RelationshipMap {
  // per target column -> selected feature columns
  [target: string]: {
    categorical: { col: string; score: number }[];
    numeric: { col: string; score: number }[];
  };
}

export interface NumericRanges {
  // per numeric column -> sorted bin edges (length n+1)
  [col: string]: number[];
}

export interface GroupProfileStats {
  count: number;
  // per numeric column statistics
  numeric: Record<string, { mean: number; median: number; std: number }>;
  // per categorical column mode
  categorical: Record<string, { mode: string; modeFreq: number }>;
  // 0..1, higher = more reliable group for recovery
  reliability?: number;
}

export interface GroupProfileTable {
  // dimension columns used to build the key
  dimensions: string[];
  profiles: Map<string, GroupProfileStats>;
}

export type RecoveryMethod =
  | "Exact Group Match"
  | "Reduced Group Match"
  | "Partial Group Match"
  | "Reduced Partial Match"
  | "Range Match"
  | "Global Fallback"
  | "ML Imputation"
  | "Special Column"
  | "Skipped (low confidence)";

export interface RecoveryRecord {
  rowIndex: number;
  column: string;
  originalValue: CellValue;
  recoveredValue: CellValue;
  method: RecoveryMethod;
  groupKey: string;
  dimensions: string[];
  support: number;
  aggregation: string;
  confidence: number;
  reasoning: string;
  timestamp: string;
  pass?: number;
  reliability?: number;
  globalEstimate?: CellValue;
}

export interface ImpactReport {
  beforeCompletenessPct: number;
  afterCompletenessPct: number;
  perColumn: {
    column: string;
    missingBefore: number;
    missingAfter: number;
    recovered: number;
  }[];
}