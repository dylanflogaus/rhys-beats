const { execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const isRemote = process.argv.includes("--remote");
const modeFlag = isRemote ? "--remote" : "--local";
// Local `wrangler pages dev` uses the KV *preview* namespace; remote production uses the primary id.
const previewFlag = isRemote ? "--preview false" : "--preview";

const AUDIO_KEYS = [
  "seed-midnight-bounce",
  "seed-skyline-dreams",
  "seed-neon-steps",
  "seed-private-lab-session",
];

function buildSilentWav(seconds = 1, sampleRate = 8000) {
  const numSamples = Math.max(1, Math.floor(seconds * sampleRate));
  const dataSize = numSamples;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 44; i < buffer.length; i += 1) {
    buffer[i] = 128;
  }

  return buffer;
}

const tempPath = path.join(os.tmpdir(), "rhys-seed-silence.wav");
fs.writeFileSync(tempPath, buildSilentWav());

for (const key of AUDIO_KEYS) {
  const command = `npx wrangler kv key put --binding=BEATS_KV "${key}" --path "${tempPath}" ${modeFlag} ${previewFlag}`;
  execSync(command, { stdio: "inherit" });
}

console.log(
  `Seeded ${AUDIO_KEYS.length} dummy audio files to KV (${isRemote ? "remote prod ns" : "local preview ns"}).`
);
