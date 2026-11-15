import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from './helpers/d1.mjs';
import { resolveOwnerBusiness } from '../server/business.ts';
import { createCustomer, deleteCustomer } from '../server/customers.ts';
import { createVehicle, getVehicle, getVehicleDetail, deleteVehicle } from '../server/vehicles.ts';
import { createService, updateService, getService } from '../server/services.ts';
import { createWorkOrder, updateWorkOrder, getWorkOrder, getWorkOrderDetail, listWorkOrders, deleteWorkOrder } from '../server/work-orders.ts';
import { workOrdersGet, workOrderGet, workOrderWrite, workOrderDelete } from '../server/work-orders-api.ts';
import { validateWorkOrder, parseWorkOrderQuery, workOrderListPath, timestamp, toBudapestInput, fromBudapestInput, isWorkOrder, jobStatuses, paymentStatuses } from '../lib/work-orders.ts';
import { workOrderApiErrors, workOrderErrorText } from '../components/work-orders/api.ts';
import { ApplicationError } from '../server/errors.ts';
import { hu } from '../lib/i18n/hu.ts';
const base = { scheduledDate: '2026-12-01T09:00:00Z', startTime: null, finishTime: null, jobStatus: 'scheduled', paymentStatus: 'unpaid', servicePrice: 25000, notes: 'Test notes' };
const query = { query: '', customerId: '', vehicleId: '', jobStatus: '', paymentStatus: '', sort: 'scheduled_asc', page: 1, pageSize: 20 };
async function setup(filename) {
  const db = createDatabase(filename); const business = await resolveOwnerBusiness(db, { userId: 'owner', email: 'owner@example.test' }, { userId: 'owner' });
  const customer = await createCustomer(db, business.id, { fullName: 'Árvíztűrő test', phoneNumber: '+361234567', email: 'customer@example.test', notes: '' });
  const other = await createCustomer(db, business.id, { fullName: 'Other test', phoneNumber: '+369876543', email: null, notes: '' });
  const vehicleInput = { customerId: customer.id, manufacturer: 'Test make', model: 'Test model', productionYear: 2020, registrationNumber: 'TEST-123', color: 'Blue', sizeCategory: 'medium', notes: '' };
  const vehicle = await createVehicle(db, business.id, vehicleInput); const otherVehicle = await createVehicle(db, business.id, { ...vehicleInput, customerId: other.id });
  const serviceInput = { serviceName: 'Belső tisztítás', description: '', defaultPrice: 25000, expectedDuration: 60, expectedMaterials: [], optionalCostEstimate: null, active: true };
  const service = await createService(db, business.id, serviceInput); const secondService = await createService(db, business.id, { ...serviceInput, serviceName: 'Other service', defaultPrice: 10000 });
  return { db, business, customer, other, vehicle, otherVehicle, service, secondService, serviceInput, input: { ...base, customerId: customer.id, vehicleId: vehicle.id, selectedServices: [{ serviceId: service.id }] }, resolve: async () => ({ db, business }) };
}
function editInput(order, extra = {}) { return { ...base, customerId: order.customerId, vehicleId: order.vehicleId, selectedServices: order.selectedServices.map(row => ({ serviceId: row.serviceId, snapshotId: row.id })), scheduledDate: order.scheduledDate, startTime: order.startTime, finishTime: order.finishTime, jobStatus: order.jobStatus, paymentStatus: order.paymentStatus, servicePrice: order.servicePrice, notes: order.notes, ...extra }; }
function request(method, body, origin = 'https://detailflow.example') { return new Request('https://detailflow.example/api/work-orders', { method, headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }); }
function readRequest(suffix = '') { return new Request(`https://detailflow.example/api/work-orders${suffix}`); }
function boundParameterLimit(db) {
  const prepare = db.prepare.bind(db); db.prepare = sql => { const statement = prepare(sql); return { ...statement, bind(...values) { assert.ok(values.length <= 100, `Too many D1 parameters: ${values.length}`); return statement.bind(...values); } }; };
}

