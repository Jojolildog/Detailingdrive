import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './helpers/d1.mjs';
import { defaultSettings, validateSettings } from '../lib/settings.ts';
import { canAccessBusiness, canProvisionBusiness, isSameOriginJson } from '../lib/access.ts';
import { hu } from '../lib/i18n/hu.ts';
import { en } from '../lib/i18n/en.ts';
import { getDictionary, formatDate } from '../lib/i18n/index.ts';
import { navigation, sectionFromSlug } from '../lib/navigation.ts';
import { resolveOwnerBusiness, readSettings, writeSettings } from '../server/business.ts';
import { getSettingsResponse, putSettingsResponse } from '../server/settings-api.ts';
import { ApplicationError } from '../server/errors.ts';

const owner = { userId: 'site-owner', email: 'owner@example.test' };
const configured = { email: owner.email };
async function context(db) { const business = await resolveOwnerBusiness(db, owner, configured); return { db, business }; }
function request(body, origin = 'https://detailflow.example') {
  return new Request('https://detailflow.example/api/settings', { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
function keys(value, prefix = '') { return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`]).sort(); }

test('defaults use Hungarian, HUF, Budapest and metric units without invented tariffs', () => {
  assert.equal(defaultSettings.locale, 'hu'); assert.equal(defaultSettings.currency, 'HUF');
  assert.equal(defaultSettings.timezone, 'Europe/Budapest'); assert.equal(defaultSettings.units, 'metric');
  assert.equal(defaultSettings.electricityPricePerKwh, null); assert.equal(defaultSettings.waterPricePerCubicMeter, null);
  assert.equal(defaultSettings.businessName, ''); assert.ok(validateSettings(defaultSettings).success);
});
test('validation rejects malformed objects, extra fields and invalid enums', () => {
  for (const input of [null, [], 'hello', {}, { ...defaultSettings, businessId: randomUUID() }, { ...defaultSettings, locale: 'de' }, { ...defaultSettings, currency: 'EUR' }, { ...defaultSettings, theme: 'other' }]) assert.equal(validateSettings(input).success, false);
});
test('validation rejects negative, infinite and missing rates, allowing zero and null', () => {
  for (const electricityPricePerKwh of [-1, NaN, Infinity, undefined, '12', 100_000_001]) assert.equal(validateSettings({ ...defaultSettings, electricityPricePerKwh }).success, false);
  for (const electricityPricePerKwh of [0, null, 70.104]) assert.equal(validateSettings({ ...defaultSettings, electricityPricePerKwh }).success, true);
});
test('validation trims names and bounds replacement months and versions', () => {
  assert.equal(validateSettings({ ...defaultSettings, businessName: '  Workshop  ' }).data.businessName, 'Workshop');
  assert.equal(validateSettings({ ...defaultSettings, businessName: 'a'.repeat(121) }).success, false);
  for (const equipmentReplacementMonths of [0, 1.5, 601]) assert.equal(validateSettings({ ...defaultSettings, equipmentReplacementMonths }).success, false);
  for (const version of [0, -1, 1.1, Infinity]) assert.equal(validateSettings({ ...defaultSettings, version }).success, false);
});
test('Hungarian and English dictionaries have identical keys and nonempty text', () => {
  assert.deepEqual(keys(hu), keys(en));
  for (const dictionary of [hu, en]) { const walk = (v) => Object.values(v).forEach(x => typeof x === 'object' ? walk(x) : assert.ok(typeof x === 'string' && x.length)); walk(dictionary); }
  assert.equal(getDictionary('hu'), hu); assert.equal(getDictionary('en'), en);
});
test('date formatting uses the Budapest calendar date across UTC midnight boundaries', () => {
  assert.match(formatDate(new Date('2026-11-14T23:30:00Z'), 'hu'), /15/);
});
test('all nine navigation sections have unique URLs and correct routing', () => {
  assert.equal(navigation.length, 9); assert.equal(new Set(navigation.map(x => x.path)).size, 9);
  assert.equal(sectionFromSlug('work-orders'), 'workOrders'); assert.equal(sectionFromSlug('settings'), 'settings'); assert.equal(sectionFromSlug('unknown'), undefined);
});
test('owner access requires stable identity; email reuse does not grant access', () => {
  assert.equal(canAccessBusiness(owner, owner.userId), true);
  assert.equal(canAccessBusiness({ ...owner, userId: 'different' }, owner.userId), false);
  assert.equal(canAccessBusiness(null, owner.userId), false);
});
test('bootstrap is closed by default and configured stable ID takes precedence', () => {
  assert.equal(canProvisionBusiness(owner, {}), false);
  assert.equal(canProvisionBusiness(owner, { email: 'OWNER@example.test' }), true);
  assert.equal(canProvisionBusiness(owner, { email: owner.email, userId: 'different' }), false);
  assert.equal(canProvisionBusiness(null, configured), false);
});
test('foundation starts empty and every table has UUID IDs and both timestamps', () => {
  const db = createDatabase();
  try {
    const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    assert.equal(tables.length, 15);
    for (const { name } of tables) {
      assert.equal(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n, 0);
      const columns = db.sqlite.prepare(`PRAGMA table_info(${name})`).all();
      for (const field of ['id', 'created_at', 'updated_at']) assert.ok(columns.some(x => x.name === field));
      if (name !== 'businesses') assert.ok(columns.some(x => x.name === 'business_id'));
    }
    assert.throws(() => db.sqlite.prepare('INSERT INTO businesses (id, owner_user_id) VALUES (?, ?)').run('x'.repeat(36), 'test'), /CHECK/);
  } finally { db.close(); }
});
test('owner provisioning is idempotent and creates only a business and its settings', async () => {
  const db = createDatabase();
  try {
    const a = await context(db); const b = await context(db); assert.equal(a.business.id, b.business.id);
    assert.match(a.business.id, /^[\da-f-]{36}$/);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM businesses').get().n, 1);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM customers').get().n, 0);
    assert.deepEqual(await readSettings(db, a.business.id), defaultSettings);
    await assert.rejects(resolveOwnerBusiness(db, { ...owner, userId: 'attacker' }, configured), { status: 403 });
  } finally { db.close(); }
});
test('anonymous, unauthorized and unconfigured bootstrap requests cannot create a business', async () => {
  const db = createDatabase();
  try {
    await assert.rejects(resolveOwnerBusiness(db, null, configured), { status: 401 });
    await assert.rejects(resolveOwnerBusiness(db, owner, {}), { status: 503, code: 'setup' });
    await assert.rejects(resolveOwnerBusiness(db, { userId: 'other', email: 'other@example.test' }, configured), { status: 403 });
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM businesses').get().n, 0);
  } finally { db.close(); }
});
test('single-business foundation rejects a second business', async () => {
  const db = createDatabase();
  try { await context(db); assert.throws(() => db.sqlite.prepare('INSERT INTO businesses (id, owner_user_id) VALUES (?, ?)').run(randomUUID(), 'other'), /UNIQUE/); }
  finally { db.close(); }
});
test('atomic batch rolls back all statements if initialization fails', async () => {
  const db = createDatabase();
  try {
    const id = randomUUID();
    await assert.rejects(db.batch([db.prepare('INSERT INTO businesses (id, owner_user_id) VALUES (?, ?)').bind(id, 'owner'), db.prepare('INSERT INTO business_settings (id, business_id, locale) VALUES (?, ?, ?)').bind(randomUUID(), id, 'invalid')]));
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM businesses').get().n, 0);
  } finally { db.close(); }
});
test('settings use bound queries and stale edits cannot overwrite a later version', async () => {
  const db = createDatabase();
  try {
    const { business } = await context(db);
    const input = { ...defaultSettings, businessName: "Workshop'); DROP TABLE customers; --", electricityPricePerKwh: 70.104, locale: 'en', theme: 'dark' };
    const saved = await writeSettings(db, business.id, input); assert.equal(saved.version, 2); assert.equal(saved.businessName, input.businessName);
    await assert.rejects(writeSettings(db, business.id, defaultSettings), { status: 409 });
    assert.equal((await readSettings(db, business.id)).locale, 'en');
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM customers').get().n, 0);
  } finally { db.close(); }
});
test('settings survive closing and reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'detailflow-db-'));
  const filename = join(directory, 'persistence.sqlite');
  const first = createDatabase(filename); const { business } = await context(first);
  await writeSettings(first, business.id, { ...defaultSettings, businessName: 'Persistence test' }); first.close();
  const reopened = createDatabase(filename, false);
  try { assert.equal((await readSettings(reopened, business.id)).businessName, 'Persistence test'); }
  finally { reopened.close(); unlinkSync(filename); rmdirSync(directory); }
});
test('schema requires customer name and phone and prevents orphan vehicles', async () => {
  const db = createDatabase();
  try {
    const { business } = await context(db);
    const insert = db.sqlite.prepare('INSERT INTO customers (id, business_id, full_name, phone_number) VALUES (?, ?, ?, ?)');
    assert.throws(() => insert.run(randomUUID(), business.id, ' ', '+36123456'), /CHECK/);
    assert.throws(() => insert.run(randomUUID(), business.id, 'Customer', ' '), /CHECK/);
    assert.throws(() => db.sqlite.prepare('INSERT INTO vehicles (id, business_id, customer_id, manufacturer, model) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), business.id, randomUUID(), 'Manufacturer', 'Model'), /FOREIGN KEY/);
  } finally { db.close(); }
});
async function jobFixture(db) {
  const { business } = await context(db); const customer = randomUUID(); const vehicle = randomUUID(); const job = randomUUID();
  db.sqlite.prepare('INSERT INTO customers (id, business_id, full_name, phone_number) VALUES (?, ?, ?, ?)').run(customer, business.id, 'Test customer', '+361234567');
  db.sqlite.prepare('INSERT INTO vehicles (id, business_id, customer_id, manufacturer, model) VALUES (?, ?, ?, ?, ?)').run(vehicle, business.id, customer, 'Test make', 'Test model');
  db.sqlite.prepare('INSERT INTO work_orders (id, business_id, customer_id, vehicle_id) VALUES (?, ?, ?, ?)').run(job, business.id, customer, vehicle);
  return { business, customer, vehicle, job };
}
test('work orders cannot reference a vehicle owned by a different customer', async () => {
  const db = createDatabase();
  try {
    const f = await jobFixture(db); const other = randomUUID();
    db.sqlite.prepare('INSERT INTO customers (id, business_id, full_name, phone_number) VALUES (?, ?, ?, ?)').run(other, f.business.id, 'Other customer', '123');
    assert.throws(() => db.sqlite.prepare('INSERT INTO work_orders (id, business_id, customer_id, vehicle_id) VALUES (?, ?, ?, ?)').run(randomUUID(), f.business.id, other, f.vehicle), /FOREIGN KEY/);
    assert.throws(() => db.sqlite.prepare('DELETE FROM customers WHERE id = ?').run(f.customer), /FOREIGN KEY/);
  } finally { db.close(); }
});
test('payment status is independent from job status and both reject unknown values', async () => {
  const db = createDatabase();
  try {
    const f = await jobFixture(db);
    db.sqlite.prepare("UPDATE work_orders SET job_status = 'completed', payment_status = 'unpaid' WHERE id = ?").run(f.job);
    assert.equal(db.sqlite.prepare('SELECT payment_status FROM work_orders WHERE id = ?').get(f.job).payment_status, 'unpaid');
    assert.throws(() => db.sqlite.prepare("UPDATE work_orders SET job_status = 'paid' WHERE id = ?").run(f.job), /CHECK/);
    assert.throws(() => db.sqlite.prepare('UPDATE work_orders SET price_huf = -1 WHERE id = ?').run(f.job), /CHECK/);
  } finally { db.close(); }
});
test('inventory prevents negative stock and duplicate deduction keys', async () => {
  const db = createDatabase();
  try {
    const f = await jobFixture(db); const chemical = randomUUID();
    db.sqlite.prepare('INSERT INTO chemicals (id, business_id, product_name, available_quantity_ml) VALUES (?, ?, ?, ?)').run(chemical, f.business.id, 'Test product', 100);
    assert.throws(() => db.sqlite.prepare('UPDATE chemicals SET available_quantity_ml = -1 WHERE id = ?').run(chemical), /CHECK/);
    const insert = db.sqlite.prepare("INSERT INTO inventory_movements (id, business_id, chemical_id, work_order_id, quantity_delta_ml, movement_type, idempotency_key, reason) VALUES (?, ?, ?, ?, -10, 'job_usage', 'completion:1', 'Job completion')");
    insert.run(randomUUID(), f.business.id, chemical, f.job);
    assert.throws(() => insert.run(randomUUID(), f.business.id, chemical, f.job), /UNIQUE/);
  } finally { db.close(); }
});
test('completed-job snapshot fields remain independent from current settings', async () => {
  const db = createDatabase();
  try {
    const f = await jobFixture(db);
    db.sqlite.prepare(`INSERT INTO work_order_cost_snapshots (id, business_id, work_order_id, calculation_version, revenue_huf, chemical_cost_huf, electricity_cost_huf, water_cost_huf, depreciation_cost_huf, consumable_cost_huf, additional_cost_huf, labor_cost_huf, settings_snapshot_json) VALUES (?, ?, ?, 1, 10000, 100, 10, 10, 10, 10, 0, 0, '{"electricityPricePerKwh":70}')`).run(randomUUID(), f.business.id, f.job);
    await writeSettings(db, f.business.id, { ...defaultSettings, electricityPricePerKwh: 100 });
    const row = db.sqlite.prepare('SELECT * FROM work_order_cost_snapshots').get();
    assert.equal(row.electricity_cost_huf, 10); assert.equal(JSON.parse(row.settings_snapshot_json).electricityPricePerKwh, 70);
  } finally { db.close(); }
});
test('API rejects cross-origin writes and incorrect content types before resolving identity', async () => {
  let resolved = false;
  const resolver = async () => { resolved = true; throw new Error('Should not run'); };
  const response = await putSettingsResponse(request(defaultSettings, 'https://attacker.example'), resolver);
  assert.equal(response.status, 403); assert.equal(resolved, false);
  assert.equal(isSameOriginJson(new Request('https://detailflow.example/api/settings', { method: 'PUT', headers: { origin: 'https://detailflow.example', 'content-type': 'text/plain' }, body: '{}' })), false);
});
test('API rejects invalid JSON, oversized requests and invalid settings', async () => {
  const db = createDatabase();
  try {
    const resolver = () => context(db);
    assert.equal((await putSettingsResponse(request('{oops'), resolver)).status, 400);
    assert.equal((await putSettingsResponse(request('x'.repeat(16_385)), resolver)).status, 413);
    const response = await putSettingsResponse(request({ ...defaultSettings, electricityPricePerKwh: -1 }), resolver);
    assert.equal(response.status, 422); assert.equal((await response.json()).fields.electricityPricePerKwh, 'invalidAmount');
  } finally { db.close(); }
});
test('API persists settings, returns no-store headers and reports concurrent edits', async () => {
  const db = createDatabase();
  try {
    const resolver = () => context(db);
    const response = await putSettingsResponse(request({ ...defaultSettings, businessName: 'My workshop' }), resolver);
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    const read = await getSettingsResponse(resolver); assert.equal((await read.json()).settings.businessName, 'My workshop');
    assert.equal((await putSettingsResponse(request(defaultSettings), resolver)).status, 409);
  } finally { db.close(); }
});
test('API errors expose neither database details nor secrets', async () => {
  const denied = await getSettingsResponse(async () => { throw new ApplicationError(401, 'unauthorized'); });
  assert.equal(denied.status, 401); assert.deepEqual(await denied.json(), { error: 'unauthorized' });
  const failure = await getSettingsResponse(async () => { throw new Error('secret-internal-database-detail'); });
  assert.equal(failure.status, 503); assert.equal((await failure.text()).includes('secret-internal'), false);
});
