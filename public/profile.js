(function () {
const pageHeaderTitle = document.getElementById("pageHeaderTitle");
const pageHeaderSubtitle = document.getElementById("pageHeaderSubtitle");
const profileStats = document.getElementById("profileStats");

function setProfileHeading(title, subtitle) {
  if (pageHeaderTitle && title != null) pageHeaderTitle.textContent = title;
  if (pageHeaderSubtitle && subtitle != null) pageHeaderSubtitle.textContent = subtitle;
}
const fetchOpts = { credentials: "same-origin" };
const TRAY_STAR_ICON = `<svg class="tray-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const urlParams = new URLSearchParams(window.location.search);
const requestedUsername = (urlParams.get("u") || urlParams.get("username") || "").trim();

let currentProfileUsername = requestedUsername;
let isOwnProfile = false;

function getProfileBeatsList() {
  return document.getElementById("profileBeatsList");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function profileLink(username) {
  const safeUsername = String(username ?? "");
  return `<a class="profile-link" href="/index.html?u=${encodeURIComponent(safeUsername)}#profile">${escapeHtml(safeUsername)}</a>`;
}

function activateProfileView(user) {
  if (!getProfileBeatsList()) return;
  setProfileHeading("Profile", "Loading profile...");
  resolveProfileUsername(user);
  return fetchProfile();
}

function renderBeatMeta(beat) {
  return [beat.producer ? `Producer: ${escapeHtml(beat.producer)}` : null, beat.bpm ? `BPM: ${beat.bpm}` : null, beat.beatKey ? `Key: ${escapeHtml(beat.beatKey)}` : null]
    .filter(Boolean)
    .join(" | ");
}

function beatTopTitleHtml(beat) {
  return `<h3 class="beat-title beat-item-top__title">${escapeHtml(beat.title)}</h3>`;
}

function beatProductionMetaHtml(beat) {
  const meta = renderBeatMeta(beat);
  return meta ? `<p class="meta beat-production-meta">${meta}</p>` : "";
}

function cardBeatTagsHtml(beat) {
  return typeof window.BeatVaultRenderBeatTags === "function" ? window.BeatVaultRenderBeatTags(beat) : "";
}

function escapeAttr(value) {
  return escapeHtml(String(value ?? ""));
}

function beatStarStat(starCount) {
  const n = starCount ?? 0;
  const label = n === 1 ? "star" : "stars";
  return `<p class="beat-star-stat" aria-live="polite"><span class="beat-star-count-num">${n}</span> <span class="beat-star-count-label">${label}</span></p>`;
}

function starToggleButton(isStarred, starCount) {
  const count = starCount ?? 0;
  const starredClass = isStarred ? " star-toggle-btn--starred" : "";
  const label = isStarred ? `Starred, ${count} total stars` : `Star this beat (${count} stars)`;
  const titleText = isStarred ? `Starred · ${count} stars` : `Star · ${count} stars`;
  return `<button type="button" class="star-toggle-btn beat-tray-btn${starredClass}" data-reaction="star" aria-pressed="${isStarred ? "true" : "false"}" aria-label="${escapeAttr(label)}" title="${escapeAttr(titleText)}">
    <span class="star-toggle-icon" aria-hidden="true">${TRAY_STAR_ICON}</span>
  </button>`;
}

function renderProfileBeat(beat) {
  const tray = isOwnProfile
    ? ""
    : `<div class="beat-card-tray beat-card-tray--compact" role="group" aria-label="Beat actions">
          ${beatStarStat(beat.reactionCounts?.star ?? 0)}
          ${starToggleButton(beat.isStarred, beat.reactionCounts?.star ?? 0)}
        </div>`;
  const ownNote = isOwnProfile ? `<p class="meta beat-own-note">You cannot star your own beats.</p>` : "";
  const profileU = String(beat.username || currentProfileUsername || "").trim();
  const artistLine = profileU
    ? `<p class="meta beat-item-top__artist">By ${profileLink(profileU)}</p>`
    : "";

  return `
    <article class="beat-item" data-beat-id="${beat.id}" data-starred="${beat.isStarred ? "1" : "0"}">
      <header class="beat-item-top${tray ? "" : " beat-item-top--no-actions"}">
        ${beatTopTitleHtml(beat)}
        ${artistLine}
        <div class="beat-item-top__player">
          ${window.BeatVaultPlaybackLoop ? window.BeatVaultPlaybackLoop.playerHtml(beat.id) : ""}
        </div>
        ${tray}
      </header>
      <div class="beat-item-body">
        <p class="meta beat-visibility-line">${beat.isPublic ? "Public beat" : "Private beat"}</p>
        ${beatProductionMetaHtml(beat)}
        ${beat.notes ? `<p class="meta beat-description">${escapeHtml(beat.notes)}</p>` : ""}
      </div>
      <div class="beat-item-tags">${cardBeatTagsHtml(beat)}</div>
      ${ownNote}
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
  setProfileHeading(
    `${profile.username}'s Profile`,
    isOwnProfile ? "This is your creator profile." : `Creator since ${formatJoined(profile.joinedAt)}`,
  );

  if (profileStats) {
    profileStats.innerHTML = [
      renderStat("Beats shown", profile.beatCount ?? beats.length),
      renderStat("Public beats", profile.publicBeatCount ?? 0),
      renderStat("Stars received", profile.totalStarsReceived ?? 0),
      renderStat("Joined", formatJoined(profile.joinedAt)),
    ].join("");
  }

  const beatsEl = getProfileBeatsList();
  if (!beatsEl) return;

  if (!beats.length) {
    beatsEl.innerHTML = "<p>No beats available for this profile yet.</p>";
    window.BeatVaultPlaybackLoop?.hydratePlayersIn(beatsEl);
    return;
  }

  beatsEl.innerHTML = beats.map(renderProfileBeat).join("");
  window.BeatVaultPlaybackLoop?.hydratePlayersIn(beatsEl);
}

function resolveProfileUsername(user) {
  if (requestedUsername) {
    currentProfileUsername = requestedUsername;
    return;
  }
  if (user?.username) {
    currentProfileUsername = String(user.username).trim();
  }
}

async function fetchProfile() {
  const beatsEl = getProfileBeatsList();

  if (!currentProfileUsername.trim()) {
    setProfileHeading("Profile", "No profile user was provided.");
    if (beatsEl) {
      beatsEl.innerHTML =
        '<p>Open this page from a profile link in Discover or Saved beats, or sign in again if your account has no username.</p>';
    }
    return;
  }

  if (beatsEl) {
    beatsEl.innerHTML = "<p>Loading profile beats...</p>";
  }

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(currentProfileUsername)}`, fetchOpts);
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (response.status === 404) {
      setProfileHeading("Profile", "Profile not found.");
      if (beatsEl) {
        beatsEl.innerHTML = "<p>That creator profile does not exist.</p>";
      }
      return;
    }

    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_parseErr) {
      throw new Error(response.ok ? "Invalid profile response from server." : raw.slice(0, 200) || `HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(data.error || `Failed to load profile (HTTP ${response.status}).`);
    }
    renderProfile(data);
  } catch (error) {
    setProfileHeading("Profile", "Failed to load profile.");
    const el = getProfileBeatsList();
    if (el) {
      el.innerHTML = `<p>${escapeHtml(error.message || "Could not load profile.")}</p>`;
    }
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

document.addEventListener(
  "click",
  async (event) => {
    const beatsList = getProfileBeatsList();
    if (!beatsList || !beatsList.contains(event.target)) return;
    const button = event.target.closest('button[data-reaction="star"]');
    if (!button) return;
    const item = button.closest("[data-beat-id]");
    if (!item) return;
    await toggleStarForBeat(item);
  },
  true,
);

window.BeatVaultProfile = {
  activate(user) {
    return activateProfileView(user);
  },
};

})();
