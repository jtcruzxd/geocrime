# GeoCRIME

**Geospatial Crime Risk Intelligence and Mapping Environment**  
A WebGIS prototype for Occidental Mindoro, Philippines.

## Overview

GeoCRIME is a pure HTML/CSS/JavaScript WebGIS platform that:

- Renders a **Leaflet.heat heatmap** of 2,774 synthetic crime incidents (2021–2023) sourced from PSA/PNP data in the thesis
- Displays **clickable municipality pins** that scatter colour-coded incident dots per crime type
- Provides an **XAI Prediction Panel** using logistic regression + SHAP-style feature importance to predict future crime hotspots per barangay
- Includes **Chart.js charts**: municipality comparison, provincial trend, and focus crimes breakdown

## Tech Stack

| Layer | Technology |
|---|---|
| Map | Leaflet 1.9.4 + Leaflet.heat 0.2.0 |
| Base tiles | Google Maps API |
| Charts | Chart.js 4.4.3 |
| Prediction | Logistic Regression + SHAP (vanilla JS) |
| Data | PSA (2024), PNP CIRAS — Occidental Mindoro |

## Running Locally

Requires Node.js (for `npx serve`):

```bash
npx serve -p 8765 .
```

Then open [http://localhost:8765](http://localhost:8765).

## Data Sources

- PSA (2024). *Countryside in Figures 2024: Occidental Mindoro.* Based on PNP data.
- PIA (2024). Crime incidents, Occidental Mindoro, H1 2024.
- Cordero, T. (2026). Focus crimes down 12.40% in 2025. GMA News Online.

## Study

> Cruz, J.T. (2026). *GeoCRIME: A Predictive Crime Hotspot Mapping and WebGIS Platform for Occidental Mindoro.*  
> Master in Information Technology, Occidental Mindoro State University.

## Disclaimer

Crime incident locations are **synthetic** — generated from real published municipal totals for prototype purposes only.  
Real deployment requires verified PNP CIRAS incident-level records.
