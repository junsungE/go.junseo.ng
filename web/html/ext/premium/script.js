const urlInput = document.getElementById("urlInput");
const idInput = document.getElementById("idInput"); // Custom slug
const startDateInput = document.getElementById("startDateInput");
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

// Tags functionality
const tagInput = document.getElementById('tagInput');
const selectedTagsList = document.getElementById('selectedTags');
const tagSuggestionsMenu = document.getElementById('tagSuggestionsMenu');
let selectedTags = []; // Array of {name, color}
let existingTags = []; // Will be populated from user's links
let highlightedIndex = -1;

const defaultTagColors = ['#0067c5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2'];

function getRandomColor() {
  return defaultTagColors[Math.floor(Math.random() * defaultTagColors.length)];
}

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
        startDateInput,
        expiryDateInput,
        visitLimitInput,
        titleInput,
        caseSensitiveInput,
        shortenUrlBtn,
        tagInput
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
        myLinksBody.innerHTML = "<tr><td colspan='11'>Please log in to see your links.</td></tr>";
        return;
    }

    try {
        const res = await fetch(`/api/myLinks?email=${encodeURIComponent(user.email)}`);
        if (res.ok) {
            userLinks = await res.json();
            // Extract existing tags from user's links
            const tagMap = new Map();
            userLinks.forEach(link => {
                if (link.tags && Array.isArray(link.tags)) {
                    link.tags.forEach(tag => {
                        if (!tagMap.has(tag.name.toLowerCase())) {
                            tagMap.set(tag.name.toLowerCase(), tag);
                        }
                    });
                }
            });
            existingTags = Array.from(tagMap.values());
            renderLinks();
        } else {
            myLinksBody.innerHTML = "<tr><td colspan='11'>Failed to load links.</td></tr>";
        }
    } catch (err) {
        myLinksBody.innerHTML = `<tr><td colspan='11'>Error: ${err.message}</td></tr>`;
    }
}