test('work order validation requires existing-record IDs, services and an explicit whole-HUF price', () => {
  const missing = validateWorkOrder({}); assert.equal(missing.success, false); assert.equal(missing.errors.customerId, 'customerRequired'); assert.equal(missing.errors.vehicleId, 'vehicleRequired'); assert.equal(missing.errors.selectedServices, 'servicesRequired'); assert.equal(missing.errors.servicePrice, 'priceRequired');
  const input = { ...base, customerId: randomUUID(), vehicleId: randomUUID(), selectedServices: [{ serviceId: randomUUID() }] };
  assert.equal(validateWorkOrder(input).success, true);
  for (const extra of [{ servicePrice: -1 }, { servicePrice: 1.5 }, { servicePrice: '2000' }, { servicePrice: 100000001 }, { notes: 'x'.repeat(10001) }, { jobStatus: 'unknown' }, { paymentStatus: 'refunded' }, { businessId: randomUUID() }, { id: randomUUID() }, { createdAt: '2020' }, { paidAmount: 100 }]) assert.equal(validateWorkOrder({ ...input, ...extra }).success, false);
  assert.equal(validateWorkOrder({ ...input, version: 1 }).success, false); assert.equal(validateWorkOrder(input, true).errors.form, 'invalidVersion'); assert.equal(validateWorkOrder({ ...input, servicePrice: 0, version: 1 }, true).success, true);
});
test('service selection rejects duplicates, forged snapshot data and invalid legacy references', () => {
  const input = { ...base, customerId: randomUUID(), vehicleId: randomUUID() }; const serviceId = randomUUID(); const snapshotId = randomUUID();
  for (const selectedServices of [[], Array(51).fill({ serviceId }), [serviceId], [{ serviceId, name: 'Forged', price: 0 }], [{ serviceId }, { serviceId }], [{ serviceId: null }], [{ serviceId, snapshotId }]]) assert.equal(validateWorkOrder({ ...input, selectedServices }).success, false);
  assert.equal(validateWorkOrder({ ...input, selectedServices: [{ serviceId: null, snapshotId }], version: 1 }, true).success, true);
  assert.equal(validateWorkOrder({ ...input, selectedServices: [{ serviceId, snapshotId }, { serviceId: randomUUID(), snapshotId }], version: 1 }, true).success, false);
});
test('timestamps are strict, normalized to UTC and validate actual-time ordering', () => {
  assert.equal(timestamp('2026-12-01T10:00:00+01:00'), '2026-12-01T09:00:00.000Z');
  for (const date of ['2026-02-30T10:00:00Z', '2026-13-01T10:00Z', '2026-12-01T24:00Z', '2026-12-01T10:00', '2026-12-01', '2026-12-01T10:00+15:00']) assert.equal(timestamp(date), undefined);
  const input = { ...base, customerId: randomUUID(), vehicleId: randomUUID(), selectedServices: [{ serviceId: randomUUID() }] };
  assert.equal(validateWorkOrder({ ...input, finishTime: base.scheduledDate }).errors.finishTime, 'invalidTimeRange');
  assert.equal(validateWorkOrder({ ...input, startTime: '2026-12-02T00:00Z', finishTime: '2026-12-01T23:59Z' }).errors.finishTime, 'invalidTimeRange');
  assert.equal(validateWorkOrder({ ...input, startTime: '2026-12-01T23:00Z', finishTime: '2026-12-02T01:00Z' }).success, true);
});
test('Budapest input handles winter, summer, overnight dates and DST gaps/overlaps', () => {
  assert.equal(toBudapestInput('2026-12-01T09:00:00Z'), '2026-12-01T10:00:00'); assert.equal(fromBudapestInput('2026-12-01T10:00'), '2026-12-01T09:00:00.000Z');
  assert.equal(fromBudapestInput('2026-07-01T10:00:00'), '2026-07-01T08:00:00.000Z'); assert.equal(toBudapestInput('2026-12-01T23:30:00Z'), '2026-12-02T00:30:00');
  assert.equal(fromBudapestInput('2026-03-29T02:30'), undefined); assert.equal(fromBudapestInput('2026-10-25T02:30'), '2026-10-25T00:30:00.000Z'); assert.equal(fromBudapestInput(''), null);
});
test('work order queries validate filters and preserve them in paginated URLs', () => {
  assert.deepEqual(parseWorkOrderQuery(new URLSearchParams()), query);
  for (const suffix of ['customerId=invalid', 'vehicleId=invalid', 'jobStatus=unknown', 'paymentStatus=unknown', 'sort=invalid', 'page=0', 'page=1.5', 'pageSize=101', `q=${'x'.repeat(201)}`]) assert.equal(parseWorkOrderQuery(new URLSearchParams(suffix)), null);
  const input = { ...query, customerId: randomUUID(), vehicleId: randomUUID(), jobStatus: 'completed', paymentStatus: 'partial', query: 'A & B', page: 2, pageSize: 10, sort: 'created_desc' };
  assert.deepEqual(parseWorkOrderQuery(new URL(workOrderListPath(input), 'https://detailflow.example').searchParams), input);
});
test('work order CRUD persists every field and retains customer, vehicle and catalog records', async () => {
  const f = await setup(); try {
    assert.equal((await listWorkOrders(f.db, f.business.id, query)).total, 0);
    const order = await createWorkOrder(f.db, f.business.id, f.input); assert.equal(isWorkOrder(order), true); assert.equal(order.selectedServices[0].serviceName, f.service.serviceName); assert.equal(order.selectedServices[0].servicePrice, 25000);
    const edited = await updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { notes: 'Edited', servicePrice: 22000, startTime: '2026-12-01T09:15:00Z', finishTime: '2026-12-01T11:00:00Z', jobStatus: 'completed', paymentStatus: 'paid' }), 1);
    assert.equal(edited.version, 2); assert.equal(edited.createdAt, order.createdAt); assert.equal(edited.servicePrice, 22000); assert.equal(edited.notes, 'Edited'); assert.equal(edited.finishTime, '2026-12-01T11:00:00Z');
    const detail = await getWorkOrderDetail(f.db, f.business.id, order.id); assert.equal(detail.customer.phoneNumber, f.customer.phoneNumber); assert.equal(detail.vehicle.id, f.vehicle.id);
    await deleteWorkOrder(f.db, f.business.id, order.id, 2); await assert.rejects(getWorkOrder(f.db, f.business.id, order.id), { status: 404 });
    assert.equal((await getVehicle(f.db, f.business.id, f.vehicle.id)).id, f.vehicle.id); assert.equal((await getService(f.db, f.business.id, f.service.id)).id, f.service.id); assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS count FROM work_order_services').get().count, 0);
  } finally { f.db.close(); }
});
test('work orders prevent mismatched, missing and foreign-business relationships', async () => {
  const f = await setup(); try {
    for (const extra of [{ vehicleId: f.otherVehicle.id }, { customerId: randomUUID() }, { vehicleId: randomUUID() }]) await assert.rejects(createWorkOrder(f.db, f.business.id, { ...f.input, ...extra }), { status: 422, code: 'invalidRelationship' });
    await assert.rejects(createWorkOrder(f.db, randomUUID(), f.input), { status: 422 });
    const order = await createWorkOrder(f.db, f.business.id, f.input);
    await assert.rejects(updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { vehicleId: f.otherVehicle.id }), 1), { status: 422 });
    assert.equal((await getWorkOrder(f.db, f.business.id, order.id)).vehicleId, f.vehicle.id);
    assert.throws(() => f.db.sqlite.prepare('INSERT INTO work_orders (id, business_id, customer_id, vehicle_id) VALUES (?, ?, ?, ?)').run(randomUUID(), f.business.id, f.customer.id, f.otherVehicle.id), /FOREIGN KEY/);
  } finally { f.db.close(); }
});
test('work order reads, mutations, lists and snapshots respect business boundaries', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); const foreign = randomUUID();
    for (const action of [() => getWorkOrder(f.db, foreign, order.id), () => getWorkOrderDetail(f.db, foreign, order.id), () => updateWorkOrder(f.db, foreign, order.id, editInput(order), 1), () => deleteWorkOrder(f.db, foreign, order.id, 1)]) await assert.rejects(action(), { status: 404 });
    assert.equal((await listWorkOrders(f.db, foreign, query)).total, 0); await assert.rejects(getWorkOrder(f.db, f.business.id, 'invalid'), { status: 404 });
  } finally { f.db.close(); }
});
test('only active priced services can be newly selected; forged snapshots are rejected', async () => {
  const f = await setup(); try {
    await updateService(f.db, f.business.id, f.service.id, { ...f.serviceInput, active: false }, 1);
    for (const serviceId of [f.service.id, randomUUID()]) await assert.rejects(createWorkOrder(f.db, f.business.id, { ...f.input, selectedServices: [{ serviceId }] }), { code: 'serviceUnavailable' });
    f.db.sqlite.prepare('UPDATE services SET active = 1, default_price_huf = NULL WHERE id = ?').run(f.service.id); await assert.rejects(createWorkOrder(f.db, f.business.id, f.input), { code: 'serviceUnavailable' });
    const order = await createWorkOrder(f.db, f.business.id, { ...f.input, selectedServices: [{ serviceId: f.secondService.id }] });
    await assert.rejects(updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { selectedServices: [{ serviceId: f.secondService.id, snapshotId: randomUUID() }] }), 1), { code: 'invalidServices' });
  } finally { f.db.close(); }
});
test('saved service names and prices remain stable through catalog edits and status changes', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); await updateService(f.db, f.business.id, f.service.id, { ...f.serviceInput, serviceName: 'New catalog name', defaultPrice: 50000, active: false }, 1);
    const edited = await updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { jobStatus: 'in_progress', paymentStatus: 'partial', servicePrice: 23000 }), 1);
    assert.deepEqual(edited.selectedServices, order.selectedServices); assert.equal(edited.servicePrice, 23000); assert.equal(edited.startTime, null); assert.equal(edited.finishTime, null);
    const added = await updateWorkOrder(f.db, f.business.id, order.id, editInput(edited, { selectedServices: [...editInput(edited).selectedServices, { serviceId: f.secondService.id }] }), 2);
    assert.equal(added.selectedServices.length, 2); assert.equal(added.selectedServices.find(row => row.serviceId === f.service.id).serviceName, f.service.serviceName);
  } finally { f.db.close(); }
});
test('job and payment statuses can be managed independently without invented payments or times', async () => {
  const f = await setup(); try {
    let order = await createWorkOrder(f.db, f.business.id, f.input);
    for (const jobStatus of jobStatuses) for (const paymentStatus of paymentStatuses) { order = await updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { jobStatus, paymentStatus }), order.version); assert.equal(order.jobStatus, jobStatus); assert.equal(order.paymentStatus, paymentStatus); assert.equal(order.startTime, null); assert.equal(order.finishTime, null); }
  } finally { f.db.close(); }
});
test('stale edits and deletes preserve newer work-order data and selections', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); await updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { notes: 'Newer' }), 1);
    await assert.rejects(updateWorkOrder(f.db, f.business.id, order.id, editInput(order), 1), { status: 409 }); await assert.rejects(deleteWorkOrder(f.db, f.business.id, order.id, 1), { status: 409 }); assert.equal((await getWorkOrder(f.db, f.business.id, order.id)).notes, 'Newer');
  } finally { f.db.close(); }
});
test('a competing update between read and batch cannot mutate another writer’s service selections', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); const batch = f.db.batch.bind(f.db);
    f.db.batch = async statements => { f.db.sqlite.prepare('UPDATE work_orders SET version = version + 1, write_token = ?, notes = ? WHERE id = ?').run(randomUUID(), 'Winning update', order.id); return batch(statements); };
    await assert.rejects(updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { selectedServices: [{ serviceId: f.secondService.id }] }), 1), { status: 409 });
    const saved = await getWorkOrder(f.db, f.business.id, order.id); assert.equal(saved.notes, 'Winning update'); assert.deepEqual(saved.selectedServices, order.selectedServices);
  } finally { f.db.close(); }
});
test('a competing update before deletion preserves every saved service row', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); const batch = f.db.batch.bind(f.db);
    f.db.batch = async statements => { f.db.sqlite.prepare('UPDATE work_orders SET version = version + 1 WHERE id = ?').run(order.id); return batch(statements); };
    await assert.rejects(deleteWorkOrder(f.db, f.business.id, order.id, 1), { status: 409 }); assert.deepEqual((await getWorkOrder(f.db, f.business.id, order.id)).selectedServices, order.selectedServices);
  } finally { f.db.close(); }
});
test('atomic creation rolls back the work order if a selected-service insert fails', async () => {
  const f = await setup(); try {
    f.db.sqlite.exec("CREATE TRIGGER reject_test_service BEFORE INSERT ON work_order_services BEGIN SELECT RAISE(ABORT, 'test insertion failure'); END");
    await assert.rejects(createWorkOrder(f.db, f.business.id, f.input), /test insertion failure/); assert.equal((await listWorkOrders(f.db, f.business.id, query)).total, 0); assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS count FROM work_order_services').get().count, 0);
  } finally { f.db.close(); }
});
test('atomic edit rolls back parent and service removals when adding a new line fails', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); f.db.sqlite.exec("CREATE TRIGGER reject_test_service BEFORE INSERT ON work_order_services BEGIN SELECT RAISE(ABORT, 'test insertion failure'); END");
    await assert.rejects(updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { notes: 'Should roll back', selectedServices: [{ serviceId: f.secondService.id }] }), 1), /test insertion failure/); assert.deepEqual(await getWorkOrder(f.db, f.business.id, order.id), order);
  } finally { f.db.close(); }
});
test('protected deletion rolls back removed service snapshots when linked expenses exist', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); f.db.sqlite.prepare('INSERT INTO work_order_expenses (id, business_id, work_order_id, category, description, amount_huf) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), f.business.id, order.id, 'additional', 'Test expense', 1000);
    await assert.rejects(deleteWorkOrder(f.db, f.business.id, order.id, 1), { status: 409, code: 'workOrderHasRecords' }); assert.deepEqual(await getWorkOrder(f.db, f.business.id, order.id), order);
  } finally { f.db.close(); }
});
test('work orders are reflected in real vehicle history and protect customer/vehicle deletion', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input); const history = (await getVehicleDetail(f.db, f.business.id, f.vehicle.id)).serviceHistory; assert.equal(history.total, 1); assert.equal(history.items[0].id, order.id); assert.deepEqual(history.items[0].services, [f.service.serviceName]);
    await assert.rejects(deleteVehicle(f.db, f.business.id, f.vehicle.id, 1), { status: 409 }); await assert.rejects(deleteCustomer(f.db, f.business.id, f.customer.id, 1), { status: 409 });
    await deleteWorkOrder(f.db, f.business.id, order.id, 1); assert.equal((await getVehicleDetail(f.db, f.business.id, f.vehicle.id)).serviceHistory.total, 0);
  } finally { f.db.close(); }
});
test('work order search folds accents and matches customer, vehicle, registration and saved services', async () => {
  const f = await setup(); try {
    const order = await createWorkOrder(f.db, f.business.id, f.input);
    for (const text of ['arvizturo', 'test make', 'TEST-123', 'belso tisztitas']) assert.equal((await listWorkOrders(f.db, f.business.id, { ...query, query: text })).items[0].id, order.id);
    assert.equal((await listWorkOrders(f.db, f.business.id, { ...query, query: '%' })).total, 0); assert.equal((await listWorkOrders(f.db, f.business.id, { ...query, query: "' OR 1=1 --" })).total, 0);
  } finally { f.db.close(); }
});
test('work-order filters, scheduled sorting and pagination compose without losing business scope', async () => {
  const f = await setup(); try {
    await createWorkOrder(f.db, f.business.id, { ...f.input, scheduledDate: null }); const early = await createWorkOrder(f.db, f.business.id, { ...f.input, scheduledDate: '2026-01-01T09:00:00Z', jobStatus: 'completed', paymentStatus: 'partial' });
    await createWorkOrder(f.db, f.business.id, { ...f.input, customerId: f.other.id, vehicleId: f.otherVehicle.id, scheduledDate: '2026-06-01T09:00:00Z' });
    assert.equal((await listWorkOrders(f.db, f.business.id, query)).items[0].id, early.id);
    assert.equal((await listWorkOrders(f.db, f.business.id, { ...query, customerId: f.customer.id })).total, 2); assert.equal((await listWorkOrders(f.db, f.business.id, { ...query, vehicleId: f.otherVehicle.id })).total, 1);
    assert.equal((await listWorkOrders(f.db, f.business.id, { ...query, jobStatus: 'completed', paymentStatus: 'partial' })).total, 1);
    const result = await listWorkOrders(f.db, f.business.id, { ...query, pageSize: 2, page: 99 }); assert.equal(result.page, 2); assert.equal(result.items.length, 1); assert.equal(result.items[0].scheduledDate, null);
  } finally { f.db.close(); }
});
test('work orders and their saved prices survive reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'detailflow-work-')); const filename = join(directory, 'work.sqlite'); const f = await setup(filename); const order = await createWorkOrder(f.db, f.business.id, f.input); f.db.close(); const db = createDatabase(filename, false);
  try { assert.deepEqual(await getWorkOrder(db, f.business.id, order.id), order); } finally { db.close(); unlinkSync(filename); rmdirSync(directory); }
});
test('fifty-service work orders save and replace all selections within D1 parameter bounds', async () => {
  const f = await setup(); try {
    const services = [f.service, f.secondService]; for (let i = 0; i < 48; i++) services.push(await createService(f.db, f.business.id, { ...f.serviceInput, serviceName: `Test service ${i}`, defaultPrice: 1 }));
    boundParameterLimit(f.db); const order = await createWorkOrder(f.db, f.business.id, { ...f.input, selectedServices: services.map(service => ({ serviceId: service.id })) }); assert.equal(order.selectedServices.length, 50);
    const edited = await updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { selectedServices: [{ serviceId: f.secondService.id }] }), 1); assert.equal(edited.selectedServices.length, 1); assert.equal(edited.selectedServices[0].serviceId, f.secondService.id);
  } finally { f.db.close(); }
});
test('a full hundred-order page hydrates service snapshots within D1 parameter bounds', async () => {
  const f = await setup(); try {
    const first = await createWorkOrder(f.db, f.business.id, f.input);
    for (let i = 0; i < 99; i++) f.db.sqlite.prepare('INSERT INTO work_orders (id, business_id, customer_id, vehicle_id) VALUES (?, ?, ?, ?)').run(randomUUID(), f.business.id, f.customer.id, f.vehicle.id);
    boundParameterLimit(f.db); const result = await listWorkOrders(f.db, f.business.id, { ...query, pageSize: 100 }); assert.equal(result.items.length, 100); assert.equal(result.items.find(row => row.id === first.id).selectedServices.length, 1);
  } finally { f.db.close(); }
});
test('Phase 4 migration preserves legacy work, prices, refund status and null-service snapshots', async () => {
  const db = createDatabase(':memory:', false); try {
    for (const path of ['0000_foundation.sql', '0001_customer_management.sql', '0002_vehicle_management.sql', '0003_services_pricing.sql']) db.sqlite.exec(readFileSync(new URL(`../drizzle/${path}`, import.meta.url), 'utf8'));
    const business = randomUUID(); const customer = randomUUID(); const vehicle = randomUUID(); const id = randomUUID(); const snapshot = randomUUID();
    db.sqlite.prepare('INSERT INTO businesses (id, owner_user_id) VALUES (?, ?)').run(business, 'legacy'); db.sqlite.prepare('INSERT INTO customers (id, business_id, full_name, phone_number) VALUES (?, ?, ?, ?)').run(customer, business, 'Legacy', '1234567'); db.sqlite.prepare('INSERT INTO vehicles (id, business_id, customer_id, manufacturer, model) VALUES (?, ?, ?, ?, ?)').run(vehicle, business, customer, 'Legacy', 'Model');
    db.sqlite.prepare("INSERT INTO work_orders (id, business_id, customer_id, vehicle_id, payment_status, price_huf) VALUES (?, ?, ?, ?, 'refunded', 12345)").run(id, business, customer, vehicle); db.sqlite.prepare('INSERT INTO work_order_services (id, business_id, work_order_id, name_snapshot, price_huf) VALUES (?, ?, ?, ?, ?)').run(snapshot, business, id, 'Legacy service', 12000);
    const before = db.sqlite.prepare('SELECT * FROM work_orders').get(); db.sqlite.exec(readFileSync(new URL('../drizzle/0004_work_orders.sql', import.meta.url), 'utf8'));
    const order = await getWorkOrder(db, business, id); assert.equal(order.version, 1); assert.equal(order.createdAt, before.created_at); assert.equal(order.servicePrice, 12345); assert.equal(order.paymentStatus, 'refunded'); assert.equal(order.selectedServices[0].serviceId, null);
    const edited = await updateWorkOrder(db, business, id, editInput(order, { notes: 'Keep legacy data' }), 1); assert.equal(edited.paymentStatus, 'refunded'); assert.deepEqual(edited.selectedServices, order.selectedServices);
  } finally { db.close(); }
});
test('new work orders cannot enter legacy refund status through create or edit', async () => {
  const f = await setup(); try {
    await assert.rejects(createWorkOrder(f.db, f.business.id, { ...f.input, paymentStatus: 'refunded' }), { code: 'invalidPaymentStatus' }); const order = await createWorkOrder(f.db, f.business.id, f.input);
    await assert.rejects(updateWorkOrder(f.db, f.business.id, order.id, editInput(order, { paymentStatus: 'refunded' }), 1), { code: 'invalidPaymentStatus' });
  } finally { f.db.close(); }
});
test('work-order API completes authenticated CRUD with private responses and relation auto-fill', async () => {
  const f = await setup(); try {
    const created = await workOrderWrite(request('POST', f.input), f.resolve); assert.equal(created.status, 201); const { workOrder } = await created.json(); assert.equal(created.headers.get('location'), `/work-orders/${workOrder.id}`); assert.match(created.headers.get('cache-control'), /no-store/);
    assert.equal((await (await workOrdersGet(readRequest('?jobStatus=scheduled'), f.resolve)).json()).items[0].id, workOrder.id); const detail = await (await workOrderGet(workOrder.id, f.resolve)).json(); assert.equal(detail.customer.phoneNumber, f.customer.phoneNumber); assert.equal(detail.vehicle.customerId, f.customer.id);
    assert.equal((await workOrderWrite(request('PUT', { ...editInput(workOrder, { paymentStatus: 'paid' }), version: 1 }), f.resolve, workOrder.id)).status, 200);
    assert.equal((await workOrderDelete(request('DELETE', { version: 2 }), workOrder.id, f.resolve)).status, 204); assert.equal((await workOrderGet(workOrder.id, f.resolve)).status, 404);
  } finally { f.db.close(); }
});
test('work-order APIs require owner access and reject foreign-origin writes before resolving context', async () => {
  const denied = async () => { throw new ApplicationError(401, 'unauthorized'); };
  assert.equal((await workOrdersGet(readRequest(), denied)).status, 401); assert.equal((await workOrderGet(randomUUID(), denied)).status, 401); assert.equal((await workOrderWrite(request('POST', {}), denied)).status, 401); assert.equal((await workOrderDelete(request('DELETE', { version: 1 }), randomUUID(), denied)).status, 401);
  let called = false; const resolve = async () => { called = true; throw new Error('Not allowed'); }; assert.equal((await workOrderWrite(request('POST', {}, 'https://other.example'), resolve)).status, 403); assert.equal((await workOrderDelete(request('DELETE', { version: 1 }, 'https://other.example'), randomUUID(), resolve)).status, 403); assert.equal(called, false);
});
test('work-order API rejects invalid fields, relationships, malformed/large JSON and query bounds', async () => {
  const f = await setup(); try {
    for (const extra of [{ businessId: f.business.id }, { servicePrice: '' }, { vehicleId: f.otherVehicle.id }, { selectedServices: [{ serviceId: randomUUID() }] }]) assert.equal((await workOrderWrite(request('POST', { ...f.input, ...extra }), f.resolve)).status, 422);
    assert.equal((await workOrderWrite(request('POST', '{invalid'), f.resolve)).status, 400); assert.equal((await workOrderWrite(request('POST', 'x'.repeat(65537)), f.resolve)).status, 413); assert.equal((await workOrdersGet(readRequest('?jobStatus=unknown'), f.resolve)).status, 400); assert.equal((await workOrderDelete(request('DELETE', { version: 1, customerId: f.customer.id }), randomUUID(), f.resolve)).status, 422);
  } finally { f.db.close(); }
});
test('work-order errors sanitize database details and reject unknown client response fields', async () => {
  const response = await workOrdersGet(readRequest(), async () => { throw new Error('secret database detail'); }); assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'unavailable' });
  assert.equal(workOrderApiErrors(null).form, 'unexpected'); assert.deepEqual(workOrderApiErrors({ error: 'invalidInput', fields: { businessId: 'unsafe', notes: 'invalidNotes' } }), { notes: 'invalidNotes', form: 'invalidInput' }); assert.equal(workOrderErrorText(hu, 'unknown'), hu.workOrderErrors.unexpected); assert.equal(isWorkOrder({}), false);
});
