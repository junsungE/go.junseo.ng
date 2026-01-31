const form = document.getElementById("fetchForm");
const statsSection = document.getElementById("statsSection");
const errorMsg = document.getElementById("error");

// Stats table state
let statsVisits = [];
let statsSortCol = "timestamp";
let statsSortAsc = false;

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
  
  const table = document.createElement("table");
  table.className = "stats-table";
  table.id = "statsTable";
  
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th data-sort="type" style="width: 82px;">Type<span></span></th>
      <th data-sort="slug" style="width: 120px;">Slug<span></span></th>
      <th data-sort="ip" style="width: 105px;">IP<span></span></th>
      <th data-sort="userAgent" style="width: 185px;">User Agent<span></span></th>
      <th data-sort="country" style="width: 80px;">Country<span></span></th>
      <th data-sort="language" style="width: 85px;">Language<span></span></th>
      <th data-sort="referrer" style="width: 150px;">Referrer<span></span></th>
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
  statsVisits.forEach(v => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="type-badge type-${v.type}">${v.type}</span></td>
      <td>${escapeHtml(v.slug)}</td>
      <td>${escapeHtml(v.ip)}</td>
      <td>${escapeHtml(v.userAgent)}</td>
      <td>${escapeHtml(v.country)}</td>
      <td>${escapeHtml(v.language || 'Unknown')}</td>
      <td>${escapeHtml(v.referrer || 'Direct')}</td>
      <td>${new Date(v.timestamp).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  
  statsSection.appendChild(table);
  
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