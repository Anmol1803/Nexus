<div align="center">

<br/>

<img src="https://raw.githubusercontent.com/your-username/nexus-data-studio/main/Nexus_edited.png" alt="Nexus Logo" width="155"/>

<br/><br/>

# ✦ Nexus Data Studio

### *Your all-in-one intelligent workspace for data cleaning, analysis & visualization*

<br/>

<!-- ============================================================ -->
<!--                   🔥 LIVE DEMO BANNER                        -->
<!-- ============================================================ -->

<a href="https://nexus-smoky-two.vercel.app/" target="_blank">
  <img src="https://img.shields.io/badge/🌐%20%20LIVE%20DEMO%20%20—%20%20nexus--smoky--two.vercel.app-%236366f1?style=for-the-badge&labelColor=0f0f1a&color=6366f1&logoColor=white" alt="Live Demo" height="42"/>
</a>

<br/><br/>

> ### 👆 [**Click here to try Nexus live →**](https://nexus-smoky-two.vercel.app/)
> *No signup. No install. Just drag a CSV and go.*

<br/>

---

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-components-18181B?style=for-the-badge&logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![Recharts](https://img.shields.io/badge/Recharts-Charts-22c55e?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://recharts.org/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

<br/>

> **Drag in a CSV. Get instant EDA, smart AI fill, formula columns, 10+ chart types, pivot tables, and a full transformation audit trail — all in the browser. Zero setup. Zero server.**

<br/>

---

</div>

<br/>

## 🗺️ What is Nexus?

**Nexus Data Studio** is a fully client-side data workspace built for analysts, data scientists, and developers who need to clean, explore, and transform CSV data — fast, without spinning up a Python environment or paying for a SaaS tool.

Everything runs in your browser. Your data never leaves your machine.

<br/>

---

## ✨ Feature Overview

<div align="center">

| 🔬 EDA | 🧹 Clean & Fill | 🔢 Type Conversion |
|:------:|:---------------:|:-----------------:|
| Auto-stats, histograms, donut charts, skewness/outlier flags | Mean/Median/Mode/AI fill, dedup, trim | Integer, Float, Date, Boolean, Percentage |

| 🔡 Text Cleaning | 📅 Date & Time | ⚙️ Feature Engineering |
|:----------------:|:--------------:|:----------------------:|
| Case, Regex, Categorical standardization | Parse, extract components, date diff | Math ops, conditional columns, concat, Excel formulas |

| 📈 Chart Builder | 🧮 Pivot Table | 🕒 History & Undo |
|:----------------:|:--------------:|:-----------------:|
| 10 chart types, save configs | Heatmap pivot with grand totals | Full audit trail, per-step undo |

</div>

<br/>

---

## ⚡ Feature Deep-Dives

<br/>

### 🔬 Exploratory Data Analysis (EDA)
> *Know your data before you touch it.*

- **Auto column-type detection** — Numeric, Categorical, Date, Boolean
- **Full statistical summary** per column — Mean, Median, Std Dev, Q1/Q3, IQR, Skewness, Kurtosis, Outlier count
- **Inline mini charts** — Histogram for numeric, Donut for categorical, Year/Weekday bars for dates
- **Insight alerts** — Flags skewed distributions, high missing rates, high cardinality, zero variance
- **One-click EDA report export** as CSV with all computed stats

<br/>

### 🧹 Data Cleaning & Smart Fill
> *Fix messy data without writing a single line of code.*

| Method | What it does |
|--------|-------------|
| **Mean / Median / Mode** | Statistical imputation per column |
| **Forward / Backward Fill** | Time-series style propagation |
| **Custom Value** | Fill with any literal string or number |
| **✨ AI Smart Fill** | LLM infers best fill value per column with reasoning |
| **Remove Duplicates** | Hash-based full-row deduplication |
| **Drop Rows with Missing** | Strict row removal |
| **Trim Whitespace** | Clean all string cells at once |
| **Find & Replace** | Global exact-match cell substitution |

<br/>

### 📊 Outlier Removal
> *Two battle-tested methods, live preview before you commit.*

```
IQR Method:   Lower = Q1 − k×IQR   |   Upper = Q3 + k×IQR   (default k = 1.5)
Z-Score:      Outlier if  |z| > threshold                     (default threshold = 3)
```

- Choose **Remove rows** or **Cap to median**
- Live outlier count updates as you adjust threshold
- Full undo via Transformation History

<br/>

### 🔢 Data Type Conversion
> *From messy strings to clean typed columns in one click.*

```
Integer  │  Float  │  Number (auto)  │  Text  │  Category
Date (YYYY-MM-DD)  │  DateTime (ISO 8601)  │  Boolean  │  Percentage
```

- Live per-row conversion preview before applying
- Error handling: **Replace with null** | **Keep original** | **Mark as INVALID**
- Column Type Overview grid — click any column to switch focus

<br/>

### 🔡 Text Cleaning
> *Standardize messy categorical and string data.*

- **Case Conversion** — UPPER / lower / Title Case with live preview
- **Regex Find & Replace** — Full regex engine, one column or all, flag control (`g`, `gi`, `i`)
- **Categorical Standardization** — Map many raw variants to one canonical form

```
"USA"  "U.S.A"  "us"  "united states"   →   "United States"
```

<br/>

### 📅 Date & Time Panel
> *Tame your date columns.*

- **Parse / Normalize** — Any format → `YYYY-MM-DD` with live preview
- **Extract Components** — Year, Month, Month Name, Day, Weekday, Hour, Minute, Quarter → new column
- **Date Difference** — `Col A − Col B` in Days / Hours / Minutes → new column

<br/>

### ⚙️ Feature Engineering
> *Build new columns without code.*

#### 🧮 Formula Builder *(Excel-style, 35+ functions)*

| Category | Functions |
|----------|-----------|
| **Logical** | `IF`, `IFS`, `AND`, `OR`, `NOT`, `COALESCE`, `ISNULL`, `ISNUMBER` |
| **Text** | `CONCAT`, `TEXTJOIN`, `LEFT`, `RIGHT`, `MID`, `TRIM`, `UPPER`, `LOWER`, `PROPER`, `LEN`, `REPLACE` |
| **Math** | `SUM`, `ROUND`, `ABS`, `CEILING`, `FLOOR`, `MOD`, `SQRT`, `POWER`, `LOG` |
| **Date** | `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DATEDIFF` |
| **Statistical** | `AVG`, `MEDIAN`, `MIN`, `MAX`, `COUNT` |

```
= IF(Sales > 1000, "High", "Low")
= ROUND([Revenue] / [Units], 2)
= DATEDIFF([EndDate], [StartDate], "days")
= TEXTJOIN(" ", [FirstName], [LastName])
```

#### ➕ Math Operation Panel
```
Column A  [+  −  ×  ÷  %  ^]  Column B / Constant  →  New Column
```

#### 🔀 Conditional Column
```
IF (col  [> >= < <= == !=]  value)  THEN "X"  ELSE "Y"  →  New Column
```

#### 🔗 Concatenate Columns
Select N columns + separator → merged new column with live preview

<br/>

### 📈 Chart Builder
> *10 chart types. Zero configuration required.*

| Chart Type | Best For |
|-----------|----------|
| **Bar** | Category comparisons |
| **Stacked Bar** | Part-to-whole breakdown by group |
| **Line** | Trends over time |
| **Area** | Cumulative trend visualization |
| **Scatter** | Correlation between 2 numeric columns |
| **Bubble** | 3-variable scatter (size = 3rd variable) |
| **Pie / Donut** | Proportions and share |
| **Histogram** | Distribution shape of a numeric column |
| **Radar** | Multi-axis comparisons |

**Controls:** X/Y axis · Aggregation (sum / mean / count / min / max / median) · Color/Series split · Sort order · Row limit · Column filter · Chart title

**💾 Save Charts** — Pin any config to a gallery for instant recall

<br/>

### 🧮 Pivot Table
> *Spreadsheet-power pivot in the browser.*

- Row × Column × Value with 5 aggregation functions
- **Heat-map cell shading** based on relative magnitude
- Grand Total row + per-row totals
- **Export pivot as CSV**
- Auto-generated companion bar chart

<br/>

### 🗂️ Edit Data (DataTable)
> *Full spreadsheet-style data editor.*

- Click any cell to edit inline via modal
- **Add / delete rows and columns**
- **Formula columns** — inline formula engine with column chips
- **Column-level filters** — Contains, Equals, GT/LT, Between, Is Empty, and more
- **Global search** across all columns simultaneously
- **Sort** any column ascending / descending
- **Multi-row select** + bulk delete
- **Pagination** — 25 rows per page
- **Export filtered view** as CSV

<br/>

### 🕒 Transformation History
> *Every action is logged. Nothing is permanent.*

- Unified audit trail across **all panels**
- Per-entry **Undo** — restores exact pre-operation data snapshot
- **Filter** history by operation source (Clean, Fill, AI, Formula, etc.)
- **Export** the full audit trail as CSV
- Color-coded badges per operation type

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
| **Notifications** | Sonner (toast) |
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
│   │   │   ├── FileUpload.jsx                  # CSV/TSV drag-drop parser
│   │   │   ├── DataWorkspace.jsx               # Root tab shell + global state
│   │   │   ├── EDAPanel.jsx                    # Column-level stats & charts
│   │   │   ├── CleaningPanel.jsx               # Fill, dedup, trim, outliers
│   │   │   ├── TypeConversionPanel.jsx         # Data type coercion
│   │   │   ├── TextCleaningPanel.jsx           # Case, regex, standardization
│   │   │   ├── DateTimePanel.jsx               # Parse, extract, diff
│   │   │   ├── FeatureEngineeringPanel.jsx     # Math, conditional, concat
│   │   │   ├── FormulaEngine.jsx               # Excel-style formula builder
│   │   │   ├── ChartBuilder.jsx                # 10-type chart builder
│   │   │   ├── PivotTablePanel.jsx             # Pivot table with heat-map
│   │   │   ├── DataTable.jsx                   # Editable paginated data grid
│   │   │   ├── TransformationHistoryPanel.jsx  # Audit trail + undo
│   │   │   ├── ColumnEDAPreview.jsx            # Inline column stats widget
│   │   │   ├── AddColumnModal.jsx              # Add blank column dialog
│   │   │   └── EditCellModal.jsx               # Cell edit dialog
│   │   └── ui/                                 # shadcn/ui component library
│   ├── lib/
│   │   └── TransformationHistory.jsx           # React context for audit log
│   ├── pages/
│   │   └── Home.jsx
│   ├── App.jsx
│   └── main.jsx
├── Nexus_edited.png                            # App logo
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

## 📖 Usage Flow

```
1. 📂  Drag & drop any CSV or TSV onto the upload zone
        └─ Auto-detects delimiter: comma · semicolon · tab · pipe

2. 📊  EDA tab opens automatically
        └─ Scan column types, missing rates, distributions & auto-insights

3. 🧹  Clean & Fill
        └─ Fill missing values, remove duplicates, handle outliers

4. 🔢  Data Types  →  Convert columns to the correct type

5. 🔡  Text Cleaning  →  Fix case, regex-replace, standardize categories

6. 📅  Date & Time  →  Normalize dates, extract components, compute diffs

7. ⚙️  Feature Engineering  →  Build new columns with formulas or math

8. 📈  Chart Builder  →  Visualize in 10+ chart types, save configs

9. 🧮  Pivot Table  →  Aggregate & cross-tabulate, export result

10. 🗂️  Edit Data  →  Cell-level edits, add/delete rows & columns

11. 🕒  History  →  Review every transformation, undo any step instantly
```

<br/>

---

## 🧠 How AI Smart Fill Works

When you click **AI Smart Fill**, Nexus:

1. Samples the first 10 rows + column type metadata
2. Sends a structured prompt identifying all columns with missing values
3. The LLM returns — for each column — a `fill_value`, `method`, and `reason`
4. Values are applied in a single pass across all rows
5. Each filled column gets its own log entry with the AI's reasoning visible
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

Please follow the existing code style — functional React, Tailwind, shadcn/ui.

<br/>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<br/>

---

<div align="center">

<img src="https://raw.githubusercontent.com/your-username/nexus-data-studio/main/Nexus_edited.png" alt="Nexus Logo" width="72"/>

<br/><br/>

**Made with ❤️ and way too much data**

<br/>

<a href="https://nexus-smoky-two.vercel.app/" target="_blank">
  <img src="https://img.shields.io/badge/🚀%20%20Open%20Nexus%20Data%20Studio-%236366f1?style=for-the-badge&labelColor=0f0f1a&color=6366f1" alt="Open App" height="38"/>
</a>

<br/><br/>

*If Nexus saved you time, drop a ⭐ — it means the world!*

<br/>

</div>
