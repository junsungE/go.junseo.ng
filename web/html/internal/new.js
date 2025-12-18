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
    const data = Object.fromEntries(new FormData(form).entries());
    data.isCaseSensitive = form.isCaseSensitive.checked;
    data.type = "internal";
    data.origin = window.location.origin; // Tell backend which domain we're on

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
      msg.textContent = `Error: ${result && result.error ? result.error : 'Server error'}`;
    }
  });
}
