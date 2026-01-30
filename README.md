# go.junseo.ng

Features:
- Optional Case Sensitivity toggle for all custom slugs (random slugs are always case sensitive)
- External free: random slug, expiry date, visit limit
- External premium (sign-in required): custom slug, analytics
- Internal: custom slug, password-protected or private links, conditional redirects
* Tags are case sensitive

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