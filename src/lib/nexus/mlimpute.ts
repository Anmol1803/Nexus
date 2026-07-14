// src/lib/nexus/mlImpute.ts

import type { Row, CellValue } from './types';

let mlModule: any = null;
let mlLoaded = false;

async function loadML() {
  if (mlLoaded) return mlModule;
  try {
    const module = await import('ml-random-forest');
    // The package may export as default or named
    mlModule = module.default || module;
    mlLoaded = true;
    // Log the keys to help debug
    console.log('ml-random-forest loaded. Keys:', Object.keys(mlModule));
    return mlModule;
  } catch (err) {
    console.warn('ml-random-forest not available – ML imputation disabled', err);
    return null;
  }
}

// Helper: check if a column is numeric
function isColumnNumeric(rows: Row[], col: string): boolean {
  let numericCount = 0;
  let total = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    total++;
    if (typeof v === 'number') numericCount++;
  }
  return total > 0 && (numericCount / total) > 0.8;
}

// Get numeric features (excluding target)
function getNumericFeatures(rows: Row[], target: string, columns: string[]): string[] {
  return columns.filter(c => c !== target && isColumnNumeric(rows, c));
}

// Get categorical features (excluding target)
function getCategoricalFeatures(rows: Row[], target: string, columns: string[]): string[] {
  return columns.filter(c => c !== target && !isColumnNumeric(rows, c) && rows.some(r => r[c] !== null));
}

// One-hot encode a categorical feature
function oneHotEncode(row: Row, feature: string, uniqueValues: string[]): number[] {
  const val = String(row[feature] ?? '');
  const arr = new Array(uniqueValues.length).fill(0);
  const idx = uniqueValues.indexOf(val);
  if (idx >= 0) arr[idx] = 1;
  return arr;
}

// Build feature vector for a row
function buildFeatureVector(
  row: Row,
  numericFeatures: string[],
  categoricalFeatures: string[],
  catUniqueValues: Record<string, string[]>
): number[] {
  const vec: number[] = [];
  for (const f of numericFeatures) {
    const v = row[f];
    vec.push(typeof v === 'number' ? v : 0);
  }
  for (const f of categoricalFeatures) {
    const unique = catUniqueValues[f] || [];
    vec.push(...oneHotEncode(row, f, unique));
  }
  return vec;
}

export interface MLImputationResult {
  imputedRows: Row[];
  recoveries: {
    rowIndex: number;
    column: string;
    value: CellValue;
    confidence: number;
    method: 'ML Imputation';
  }[];
}

