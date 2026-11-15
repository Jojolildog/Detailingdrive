# DetailFlow — Phase 0

A Hungarian-first foundation for a car detailing business management application.
Built with React, TypeScript, the Sites Vinext starter, and Cloudflare D1.

## Scope

- Responsive application shell and nine navigation sections.
- Hungarian defaults and English dictionaries with key-parity checks.
- Light, dark, and system appearance settings.
- Dispatch-owned Sign in with ChatGPT and server-side owner authorization.
- Persistent business settings, validation, request-size limits, same-origin write checks, and optimistic concurrency.
- A schema-only SQL migration with 14 related tables, UUID primary keys, timestamps, and business boundaries.
- Empty states for future customer, vehicle, job, service, inventory, equipment, and reporting workflows.

Phase 0 does not implement customer CRUD, work-order operations, inventory deduction workflows, reporting calculations, subscriptions, or multi-business administration. No sample customers, jobs, equipment, chemicals, or financial figures are inserted.

## Development

Use Node.js 24 and npm. Dependencies are locked in `package-lock.json`.

```sh
npm run install:ci
npm test
npm run typecheck
npm run build
```

For a loopback preview, copy `.dev.vars.example` to `.dev.vars`, then run `npm run dev`. The portable starter provides an explicitly local development identity. The production build uses Sites' authentication boundary instead.

The `/settings` screen persists preferences in D1. An empty tariff means unknown, not zero. The 24-month equipment replacement horizon is an editable planning default. No financial calculations are presented in this phase.

## Authentication and setup

The existing Site identity is retained in `.openai/hosting.json`. Its D1 binding is `DB`.
Keep the Site owner-private when publishing. Repository visibility and application access are separate.

Configure `DETAILFLOW_OWNER_USER_ID` or `DETAILFLOW_OWNER_EMAIL` through Sites runtime environment variables. Never commit actual environment files, credentials, access tokens, or customer records. The first authenticated request must match this explicit configuration before a business can be provisioned. The owner is then persisted using the Site-scoped user ID; matching an email alone cannot access an existing business. A configured user ID takes precedence over the bootstrap email.

All protected reads and writes resolve the owner on the server. `businessId` never comes from a browser write payload. Missing configuration or database availability produces an explicit unavailable/setup state, rather than an in-memory substitute.

## Database

`drizzle/0000_foundation.sql` is the canonical, hand-authored SQL migration. The directory name follows the Sites migration packaging convention; the application uses typed D1 prepared statements rather than Drizzle's runtime ORM. `db/schema.ts` defines server query row types and maps database fields to camelCase DTOs. D1 applies the SQL on publication through Sites.

For a local D1 preview, first build the Worker, then apply the migration to the local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_foundation.sql
```

Apply it once per database. Append new numbered SQL migrations for later schema changes. Applied migration files and journal entries must remain immutable. This project does not use automatic schema generation.

| Tables | Purpose |
|---|---|
| `businesses`, `business_settings` | Single owner and persistent preferences |
| `customers`, `vehicles` | Customer and vehicle boundaries |
| `services`, `work_orders`, `work_order_services` | Job identity, independent job/payment statuses, selected-service snapshots |
| `chemicals`, `inventory_movements` | Stock quantities and idempotent movement records |
| `equipment`, `work_order_equipment` | Equipment specifications and actual operation time |
| `work_order_chemicals`, `work_order_expenses` | Usage and categorized direct expenses |
| `work_order_cost_snapshots` | Historical prices and calculation inputs |

SQL columns use snake_case; TypeScript and API fields use camelCase (`createdAt`, `updatedAt`, `businessId`). Customer `createdDate` in future APIs should map to `created_at`. All monetary totals are integer HUF; utility and unit-cost rates may be decimal. Chemical quantities use milliliters, water uses liters, and operating time uses minutes. Dilution `1:n` means one part concentrate plus `n` parts water. Negative available stock and duplicate business-scoped idempotency keys are rejected. Future inventory services must atomically update stock and insert movements; the foundation alone does not execute inventory operations.

## Project structure

| Path | Responsibility |
|---|---|
| `app/` | Routes, shared document shell, loading and error boundaries |
| `components/detailflow/` | Reusable navigation, layout, empty states, settings form |
| `lib/` | Settings validation, locale dictionaries, navigation and pure access rules |
| `server/` | Business provisioning, settings repository and API handlers |
| `db/`, `drizzle/` | D1 access, row types and versioned schema |
| `tests/` | SQLite integration tests and access/API/validation checks |
| `.github/workflows/ci.yml` | Dependency installation, tests, type checking and build |

## Verification and publication status

The 25 dependency-free foundation tests pass using Node's SQLite implementation. They exercise the actual SQL repositories and API handlers, including persistence after closing and reopening a database. They are not a substitute for hosted D1 and browser verification.

At initial reconstruction, this authoring environment could not resolve the npm registry or the Sites source Git host and did not expose npm on PATH. Installation, framework type checking, browser QA, and production deployment therefore require confirmation through CI or a working development environment. A source commit does not mean the Site has been published. Consult GitHub Actions for the current CI result and Sites for deployment status.
