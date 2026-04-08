# Beat Vault

Upload, preview, and delete beats. Runs on **Cloudflare Pages** with **D1** (metadata) and **Workers KV** (audio files). No R2—KV is included with Workers/Pages and fits typical hobby use.

## Features

- Upload audio with title, producer, BPM, key, and notes
- Stream playback in the browser
- Delete removes both the D1 row and the KV value

## Limits (know before you scale)

- **KV value size:** up to **25 MiB** per beat file (this app enforces the same upload cap).
- **KV free tier:** daily read/write caps apply ([KV docs](https://developers.cloudflare.com/kv/platform/limits/)). Fine for personal/low traffic; heavy streaming may need a paid plan or a different store.

## Prerequisites

- Cloudflare account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install`)

## One-time setup

1. **D1** — create and put `database_id` in `wrangler.toml`:

   ```bash
   npx wrangler d1 create rhys-beats
   ```

2. **KV** — create **production** and **preview** namespaces (preview is used by `wrangler pages dev`):

   ```bash
   npx wrangler kv namespace create beat-vault-audio
   npx wrangler kv namespace create beat-vault-audio --preview
   ```

   Paste the printed ids into `wrangler.toml` as `id` and `preview_id` for the `BEATS_KV` binding.

3. **Schema** — apply migrations to production D1:

   ```bash
   npx wrangler d1 migrations apply rhys-beats --remote
   ```

## Local development

```bash
npm install
npm run db:apply:local
npm run dev
```

Open the URL Wrangler prints (usually `http://localhost:8788`).

## Deploy (CLI)

```bash
npm install
npx wrangler d1 migrations apply rhys-beats --remote   # when migrations change
npm run deploy
```

## Deploy (Git / Cloudflare Dashboard)

### Important: Pages vs Workers deploy

This repo is **Cloudflare Pages** (static assets in `public/` + `functions/`). The Worker deploy command is wrong here.

If your build log shows:

- `Executing user deploy command: npx wrangler deploy`
- `Missing entry-point to Worker script or to assets directory`

then the pipeline is using **Workers** deploy. Change it to **Pages** deploy:

```bash
npx wrangler pages deploy public
```

or equivalently:

```bash
npm run deploy
```

Do **not** run `npx wrangler deploy` for this project — Wrangler will look for `main = "..."` (a Worker entry) or `[assets]` and fail.

### Pages settings

- **Build output directory:** `public`
- **Build command:** e.g. `npm clean-install` (or leave empty if you do not need a build step)
- **Deploy / Wrangler command** (if your project has a custom deploy step): `npx wrangler pages deploy public` or `npm run deploy` — **not** `npx wrangler deploy`
- Under **Settings → Functions**, bind:
  - **D1** → variable `DB` (same DB as in `wrangler.toml`)
  - **KV** → variable `BEATS_KV` (production namespace)

If you deploy with Wrangler and the project uses this `wrangler.toml`, bindings are usually applied automatically.

## Project layout

| Path | Role |
|------|------|
| `public/` | Static HTML/CSS/JS |
| `functions/api/beats.ts` | `GET` / `POST /api/beats` |
| `functions/api/beats/[id].ts` | `DELETE /api/beats/:id` |
| `functions/api/beats/audio/[id].ts` | `GET /api/beats/audio/:id` (bytes from KV) |
| `migrations/` | D1 SQL migrations |

## Audio URLs

Playback uses `/api/beats/audio/:id`. The Worker reads the key from D1 and streams the value from **KV**.
