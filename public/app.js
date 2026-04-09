const beatForm = document.getElementById("beatForm");
const beatsList = document.getElementById("beatsList");
const discoverBeatsList = document.getElementById("discoverBeatsList");
const savedBeatsList = document.getElementById("savedBeatsList");
const discoverSortTabs = document.getElementById("discoverSortTabs");
const discoverRangeSelect = document.getElementById("discoverRangeSelect");
const formMessage = document.getElementById("formMessage");
const userBar = document.getElementById("userBar");
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");
const titleInput = beatForm?.querySelector('input[name="title"]');
const rollTitleBtn = document.getElementById("rollTitleBtn");
const titleSuggestion = document.getElementById("titleSuggestion");
const fileInput = beatForm?.querySelector('input[name="beatFile"]');
const bpmInput = beatForm?.querySelector('input[name="bpm"]');
const beatKeyInput = beatForm?.querySelector('input[name="beatKey"]');
const notesInput = beatForm?.querySelector('textarea[name="notes"]');
const autoTagsInput = beatForm?.querySelector('input[name="autoTags"]');
const analysisPreview = document.getElementById("analysisPreview");

const fetchOpts = { credentials: "same-origin" };
const discoverState = {
  sort: "most_starred",
  range: "week",
};
let pendingAnalysisPromise = null;
const beatNameParts = {
  first: [
    "Midnight",
    "Velvet",
    "Neon",
    "Golden",
    "Shadow",
    "Crystal",
    "Lowkey",
    "Turbo",
    "Electric",
    "Cloud",
  ],
  second: [
    "Bounce",
    "Drift",
    "Pulse",
    "Heat",
    "Dreams",
    "Run",
    "Groove",
    "Session",
    "Rhythm",
    "Haze",
  ],
  ending: [
    "Vol. 1",
    "Type Beat",
    "Mix",
    "Loop",
    "Edit",
    "Flip",
    "Cut",
    "Mode",
    "Tape",
    "Vibe",
  ],
};

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generateBeatTitle() {
  return `${pickRandom(beatNameParts.first)} ${pickRandom(beatNameParts.second)} ${pickRandom(beatNameParts.ending)}`;
}

function rollBeatTitle(shouldFillInput = true) {
  const suggestion = generateBeatTitle();
  if (titleSuggestion) {
    titleSuggestion.textContent = `Suggested: ${suggestion}`;
  }
  if (shouldFillInput && titleInput) {
    titleInput.value = suggestion;
    titleInput.focus();
  }
  return suggestion;
}

async function requireAuth() {
  const response = await fetch("/api/auth/me", fetchOpts);
  if (response.status === 401) {
    window.location.replace("/login.html");
    return null;
  }
  if (!response.ok) {
    throw new Error("Could not verify login.");
  }
  return response.json();
}

function showUser(user) {
  if (!userBar || !userLabel) return;
  userLabel.textContent = `Signed in as ${user.username}`;
  userBar.hidden = false;
}

function renderBeatMeta(beat) {
  return [beat.producer ? `Producer: ${escapeHtml(beat.producer)}` : null, beat.bpm ? `BPM: ${beat.bpm}` : null, beat.beatKey ? `Key: ${escapeHtml(beat.beatKey)}` : null]
    .filter(Boolean)
    .join(" | ");
}

function renderBeatTags(beat) {
  if (!Array.isArray(beat.tags) || !beat.tags.length) return "";
  const chips = beat.tags
    .slice(0, 8)
    .map((tag) => `<span>#${escapeHtml(String(tag))}</span>`)
    .join(" ");
  return `<p class="meta">${chips}</p>`;
}

async function fetchBeats() {
  if (!beatsList) return;
  beatsList.innerHTML = "<p>Loading beats...</p>";

  try {
    const response = await fetch("/api/beats", fetchOpts);
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }

    const beats = await response.json();
    if (beats.error) {
      beatsList.innerHTML = `<p>${escapeHtml(beats.error)}</p>`;
      return;
    }

    if (!beats.length) {
      beatsList.innerHTML = "<p>No beats saved yet.</p>";
      return;
    }

    beatsList.innerHTML = beats
      .map(
        (beat) => `
        <article class="beat-item">
          <div class="beat-top">
            <div>
              <h3 class="beat-title">${escapeHtml(beat.title)}</h3>
              ${renderBeatMeta(beat) ? `<p class="meta">${renderBeatMeta(beat)}</p>` : ""}
              ${beat.notes ? `<p class="meta">${escapeHtml(beat.notes)}</p>` : ""}
              ${renderBeatTags(beat)}
              <p class="meta">${beat.isPublic ? "Public in Discover" : "Private beat"}</p>
            </div>
            <button class="delete-btn" data-id="${beat.id}">Delete</button>
          </div>
          <audio controls src="/api/beats/audio/${beat.id}"></audio>
        </article>
      `
      )
      .join("");
  } catch (_error) {
    beatsList.innerHTML = "<p>Failed to load beats.</p>";
  }
}

