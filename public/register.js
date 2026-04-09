const form = document.getElementById("registerForm");
const message = document.getElementById("formMessage");
const fetchOpts = { credentials: "same-origin" };

(function prefillUsernameFromLogin() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("username");
  if (!fromQuery) return;
  const usernameInput = form?.querySelector('[name="username"]');
  if (!usernameInput) return;
  usernameInput.value = fromQuery;
  if (window.history?.replaceState) {
    const url = new URL(window.location.href);
    url.searchParams.delete("username");
    const qs = url.searchParams.toString();
    window.history.replaceState(null, "", qs ? `${url.pathname}?${qs}` : url.pathname);
  }
})();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!message) return;

  const data = new FormData(form);
  const username = String(data.get("username") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const confirm = String(data.get("confirm") ?? "");

  if (password !== confirm) {
    message.textContent = "Passwords do not match.";
    message.classList.add("error");
    return;
  }

  message.textContent = "Creating account...";
  message.classList.remove("error");

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      ...fetchOpts,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errText =
        body.error ||
        (response.status === 409
          ? "That username is already taken. Try another or sign in."
          : "Registration failed.");
      throw new Error(errText);
    }

    window.location.href = "/";
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});
