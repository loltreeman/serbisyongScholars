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
            errorBox.textContent = data.detail || data.error || "Invalid credentials";
            errorBox.classList.remove("hidden");
            return;
        }

        // Store tokens
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);

        // Capture Role
        const userRole = data.user ? data.user.role : null;
        localStorage.setItem("userRole", userRole);
        localStorage.setItem("loggedInUsername", data.user.username);

        console.log("LOGIN SUCCESS. ROLE:", userRole);

        // --- THE CRITICAL REDIRECT LOGIC ---
        if (userRole === "ADMIN") {
            window.location.replace("/api/admin/dashboard/");
        } else if (userRole === "SCHOLAR") {
            window.location.replace("/dashboard/");
        } else {
            // Fallback for Moderators or undefined
            window.location.replace("/dashboard/");
        }

    } catch (err) {
        console.error(err);
        errorBox.textContent = "Connection error. Please try again.";
        errorBox.classList.remove("hidden");
    }
});