const form = document.getElementById("fetchForm");
      const statsSection = document.getElementById("statsSection");
      const errorMsg = document.getElementById("error");

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        statsSection.textContent = "";
        errorMsg.textContent = "";
        const data = Object.fromEntries(new FormData(form).entries());
        const res = await fetch(`/api/getStats?slug=${encodeURIComponent(data.slug)}&type=${data.type}`);
        const result = await res.json();
        if (res.ok) {
          if (!result.visits || result.visits.length === 0) {
              statsSection.innerHTML = "<p>No visits found for this criteria.</p>";
              return;
          }

          const table = document.createElement("table");
          table.className = "stats-table";
          const thead = document.createElement("thead");
          thead.innerHTML = `
            <tr>
              <th>Slug</th>
              <th>IP</th>
              <th>User Agent</th>
              <th>Country</th>
              <th>Language</th>
              <th>Referrer</th>
              <th>Timestamp</th>
            </tr>`;
          table.appendChild(thead);

          const tbody = document.createElement("tbody");
          result.visits.forEach(v => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${v.slug}</td>
              <td>${v.ip}</td>
              <td>${v.userAgent}</td>
              <td>${v.country}</td>
              <td>${v.language || 'Unknown'}</td>
              <td>${v.referrer || 'Direct'}</td>
              <td>${new Date(v.timestamp).toLocaleString()}</td>`;
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);

          statsSection.appendChild(table);
        } else {
          errorMsg.textContent = result.error || "Failed to fetch stats.";
        }
      });

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