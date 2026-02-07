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
const tableHeaders = document.querySelectorAll(".links-table th[data-sort]");

const _now = new Date();
const todayIso = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
if (startDateInput) startDateInput.min = todayIso;
if (expiryDateInput) expiryDateInput.min = todayIso;

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

// Pagination state for My Links table
let linksCurrentPage = 1;
let linksRowsPerPage = 20;

// Helper function to create pagination navigation
function createPaginationNav(currentPage, totalRows, rowsPerPage, onPageChange, onRowsPerPageChange) {
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const from = totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const to = Math.min(currentPage * rowsPerPage, totalRows);
  
  const nav = document.createElement("nav");
  nav.className = "table-pagination";
  nav.setAttribute("aria-label", "Table pagination");
  
  // Left side: rows per page and range info
  const leftSide = document.createElement("section");
  leftSide.className = "pagination-left";
  leftSide.innerHTML = `
    <label>
      Rows per page:
      <input type="number" class="rows-per-page-input" value="${rowsPerPage}" min="1" max="1000">
    </label>
    <output class="pagination-info">${from}-${to} of ${totalRows}</output>
  `;
  
  // Right side: page buttons
  const rightSide = document.createElement("menu");
  rightSide.className = "pagination-right";
  
  // Generate page buttons
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    // Always show first page
    pages.push(1);
    
    if (currentPage > 3) {
      pages.push('...');
    }
    
    // Show pages around current
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (!pages.includes(i)) pages.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    
    // Always show last page
    if (!pages.includes(totalPages)) pages.push(totalPages);
  }
  
  // << button
  const firstLi = document.createElement("li");
  const firstBtn = document.createElement("button");
  firstBtn.type = "button";
  firstBtn.className = "pagination-btn";
  firstBtn.textContent = "<<";
  firstBtn.setAttribute("aria-label", "First page");
  firstBtn.disabled = currentPage === 1;
  firstBtn.addEventListener("click", () => onPageChange(1));
  firstLi.appendChild(firstBtn);
  rightSide.appendChild(firstLi);
  
  // Page number buttons
  pages.forEach(p => {
    if (p === '...') {
      const ellipsis = document.createElement("li");
      ellipsis.className = "pagination-ellipsis";
      ellipsis.setAttribute("aria-hidden", "true");
      ellipsis.textContent = "...";
      rightSide.appendChild(ellipsis);
    } else {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pagination-btn" + (p === currentPage ? " active" : "");
      btn.textContent = p;
      if (p === currentPage) btn.setAttribute("aria-current", "page");
      btn.addEventListener("click", () => onPageChange(p));
      li.appendChild(btn);
      rightSide.appendChild(li);
    }
  });
  
  // >> button
  const lastLi = document.createElement("li");
  const lastBtn = document.createElement("button");
  lastBtn.type = "button";
  lastBtn.className = "pagination-btn";
  lastBtn.textContent = ">>";
  lastBtn.setAttribute("aria-label", "Last page");
  lastBtn.disabled = currentPage === totalPages || totalPages === 0;
  lastBtn.addEventListener("click", () => onPageChange(totalPages));
  lastLi.appendChild(lastBtn);
  rightSide.appendChild(lastLi);
  
  nav.appendChild(leftSide);
  nav.appendChild(rightSide);
  
  // Add event listener for rows per page input
  const rowsInput = nav.querySelector(".rows-per-page-input");
  rowsInput.addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0) {
      onRowsPerPageChange(val);
    }
  });
  
  return nav;
}


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
        tagInput,
        document.getElementById('conditionalRedirectToggle')
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
        myLinksBody.innerHTML = "<tr><td colspan='12'>Please log in to see your links.</td></tr>";
        return;
    }

    try {
        const res = await fetch(`/api/myLinks?email=${encodeURIComponent(user.email)}`);
        if (res.ok) {
            userLinks = await res.json();
            linksCurrentPage = 1; // Reset to first page on new data
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
            myLinksBody.innerHTML = "<tr><td colspan='12'>Failed to load links.</td></tr>";
        }
    } catch (err) {
        myLinksBody.innerHTML = `<tr><td colspan='12'>Error: ${err.message}</td></tr>`;
    }
}

