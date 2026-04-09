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

4. **Accounts** — migration `0002` adds a `users` table, `user_id` on `beats`, and uses **KV** for login sessions (same `BEATS_KV` namespace; keys are prefixed `sess:`). Migration `0003` adds public beat discovery plus star/thumb reactions.

After upgrading an existing database, run migrations again:

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

To force a deployment directly to production branch `main` from this repo:

```bash
npm run deploy:prod
```

Add bindings under Pages project settings:
- D1 binding: `DB`
- KV binding: `BEATS_KV`

**Production data must use the same resources as `wrangler.toml`.** If the dashboard shows a different **D1 database UUID** or **KV namespace id** than in this repo, then `npm run db:seed:remote` updates one copy while your live site reads another (empty app, missing audio, etc.). Open **Workers & Pages → your project → Settings → Functions → D1 database bindings** and confirm the bound database id matches `database_id` in `wrangler.toml`. Do the same for KV: production should use the namespace whose id matches `id` (not `preview_id`).

### Production vs preview deployments (Git)

Pages only auto-promotes **one branch** to **Production**. Pushes to other branches (and many PR builds) show as **Preview** only; your **custom domain / production `*.pages.dev` URL** keeps serving the last **production** deployment until you change that.

1. **Check the production branch:** **Workers & Pages** → your project → **Settings** → **Builds & deployments** → find **Production branch** (e.g. `main`). It must match the branch you push to from GitHub.
2. **Promote a one-off build:** **Deployments** → open the successful deployment you want → **Manage deployment** (or **⋯**) → **Promote to production** (wording may vary slightly). That makes that build what production serves.
3. **After fixing the branch:** push a new commit to the production branch so production tracks Git again.

If latest GitHub builds are always **Preview**, your pushes are almost certainly not on the configured production branch, or the project was connected to a fork/branch you are not using.

## Local development

```bash
npm install
npm run db:apply:local
npm run dev
```

Open the local URL shown by Wrangler.

- Sign up at `/register` (or `/register.html`), then use the app at `/` (sign in at `/login`).

## Seed dummy data

After migrations are applied (including `0003`), you can seed sample users, beats, and reactions:

```bash
npm run db:seed:local
```

For Cloudflare remote D1:

```bash
npm run db:seed:remote
```

**Where seeded content appears in the UI:** dummy users and beats are **other people's** tracks. They show under **Discover** (and in **Beats I've saved** after you star one). They do **not** appear under **My Beats** unless you uploaded them yourself.

**If Discover or “Beats I've saved” never appears in production:** (1) Open **View Page Source** on `/` and search for `beat-vault:index` — if it’s missing, Pages is not deploying this repo’s `public/index.html` (wrong build output dir, branch, or project). (2) Disable **ad blockers** and retry (some lists hide elements whose `id` contains `popular`). This app uses neutral ids (`discoverBeatsList`, etc.). (3) **Purge cache** / hard-refresh after deploy.

**Verify the CLI is writing to the same D1 your site uses:**

```bash
npm run db:check:remote
```

You should see non-zero `users` / `beats` counts and rows for `demo_drummer`, `sampleproducer`, `beatmaker77`. If counts are zero here but seed “succeeded”, your Pages project is almost certainly bound to a **different** D1 database than `wrangler.toml`’s `database_id` (update the dashboard binding or change `database_id` to match production, then re-run migrations + seed).

Notes:
- **Remote D1:** do not use `BEGIN TRANSACTION` / `COMMIT` in SQL passed to `wrangler d1 execute --remote`; Cloudflare requires implicit transactions and will error if those appear. (This repo’s seed file follows that rule.)
- The seed is idempotent (safe to run multiple times).
- It creates a few public beats (for Discover), one private beat (to verify filtering), and star reactions.
- It also uploads short silent audio files into KV for seeded beat keys so playback works out of the box.
- **Local dev:** dummy audio is written to the KV **preview** namespace (same one `wrangler pages dev` uses). **Remote:** audio is written to the production KV namespace (`--preview false`).

### Sign-in page missing or blank in production

- Open **`/login.html`** directly. If that 404s, check Pages **Build output directory** is **`public`** (repo root), not a nested path.
- Use **root-absolute** assets (`/styles.css`, `/login.js`): relative `login.js` breaks if the URL is not exactly `/login.html`.
- **`public/_redirects`** maps `/login` → `/login.html` and `/register` → `/register.html` on Cloudflare Pages.
