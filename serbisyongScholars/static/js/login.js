const form = document.getElementById("loginForm");
const errorBox = document.getElementById("error");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch("/api/auth/login/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            errorBox.textContent =
                data.detail || data.error || "Invalid credentials";
            errorBox.classList.remove("hidden");
            return;
        }

        if (data.access) {
            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);
        }

        // Store username for dashboard lookup: prefer explicit user payload
        if (data.user && data.user.username) {
            localStorage.setItem("loggedInUsername", data.user.username);
        } else if (data.access) {
            // Fallback: decode JWT payload to extract username
            try {
                const payload = JSON.parse(atob(data.access.split(".")[1]));
                if (payload && payload.username) {
                    localStorage.setItem("loggedInUsername", payload.username);
                }
            } catch (e) {
            }
        }

        window.location.href = "/dashboard";
    } catch (err) {
        errorBox.textContent = "Connection error. Please try again.";
        errorBox.classList.remove("hidden");
    }
});
