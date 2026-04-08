# Beat Vault (Cloudflare Pages)

Store, stream, and delete beats with a simple UI.

This version is designed for **Cloudflare Pages + Pages Functions**:
- **D1** for metadata
- **Workers KV** for audio file bytes

## Why this setup

- Uses Cloudflare's native Pages workflow
- No custom deploy command required in Pages builds
- No R2 dependency

## One-time setup

1. Create D1:

```bash
npx wrangler d1 create rhys-beats
```

Put that `database_id` into `wrangler.toml` (`[[d1_databases]]`).

2. Create KV namespaces:

```bash
npx wrangler kv namespace create beat-vault-audio
npx wrangler kv namespace create beat-vault-audio --preview
```

Put those IDs into `wrangler.toml`:
- `id` = production namespace id
- `preview_id` = preview namespace id

3. Apply database schema:

```bash
npx wrangler d1 migrations apply rhys-beats --remote
```

4. **Accounts** — migration `0002` adds a `users` table, `user_id` on `beats`, and uses **KV** for login sessions (same `BEATS_KV` namespace; keys are prefixed `sess:`). After upgrading an existing database, run migrations again:

```bash
npx wrangler d1 migrations apply rhys-beats --remote
```

If you had beats from before multi-user support, rows may have `user_id` NULL and will not show for any user until you remove them or assign an owner in SQL.

## Cloudflare Pages project settings

In the dashboard for your Pages project:
- Framework preset: none
- Build command: leave empty (or `npm clean-install` only if you need dependencies installed; **not** required for this static UI, but harmless)
- Build output directory: `public`
- **Deploy command / post-build command:** leave **empty** OR remove it entirely

**Do not** set `npx wrangler deploy` here. This repo is **Pages** (`public/` + `functions/`). That command targets **Workers** and your log will show:

- `Executing user deploy command: npx wrangler deploy`
- `wrangler pages deploy should be used instead`
- `Missing entry-point to Worker script or to assets directory`

**Fix:** In Pages → **Settings** → **Builds & deployments**, clear the **Deploy command** field. Git-connected Pages publishes the build output automatically; you do not need a Wrangler deploy step after `npm install`.

If you truly must deploy via Wrangler from CI (unusual for Git Pages), use:

```bash
npx wrangler pages deploy public
```

—not `wrangler deploy`.

Add bindings under Pages project settings:
- D1 binding: `DB`
- KV binding: `BEATS_KV`

## Local development

```bash
npm install
npm run db:apply:local
npm run dev
```

Open the local URL shown by Wrangler.

- Sign up at `/register.html`, then use the app at `/` (or sign in at `/login.html`).
