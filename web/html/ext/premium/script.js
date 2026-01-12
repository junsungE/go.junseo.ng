const urlInput = document.getElementById("urlInput");
const idInput = document.getElementById("idInput"); // Custom slug
const expiryDateInput = document.getElementById("expiryDateInput");
const visitLimitInput = document.getElementById("visitLimitInput");
const titleInput = document.getElementById("titleInput");
const caseSensitiveInput = document.getElementById("caseSensitiveInput");
const shortenUrlBtn = document.getElementById("shortenUrl");
const shortenAnotherBtn = document.getElementById("shortenAnother");
const resultSection = document.querySelector(".result");
const copyUrlBtn = document.getElementById("copyUrl");
const copiedSpan = document.getElementById("copied");
const myLinksBody = document.getElementById("myLinksBody");

let currentFullUrl = "";

// Get logged in user info (assumes auth.js or other updated localStorage)
// Note: premium-nav.js or auth.js might have set simple user info.
// We'll read from localStorage "user" which was set in auth.js.
function getUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
}

// Fetch user's links
async function fetchMyLinks() {
    const user = getUser();
    if (!user || !user.email) {
        myLinksBody.innerHTML = "<tr><td colspan='5'>Please log in to see your links.</td></tr>";
        return;
    }

    try {
        const res = await fetch(`/api/myLinks?email=${encodeURIComponent(user.email)}`);
        if (res.ok) {
            const links = await res.json();
            if (links.length === 0) {
                myLinksBody.innerHTML = "<tr><td colspan='5'>No links found. Create one!</td></tr>";
                return;
            }
            
            myLinksBody.innerHTML = "";
            links.forEach(link => {
                const tr = document.createElement("tr");
                
                // Determine status
                let status = "Active";
                if (link.expiryDate && new Date(link.expiryDate) < new Date()) status = "Expired";
                if (link.visitLimit && link.visits >= link.visitLimit) status = "Limit Reached";

                const fullUrl = `${window.location.origin}/ext/${link.slug}`;

                tr.innerHTML = `
                    <td><a href="${fullUrl}" target="_blank">${link.slug}</a></td>
                    <td title="${link.targetUrl}" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${link.targetUrl}</td>
                    <td>${link.title || '-'}</td>
                    <td>${new Date(link.createdAt).toLocaleDateString()}</td>
                    <td>${link.visits}${link.visitLimit ? '/' + link.visitLimit : ''}</td>
                    <td>${status}</td>
                `;
                myLinksBody.appendChild(tr);
            });
        } else {
            myLinksBody.innerHTML = "<tr><td colspan='6'>Failed to load links.</td></tr>";
        }
    } catch (err) {
        myLinksBody.innerHTML = `<tr><td colspan='6'>Error: ${err.message}</td></tr>`;
    }
}

// Initial fetch
fetchMyLinks();

// Shorten URL logic
shortenUrlBtn.addEventListener("click", async () => {
  const targetUrl = urlInput.value.trim();
  if (!targetUrl) {
    alert("Please enter a URL to shorten");
    return;
  }

  const user = getUser();
  if (!user) {
    alert("You must be logged in to create premium links.");
    return;
  }

  shortenUrlBtn.disabled = true;
  shortenUrlBtn.textContent = "Creating...";

  const data = {
    type: "premium", // Important
    targetUrl: targetUrl,
    origin: window.location.origin,
    createdBy: user.email, // Send user email for ownership
    slug: idInput.value.trim(),
    title: titleInput.value.trim(),
    isCaseSensitive: caseSensitiveInput.checked
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
      currentFullUrl = result.fullUrl || `${window.location.origin}/ext/${slug}`;
      
      resultSection.hidden = false;
      shortenAnotherBtn.hidden = false;
      shortenUrlBtn.textContent = "Shorten"; // Reset button text
      
      // Disable inputs
      urlInput.disabled = true;
      idInput.disabled = true;
      expiryDateInput.disabled = true;
      visitLimitInput.disabled = true;
      titleInput.disabled = true;
      caseSensitiveInput.disabled = true;
      shortenUrlBtn.disabled = true;

      // Refresh list
      fetchMyLinks();
    } else {
      alert(`Error: ${result && result.error ? result.error : 'Server error'}`);
      shortenUrlBtn.disabled = false;
      shortenUrlBtn.textContent = "Shorten";
    }
  } catch (err) {
    alert(`Network error: ${err && err.message ? err.message : String(err)}`);
    shortenUrlBtn.disabled = false;
    shortenUrlBtn.textContent = "Shorten";
  }
});

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

shortenAnotherBtn.addEventListener("click", () => {
  // Reset all inputs
  urlInput.value = "";
  idInput.value = "";
  expiryDateInput.value = "";
  visitLimitInput.value = "";
  titleInput.value = "";
  caseSensitiveInput.checked = false;
  currentFullUrl = "";
  
  // Hide result section
  resultSection.hidden = true;
  
  // Re-enable inputs
  urlInput.disabled = false;
  idInput.disabled = false;
  expiryDateInput.disabled = false;
  visitLimitInput.disabled = false;
  titleInput.disabled = false;
  caseSensitiveInput.disabled = false;
  shortenUrlBtn.disabled = false;
  shortenAnotherBtn.hidden = true;
  
  urlInput.focus();
});

// Initially hide buttons
shortenAnotherBtn.hidden = true;
