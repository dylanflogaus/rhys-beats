(function (global) {
  const STORAGE_KEY = "beatVaultPerBeatLoop";

  function escapeAttr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readMap() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function writeMap(map) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (_e) {
      // Ignore storage failures.
    }
  }

  function isLoopOnForBeat(beatId) {
    return Boolean(readMap()[String(beatId)]);
  }

  function setLoopOnForBeat(beatId, on) {
    const map = readMap();
    const key = String(beatId);
    if (on) {
      map[key] = true;
    } else {
      delete map[key];
    }
    writeMap(map);
  }

  function updateLoopButton(btn, on) {
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("beat-loop-btn--active", on);
    btn.title = on ? "Loop on — this beat repeats" : "Loop off — repeat this beat";
    btn.setAttribute("aria-label", on ? "Loop on for this beat" : "Loop off for this beat");
  }

  function hydratePlayerWrap(wrap) {
    const audio = wrap.querySelector("audio");
    const btn = wrap.querySelector(".beat-loop-btn");
    if (!(audio instanceof HTMLAudioElement) || !btn) return;
    const beatId = btn.dataset.beatId;
    if (!beatId) return;
    const on = isLoopOnForBeat(beatId);
    audio.loop = on;
    updateLoopButton(btn, on);
  }

  function hydratePlayersIn(root) {
    const scope = root instanceof Element ? root : global.document;
    scope.querySelectorAll(".beat-player-wrap").forEach(hydratePlayerWrap);
  }

  function beatPlayerHtml(beatId) {
    const idStr = String(beatId);
    const idAttr = escapeAttr(idStr);
    return `<div class="beat-player-wrap">
    <div class="beat-player-wrap__audio">
      <audio controls src="/api/beats/audio/${idStr}"></audio>
    </div>
    <button type="button" class="beat-loop-btn" data-beat-id="${idAttr}" aria-pressed="false" aria-label="Loop off for this beat" title="Loop off — repeat this beat"><span class="beat-loop-btn__label" aria-hidden="true">↻</span></button>
  </div>`;
  }

  global.document.addEventListener("click", (event) => {
    const btn = event.target.closest(".beat-loop-btn");
    if (!btn) return;
    const wrap = btn.closest(".beat-player-wrap");
    const audio = wrap?.querySelector("audio");
    if (!(audio instanceof HTMLAudioElement)) return;
    const beatId = btn.dataset.beatId;
    if (!beatId) return;
    const next = !audio.loop;
    audio.loop = next;
    setLoopOnForBeat(beatId, next);
    updateLoopButton(btn, next);
  });

  global.BeatVaultPlaybackLoop = {
    hydratePlayersIn,
    playerHtml: beatPlayerHtml,
  };
})(window);
