(function () {
const userBar = document.getElementById("userBar");
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");
const pageHeaderTitle = document.getElementById("pageHeaderTitle");
const pageHeaderSubtitle = document.getElementById("pageHeaderSubtitle");
const profileStats = document.getElementById("profileStats");

function setProfileHeading(title, subtitle) {
  if (pageHeaderTitle && title != null) pageHeaderTitle.textContent = title;
  if (pageHeaderSubtitle && subtitle != null) pageHeaderSubtitle.textContent = subtitle;
}
const profileBeatsList = document.getElementById("profileBeatsList");
const fetchOpts = { credentials: "same-origin" };
const TRAY_STAR_ICON = `<svg class="tray-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const urlParams = new URLSearchParams(window.location.search);
const requestedUsername = (urlParams.get("u") || urlParams.get("username") || "").trim();
const isStandaloneProfilePage = /profile\.html$/i.test(location.pathname);

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

function beatTopTitleHtml(beat) {
  return `<h3 class="beat-title beat-item-top__title">${escapeHtml(beat.title)}</h3>`;
}

function beatProductionMetaHtml(beat) {
  const meta = renderBeatMeta(beat);
  return meta ? `<p class="meta beat-production-meta">${meta}</p>` : "";
}

function profileLink(username) {
  const safeUsername = String(username ?? "");
  return `<a class="profile-link" href="/profile.html?u=${encodeURIComponent(safeUsername)}">${escapeHtml(safeUsername)}</a>`;
}

function renderBeatTags(beat) {
  if (!Array.isArray(beat.tags) || !beat.tags.length) return "";
  const chips = beat.tags
    .slice(0, 8)
    .map((tag) => `<span>#${escapeHtml(String(tag))}</span>`)
    .join(" ");
  return `<p class="meta">${chips}</p>`;
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
      <header class="beat-item-top">
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
      <div class="beat-item-tags">${renderBeatTags(beat)}</div>
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
  if (isStandaloneProfilePage) {
    document.title = `${profile.username} - Beat Vault`;
  }
  setProfileHeading(
    `${profile.username}'s Profile`,
    isOwnProfile ? "This is your creator profile." : `Creator since ${formatJoined(profile.joinedAt)}`,
  );

  profileStats.innerHTML = [
    renderStat("Beats shown", profile.beatCount ?? beats.length),
    renderStat("Public beats", profile.publicBeatCount ?? 0),
    renderStat("Stars received", profile.totalStarsReceived ?? 0),
    renderStat("Joined", formatJoined(profile.joinedAt)),
  ].join("");

  if (!beats.length) {
    profileBeatsList.innerHTML = "<p>No beats available for this profile yet.</p>";
    window.BeatVaultPlaybackLoop?.hydratePlayersIn(profileBeatsList);
    return;
  }

  profileBeatsList.innerHTML = beats.map(renderProfileBeat).join("");
  window.BeatVaultPlaybackLoop?.hydratePlayersIn(profileBeatsList);
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

async function bootstrapProfileView(user) {
  if (!profileBeatsList) return;
  resolveProfileUsername(user);
  await fetchProfile();
}

async function fetchProfile() {
  if (!currentProfileUsername) {
    setProfileHeading("Profile", "No profile user was provided.");
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
      setProfileHeading("Profile", "Profile not found.");
      profileBeatsList.innerHTML = "<p>That creator profile does not exist.</p>";
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load profile.");
    }
    renderProfile(data);
  } catch (error) {
    setProfileHeading("Profile", "Failed to load profile.");
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
  const button = event.target.closest('button[data-reaction="star"]');
  if (!button) return;
  const item = button.closest("[data-beat-id]");
  if (!item) return;
  await toggleStarForBeat(item);
});

if (isStandaloneProfilePage) {
  logoutBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", ...fetchOpts });
    } catch (_e) {
      // ignore
    }
    window.location.replace("/login.html");
  });

  requireAuth()
    .then((user) => {
      if (!user) {
        window.location.replace("/login.html");
        return;
      }
      showUser(user);
      return bootstrapProfileView(user);
    })
    .catch(() => {
      window.location.replace("/login.html");
    });
} else {
  window.initBeatVaultProfilePanel = (user) => {
    void bootstrapProfileView(user);
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

})();
