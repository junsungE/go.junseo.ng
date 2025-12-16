fetch("/.auth/me")
  .then(r => r.json())
  .then(d => {
    if (!d.clientPrincipal) return;

    document.getElementById("logout-nav").innerHTML = `
      <span>${d.clientPrincipal.userDetails}</span>
      |
      <a href="/.auth/logout">Logout</a>
    `;
  });
