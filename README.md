# Skyline — Weather web app

A small **single-page weather app**: search for a place (or paste coordinates), see **current conditions**, **24-hour hourly** outlook, and a **7-day** forecast. Data loads **live in the browser** from public APIs—no backend and no API keys.

## Features

- **Search** — Cities worldwide; **India** bias and spelling hints help villages that are missing from one database.
- **Fallback geocoding** — [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api), then [Photon](https://photon.komoot.io/) (OpenStreetMap) if needed.
- **Coordinates** — Enter `latitude, longitude` (e.g. from Google Maps) if the name does not resolve.
- **Forecast** — [Open-Meteo Forecast API](https://open-meteo.com/en/docs) for current weather, hourly, and daily fields.
- **Live updates** — Manual **Refresh** and automatic refresh every **10 minutes** while a location is open.

## Tech stack

| Piece        | Choice                          |
| ------------ | ------------------------------- |
| Build        | [Vite](https://vitejs.dev/) 5   |
| Language     | TypeScript                      |
| UI           | Vanilla DOM + CSS               |
| Deployment   | Static `dist/` (see **Deploy**)|

## Requirements

- **Node.js** 18 or newer (20 LTS recommended)

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5173**).

### Production build

```bash
npm run build
npm run preview
```

Output is in **`dist/`**.

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** for Vercel, Netlify, Cloudflare Pages, and GitHub Pages.

## Project layout

```
├── index.html          # Entry HTML
├── src/
│   ├── main.ts         # Bootstraps the app
│   ├── app.ts          # UI, search, refresh timers
│   ├── api.ts          # Geocoding + forecast fetches
│   └── style.css       # Layout and theme
├── vite.config.ts
├── netlify.toml        # Netlify build settings
├── vercel.json         # Vercel build settings
├── DEPLOY.md           # Hosting checklist
└── TASKFLOW_ROADMAP.md # Separate TaskFlow full-stack roadmap
```

## Attribution

Weather data © **Open-Meteo** ([open-meteo.com](https://open-meteo.com/)). Search may use **Photon** / OpenStreetMap contributors.

## License

Private project (`"private": true` in `package.json`). Add a `LICENSE` file if you open-source it.
