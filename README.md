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

## Cloudflare Pages project settings

In the dashboard for your Pages project:
- Framework preset: none
- Build command: leave empty
- Build output directory: `public`
- Do not set a custom deploy command

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
