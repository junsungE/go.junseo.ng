# go.junseo.ng

## Premium Go URL Shortener(ext)

1. My Links table:
- Clicking any column header sorts the table by that column.
- Clicking the same header again toggles between Ascending and Descending.
- Default sort for generic columns is Ascending.
- Default sort for numeric/date columns (Created, Visits, Last Visited, Expiry) is Descending (most recent/highest first).
- Secondary Sort: If values are equal (e.g., same visit count), records are sorted by "Created" date (newest first).
- Visits Sorting: Sorts purely by the raw visit count number, ignoring the limit display (e.g., "5/10" is sorted as 5).