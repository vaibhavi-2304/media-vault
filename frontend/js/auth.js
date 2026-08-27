const API_URL = "http://localhost:5000";

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = document.getElementById("message");
  message.textContent = "Logging in...";

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
      })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message);

    localStorage.setItem("token", data.token);
    window.location.href = "dashboard.html";
  } catch (error) {
    message.textContent = error.message;
  }
});