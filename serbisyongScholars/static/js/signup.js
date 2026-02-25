const form = document.getElementById("signupForm");
const errorBox = document.getElementById("error");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");

    const payload = {
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        password_confirm: document.getElementById("password_confirm").value,
        first_name: document.getElementById("first_name").value,
        last_name: document.getElementById("last_name").value,
        student_id: document.getElementById("student_id").value,
    };

    try {
        const res = await fetch("/api/signup/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
            const errorMsg =
                data.error ||
                data.detail ||
                Object.values(data).flat().join(" ") ||
                "Signup failed";
            errorBox.textContent = errorMsg;
            errorBox.classList.remove("hidden");
            return;
        }

        alert(
            "Account created! Please check your email to verify your account."
        );
        window.location.href = "/login";
    } catch (err) {
        errorBox.textContent = "Connection error. Please try again.";
        errorBox.classList.remove("hidden");
    }
});
