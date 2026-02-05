const form = document.getElementById("fetchForm");
const statsSection = document.getElementById("statsSection");
const errorMsg = document.getElementById("error");

// Stats table state
let statsVisits = [];
let statsSortCol = "timestamp";
let statsSortAsc = false;

// Pagination state for stats table
let statsCurrentPage = 1;
let statsRowsPerPage = 20;

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
    
    // Always show last 3 pages
    for (let i = Math.max(totalPages - 2, 2); i <= totalPages; i++) {
      if (!pages.includes(i)) pages.push(i);
    }
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statsSection.textContent = "";
  errorMsg.textContent = "";
  
  const formData = new FormData(form);
  const slug = formData.get("slug") || "";
  const selectedTypes = formData.getAll("type");
  
  if (selectedTypes.length === 0) {
    errorMsg.textContent = "Please select at least one type.";
    return;
  }
  
  // Fetch from all selected types
  const allVisits = [];
  for (const type of selectedTypes) {
    try {
      const res = await fetch(`/api/getStats?slug=${encodeURIComponent(slug)}&type=${type}`);
      const result = await res.json();
      if (res.ok && result.visits) {
        // Add type to each visit for display
        result.visits.forEach(v => {
          v.type = type;
          allVisits.push(v);
        });
      }
    } catch (err) {
      console.warn(`Failed to fetch ${type} stats:`, err);
    }
  }
  
  if (allVisits.length === 0) {
    statsSection.innerHTML = "<p>No visits found for this criteria.</p>";
    return;
  }
  
  statsVisits = allVisits;
  statsSortCol = "timestamp";
  statsSortAsc = false;
  statsCurrentPage = 1; // Reset to first page on new data
  renderStatsTable();
});

