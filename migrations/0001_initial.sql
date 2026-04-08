CREATE TABLE IF NOT EXISTS beats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  producer TEXT,
  bpm INTEGER,
  beat_key TEXT,
  notes TEXT,
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beats_created_at ON beats (created_at DESC);
