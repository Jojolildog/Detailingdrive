import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from './helpers/d1.mjs';
import { resolveOwnerBusiness } from '../server/business.ts';
import { createCustomer } from '../server/customers.ts';
import { createVehicle } from '../server/vehicles.ts';
import { createService, getService, getServiceDetail, listServices, updateService, deleteService } from '../server/services.ts';
import { servicesGet, serviceGet, serviceWrite, serviceDelete } from '../server/services-api.ts';
import { validateService, emptyService, parseServiceQuery, serviceListPath, isService, formatHuf } from '../lib/services.ts';
import { serviceApiErrors, serviceErrorText } from '../components/services/api.ts';
import { ApplicationError } from '../server/errors.ts';
import { hu } from '../lib/i18n/hu.ts';

const input = { ...emptyService, serviceName: 'Test service', description: 'Owner-entered description', defaultPrice: 25000, expectedDuration: 120, expectedMaterials: [{ name: 'Test material', quantity: 25.5, unit: 'ml' }], optionalCostEstimate: 2000 };
const query = { query: '', status: 'all', minPrice: null, maxPrice: null, maxDuration: null, sort: 'name_asc', page: 1, pageSize: 20 };
async function setup(filename) {
  const db = createDatabase(filename); const business = await resolveOwnerBusiness(db, { userId: 'owner', email: 'owner@example.test' }, { userId: 'owner' });
  return { db, business, resolve: async () => ({ db, business }) };
}
function request(method, body, origin = 'https://detailflow.example') { return new Request('https://detailflow.example/api/services', { method, headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }); }
function readRequest(suffix = '') { return new Request(`https://detailflow.example/api/services${suffix}`); }