function reactionButton(label, reactionType, myReaction, count) {
  const activeClass = myReaction ? "reaction-btn active" : "reaction-btn";
  return `<button type="button" class="${activeClass}" data-reaction="${reactionType}">
    ${label} <span>${count}</span>
  </button>`;
}

function profileLink(username) {
  const safeUsername = String(username ?? "");
  return `<a class="profile-link" href="/profile.html?u=${encodeURIComponent(safeUsername)}">${escapeHtml(safeUsername)}</a>`;
}

function downloadLink(beatId) {
  return `<a class="reaction-btn download-btn" href="/api/beats/audio/${beatId}?download=1" download>Download</a>`;
}

function renderDiscoverBeat(beat) {
  return `
    <article class="beat-item" data-beat-id="${beat.id}" data-starred="${beat.isStarred ? "1" : "0"}">
      <div class="beat-top">
        <div>
          <h3 class="beat-title">${escapeHtml(beat.title)}</h3>
          <p class="meta">By ${profileLink(beat.username)}</p>
          ${renderBeatMeta(beat) ? `<p class="meta">${renderBeatMeta(beat)}</p>` : ""}
          ${beat.notes ? `<p class="meta">${escapeHtml(beat.notes)}</p>` : ""}
          ${renderBeatTags(beat)}
        </div>
      </div>
      <audio controls src="/api/beats/audio/${beat.id}"></audio>
      <div class="reaction-row">
        ${reactionButton("Star", "star", beat.isStarred, beat.reactionCounts?.star ?? 0)}
        ${downloadLink(beat.id)}
      </div>
    </article>
  `;
}

function renderStarredBeat(beat) {
  return `
    <article class="beat-item" data-beat-id="${beat.id}" data-starred="1">
      <div class="beat-top">
        <div>
          <h3 class="beat-title">${escapeHtml(beat.title)}</h3>
          <p class="meta">By ${profileLink(beat.username)}</p>
          ${renderBeatMeta(beat) ? `<p class="meta">${renderBeatMeta(beat)}</p>` : ""}
          ${beat.notes ? `<p class="meta">${escapeHtml(beat.notes)}</p>` : ""}
          ${renderBeatTags(beat)}
        </div>
      </div>
      <audio controls src="/api/beats/audio/${beat.id}"></audio>
      <div class="reaction-row">
        ${reactionButton("Starred", "star", true, beat.reactionCounts?.star ?? 0)}
        ${downloadLink(beat.id)}
      </div>
    </article>
  `;
}

async function fetchDiscoverBeats() {
  if (!discoverBeatsList) return;
  discoverBeatsList.innerHTML = "<p>Loading community beats...</p>";

  try {
    const query = new URLSearchParams({
      sort: discoverState.sort,
      range: discoverState.range,
    });
    const response = await fetch(`/api/beats/discover?${query.toString()}`, fetchOpts);
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    const beats = await response.json();
    if (beats.error) {
      discoverBeatsList.innerHTML = `<p>${escapeHtml(beats.error)}</p>`;
      return;
    }
    if (!beats.length) {
      discoverBeatsList.innerHTML =
        "<p>No public beats from other creators yet. Try <strong>All time</strong> in the time range, or widen filters.</p>";
      return;
    }
    discoverBeatsList.innerHTML = beats.map(renderDiscoverBeat).join("");
  } catch (_error) {
    discoverBeatsList.innerHTML = "<p>Failed to load Discover.</p>";
  }
}

