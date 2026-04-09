const beatForm = document.getElementById("beatForm");
const beatsList = document.getElementById("beatsList");
const discoverBeatsList = document.getElementById("discoverBeatsList");
const savedBeatsList = document.getElementById("savedBeatsList");
const discoverSortTabs = document.getElementById("discoverSortTabs");
const discoverRangeSelect = document.getElementById("discoverRangeSelect");
const discoverIncludeTagsInput = document.getElementById("discoverIncludeTagsInput");
const discoverExcludeTagsInput = document.getElementById("discoverExcludeTagsInput");
const discoverClearTagFiltersBtn = document.getElementById("discoverClearTagFiltersBtn");
const discoverFilterSummary = document.getElementById("discoverFilterSummary");
const libraryViewTabs = document.getElementById("libraryViewTabs");
const libraryPanes = Array.from(document.querySelectorAll("[data-library-pane]"));
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
const customTagsInput = beatForm?.querySelector('input[name="customTags"]');
const analysisPreview = document.getElementById("analysisPreview");
const autoTagsEditor = document.getElementById("autoTagsEditor");
const sidebarLinks = Array.from(document.querySelectorAll(".sidebar-link[data-page]"));
const viewPanels = Array.from(document.querySelectorAll(".view-panel[data-page]"));
const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");
const pageHeaderTitle = document.getElementById("pageHeaderTitle");
const pageHeaderSubtitle = document.getElementById("pageHeaderSubtitle");
let currentAuthUser = null;

/** Main-column header copy for each sidebar section (edit here to customize per page). */
const PAGE_HEADER_COPY = {
  discover: {
    title: "Discover",
    subtitle: "Browse public beats from the community, filter by tags, and star what you love.",
  },
  studio: {
    title: "Studio",
    subtitle: "A focused snapshot of your workflow—tune this space as you grow.",
  },
  upload: {
    title: "Upload beat",
    subtitle: "Add a new beat to your library and optionally publish it to Discover.",
  },
};

const LIBRARY_HEADER_COPY = {
  mine: {
    title: "My beats",
    subtitle: "Upload, edit visibility, and manage the instrumentals in your library.",
  },
  saved: {
    title: "Saved beats",
    subtitle: "Beats you starred in Discover—your personal shortlist from other creators.",
  },
};

function applyPageHeader({ title, subtitle }) {
  if (pageHeaderTitle && title != null) pageHeaderTitle.textContent = title;
  if (pageHeaderSubtitle && subtitle != null) pageHeaderSubtitle.textContent = subtitle;
}

function syncPageHeaderWithNav() {
  const activePanel = viewPanels.find((panel) => panel.classList.contains("active"));
  const page = activePanel?.dataset.page;
  if (page === "library") {
    applyPageHeader(LIBRARY_HEADER_COPY[libraryView] ?? LIBRARY_HEADER_COPY.mine);
    return;
  }
  if (page === "profile") {
    applyPageHeader({ title: "Profile", subtitle: "Loading profile..." });
    return;
  }
  const copy = page ? PAGE_HEADER_COPY[page] : null;
  if (copy) applyPageHeader(copy);
}

