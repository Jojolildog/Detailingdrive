# Phase 3 - Services and pricing

The service catalog is stored in the existing business-scoped D1 database. It starts empty. The owner creates their own services and prices; no catalog or example financial data is seeded.

## Workflow

- `/services`: search names and descriptions, filter by active status, minimum/maximum price and maximum duration, sort, and paginate.
- `/services/new`: create a service with its own name and explicit HUF price.
- `/services/:id`: view description, price, duration, material plan, optional cost estimate, status and creation date.
- `/services/:id/edit`: edit all catalog information or deactivate a service.
- Delete an unused service through a confirmation dialog. Services referenced by work orders or bundle composition cannot be deleted; deactivate them instead.

The existing owner authentication, Hungarian/English preferences, appearance settings and responsive shell apply to all service screens. Form validation preserves entered values on errors. Unsaved changes prompt before leaving through the form or navigation. Stale edits and deletes return a conflict instead of overwriting newer data.

## Fields and units

| API field | Storage/meaning |
|---|---|
| `id` | Server-generated UUID |
| `serviceName` | Required, trimmed, at most 160 characters |
| `description` | Optional plain text, at most 10,000 characters |
| `defaultPrice` | Required whole HUF, 0 through 100,000,000; zero must be explicit |
| `expectedDuration` | Optional positive whole minutes, at most 10,080 |
| `expectedMaterials` | Up to 50 `{name, quantity, unit}` planning rows |
| `optionalCostEstimate` | Optional whole HUF, 0 through 100,000,000 |
| `active` | Editable catalog status, initially true |
| `currency` | Server-owned `HUF` |
| `serviceType` | Server-owned `single` or future `bundle` |
| `createdAt`, `updatedAt`, `version` | Server-managed timestamps and optimistic concurrency |

Material names are required and limited to 120 characters. Quantity is optional, positive, at most 1,000,000, with up to three decimal places. Supported units are ml, l, g, kg and piece. Material rows do not adjust inventory and do not generate a cost calculation. The optional cost estimate is an owner-entered planning value, independent of actual job costs.

Existing services with a null price retain an explicit “Not set” value until edited. Missing optional prices, quantities and duration remain unknown. Changing a catalog price or name never changes existing `work_order_services` name and price snapshots.

## API and access

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/services` | Catalog with `q`, `status`, `minPrice`, `maxPrice`, `maxDuration`, `sort`, `page`, `pageSize` |
| POST | `/api/services` | Create; responds 201 with `{service}` and Location |
| GET | `/api/services/:id` | `{service, bundleComponents}` |
| PUT | `/api/services/:id` | Validated full catalog edit plus current `version` |
| DELETE | `/api/services/:id` | Body `{version}`; responds 204 |

Reads and writes resolve the configured owner on the server. Browser requests cannot choose a business, ID, currency, type or timestamps. Writes require same-origin JSON. Service payloads are bounded to 64 KiB. All responses use private/no-store caching. Validation returns field and material-row errors; database errors are sanitized. Missing records return 404, stale versions and referenced deletion return 409.

Search is accent-insensitive for Hungarian text and treats SQL wildcard characters literally. Filter values and sort keys are validated, SQL values are bound, and results are scoped to the resolved business. Page sizes range from 1 to 100, with 20 as the default.

## Migration and bundles

Apply `drizzle/0003_services_pricing.sql` after migrations 0000 through 0002. On an existing Phase 2 database apply only 0003. Earlier migrations and their journal entries are unchanged. The new migration adds version, cost estimate, type, catalog indexes and the `service_bundle_items` relationship table. It preserves existing service data.

The bundle foundation separates a bundle service from its single-service components, with quantities, business-scoped foreign keys and protected deletion. It prevents self-links, nested bundles, duplicate components and cross-business relationships. Read-only details display existing composition if a bundle is present. Creating/editing bundle composition and bundle pricing rules are later work; the current service API creates single services only. This phase adds no bundles automatically.

## Verification

The combined foundation, customer, vehicle and service suite passes locally: 84 tests. It covers persistence after reopening SQLite, additive migration, HUF/material validation, search/filter/sort/pagination, business boundaries, API access, conflicts, bundle constraints, protected deletion and preservation of historical job prices.

All 84 tests, locked dependency installation, TypeScript checking and the production Worker build also passed for source commit `04fdd8fe33b24d445bff68f25c7e45367be8186d` in [GitHub Actions](https://github.com/Jojolildog/Detailingdrive/actions/runs/43750374532). Browser QA and hosted D1 migration/application verification remain outstanding; source publication is separate from deploying the Site.
