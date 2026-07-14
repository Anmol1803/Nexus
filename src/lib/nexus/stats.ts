export function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}
export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  return Math.sqrt(v / (xs.length - 1));
}
export function quantile(sortedAsc: number[], q: number): number {
  if (!sortedAsc.length) return NaN;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = std(xs);
  if (!s) return 0;
  let sum = 0;
  for (const x of xs) sum += ((x - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * sum;
}
export function kurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const s = std(xs);
  if (!s) return 0;
  let sum = 0;
  for (const x of xs) sum += ((x - m) / s) ** 4;
  return sum / n - 3;
}
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const d = Math.sqrt(da * db);
  return d ? num / d : 0;
}
export function mode<T extends string | number>(xs: T[]): { value: T; count: number } | null {
  if (!xs.length) return null;
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let best: T | null = null;
  let bc = -1;
  for (const [k, v] of m) if (v > bc) { best = k; bc = v; }
  return best === null ? null : { value: best, count: bc };
}
// Correlation ratio: how much a categorical column explains a numeric one (0..1)
export function correlationRatio(cats: string[], nums: number[]): number {
  const groups = new Map<string, number[]>();
  for (let i = 0; i < cats.length; i++) {
    const g = groups.get(cats[i]) ?? [];
    g.push(nums[i]);
    groups.set(cats[i], g);
  }
  const overall = mean(nums);
  let ssBetween = 0;
  let ssTotal = 0;
  for (const x of nums) ssTotal += (x - overall) ** 2;
  for (const g of groups.values()) {
    const gm = mean(g);
    ssBetween += g.length * (gm - overall) ** 2;
  }
  return ssTotal > 0 ? Math.sqrt(ssBetween / ssTotal) : 0;
}

// Cramer's V for categorical-categorical association
export function cramersV(cats1: string[], cats2: string[]): number {
  if (cats1.length !== cats2.length || cats1.length < 2) return 0;
  const n = cats1.length;

  const unique1 = Array.from(new Set(cats1));
  const unique2 = Array.from(new Set(cats2));
  const table: number[][] = unique1.map(() => unique2.map(() => 0));
  for (let i = 0; i < n; i++) {
    const i1 = unique1.indexOf(cats1[i]);
    const i2 = unique2.indexOf(cats2[i]);
    if (i1 !== -1 && i2 !== -1) table[i1][i2]++;
  }

  const rowSums = table.map(row => row.reduce((a, b) => a + b, 0));
  const colSums = unique2.map((_, j) => table.reduce((sum, row) => sum + row[j], 0));
  const total = n;

  let chi2 = 0;
  for (let i = 0; i < unique1.length; i++) {
    for (let j = 0; j < unique2.length; j++) {
      const expected = (rowSums[i] * colSums[j]) / total;
      if (expected > 0) {
        const diff = table[i][j] - expected;
        chi2 += (diff * diff) / expected;
      }
    }
  }

  const phi2 = chi2 / total;
  const k = Math.min(unique1.length, unique2.length);
  const cramer = Math.sqrt(phi2 / Math.max(1, k - 1));
  return isNaN(cramer) ? 0 : cramer;
}