const fetchOpts = { credentials: "same-origin" };
/* Inline SVG: CSS mask does not render Feather stroke-only paths. */
const TRAY_STAR_ICON = `<svg class="tray-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const discoverState = {
  sort: "most_starred",
  range: "week",
};
/** Last successful Discover fetch (for client-side tag filtering). */
let discoverBeatsCache = [];
let libraryView = "mine";
let pendingAnalysisPromise = null;
let autoTagState = [];
let activeBeatAudio = null;
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
  const name = String(user.username ?? "").trim();
  userLabel.innerHTML = name
    ? `Signed in as <a class="profile-link" href="/index.html?u=${encodeURIComponent(name)}#profile">${escapeHtml(name)}</a>`
    : "Signed in as —";
  userBar.hidden = false;
  currentAuthUser = user;
}

function applyStarReactionToBeatItem(item, { isStarred, reactionCounts }) {
  if (!item) return;
  item.dataset.starred = isStarred ? "1" : "0";
  const btn = item.querySelector('button[data-reaction="star"]');
  if (!btn) return;
  const starCount = reactionCounts?.star ?? 0;
  btn.classList.toggle("star-toggle-btn--starred", isStarred);
  btn.setAttribute("aria-pressed", String(isStarred));
  btn.setAttribute(
    "aria-label",
    isStarred ? `Starred, ${starCount} total stars` : `Star this beat (${starCount} stars)`,
  );
  btn.title = isStarred ? `Starred · ${starCount} stars` : `Star · ${starCount} stars`;

  const statNum = item.querySelector(".beat-star-count-num");
  const statLabel = item.querySelector(".beat-star-count-label");
  if (statNum) statNum.textContent = String(starCount);
  if (statLabel) statLabel.textContent = starCount === 1 ? "star" : "stars";
}

function beatStarStat(starCount) {
  const n = starCount ?? 0;
  const label = n === 1 ? "star" : "stars";
  return `<p class="beat-star-stat" aria-live="polite"><span class="beat-star-count-num">${n}</span> <span class="beat-star-count-label">${label}</span></p>`;
}

function getHashPage() {
  return window.location.hash.replace(/^#/, "").trim().toLowerCase();
}

function setActivePage(page, { updateHash = true } = {}) {
  if (!viewPanels.length || !sidebarLinks.length) return;
  const fallbackPage = viewPanels[0]?.dataset.page || "discover";
  const nextPage = viewPanels.some((panel) => panel.dataset.page === page) ? page : fallbackPage;
  const previousPage = viewPanels.find((panel) => panel.classList.contains("active"))?.dataset.page;
  viewPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.page === nextPage);
  });
  sidebarLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === nextPage);
  });
  if (updateHash) {
    if (nextPage === "profile") {
      window.history.replaceState(null, "", `${window.location.pathname}#profile`);
    } else {
      const targetHash = `#${nextPage}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, "", targetHash);
      }
    }
  }

  if (previousPage === "library" && nextPage !== "library") {
    void fetchSavedBeats();
  }

  syncPageHeaderWithNav();
  if (nextPage === "profile" && window.BeatVaultProfile) {
    void window.BeatVaultProfile.activate(currentAuthUser);
  }
}

function initSidebarNavigation() {
  if (!viewPanels.length || !sidebarLinks.length) return;
  const raw = getHashPage();
  const valid = Boolean(raw && viewPanels.some((p) => p.dataset.page === raw));
  const initialPage = valid ? raw : viewPanels[0]?.dataset.page || "discover";
  setActivePage(initialPage, { updateHash: !valid || !raw });

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetPage = link.dataset.page;
      if (!targetPage) return;
      event.preventDefault();
      setActivePage(targetPage, { updateHash: true });
    });
  });

  window.addEventListener("hashchange", () => {
    setActivePage(getHashPage(), { updateHash: false });
  });
}

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  if (!sidebarCollapseBtn) return;
  sidebarCollapseBtn.setAttribute("aria-expanded", String(!collapsed));
  const nextLabel = collapsed ? "Expand the sidebar" : "Collapse the sidebar";
  sidebarCollapseBtn.setAttribute("aria-label", nextLabel);
  sidebarCollapseBtn.setAttribute("title", nextLabel);
}

function initSidebarCollapse() {
  if (!sidebarCollapseBtn) return;
  const storageKey = "beatVaultSidebarCollapsed";
  const startsCollapsed = window.localStorage.getItem(storageKey) === "1";
  setSidebarCollapsed(startsCollapsed);

  sidebarCollapseBtn.addEventListener("click", () => {
    const shouldCollapse = !document.body.classList.contains("sidebar-collapsed");
    setSidebarCollapsed(shouldCollapse);
    window.localStorage.setItem(storageKey, shouldCollapse ? "1" : "0");
  });
}

function setActiveLibraryView(nextView) {
  const validView = nextView === "saved" ? "saved" : "mine";
  const previousView = libraryView;
  libraryView = validView;
  const buttons = libraryViewTabs?.querySelectorAll("[data-library-view]") ?? [];
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.libraryView === validView);
  });
  libraryPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.libraryPane === validView);
  });
  if (previousView === "saved" && validView === "mine") {
    void fetchSavedBeats();
  }

  const activePanel = viewPanels.find((panel) => panel.classList.contains("active"));
  if (activePanel?.dataset.page === "library") {
    syncPageHeaderWithNav();
  }
}

function handleBeatAudioPlay(event) {
  const nextAudio = event.target;
  if (!(nextAudio instanceof HTMLAudioElement)) return;
  const previousAudio = activeBeatAudio;
  activeBeatAudio = nextAudio;
  if (previousAudio && previousAudio !== nextAudio && !previousAudio.paused) {
    previousAudio.pause();
  }
}

function handleBeatAudioPause(event) {
  const audio = event.target;
  if (!(audio instanceof HTMLAudioElement)) return;
  if (audio === activeBeatAudio && audio.paused) {
    activeBeatAudio = null;
  }
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

function beatPlayerMarkup(beatId) {
  return window.BeatVaultPlaybackLoop ? window.BeatVaultPlaybackLoop.playerHtml(beatId) : "";
}

function renderMyBeat(beat) {
  const isPublicChecked = beat.isPublic ? "checked" : "";
  const tagsValue = Array.isArray(beat.tags) ? beat.tags.join(", ") : "";
  return `
    <article class="beat-item">
      <header class="beat-item-top">
        ${beatTopTitleHtml(beat)}
        <p class="meta beat-item-top__artist beat-item-top__artist--mine">Your library</p>
        <div class="beat-item-top__player">
          ${beatPlayerMarkup(beat.id)}
        </div>
        <div class="beat-actions">
          <button type="button" class="edit-btn" data-id="${beat.id}">Edit</button>
          <button type="button" class="delete-btn" data-id="${beat.id}">Delete</button>
        </div>
      </header>
      <div class="beat-item-body">
        <p class="meta beat-visibility-line">${beat.isPublic ? "Public in Discover" : "Private beat"}</p>
        ${beatProductionMetaHtml(beat)}
        ${beat.notes ? `<p class="meta beat-description">${escapeHtml(beat.notes)}</p>` : ""}
      </div>
      <div class="beat-item-tags">${renderBeatTags(beat)}</div>
      <form class="edit-beat-form" data-id="${beat.id}" hidden>
        <div class="grid">
          <label>
            Title *
            <input type="text" name="title" value="${escapeAttr(beat.title)}" required />
          </label>
          <label>
            Producer
            <input type="text" name="producer" value="${escapeAttr(beat.producer || "")}" />
          </label>
          <label>
            BPM
            <input type="number" name="bpm" min="1" max="300" value="${escapeAttr(beat.bpm || "")}" />
          </label>
          <label>
            Key
            <input type="text" name="beatKey" value="${escapeAttr(beat.beatKey || "")}" placeholder="e.g. F# minor" />
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" rows="3">${escapeHtml(beat.notes || "")}</textarea>
        </label>
        <label>
          Tags
          <input type="text" name="tags" value="${escapeAttr(tagsValue)}" placeholder="Comma separated tags" />
        </label>
        <label class="checkbox-row">
          <input type="checkbox" name="isPublic" value="1" ${isPublicChecked} />
          Make this beat public in Discover
        </label>
        <div class="edit-actions">
          <button type="submit" class="save-edit-btn">Save changes</button>
          <button type="button" class="cancel-edit-btn">Cancel</button>
        </div>
        <p class="message beat-edit-message"></p>
      </form>
    </article>
  `;
}

function renderBeatTags(beat) {
  if (!Array.isArray(beat.tags) || !beat.tags.length) return "";
  const chips = beat.tags
    .slice(0, 8)
    .map((tag) => `<span>#${escapeHtml(String(tag))}</span>`)
    .join(" ");
  return `<p class="meta">${chips}</p>`;
}

