const userStr = localStorage.getItem("user");
const user = userStr ? JSON.parse(userStr) : null;

const nav = document.getElementById("premium-nav");

if (user && nav) {
    const container = document.createElement("span");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "10px";

    // User Display Name
    const nameSpan = document.createElement("span");
    nameSpan.textContent = user.displayName;
    container.appendChild(nameSpan);

    container.appendChild(document.createTextNode("|"));

    // Approval Status / Request Button
    const statusSpan = document.createElement("span");
    
    // Check status logic
    if (user.status === "approved") {
        statusSpan.textContent = "Approved";
        statusSpan.style.color = "green";
        statusSpan.style.fontWeight = "bold";
    } else if (user.status === "pending") {
        statusSpan.textContent = "Pending";
        statusSpan.style.color = "black";
        statusSpan.style.cursor = "default";
    } else {
        // new or rejected or null
        const reqLink = document.createElement("a");
        reqLink.href = "#";
        reqLink.textContent = "Request access";
        reqLink.style.color = "#0078d4";
        reqLink.style.cursor = "pointer";
        
        reqLink.onclick = async (e) => {
            e.preventDefault();
            if(!confirm("Request admin approval for full access?")) return;

            try {
                const res = await fetch("/api/requestApproval", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.id })
                });
                const data = await res.json();
                if (res.ok) {
                    user.status = "pending";
                    localStorage.setItem("user", JSON.stringify(user));
                    window.location.reload();
                } else {
                    alert(data.error || "Request failed");
                }
            } catch(err) {
                alert("Error: " + err.message);
            }
        };
        statusSpan.appendChild(reqLink);
    }
    container.appendChild(statusSpan);

    container.appendChild(document.createTextNode("|"));

    // Logout Button
    const logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.textContent = 'Logout';
    logoutBtn.style.color = "#0078d4"; // Make it look like a link to match style
    logoutBtn.style.cursor = "pointer";
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      localStorage.removeItem("user");
      window.location.href = "/ext/premium/login";
    };
    container.appendChild(logoutBtn);

    nav.appendChild(container);
} else {
    // If no user, redirect to sign in? Or show sign in link
    if(nav) {
        nav.innerHTML = '<a href="/ext/premium/login">Sign In</a>';
    }
}
