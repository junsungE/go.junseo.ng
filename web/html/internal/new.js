const form = document.getElementById("createForm");
const msg = document.getElementById("message");

// Toggle password field when Mode is changed
const modeSelect = form && form.mode; // <select name="mode">
const passwordRow = document.getElementById('passwordRow');
const passwordInput = document.getElementById('passwordInput');

function togglePasswordRow() {
  if (!modeSelect) return;
  if (modeSelect.value === 'protected') {
    passwordRow.style.display = '';
    passwordInput.required = true;
  } else {
    passwordRow.style.display = 'none';
    passwordInput.required = false;
    passwordInput.value = '';
  }
}

// initialize visibility on load
togglePasswordRow();
modeSelect && modeSelect.addEventListener('change', togglePasswordRow);

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Date validation
    const formData = new FormData(form);
    const start = formData.get("startDate");
    const end = formData.get("expiryDate");
    
    if (start && end && new Date(end) <= new Date(start)) {
        alert("Expiry date must be later than the start date.");
        return;
    }

    const submitBtn = e.submitter || form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    msg.textContent = "Checking...";

    const data = Object.fromEntries(new FormData(form).entries());
    data.isCaseSensitive = form.isCaseSensitive.checked;
    data.type = "internal";
    data.origin = window.location.origin; // Tell backend which domain we're on

    // 1. Get user identity
    let userEmail = "anonymous";
    try {
        const authRes = await fetch("/.auth/me");
        const authData = await authRes.json();
        if (authData.clientPrincipal) {
            userEmail = authData.clientPrincipal.userDetails;
        }
    } catch (err) {
        console.warn("Auth check failed:", err);
    }
    data.createdBy = userEmail;

    // 2. Check for duplicate Target URLs for this user
    try {
        const checkRes = await fetch("/api/checkExistingTargetURL", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                targetUrl: data.targetUrl,
                createdBy: userEmail,
                type: "internal"
            })
        });

        if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.exists) {
                const confirmMsg = `Target URL already exists under slug(s): ${checkData.slugs.join(", ")}\nDo you want to create an additional slug?`;
                if (!confirm(confirmMsg)) {
                    if (submitBtn) submitBtn.disabled = false;
                    msg.textContent = "";
                    return;
                }
            }
        }
    } catch (err) {
        console.warn("Duplicate check failed, proceeding:", err);
    }

    msg.textContent = "Creating...";

    const res = await fetch("/api/createLink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    let result = null;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        result = await res.json();
      } else {
        const text = await res.text();
        try { result = JSON.parse(text); } catch { result = { error: text || `HTTP ${res.status}` }; }
      }
    } catch (err) {
      result = { error: "Invalid server response" };
    }

    if (res.ok) {
      const url = result && (result.fullUrl || result.url || result.slug) ? (result.fullUrl || result.url || result.slug) : 'created';
      msg.textContent = `Success! URL: ${url}`;
    } else {
      alert(`Error: ${result && result.error ? result.error : 'Server error'}`);
      msg.textContent = `Error: ${result && result.error ? result.error : 'Server error'}`;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