function beatNormalizedTagSet(beat) {
  const tags = Array.isArray(beat.tags) ? beat.tags : [];
  const set = new Set();
  for (const raw of tags) {
    const t = sanitizeTag(String(raw));
    if (t) set.add(t);
  }
  return set;
}

function readDiscoverTagFilterLists() {
  return {
    include: parseTagCsv(discoverIncludeTagsInput?.value ?? ""),
    exclude: parseTagCsv(discoverExcludeTagsInput?.value ?? ""),
  };
}

function beatPassesDiscoverTagFilters(beat, includeTags, excludeTags) {
  const set = beatNormalizedTagSet(beat);
  for (const t of excludeTags) {
    if (set.has(t)) return false;
  }
  for (const t of includeTags) {
    if (!set.has(t)) return false;
  }
  return true;
}

function updateDiscoverFilterSummary(total, shown, filtersActive) {
  if (!discoverFilterSummary) return;
  if (!filtersActive || total === 0) {
    discoverFilterSummary.hidden = true;
    discoverFilterSummary.textContent = "";
    return;
  }
  if (shown === total) {
    discoverFilterSummary.hidden = true;
    discoverFilterSummary.textContent = "";
    return;
  }
  discoverFilterSummary.hidden = false;
  discoverFilterSummary.textContent = `Showing ${shown} of ${total} beats after tag filters.`;
}

