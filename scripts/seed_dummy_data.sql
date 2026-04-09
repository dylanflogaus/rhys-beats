INSERT OR IGNORE INTO users (username, password_hash, salt)
VALUES
  ('demo_drummer', 'seeded_hash_demo_drummer', 'seeded_salt_demo_drummer'),
  ('sampleproducer', 'seeded_hash_sampleproducer', 'seeded_salt_sampleproducer'),
  ('beatmaker77', 'seeded_hash_beatmaker77', 'seeded_salt_beatmaker77');

INSERT INTO beats (
  user_id,
  title,
  producer,
  bpm,
  beat_key,
  notes,
  file_name,
  r2_key,
  mime_type,
  is_public,
  created_at
)
SELECT
  u.id,
  'Midnight Bounce',
  'demo_drummer',
  142,
  'F# minor',
  'Dark bounce vibe with heavy 808s.',
  'midnight-bounce.mp3',
  'seed-midnight-bounce',
  'audio/mpeg',
  1,
  datetime('now', '-2 days')
FROM users u
WHERE u.username = 'demo_drummer'
  AND NOT EXISTS (
    SELECT 1
    FROM beats b
    WHERE b.user_id = u.id AND b.title = 'Midnight Bounce'
  );

INSERT INTO beats (
  user_id,
  title,
  producer,
  bpm,
  beat_key,
  notes,
  file_name,
  r2_key,
  mime_type,
  is_public,
  created_at
)
SELECT
  u.id,
  'Skyline Dreams',
  'sampleproducer',
  98,
  'C major',
  'Melodic keys and light percussion.',
  'skyline-dreams.mp3',
  'seed-skyline-dreams',
  'audio/mpeg',
  1,
  datetime('now', '-5 days')
FROM users u
WHERE u.username = 'sampleproducer'
  AND NOT EXISTS (
    SELECT 1
    FROM beats b
    WHERE b.user_id = u.id AND b.title = 'Skyline Dreams'
  );

INSERT INTO beats (
  user_id,
  title,
  producer,
  bpm,
  beat_key,
  notes,
  file_name,
  r2_key,
  mime_type,
  is_public,
  created_at
)
SELECT
  u.id,
  'Neon Steps',
  'beatmaker77',
  130,
  'D minor',
  'Club-ready rhythm and bright synth lead.',
  'neon-steps.mp3',
  'seed-neon-steps',
  'audio/mpeg',
  1,
  datetime('now', '-1 days')
FROM users u
WHERE u.username = 'beatmaker77'
  AND NOT EXISTS (
    SELECT 1
    FROM beats b
    WHERE b.user_id = u.id AND b.title = 'Neon Steps'
  );

INSERT INTO beats (
  user_id,
  title,
  producer,
  bpm,
  beat_key,
  notes,
  file_name,
  r2_key,
  mime_type,
  is_public,
  created_at
)
SELECT
  u.id,
  'Private Lab Session',
  'demo_drummer',
  118,
  'A minor',
  'Private test beat. Should not appear in Discover.',
  'private-lab-session.mp3',
  'seed-private-lab-session',
  'audio/mpeg',
  0,
  datetime('now', '-12 hours')
FROM users u
WHERE u.username = 'demo_drummer'
  AND NOT EXISTS (
    SELECT 1
    FROM beats b
    WHERE b.user_id = u.id AND b.title = 'Private Lab Session'
  );

INSERT OR IGNORE INTO beat_reactions (beat_id, user_id, reaction_type)
SELECT b.id, u.id, 'star'
FROM beats b
JOIN users u ON u.username = 'sampleproducer'
WHERE b.title = 'Midnight Bounce';

INSERT OR IGNORE INTO beat_reactions (beat_id, user_id, reaction_type)
SELECT b.id, u.id, 'star'
FROM beats b
JOIN users u ON u.username = 'beatmaker77'
WHERE b.title = 'Midnight Bounce';

INSERT OR IGNORE INTO beat_reactions (beat_id, user_id, reaction_type)
SELECT b.id, u.id, 'star'
FROM beats b
JOIN users u ON u.username = 'demo_drummer'
WHERE b.title = 'Skyline Dreams';

INSERT OR IGNORE INTO beat_reactions (beat_id, user_id, reaction_type)
SELECT b.id, u.id, 'star'
FROM beats b
JOIN users u ON u.username = 'beatmaker77'
WHERE b.title = 'Skyline Dreams';

INSERT OR IGNORE INTO beat_reactions (beat_id, user_id, reaction_type)
SELECT b.id, u.id, 'star'
FROM beats b
JOIN users u ON u.username = 'demo_drummer'
WHERE b.title = 'Neon Steps';

INSERT OR IGNORE INTO beat_reactions (beat_id, user_id, reaction_type)
SELECT b.id, u.id, 'star'
FROM beats b
JOIN users u ON u.username = 'sampleproducer'
WHERE b.title = 'Neon Steps';

DELETE FROM beat_reactions
WHERE reaction_type != 'star';

UPDATE beats
SET mime_type = 'audio/wav'
WHERE r2_key IN (
  'seed-midnight-bounce',
  'seed-skyline-dreams',
  'seed-neon-steps',
  'seed-private-lab-session'
);
