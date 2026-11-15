# Phase 0 acceptance

## Implemented in source

- Desktop sidebar; mobile drawer with Escape, focus containment, backdrop and focus restoration.
- All nine requested sections; future workflows are explicitly labeled as unavailable.
- Shared application layout and empty states with no business fixtures.
- Hungarian default, English dictionaries, HUF, Europe/Budapest, metric units.
- Persistent general, appearance, regional and operating preferences.
- Server validation, bounded JSON, private/no-store responses and same-origin writes.
- Explicit owner bootstrap, persisted Site identity and server authorization on every operation.
- UUID IDs, creation/update timestamps, business foreign keys and composite relationship boundaries.
- Separate job/payment statuses, inventory movement idempotency keys and historical cost snapshot fields.
- GitHub Actions checks and a locked dependency graph.

## Required before calling the deployed foundation ready

Dependency installation, all 25 tests, TypeScript, and the production build have passed in GitHub Actions. The owner bootstrap email is configured in Sites runtime secrets. The remaining items below describe deployed-application acceptance and must still be verified.

1. Keep CI installation, TypeScript and production build checks passing.
2. Preserve the configured owner identity in runtime environment variables.
3. Synchronize the source to the existing Site repository and publish owner-private.
4. Confirm migrations applied in hosted D1.
5. Verify sign-in and reject a non-owner request.
6. Save settings, reopen the app and verify persistence.
7. Check all navigation sections on desktop and mobile, including keyboard focus.
8. Check language and theme after saving and reopening.

Do not mark these checks passed until they have actually run. Phase 1 customer management remains the next implementation milestone.
