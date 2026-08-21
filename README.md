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
- Bookmarks, contact status, and notes are cached in the current browser and synced to the shared GitHub Gist per signed-in user.
- Saving to the cloud requires entering a GitHub token with Gist access through the app's `Set cloud key` button on each device.
- Do not commit or paste the token into the source code. If a token was pushed to GitHub, revoke it and create a fresh one.
- If the status pill says `Offline`, the latest change is saved locally only until cloud sync succeeds.
