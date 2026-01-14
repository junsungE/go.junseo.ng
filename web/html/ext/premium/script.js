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
const tableHeaders = document.querySelectorAll(".links-table th");

let currentFullUrl = "";
let userLinks = []; // Store links locally for sorting
let sortCol = "createdAt";
let sortAsc = false; // default desc


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

function checkAccountStatus() {
    const user = getUser();
    const isApproved = user && user.status === 'approved';
    const notApprovedMsg = document.querySelector('.account-not-approved');

    const inputsToDisable = [
        urlInput,
        idInput,
        expiryDateInput,
        visitLimitInput,
        titleInput,
        caseSensitiveInput,
        shortenUrlBtn
    ];

    if (isApproved) {
        // User is approved: Hide warning, enable inputs
        if (notApprovedMsg) notApprovedMsg.hidden = true;
        inputsToDisable.forEach(el => { if(el) el.disabled = false; });
    } else {
        // User not approved or not logged in: Show warning, disable inputs
        if (notApprovedMsg) notApprovedMsg.hidden = false;
        inputsToDisable.forEach(el => { if(el) el.disabled = true; });
    }
}


// Fetch user's links
async function fetchMyLinks() {
    const user = getUser();
    if (!user || !user.email) {
        myLinksBody.innerHTML = "<tr><td colspan='9'>Please log in to see your links.</td></tr>";
        return;
    }

    try {
        const res = await fetch(`/api/myLinks?email=${encodeURIComponent(user.email)}`);
        if (res.ok) {
            userLinks = await res.json();
            renderLinks();
        } else {
            myLinksBody.innerHTML = "<tr><td colspan='9'>Failed to load links.</td></tr>";
        }
    } catch (err) {
        myLinksBody.innerHTML = `<tr><td colspan='9'>Error: ${err.message}</td></tr>`;
    }
}

// Render sorted links
function renderLinks() {
    if (userLinks.length === 0) {
        myLinksBody.innerHTML = "<tr><td colspan='9'>No links found. Create one!</td></tr>";
        return;
    }

    // Sort logic
    userLinks.sort((a, b) => {
        let valA, valB;

        // Custom getters for specific columns
        if (sortCol === "status") {
            valA = getStatus(a);
            valB = getStatus(b);
        } else {
            // Default property access
            valA = a[sortCol];
            valB = b[sortCol];
        }

        // Handle nulls/undefined
        if (valA === null || valA === undefined) valA = "";
        if (valB === null || valB === undefined) valB = "";

        // Standard comparison
        let cmp = 0;
        
        // Use localeCompare for strings to ensure case-insensitive sorting or proper alphabetical sorting
        if (typeof valA === 'string' && typeof valB === 'string') {
            cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        } else {
            if (valA < valB) cmp = -1;
            if (valA > valB) cmp = 1;
        }

        // Secondary sort by CreatedAt (descending) if equal
        if (cmp === 0) {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA; 
        }

        return sortAsc ? cmp : -cmp;
    });

    // Update table headers UI
    tableHeaders.forEach(th => {
        const span = th.querySelector("span");
        if (th.dataset.sort === sortCol) {
            span.textContent = sortAsc ? " ▲" : " ▼";
        } else {
            span.textContent = "";
        }
    });

    myLinksBody.innerHTML = "";
    userLinks.forEach(link => {
        const tr = document.createElement("tr");
        const status = getStatus(link);
        const fullUrl = `${window.location.origin}/ext/${link.slug}`;
        
        const lastVisitedDisplay = link.lastVisitedAt 
            ? new Date(link.lastVisitedAt).toLocaleString() 
            : "-";
            
        const expiryDisplay = link.expiryDate
            ? new Date(link.expiryDate).toLocaleDateString()
            : "-";

        tr.innerHTML = `
            <td><a href="${fullUrl}" target="_blank">${link.slug}</a></td>
            <td>${link.isCaseSensitive ? 'Yes' : 'No'}</td>
            <td title="${link.targetUrl}">${link.targetUrl}</td>
            <td>${link.title || '-'}</td>
            <td>${link.visits}${link.visitLimit ? '/' + link.visitLimit : ''}</td>
            <td>${expiryDisplay}</td>
            <td>${status}</td>
            <td>${lastVisitedDisplay}</td>
            <td>${new Date(link.createdAt).toLocaleString()}</td>
        `;
        myLinksBody.appendChild(tr);
    });
}

function getStatus(link) {
    if (link.expiryDate && new Date(link.expiryDate) < new Date()) return "Expired";
    if (link.visitLimit && link.visits >= link.visitLimit) return "Limit Reached";
    return "Active";
}

// Header click handlers
tableHeaders.forEach(th => {
    th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortCol === col) {
            sortAsc = !sortAsc;
        } else {
            sortCol = col;
            sortAsc = true; // Default to asc for new column
            // Exception: Dates usually better desc by default
            if (["createdAt", "lastVisitedAt", "expiryDate", "visits"].includes(col)) {
                sortAsc = false;
            }
        }
        renderLinks();
    });
});

// Initial fetch
fetchMyLinks();

// --- Resizable Table Columns logic ---
function initResizableTable() {
    tableHeaders.forEach(th => {
        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        th.appendChild(resizer);
        
        let x = 0;
        let w = 0;

        const mouseDownHandler = (e) => {
            e.stopPropagation(); // Prevent sort click trigger
            x = e.clientX;
            const styles = window.getComputedStyle(th);
            w = parseInt(styles.width, 10);

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
        };

        const mouseMoveHandler = (e) => {
            const dx = e.clientX - x;
            th.style.width = `${w + dx}px`;
            th.style.minWidth = `${w + dx}px`; // Force override
        };

        const mouseUpHandler = () => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', mouseDownHandler);
        resizer.addEventListener('click', (e) => e.stopPropagation()); // Extra safety
    });
}
initResizableTable();

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
      idInput.value = slug; // Show generated slug if it was random
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

// Check permissions
checkAccountStatus();
