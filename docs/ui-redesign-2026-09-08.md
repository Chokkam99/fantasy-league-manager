# League Office UI redesign

Implemented locally September 8, 2026. This is an application UI change; it has
not been deployed and does not resolve the server/authentication backlog in
[the app review](app-review-2026-09-04.md).

## Design direction

Warm paper surfaces, dark ink navigation, burnt-orange actions, and a pale-lime
season banner give the league a consistent sports-journal identity. Serif type
is limited to the landing and season hero; working screens use compact sans-serif
headings and tabular numbers. The field artwork is decorative SVG, with no remote
font or image dependency.

Shared tokens live in `src/app/globals.css`; `PageHeader` and `BrandMark` provide
reusable page and identity elements. Success feedback has its own green surface
token so it remains distinct from the orange brand palette.

## Main workflow changes

- Desktop navigation rail at 1280px and above; top navigation at 768–1279px;
  bottom navigation below 768px. Players and Rules remain available in the
  compact menu throughout that last range.
- A keyboard skip link goes directly to league content. The desktop rail can
  scroll independently on short screens.
- Commissioner attention appears immediately below the season hero, ahead of
  summary metrics. Public overview metrics emphasize the entry pool, entry fee,
  and weekly leader instead of collection status.
- Standings lead the overview. A shorter money summary shows the entry pool,
  allocations, and balance; full details stay on the money page.
- Score-import configuration and secondary actions take less vertical space,
  bringing weekly results higher on mobile.
- League history uses the available width, and its overview shortcut scrolls
  directly to the history section.
- Landing, portfolio cards, standings, roster, prizes, rules, settings, and shared
  feedback components follow the same visual system.

## Validation

- ESLint, application TypeScript check, and production build passed.
- Unit/component suite: 400 tests passed initially; the one affected schedule-copy
  assertion was corrected by preserving the exact schedule and season text.
  All three tests in that affected suite then passed.
- Six synthetic integration tests passed.
- Thirteen responsive browser journeys passed. Three duplicate executions of
  the dedicated 680px breakpoint case were intentionally skipped.
- Production-build screenshots checked at 320, 390, 680, and 1440px; automated
  journeys additionally cover 768 and 1280px. Inspected screens had no document
  overflow.
- Checked mobile dialog bounds, Escape dismissal, focus restoration, keyboard
  skip navigation, and the history shortcut without submitting mutations.

Local review screenshots are in the Git-ignored `temp/ui-redesign/` directory.
All browser data was synthetic; Production services were not used for validation.
