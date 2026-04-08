const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let db;

async function initializeDatabase() {
  db = await open({
    filename: path.join(__dirname, "beats.db"),
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS beats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      producer TEXT,
      bpm INTEGER,
      beat_key TEXT,
      notes TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only audio files are allowed."));
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/beats", async (_req, res) => {
  try {
    const beats = await db.all(`
      SELECT id, title, producer, bpm, beat_key AS beatKey, notes, file_name AS fileName, mime_type AS mimeType, created_at AS createdAt
      FROM beats
      ORDER BY datetime(created_at) DESC;
    `);
    res.json(beats);
  } catch (_error) {
    res.status(500).json({ error: "Failed to load beats." });
  }
});

app.post("/api/beats", upload.single("beatFile"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Beat file is required." });
    return;
  }

  const { title, producer, bpm, beatKey, notes } = req.body;

  if (!title || !title.trim()) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "Title is required." });
    return;
  }

  try {
    const result = await db.run(
      `
      INSERT INTO beats (title, producer, bpm, beat_key, notes, file_name, file_path, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        title.trim(),
        producer?.trim() || null,
        bpm ? Number(bpm) : null,
        beatKey?.trim() || null,
        notes?.trim() || null,
        req.file.filename,
        req.file.path,
        req.file.mimetype,
      ]
    );

    const created = await db.get(
      `
      SELECT id, title, producer, bpm, beat_key AS beatKey, notes, file_name AS fileName, mime_type AS mimeType, created_at AS createdAt
      FROM beats
      WHERE id = ?;
      `,
      [result.lastID]
    );

    res.status(201).json(created);
  } catch (_error) {
    fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to save beat." });
  }
});

app.delete("/api/beats/:id", async (req, res) => {
  const beatId = Number(req.params.id);
  if (Number.isNaN(beatId)) {
    res.status(400).json({ error: "Invalid beat id." });
    return;
  }

  try {
    const beat = await db.get("SELECT id, file_path AS filePath FROM beats WHERE id = ?", [
      beatId,
    ]);
    if (!beat) {
      res.status(404).json({ error: "Beat not found." });
      return;
    }

    await db.run("DELETE FROM beats WHERE id = ?", [beatId]);

    if (beat.filePath && fs.existsSync(beat.filePath)) {
      fs.unlinkSync(beat.filePath);
    }

    res.status(204).send();
  } catch (_error) {
    res.status(500).json({ error: "Failed to delete beat." });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error) {
    res.status(400).json({ error: error.message || "Upload failed." });
    return;
  }

  res.status(500).json({ error: "Unexpected server error." });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Beat vault running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start app:", error);
    process.exit(1);
  });
