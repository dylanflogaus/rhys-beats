const beatForm = document.getElementById("beatForm");
const beatsList = document.getElementById("beatsList");
const formMessage = document.getElementById("formMessage");
const userBar = document.getElementById("userBar");
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");

const fetchOpts = { credentials: "same-origin" };

async function requireAuth() {
  const response = await fetch("/api/auth/me", fetchOpts);
  if (response.status === 401) {
    window.location.href = "/login.html";
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

async function fetchBeats() {
  beatsList.innerHTML = "<p>Loading beats...</p>";

  try {
    const response = await fetch("/api/beats", fetchOpts);
    if (response.status === 401) {
      window.location.href = "/login.html";
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
              <p class="meta">
                ${beat.producer ? `Producer: ${escapeHtml(beat.producer)} | ` : ""}
                ${beat.bpm ? `BPM: ${beat.bpm} | ` : ""}
                ${beat.beatKey ? `Key: ${escapeHtml(beat.beatKey)}` : ""}
              </p>
              ${beat.notes ? `<p class="meta">${escapeHtml(beat.notes)}</p>` : ""}
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

beatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "Saving...";
  formMessage.classList.remove("error");

  const formData = new FormData(beatForm);

  try {
    const response = await fetch("/api/beats", {
      method: "POST",
      body: formData,
      ...fetchOpts,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to save beat.");
    }

    beatForm.reset();
    formMessage.textContent = "Beat saved.";
    await fetchBeats();
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add("error");
  }
});

beatsList.addEventListener("click", async (event) => {
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
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      throw new Error("Delete failed.");
    }
    await fetchBeats();
  } catch (_error) {
    alert("Failed to delete beat.");
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST", ...fetchOpts });
  } catch (_e) {
    // ignore
  }
  window.location.href = "/login.html";
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
  })
  .catch(() => {
    window.location.href = "/login.html";
  })
  .then(() => fetchBeats());