function renderStatsTable() {
  statsSection.innerHTML = "";
  
  // Sort visits
  statsVisits.sort((a, b) => {
    let valA = a[statsSortCol];
    let valB = b[statsSortCol];
    
    if (valA === null || valA === undefined) valA = "";
    if (valB === null || valB === undefined) valB = "";
    
    let cmp = 0;
    if (statsSortCol === "timestamp") {
      cmp = new Date(valA) - new Date(valB);
    } else if (typeof valA === 'string' && typeof valB === 'string') {
      cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
    } else {
      if (valA < valB) cmp = -1;
      if (valA > valB) cmp = 1;
    }
    
    return statsSortAsc ? cmp : -cmp;
  });
  
  // Pagination handlers
  const handlePageChange = (page) => {
    statsCurrentPage = page;
    renderStatsTable();
  };
  const handleRowsPerPageChange = (rows) => {
    statsRowsPerPage = rows;
    statsCurrentPage = 1;
    renderStatsTable();
  };
  
  // Calculate page data
  const totalRows = statsVisits.length;
  const totalPages = Math.ceil(totalRows / statsRowsPerPage);
  if (statsCurrentPage > totalPages && totalPages > 0) statsCurrentPage = totalPages;
  
  const startIdx = (statsCurrentPage - 1) * statsRowsPerPage;
  const endIdx = startIdx + statsRowsPerPage;
  const pageData = statsVisits.slice(startIdx, endIdx);
  
  // Top pagination
  const topNav = createPaginationNav(statsCurrentPage, totalRows, statsRowsPerPage, handlePageChange, handleRowsPerPageChange);
  statsSection.appendChild(topNav);
  
  const table = document.createElement("table");
  table.className = "stats-table";
  table.id = "statsTable";
  
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th data-sort="type" style="width: 82px;">Type<span></span></th>
      <th data-sort="visitType" style="width: 90px;">Visit Type<span></span></th>
      <th data-sort="slug" style="width: 120px;">Slug<span></span></th>
      <th data-sort="ip" style="width: 105px;">IP<span></span></th>
      <th data-sort="country" style="width: 80px;">Country<span></span></th>
      <th data-sort="language" style="width: 85px;">Language<span></span></th>
      <th data-sort="userAgent" style="width: 185px;">User Agent<span></span></th>
      <th data-sort="referrer" style="width: 150px;">Referrer<span></span></th>
      <th data-sort="sourceApp" style="width: 110px;">Source App<span></span></th>
      <th data-sort="timestamp" style="width: 112px;">Timestamp<span></span></th>
    </tr>`;
  table.appendChild(thead);
  
  // Update sort indicators
  thead.querySelectorAll("th").forEach(th => {
    const span = th.querySelector("span");
    if (th.dataset.sort === statsSortCol) {
      span.textContent = statsSortAsc ? " ▲" : " ▼";
    }
  });
  
  const tbody = document.createElement("tbody");
  pageData.forEach(v => {
    const tr = document.createElement("tr");
    // Determine visit type display
    const visitTypeDisplay = v.visitType || 'valid';
    const visitTypeClass = visitTypeDisplay === 'valid' ? 'visit-valid' : 
                          visitTypeDisplay === 'notfound' ? 'visit-notfound' : 
                          visitTypeDisplay === 'inactive' ? 'visit-inactive' : '';
    tr.innerHTML = `
      <td><span class="type-badge type-${v.type}">${v.type}</span></td>
      <td><span class="visit-type-badge ${visitTypeClass}">${visitTypeDisplay}</span></td>
      <td>${escapeHtml(v.slug)}</td>
      <td>${escapeHtml(v.ip)}</td>
      <td>${escapeHtml(v.country)}</td>
      <td>${escapeHtml(v.language || 'Unknown')}</td>
      <td>${escapeHtml(v.userAgent)}</td>
      <td>${escapeHtml(v.referrer || 'Direct')}</td>
      <td>${escapeHtml(v.sourceApp || '-')}</td>
      <td>${new Date(v.timestamp).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  
  statsSection.appendChild(table);
  
  // Bottom pagination
  const bottomNav = createPaginationNav(statsCurrentPage, totalRows, statsRowsPerPage, handlePageChange, handleRowsPerPageChange);
  statsSection.appendChild(bottomNav);
  
  // Add click handlers for sorting
  thead.querySelectorAll("th").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", (e) => {
      // Don't sort if clicking resizer
      if (e.target.classList.contains('resizer')) return;
      
      const col = th.dataset.sort;
      if (statsSortCol === col) {
        statsSortAsc = !statsSortAsc;
      } else {
        statsSortCol = col;
        statsSortAsc = true;
      }
      renderStatsTable();
    });
  });
  
  // Initialize resizable columns
  initStatsTableResizer();
}

