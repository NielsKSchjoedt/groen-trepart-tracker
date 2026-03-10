

## Den Grønne Trepart Dashboard — Implementation Plan

### 1. Project Setup & Data Files
- Copy all 4 uploaded JSON files to `public/data/`
- Install `react-leaflet`, `leaflet`, `topojson-client` and their type definitions
- Load Google Fonts: **Public Sans** (600) and **Source Sans 3** (300, 400)
- Configure the design system colors per the brief: Slate 100 background, Slate 700 text, Sky 500 primary accent, Amber 400 and Emerald 500 for sub-gauges

### 2. Hero Section — "Er vi på sporet?"
- Large 270° arc gauge showing nitrogen reduction: **3.433 af 12.776 ton** (27%) in Sky 500
- Deadline countdown calculating days remaining to 2030-12-31
- Clean, centered layout with Public Sans headings — no animation on the gauge, renders instantly
- Numbers shown absolute-first: "3.433 af 12.776 ton kvælstof reduceret (27%)"
- Danish number formatting throughout (dot = thousands, comma = decimal)

### 3. Sub-Gauges Row
Three metric sections separated by horizontal rules (no card borders):
- **Lavbundsarealer**: 82.236 af 140.000 ha (59%) — horizontal progress bar in Amber 400
- **Skovrejsning**: "Afventer data" — greyed out, deadline noted as 2045
- **Projekter**: 84 anlagt af 1.164 i pipeline — simple step indicator

### 4. Interactive Map (react-leaflet)
- Default layer: 23 main catchment polygons from `catchments.topo.json`, converted via `topojson-client`
- Join features to MARS data using `name-lookup.json` → color by nitrogen progress %
- Color scale: Green 600 (≥80%) → Lime 500 → Yellow 400 → Orange 500 → Red 600 (<20%)
- Toggle button to switch to coastal waters layer (108 polygons, 37 colored, 71 grey)
- Hover: polygon stroke changes to Sky 500, slight lift with drop-shadow
- Click: selected polygon keeps Sky 500 stroke, opens detail panel
- Tooltip on hover: area name + nitrogen progress %

### 5. Detail Panel
- Desktop: pushes map to 60% width, panel takes 40% — selected polygon stays visible
- Mobile: slides up from bottom as a drawer
- Content: area name, nitrogen progress bar, extraction hectares, project pipeline breakdown (sketches → assessed → approved → established)
- Close button returns to full map view

### 6. Footer
- Data attribution: "Data fra MARS (Miljøstyrelsens Arealregister)"
- Last updated timestamp from `fetchedAt`
- GitHub link + "Et open source projekt af Niels Kristian Schjødt"

### 7. Responsive Design
- Single-column layout, max-width 1280px, centered
- Slate 100 background fills full viewport
- Mobile-first: map takes full width, detail panel slides from bottom
- All interactions touch-friendly