// Render sorted links
function renderLinks() {
    // Remove any existing pagination navs
    const existingNavs = document.querySelectorAll('.links-pagination');
    existingNavs.forEach(nav => nav.remove());

    if (userLinks.length === 0) {
        myLinksBody.innerHTML = "<tr><td colspan='12'>No links found. Create one!</td></tr>";
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

    // Pagination calculations
    const totalRows = userLinks.length;
    const totalPages = Math.ceil(totalRows / linksRowsPerPage);
    if (linksCurrentPage > totalPages) linksCurrentPage = totalPages;
    if (linksCurrentPage < 1) linksCurrentPage = 1;
    
    const startIdx = (linksCurrentPage - 1) * linksRowsPerPage;
    const endIdx = Math.min(startIdx + linksRowsPerPage, totalRows);
    const pageData = userLinks.slice(startIdx, endIdx);

    // Pagination change handler
    const handlePageChange = (newPage) => {
        linksCurrentPage = newPage;
        renderLinks();
    };

    // Rows per page change handler
    const handleRowsChange = (newRows) => {
        linksRowsPerPage = newRows;
        linksCurrentPage = 1;
        renderLinks();
    };

    // Get the table container
    const tableContainer = myLinksBody.closest('.links-table-container') || myLinksBody.closest('table').parentElement;
    const table = tableContainer.querySelector('table');

    // Wrap table in scrollable element if not already
    let tableScroll = tableContainer.querySelector('.table-scroll');
    if (!tableScroll) {
        tableScroll = document.createElement('figure');
        tableScroll.className = 'table-scroll';
        table.parentNode.insertBefore(tableScroll, table);
        tableScroll.appendChild(table);
    }

    // Create top pagination nav
    const topNav = createPaginationNav(linksCurrentPage, totalRows, linksRowsPerPage, handlePageChange, handleRowsChange);
    topNav.classList.add('links-pagination');
    tableContainer.insertBefore(topNav, tableScroll);

    // Create bottom pagination nav
    const bottomNav = createPaginationNav(linksCurrentPage, totalRows, linksRowsPerPage, handlePageChange, handleRowsChange);
    bottomNav.classList.add('links-pagination');
    tableContainer.appendChild(bottomNav);

    myLinksBody.innerHTML = "";
    pageData.forEach(link => {
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
            <td class="actions-cell">
              <button type="button" class="action-btn edit-btn" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
              <button type="button" class="action-btn delete-btn" title="Delete" data-slug="${escapeHtml(link.slug)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </td>
        `;

        // Attach delete button handler
        tr.querySelector('.delete-btn').addEventListener('click', () => {
          showDeleteModal(link.slug);
        });

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
    /* Commenting out extra hostname check for now since it can cause valid URLs to be rejected (e.g., localhost, intranet URLs without dots, or new gTLDs)
    const parsed = new URL(targetUrl);
    // Extra check for valid domain-like structure if it's http/https
    if (['http:', 'https:'].includes(parsed.protocol)) {
      if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
         throw new Error("Invalid hostname");
      }
    }
    */
  } catch {
    alert("Please enter a valid URL (e.g., https://example.com).");
    return;
  }

  const user = getUser();
  if (!user) {
    alert("You must be logged in to create premium links.");
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
  shortenUrlBtn.textContent = "Checking...";

  // Validate lang-locale entries first (before network requests)
  if (conditionalRedirectToggle && conditionalRedirectToggle.checked) {
    const conditionalData = getConditionalRedirectData();
    
    if (conditionalData.hasLangLocaleError) {
      alert('Please provide a lang-locale code and at least one URL for each lang-locale entry, or remove empty entries.');
      shortenUrlBtn.disabled = false;
      shortenUrlBtn.textContent = 'Shorten';
      return;
    }
  }

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
    origin: window.location.origin, // Tell backend which domain we're on
    createdBy: user.email, // Send user email for ownership
    slug: idInput.value.trim(),
    title: titleInput.value.trim(),
    isCaseSensitive: caseSensitiveInput.checked,
    clientToday: todayIso
  };

  // Add tags if any selected
  if (selectedTags.length > 0) {
    data.tags = selectedTags;
  }

  // Add conditional redirect data
  if (conditionalRedirectToggle && conditionalRedirectToggle.checked) {
    const conditionalData = getConditionalRedirectData();
    
    if (Object.keys(conditionalData.platformRedirects).length > 0) {
      data.platformRedirects = conditionalData.platformRedirects;
    }
    if (Object.keys(conditionalData.langMap).length > 0) {
      data.langMap = conditionalData.langMap;
    }
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
      if (conditionalRedirectToggle) conditionalRedirectToggle.disabled = true;
      const crFieldset = document.getElementById('conditionalRedirectFieldset');
      if (crFieldset) crFieldset.disabled = true;
      const addLangBtn = document.getElementById('addLangLocaleBtn');
      if (addLangBtn) addLangBtn.disabled = true;

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
  
  // Reset conditional redirect
  if (conditionalRedirectToggle) {
    conditionalRedirectToggle.checked = false;
    if (conditionalRedirectOptions) conditionalRedirectOptions.hidden = true;
    if (desktopToggle) desktopToggle.checked = false;
    if (mobileToggle) mobileToggle.checked = false;
    if (desktopSection) desktopSection.hidden = true;
    if (mobileSection) mobileSection.hidden = true;
    if (langLocaleList) langLocaleList.innerHTML = '';
    const addLangBtn = document.getElementById('addLangLocaleBtn');
    if (addLangBtn) addLangBtn.disabled = false;
    // Reset desktop URLs
    const windowsUrl = document.getElementById('windowsUrl');
    const macosUrl = document.getElementById('macosUrl');
    const linuxUrl = document.getElementById('linuxUrl');
    const chromeosUrl = document.getElementById('chromeosUrl');
    if (windowsUrl) windowsUrl.value = '';
    if (macosUrl) macosUrl.value = '';
    if (linuxUrl) linuxUrl.value = '';
    if (chromeosUrl) chromeosUrl.value = '';
    // Reset mobile URLs
    const androidUrl = document.getElementById('androidUrl');
    const iosUrl = document.getElementById('iosUrl');
    const ipadosUrl = document.getElementById('ipadosUrl');
    if (androidUrl) androidUrl.value = '';
    if (iosUrl) iosUrl.value = '';
    if (ipadosUrl) ipadosUrl.value = '';
  }
  
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
  shortenUrlBtn.textContent = "Shorten";
  shortenAnotherBtn.hidden = true;
  if (tagInput) tagInput.disabled = false;
  if (conditionalRedirectToggle) conditionalRedirectToggle.disabled = false;
  const crFieldset = document.getElementById('conditionalRedirectFieldset');
  if (crFieldset) crFieldset.disabled = false;
  
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
    picker.addEventListener('change', async (e) => {
      const idx = parseInt(e.target.dataset.index);
      const newColor = e.target.value;
      const tagName = selectedTags[idx].name;
      
      // Update the selected tag's color
      selectedTags[idx].color = newColor;
      
      // Also update the color in existingTags so future selections use this color
      const existingTag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (existingTag) {
        existingTag.color = newColor;
        
        // Update all existing links in the database with this tag
        const user = getUser();
        if (user && user.email) {
          try {
            await fetch('/api/updateTagColor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: user.email,
                tagName: tagName,
                newColor: newColor,
                type: 'premium'
              })
            });
            // Refresh the links table to show updated colors
            fetchMyLinks();
          } catch (err) {
            console.warn('Failed to update tag color in existing links:', err);
          }
        }
      }
      
      renderSelectedTags();
    });
    
    // Live preview on input
    picker.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      selectedTags[idx].color = e.target.value;
      e.target.closest('.tag-item').style.backgroundColor = e.target.value;
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

// Conditional Redirect functionality
const conditionalRedirectToggle = document.getElementById('conditionalRedirectToggle');
const conditionalRedirectOptions = document.getElementById('conditionalRedirectOptions');
const desktopToggle = document.getElementById('desktopToggle');
const mobileToggle = document.getElementById('mobileToggle');
const desktopSection = document.getElementById('desktopSection');
const mobileSection = document.getElementById('mobileSection');
const langLocaleList = document.getElementById('langLocaleList');
const addLangLocaleBtn = document.getElementById('addLangLocaleBtn');

// Toggle main conditional redirect section
if (conditionalRedirectToggle) {
  conditionalRedirectToggle.addEventListener('change', () => {
    conditionalRedirectOptions.hidden = !conditionalRedirectToggle.checked;
    // State is preserved - just hide/show without clearing
  });
}

if (desktopToggle) {
  desktopToggle.addEventListener('change', () => {
    desktopSection.hidden = !desktopToggle.checked;
  });
}

if (mobileToggle) {
  mobileToggle.addEventListener('change', () => {
    mobileSection.hidden = !mobileToggle.checked;
  });
}

// Sync conditional redirect visibility with checkbox states on page show
// (handles back/forward navigation where browser restores checkbox values but not visibility)
window.addEventListener('pageshow', (event) => {
  // Detect navigation type using modern API
  const navEntries = performance.getEntriesByType('navigation');
  const navType = navEntries.length > 0 ? navEntries[0].type : '';
  const isBackForward = event.persisted || navType === 'back_forward';
  
  // Clear saved lang-locale on fresh page load (not back/forward)
  if (!isBackForward) {
    sessionStorage.removeItem('langLocaleEntriesPremium');
  }
  
  // Restore visibility based on checkbox states
  if (conditionalRedirectToggle && conditionalRedirectOptions) {
    conditionalRedirectOptions.hidden = !conditionalRedirectToggle.checked;
  }
  if (desktopToggle && desktopSection) {
    desktopSection.hidden = !desktopToggle.checked;
  }
  if (mobileToggle && mobileSection) {
    mobileSection.hidden = !mobileToggle.checked;
  }
  
  // Restore lang-locale entries from sessionStorage on back/forward navigation
  if (isBackForward && langLocaleList) {
    const saved = sessionStorage.getItem('langLocaleEntriesPremium');
    if (saved) {
      try {
        const entries = JSON.parse(saved);
        langLocaleList.innerHTML = '';
        entries.forEach(entry => addLangLocaleEntry(entry));
      } catch (e) {
        console.warn('Failed to restore lang-locale entries:', e);
      }
    }
  }
});

// Save lang-locale entries to sessionStorage before leaving the page
window.addEventListener('pagehide', () => {
  if (langLocaleList) {
    const entries = [];
    langLocaleList.querySelectorAll('.lang-locale-item').forEach(item => {
      const entry = {
        locale: item.querySelector('.lang-locale-code')?.value || '',
        mainUrl: item.querySelector('.lang-locale-main-url')?.value || '',
        desktop: {
          windows: item.querySelector('.lang-locale-windows')?.value || '',
          macos: item.querySelector('.lang-locale-macos')?.value || '',
          linux: item.querySelector('.lang-locale-linux')?.value || '',
          chromeos: item.querySelector('.lang-locale-chromeos')?.value || ''
        },
        mobile: {
          android: item.querySelector('.lang-locale-android')?.value || '',
          ios: item.querySelector('.lang-locale-ios')?.value || '',
          ipados: item.querySelector('.lang-locale-ipados')?.value || ''
        }
      };
      entries.push(entry);
    });
    sessionStorage.setItem('langLocaleEntriesPremium', JSON.stringify(entries));
  }
});

// Lang-locale management
let langLocaleCounter = 0;

function addLangLocaleEntry(localeData = {}) {
  if (!langLocaleList) return;
  const locale = localeData.locale || '';
  const mainUrl = localeData.mainUrl || '';
  const desktop = localeData.desktop || {};
  const mobile = localeData.mobile || {};
  const hasDesktop = Object.values(desktop).some(v => v);
  const hasMobile = Object.values(mobile).some(v => v);

  const li = document.createElement('li');
  li.className = 'lang-locale-item';
  li.dataset.id = langLocaleCounter++;
  li.innerHTML = `
    <header>
      <input type="text" placeholder="e.g., en-US, ko-KR" value="${escapeHtml(locale)}" class="lang-locale-code">
      <button type="button" class="remove-lang-locale" title="Remove">Remove</button>
    </header>
    <label>
      Main Target URL (optional)
      <input type="url" placeholder="https://example.com/localized" value="${escapeHtml(mainUrl)}" class="lang-locale-main-url">
    </label>
    <ul class="lang-locale-category-list">
      <li>
        <label class="checkbox-label-inline">
          <input type="checkbox" class="lang-locale-desktop-toggle" ${hasDesktop ? 'checked' : ''}>
          Desktop
        </label>
      </li>
      <li>
        <label class="checkbox-label-inline">
          <input type="checkbox" class="lang-locale-mobile-toggle" ${hasMobile ? 'checked' : ''}>
          Mobile
        </label>
      </li>
    </ul>
    <section class="lang-locale-subsection lang-locale-desktop-section" ${hasDesktop ? '' : 'hidden'}>
      <h5>Desktop</h5>
      <fieldset>
        <label>Windows<input type="url" placeholder="https://example.com/localized/windows" value="${escapeHtml(desktop.windows || '')}" class="lang-locale-windows"></label>
        <label>macOS<input type="url" placeholder="https://example.com/localized/macos" value="${escapeHtml(desktop.macos || '')}" class="lang-locale-macos"></label>
        <label>Linux<input type="url" placeholder="https://example.com/localized/linux" value="${escapeHtml(desktop.linux || '')}" class="lang-locale-linux"></label>
        <label>ChromeOS<input type="url" placeholder="https://example.com/localized/chromeos" value="${escapeHtml(desktop.chromeos || '')}" class="lang-locale-chromeos"></label>
      </fieldset>
    </section>
    <section class="lang-locale-subsection lang-locale-mobile-section" ${hasMobile ? '' : 'hidden'}>
      <h5>Mobile</h5>
      <fieldset>
        <label>Android<input type="url" placeholder="https://example.com/localized/android" value="${escapeHtml(mobile.android || '')}" class="lang-locale-android"></label>
        <label>iOS<input type="url" placeholder="https://example.com/localized/ios" value="${escapeHtml(mobile.ios || '')}" class="lang-locale-ios"></label>
        <label>iPadOS<input type="url" placeholder="https://example.com/localized/ipados" value="${escapeHtml(mobile.ipados || '')}" class="lang-locale-ipados"></label>
      </fieldset>
    </section>
    <p class="lang-locale-error">Please provide at least one URL for this locale.</p>
  `;
  langLocaleList.appendChild(li);

  // Add toggle listeners for Desktop/Mobile sections
  const desktopToggle = li.querySelector('.lang-locale-desktop-toggle');
  const mobileToggle = li.querySelector('.lang-locale-mobile-toggle');
  const desktopSection = li.querySelector('.lang-locale-desktop-section');
  const mobileSection = li.querySelector('.lang-locale-mobile-section');

  desktopToggle.addEventListener('change', () => {
    desktopSection.hidden = !desktopToggle.checked;
  });
  mobileToggle.addEventListener('change', () => {
    mobileSection.hidden = !mobileToggle.checked;
  });

  // Add remove button listener
  li.querySelector('.remove-lang-locale').addEventListener('click', () => {
    li.remove();
  });
}

if (addLangLocaleBtn) {
  addLangLocaleBtn.addEventListener('click', () => {
    addLangLocaleEntry();
  });
}

// Collect conditional redirect data
function getConditionalRedirectData() {
  const data = {
    platformRedirects: {},
    langMap: {}
  };

  // Desktop redirects
  if (desktopToggle && desktopToggle.checked) {
    const windowsUrl = document.getElementById('windowsUrl')?.value.trim();
    const macosUrl = document.getElementById('macosUrl')?.value.trim();
    const linuxUrl = document.getElementById('linuxUrl')?.value.trim();
    const chromeosUrl = document.getElementById('chromeosUrl')?.value.trim();

    if (windowsUrl) data.platformRedirects.windows = windowsUrl;
    if (macosUrl) data.platformRedirects.macos = macosUrl;
    if (linuxUrl) data.platformRedirects.linux = linuxUrl;
    if (chromeosUrl) data.platformRedirects.chromeos = chromeosUrl;
  }

  // Mobile redirects
  if (mobileToggle && mobileToggle.checked) {
    const androidUrl = document.getElementById('androidUrl')?.value.trim();
    const iosUrl = document.getElementById('iosUrl')?.value.trim();
    const ipadosUrl = document.getElementById('ipadosUrl')?.value.trim();

    if (androidUrl) data.platformRedirects.android = androidUrl;
    if (iosUrl) data.platformRedirects.ios = iosUrl;
    if (ipadosUrl) data.platformRedirects.ipados = ipadosUrl;
  }

  // Lang-locale redirects (new nested structure)
  let hasLangLocaleError = false;
  if (langLocaleList) {
    langLocaleList.querySelectorAll('.lang-locale-item').forEach(item => {
      const code = item.querySelector('.lang-locale-code')?.value.trim();
      
      // Lang-locale code is required for each entry
      if (!code) {
        item.classList.add('has-error');
        hasLangLocaleError = true;
        return;
      }

      const mainUrl = item.querySelector('.lang-locale-main-url')?.value.trim();
      const windowsUrl = item.querySelector('.lang-locale-windows')?.value.trim();
      const macosUrl = item.querySelector('.lang-locale-macos')?.value.trim();
      const linuxUrl = item.querySelector('.lang-locale-linux')?.value.trim();
      const chromeosUrl = item.querySelector('.lang-locale-chromeos')?.value.trim();
      const androidUrl = item.querySelector('.lang-locale-android')?.value.trim();
      const iosUrl = item.querySelector('.lang-locale-ios')?.value.trim();
      const ipadosUrl = item.querySelector('.lang-locale-ipados')?.value.trim();

      // Check if at least one URL is provided
      const hasAnyUrl = mainUrl || windowsUrl || macosUrl || linuxUrl || chromeosUrl || androidUrl || iosUrl || ipadosUrl;
      if (!hasAnyUrl) {
        item.classList.add('has-error');
        hasLangLocaleError = true;
        return;
      }
      item.classList.remove('has-error');

      // Build locale entry
      const localeEntry = {};
      if (mainUrl) localeEntry.main = mainUrl;
      if (windowsUrl) localeEntry.windows = windowsUrl;
      if (macosUrl) localeEntry.macos = macosUrl;
      if (linuxUrl) localeEntry.linux = linuxUrl;
      if (chromeosUrl) localeEntry.chromeos = chromeosUrl;
      if (androidUrl) localeEntry.android = androidUrl;
      if (iosUrl) localeEntry.ios = iosUrl;
      if (ipadosUrl) localeEntry.ipados = ipadosUrl;

      data.langMap[code] = localeEntry;
    });
  }

  data.hasLangLocaleError = hasLangLocaleError;
  return data;
}

// --- Delete Link Modal ---
function createDeleteModal() {
  const dialog = document.createElement('dialog');
  dialog.id = 'deleteModalOverlay';
  dialog.className = 'modal-dialog';
  dialog.innerHTML = `
    <h3 id="deleteModalTitle">Confirm Delete</h3>
    <p id="deleteModalMessage"></p>
    <footer class="modal-actions">
      <button type="button" id="deleteModalCancel" class="modal-btn modal-btn-cancel">Cancel</button>
      <button type="button" id="deleteModalConfirm" class="modal-btn modal-btn-danger">Yes, Delete</button>
    </footer>
  `;
  document.body.appendChild(dialog);

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) hideDeleteModal();
  });
  document.getElementById('deleteModalCancel').addEventListener('click', hideDeleteModal);
}
createDeleteModal();

let pendingDeleteSlug = null;

function showDeleteModal(slug) {
  pendingDeleteSlug = slug;
  const dialog = document.getElementById('deleteModalOverlay');
  const msg = document.getElementById('deleteModalMessage');
  msg.textContent = `Are you sure you want to delete slug: "${slug}"? This action is permanent and irreversible.`;
  dialog.showModal();
}

function hideDeleteModal() {
  const dialog = document.getElementById('deleteModalOverlay');
  dialog.close();
  pendingDeleteSlug = null;
}

document.getElementById('deleteModalConfirm').addEventListener('click', async () => {
  if (!pendingDeleteSlug) return;
  const slug = pendingDeleteSlug;
  const confirmBtn = document.getElementById('deleteModalConfirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting...';

  const user = getUser();
  if (!user || !user.email) {
    alert('You must be logged in to delete links.');
    hideDeleteModal();
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Yes, Delete';
    return;
  }

  try {
    const res = await fetch('/api/deleteLink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, email: user.email, type: 'premium' })
    });

    if (res.ok) {
      hideDeleteModal();
      // Remove from local array and re-render
      userLinks = userLinks.filter(l => l.slug !== slug);
      renderLinks();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete the link.');
    }
  } catch (err) {
    alert('Error deleting link: ' + err.message);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Yes, Delete';
  }
});
