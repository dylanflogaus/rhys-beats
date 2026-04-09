const userBar = document.getElementById("userBar");
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");
const profileTitle = document.getElementById("profileTitle");
const profileSubtitle = document.getElementById("profileSubtitle");
const profileStats = document.getElementById("profileStats");
const profileBeatsList = document.getElementById("profileBeatsList");

const fetchOpts = { credentials: "same-origin" };
const urlParams = new URLSearchParams(window.location.search);
const requestedUsername = (urlParams.get("u") || urlParams.get("username") || "").trim();

let currentProfileUsername = requestedUsername;
let isOwnProfile = false;

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

function reactionButton(label, reactionType, myReaction, count) {
  const activeClass = myReaction ? "reaction-btn active" : "reaction-btn";
  return `<button type="button" class="${activeClass}" data-reaction="${reactionType}">
    ${label} <span>${count}</span>
  </button>`;
}

function downloadLink(beatId) {
  return `<a class="reaction-btn download-btn" href="/api/beats/audio/${beatId}?download=1" download>Download</a>`;
}

function renderProfileBeat(beat) {
  const actionRow = isOwnProfile
    ? `<p class="meta">You cannot star your own beats.</p>`
    : `<div class="reaction-row">${reactionButton(
        beat.isStarred ? "Starred" : "Star",
        "star",
        beat.isStarred,
        beat.reactionCounts?.star ?? 0
      )}${downloadLink(beat.id)}</div>`;

  return `
    <article class="beat-item" data-beat-id="${beat.id}" data-starred="${beat.isStarred ? "1" : "0"}">
      <div class="beat-top">
        <div>
          <h3 class="beat-title">${escapeHtml(beat.title)}</h3>
          ${renderBeatMeta(beat) ? `<p class="meta">${renderBeatMeta(beat)}</p>` : ""}
          ${beat.notes ? `<p class="meta">${escapeHtml(beat.notes)}</p>` : ""}
          <p class="meta">${beat.isPublic ? "Public beat" : "Private beat"}</p>
        </div>
      </div>
      <audio controls src="/api/beats/audio/${beat.id}"></audio>
      ${actionRow}
    </article>
  `;
}

function formatJoined(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderStat(label, value) {
  return `
    <article class="stat-card">
      <p class="meta">${label}</p>
      <p class="stat-value">${escapeHtml(String(value))}</p>
    </article>
  `;
}

function renderProfile(payload) {
  const profile = payload?.profile;
  const beats = payload?.beats ?? [];
  if (!profile) {
    throw new Error("Invalid profile response.");
  }

  isOwnProfile = Boolean(profile.isOwnProfile);
  currentProfileUsername = profile.username || currentProfileUsername;
  document.title = `${profile.username} - Beat Vault`;
  profileTitle.textContent = `${profile.username}'s Profile`;
  profileSubtitle.textContent = isOwnProfile
    ? "This is your creator profile."
    : `Creator since ${formatJoined(profile.joinedAt)}`;

  profileStats.innerHTML = [
    renderStat("Beats shown", profile.beatCount ?? beats.length),
    renderStat("Public beats", profile.publicBeatCount ?? 0),
    renderStat("Stars received", profile.totalStarsReceived ?? 0),
    renderStat("Joined", formatJoined(profile.joinedAt)),
  ].join("");

  if (!beats.length) {
    profileBeatsList.innerHTML = "<p>No beats available for this profile yet.</p>";
    return;
  }

  profileBeatsList.innerHTML = beats.map(renderProfileBeat).join("");
}

async function fetchProfile() {
  if (!currentProfileUsername) {
    profileSubtitle.textContent = "No profile user was provided.";
    profileBeatsList.innerHTML =
      '<p>Open this page from a profile link in Discover or Saved beats.</p>';
    return;
  }

  profileBeatsList.innerHTML = "<p>Loading profile beats...</p>";

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(currentProfileUsername)}`, fetchOpts);
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (response.status === 404) {
      profileSubtitle.textContent = "Profile not found.";
      profileBeatsList.innerHTML = "<p>That creator profile does not exist.</p>";
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load profile.");
    }
    renderProfile(data);
  } catch (error) {
    profileSubtitle.textContent = "Failed to load profile.";
    profileBeatsList.innerHTML = `<p>${escapeHtml(error.message || "Could not load profile.")}</p>`;
  }
}

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
    await fetchProfile();
  } catch (error) {
    alert(error.message || "Could not update star.");
  }
}

profileBeatsList?.addEventListener("click", async (event) => {
  const button = event.target.closest(".reaction-btn");
  if (!button) return;
  const item = button.closest("[data-beat-id]");
  if (!item) return;
  await toggleStarForBeat(item);
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
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

requireAuth()
  .then((user) => {
    if (user) showUser(user);
  })
  .catch(() => {
    window.location.replace("/login.html");
  })
  .then(() => fetchProfile());
