# Shared league dues — September 8, 2026

The owner confirmed that shared viewers should see each player's dues status,
without private payment notes. This change is implemented locally; it has not
been deployed.

## Findings and changes

- The share action copies the normal league URL, which reads current database
  records. It does not create a snapshot.
- The public roster previously omitted dues badges. It now shows Paid, Partial,
  or Unpaid for each active player in the selected season.
- Public finance previously omitted canonical payments and the finance summary.
  Shared totals could fall back to legacy paid/unpaid flags and miss partial
  amounts. The API now returns a restricted dues projection (member ID, status,
  expected cents, paid cents) and canonical aggregate totals.
- Payment notes, methods, payment timestamps, and internal payment IDs are omitted
  from the shared dues response. Commissioner payment editing remains protected.
- Visible shared roster, overview, and money pages refresh every 30 seconds and
  on focus or return to visibility, with a five-second debounce. Commissioner
  pages do not poll. Background refresh preserves the current screen and search.
- Invalidated in-flight requests cannot repopulate the cache or overwrite a newer
  page request. Reads bypass the browser HTTP cache.
- A failed finance read shows dues as Unavailable, with automatic retry, rather
  than presenting the legacy status as current.

## Validation

- All 414 Jest tests passed, including six synthetic integration workflows.
- Regression tests cover the public API projection, private commissioner fields,
  partial-payment totals, roster status, cache races, and refresh lifecycle.
- All 17 responsive browser journeys passed at 320, 390, 768, and 1280 pixels,
  plus the dedicated 680-pixel case. Three duplicate breakpoint cases were skipped.
- Browser checks change synthetic player names and dues after the shared page is
  open and verify both periodic and focus refresh without navigation.
- Application typecheck, ESLint, and production build passed.
- Production preview checked at 390 and 1440 pixels, including a simulated finance
  failure and successful automatic recovery. Screenshots are in the Git-ignored
  `temp/ui-redesign/shared-dues-*.png` files.

All data used for validation was synthetic. No production records were changed.