// Render sorted links
function renderLinks() {
    if (userLinks.length === 0) {
        myLinksBody.innerHTML = "<tr><td colspan='11'>No links found. Create one!</td></tr>";
        return;
    }

    // Sort logic
    userLinks.sort((a, b) => {
        let valA, valB;

        // Custom getters for specific columns
        if (sortCol === "status") {
            valA = getStatus(a);
            valB = getStatus(b);
        } else if (sortCol === "tags") {
            // Sort by first tag name or empty string
            valA = (a.tags && a.tags.length > 0) ? a.tags[0].name : "";
            valB = (b.tags && b.tags.length > 0) ? b.tags[0].name : "";
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
            
        const startDisplay = link.startDate
            ? new Date(link.startDate).toLocaleDateString()
            : "-";

        const expiryDisplay = link.expiryDate
            ? new Date(link.expiryDate).toLocaleDateString()
            : "-";

        // Render tags
        let tagsHtml = '-';
        if (link.tags && link.tags.length > 0) {
            tagsHtml = link.tags.map(tag => 
                `<span class="tag-badge" style="background:${escapeHtml(tag.color)}">${escapeHtml(tag.name)}</span>`
            ).join('');
        }

        tr.innerHTML = `
            <td><a href="${fullUrl}" target="_blank">${link.slug}</a></td>
            <td>${link.isCaseSensitive ? 'Yes' : 'No'}</td>
            <td title="${link.targetUrl}">${link.targetUrl}</td>
            <td>${link.title || '-'}</td>
            <td class="tags-cell">${tagsHtml}</td>
            <td>${link.visits}${link.visitLimit ? '/' + link.visitLimit : ''}</td>
            <td>${startDisplay}</td>
            <td>${expiryDisplay}</td>
            <td>${status}</td>
            <td>${lastVisitedDisplay}</td>
            <td>${new Date(link.createdAt).toLocaleString()}</td>
        `;
        myLinksBody.appendChild(tr);
    });
}

function escapeHtml(str) {
  if (!str) return '';
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

function getStatus(link) {
    const now = new Date();
    if (link.startDate && new Date(link.startDate) > now) return "Not Started";
    if (link.expiryDate && new Date(link.expiryDate) < now) return "Expired";
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
            if (["createdAt", "lastVisitedAt", "expiryDate", "startDate", "visits"].includes(col)) {
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
            x = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const styles = window.getComputedStyle(th);
            w = parseInt(styles.width, 10);

            if (e.type.startsWith('touch')) {
                document.addEventListener('touchmove', mouseMoveHandler, { passive: false });
                document.addEventListener('touchend', mouseUpHandler);
            } else {
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            }
            resizer.classList.add('resizing');
        };

        const mouseMoveHandler = (e) => {
            if (e.type === 'touchmove') e.preventDefault(); // Prevent scrolling while resizing
            const currentX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const dx = currentX - x;
            const newWidth = w + dx;
            if (newWidth > 50) { // Set a minimum width for columns
                th.style.width = `${newWidth}px`;
                th.style.minWidth = `${newWidth}px`;
            }
        };

        const mouseUpHandler = () => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            document.removeEventListener('touchmove', mouseMoveHandler);
            document.removeEventListener('touchend', mouseUpHandler);
            resizer.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', mouseDownHandler);
        resizer.addEventListener('touchstart', mouseDownHandler, { passive: true });
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
  // Date validation
  if (startDateInput.value && expiryDateInput.value) {
    if (new Date(expiryDateInput.value) <= new Date(startDateInput.value)) {
        alert("Expiry date must be later than the start date.");
        return;
    }
  }
  shortenUrlBtn.disabled = true;
  shortenUrlBtn.textContent = "Checking...";

  try {
      // 1. Check for duplicate Target URLs for this user
      const checkRes = await fetch("/api/checkExistingTargetURL", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              targetUrl: targetUrl,
              createdBy: user.email,
              type: "premium"
          })
      });

      if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists) {
              const confirmMsg = `Target URL already exists under slug(s): ${checkData.slugs.join(", ")}\nDo you want to create an additional slug?`;
              if (!confirm(confirmMsg)) {
                  shortenUrlBtn.disabled = false;
                  shortenUrlBtn.textContent = "Shorten";
                  return;
              }
          }
      }
  } catch (err) {
      console.warn("Duplicate check failed, proceeding anyway:", err);
  }

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

  // Add tags if any selected
  if (selectedTags.length > 0) {
    data.tags = selectedTags;
  }

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
      currentFullUrl = result.fullUrl || `${window.location.origin}/ext/${slug}`;
      
      resultSection.hidden = false;
      shortenAnotherBtn.hidden = false;
      shortenUrlBtn.textContent = "Shorten"; // Reset button text
      
      // Disable inputs
      urlInput.disabled = true;
      idInput.disabled = true;
      idInput.value = slug; // Show generated slug if it was random
      startDateInput.disabled = true;
      expiryDateInput.disabled = true;
      visitLimitInput.disabled = true;
      titleInput.disabled = true;
      caseSensitiveInput.disabled = true;
      shortenUrlBtn.disabled = true;
      if (tagInput) tagInput.disabled = true;

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
  startDateInput.value = "";
  expiryDateInput.value = "";
  visitLimitInput.value = "";
  titleInput.value = "";
  caseSensitiveInput.checked = false;
  currentFullUrl = "";
  
  // Reset tags
  selectedTags = [];
  renderSelectedTags();
  
  // Hide result section
  resultSection.hidden = true;
  
  // Re-enable inputs
  urlInput.disabled = false;
  idInput.disabled = false;
  startDateInput.disabled = false;
  expiryDateInput.disabled = false;
  visitLimitInput.disabled = false;
  titleInput.disabled = false;
  caseSensitiveInput.disabled = false;
  shortenUrlBtn.disabled = false;
  shortenAnotherBtn.hidden = true;
  if (tagInput) tagInput.disabled = false;
  
  urlInput.focus();
});

// Initially hide buttons
shortenAnotherBtn.hidden = true;

// Check permissions
checkAccountStatus();

// Tag functionality
function renderSelectedTags() {
  if (!selectedTagsList) return;
  selectedTagsList.innerHTML = '';
  selectedTags.forEach((tag, index) => {
    const li = document.createElement('li');
    li.className = 'tag-item';
    li.style.backgroundColor = tag.color;
    li.innerHTML = `
      <input type="color" class="tag-color-picker" value="${tag.color}" data-index="${index}" title="Change tag color">
      <span>${escapeHtml(tag.name)}</span>
      <button type="button" data-index="${index}" title="Remove tag">&times;</button>
    `;
    selectedTagsList.appendChild(li);
  });

  // Add event listeners for color pickers and remove buttons
  selectedTagsList.querySelectorAll('.tag-color-picker').forEach(picker => {
    picker.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      const newColor = e.target.value;
      const tagName = selectedTags[idx].name;
      
      // Update the selected tag's color
      selectedTags[idx].color = newColor;
      
      // Also update the color in existingTags so future selections use this color
      const existingTag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (existingTag) {
        existingTag.color = newColor;
      }
      
      renderSelectedTags();
    });
  });

  selectedTagsList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      selectedTags.splice(idx, 1);
      renderSelectedTags();
    });
  });
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

function showSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    tagSuggestionsMenu.hidden = true;
    return;
  }

  const matches = existingTags.filter(tag => 
    tag.name.toLowerCase().includes(q) && 
    !selectedTags.some(st => st.name.toLowerCase() === tag.name.toLowerCase())
  );

  const exactMatch = existingTags.some(t => t.name.toLowerCase() === q) ||
                     selectedTags.some(t => t.name.toLowerCase() === q);

  tagSuggestionsMenu.innerHTML = '';
  highlightedIndex = -1;

  matches.forEach((tag, idx) => {
    const li = document.createElement('li');
    li.dataset.index = idx;
    li.innerHTML = `<span class="tag-preview" style="background:${tag.color}"></span>${highlightMatch(tag.name, q)}`;
    li.addEventListener('click', () => selectTag(tag));
    tagSuggestionsMenu.appendChild(li);
  });

  if (!exactMatch) {
    const li = document.createElement('li');
    li.className = 'tag-suggestion-new';
    li.dataset.index = matches.length;
    li.innerHTML = `+ Add "<strong>${escapeHtml(query.trim())}</strong>" as new tag`;
    li.addEventListener('click', () => addNewTag(query.trim()));
    tagSuggestionsMenu.appendChild(li);
  }

  if (tagSuggestionsMenu.children.length > 0) {
    tagSuggestionsMenu.hidden = false;
    // Position the menu below the input
    const rect = tagInput.getBoundingClientRect();
    tagSuggestionsMenu.style.width = `${rect.width}px`;
  } else {
    tagSuggestionsMenu.hidden = true;
  }
}

function selectTag(tag) {
  if (!selectedTags.some(t => t.name.toLowerCase() === tag.name.toLowerCase())) {
    selectedTags.push({ name: tag.name, color: tag.color });
    renderSelectedTags();
  }
  tagInput.value = '';
  tagSuggestionsMenu.hidden = true;
  tagInput.focus();
}

function addNewTag(name) {
  if (!name.trim()) return;
  if (!selectedTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    // Check if this tag exists in existingTags (case-insensitive) to use its color
    const existingTag = existingTags.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
    const color = existingTag ? existingTag.color : getRandomColor();
    selectedTags.push({ name: name.trim(), color: color });
    renderSelectedTags();
  }
  tagInput.value = '';
  tagSuggestionsMenu.hidden = true;
  tagInput.focus();
}

function navigateSuggestions(direction) {
  const items = tagSuggestionsMenu.querySelectorAll('li');
  if (items.length === 0) return;

  items.forEach(item => item.classList.remove('highlighted'));
  highlightedIndex += direction;

  if (highlightedIndex < 0) highlightedIndex = items.length - 1;
  if (highlightedIndex >= items.length) highlightedIndex = 0;

  items[highlightedIndex].classList.add('highlighted');
  items[highlightedIndex].scrollIntoView({ block: 'nearest' });
}

function selectHighlighted() {
  const items = tagSuggestionsMenu.querySelectorAll('li');
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].click();
  }
}

if (tagInput) {
  tagInput.addEventListener('input', () => showSuggestions(tagInput.value));

  tagInput.addEventListener('keydown', (e) => {
    if (!tagSuggestionsMenu.hidden) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSuggestions(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSuggestions(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0) {
          selectHighlighted();
        } else if (tagInput.value.trim()) {
          addNewTag(tagInput.value);
        }
      } else if (e.key === 'Escape') {
        tagSuggestionsMenu.hidden = true;
      }
    } else if (e.key === 'Enter' && tagInput.value.trim()) {
      e.preventDefault();
      addNewTag(tagInput.value);
    }
  });

  tagInput.addEventListener('blur', () => {
    // Delay hiding to allow click on suggestion
    setTimeout(() => { tagSuggestionsMenu.hidden = true; }, 200);
  });

  tagInput.addEventListener('focus', () => {
    if (tagInput.value.trim()) {
      showSuggestions(tagInput.value);
    }
  });
}
