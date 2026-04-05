# go.junseo.ng

Features:
- Optional Case Sensitivity toggle for all custom slugs (random slugs are always case sensitive)
- External free: random slug, expiry date, visit limit
- External premium (sign-in required): custom slug, analytics
- Internal: custom slug, password-protected or private links, conditional redirects

Slug creation rule:
- If there are only case sensitive URLs for a slug, the system can create a different case sensitive URLs for the same slug. It will allow random slug(which is case sensitive) reusability.
- But when the user tries to create non case sensitive URL with the same slug, it should block creation to prevent conflict. Also, when non case sensitive slug exists, the system would not allow to create case sensitive URL with that non case sensitive slug.

## Premium Go URL Shortener(ext)

My Links table:
- Clicking any column header sorts the table by that column.
- Clicking the same header again toggles between Ascending and Descending.
- Default sort for generic columns is Ascending.
- Default sort for numeric/date columns (Created, Visits, Last Visited, Expiry) is Descending (most recent/highest first).
- Secondary Sort: If values are equal (e.g., same visit count), records are sorted by "Created" date (newest first).
- Visits Sorting: Sorts purely by the raw visit count number, ignoring the limit display (e.g., "5/10" is sorted as 5).

### Environment variables
- ADMIN_EMAIL
- ADMIN_SECRET
- DOMAIN
- TRUSTED_DOMAINS
- STORAGE_CONN (for Azure Table storage)

Common (for sending email):
- EMAIL_PROVIDER (acs or resend or graph or smtp or powerautomate)
- SENDER_EMAIL (need to change depends on EMAIL_PROVIDER)

For acs:
- COMMUNICATION_SERVICES_CONNECTION_STRING

For resend:
- RESEND_API_KEY

For graph:
- M365_TENANT_ID (your tenant id)
- M365_CLIENT_ID (app client id)
- M365_CLIENT_SECRET (app secret value)
- M365_SENDER_USER (sender mailbox UPN)

For smtp:
- SMTP_HOST (smtp.office365.com)
- SMTP_PORT (587)
- SMTP_SECURE (false)
- SMTP_USER (mailbox username)
- SMTP_PASS (mailbox password or approved credential method)

For Power Automate relay:
- POWER_AUTOMATE_URL (HTTP trigger URL)
- POWER_AUTOMATE_METHOD (post or get, default: post)
- POWER_AUTOMATE_SECRET (optional shared secret for Authorization header)