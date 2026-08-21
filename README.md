# ECCV 2026 Research Navigator

A fully static React/Vite site for exploring ECCV 2026 papers, professors, institutions, collaboration circles, and outreach priorities. The included `public/eccv-data.json` contains the complete dataset used by the app.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Put every file and folder from this package in the repository root.
3. Commit and push to the `main` branch.
4. In GitHub, open **Settings → Pages** and select **GitHub Actions** as the source.
5. Open the **Actions** tab. The included workflow builds and deploys the site automatically.

The Vite configuration uses `base: "./"`, so the site works both at `username.github.io` and `username.github.io/repository-name/`.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

The production files are written to `dist/`.

## Data and bookmarks

- Main dataset: `public/eccv-data.json`
- Social preview image: `public/og.png`
- Bookmarks, contact status, and notes are cached in the current browser and synced through a tiny Cloudflare Worker backend.
- The Worker stores tracker JSON in Cloudflare KV, so no GitHub or Cloudflare deployment token is needed in the browser.
- Each browser stores a limited ECCV sync key that only unlocks the notes API.
- If the status pill says `Offline`, the latest change is saved locally only until cloud sync succeeds.

## Cloud sync backend

The backend lives in `worker/` and exposes:

- `GET /notes?user=hrithik`
- `PUT /notes` with `{ "user": "hrithik", "tracker": { ... } }`

Deploy outline:

1. Create a Cloudflare KV namespace.
2. Put its production namespace id into `worker/wrangler.toml`.
3. Set a Worker secret named `SYNC_KEY`.
4. Deploy the Worker with Wrangler.
5. Set `VITE_SYNC_API_URL` to the Worker URL before building the site.
6. Rebuild and deploy GitHub Pages.