function clearDiscoverTagFilters() {
  if (discoverIncludeTagsInput) discoverIncludeTagsInput.value = "";
  if (discoverExcludeTagsInput) discoverExcludeTagsInput.value = "";
  if (discoverBeatsCache.length) {
    renderDiscoverBeatsFromCache();
  } else if (discoverFilterSummary) {
    discoverFilterSummary.hidden = true;
    discoverFilterSummary.textContent = "";
  }
}

function restoreDiscoverListScroll(scrollAnchorBeatId, savedScrollY) {
  if (!discoverBeatsList || scrollAnchorBeatId == null || scrollAnchorBeatId === "" || savedScrollY == null) {
    return;
  }
  const anchorId = Number(scrollAnchorBeatId);
  requestAnimationFrame(() => {
    const el = Number.isFinite(anchorId)
      ? discoverBeatsList.querySelector(`[data-beat-id="${anchorId}"]`)
      : null;
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
    } else {
      window.scrollTo({ top: savedScrollY, behavior: "auto" });
    }
  });
}

function renderDiscoverBeatsFromCache(options = {}) {
  if (!discoverBeatsList) return;
  const scrollAnchorBeatId = options.scrollAnchorBeatId ?? null;
  const savedScrollY =
    scrollAnchorBeatId != null && scrollAnchorBeatId !== "" ? window.scrollY : null;

  const { include, exclude } = readDiscoverTagFilterLists();
  const filtersActive = include.length > 0 || exclude.length > 0;
  const filtered = discoverBeatsCache.filter((beat) => beatPassesDiscoverTagFilters(beat, include, exclude));

  updateDiscoverFilterSummary(discoverBeatsCache.length, filtered.length, filtersActive);

  const emptyFilterMessage = `<p>No beats match your tag filters. Try different tags or <button type="button" class="inline-clear-filters-btn" id="discoverClearTagFiltersInline">clear tag filters</button>.</p>`;
  const emptyDiscoverMessage =
    "<p>No public beats from other creators yet. Try <strong>All time</strong> in the time range, or widen filters.</p>";

  if (!filtered.length) {
    discoverBeatsList.innerHTML = discoverBeatsCache.length && filtersActive ? emptyFilterMessage : emptyDiscoverMessage;
    restoreDiscoverListScroll(scrollAnchorBeatId, savedScrollY);
    window.BeatVaultPlaybackLoop?.hydratePlayersIn(discoverBeatsList);
    return;
  }

  discoverBeatsList.innerHTML = filtered.map(renderDiscoverBeat).join("");
  restoreDiscoverListScroll(scrollAnchorBeatId, savedScrollY);
  window.BeatVaultPlaybackLoop?.hydratePlayersIn(discoverBeatsList);
}

