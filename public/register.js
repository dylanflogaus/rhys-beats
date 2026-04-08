const form = document.getElementById("registerForm");
const message = document.getElementById("formMessage");
const fetchOpts = { credentials: "same-origin" };

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
      throw new Error(body.error || "Registration failed.");
    }

    window.location.href = "/";
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});
