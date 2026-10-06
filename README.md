# Global Well-Being Explorer

An interactive data story exploring the relationship between economic capacity, health outcomes, and happiness across 157 countries.

## Live Demo

```bash
# Serve locally — no build step required
python -m http.server 8080
# Open http://localhost:8080
```

## Architecture

```
index.html              ← Single-page application (no frameworks)
styles/
  main.css              ← Dark theme, CSS variables, responsive
scripts/
  DataManager.js        ← Centralised CSV loading, parsing, queries
  ScatterChart.js       ← GDP vs Happiness (log scale, region colours)
  ChoroplethMap.js      ← World map (TopoJSON, sequential colour scales)
  BarChart.js           ← Regional happiness comparison (horizontal bars)
  LineChart.js          ← Multi-series trend lines (1990–2023)
  RadarChart.js         ← Multi-dimensional country profile (spider chart)
  main.js               ← Orchestration, events, interactions
data/
  merged_wb_happiness_2015_2019.csv   (751 rows)
  merged_all_2015.csv                 (145 rows)
  wb_trends_1990_2023.csv             (9,292 rows)
  happiness_2015_2019.csv             (782 rows)
```

## Tech Stack

| Requirement    | Solution                                          |
|---------------|---------------------------------------------------|
| Mandatory      | D3.js v7 (CDN)                                   |
| Map            | TopoJSON Client v3 (CDN)                          |
| Modules        | ES6 `import` / `export`                           |
| Styling        | Pure CSS (no Bootstrap/Tailwind)                  |
| Server         | `python -m http.server` (development)             |

**No React, Vue, jQuery, Chart.js, or other libraries** — D3 only, as per brief.

## Data Pipeline

1. **Raw data** — 3 Kaggle datasets (World Bank, WHO, World Happiness Report)
2. **EDA** — `run_eda.py` merges, cleans, and exports 4 CSV files to `data/`
3. **Visualisation** — `DataManager.js` loads CSVs via `d3.csv()`, parses columns into clean JS property names, and exposes query helpers

## Visualisations (5 charts)

| # | Chart | Section | Data Source | Interaction |
|---|-------|---------|-------------|-------------|
| 1 | **Scatter** | Wealth & Happiness | `merged_wb_happiness` | Click → highlight on map; Region legend filters |
| 2 | **Choropleth** | World Map | `merged_wb_happiness` | Click → highlight on scatter; Metric dropdown; Zoom/pan |
| 3 | **Bar** | Regional View | `happiness` aggregated | Click region → filter scatter |
| 4 | **Line** | Trends | `wb_trends` | Click line → highlight country; Metric dropdown; Country chips |
| 5 | **Radar** | Country Profile | `merged_all_2015` | Country selectors (up to 3); Auto-populated from other chart clicks |

## Interactions

- **Scatter ↔ Map**: bidirectional country highlighting
- **Bar → Scatter**: region click filters scatter points
- **Line → Scatter/Map**: country click highlights everywhere
- **Any chart → Radar**: clicking a country auto-fills radar selector
- **Year slider**: globally updates scatter, map, and bar charts (2015–2019)
- **Double-click scatter**: resets all filters
- **Scroll-based nav**: IntersectionObserver highlights active section


