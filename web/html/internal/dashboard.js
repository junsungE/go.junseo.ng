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