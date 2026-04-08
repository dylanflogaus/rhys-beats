# Beat Vault

Upload, preview, and delete beats. Runs on **Cloudflare Pages** with **D1** (metadata) and **R2** (audio files).

## Features

- Upload audio with title, producer, BPM, key, and notes
- Stream playback in the browser
- Delete removes both the DB row and the R2 object

## Prerequisites

- Cloudflare account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm install`)

## One-time setup

1. **Create D1** (copy `database_id` into `wrangler.toml`):

   ```bash
   npx wrangler d1 create rhys-beats
   ```

   Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with the printed id.

2. **Create R2 bucket** (name must match `bucket_name` in `wrangler.toml`):

   ```bash
   npx wrangler r2 bucket create rhys-beats-audio
   ```

3. **Apply schema** to production D1:

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

From the repo root:

```bash
npm install
npx wrangler d1 migrations apply rhys-beats --remote   # if schema changed
npm run deploy
```

## Deploy (Git / Cloudflare Dashboard)

- **Build command:** leave empty (or `exit 0`)
- **Build output directory:** `public`
- Ensure the same **D1** and **R2** bindings exist for the Pages project (Wrangler/Git deploy picks up `wrangler.toml` when configured, or add bindings under **Settings → Functions**).

After changing schema, run `npm run db:apply:remote` (or the `wrangler d1 migrations apply` command above) against the production database.

## Project layout

| Path | Role |
|------|------|
| `public/` | Static HTML/CSS/JS |
| `functions/api/beats.ts` | `GET` / `POST /api/beats` |
| `functions/api/beats/[id].ts` | `DELETE /api/beats/:id` |
| `functions/api/beats/audio/[id].ts` | `GET /api/beats/audio/:id` (stream from R2) |
| `migrations/` | D1 SQL migrations |

## Audio URLs

Playback uses `/api/beats/audio/:id` so files are served from R2 via the Worker, not from a local `uploads/` folder.
