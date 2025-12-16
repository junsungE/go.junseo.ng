fetch("/.auth/me")
  .then(r => r.json())
  .then(d => {
    if (!d.clientPrincipal) return;

    const logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = async (e) => {
      e.preventDefault();
      // Step 1: Clear SWA session cookies first
      // Step 2: Redirect to logout.html which handles Microsoft logout
      // This ensures both SWA and Azure AD sessions are properly cleared
      window.location.href = '/.auth/logout?post_logout_redirect_uri=/logout.html';
    };

    const nav = document.getElementById("logout-nav");
    nav.innerHTML = `<span>${d.clientPrincipal.userDetails}</span> | `;
    nav.appendChild(logoutBtn);
  });
