import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, unlinkSync, rmdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from './helpers/d1.mjs';
import { resolveOwnerBusiness } from '../server/business.ts';
import { createCustomer, getCustomer, getCustomerDetail, updateCustomer, deleteCustomer, listCustomers } from '../server/customers.ts';
import { customersGet, customerGet, customerWrite, customerDelete } from '../server/customers-api.ts';
import { validateCustomer, parseCustomerQuery, emptyCustomer, isCustomer, customerListPath } from '../lib/customers.ts';
import { ApplicationError } from '../server/errors.ts';
import { customerApiErrors, customerErrorText } from '../components/customers/api.ts';
import { hu } from '../lib/i18n/hu.ts';

const valid = { fullName: 'Váradi Áron', phoneNumber: '+36 (30) 111-2222', email: 'owner@example.test', notes: 'Only useful notes.' };
const defaultQuery = { query: '', page: 1, pageSize: 20, sort: 'name_asc' };
async function setup(filename) {
  const db = createDatabase(filename);
  const identity = { userId: 'owner', email: 'owner@example.test' };
  const business = await resolveOwnerBusiness(db, identity, { userId: 'owner' });
  return { db, business, resolve: async () => ({ db, business }) };
}
function req(method, body, origin = 'https://detailflow.example') {
  return new Request('https://detailflow.example/api/customers', { method, headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

test('customer validation requires a name and phone and allows blank optional fields', () => {
  assert.deepEqual(validateCustomer(emptyCustomer).errors, { fullName: 'nameRequired', phoneNumber: 'phoneRequired' });
  const parsed = validateCustomer({ fullName: '  Test customer  ', phoneNumber: '06-30-123-4567' });
  assert.equal(parsed.success, true); assert.deepEqual(parsed.data, { fullName: 'Test customer', phoneNumber: '06-30-123-4567', email: null, notes: '' });
  assert.equal(validateCustomer({ ...valid, email: '   ' }).data.email, null);
});
test('customer validation rejects invalid email, phone, oversized notes and mass assignment', () => {
  for (const email of ['invalid', 'x@@example.test', 'a@b', 42]) assert.equal(validateCustomer({ ...valid, email }).success, false);
  for (const phoneNumber of ['hello', '123', '123456\n123', '1'.repeat(21), '++361234567']) assert.equal(validateCustomer({ ...valid, phoneNumber }).success, false);
  for (const input of [{ ...valid, fullName: 'a'.repeat(161) }, { ...valid, notes: 'a'.repeat(10001) }, { ...valid, notes: null }, { ...valid, businessId: randomUUID() }, { ...valid, createdDate: '2020-01-01' }, { ...valid, id: randomUUID() }]) assert.equal(validateCustomer(input).success, false);
  assert.equal(validateCustomer({ ...valid, version: 1 }).success, false);
  assert.equal(validateCustomer({ ...valid, version: 1 }, true).success, true);
  assert.equal(validateCustomer(valid, true).success, false);
});
test('query parsing bounds pagination and rejects unrecognized sort expressions', () => {
  assert.deepEqual(parseCustomerQuery(new URLSearchParams()), defaultQuery);
  for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=100001', 'pageSize=101', 'sort=full_name%3BDELETE', `q=${'a'.repeat(201)}`, 'q=one+two+three+four+five+six+seven+eight+nine']) assert.equal(parseCustomerQuery(new URLSearchParams(query)), null);
  assert.equal(customerListPath({ query: 'A & B', sort: 'created_desc', page: 2 }), '/customers?q=A+%26+B&sort=created_desc&page=2');
  assert.equal(customerListPath({ query: '', sort: 'name_asc', page: 2, pageSize: 10 }), '/customers?page=2&pageSize=10');
});
test('create, read, edit and delete use persistent rows and stable creation dates', async () => {
  const { db, business } = await setup();
  try {
    const created = await createCustomer(db, business.id, valid);
    assert.equal(isCustomer(created), true); assert.equal(created.version, 1); assert.equal(created.fullName, valid.fullName);
    const updated = await updateCustomer(db, business.id, created.id, { ...valid, fullName: 'Edited customer', email: null }, created.version);
    assert.equal(updated.version, 2); assert.equal(updated.createdDate, created.createdDate); assert.equal(updated.email, null);
    assert.equal((await getCustomer(db, business.id, created.id)).fullName, 'Edited customer');
    await deleteCustomer(db, business.id, created.id, updated.version);
    await assert.rejects(getCustomer(db, business.id, created.id), { status: 404 });
  } finally { db.close(); }
});
test('customer changes survive reopening the database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'detailflow-customers-')); const filename = join(directory, 'customers.sqlite');
  const { db, business } = await setup(filename); const customer = await createCustomer(db, business.id, valid); db.close();
  const reopened = createDatabase(filename, false);
  try { assert.deepEqual(await getCustomer(reopened, business.id, customer.id), customer); }
  finally { reopened.close(); unlinkSync(filename); rmdirSync(directory); }
});
test('additive customer migration preserves existing customers and timestamps', () => {
  const db = createDatabase(':memory:', false);
  try {
    db.sqlite.exec(readFileSync(new URL('../drizzle/0000_foundation.sql', import.meta.url), 'utf8'));
    const business = randomUUID(); const customer = randomUUID();
    db.sqlite.prepare('INSERT INTO businesses (id, owner_user_id) VALUES (?, ?)').run(business, 'legacy-owner');
    db.sqlite.prepare('INSERT INTO customers (id, business_id, full_name, phone_number) VALUES (?, ?, ?, ?)').run(customer, business, 'Legacy customer', '1234567');
    const before = db.sqlite.prepare('SELECT * FROM customers WHERE id = ?').get(customer);
    db.sqlite.exec(readFileSync(new URL('../drizzle/0001_customer_management.sql', import.meta.url), 'utf8'));
    const after = db.sqlite.prepare('SELECT * FROM customers WHERE id = ?').get(customer);
    assert.equal(after.version, 1); assert.equal(after.full_name, before.full_name); assert.equal(after.created_at, before.created_at);
  } finally { db.close(); }
});
test('stale updates and deletes cannot overwrite or remove a changed customer', async () => {
  const { db, business } = await setup();
  try {
    const customer = await createCustomer(db, business.id, valid);
    await updateCustomer(db, business.id, customer.id, { ...valid, notes: 'New notes' }, 1);
    await assert.rejects(updateCustomer(db, business.id, customer.id, valid, 1), { status: 409, code: 'customerConflict' });
    await assert.rejects(deleteCustomer(db, business.id, customer.id, 1), { status: 409, code: 'customerConflict' });
    assert.equal((await getCustomer(db, business.id, customer.id)).notes, 'New notes');
  } finally { db.close(); }
});
test('all customer operations scope IDs and results to the resolved business', async () => {
  const { db, business } = await setup();
  try {
    const customer = await createCustomer(db, business.id, valid); const otherBusiness = randomUUID();
    await assert.rejects(getCustomer(db, otherBusiness, customer.id), { status: 404 });
    await assert.rejects(updateCustomer(db, otherBusiness, customer.id, valid, 1), { status: 404 });
    await assert.rejects(deleteCustomer(db, otherBusiness, customer.id, 1), { status: 404 });
    assert.equal((await listCustomers(db, otherBusiness, defaultQuery)).total, 0);
    assert.equal((await getCustomer(db, business.id, customer.id)).id, customer.id);
    await assert.rejects(getCustomer(db, business.id, "' OR 1=1 --"), { status: 404 });
  } finally { db.close(); }
});
test('search handles Hungarian accents, case, email, formatted phone and multiple words', async () => {
  const { db, business } = await setup();
  try {
    await createCustomer(db, business.id, valid);
    await createCustomer(db, business.id, { ...valid, fullName: 'Ábel Őri', phoneNumber: '06-20-555-5555', email: 'abel@example.test' });
    for (const query of ['VÁRADI', 'varadi', 'aron', '36301112222', '+36301112222', '30-111-2222', 'owner@example', 'varadi aron']) assert.equal((await listCustomers(db, business.id, { ...defaultQuery, query })).items[0]?.fullName, valid.fullName);
    assert.equal((await listCustomers(db, business.id, { ...defaultQuery, query: 'ABEL ori' })).items[0]?.fullName, 'Ábel Őri');
    assert.equal((await listCustomers(db, business.id, { ...defaultQuery, query: 'unmatched' })).total, 0);
  } finally { db.close(); }
});
test('search treats SQL wildcard characters as literal text', async () => {
  const { db, business } = await setup();
  try {
    await createCustomer(db, business.id, { ...valid, fullName: '100%_Workshop\\A' });
    await createCustomer(db, business.id, valid);
    for (const query of ['%', '_', '\\']) assert.equal((await listCustomers(db, business.id, { ...defaultQuery, query })).total, 1);
    assert.equal((await listCustomers(db, business.id, { ...defaultQuery, query: "' OR 1=1 --" })).total, 0);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM customers').get().n, 2);
  } finally { db.close(); }
});
test('sorting is accent-aware and pagination is stable and clamps empty pages', async () => {
  const { db, business } = await setup();
  try {
    const customers = [];
    for (const fullName of ['Zoltán', 'Ábel', 'Béla', 'Csaba', 'Dóra']) customers.push(await createCustomer(db, business.id, { ...valid, fullName }));
    const first = await listCustomers(db, business.id, { ...defaultQuery, pageSize: 2 });
    const second = await listCustomers(db, business.id, { ...defaultQuery, pageSize: 2, page: 2 });
    assert.deepEqual(first.items.map(c => c.fullName), ['Ábel', 'Béla']);
    assert.deepEqual(second.items.map(c => c.fullName), ['Csaba', 'Dóra']); assert.equal(first.totalPages, 3);
    assert.equal((await listCustomers(db, business.id, { ...defaultQuery, sort: 'name_desc' })).items[0].fullName, 'Zoltán');
    db.sqlite.prepare('UPDATE customers SET created_at = ? WHERE id = ?').run('2099-01-01T00:00:00Z', customers[2].id);
    assert.equal((await listCustomers(db, business.id, { ...defaultQuery, sort: 'created_desc' })).items[0].fullName, 'Béla');
    assert.equal((await listCustomers(db, business.id, { ...defaultQuery, pageSize: 2, page: 99 })).page, 3);
    const empty = await listCustomers(db, business.id, { ...defaultQuery, query: 'none', page: 99 });
    assert.deepEqual(empty.items, []); assert.equal(empty.page, 1);
  } finally { db.close(); }
});
test('detail reads only real registered vehicles and deletion preserves linked data', async () => {
  const { db, business } = await setup();
  try {
    const customer = await createCustomer(db, business.id, valid);
    assert.deepEqual((await getCustomerDetail(db, business.id, customer.id)).vehicles, []);
    const vehicle = randomUUID();
    db.sqlite.prepare('INSERT INTO vehicles (id, business_id, customer_id, manufacturer, model) VALUES (?, ?, ?, ?, ?)').run(vehicle, business.id, customer.id, 'Test make', 'Test model');
    assert.equal((await getCustomerDetail(db, business.id, customer.id)).vehicles[0].id, vehicle);
    await assert.rejects(deleteCustomer(db, business.id, customer.id, 1), { status: 409, code: 'customerHasRecords' });
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n, 1);
    assert.equal((await getCustomer(db, business.id, customer.id)).id, customer.id);
  } finally { db.close(); }
});
test('API completes create, list, detail, edit and delete with private responses', async () => {
  const { db, resolve } = await setup();
  try {
    const createdResponse = await customerWrite(req('POST', valid), resolve);
    assert.equal(createdResponse.status, 201); const { customer } = await createdResponse.json();
    assert.equal(createdResponse.headers.get('location'), `/customers/${customer.id}`);
    assert.match(createdResponse.headers.get('cache-control'), /no-store/);
    const listed = await customersGet(new Request('https://detailflow.example/api/customers?q=varadi'), resolve);
    assert.equal((await listed.json()).items[0].id, customer.id);
    assert.equal((await (await customerGet(customer.id, resolve)).json()).customer.id, customer.id);
    const updatedResponse = await customerWrite(req('PUT', { ...valid, notes: 'Edited', version: 1 }), resolve, customer.id);
    assert.equal(updatedResponse.status, 200); assert.equal((await updatedResponse.json()).customer.version, 2);
    assert.equal((await customerDelete(req('DELETE', { version: 2 }), customer.id, resolve)).status, 204);
    assert.equal((await customerGet(customer.id, resolve)).status, 404);
  } finally { db.close(); }
});
test('API requires authorization and rejects cross-origin mutation before context resolution', async () => {
  const unauthorized = async () => { throw new ApplicationError(401, 'unauthorized'); };
  assert.equal((await customersGet(new Request('https://detailflow.example/api/customers'), unauthorized)).status, 401);
  assert.equal((await customerWrite(req('POST', valid), unauthorized)).status, 401);
  assert.equal((await customerGet(randomUUID(), unauthorized)).status, 401);
  assert.equal((await customerDelete(req('DELETE', { version: 1 }), randomUUID(), unauthorized)).status, 401);
  let called = false;
  const unexpected = async () => { called = true; throw new Error('Unexpected'); };
  assert.equal((await customerWrite(req('POST', valid, 'https://other.example'), unexpected)).status, 403);
  assert.equal(called, false);
});
test('API validates writes and rejects malformed or oversized input without inserting records', async () => {
  const { db, resolve, business } = await setup();
  try {
    const invalid = await customerWrite(req('POST', { ...valid, fullName: '', phoneNumber: '' }), resolve);
    assert.equal(invalid.status, 422); assert.equal((await invalid.json()).fields.phoneNumber, 'phoneRequired');
    assert.equal((await customerWrite(req('POST', '{oops'), resolve)).status, 400);
    assert.equal((await customerWrite(req('POST', 'x'.repeat(65_537)), resolve)).status, 413);
    assert.equal((await customerWrite(req('POST', { ...valid, businessId: business.id }), resolve)).status, 422);
    assert.equal((await customerDelete(req('DELETE', { version: 1, businessId: business.id }), randomUUID(), resolve)).status, 422);
    assert.equal((await customersGet(new Request('https://detailflow.example/api/customers?page=-1'), resolve)).status, 400);
    assert.equal((await listCustomers(db, business.id, defaultQuery)).total, 0);
  } finally { db.close(); }
});
test('valid long Hungarian notes fit the customer JSON body limit', async () => {
  const { db, resolve } = await setup();
  try {
    const response = await customerWrite(req('POST', { ...valid, notes: 'ő'.repeat(10_000) }), resolve);
    assert.equal(response.status, 201); assert.equal((await response.json()).customer.notes.length, 10_000);
  } finally { db.close(); }
});
test('API errors never expose SQL exception text', async () => {
  const response = await customersGet(new Request('https://detailflow.example/api/customers'), async () => { throw new Error('secret SQL connection details'); });
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'unavailable' });
});
test('client error handling ignores unknown fields and never renders arbitrary server text', () => {
  assert.deepEqual(customerApiErrors(null), { form: 'unexpected' });
  assert.deepEqual(customerApiErrors({ error: 'invalidInput', fields: { fullName: 'nameRequired', businessId: 'injected', notes: 42 } }), { fullName: 'nameRequired', form: 'invalidInput' });
  assert.equal(customerErrorText(hu, '<script>arbitrary internal error</script>'), hu.customerErrors.unexpected);
});
test('customer DTO guard rejects malformed records before form navigation', () => {
  assert.equal(isCustomer(null), false);
  assert.equal(isCustomer({ ...valid, id: 'invalid', createdDate: 'bad', updatedAt: 'bad', version: 1 }), false);
  assert.equal(isCustomer({ ...valid, id: randomUUID(), createdDate: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 0 }), false);
});
