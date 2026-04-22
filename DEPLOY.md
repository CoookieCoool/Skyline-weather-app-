# Deploying the Skyline weather app

This project is a **static site** (HTML/CSS/JS after `npm run build`). The output folder is **`dist/`**. Weather data is fetched in the browser from Open-Meteo and Photon, so you do **not** need your own backend.

**Prerequisites:** Node.js **18 or 20** LTS, and this folder as a Git repository if you deploy from GitHub/GitLab.

---

## 1. Quick check locally

```bash
cd "path/to/weather app"
npm ci
npm run build
npm run preview
```

Open the URL shown (usually `http://localhost:4173`). If search and weather work, you are ready to deploy.

---

## 2. Vercel (simple)

1. Push this project to **GitHub** (only the `weather app` folder as the repo root, or use a monorepo and set the root directory in Vercel).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import the repo.
3. Vercel usually auto-detects **Vite**. Confirm:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Install command:** `npm ci` (optional; `npm install` is fine)
4. Deploy. Your site will get a URL like `https://your-project.vercel.app`.

`vercel.json` in this repo already sets build/output for consistency.

---

## 3. Netlify

1. Push the repo to GitHub.
2. [Netlify](https://www.netlify.com/) → **Add new site** → **Import an existing project**.
3. Netlify reads **`netlify.toml`**: build `npm ci && npm run build`, publish **`dist`**.
4. Deploy.

---

## 4. Cloudflare Pages

1. Push the repo to GitHub/GitLab.
2. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → Connect to Git.
3. Set:
   - **Framework preset:** Vite (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Save and deploy.

---

## 5. GitHub Pages (project site: `username.github.io/repo-name/`)

Vite must know the **base path** so asset URLs work.

1. In `vite.config.ts`, set `base` to your repo name:

   ```ts
   export default defineConfig({
     base: "/your-repo-name/",
     server: { port: 5173 },
   });
   ```

2. Build: `npm run build`.
3. Deploy the **`dist`** folder contents to the `gh-pages` branch or use **GitHub Actions** “Upload Pages artifact” from `dist`.

For a **user site** (`username.github.io` with repo `username.github.io`), use `base: "/"` (default).

---

## 6. After deploy

- Open the live URL and test search + forecast.
- If something fails, open the browser **Developer tools → Network** and confirm requests to `api.open-meteo.com` and `photon.komoot.io` return **200** (corporate networks sometimes block them).

---

## 7. Optional: custom domain

In **Vercel / Netlify / Cloudflare**, add your domain under **Domains**, then at your DNS registrar create the **CNAME** or **A** records they show. HTTPS is handled for you.
