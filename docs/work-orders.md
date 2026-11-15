# Phase 4 - Work orders

Work orders use the existing owner-protected, business-scoped D1 database. The catalog, customers and vehicles remain the sources for selections. No customers, services, jobs, timestamps or financial results are seeded.

## Workflow

- `/work-orders` lists real orders with search, job/payment filters, scheduled/newest sorting and pagination.
- `/work-orders/new` creates an order. Choose a customer, one of their vehicles, and 1–50 services. Customer contacts and vehicle information fill automatically from their records.
- `/work-orders/:id` displays contacts, vehicle, service snapshots, agreed price, dates, notes and both statuses.
- `/work-orders/:id/edit` edits the order and manages job/payment statuses.
- Delete through a confirmation dialog. Deletion removes the order's service snapshots while retaining customer, vehicle and catalog records. Usage, expenses and cost snapshots protect an order from deletion.

Customer pages link to their work-order list and creation form. Vehicle pages link to new and existing work orders; their history reads actual job/service snapshots. The creation route accepts `customerId` or `vehicleId` for server-validated prefilling. Changing the selected customer clears the vehicle selection. Searchable, paginated vehicle choices are restricted to that customer. The server and composite database foreign keys independently reject missing, mismatched and foreign-business relationships.

Forms preserve input on errors, warn about unsaved changes, and reject stale updates/deletes. The responsive interface follows the existing Hungarian/English and light/dark preferences. Links for creating missing vehicles or services open separately to preserve work-order form edits.

## Data contract

| Field | Meaning |
|---|---|
| `id` | Server-generated UUID |
| `customerId`, `vehicleId` | Required existing records in the owner's business; vehicle must belong to customer |
| `selectedServices` | Input array of `{serviceId}` for new selections; retained rows use `{serviceId, snapshotId}` |
| `scheduledDate` | Optional scheduled date/time |
| `startTime`, `finishTime` | Optional actual date/times; a finish requires a start and cannot precede it |
| `jobStatus` | `scheduled`, `in_progress`, `completed`, `cancelled` |
| `paymentStatus` | `unpaid`, `partial`, `paid` |
| `servicePrice` | Explicit agreed total, whole HUF from 0 to 100,000,000 |
| `notes` | Optional plain text, at most 10,000 characters |
| `createdAt`, `updatedAt`, `version` | Server-owned timestamps and concurrency version |

The API requires date/times with an explicit UTC offset or Z and normalizes them to UTC. The form displays and interprets Europe/Budapest time, handles overnight work, and rejects spring clock-change gaps. A newly entered repeated autumn time uses its first occurrence; unchanged stored instants retain their exact original value, including the second occurrence and fractional seconds.

Selecting services fills the agreed price for new orders until the owner edits it manually. “Use service total” explicitly restores that behavior. The agreed total can differ from the sum of selected services. Only active services with a whole-HUF catalog price can be newly selected. Existing selections retain their server-owned name and price snapshots, including when their catalog entry is renamed, repriced or deactivated. API responses contain snapshot `id`, `serviceId`, `serviceName` and `servicePrice`; browser requests cannot invent snapshot names or prices. Snapshot references must belong to that work order. A saved bundle is selected as a priced catalog service; bundle editing and automatic component expansion remain future work.

Job and payment statuses are independent and editable. Changing either does not fabricate start/finish times, payment amounts, cost calculations or inventory deductions. This phase tracks payment status, not receipts or payment transactions. Historical `refunded` records from the foundation remain readable and can retain that state while other fields are edited; no new refund workflow is introduced. Legacy service snapshots with a null catalog link can also be retained by their snapshot ID.

## API

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/work-orders` | Search/list/filter/page |
| POST | `/api/work-orders` | Create; 201 `{workOrder}` with Location |
| GET | `/api/work-orders/:id` | `{workOrder, customer, vehicle}` |
| PUT | `/api/work-orders/:id` | Full validated edit with `version` |
| DELETE | `/api/work-orders/:id` | Body `{version}`; 204 |

List parameters are `q`, `customerId`, `vehicleId`, `jobStatus`, `paymentStatus`, `sort`, `page` and `pageSize`. Search matches customer names, vehicle manufacturer/model/registration and saved service names. Hungarian accents are folded and SQL wildcards are literal. Sort keys are allowlisted and all values are bound. Pages default to 20 records, with sizes up to 100.

Every API resolves owner access before data operations. Same-origin JSON mutations have a 64 KiB bound, field whitelisting and sanitized errors. Responses are private/no-store. Invalid relationships/selections return 422, missing orders 404, and stale versions/protected deletion 409.

Parent and service mutations run in a D1 atomic batch. A unique write token gates child updates when a conditional version update loses a race. Deletion gates service removal on the expected parent version; foreign-key failures roll the whole deletion back. Grouped service writes and chunked list hydration stay within prepared-statement parameter bounds.

## Migration and verification

Apply `drizzle/0004_work_orders.sql` after migrations 0000–0003. Existing Phase 3 databases need only 0004. It adds concurrency metadata and query indexes without rewriting prior migrations or existing orders, service snapshots, prices or statuses. The schema still has 15 tables.

All 113 combined tests pass locally, including 29 work-order tests covering persistence, migration, relationships, snapshots, statuses, UTC/Budapest conversion, search/pagination, atomic rollback, competing writers, protected deletion, full selection/page limits and authenticated APIs. TypeScript and production build results will be recorded after GitHub Actions completes. Live deployment, hosted D1 verification and browser QA remain pending because the current execution environment cannot reach the Sites source host.
