<div align="center">

<br/>

<img src="./Nexus.png" alt="Nexus Logo" width="160"/>

<br/>

<img src="https://img.shields.io/badge/Nexus-Data%20Studio-6366f1?style=for-the-badge&logo=databricks&logoColor=white" alt="Nexus Data Studio" height="50"/>

<br/><br/>

# ✦ Nexus Data Studio

### *Your all-in-one intelligent workspace for data cleaning, analysis & visualization*

<br/>

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-nexus--smoky--two.vercel.app-6366f1?style=for-the-badge&logoColor=white)](https://nexus-smoky-two.vercel.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

<br/>

> **Drag in a CSV. Get instant EDA, smart AI fill, formula columns, charts, pivot tables, and a full transformation audit trail — all in the browser. Zero setup. Zero server.**

<br/>

---

</div>

<br/>

## 📸 Preview

<div align="center">

| Upload & EDA | Clean & Fill | Chart Builder |
|:---:|:---:|:---:|
| ![upload](https://img.shields.io/badge/Upload-CSV%20%2F%20TSV-emerald?style=flat-square) | ![clean](https://img.shields.io/badge/AI-Smart%20Fill-violet?style=flat-square) | ![chart](https://img.shields.io/badge/10%2B-Chart%20Types-orange?style=flat-square) |
| Auto-detect delimiter, instant stats | Median / Mode / AI imputation | Bar, Line, Scatter, Pie, Radar… |

</div>

<br/>

---

## ⚡ Feature Highlights

<br/>

### 🔬 Exploratory Data Analysis (EDA)
> *Know your data before you touch it.*

- **Auto column-type detection** — Numeric, Categorical, Date, Boolean
- **Full statistical summary** per column — Mean, Median, Std Dev, Q1/Q3, IQR, Skewness, Kurtosis, Outlier count
- **Inline mini charts** — Histogram for numeric, Donut for categorical, Year/Weekday bars for dates
- **Insight alerts** — Flags skewed distributions, high missing rates, high cardinality, zero variance
- **One-click EDA report export** as CSV with all stats

<br/>

### 🧹 Data Cleaning & Smart Fill
> *Fix messy data without writing a single line of code.*

| Method | What it does |
|--------|-------------|
| **Mean / Median / Mode** | Statistical imputation per column |
| **Forward / Backward Fill** | Time-series style propagation |
| **Custom Value** | Fill with any literal string or number |
| **AI Smart Fill** | Uses an LLM to infer the best fill value per column, with reasoning |
| **Remove Duplicates** | Hash-based full-row deduplication |
| **Drop Rows with Missing** | Strict row removal |
| **Trim Whitespace** | Clean all string cells at once |
| **Find & Replace** | Global cell-level substitution |

<br/>

### 📊 Outlier Removal
> *Two battle-tested methods, live preview before you commit.*

```
IQR Method:   Lower = Q1 − k×IQR   |   Upper = Q3 + k×IQR   (default k = 1.5)
Z-Score:      Outlier if  |z| > threshold                     (default threshold = 3)
```

- Choose **Remove rows** or **Cap to median**
- Live detection count updates as you adjust threshold
- Full undo via Transformation History

<br/>

### 🔢 Data Type Conversion
> *From messy strings to clean typed columns in one click.*

Supported target types:

```
Integer  │  Float  │  Number (auto)  │  Text  │  Category
Date (YYYY-MM-DD)  │  DateTime (ISO 8601)  │  Boolean  │  Percentage
```

- Live preview shows per-row conversion result before applying
- Error handling modes: **Replace with null** | **Keep original** | **Mark as INVALID**
- Column Type Overview grid — click any column to instantly switch focus

<br/>

### 🔡 Text Cleaning
> *Standardize messy categorical and string data.*

- **Case Conversion** — UPPER / lower / Title Case with live preview
- **Regex Find & Replace** — Full regex engine, apply to one column or all, with flag control (`g`, `gi`, `i`)
- **Categorical Standardization** — Map multiple raw values to a single canonical form (e.g. `"USA"`, `"U.S.A"`, `"us"` → `"United States"`)
- Auto-loads top-N most frequent values for quick mapping setup

<br/>

### 📅 Date & Time Panel
> *Tame your date columns.*

- **Parse / Normalize** — Any format → `YYYY-MM-DD` with live preview
- **Extract Components** — Year, Month, Month Name, Day, Weekday, Hour, Minute, Quarter → new column
- **Date Difference** — `Col A − Col B` in Days / Hours / Minutes → new column

<br/>

### ⚙️ Feature Engineering
> *Build new columns without code.*

#### Formula Builder *(Excel-style)*
Full function library with autocomplete and inline hints:

| Category | Functions |
|----------|-----------|
| **Logical** | `IF`, `IFS`, `AND`, `OR`, `NOT`, `COALESCE`, `ISNULL`, `ISNUMBER` |
| **Text** | `CONCAT`, `TEXTJOIN`, `LEFT`, `RIGHT`, `MID`, `TRIM`, `UPPER`, `LOWER`, `PROPER`, `LEN`, `REPLACE` |
| **Math** | `SUM`, `ROUND`, `ABS`, `CEILING`, `FLOOR`, `MOD`, `SQRT`, `POWER`, `LOG` |
| **Date** | `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DATEDIFF` |
| **Statistical** | `AVG`, `MEDIAN`, `MIN`, `MAX`, `COUNT` |

```excel
= IF(Sales > 1000, "High", "Low")
= ROUND([Revenue] / [Units], 2)
= DATEDIFF([EndDate], [StartDate], "days")
= TEXTJOIN(" ", [FirstName], [LastName])
```

#### Math Operation Panel
`Column A  [+  −  ×  ÷  %  ^]  Column B / Constant  →  New Column`

#### Conditional Column
`IF (col  [> >= < <= == !=]  value)  THEN "X"  ELSE "Y"  →  New Column`

#### Concatenate Columns
Select N columns + separator → merged new column with live preview

<br/>

### 📈 Chart Builder
> *10 chart types. Zero configuration required.*

| Chart | Best for |
|-------|----------|
| **Bar** | Category comparisons |
| **Stacked Bar** | Part-to-whole by group |
| **Line** | Trends over time |
| **Area** | Cumulative trends |
| **Scatter** | Correlation between 2 numerics |
| **Bubble** | 3-variable scatter |
| **Pie / Donut** | Proportions |
| **Histogram** | Distribution shape |
| **Radar** | Multi-axis comparisons |

**Controls:** X/Y axis, Aggregation (sum / mean / count / min / max / median), Color/Series split, Sort order, Row limit, Column filter, Chart title

**Save Charts** — Pin any configuration to a gallery for quick recall

<br/>

### 🧮 Pivot Table
> *Spreadsheet-power pivot in the browser.*

- Row field × Column field × Value field with 5 aggregation functions
- **Heat-map shading** on cells (relative magnitude)
- Grand Total row + per-row totals
- **Export pivot as CSV**
- Companion bar chart auto-generated from pivot result

<br/>

### 🗂️ Edit Data (DataTable)
> *Full spreadsheet-style data editor.*

- Click any cell to edit in a modal
- **Add / delete rows and columns**
- **Formula columns** — inline formula engine with column chips
- **Column-level filters** — Contains, Equals, GT/LT, Between, Is Empty, and more
- **Global search** across all columns
- **Sort** any column ascending / descending
- **Multi-row select** + bulk delete
- **Pagination** — 25 rows per page
- **Export filtered view as CSV**

<br/>

### 🕒 Transformation History
> *Every action is logged. Nothing is permanent.*

- Unified audit trail across **all panels** — Cleaning, Fill, Type Conversion, Text, DateTime, Feature Engineering, Formula
- Per-entry **Undo** — restores exact data snapshot
- **Filter** history by operation type
- **Export** full audit trail as CSV
- Color-coded badges per operation source

<br/>

---

## 🏗️ Tech Stack

<div align="center">

| Layer | Technology |
|:------|:----------|
| **Framework** | React 18 + Vite 5 |
| **Styling** | Tailwind CSS v3 |
| **UI Components** | shadcn/ui (Radix UI primitives) |
| **Charts** | Recharts |
| **Animations** | Framer Motion |
| **Dates** | date-fns |
| **Notifications** | Sonner |
| **Deployment** | Vercel |

</div>

<br/>

---

## 📁 Project Structure

```
nexus/
├── src/
│   ├── components/
│   │   ├── data/
│   │   │   ├── FileUpload.jsx           # CSV/TSV drag-drop parser
│   │   │   ├── DataWorkspace.jsx        # Root tab shell + state
│   │   │   ├── EDAPanel.jsx             # Column-level statistics & charts
│   │   │   ├── CleaningPanel.jsx        # Fill, dedup, trim, outlier removal
│   │   │   ├── TypeConversionPanel.jsx  # Data type coercion
│   │   │   ├── TextCleaningPanel.jsx    # Case, regex, standardization
│   │   │   ├── DateTimePanel.jsx        # Parse, extract, diff
│   │   │   ├── FeatureEngineeringPanel.jsx  # Math, conditional, concat
│   │   │   ├── FormulaEngine.jsx        # Excel-style formula builder
│   │   │   ├── ChartBuilder.jsx         # 10-type interactive chart builder
│   │   │   ├── PivotTablePanel.jsx      # Pivot table with heat-map
│   │   │   ├── DataTable.jsx            # Editable paginated data grid
│   │   │   ├── TransformationHistoryPanel.jsx  # Audit trail + undo
│   │   │   ├── ColumnEDAPreview.jsx     # Inline column stats mini-widget
│   │   │   ├── ActivityLog.jsx          # Legacy log component
│   │   │   ├── AddColumnModal.jsx       # Add blank column dialog
│   │   │   └── EditCellModal.jsx        # Cell edit dialog
│   │   └── ui/                          # shadcn/ui component library
│   ├── lib/
│   │   └── TransformationHistory.jsx    # React context for undo/redo log
│   ├── pages/
│   │   └── Home.jsx
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

<br/>

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- npm or yarn

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/your-username/nexus-data-studio.git
cd nexus-data-studio

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
# Output goes to /dist — deploy anywhere static files are served
```

<br/>

---

## 📖 Usage Guide

```
1. 📂  Drag & drop any CSV or TSV file onto the upload zone
        └─ Auto-detects delimiter (comma, semicolon, tab, pipe)

2. 📊  EDA tab opens automatically
        └─ Scan column types, missing rates, distributions & insights

3. 🧹  Switch to Clean & Fill
        └─ Fill missing values, remove duplicates, handle outliers

4. 🔢  Data Types  →  Convert columns to correct types

5. 🔡  Text Cleaning  →  Fix case, regex replace, standardize categories

6. 📅  Date & Time  →  Normalize dates, extract components, compute diffs

7. ⚙️  Feature Engineering  →  Build new columns with formulas or math ops

8. 📈  Chart Builder  →  Visualize in 10+ chart types, save chart configs

9. 🧮  Pivot Table  →  Aggregate & cross-tabulate, export result

10. 🗂️  Edit Data  →  Cell-level edits, add/delete rows & columns

11. 🕒  History  →  Review every transformation, undo any step
```

<br/>

---

## 🧠 How AI Smart Fill Works

When you click **AI Smart Fill**, Nexus:

1. Samples the first 10 rows + column metadata
2. Sends a structured prompt to the LLM identifying all columns with missing data
3. LLM returns — for each column — a `fill_value`, `method`, and `reason`
4. Values are applied in one pass
5. Each filled column gets its own log entry with the AI's reasoning
6. A single **bulk undo** entry lets you revert all AI fills at once

<br/>

---

## 🤝 Contributing

Contributions are welcome!

```bash
# Fork → feature branch → PR

git checkout -b feature/my-awesome-feature
git commit -m "feat: add my awesome feature"
git push origin feature/my-awesome-feature
# Open a Pull Request
```

Please follow the existing code style (functional React, Tailwind, shadcn/ui).

<br/>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<br/>

---

<div align="center">

Made with ❤️ and way too much data

[![Live Demo](https://img.shields.io/badge/Try%20it%20now-nexus--smoky--two.vercel.app-6366f1?style=for-the-badge)](https://nexus-smoky-two.vercel.app/)

<br/>

*If this project helped you, drop a ⭐ — it means a lot!*

</div>
