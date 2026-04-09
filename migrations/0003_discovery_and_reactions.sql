ALTER TABLE beats ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;

UPDATE beats
SET is_public = 1
WHERE is_public IS NULL;

CREATE INDEX IF NOT EXISTS idx_beats_public_created_at ON beats(is_public, created_at DESC);

CREATE TABLE IF NOT EXISTS beat_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  beat_id INTEGER NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('star', 'thumb')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(beat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_beat_id ON beat_reactions(beat_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON beat_reactions(user_id);