function renderDiscoverBeatTags(beat) {
  const tags = Array.isArray(beat.tags)
    ? beat.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  if (!tags.length) {
    return '<p class="meta beat-tags-empty">No tags yet</p>';
  }
  const chips = tags
    .slice(0, 12)
    .map((tag) => {
      const t = String(tag);
      return `<button type="button" class="discover-tag-chip" data-tag="${escapeAttr(t)}" title="Add #${escapeAttr(t)} to include filter">#${escapeHtml(t)}</button>`;
    })
    .join("");
  return `<div class="beat-tags-block"><div class="beat-tag-chip-row">${chips}</div></div>`;
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

    beatsList.innerHTML = beats.map(renderMyBeat).join("");
    window.BeatVaultPlaybackLoop?.hydratePlayersIn(beatsList);
  } catch (_error) {
    beatsList.innerHTML = "<p>Failed to load beats.</p>";
  }
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

function profileLink(username) {
  const safeUsername = String(username ?? "");
  return `<a class="profile-link" href="/index.html?u=${encodeURIComponent(safeUsername)}#profile">${escapeHtml(safeUsername)}</a>`;
}

function renderDiscoverBeat(beat) {
  return `
    <article class="beat-item" data-beat-id="${beat.id}" data-starred="${beat.isStarred ? "1" : "0"}">
      <header class="beat-item-top">
        ${beatTopTitleHtml(beat)}
        <p class="meta beat-item-top__artist">By ${profileLink(beat.username)}</p>
        <div class="beat-item-top__player">
          ${beatPlayerMarkup(beat.id)}
        </div>
        <div class="beat-card-tray beat-card-tray--compact" role="group" aria-label="Beat actions">
          ${beatStarStat(beat.reactionCounts?.star ?? 0)}
          ${starToggleButton(beat.isStarred, beat.reactionCounts?.star ?? 0)}
        </div>
      </header>
      <div class="beat-item-body">
        ${beatProductionMetaHtml(beat)}
        ${beat.notes ? `<p class="meta beat-description">${escapeHtml(beat.notes)}</p>` : ""}
      </div>
      <div class="beat-item-tags">${renderDiscoverBeatTags(beat)}</div>
    </article>
  `;
}

function renderStarredBeat(beat) {
  return `
    <article class="beat-item" data-beat-id="${beat.id}" data-starred="1">
      <header class="beat-item-top">
        ${beatTopTitleHtml(beat)}
        <p class="meta beat-item-top__artist">By ${profileLink(beat.username)}</p>
        <div class="beat-item-top__player">
          ${beatPlayerMarkup(beat.id)}
        </div>
        <div class="beat-card-tray beat-card-tray--compact" role="group" aria-label="Beat actions">
          ${beatStarStat(beat.reactionCounts?.star ?? 0)}
          ${starToggleButton(true, beat.reactionCounts?.star ?? 0)}
        </div>
      </header>
      <div class="beat-item-body">
        ${beatProductionMetaHtml(beat)}
        ${beat.notes ? `<p class="meta beat-description">${escapeHtml(beat.notes)}</p>` : ""}
      </div>
      <div class="beat-item-tags">${renderBeatTags(beat)}</div>
    </article>
  `;
}

