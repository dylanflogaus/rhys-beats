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

const fetchOpts = { credentials: "same-origin" };
const discoverState = {
  sort: "most_starred",
  range: "week",
};
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

beatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "Saving...";
  formMessage.classList.remove("error");

  const formData = new FormData(beatForm);
  const isPublicInput = beatForm.querySelector('input[name="isPublic"]');
  formData.set("isPublic", isPublicInput?.checked ? "1" : "0");

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
