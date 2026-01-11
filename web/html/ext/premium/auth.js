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
            messageEl.textContent = "Signing in...";
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
                    
                    if (data.user.status === "pending") {
                        alert("Your account is verified but pending admin approval. Usage is restricted.");
                        // Redirect to a specific "waiting" page or dashboard with limited view
                        window.location.href = "/ext/premium"; 
                    } else {
                        window.location.href = "/ext/premium";
                    }
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
        const messageEl = document.getElementById("message");
        const codeSection = document.getElementById("codeSection");
        const btnSendCode = document.getElementById("btnSendCode");
        const btnVerifyCode = document.getElementById("btnVerifyCode");
        const btnResendCode = document.getElementById("btnResendCode");
        const codeInput = document.getElementById("verificationCode");
        const codeStatus = document.getElementById("codeStatus");
        const btnSignUp = document.getElementById("btnSignUp");
        
        // Initial State
        // Sign Up button could be disabled initially, but user request implies flow.
        // We'll trust the flow: User must verify email to proceed effectively? 
        // Actually, premiumSignup validates code anyway. So even if they skip UI verify, backend blocks it.
        // But UI should guide them.

        let isEmailVerified = false;

        // Check URL params for pre-filling (e.g. from email link)
        const params = new URLSearchParams(window.location.search);
        const urlEmail = params.get("email");
        const urlCode = params.get("code");
        const urlName = params.get("displayName");

        if (urlEmail) {
            document.getElementById("email").value = urlEmail;
        }
        if (urlName) {
            document.getElementById("displayName").value = urlName;
        }
        if (urlCode && urlEmail) {
             codeInput.value = urlCode;
             codeSection.style.display = "block";
             btnSendCode.style.display = "none";
        }

        // 0. Reset Verification on Email Change
        document.getElementById("email").addEventListener("input", () => {
             if (isEmailVerified || codeSection.style.display === "block") {
                 isEmailVerified = false;
                 codeSection.style.display = "none";
                 btnSendCode.style.display = "block";
                 btnSendCode.disabled = false;
                 
                 // Unlock inputs if they were locked
                 document.getElementById("email").readOnly = false;
                 codeInput.readOnly = false;
                 codeInput.value = "";
                 codeStatus.textContent = "";
                 
                 // Re-enable other buttons
                 btnVerifyCode.disabled = false;
                 // Note: Resend timer might still be running but the button is hidden anyway
             }
        });

        // 1. Send Code Handler
        btnSendCode.addEventListener("click", async () => {
             const email = document.getElementById("email").value;
             const displayName = document.getElementById("displayName").value;
             if (!email) {
                 messageEl.textContent = "Please enter an email address.";
                 messageEl.style.color = "red";
                 return;
             }

             messageEl.textContent = "Sending verification code...";
             messageEl.style.color = "#333";
             btnSendCode.disabled = true;
             
             try {
                const res = await fetch(`${API_BASE}/requestVerification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, displayName })
                });
                const data = await res.json();

                if (res.ok) {
                    messageEl.textContent = "";
                    codeSection.style.display = "block";
                    btnSendCode.style.display = "none"; // Hide "Verify Email" button once sent
                    codeStatus.innerHTML = "Code sent to email.<br>Please check your spam folder.";
                    codeStatus.style.color = "blue";
                } else {
                    messageEl.textContent = data.error || "Failed to send code.";
                    messageEl.style.color = "red";
                    btnSendCode.disabled = false;
                }
             } catch (err) {
                 messageEl.textContent = "Error: " + err.message;
                 messageEl.style.color = "red";
                 btnSendCode.disabled = false;
             }
        });

        // 2. Resend Code Handler
        btnResendCode.addEventListener("click", async () => {
             const email = document.getElementById("email").value;
             const displayName = document.getElementById("displayName").value;
             
             // Disable button immediately
             btnResendCode.disabled = true;
             let timeLeft = 60;
             const originalText = btnResendCode.textContent || "Resend";
             
             const timerId = setInterval(() => {
                timeLeft--;
                btnResendCode.textContent = `Resend (${timeLeft}s)`;
                if (timeLeft <= 0) {
                    clearInterval(timerId);
                    btnResendCode.textContent = originalText;
                    // Only re-enable if email isn't already verified
                    if (!isEmailVerified) {
                        btnResendCode.disabled = false;
                    }
                }
             }, 1000);

             messageEl.textContent = "Resending...";
             
             try {
                const res = await fetch(`${API_BASE}/requestVerification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, displayName })
                });
                
                if (res.ok) {
                    messageEl.textContent = "";
                    codeStatus.innerHTML = "Code Resent.<br>Please check your spam folder.";
                    codeStatus.style.color = "blue";
                } else {
                    const data = await res.json();
                    codeStatus.textContent = data.error || "Failed to resend.";
                    codeStatus.style.color = "red";
                    // Optional: re-enable if failed? 
                    // Usually spam protection applies even if it failed on server, 
                    // but for UX if it's a network error maybe we should allow quicker retry. 
                    // Sticking to requirement "unclickable for 1 minute".
                }
             } catch (err) {
                 messageEl.textContent = "Error: " + err.message;
             }
        });

        // 3. Verify Code Handler (UI Check)
        btnVerifyCode.addEventListener("click", async () => {
             const email = document.getElementById("email").value;
             const code = codeInput.value;

             if (!code) {
                 codeStatus.textContent = "Please enter code.";
                 codeStatus.style.color = "red";
                 return;
             }

             codeStatus.textContent = "Verifying code...";
             codeStatus.style.color = "#333";
             btnVerifyCode.disabled = true;

             try {
                const res = await fetch(`${API_BASE}/validateCode`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code })
                });
                const data = await res.json();

                if (res.ok) {
                    codeStatus.textContent = "Email Verified";
                    codeStatus.style.color = "green";
                    isEmailVerified = true;
                    // Lock inputs
                    document.getElementById("email").readOnly = true;
                    codeInput.readOnly = true;
                    btnVerifyCode.disabled = true;
                    btnResendCode.disabled = true;
                } else {
                    codeStatus.textContent = data.error || "Invalid code.";
                    codeStatus.style.color = "red";
                    isEmailVerified = false;
                    btnVerifyCode.disabled = false;
                }
             } catch (err) {
                 codeStatus.textContent = "Error: " + err.message;
                 codeStatus.style.color = "red";
                 btnVerifyCode.disabled = false;
             }
        });

        // 4. Sign Up Handler (Final Submit)
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            if (!isEmailVerified) {
                // Optional: Allow them to submit anyway? The backend will check.
                // But for better UX, maybe warn them?
                // The prompt says "After Email verified ... user can sign in".
                // We'll let the backend decide, but if the code field is visible and not verified, it might fail.
                // However, premiumSignup expects 'code'.
            }
            
            const displayName = document.getElementById("displayName").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const code = codeInput.value;

            if (!code) {
                 messageEl.textContent = "Please verify your email first.";
                 messageEl.style.color = "red";
                 return;
            }

            messageEl.textContent = "Creating Account...";
            messageEl.style.color = "#333";

            try {
                const res = await fetch(`${API_BASE}/premiumSignup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        email, 
                        displayName, 
                        password, 
                        code 
                    })
                });
                const data = await res.json();

                if (res.ok) {
                    messageEl.textContent = "Success! Account created. Redirecting...";
                    messageEl.style.color = "green";
                    setTimeout(() => {
                        window.location.href = "/ext/premium";
                    }, 2000);
                } else {
                    messageEl.textContent = data.error || "Sign up failed.";
                    messageEl.style.color = "red";
                }
            } catch (err) {
                    messageEl.textContent = "Error: " + err.message;
                    messageEl.style.color = "red";
            }
        });
    }
});
