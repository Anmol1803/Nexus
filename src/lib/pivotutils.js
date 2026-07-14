import { evaluate } from 'mathjs';

/* ---------- Aggregation helper ---------- */
export function aggregate(rawValues, agg) {
  if (agg === 'countAll') return rawValues.length;
  if (agg === 'distinctCount') {
    const unique = new Set(rawValues.map(v => String(v ?? '(blank)')));
    return unique.size;
  }
  const nums = rawValues
    .map(v => {
      const n = Number(v);
      return isNaN(n) ? null : n;
    })
    .filter(v => v !== null);
  if (nums.length === 0) return null;
  switch (agg) {
    case 'sum':        return nums.reduce((a, b) => a + b, 0);
    case 'average':    return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'count':      return nums.length;
    case 'min':        return Math.min(...nums);
    case 'max':        return Math.max(...nums);
    case 'median': {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    default:           return null;
  }
}

/* ---------- Grouping transform ---------- */
export function applyGroupTransform(value, groupBy) {
  if (!groupBy) return String(value ?? '(blank)');
  if (groupBy.type === 'date') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Invalid Date';
    switch (groupBy.period) {
      case 'year':     return d.getFullYear().toString();
      case 'quarter':  return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
      case 'month':    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      case 'day':      return d.toLocaleDateString();
      default:         return d.toLocaleDateString();
    }
  }
  if (groupBy.type === 'numeric') {
    const n = Number(value);
    if (isNaN(n)) return '(blank)';
    const step = groupBy.step || 10;
    const lower = Math.floor(n / step) * step;
    return `${lower} - ${lower + step}`;
  }
  return String(value ?? '(blank)');
}