test('services require a name and explicit HUF price; optional values remain unknown', () => {
  const missing = validateService(emptyService); assert.equal(missing.success, false); assert.equal(missing.errors.serviceName, 'nameRequired'); assert.equal(missing.errors.defaultPrice, 'priceRequired');
  const parsed = validateService({ serviceName: '  Árvíztűrő  ', defaultPrice: 0 });
  assert.equal(parsed.success, true); assert.deepEqual(parsed.data, { serviceName: 'Árvíztűrő', defaultPrice: 0, description: '', expectedDuration: null, expectedMaterials: [], optionalCostEstimate: null, active: true });
  for (const value of ['', null, undefined]) assert.equal(validateService({ ...input, defaultPrice: value }).errors.defaultPrice, 'priceRequired');
});
test('validation enforces whole HUF prices, duration, bounds and server-managed fields', () => {
  for (const defaultPrice of [-1, 0.5, '2000', 100_000_001, NaN, Infinity]) assert.equal(validateService({ ...input, defaultPrice }).success, false);
  for (const optionalCostEstimate of [-1, 1.5, '', 100_000_001]) assert.equal(validateService({ ...input, optionalCostEstimate }).success, false);
  for (const expectedDuration of [0, -1, 1.5, '60', 10_081]) assert.equal(validateService({ ...input, expectedDuration }).success, false);
  for (const value of [{ serviceName: 'x'.repeat(161) }, { serviceName: 'Bad\nname' }, { description: 'x'.repeat(10001) }, { active: 1 }, { serviceType: 'bundle' }, { currency: 'EUR' }, { businessId: randomUUID() }, { id: randomUUID() }, { createdAt: '2020-01-01' }]) assert.equal(validateService({ ...input, ...value }).success, false);
  assert.equal(validateService({ ...input, version: 1 }).success, false); assert.equal(validateService(input, true).errors.form, 'invalidVersion'); assert.equal(validateService({ ...input, version: 1 }, true).success, true);
});
test('material validation returns row errors and supports unknown quantities without inventing usage', () => {
  const parsed = validateService({ ...input, expectedMaterials: [{ name: '  Test  ', unit: 'piece' }] });
  assert.equal(parsed.success, true); assert.deepEqual(parsed.data.expectedMaterials, [{ name: 'Test', quantity: null, unit: 'piece' }]);
  const invalid = validateService({ ...input, expectedMaterials: [{ name: '', quantity: 0, unit: 'unknown' }, { name: 'Test', quantity: 0.0001, unit: 'ml' }] });
  assert.equal(invalid.success, false); assert.equal(invalid.materialErrors[0].name, 'materialNameRequired'); assert.equal(invalid.materialErrors[0].unit, 'invalidUnit'); assert.equal(invalid.materialErrors[1].quantity, 'invalidQuantity');
  for (const expectedMaterials of ['text', Array(51).fill(input.expectedMaterials[0]), [{ name: 'Test', unit: 'ml', stockId: randomUUID() }], [{ name: 'x'.repeat(121), quantity: 2, unit: 'l' }]]) assert.equal(validateService({ ...input, expectedMaterials }).success, false);
});
test('service query validation bounds filters and round-trips URLs', () => {
  assert.deepEqual(parseServiceQuery(new URLSearchParams()), query);
  for (const suffix of ['page=0', 'pageSize=101', 'status=bad', 'sort=name%3BDROP', 'minPrice=-1', 'minPrice=0.5', 'maxPrice=100000001', 'minPrice=20&maxPrice=10', 'maxDuration=0', 'maxDuration=10081', `q=${'x'.repeat(201)}`]) assert.equal(parseServiceQuery(new URLSearchParams(suffix)), null);
  const next = { ...query, query: 'A & B', status: 'inactive', minPrice: 0, maxPrice: 10000, maxDuration: 60, sort: 'price_desc', page: 2, pageSize: 10 };
  assert.deepEqual(parseServiceQuery(new URL(serviceListPath(next), 'https://detailflow.example').searchParams), next);
  assert.match(formatHuf(25000, 'en'), /25,000/); assert.match(formatHuf(0, 'hu'), /0\s*Ft/);
});
test('service CRUD stores all fields and editable pricing preserves creation time', async () => {
  const f = await setup(); try {
    assert.equal((await listServices(f.db, f.business.id, query)).total, 0);
    const service = await createService(f.db, f.business.id, input); assert.equal(isService(service), true); assert.equal(service.serviceType, 'single'); assert.equal(service.currency, 'HUF');
    const edited = await updateService(f.db, f.business.id, service.id, { ...input, serviceName: 'Edited', defaultPrice: 30000, expectedMaterials: [], optionalCostEstimate: null }, 1);
    assert.equal(edited.defaultPrice, 30000); assert.equal(edited.version, 2); assert.equal(edited.createdAt, service.createdAt); assert.equal(edited.optionalCostEstimate, null);
    assert.deepEqual((await getServiceDetail(f.db, f.business.id, service.id)).service, edited);
    await deleteService(f.db, f.business.id, service.id, 2); await assert.rejects(getService(f.db, f.business.id, service.id), { status: 404 });
  } finally { f.db.close(); }
});
test('stale edits and deletes are rejected without overwriting newer prices', async () => {
  const f = await setup(); try {
    const service = await createService(f.db, f.business.id, input); await updateService(f.db, f.business.id, service.id, { ...input, defaultPrice: 28000 }, 1);
    await assert.rejects(updateService(f.db, f.business.id, service.id, input, 1), { status: 409, code: 'serviceConflict' });
    await assert.rejects(deleteService(f.db, f.business.id, service.id, 1), { status: 409, code: 'serviceConflict' }); assert.equal((await getService(f.db, f.business.id, service.id)).defaultPrice, 28000);
  } finally { f.db.close(); }
});
test('omitting optional active status on an edit preserves deactivation', async () => {
  const f = await setup(); try {
    const service = await createService(f.db, f.business.id, { ...input, active: false }); const { active, ...withoutStatus } = input;
    const parsed = validateService({ ...withoutStatus, version: 1 }, true); assert.equal(parsed.success, true); assert.equal(parsed.data.active, undefined);
    assert.equal((await updateService(f.db, f.business.id, service.id, parsed.data, 1)).active, false);
  } finally { f.db.close(); }
});
test('service records are scoped to the resolved business on every operation', async () => {
  const f = await setup(); try {
    const service = await createService(f.db, f.business.id, input); const foreign = randomUUID();
    assert.equal((await listServices(f.db, foreign, query)).total, 0);
    for (const op of [() => getService(f.db, foreign, service.id), () => getServiceDetail(f.db, foreign, service.id), () => updateService(f.db, foreign, service.id, input, 1), () => deleteService(f.db, foreign, service.id, 1)]) await assert.rejects(op(), { status: 404 });
    await assert.rejects(getService(f.db, f.business.id, 'invalid'), { status: 404 }); await assert.rejects(createService(f.db, foreign, input), /FOREIGN KEY/);
  } finally { f.db.close(); }
});
test('service search folds Hungarian accents and treats SQL wildcards literally', async () => {
  const f = await setup(); try {
    const service = await createService(f.db, f.business.id, { ...input, serviceName: 'ÁRVÍZTŰRŐ 100%', description: 'Belső_tér kezelés' });
    for (const text of ['arvizturo', 'belso_ter kezeles', '100%']) { const result = await listServices(f.db, f.business.id, { ...query, query: text }); assert.equal(result.items[0].id, service.id); }
    assert.equal((await listServices(f.db, f.business.id, { ...query, query: "' OR 1=1 --" })).total, 0);
    assert.equal((await listServices(f.db, f.business.id, { ...query, query: '%_%' })).total, 0);
  } finally { f.db.close(); }
});
test('service filters, sorting and pagination compose and clamp out-of-range pages', async () => {
  const f = await setup(); try {
    for (const [name, price, duration, active] of [['B', 10000, 60, true], ['A', 0, null, true], ['C', 30000, 120, false]]) await createService(f.db, f.business.id, { ...input, serviceName: name, defaultPrice: price, expectedDuration: duration, active });
    assert.deepEqual((await listServices(f.db, f.business.id, query)).items.map(x => x.serviceName), ['A', 'B', 'C']);
    assert.deepEqual((await listServices(f.db, f.business.id, { ...query, sort: 'price_desc' })).items.map(x => x.defaultPrice), [30000, 10000, 0]);
    assert.deepEqual((await listServices(f.db, f.business.id, { ...query, sort: 'duration_asc' })).items.map(x => x.expectedDuration), [60, 120, null]);
    assert.equal((await listServices(f.db, f.business.id, { ...query, status: 'inactive' })).total, 1);
    const filtered = await listServices(f.db, f.business.id, { ...query, status: 'active', minPrice: 0, maxPrice: 20000, maxDuration: 60 }); assert.equal(filtered.total, 1); assert.equal(filtered.items[0].serviceName, 'B');
    const page = await listServices(f.db, f.business.id, { ...query, pageSize: 2, page: 99 }); assert.equal(page.page, 2); assert.equal(page.totalPages, 2); assert.equal(page.items.length, 1);
  } finally { f.db.close(); }
});
test('service prices and material plans persist after closing and reopening storage', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'detailflow-services-')); const filename = join(directory, 'services.sqlite');
  const f = await setup(filename); const service = await createService(f.db, f.business.id, input); f.db.close(); const db = createDatabase(filename, false);
  try { assert.deepEqual(await getService(db, f.business.id, service.id), service); } finally { db.close(); unlinkSync(filename); rmdirSync(directory); }
});
test('Phase 3 migration preserves legacy service fields and unknown prices', async () => {
  const db = createDatabase(':memory:', false); try {
    for (const path of ['0000_foundation.sql', '0001_customer_management.sql', '0002_vehicle_management.sql']) db.sqlite.exec(readFileSync(new URL(`../drizzle/${path}`, import.meta.url), 'utf8'));
    const businessId = randomUUID(); const id = randomUUID(); db.sqlite.prepare('INSERT INTO businesses (id, owner_user_id) VALUES (?, ?)').run(businessId, 'legacy');
    db.sqlite.prepare('INSERT INTO services (id, business_id, name, expected_materials_json) VALUES (?, ?, ?, ?)').run(id, businessId, 'Legacy service', JSON.stringify(input.expectedMaterials));
    const before = db.sqlite.prepare('SELECT * FROM services').get(); db.sqlite.exec(readFileSync(new URL('../drizzle/0003_services_pricing.sql', import.meta.url), 'utf8'));
    const row = await getService(db, businessId, id); assert.equal(row.defaultPrice, null); assert.equal(row.createdAt, before.created_at); assert.equal(row.version, 1); assert.equal(row.serviceType, 'single'); assert.deepEqual(row.expectedMaterials, input.expectedMaterials);
  } finally { db.close(); }
});
test('changing catalog prices preserves work-order snapshots and blocks referenced deletion', async () => {
  const f = await setup(); try {
    const service = await createService(f.db, f.business.id, input);
    const customer = await createCustomer(f.db, f.business.id, { fullName: 'Test customer', phoneNumber: '+361234567', email: null, notes: '' });
    const vehicle = await createVehicle(f.db, f.business.id, { customerId: customer.id, manufacturer: 'Test', model: 'Model', productionYear: null, registrationNumber: '', color: '', sizeCategory: 'medium', notes: '' });
    const jobId = randomUUID(); f.db.sqlite.prepare('INSERT INTO work_orders (id, business_id, customer_id, vehicle_id) VALUES (?, ?, ?, ?)').run(jobId, f.business.id, customer.id, vehicle.id);
    f.db.sqlite.prepare('INSERT INTO work_order_services (id, business_id, work_order_id, service_id, name_snapshot, price_huf) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), f.business.id, jobId, service.id, service.serviceName, service.defaultPrice);
    await updateService(f.db, f.business.id, service.id, { ...input, serviceName: 'Edited catalog name', defaultPrice: 50000, active: false }, 1);
    const snapshot = f.db.sqlite.prepare('SELECT name_snapshot, price_huf FROM work_order_services').get(); assert.equal(snapshot.name_snapshot, input.serviceName); assert.equal(snapshot.price_huf, input.defaultPrice);
    await assert.rejects(deleteService(f.db, f.business.id, service.id, 2), { status: 409, code: 'serviceInUse' }); assert.equal((await getService(f.db, f.business.id, service.id)).active, false);
  } finally { f.db.close(); }
});
test('bundle foundation permits same-business single-service components and returns real composition', async () => {
  const f = await setup(); try {
    const bundle = await createService(f.db, f.business.id, { ...input, serviceName: 'Test bundle' }); const component = await createService(f.db, f.business.id, input);
    f.db.sqlite.prepare("UPDATE services SET service_type = 'bundle' WHERE id = ?").run(bundle.id);
    f.db.sqlite.prepare('INSERT INTO service_bundle_items (id, business_id, bundle_service_id, component_service_id, quantity) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), f.business.id, bundle.id, component.id, 2);
    const detail = await getServiceDetail(f.db, f.business.id, bundle.id); assert.equal(detail.service.serviceType, 'bundle'); assert.equal(detail.bundleComponents[0].serviceId, component.id); assert.equal(detail.bundleComponents[0].quantity, 2);
    await assert.rejects(deleteService(f.db, f.business.id, component.id, 1), { code: 'serviceInUse' });
    await updateService(f.db, f.business.id, bundle.id, { ...input, defaultPrice: 40000 }, 1); assert.equal((await getService(f.db, f.business.id, bundle.id)).serviceType, 'bundle');
  } finally { f.db.close(); }
});
test('bundle schema rejects nesting, self-links, duplicates, missing and cross-business components', async () => {
  const f = await setup(); try {
    const bundle = await createService(f.db, f.business.id, input); const component = await createService(f.db, f.business.id, input); const bundle2 = await createService(f.db, f.business.id, input);
    f.db.sqlite.prepare("UPDATE services SET service_type = 'bundle' WHERE id IN (?, ?)").run(bundle.id, bundle2.id);
    const insert = (parent, child, qty = 1, business = f.business.id) => f.db.sqlite.prepare('INSERT INTO service_bundle_items (id, business_id, bundle_service_id, component_service_id, quantity) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), business, parent, child, qty);
    for (const [parent, child, qty] of [[component.id, bundle.id, 1], [bundle.id, bundle2.id, 1], [bundle.id, bundle.id, 1], [bundle.id, randomUUID(), 1], [bundle.id, component.id, 0], [bundle.id, component.id, 1.5]]) assert.throws(() => insert(parent, child, qty), /constraint/i);
    assert.throws(() => insert(bundle.id, component.id, 1, randomUUID()), /FOREIGN KEY/);
    insert(bundle.id, component.id); assert.throws(() => insert(bundle.id, component.id), /UNIQUE/);
    assert.throws(() => f.db.sqlite.prepare("UPDATE services SET service_type = 'bundle' WHERE id = ?").run(component.id), /FOREIGN KEY/);
  } finally { f.db.close(); }
});
test('corrupt material plans fail explicitly rather than returning fabricated empty plans', async () => {
  const f = await setup(); try {
    const service = await createService(f.db, f.business.id, input); f.db.sqlite.prepare('UPDATE services SET expected_materials_json = ? WHERE id = ?').run('["unsupported"]', service.id);
    await assert.rejects(getService(f.db, f.business.id, service.id), { status: 503, code: 'serviceMaterialsUnavailable' });
    assert.equal((await serviceGet(service.id, f.resolve)).status, 503);
  } finally { f.db.close(); }
});
test('service API completes owner-authenticated CRUD with private response headers', async () => {
  const f = await setup(); try {
    const created = await serviceWrite(request('POST', input), f.resolve); assert.equal(created.status, 201); const { service } = await created.json(); assert.equal(created.headers.get('location'), `/services/${service.id}`); assert.match(created.headers.get('cache-control'), /no-store/);
    assert.equal((await (await servicesGet(readRequest('?status=active&maxPrice=25000'), f.resolve)).json()).items[0].id, service.id);
    assert.equal((await (await serviceGet(service.id, f.resolve)).json()).service.id, service.id);
    assert.equal((await serviceWrite(request('PUT', { ...input, defaultPrice: 26000, version: 1 }), f.resolve, service.id)).status, 200);
    assert.equal((await serviceDelete(request('DELETE', { version: 2 }), service.id, f.resolve)).status, 204); assert.equal((await serviceGet(service.id, f.resolve)).status, 404);
  } finally { f.db.close(); }
});
test('service APIs require owner access and reject wrong origins before writes', async () => {
  const denied = async () => { throw new ApplicationError(401, 'unauthorized'); };
  assert.equal((await servicesGet(readRequest(), denied)).status, 401); assert.equal((await serviceGet(randomUUID(), denied)).status, 401); assert.equal((await serviceWrite(request('POST', input), denied)).status, 401); assert.equal((await serviceDelete(request('DELETE', { version: 1 }), randomUUID(), denied)).status, 401);
  let called = false; const resolve = async () => { called = true; throw new Error('secret'); };
  assert.equal((await serviceWrite(request('POST', input, 'https://other.example'), resolve)).status, 403); assert.equal((await serviceDelete(request('DELETE', { version: 1 }, 'https://other.example'), randomUUID(), resolve)).status, 403); assert.equal(called, false);
});
test('service APIs validate body size, JSON, fields, material rows and query bounds', async () => {
  const f = await setup(); try {
    for (const extra of [{ businessId: f.business.id }, { serviceType: 'bundle' }, { currency: 'EUR' }, { defaultPrice: '' }]) assert.equal((await serviceWrite(request('POST', { ...input, ...extra }), f.resolve)).status, 422);
    const rows = await serviceWrite(request('POST', { ...input, expectedMaterials: [{ name: '', unit: 'ml' }] }), f.resolve); assert.equal(rows.status, 422); assert.equal((await rows.json()).materials[0].name, 'materialNameRequired');
    assert.equal((await serviceWrite(request('POST', '{invalid'), f.resolve)).status, 400); assert.equal((await serviceWrite(request('POST', 'x'.repeat(65537)), f.resolve)).status, 413);
    assert.equal((await servicesGet(readRequest('?minPrice=20&maxPrice=10'), f.resolve)).status, 400); assert.equal((await serviceDelete(request('DELETE', { version: 1, id: randomUUID() }), randomUUID(), f.resolve)).status, 422);
  } finally { f.db.close(); }
});
test('service errors hide database details and UI parsers tolerate unknown responses', async () => {
  const response = await servicesGet(readRequest(), async () => { throw new Error('secret database details'); }); assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'unavailable' });
  assert.equal(serviceApiErrors(null).errors.form, 'unexpected'); assert.deepEqual(serviceApiErrors({ materials: { 500: { name: 'bad' }, 0: { name: 'invalidMaterial', extra: 'ignored' } }, fields: { businessId: 'bad' }, error: 'invalidInput' }).materialErrors, { 0: { name: 'invalidMaterial' } });
  assert.equal(serviceErrorText(hu, 'unknownCode'), hu.serviceErrors.unexpected); assert.equal(isService(null), false);
});