async function fetchSavedBeats() {
  if (!savedBeatsList) return;
  savedBeatsList.innerHTML = "<p>Loading saved beats...</p>";

  try {
    const response = await fetch("/api/beats/starred", fetchOpts);
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    const beats = await response.json();
    if (beats.error) {
      savedBeatsList.innerHTML = `<p>${escapeHtml(beats.error)}</p>`;
      return;
    }
    if (!beats.length) {
      savedBeatsList.innerHTML =
        "<p>No saved beats yet. Star something in <strong>Discover</strong> below and it will show up here.</p>";
      return;
    }
    savedBeatsList.innerHTML = beats.map(renderStarredBeat).join("");
  } catch (_error) {
    savedBeatsList.innerHTML = "<p>Failed to load saved beats.</p>";
  }
}

function setActiveSortTab(sort) {
  const buttons = discoverSortTabs?.querySelectorAll(".tab-btn") ?? [];
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === sort);
  });
}

function sanitizeTag(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

function uniqueTags(list) {
  const seen = new Set();
  const output = [];
  for (const item of list) {
    const cleaned = sanitizeTag(item);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    output.push(cleaned);
    if (output.length >= 12) break;
  }
  return output;
}

function extractKeywordTags(sourceText) {
  const source = String(sourceText || "").toLowerCase();
  const keywordPairs = [
    ["trap", "trap"],
    ["drill", "drill"],
    ["boom bap", "boom-bap"],
    ["boombap", "boom-bap"],
    ["lofi", "lo-fi"],
    ["lo-fi", "lo-fi"],
    ["house", "house"],
    ["afro", "afrobeats"],
    ["jersey", "jersey-club"],
    ["rage", "rage"],
    ["phonk", "phonk"],
    ["soul", "soulful"],
    ["rnb", "rnb"],
    ["melodic", "melodic"],
    ["dark", "dark"],
    ["sad", "sad"],
    ["ambient", "ambient"],
    ["cinematic", "cinematic"],
  ];
  const tags = [];
  for (const [needle, tag] of keywordPairs) {
    if (source.includes(needle)) tags.push(tag);
  }
  return tags;
}

function inferGenreFromTempo(tempo, energy) {
  if (!tempo) return [];
  if (tempo >= 132 && tempo <= 155) {
    return energy > 0.22 ? ["trap", "hard"] : ["trap", "melodic"];
  }
  if (tempo >= 80 && tempo <= 95) return ["boom-bap"];
  if (tempo >= 95 && tempo <= 115) return ["lo-fi", "chill"];
  if (tempo >= 116 && tempo <= 132) return ["house", "groovy"];
  if (tempo > 155) return ["drum-and-bass", "high-energy"];
  return ["hip-hop"];
}

const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function goertzelMagnitude(signal, sampleRate, targetFreq) {
  const omega = (2 * Math.PI * targetFreq) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < signal.length; i += 1) {
    q0 = coeff * q1 - q2 + signal[i];
    q2 = q1;
    q1 = q0;
  }

  const real = q1 - q2 * Math.cos(omega);
  const imag = q2 * Math.sin(omega);
  return Math.sqrt(real * real + imag * imag);
}

function estimateKey(samples, sampleRate) {
  const frameSize = 4096;
  if (!samples?.length || samples.length < frameSize * 2) return null;

  const noteFrequencies = [];
  for (let midi = 36; midi <= 83; midi += 1) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    noteFrequencies.push({ pitchClass: midi % 12, freq });
  }

  const chroma = new Array(12).fill(0);
  const frameCount = Math.max(8, Math.min(24, Math.floor(samples.length / frameSize)));
  const maxStart = samples.length - frameSize - 1;
  const stride = Math.max(1, Math.floor(maxStart / frameCount));
  const frame = new Float32Array(frameSize);
  let analyzedFrames = 0;

  for (let frameIdx = 0; frameIdx < frameCount; frameIdx += 1) {
    const start = Math.min(frameIdx * stride, maxStart);
    let frameEnergy = 0;

    for (let i = 0; i < frameSize; i += 1) {
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
      const sample = samples[start + i] * hann;
      frame[i] = sample;
      frameEnergy += sample * sample;
    }
    if (frameEnergy < 0.015) continue;
    analyzedFrames += 1;

    for (const note of noteFrequencies) {
      const energy = goertzelMagnitude(frame, sampleRate, note.freq);
      chroma[note.pitchClass] += energy;
    }
  }
  if (!analyzedFrames) return null;

  let total = 0;
  let root = 0;
  let rootEnergy = 0;
  for (let i = 0; i < chroma.length; i += 1) {
    total += chroma[i];
    if (chroma[i] > rootEnergy) {
      rootEnergy = chroma[i];
      root = i;
    }
  }
  const rootShare = total ? rootEnergy / total : 0;
  if (!total || rootShare < 0.09) return null;

  const majorScore = chroma[(root + 4) % 12] + chroma[(root + 7) % 12] + chroma[(root + 11) % 12];
  const minorScore = chroma[(root + 3) % 12] + chroma[(root + 7) % 12] + chroma[(root + 10) % 12];
  const mode = minorScore > majorScore ? "minor" : "major";
  return `${PITCH_CLASSES[root]} ${mode}`;
}