/* ---------- Build a flat list of leaves (records + path) ---------- */
function getLeaves(data, fields, maxLeaves = Infinity) {
  const result = [];
  const recurse = (rows, depth, path) => {
    if (depth >= fields.length) {
      // Leaf – store records and path
      result.push({ records: rows, path: [...path] });
      return;
    }
    if (result.length >= maxLeaves) return;
    const fieldConfig = fields[depth];
    const field = fieldConfig.field;
    const groups = new Map();
    rows.forEach(row => {
      const raw = row[field];
      const key = fieldConfig.groupBy ? applyGroupTransform(raw, fieldConfig.groupBy) : String(raw ?? '(blank)');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    for (const [key, groupRows] of groups) {
      recurse(groupRows, depth + 1, [...path, key]);
    }
  };
  recurse(data, 0, []);
  return result;
}

/* ---------- MAIN pivot computation ---------- */
export function computePivot(data, rowFields, colFields, valueConfigs, filters = [], valueFilters = []) {
  const MAX_COL_LEAVES = 100;
  const MAX_ROW_LEAVES = 200;

  // Apply row‑level filters
  let filteredData = [...data];
  [...rowFields, ...colFields, ...filters].forEach(fc => {
    if (fc.filterValues && fc.filterValues.length > 0) {
      filteredData = filteredData.filter(row => {
        const raw = String(row[fc.field] ?? '(blank)');
        return fc.filterValues.includes(raw);
      });
    }
  });

  // Build row leaves and column leaves
  const rowLeaves = getLeaves(filteredData, rowFields, MAX_ROW_LEAVES);
  const colLeaves = getLeaves(filteredData, colFields, MAX_COL_LEAVES);
  const rowTruncated = rowLeaves.length >= MAX_ROW_LEAVES;
  const colTruncated = colLeaves.length >= MAX_COL_LEAVES;

  // Build the leaf grid: rowLeaves x colLeaves
  const leafGrid = rowLeaves.map(rowLeaf => {
    return colLeaves.map(colLeaf => {
      // Find records that are in both rowLeaf and colLeaf
      // To do this efficiently, we can use a Set intersection
      // Since records are objects, we need a way to compare them – use a unique id or index.
      // Here we assume each record has a unique _id, or we can use JSON.stringify.
      // For simplicity, we'll use a Set of the row records and filter col records.
      const rowSet = new Set(rowLeaf.records);
      const intersection = colLeaf.records.filter(r => rowSet.has(r));
      // Now aggregate each value config over the intersection
      const cell = {};
      valueConfigs.forEach(vc => {
        const rawValues = intersection.map(r => r[vc.field]);
        cell[vc.key] = aggregate(rawValues, vc.aggregation);
      });
      return cell;
    });
  });

  // Compute row totals (aggregate over all columns for this row leaf)
  const rowTotals = rowLeaves.map(rowLeaf => {
    const total = {};
    valueConfigs.forEach(vc => {
      const rawValues = rowLeaf.records.map(r => r[vc.field]);
      total[vc.key] = aggregate(rawValues, vc.aggregation);
    });
    return total;
  });

  // Compute column grand totals (aggregate over all rows for this column leaf)
  const colGrandTotals = colLeaves.map(colLeaf => {
    const total = {};
    valueConfigs.forEach(vc => {
      const rawValues = colLeaf.records.map(r => r[vc.field]);
      total[vc.key] = aggregate(rawValues, vc.aggregation);
    });
    return total;
  });

  // Compute grand total (over all data)
  const grandTotal = {};
  valueConfigs.forEach(vc => {
    const rawValues = filteredData.map(r => r[vc.field]);
    grandTotal[vc.key] = aggregate(rawValues, vc.aggregation);
  });

  // Rank maps (based on row totals)
  const rankMaps = {};
  valueConfigs.forEach(vc => {
    const allVals = rowTotals.map(rt => rt[vc.key]).filter(v => v != null);
    const uniqueSorted = [...new Set(allVals)].sort((a, b) => b - a);
    const rankMap = new Map();
    uniqueSorted.forEach((val, idx) => rankMap.set(val, idx + 1));
    rankMaps[vc.key] = rankMap;
  });

  // Build a row tree for expansion (optional, but needed for subtotals)
  // We'll build a simple tree from rowLeaves and their paths.
  // This is a simplified version – for subtotals we'll compute on the fly.
  // For now, we'll create a tree structure with subtotalGrid computed from rowTotals of children.
  // Since we have flat rowLeaves, we can build a nested map.
  const buildTree = (leaves, depth = 0) => {
    if (depth >= rowFields.length) {
      // Leaf node – store the leaf index
      return { children: null, records: leaves.map(l => l.records).flat(), leafIndex: leaves[0]?.leafIndex ?? 0 };
    }
    const groups = new Map();
    leaves.forEach(leaf => {
      const key = leaf.path[depth];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(leaf);
    });
    const children = new Map();
    for (const [key, groupLeaves] of groups) {
      children.set(key, buildTree(groupLeaves, depth + 1));
    }
    // Compute subtotal grid for this node: aggregate over all children leaves
    // For each column leaf, aggregate the values from all descendant leaves.
    const allDescendantLeaves = leaves;
    const subtotalGrid = colLeaves.map((colLeaf, ci) => {
      const cell = {};
      valueConfigs.forEach(vc => {
        const rawValues = allDescendantLeaves.flatMap(l => l.records.map(r => r[vc.field]));
        cell[vc.key] = aggregate(rawValues, vc.aggregation);
      });
      return cell;
    });
    // Row total
    const rowTotal = {};
    valueConfigs.forEach(vc => {
      const rawValues = allDescendantLeaves.flatMap(l => l.records.map(r => r[vc.field]));
      rowTotal[vc.key] = aggregate(rawValues, vc.aggregation);
    });
    return { children, records: allDescendantLeaves.flatMap(l => l.records), leafIndex: null, subtotalGrid, rowTotal };
  };

  // Build row tree from the rowLeaves array (need to store leafIndex in each leaf)
  rowLeaves.forEach((leaf, idx) => leaf.leafIndex = idx);
  const rowTree = buildTree(rowLeaves);

  return {
    rowTree,
    colTree: null, // Not needed for rendering, we use colLeaves directly
    rowLeaves,
    colLeaves,
    leafGrid,
    grandTotal,
    colGrandTotals,
    valueConfigs,
    rowFields,
    colFields,
    filteredData,
    colTruncated,
    rowTruncated,
    rowTotals,
    rankMaps,
  };
}