function initStatsTableResizer() {
  const headers = document.querySelectorAll("#statsTable th");
  headers.forEach(th => {
    const resizer = document.createElement('div');
    resizer.classList.add('resizer');
    th.appendChild(resizer);
    
    let x = 0;
    let w = 0;

    const mouseDownHandler = (e) => {
      e.stopPropagation();
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
      if (e.type === 'touchmove') e.preventDefault();
      const currentX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const dx = currentX - x;
      const newWidth = w + dx;
      if (newWidth > 50) {
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
    resizer.addEventListener('click', (e) => e.stopPropagation());
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

const usersBody = document.getElementById("usersBody");
const usersLoading = document.getElementById("usersLoading");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminSecretInput = document.getElementById("adminSecretInput");
const adminStatus = document.getElementById("adminStatus");

// Load saved secret if exists
      if (localStorage.getItem("adminSecret")) {
          adminSecretInput.value = localStorage.getItem("adminSecret");
          adminStatus.textContent = "Saved secret loaded.";
          adminStatus.style.color = "green";
      }

      adminLoginForm.addEventListener("submit", (e) => {
          e.preventDefault();
          localStorage.setItem("adminSecret", adminSecretInput.value);
          adminStatus.textContent = "Secret updated.";
          adminStatus.style.color = "green";
          fetchUsers();
      });

      async function fetchUsers() {
        const secret = localStorage.getItem("adminSecret");
        if (!secret) return;

        usersLoading.style.display = "block";
        usersBody.innerHTML = "";
        
        try {
          const res = await fetch("/api/listUsers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ secret })
          });
          
          if (res.status === 401 || res.status === 403) {
              adminStatus.textContent = "Invalid secret.";
              adminStatus.style.color = "red";
              usersBody.innerHTML = "<tr><td colspan='5'>Forbidden. Please update the Admin Secret above.</td></tr>";
              usersLoading.style.display = "none";
              return;
          }

          const users = await res.json();
          usersLoading.style.display = "none";
          adminStatus.textContent = "Authenticated successfully.";
          adminStatus.style.color = "green";

          if (users.length === 0) {
              usersBody.innerHTML = "<tr><td colspan='5'>No premium users found.</td></tr>";
              return;
          }

          users.forEach(user => {
            const tr = document.createElement("tr");
            
            // Format date
            const dateStr = user.lastSignIn === "Never" ? "Never" : new Date(user.lastSignIn).toLocaleString();
            
            // Create cells
            const nameCell = document.createElement("td");
            nameCell.textContent = user.displayName;
            
            const emailCell = document.createElement("td");
            emailCell.style.fontFamily = "monospace";
            emailCell.style.fontSize = "0.9em";
            emailCell.textContent = user.email;
            
            const statusCell = document.createElement("td");
            const statusBadge = document.createElement("span");
            statusBadge.className = `status-badge status-${user.status}`;
            statusBadge.textContent = user.status;
            statusCell.appendChild(statusBadge);
            
            const dateCell = document.createElement("td");
            dateCell.textContent = dateStr;
            
            const actionCell = document.createElement("td");
            
            if (user.status === "pending") {
                const approveBtn = document.createElement("button");
                approveBtn.className = "action-btn approve";
                approveBtn.textContent = "Approve";
                approveBtn.addEventListener("click", () => updateUserStatus(user.id, "approved"));
                
                const rejectBtn = document.createElement("button");
                rejectBtn.className = "action-btn reject";
                rejectBtn.textContent = "Reject";
                rejectBtn.addEventListener("click", () => updateUserStatus(user.id, "rejected"));
                
                actionCell.appendChild(approveBtn);
                actionCell.appendChild(document.createTextNode(" "));
                actionCell.appendChild(rejectBtn);
            } else {
                const noAction = document.createElement("span");
                noAction.style.fontSize = "0.8em";
                noAction.style.color = "#666";
                noAction.textContent = "No actions";
                actionCell.appendChild(noAction);
            }
            
            tr.appendChild(nameCell);
            tr.appendChild(emailCell);
            tr.appendChild(statusCell);
            tr.appendChild(dateCell);
            tr.appendChild(actionCell);
            usersBody.appendChild(tr);
          });
        } catch (err) {
          usersLoading.style.display = "none";
          usersBody.innerHTML = `<tr><td colspan='5'>Error: ${err.message}</td></tr>`;
        }
      }

      async function updateUserStatus(userId, newStatus) {
          const secret = localStorage.getItem("adminSecret");
          if (!confirm(`Are you sure you want to set this user to ${newStatus}?`)) return;

          console.log(`Updating user ${userId} to ${newStatus}...`);

          try {
            const res = await fetch("/api/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, secret, status: newStatus })
            });

            // Parse response - handle both success and error JSON
            let result;
            try {
                result = await res.json();
            } catch (e) {
                console.error("Failed to parse JSON:", e);
                alert("Error: Server returned invalid response. See console.");
                return;
            }
            
            if (res.ok) {
                alert(result.message);
                fetchUsers(); // reload list
            } else {
                console.error("API Error:", result);
                alert("Error: " + (result.error || result.message || "Unknown error"));
            }
          } catch (err) {
              console.error("Network Error:", err);
              alert("Network Error: " + err.message);
          }
      };

      // Load users on init
      fetchUsers();