const form = document.getElementById("fetchForm");
      const statsSection = document.getElementById("statsSection");
      const errorMsg = document.getElementById("error");

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        statsSection.textContent = "";
        errorMsg.textContent = "";
        const data = Object.fromEntries(new FormData(form).entries());
        const res = await fetch(`/api/getStats?slug=${data.slug}&type=${data.type}`);
        const result = await res.json();
        if (res.ok) {
          const table = document.createElement("table");
          table.className = "stats-table";
          const thead = document.createElement("thead");
          thead.innerHTML = `
            <tr>
              <th>Timestamp</th>
              <th>IP</th>
              <th>User Agent</th>
              <th>Country</th>
            </tr>`;
          table.appendChild(thead);

          const tbody = document.createElement("tbody");
          result.visits.forEach(v => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${v.timestamp}</td>
              <td>${v.ip}</td>
              <td>${v.userAgent}</td>
              <td>${v.country}</td>`;
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
          
          if (res.status === 401) {
              adminStatus.textContent = "Invalid secret.";
              adminStatus.style.color = "red";
              usersBody.innerHTML = "<tr><td colspan='5'>Unauthorized. Please update the Admin Secret above.</td></tr>";
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
            
            let actionHtml = "";
            if (user.status === "pending") {
                actionHtml = `
                    <button class="action-btn approve" onclick="updateUserStatus('${user.id}', 'approved')">Approve</button>
                    <button class="action-btn reject" onclick="updateUserStatus('${user.id}', 'rejected')">Reject</button>
                `;
            } else {
                actionHtml = `<span style="font-size: 0.8em; color: #666;">No actions</span>`;
            }

            tr.innerHTML = `
              <td>${user.displayName}</td>
              <td style="font-family: monospace; font-size: 0.9em;">${user.email}</td>
              <td><span class="status-badge status-${user.status}">${user.status}</span></td>
              <td>${dateStr}</td>
              <td>${actionHtml}</td>
            `;
            usersBody.appendChild(tr);
          });
        } catch (err) {
          usersLoading.style.display = "none";
          usersBody.innerHTML = `<tr><td colspan='5'>Error: ${err.message}</td></tr>`;
        }
      }

      window.updateUserStatus = async (userId, newStatus) => {
          const secret = localStorage.getItem("adminSecret");
          if (!confirm(`Are you sure you want to set this user to ${newStatus}?`)) return;

          try {
            const res = await fetch("/api/adminApprove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, secret, status: newStatus })
            });
            const result = await res.json();
            
            if (res.ok) {
                alert(result.message);
                fetchUsers(); // reload list
            } else {
                alert("Error: " + result.error);
            }
          } catch (err) {
              alert("Error: " + err.message);
          }
      };

      // Load users on init
      fetchUsers();