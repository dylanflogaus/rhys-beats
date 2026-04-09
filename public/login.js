const form = document.getElementById("loginForm");
const message = document.getElementById("formMessage");
const registerLink = document.getElementById("registerLink");
const fetchOpts = { credentials: "same-origin" };

registerLink?.addEventListener("click", (event) => {
  const usernameInput = form?.querySelector('[name="username"]');
  const username = String(usernameInput?.value ?? "").trim();
  if (!username) return;
  event.preventDefault();
  const params = new URLSearchParams({ username });
  window.location.href = `/register.html?${params.toString()}`;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!message) return;

  const data = new FormData(form);
  const username = String(data.get("username") ?? "").trim();
  const password = String(data.get("password") ?? "");

  message.textContent = "Signing in...";
  message.classList.remove("error");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      ...fetchOpts,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || "Sign in failed.");
    }

    window.location.href = "/";
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});
