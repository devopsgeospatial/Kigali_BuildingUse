# Kigali Building Detection and Land Use

A React + TypeScript (Vite) web app that reads the **published SPARC Enriched
Building Layer** live from its ArcGIS Feature Service and lets field teams
validate the model's predicted building use against the ground.

- **Basemap:** Esri World Imagery (plus Hybrid / Streets / Dark).
- **Data:** fetched live from the Feature Service — nothing is bundled into the
  repo except the sector boundaries (`public/boundaries.geojson`).
- **Statistics:** computed server-side (group-by queries), so the 650k+ points
  are never downloaded in bulk. Individual points load by map viewport.
- **Validation:** each decision (Matches / Doesn't match + corrected use) is kept
  in the browser (`localStorage`) and exported to CSV/JSON for the data team.
  The Feature Service is treated as **read-only** here.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build (this is what hides your source)

```bash
npm run build      # outputs minified, bundled assets to dist/
npm run preview    # serve the production build locally to test
```

`npm run build` produces a minified bundle in `dist/`. Viewing source
(`Ctrl+U`) on the deployed site shows only the minified chunk, not this
readable code. Note this is **obfuscation, not secrecy** — the Feature Service
URL and query logic still ship inside the bundle and can be extracted by a
determined person. For real data protection, secure the layer itself (private
sharing / authentication) in ArcGIS Online.

## Deploy

Deploy the contents of `dist/` to any static host (GitHub Pages, Netlify,
Azure Static Web Apps, etc.). `vite.config.ts` uses `base: './'` so it works
from a domain root or a project subpath without changes.

### GitHub Pages (automated)

This repo ships a workflow at `.github/workflows/deploy.yml` that builds and
publishes `dist/` on every push to `main`. One-time setup:

1. Push this project to a GitHub repo (the repo root must be **this folder**,
   so `package.json` and `.github/` sit at the top level).
2. In the repo: **Settings ▸ Pages ▸ Build and deployment ▸ Source = GitHub
   Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab). The
   live URL appears in the Actions run summary and under Settings ▸ Pages.

After your first local `npm install`, commit the generated `package-lock.json`
for reproducible CI builds — then you can switch the workflow to `npm ci` +
npm caching (see the commented hints in `deploy.yml`).

### Manual / other hosts

```bash
npm run build      # produces dist/
# upload the dist/ folder to your static host
```

## Configuration

All runtime settings live in `src/config.ts`:

| Key           | Meaning                                            |
| ------------- | -------------------------------------------------- |
| `layer`       | Feature Service layer URL (`.../FeatureServer/0`)  |
| `pointZoom`   | Zoom at which individual buildings start loading    |
| `pageSize`    | Records per request (service `maxRecordCount`)      |
| `maxFeatures` | Safety cap per viewport load                        |

## Project layout

```
public/boundaries.geojson   Sector outlines (static asset)
src/
  config.ts                 Service URL + tunables
  constants.ts              Land-use labels / colours / orders
  sectors.ts                Sector list, districts, bboxes, city bbox
  types.ts                  Shared TypeScript types
  featureService.ts         Feature Service queries (stats + viewport)
  validationStore.ts        localStorage read/write
  components/
    MapView.tsx             MapLibre map, layers, viewport loading
    ControlPanel.tsx        Left sidebar (modes, sector, stats, progress)
    DetailPanel.tsx         Draggable/resizable building popup + validation
  App.tsx                   State, composition, export/clear, wiring
  main.tsx                  Entry point
```
