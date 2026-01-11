const API_BASE = "/api"; 

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const messageEl = document.getElementById("message");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            messageEl.textContent = "Logging in...";
            messageEl.style.color = "#333";

            try {
                const res = await fetch(`${API_BASE}/premiumLogin`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                
                if (res.ok) {
                    messageEl.textContent = "Success! Redirecting...";
                    messageEl.style.color = "green";
                    // Store user info
                    localStorage.setItem("user", JSON.stringify(data.user));
                    window.location.href = "index.html"; 
                } else {
                    messageEl.textContent = data.error || "Login failed.";
                    messageEl.style.color = "red";
                }
            } catch (err) {
                messageEl.textContent = "Error: " + err.message;
                messageEl.style.color = "red";
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const displayName = document.getElementById("displayName").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            messageEl.textContent = "Signing up...";
            messageEl.style.color = "#333";

            try {
                const res = await fetch(`${API_BASE}/premiumSignup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ displayName, email, password })
                });
                const data = await res.json();

                if (res.ok) {
                    messageEl.textContent = data.message;
                    messageEl.style.color = "green";
                    signupForm.reset();
                } else {
                    messageEl.textContent = data.error || "Signup failed.";
                    messageEl.style.color = "red";
                }
            } catch (err) {
                messageEl.textContent = "Error: " + err.message;
                messageEl.style.color = "red";
            }
        });
    }
});
