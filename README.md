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

### CI: `Authentication error [code: 10000]` on `wrangler pages deploy`

If the log says Wrangler is using **`CLOUDFLARE_API_TOKEN`** and the request to **`/pages/projects/rhys-beats`** fails with **Authentication error**, that token is missing **Pages** (and often related) permissions.

**Fix (pick one):**

1. **Use a token that can deploy Pages** — create or edit an [API token](https://dash.cloudflare.com/profile/api-tokens) with at least:
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Account** → **Workers Scripts** → **Edit** (needed to publish the Functions bundle)
   - **Account** → **Workers KV Storage** → **Edit** (this app uses `BEATS_KV`)
   - **Account** → **D1** → **Edit** (this app uses D1)
   - **User** → **User details** → **Read**

   Put that token in your CI/Pages environment as **`CLOUDFLARE_API_TOKEN`** and redeploy.

2. **Stop overriding the token (if you use Cloudflare’s native Git integration)** — If you set **`CLOUDFLARE_API_TOKEN`** in the Pages project to a narrow token, remove it or replace it with a token that includes **Cloudflare Pages → Edit**. Some tutorials only add **Workers** scopes; that is not enough for `wrangler pages deploy`.

3. **Create the Pages project first** — In the dashboard, **Workers & Pages** → **Create** → **Pages** → connect the repo or create a project named **`rhys-beats`** so the API target exists. Deploy again.

See also: [Use Direct Upload with Continuous Integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) (token expectations for Pages uploads).

### CI: `Project not found` / `[code: 8000007]`

If the log says the request to **`/pages/projects/rhys-beats`** failed with **Project not found**, Wrangler is using the **`name`** field from `wrangler.toml` (here: **`rhys-beats`**) and **no Pages project with that exact name** exists on your account yet.

**Fix (pick one):**

1. **Create the project** (CLI, logged in with a token that has Pages permissions):

   ```bash
   npx wrangler pages project create rhys-beats --production-branch main
   ```

   Then run your deploy again.

2. **Create in the dashboard** — **Workers & Pages** → **Create** → **Pages** → choose **Direct Upload** or connect Git, and set the **project name** to **`rhys-beats`** (must match `name` in `wrangler.toml`).

3. **Use an existing project name** — If you already have a Pages project (e.g. `beat-vault`), either:
   - change `name = "rhys-beats"` in `wrangler.toml` to that name, or
   - set the deploy command to:  
     `npx wrangler pages deploy public --project-name=YOUR_EXISTING_NAME`

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
