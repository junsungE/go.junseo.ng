// Redirect to Microsoft logout endpoint to clear Azure AD session
// This ensures the user is fully logged out and will see account picker on next login

// Show the logout message briefly before redirecting
setTimeout(() => {
  // Try Microsoft logout first. If the post_logout_redirect_uri is not registered
  // in Azure AD, Microsoft will show its own logout confirmation page.
  // The user can then manually navigate back to the site.
  // Note: You should register https://your-domain.com/login in Azure AD App Registration
  // under Authentication > Redirect URIs for automatic redirect to work.
  const postLogoutUri = encodeURIComponent(window.location.origin + '/login');
  window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=' + postLogoutUri;
}, 1000);
