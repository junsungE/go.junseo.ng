// Redirect to Microsoft logout endpoint to clear Azure AD session
// This ensures the user is fully logged out and will see account picker on next login
const postLogoutUri = encodeURIComponent(window.location.origin + '/');
window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=' + postLogoutUri;
