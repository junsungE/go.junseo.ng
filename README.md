# go.junseo.ng

Features:
- Optional Case Sensitivity toggle for all custom slugs (random slugs are always case sensitive)
- External free: random slug, expiry date, visit limit
- External premium (sign-in required): custom slug, analytics
- Internal: custom slug, password-protected or private links, conditional redirects

## Premium Go URL Shortener(ext)

My Links table:
- Clicking any column header sorts the table by that column.
- Clicking the same header again toggles between Ascending and Descending.
- Default sort for generic columns is Ascending.
- Default sort for numeric/date columns (Created, Visits, Last Visited, Expiry) is Descending (most recent/highest first).
- Secondary Sort: If values are equal (e.g., same visit count), records are sorted by "Created" date (newest first).
- Visits Sorting: Sorts purely by the raw visit count number, ignoring the limit display (e.g., "5/10" is sorted as 5).