async function fetchDiscoverBeats(options = {}) {
  if (!discoverBeatsList) return;
  const scrollAnchorBeatId = options.scrollAnchorBeatId ?? null;

  if (scrollAnchorBeatId == null || scrollAnchorBeatId === "") {
    discoverBeatsList.innerHTML = "<p>Loading community beats...</p>";
  }

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
      discoverBeatsCache = [];
      discoverBeatsList.innerHTML = `<p>${escapeHtml(beats.error)}</p>`;
      updateDiscoverFilterSummary(0, 0, false);
      return;
    }
    discoverBeatsCache = Array.isArray(beats) ? beats : [];
    if (!discoverBeatsCache.length) {
      updateDiscoverFilterSummary(0, 0, false);
      discoverBeatsList.innerHTML =
        "<p>No public beats from other creators yet. Try <strong>All time</strong> in the time range, or widen filters.</p>";
      return;
    }
    renderDiscoverBeatsFromCache({ scrollAnchorBeatId });
  } catch (_error) {
    discoverBeatsCache = [];
    discoverBeatsList.innerHTML = "<p>Failed to load Discover.</p>";
    updateDiscoverFilterSummary(0, 0, false);
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
    window.BeatVaultPlaybackLoop?.hydratePlayersIn(savedBeatsList);
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

function parseTagCsv(raw) {
  return uniqueTags(String(raw || "").split(","));
}

function setAutoTagState(tags) {
  autoTagState = uniqueTags(tags);
  if (autoTagsInput) {
    autoTagsInput.value = autoTagState.join(",");
  }
  renderAutoTagEditor();
}

function renderAutoTagEditor() {
  if (!autoTagsEditor) return;
  if (!autoTagState.length) {
    autoTagsEditor.innerHTML = "";
    autoTagsEditor.hidden = true;
    return;
  }
  autoTagsEditor.hidden = false;
  autoTagsEditor.innerHTML = `
    <div class="tag-editor-header">
      <p class="meta">Auto tags (click x to remove any):</p>
      <button type="button" class="tag-clear-btn" data-action="clear-auto-tags">Clear all</button>
    </div>
    <div class="tag-chip-list">
      ${autoTagState
        .map(
          (tag) => `<button type="button" class="tag-chip" data-action="remove-auto-tag" data-tag="${escapeAttr(tag)}">
        <span>#${escapeHtml(tag)}</span>
        <span aria-hidden="true">x</span>
      </button>`
        )
        .join("")}
    </div>
  `;
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
    setAutoTagState([]);
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

  setAutoTagState(inferredTags);
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
    if (autoTagState.length) {
      formData.set("autoTags", autoTagState.join(","));
    }
  }
  const mergedTags = uniqueTags([...autoTagState, ...parseTagCsv(customTagsInput?.value)]);
  if (mergedTags.length) {
    formData.set("tags", mergedTags.join(","));
  } else {
    formData.delete("tags");
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
    setAutoTagState([]);
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

autoTagsEditor?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "clear-auto-tags") {
    setAutoTagState([]);
    if (analysisPreview) {
      analysisPreview.textContent = "Auto tags cleared. You can still use custom tags.";
    }
    return;
  }
  if (action === "remove-auto-tag") {
    const tag = String(button.dataset.tag || "");
    setAutoTagState(autoTagState.filter((item) => item !== tag));
    if (analysisPreview && autoTagState.length) {
      analysisPreview.textContent = `Auto tags: ${autoTagState.map((item) => `#${item}`).join(" ")}`;
    } else if (analysisPreview) {
      analysisPreview.textContent = "All auto tags removed. You can still use custom tags.";
    }
  }
});

rollTitleBtn?.addEventListener("click", () => {
  rollBeatTitle(true);
});

