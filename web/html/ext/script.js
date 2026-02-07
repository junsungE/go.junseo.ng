const urlInput = document.getElementById("urlInput");
const startDateInput = document.getElementById("startDateInput");
const expiryDateInput = document.getElementById("expiryDateInput");
const visitLimitInput = document.getElementById("visitLimitInput");
const shortenUrlBtn = document.getElementById("shortenUrl");
const slugOutput = document.getElementById("slugOutput");
const shortenAnotherBtn = document.getElementById("shortenAnother");
const resultSection = document.querySelector(".result");
const copyUrlBtn = document.getElementById("copyUrl");
const copiedSpan = document.getElementById("copied");

let currentFullUrl = "";

const _now = new Date();
const todayIso = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
if (startDateInput) startDateInput.min = todayIso;
if (expiryDateInput) expiryDateInput.min = todayIso;

// Shorten URL button
shortenUrlBtn.addEventListener("click", async () => {
  let targetUrl = urlInput.value.trim();
  if (!targetUrl) {
    alert("Please enter a URL to shorten");
    return;
  }

  // Auto-prepend https:// if no valid URI scheme detected
  try {
    new URL(targetUrl);
  } catch {
    targetUrl = "https://" + targetUrl;
    urlInput.value = targetUrl;
  }

  // Validate URL format
  try {
    new URL(targetUrl);
  } catch {
    alert("Please enter a valid URL (e.g., https://example.com).");
    return;
  }

  // Date validation
  if (startDateInput.value && startDateInput.value < todayIso) {
    alert("Start date must be today or later.");
  // Date validation (native browser tooltip)
  //if (startDateInput.value && !startDateInput.checkValidity()) {
  //  startDateInput.reportValidity();
    return;
  }
  if (expiryDateInput.value && expiryDateInput.value < todayIso) {
    alert("Expiry date must be today or later.");
  //if (expiryDateInput.value && !expiryDateInput.checkValidity()) {
  //  expiryDateInput.reportValidity();
    return;
  }
  if (startDateInput.value && expiryDateInput.value) {
    if (new Date(expiryDateInput.value) <= new Date(startDateInput.value)) {
        alert("Expiry date must be later than the start date.");
        return;
    }
  }

  shortenUrlBtn.disabled = true;
  slugOutput.value = "Creating...";

  const data = {
    type: "external",
    targetUrl: targetUrl,
    origin: window.location.origin, // Tell backend which domain we're on
    clientToday: todayIso
  };

  if (startDateInput.value) {
    data.startDate = startDateInput.value;
  }
  if (expiryDateInput.value) {
    data.expiryDate = expiryDateInput.value;
  }
  if (visitLimitInput.value) {
    data.visitLimit = visitLimitInput.value;
  }

  try {
    const res = await fetch("/api/createLink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    let result = null;
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        result = await res.json();
      } else {
        const text = await res.text();
        try { result = JSON.parse(text); } catch { result = { error: text || `HTTP ${res.status}` }; }
      }
    } catch (err) {
      result = { error: 'Invalid server response' };
    }

    if (res.ok) {
      const slug = result.slug || "";
      // Use the URL from API response, or construct from current origin (not hardcoded)
      currentFullUrl = result.fullUrl || `${window.location.origin}/ext/${slug}`;
      
      slugOutput.value = slug;
      
      resultSection.hidden = false;
      shortenAnotherBtn.hidden = false;
      
      // Disable inputs after successful creation
      urlInput.disabled = true;
      startDateInput.disabled = true;
      expiryDateInput.disabled = true;
      visitLimitInput.disabled = true;
      shortenUrlBtn.disabled = true;
    } else {
      slugOutput.value = "";
      alert(`Error: ${result && result.error ? result.error : 'Server error'}`);
      shortenUrlBtn.disabled = false;
    }
  } catch (err) {
    slugOutput.value = "";
    alert(`Network error: ${err && err.message ? err.message : String(err)}`);
    shortenUrlBtn.disabled = false;
  }
});

// Copy URL button in result section
if (copyUrlBtn) {
  copyUrlBtn.addEventListener("click", () => {
    if (currentFullUrl) {
      navigator.clipboard.writeText(currentFullUrl).then(() => {
        const originalText = copiedSpan.textContent;
        copiedSpan.textContent = `${currentFullUrl} copied!`;
        copiedSpan.style.opacity = "1";
        setTimeout(() => {
          copiedSpan.textContent = originalText;
          copiedSpan.style.opacity = "0";
        }, 2000);
      }).catch(err => {
        alert("Failed to copy URL");
      });
    }
  });
}

// Shorten another button
shortenAnotherBtn.addEventListener("click", () => {
  // Reset all inputs
  urlInput.value = "";
  startDateInput.value = "";
  expiryDateInput.value = "";
  visitLimitInput.value = "";
  slugOutput.value = "";
  currentFullUrl = "";
  
  // Hide result section
  resultSection.hidden = true;
  
  // Re-enable inputs
  urlInput.disabled = false;
  startDateInput.disabled = false;
  expiryDateInput.disabled = false;
  visitLimitInput.disabled = false;
  shortenUrlBtn.disabled = false;
  shortenAnotherBtn.hidden = true;
  
  // Focus on URL input
  urlInput.focus();
});

// Initially hide buttons that need a URL first
shortenAnotherBtn.hidden = true;