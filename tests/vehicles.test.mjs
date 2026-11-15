import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from './helpers/d1.mjs';
import { resolveOwnerBusiness } from '../server/business.ts';
import { createCustomer, getCustomerDetail, deleteCustomer } from '../server/customers.ts';
import { createVehicle, getVehicle, getVehicleDetail, updateVehicle, deleteVehicle, listVehicles, getVehicleManufacturers } from '../server/vehicles.ts';
import { vehicleWrite, vehicleGet, vehicleDelete, vehiclesGet } from '../server/vehicles-api.ts';
import { emptyVehicle, validateVehicle, parseVehicleQuery, vehicleListPath, parseHistoryPage, modelYearLimit, isVehicle } from '../lib/vehicles.ts';
import { ApplicationError } from '../server/errors.ts';
import { vehicleApiErrors, vehicleErrorText } from '../components/vehicles/api.ts';
import { hu } from '../lib/i18n/hu.ts';

const vehicleInput = { ...emptyVehicle, manufacturer: 'Example Make', model: 'Example Model', productionYear: 2020, registrationNumber: 'TEST-123', color: 'Blue', notes: 'Test notes' };
const query = { query: '', customerId: '', manufacturer: '', sizeCategory: '', productionYear: null, sort: 'vehicle_asc', page: 1, pageSize: 20 };
async function setup(filename) {
  const db = createDatabase(filename); const identity = { userId: 'owner', email: 'owner@example.test' };
  const business = await resolveOwnerBusiness(db, identity, { userId: 'owner' });
  const owner = await createCustomer(db, business.id, { fullName: 'Test Customer A', phoneNumber: '+361234567', email: null, notes: '' });
  const other = await createCustomer(db, business.id, { fullName: 'Test Customer B', phoneNumber: '+369876543', email: null, notes: '' });
  return { db, business, owner, other, input: { ...vehicleInput, customerId: owner.id }, resolve: async () => ({ db, business }) };
}
function request(method, body, origin = 'https://detailflow.example') { return new Request('https://detailflow.example/api/vehicles', { method, headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }); }
function readRequest(suffix = '') { return new Request(`https://detailflow.example/api/vehicles${suffix}`); }
function addJob(db, businessId, customerId, vehicleId, date = '2026-01-01T10:00:00Z', status = 'completed') {
  const id = randomUUID();
  db.sqlite.prepare('INSERT INTO work_orders (id, business_id, customer_id, vehicle_id, job_status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, businessId, customerId, vehicleId, status, date);
  return id;
}

test('validation requires an owner, manufacturer and model and normalizes optional values', () => {
  const missing = validateVehicle(emptyVehicle); assert.equal(missing.success, false);
  assert.equal(missing.errors.customerId, 'customerRequired'); assert.equal(missing.errors.manufacturer, 'manufacturerRequired'); assert.equal(missing.errors.model, 'modelRequired');
  const parsed = validateVehicle({ customerId: randomUUID(), manufacturer: '  Test  ', model: '  Model  ', sizeCategory: 'small', registrationNumber: ' abcd-123 ', color: null });
  assert.equal(parsed.success, true); assert.equal(parsed.data.registrationNumber, 'ABCD-123'); assert.equal(parsed.data.color, ''); assert.equal(parsed.data.productionYear, null); assert.equal(parsed.data.notes, '');
});
test('validation rejects invalid years, sizes, lengths, controls and server-managed fields', () => {
  const input = { ...vehicleInput, customerId: randomUUID() };
  for (const productionYear of [1885, modelYearLimit() + 1, 2020.5, '2020', NaN, Infinity]) assert.equal(validateVehicle({ ...input, productionYear }).success, false);
  for (const invalid of [{ sizeCategory: 'tiny' }, { color: 'x'.repeat(81) }, { manufacturer: 'x'.repeat(101) }, { model: 'x'.repeat(121) }, { registrationNumber: 'x'.repeat(21) }, { registrationNumber: 'AB\n123' }, { notes: 'x'.repeat(10001) }, { customerId: 'bad' }, { businessId: randomUUID() }, { id: randomUUID() }, { createdAt: '2020-01-01' }]) assert.equal(validateVehicle({ ...input, ...invalid }).success, false);
  assert.equal(validateVehicle({ ...input, version: 1 }).success, false); assert.equal(validateVehicle({ ...input, version: 1 }, true).success, true);
});
test('query validation and URL building preserve filters and bound pagination', () => {
  assert.deepEqual(parseVehicleQuery(new URLSearchParams()), query);
  for (const params of ['customerId=bad', 'sizeCategory=tiny', 'productionYear=123', 'productionYear=2020.5', 'page=0', 'pageSize=101', 'sort=manufacturer%3BDROP', `q=${'x'.repeat(201)}`]) assert.equal(parseVehicleQuery(new URLSearchParams(params)), null);
  const id = randomUUID(); const input = { ...query, customerId: id, manufacturer: 'A & B', sizeCategory: 'small', productionYear: 2020, page: 2, pageSize: 10 };
  const url = vehicleListPath(input); assert.deepEqual(parseVehicleQuery(new URL(url, 'https://detailflow.example').searchParams), input);
  assert.equal(parseHistoryPage(new URLSearchParams('historyPage=2')), 2); assert.equal(parseHistoryPage(new URLSearchParams('historyPage=-1')), null);
});
test('vehicle CRUD persists all fields and preserves creation time', async () => {
  const f = await setup();
  try {
    const vehicle = await createVehicle(f.db, f.business.id, f.input); assert.equal(isVehicle(vehicle), true);
    const updated = await updateVehicle(f.db, f.business.id, vehicle.id, { ...f.input, model: 'Edited model', notes: 'Edited notes' }, 1);
    assert.equal(updated.version, 2); assert.equal(updated.createdAt, vehicle.createdAt); assert.equal(updated.notes, 'Edited notes');
    assert.equal((await getVehicle(f.db, f.business.id, vehicle.id)).model, 'Edited model');
    await deleteVehicle(f.db, f.business.id, vehicle.id, 2); await assert.rejects(getVehicle(f.db, f.business.id, vehicle.id), { status: 404 });
    assert.equal((await getCustomerDetail(f.db, f.business.id, f.owner.id)).customer.id, f.owner.id);
  } finally { f.db.close(); }
});
test('vehicles cannot be created with a missing or foreign-business customer', async () => {
  const f = await setup();
  try {
    await assert.rejects(createVehicle(f.db, f.business.id, { ...f.input, customerId: randomUUID() }), { status: 422, code: 'vehicleCustomerInvalid' });
    await assert.rejects(createVehicle(f.db, randomUUID(), f.input), { status: 422, code: 'vehicleCustomerInvalid' });
    assert.equal((await listVehicles(f.db, f.business.id, query)).total, 0);
    assert.throws(() => f.db.sqlite.prepare('INSERT INTO vehicles (id, business_id, customer_id, manufacturer, model) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), f.business.id, randomUUID(), 'Test', 'Model'), /FOREIGN KEY/);
  } finally { f.db.close(); }
});
test('customer pages reflect owned vehicles and ownership changes without work history', async () => {
  const f = await setup();
  try {
    const vehicle = await createVehicle(f.db, f.business.id, f.input);
    assert.equal((await getCustomerDetail(f.db, f.business.id, f.owner.id)).vehicles[0].id, vehicle.id);
    await updateVehicle(f.db, f.business.id, vehicle.id, { ...f.input, customerId: f.other.id }, 1);
    assert.equal((await getCustomerDetail(f.db, f.business.id, f.owner.id)).vehicles.length, 0);
    assert.equal((await getCustomerDetail(f.db, f.business.id, f.other.id)).vehicles[0].id, vehicle.id);
    assert.equal((await getVehicleDetail(f.db, f.business.id, vehicle.id)).customer.id, f.other.id);
    await assert.rejects(deleteCustomer(f.db, f.business.id, f.other.id, 1), { status: 409, code: 'customerHasRecords' });
  } finally { f.db.close(); }
});
test('stale vehicle edits and deletions preserve newer values', async () => {
  const f = await setup();
  try {
    const vehicle = await createVehicle(f.db, f.business.id, f.input);
    await updateVehicle(f.db, f.business.id, vehicle.id, { ...f.input, color: 'Red' }, 1);
    await assert.rejects(updateVehicle(f.db, f.business.id, vehicle.id, f.input, 1), { status: 409 });
    await assert.rejects(deleteVehicle(f.db, f.business.id, vehicle.id, 1), { status: 409 });
    assert.equal((await getVehicle(f.db, f.business.id, vehicle.id)).color, 'Red');
  } finally { f.db.close(); }
});
test('vehicle reads, edits, deletes and histories are business-scoped', async () => {
  const f = await setup();
  try {
    const vehicle = await createVehicle(f.db, f.business.id, f.input); const otherBusiness = randomUUID();
    await assert.rejects(getVehicle(f.db, otherBusiness, vehicle.id), { status: 404 });
    await assert.rejects(updateVehicle(f.db, otherBusiness, vehicle.id, f.input, 1), { status: 404 });
    await assert.rejects(deleteVehicle(f.db, otherBusiness, vehicle.id, 1), { status: 404 });
    await assert.rejects(getVehicleDetail(f.db, otherBusiness, vehicle.id), { status: 404 });
    assert.equal((await listVehicles(f.db, otherBusiness, query)).total, 0); assert.deepEqual(await getVehicleManufacturers(f.db, otherBusiness), []);
  } finally { f.db.close(); }
});
test('search matches manufacturer, model, plate, color and owner, with literal wildcards', async () => {
  const f = await setup();
  try {
    await createVehicle(f.db, f.business.id, { ...f.input, manufacturer: 'Árnyék', model: 'Model_100%', color: 'Kék' });
    await createVehicle(f.db, f.business.id, { ...f.input, customerId: f.other.id, manufacturer: 'Other', model: 'Other', registrationNumber: null });
    for (const text of ['ARNYEK', 'árnyék', 'Model_100%', 'TEST123', 'test-123', 'kek', 'Customer A', '%', '_']) assert.equal((await listVehicles(f.db, f.business.id, { ...query, query: text })).total, 1);
    assert.equal((await listVehicles(f.db, f.business.id, { ...query, query: "' OR 1=1 --" })).total, 0);
  } finally { f.db.close(); }
});
test('filters combine customer, manufacturer, size and year and remain effective through pagination', async () => {
  const f = await setup();
  try {
    for (let index = 0; index < 5; index++) await createVehicle(f.db, f.business.id, { ...f.input, model: `Model ${index}`, sizeCategory: index < 3 ? 'small' : 'large' });
    await createVehicle(f.db, f.business.id, { ...f.input, customerId: f.other.id, manufacturer: 'Other', sizeCategory: 'small' });
    const result = await listVehicles(f.db, f.business.id, { ...query, manufacturer: 'EXAMPLE MAKE', customerId: f.owner.id, sizeCategory: 'small', productionYear: 2020, pageSize: 2, page: 2 });
    assert.equal(result.total, 3); assert.equal(result.items.length, 1); assert.equal(result.items[0].model, 'Model 2'); assert.equal(result.totalPages, 2);
    assert.equal((await listVehicles(f.db, f.business.id, { ...query, productionYear: 2019 })).total, 0);
    assert.equal((await listVehicles(f.db, f.business.id, { ...query, customerId: randomUUID() })).total, 0);
    assert.deepEqual(await getVehicleManufacturers(f.db, f.business.id), ['Example Make', 'Other']);
  } finally { f.db.close(); }
});
test('sorts, optional years and out-of-range pagination are deterministic', async () => {
  const f = await setup();
  try {
    const a = await createVehicle(f.db, f.business.id, { ...f.input, manufacturer: 'Alpha', productionYear: null });
    const b = await createVehicle(f.db, f.business.id, { ...f.input, manufacturer: 'Zulu', productionYear: 2022 });
    assert.equal((await listVehicles(f.db, f.business.id, query)).items[0].id, a.id);
    assert.equal((await listVehicles(f.db, f.business.id, { ...query, sort: 'year_desc' })).items[0].id, b.id);
    f.db.sqlite.prepare('UPDATE vehicles SET created_at = ? WHERE id = ?').run('2099-01-01T00:00:00Z', a.id);
    assert.equal((await listVehicles(f.db, f.business.id, { ...query, sort: 'created_desc' })).items[0].id, a.id);
    assert.equal((await listVehicles(f.db, f.business.id, { ...query, page: 99, pageSize: 1 })).page, 2);
  } finally { f.db.close(); }
});
test('service history contains real jobs and snapshots, with pagination and no fabricated entries', async () => {
  const f = await setup();
  try {
    const vehicle = await createVehicle(f.db, f.business.id, f.input);
    assert.equal((await getVehicleDetail(f.db, f.business.id, vehicle.id)).serviceHistory.total, 0);
    for (let index = 1; index <= 12; index++) {
      const job = addJob(f.db, f.business.id, f.owner.id, vehicle.id, `2026-01-${String(index).padStart(2, '0')}T10:00:00Z`, index === 12 ? 'scheduled' : 'completed');
      f.db.sqlite.prepare('INSERT INTO work_order_services (id, business_id, work_order_id, name_snapshot, price_huf) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), f.business.id, job, `Recorded service ${index}`, 1000);
    }
    const detail = await getVehicleDetail(f.db, f.business.id, vehicle.id);
    assert.equal(detail.customer.id, f.owner.id); assert.equal(detail.serviceHistory.total, 12); assert.equal(detail.serviceHistory.items.length, 10);
    assert.deepEqual(detail.serviceHistory.items[0].services, ['Recorded service 12']); assert.equal(detail.serviceHistory.items[0].status, 'scheduled');
    assert.equal((await getVehicleDetail(f.db, f.business.id, vehicle.id, 2)).serviceHistory.items.length, 2);
  } finally { f.db.close(); }
});
test('work history blocks deletion and ownership reassignment but permits other edits', async () => {
  const f = await setup();
  try {
    const vehicle = await createVehicle(f.db, f.business.id, f.input); addJob(f.db, f.business.id, f.owner.id, vehicle.id);
    await assert.rejects(deleteVehicle(f.db, f.business.id, vehicle.id, 1), { status: 409, code: 'vehicleHasRecords' });
    await assert.rejects(updateVehicle(f.db, f.business.id, vehicle.id, { ...f.input, customerId: f.other.id }, 1), { status: 409, code: 'vehicleOwnerLocked' });
    const updated = await updateVehicle(f.db, f.business.id, vehicle.id, { ...f.input, color: 'Green' }, 1);
    assert.equal(updated.color, 'Green'); assert.equal(updated.customerId, f.owner.id); assert.equal((await getVehicleDetail(f.db, f.business.id, vehicle.id)).serviceHistory.total, 1);
  } finally { f.db.close(); }
});
test('vehicle records and relationships survive reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'detailflow-vehicles-')); const filename = join(directory, 'vehicles.sqlite');
  const f = await setup(filename); const vehicle = await createVehicle(f.db, f.business.id, f.input); f.db.close();
  const db = createDatabase(filename, false);
  try { assert.deepEqual(await getVehicle(db, f.business.id, vehicle.id), vehicle); assert.equal((await getCustomerDetail(db, f.business.id, f.owner.id)).vehicles[0].id, vehicle.id); }
  finally { db.close(); unlinkSync(filename); rmdirSync(directory); }
});
test('vehicle migration preserves existing customer relationships and data', () => {
  const db = createDatabase(':memory:', false);
  try {
    for (const path of ['0000_foundation.sql', '0001_customer_management.sql']) db.sqlite.exec(readFileSync(new URL(`../drizzle/${path}`, import.meta.url), 'utf8'));
    const business = randomUUID(); const customer = randomUUID(); const vehicle = randomUUID();
    db.sqlite.prepare('INSERT INTO businesses (id, owner_user_id) VALUES (?, ?)').run(business, 'legacy');
    db.sqlite.prepare('INSERT INTO customers (id, business_id, full_name, phone_number) VALUES (?, ?, ?, ?)').run(customer, business, 'Legacy customer', '1234567');
    db.sqlite.prepare('INSERT INTO vehicles (id, business_id, customer_id, manufacturer, model) VALUES (?, ?, ?, ?, ?)').run(vehicle, business, customer, 'Legacy make', 'Legacy model');
    const before = db.sqlite.prepare('SELECT * FROM vehicles').get();
    db.sqlite.exec(readFileSync(new URL('../drizzle/0002_vehicle_management.sql', import.meta.url), 'utf8'));
    const after = db.sqlite.prepare('SELECT * FROM vehicles').get(); assert.equal(after.version, 1); assert.equal(after.customer_id, customer); assert.equal(after.created_at, before.created_at);
  } finally { db.close(); }
});
test('vehicle API completes authenticated CRUD with private responses', async () => {
  const f = await setup();
  try {
    const created = await vehicleWrite(request('POST', f.input), f.resolve); assert.equal(created.status, 201); const { vehicle } = await created.json();
    assert.equal(created.headers.get('location'), `/vehicles/${vehicle.id}`); assert.match(created.headers.get('cache-control'), /no-store/);
    const result = await vehiclesGet(readRequest('?q=test123&sizeCategory=medium'), f.resolve); assert.equal((await result.json()).items[0].id, vehicle.id);
    assert.equal((await (await vehicleGet(readRequest(), vehicle.id, f.resolve)).json()).customer.id, f.owner.id);
    const edited = await vehicleWrite(request('PUT', { ...f.input, color: 'Red', version: 1 }), f.resolve, vehicle.id); assert.equal(edited.status, 200);
    assert.equal((await vehicleDelete(request('DELETE', { version: 2 }), vehicle.id, f.resolve)).status, 204);
    assert.equal((await vehicleGet(readRequest(), vehicle.id, f.resolve)).status, 404);
  } finally { f.db.close(); }
});
test('vehicle APIs enforce identity, origin, validation, request limits and owner existence', async () => {
  const f = await setup(); const denied = async () => { throw new ApplicationError(401, 'unauthorized'); };
  try {
    assert.equal((await vehiclesGet(readRequest(), denied)).status, 401); assert.equal((await vehicleWrite(request('POST', f.input), denied)).status, 401);
    assert.equal((await vehicleGet(readRequest(), randomUUID(), denied)).status, 401); assert.equal((await vehicleDelete(request('DELETE', { version: 1 }), randomUUID(), denied)).status, 401);
    let called = false; const unexpected = async () => { called = true; throw new Error('Unexpected'); };
    assert.equal((await vehicleWrite(request('POST', f.input, 'https://other.example'), unexpected)).status, 403); assert.equal(called, false);
    assert.equal((await vehicleWrite(request('POST', { ...f.input, businessId: f.business.id }), f.resolve)).status, 422);
    assert.equal((await vehicleWrite(request('POST', { ...f.input, customerId: randomUUID() }), f.resolve)).status, 422);
    assert.equal((await vehicleWrite(request('POST', '{invalid'), f.resolve)).status, 400);
    assert.equal((await vehicleWrite(request('POST', 'x'.repeat(65_537)), f.resolve)).status, 413);
    assert.equal((await vehiclesGet(readRequest('?productionYear=123'), f.resolve)).status, 400);
    assert.equal((await vehicleGet(readRequest('?historyPage=0'), randomUUID(), f.resolve)).status, 400);
    assert.equal((await vehicleDelete(request('DELETE', { version: 1, businessId: f.business.id }), randomUUID(), f.resolve)).status, 422);
  } finally { f.db.close(); }
});
test('vehicle API hides database exception text', async () => {
  const response = await vehiclesGet(readRequest(), async () => { throw new Error('secret database details'); });
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'unavailable' });
});
test('vehicle form errors whitelist fields and identify invalid customer relationships', () => {
  assert.deepEqual(vehicleApiErrors(null), { form: 'unexpected' });
  assert.deepEqual(vehicleApiErrors({ error: 'vehicleCustomerInvalid' }), { form: 'vehicleCustomerInvalid', customerId: 'vehicleCustomerInvalid' });
  assert.deepEqual(vehicleApiErrors({ error: 'invalidInput', fields: { model: 'modelRequired', businessId: 'injected' } }), { model: 'modelRequired', form: 'invalidInput' });
  assert.equal(vehicleErrorText(hu, '<script>internal error</script>'), hu.vehicleErrors.unexpected);
});
test('vehicle response guards and registration normalization handle malformed edge cases', () => {
  assert.equal(isVehicle(null), false);
  assert.equal(isVehicle({ ...vehicleInput, id: randomUUID(), customerId: randomUUID(), createdAt: 'invalid', updatedAt: 'invalid', version: 1 }), false);
  assert.equal(validateVehicle({ ...vehicleInput, customerId: randomUUID(), registrationNumber: 'ß'.repeat(20) }).success, false);
});
