// Check if user is already authenticated with internal role
// If yes, redirect to /internal/new automatically
fetch('/.auth/me')
  .then(r => r.json())
  .then(d => {
    if (d.clientPrincipal && d.clientPrincipal.userRoles.includes('internal')) {
      window.location.replace('/internal/new');
    }
  })
  .catch(() => {
    // If fetch fails, just show the login page
  });

// Navigation handlers moved out of inline HTML to satisfy CSP
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('internalSignInBtn');
  if (!btn) return;

  const go = () => { window.location.assign('/internal/new'); };

  // Primary handling for mouse/tap
  btn.addEventListener('click', go);

  // Mobile: ensure touch activates navigation (prevent double-fire)
  btn.addEventListener('touchend', function (e) {
    e.preventDefault();
    go();
  }, { passive: false });

  // Keyboard accessibility (Enter / Space)
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  });
});