beatsList?.addEventListener("click", async (event) => {
  const editButton = event.target.closest(".edit-btn");
  if (editButton) {
    const item = editButton.closest(".beat-item");
    const form = item?.querySelector(".edit-beat-form");
    if (form) {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        const titleField = form.querySelector('input[name="title"]');
        titleField?.focus();
      }
    }
    return;
  }

  const cancelButton = event.target.closest(".cancel-edit-btn");
  if (cancelButton) {
    const form = cancelButton.closest(".edit-beat-form");
    if (form) {
      form.reset();
      form.hidden = true;
      const message = form.querySelector(".beat-edit-message");
      if (message) {
        message.textContent = "";
        message.classList.remove("error");
      }
    }
    return;
  }

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

beatsList?.addEventListener("submit", async (event) => {
  const form = event.target.closest(".edit-beat-form");
  if (!form) return;
  event.preventDefault();

  const beatId = form.dataset.id;
  if (!beatId) return;
  const message = form.querySelector(".beat-edit-message");
  if (message) {
    message.textContent = "Saving changes...";
    message.classList.remove("error");
  }

  const values = new FormData(form);
  const payload = {
    title: String(values.get("title") || "").trim(),
    producer: String(values.get("producer") || "").trim(),
    bpm: String(values.get("bpm") || "").trim(),
    beatKey: String(values.get("beatKey") || "").trim(),
    notes: String(values.get("notes") || "").trim(),
    tags: String(values.get("tags") || "").trim(),
    isPublic: values.get("isPublic") === "1",
  };

  try {
    const response = await fetch(`/api/beats/${beatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      ...fetchOpts,
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }
    if (!response.ok) {
      throw new Error(data.error || "Failed to update beat.");
    }

    if (message) {
      message.textContent = "Saved.";
      message.classList.remove("error");
    }
    form.hidden = true;
    await fetchBeats();
    await Promise.all([fetchDiscoverBeats(), fetchSavedBeats()]);
  } catch (error) {
    if (message) {
      message.textContent = error.message || "Failed to update beat.";
      message.classList.add("error");
    }
  }
});

async function toggleStarForBeat(item, { fromSavedLibrary = false } = {}) {
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

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Could not update star.");
    }

    await fetchDiscoverBeats(fromSavedLibrary ? {} : { scrollAnchorBeatId: beatId });

    if (fromSavedLibrary) {
      applyStarReactionToBeatItem(item, {
        isStarred: data.isStarred,
        reactionCounts: data.reactionCounts,
      });
    } else {
      await fetchSavedBeats();
    }
  } catch (error) {
    alert(error.message || "Could not update star.");
  }
}

discoverBeatsList?.addEventListener("click", async (event) => {
  const inlineClear = event.target.closest("#discoverClearTagFiltersInline");
  if (inlineClear) {
    event.preventDefault();
    clearDiscoverTagFilters();
    return;
  }

  const tagChip = event.target.closest(".discover-tag-chip");
  if (tagChip && discoverIncludeTagsInput) {
    const raw = tagChip.dataset.tag || "";
    const normalized = sanitizeTag(raw);
    if (normalized) {
      event.preventDefault();
      const current = parseTagCsv(discoverIncludeTagsInput.value);
      if (!current.includes(normalized)) {
        discoverIncludeTagsInput.value = [...current, normalized].join(", ");
      }
      if (discoverBeatsCache.length) renderDiscoverBeatsFromCache();
    }
    return;
  }

  const button = event.target.closest(`button[data-reaction="star"]`);
  if (!button) return;
  const item = button.closest("[data-beat-id]");
  if (!item) return;
  await toggleStarForBeat(item);
});

discoverIncludeTagsInput?.addEventListener("input", () => {
  if (discoverBeatsCache.length) renderDiscoverBeatsFromCache();
});
discoverExcludeTagsInput?.addEventListener("input", () => {
  if (discoverBeatsCache.length) renderDiscoverBeatsFromCache();
});
discoverClearTagFiltersBtn?.addEventListener("click", () => {
  clearDiscoverTagFilters();
});

savedBeatsList?.addEventListener("click", async (event) => {
  const button = event.target.closest(`button[data-reaction="star"]`);
  if (!button) return;
  const item = button.closest("[data-beat-id]");
  if (!item) return;
  await toggleStarForBeat(item, { fromSavedLibrary: true });
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

libraryViewTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-library-view]");
  if (!button) return;
  const nextView = button.dataset.libraryView;
  if (!nextView || nextView === libraryView) return;
  setActiveLibraryView(nextView);
});

document.addEventListener("play", handleBeatAudioPlay, true);
document.addEventListener("pause", handleBeatAudioPause, true);

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

function escapeAttr(value) {
  return escapeHtml(String(value ?? ""));
}

requireAuth()
  .then((user) => {
    if (user) showUser(user);
    if (titleSuggestion) rollBeatTitle(false);
    setActiveSortTab(discoverState.sort);
    setActiveLibraryView(libraryView);
    initSidebarNavigation();
    initSidebarCollapse();
  })
  .catch(() => {
    window.location.replace("/login.html");
  })
  .then(() => Promise.all([fetchBeats(), fetchDiscoverBeats(), fetchSavedBeats()]));
