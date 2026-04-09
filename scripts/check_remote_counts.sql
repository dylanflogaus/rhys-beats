-- Run: npx wrangler d1 execute rhys-beats --remote --file scripts/check_remote_counts.sql
-- Confirms the database wrangler.toml points at matches what you expect in production.

SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM beats) AS beats,
  (SELECT COUNT(*) FROM beat_reactions) AS reactions;

SELECT id, username FROM users ORDER BY id;

SELECT id, title, user_id, is_public, r2_key FROM beats ORDER BY id LIMIT 20;