export async function runMLImputation(
  rows: Row[],
  columns: string[],
  target: string,
  minCompleteRows = 30,
  testSize = 0.2
): Promise<MLImputationResult | null> {
  // 1. Load ML module
  const RF = await loadML();
  if (!RF) return null;

  // 2. Try to find classifier and regressor classes dynamically
  let RandomForestClassifier: any = null;
  let RandomForestRegressor: any = null;

  // First, check for common property names
  const possibleClassifierNames = [
    'RandomForestClassifier',
    'Classifier',
    'RandomForestClassification',
    'Classification'
  ];
  const possibleRegressorNames = [
    'RandomForestRegressor',
    'Regressor',
    'RandomForestRegression',
    'Regression'
  ];

  // If the module itself is a class constructor? Unlikely.
  // Better: iterate over all own properties
  const keys = Object.keys(RF);
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (possibleClassifierNames.some(name => lowerKey.includes(name.toLowerCase()))) {
      RandomForestClassifier = RF[key];
    }
    if (possibleRegressorNames.some(name => lowerKey.includes(name.toLowerCase()))) {
      RandomForestRegressor = RF[key];
    }
  }

  // If still not found, try accessing via default (if it's an object with these properties)
  if (!RandomForestClassifier && RF.default) {
    const defaultKeys = Object.keys(RF.default);
    for (const key of defaultKeys) {
      const lowerKey = key.toLowerCase();
      if (possibleClassifierNames.some(name => lowerKey.includes(name.toLowerCase()))) {
        RandomForestClassifier = RF.default[key];
      }
      if (possibleRegressorNames.some(name => lowerKey.includes(name.toLowerCase()))) {
        RandomForestRegressor = RF.default[key];
      }
    }
  }

  // If we still don't have them, log the module structure and give up
  if (!RandomForestClassifier || !RandomForestRegressor) {
    console.warn('Could not find classifier/regressor in ml-random-forest module. Keys:', keys, 'Default:', RF.default);
    return null;
  }

  // 3. Identify complete rows
  const numericFeatures = getNumericFeatures(rows, target, columns);
  const categoricalFeatures = getCategoricalFeatures(rows, target, columns);
  const allFeatures = [...numericFeatures, ...categoricalFeatures];

  if (allFeatures.length === 0) return null;

  const completeRows: Row[] = [];
  const incompleteRows: Row[] = [];
  for (const row of rows) {
    const hasTarget = row[target] !== null && row[target] !== undefined;
    const hasAllFeatures = allFeatures.every(f => row[f] !== null && row[f] !== undefined);
    if (hasTarget && hasAllFeatures) {
      completeRows.push(row);
    } else if (!hasTarget) {
      incompleteRows.push(row);
    }
  }

  if (completeRows.length < minCompleteRows || incompleteRows.length === 0) {
    return null;
  }

  // 4. Prepare training data
  const catUniqueValues: Record<string, string[]> = {};
  for (const f of categoricalFeatures) {
    const vals = new Set<string>();
    for (const row of completeRows) {
      const v = row[f];
      if (v !== null && v !== undefined) vals.add(String(v));
    }
    catUniqueValues[f] = Array.from(vals);
  }

  const isNumericTarget = isColumnNumeric(rows, target);
  let targetUnique: string[] = [];
  if (!isNumericTarget) {
    const targetSet = new Set<string>();
    for (const row of completeRows) {
      const v = row[target];
      if (v !== null && v !== undefined) targetSet.add(String(v));
    }
    targetUnique = Array.from(targetSet);
  }

  const X_train: number[][] = [];
  const y_train: number[] = [];
  for (const row of completeRows) {
    const vec = buildFeatureVector(row, numericFeatures, categoricalFeatures, catUniqueValues);
    X_train.push(vec);
    const targetVal = row[target];
    if (isNumericTarget) {
      y_train.push(typeof targetVal === 'number' ? targetVal : 0);
    } else {
      const strVal = String(targetVal ?? '');
      const idx = targetUnique.indexOf(strVal);
      y_train.push(idx >= 0 ? idx : 0);
    }
  }

  // 5. Train model
  let model: any;
  const options = {
    seed: 42,
    maxFeatures: Math.floor(Math.sqrt(X_train[0].length)),
    nEstimators: 100,
    maxDepth: 6,
    minSamplesSplit: 10,
    minSamplesLeaf: 5,
  };

  try {
    if (isNumericTarget) {
      model = new RandomForestRegressor(options);
    } else {
      model = new RandomForestClassifier(options);
    }
    model.train(X_train, y_train);
  } catch (err) {
    console.warn('ML training failed for', target, err);
    return null;
  }

  // 6. Estimate confidence using a hold‑out set
  const shuffled = [...completeRows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const splitIdx = Math.floor(shuffled.length * (1 - testSize));
  const valRows = shuffled.slice(splitIdx);

  let confidence = 0.5;
  if (valRows.length > 0) {
    const X_val: number[][] = [];
    const y_val: number[] = [];
    for (const row of valRows) {
      const vec = buildFeatureVector(row, numericFeatures, categoricalFeatures, catUniqueValues);
      X_val.push(vec);
      const targetVal = row[target];
      if (isNumericTarget) {
        y_val.push(typeof targetVal === 'number' ? targetVal : 0);
      } else {
        const strVal = String(targetVal ?? '');
        const idx = targetUnique.indexOf(strVal);
        y_val.push(idx >= 0 ? idx : 0);
      }
    }
    const predictions = model.predict(X_val);
    if (isNumericTarget) {
      let sumSq = 0;
      for (let i = 0; i < predictions.length; i++) {
        const diff = predictions[i] - y_val[i];
        sumSq += diff * diff;
      }
      const rmse = Math.sqrt(sumSq / predictions.length);
      const range = Math.max(1, Math.max(...y_val) - Math.min(...y_val));
      confidence = Math.max(0.3, 1 - (rmse / (range + 1)));
    } else {
      let correct = 0;
      for (let i = 0; i < predictions.length; i++) {
        if (predictions[i] === y_val[i]) correct++;
      }
      confidence = correct / predictions.length;
    }
  }

  // 7. Predict missing values
  const imputedRows = rows.map((row) => ({ ...row }));
  const recoveries: MLImputationResult['recoveries'] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (row[target] !== null && row[target] !== undefined) continue;

    const vec = buildFeatureVector(row, numericFeatures, categoricalFeatures, catUniqueValues);
    const pred = model.predict([vec])[0];

    let value: CellValue;
    if (isNumericTarget) {
      value = typeof pred === 'number' ? Math.round(pred * 100) / 100 : null;
    } else {
      const classIndex = Math.round(pred);
      if (classIndex >= 0 && classIndex < targetUnique.length) {
        value = targetUnique[classIndex];
      } else {
        value = null;
      }
    }

    imputedRows[idx][target] = value;
    recoveries.push({
      rowIndex: idx,
      column: target,
      value,
      confidence,
      method: 'ML Imputation',
    });
  }

  return { imputedRows, recoveries };
}