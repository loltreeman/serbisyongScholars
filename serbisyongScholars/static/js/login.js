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

        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);

        const userRole = data.user ? data.user.role : null;
        localStorage.setItem("userRole", userRole);
        localStorage.setItem("loggedInUsername", data.user.username);
        localStorage.setItem("officeName", data.user.office_name || "");
        localStorage.setItem("isOaaMod", data.user.is_oaa_mod ? "true" : "false");

        console.log("LOGIN SUCCESS. ROLE:", userRole);

        if (userRole === "ADMIN") {
            window.location.replace("/api/dashboard/admin");  
        } else if (userRole === "MODERATOR") {
            window.location.replace("/moderator/dashboard/"); 
        } else {
            window.location.replace("/scholar/dashboard/"); 
        }

    } catch (err) {
        console.error(err);
        errorBox.textContent = "Connection error. Please try again.";
        errorBox.classList.remove("hidden");
    }
});