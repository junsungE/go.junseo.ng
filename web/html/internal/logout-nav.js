fetch("/.auth/me")
  .then(r => r.json())
  .then(d => {
    if (!d.clientPrincipal) return;

    const logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = async (e) => {
      e.preventDefault();
      // Logout from SWA and redirect to Microsoft logout endpoint
      window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=' + encodeURIComponent(window.location.origin + '/.auth/logout?post_logout_redirect_uri=/');
    };

    const nav = document.getElementById("logout-nav");
    nav.innerHTML = `<span>${d.clientPrincipal.userDetails}</span> | `;
    nav.appendChild(logoutBtn);
  });
