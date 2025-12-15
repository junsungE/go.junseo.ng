const urlInput = document.getElementById("urlInput");
const expiryDateInput = document.getElementById("expiryDateInput");
const visitLimitInput = document.getElementById("visitLimitInput");
const shortenUrlBtn = document.getElementById("shortenUrl");
const slugOutput = document.getElementById("slugOutput");
const shortenAnotherBtn = document.getElementById("shortenAnother");
const resultSection = document.querySelector(".result");
const copyBtn = document.getElementById("copy");
const copiedSpan = document.getElementById("copied");

let currentFullUrl = "";

// Shorten URL button
shortenUrlBtn.addEventListener("click", async () => {
  const targetUrl = urlInput.value.trim();
  if (!targetUrl) {
    alert("Please enter a URL to shorten");
    return;
  }

  shortenUrlBtn.disabled = true;
  slugOutput.value = "Creating...";

  const data = {
    type: "external",
    targetUrl: targetUrl
  };

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
      currentFullUrl = result.fullUrl || `https://go.junseo.ng/ext/${slug}`;
      
      slugOutput.value = slug;
      
      resultSection.hidden = false;
      shortenAnotherBtn.hidden = false;
      
      // Disable inputs after successful creation
      urlInput.disabled = true;
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

// Copy button (bottom in result section)
if (copyBtn) {
  copyBtn.addEventListener("click", () => {
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
  expiryDateInput.value = "";
  visitLimitInput.value = "";
  slugOutput.value = "";
  currentFullUrl = "";
  
  // Hide result section
  resultSection.hidden = true;
  
  // Re-enable inputs
  urlInput.disabled = false;
  expiryDateInput.disabled = false;
  visitLimitInput.disabled = false;
  shortenUrlBtn.disabled = false;
  shortenAnotherBtn.hidden = true;
  
  // Focus on URL input
  urlInput.focus();
});

// Initially hide buttons that need a URL first
shortenAnotherBtn.hidden = true;