function estimateTempo(samples, sampleRate) {
  const windowSize = 1024;
  const hopSize = 512;
  const envelope = [];
  for (let i = 0; i + windowSize < samples.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j += 1) {
      const value = samples[i + j];
      sum += value * value;
    }
    envelope.push(Math.sqrt(sum / windowSize));
  }

  if (envelope.length < 8) return null;
  const diff = [];
  for (let i = 1; i < envelope.length; i += 1) {
    diff.push(Math.max(0, envelope[i] - envelope[i - 1]));
  }
  if (!diff.length) return null;

  const fps = sampleRate / hopSize;
  const minLag = Math.floor((60 / 180) * fps);
  const maxLag = Math.floor((60 / 70) * fps);
  let bestLag = 0;
  let bestScore = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    for (let i = lag; i < diff.length; i += 1) {
      score += diff[i] * diff[i - lag];
    }
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (!bestLag || !bestScore) return null;
  const bpm = Math.round((60 * fps) / bestLag);
  if (!Number.isFinite(bpm)) return null;
  return Math.max(60, Math.min(200, bpm));
}

async function extractAudioFeatures(file) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  const context = new AudioContextCtor();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const maxSeconds = 90;
    const frameLimit = Math.min(channelData.length, Math.floor(audioBuffer.sampleRate * maxSeconds));
    const slice = channelData.slice(0, frameLimit);

    let totalSq = 0;
    for (let i = 0; i < slice.length; i += 1) totalSq += slice[i] * slice[i];
    const rms = slice.length ? Math.sqrt(totalSq / slice.length) : 0;
    const tempo = estimateTempo(slice, audioBuffer.sampleRate);

    return {
      duration: audioBuffer.duration,
      rms,
      tempo,
      key: estimateKey(slice, audioBuffer.sampleRate),
    };
  } finally {
    await context.close();
  }
}

function buildAutoTags({ features, fileName, title, notes, beatKey }) {
  const tags = ["beat", "instrumental"];
  const source = `${fileName} ${title} ${notes}`;
  tags.push(...extractKeywordTags(source));

  if (features?.tempo) {
    tags.push(`${features.tempo}bpm`);
    tags.push(...inferGenreFromTempo(features.tempo, features.rms || 0));
  }

  if (features?.key) {
    tags.push(sanitizeTag(features.key));
  }

  if (features?.rms) {
    tags.push(features.rms > 0.2 ? "energetic" : "smooth");
  }

  if (features?.duration) {
    tags.push(features.duration < 60 ? "short-form" : "full-length");
  }

  const keyText = String(beatKey || "").toLowerCase();
  if (keyText.includes("minor")) tags.push("minor-key");
  if (keyText.includes("major")) tags.push("major-key");

  return uniqueTags(tags);
}

async function runAutoAnalysis(file) {
  if (!autoTagsInput || !analysisPreview) return [];
  if (!file) {
    autoTagsInput.value = "";
    analysisPreview.textContent = "";
    return [];
  }

  analysisPreview.textContent = "Analyzing audio for genre and vibe tags...";
  const features = await extractAudioFeatures(file).catch(() => null);
  const inferredTags = buildAutoTags({
    features,
    fileName: file.name || "",
    title: titleInput?.value || "",
    notes: notesInput?.value || "",
    beatKey: beatKeyInput?.value || "",
  });

  if ((!bpmInput?.value || !Number(bpmInput.value)) && features?.tempo && bpmInput) {
    bpmInput.value = String(features.tempo);
  }
  if (!beatKeyInput?.value && features?.key && beatKeyInput) {
    beatKeyInput.value = features.key;
  }

  autoTagsInput.value = inferredTags.join(",");
  analysisPreview.textContent = inferredTags.length
    ? `${features?.key ? `Detected key: ${features.key}. ` : ""}Auto tags: ${inferredTags
        .map((tag) => `#${tag}`)
        .join(" ")}`
    : "No auto tags found.";
  return inferredTags;
}

fileInput?.addEventListener("change", () => {
  const selectedFile = fileInput.files?.[0];
  pendingAnalysisPromise = runAutoAnalysis(selectedFile);
});

beatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "Saving...";
  formMessage.classList.remove("error");

  const formData = new FormData(beatForm);
  const isPublicInput = beatForm.querySelector('input[name="isPublic"]');
  formData.set("isPublic", isPublicInput?.checked ? "1" : "0");
  const selectedFile = fileInput?.files?.[0];
  if (selectedFile) {
    if (pendingAnalysisPromise) {
      await pendingAnalysisPromise;
    } else {
      await runAutoAnalysis(selectedFile);
    }
    if (autoTagsInput?.value) {
      formData.set("autoTags", autoTagsInput.value);
    }
  }

  try {
    const response = await fetch("/api/beats", {
      method: "POST",
      body: formData,
      ...fetchOpts,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to save beat.");
    }

    beatForm.reset();
    if (autoTagsInput) autoTagsInput.value = "";
    if (analysisPreview) analysisPreview.textContent = "";
    pendingAnalysisPromise = null;
    rollBeatTitle(false);
    formMessage.textContent = "Beat saved.";
    await fetchBeats();
    await Promise.all([fetchDiscoverBeats(), fetchSavedBeats()]);
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add("error");
  }
});

rollTitleBtn?.addEventListener("click", () => {
  rollBeatTitle(true);
});

beatsList?.addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-btn");
  if (!button) return;

  const { id } = button.dataset;
  if (!id) return;

  const shouldDelete = confirm("Delete this beat?");
  if (!shouldDelete) return;

  try {
    const response = await fetch(`/api/beats/${id}`, {
      method: "DELETE",
      ...fetchOpts,
    });
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok) {
      throw new Error("Delete failed.");
    }
    await fetchBeats();
    await Promise.all([fetchDiscoverBeats(), fetchSavedBeats()]);
  } catch (_error) {
    alert("Failed to delete beat.");
  }
});

async function toggleStarForBeat(item) {
  const beatId = item?.dataset.beatId;
  if (!beatId) return;
  const isCurrentlyStarred = item.dataset.starred === "1";
  const method = isCurrentlyStarred ? "DELETE" : "POST";

  try {
    const response = await fetch(`/api/beats/reaction/${beatId}`, {
      method,
      ...fetchOpts,
    });

    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not update star.");
    }
    await Promise.all([fetchDiscoverBeats(), fetchSavedBeats()]);
  } catch (error) {
    alert(error.message || "Could not update star.");
  }
}

discoverBeatsList?.addEventListener("click", async (event) => {
  const button = event.target.closest(".reaction-btn");
  if (!button) return;
  const item = button.closest("[data-beat-id]");
  if (!item) return;
  await toggleStarForBeat(item);
});

savedBeatsList?.addEventListener("click", async (event) => {
  const button = event.target.closest(".reaction-btn");
  if (!button) return;
  const item = button.closest("[data-beat-id]");
  if (!item) return;
  await toggleStarForBeat(item);
});

discoverSortTabs?.addEventListener("click", async (event) => {
  const button = event.target.closest(".tab-btn");
  if (!button) return;
  const nextSort = button.dataset.sort;
  if (!nextSort || nextSort === discoverState.sort) return;
  discoverState.sort = nextSort;
  setActiveSortTab(nextSort);
  await fetchDiscoverBeats();
});

discoverRangeSelect?.addEventListener("change", async () => {
  const nextRange = discoverRangeSelect.value;
  if (nextRange === discoverState.range) return;
  discoverState.range = nextRange;
  await fetchDiscoverBeats();
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST", ...fetchOpts });
  } catch (_e) {
    // ignore
  }
  window.location.replace("/login.html");
});

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

requireAuth()
  .then((user) => {
    if (user) showUser(user);
    if (titleSuggestion) rollBeatTitle(false);
    setActiveSortTab(discoverState.sort);
  })
  .catch(() => {
    window.location.replace("/login.html");
  })
  .then(() => Promise.all([fetchBeats(), fetchDiscoverBeats(), fetchSavedBeats()]));
