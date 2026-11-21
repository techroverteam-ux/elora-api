const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Load the existing TypeScript modules without starting the API or connecting to a DB.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } },
).outputText, filename);

const { applyAssignedPersonnelFilters, getAssignedPersonnel } = require('../src/modules/store/assignedPersonnel.ts');
const Store = require('../src/modules/store/store.model.ts').default;
const User = require('../src/modules/user/user.model.ts').default;
const Client = require('../src/modules/client/client.model.ts').default;
const { storeScopeFilter } = require('../src/utils/access.ts');
const a = '111111111111111111111111';
const b = '222222222222222222222222';

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('personnel selection intersects existing client scope, search, status and field-user restrictions', () => {
  const scope = storeScopeFilter({ ids: [a], codes: ['CLIENT-A'] });
  const query = { ...scope, currentStatus: 'RECCE_ASSIGNED', 'workflow.recceAssignedTo': a };
  query.$and.push({ storeName: /shop/i });
  const previous = [...query.$and];
  assert.equal(applyAssignedPersonnelFilters(query, { recceAssignedTo: b }), null);
  assert.deepEqual(query.$and, [...previous, { 'workflow.recceAssignedTo': { $in: [b] } }]);
  assert.equal(query['workflow.recceAssignedTo'], a);
  assert.equal(query.currentStatus, 'RECCE_ASSIGNED');
});

test('supports multiple IDs, repeated query params, and both assignment stages', () => {
  const query = {};
  assert.equal(applyAssignedPersonnelFilters(query, {
    recceAssignedTo: [`${a}, ${b}`, a], installationAssignedTo: b,
  }), null);
  assert.deepEqual(query.$and, [
    { 'workflow.recceAssignedTo': { $in: [a, b] } },
    { 'workflow.installationAssignedTo': { $in: [b] } },
  ]);
  const cast = Store.find(query).cast(Store);
  assert.equal(cast.$and[0]['workflow.recceAssignedTo'].$in[0].toString(), a);
});

test('clearing personnel leaves the query unrestricted by personnel', () => {
  const query = { currentStatus: 'COMPLETED' };
  assert.equal(applyAssignedPersonnelFilters(query, { recceAssignedTo: '', installationAssignedTo: undefined }), null);
  assert.deepEqual(query, { currentStatus: 'COMPLETED' });
});

test('rejects malformed IDs and query operators without changing existing scope', () => {
  for (const value of ['invalid', `${a},bad`, { $ne: null }, [a, { $gt: '' }], []]) {
    const query = { $and: [{ clientCode: 'CLIENT-A' }] };
    assert.match(applyAssignedPersonnelFilters(query, { recceAssignedTo: value }), /Invalid recceAssignedTo/);
    assert.deepEqual(query, { $and: [{ clientCode: 'CLIENT-A' }] });
  }
});

test('field users cannot enumerate personnel', async () => {
  const res = response();
  const distinct = mock.method(Store, 'distinct', () => { throw new Error('must not query'); });
  try {
    await getAssignedPersonnel({ user: { roles: [{ code: 'RECCE' }] }, query: { stage: 'RECCE' } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(distinct.mock.callCount(), 0);
  } finally { distinct.mock.restore(); }
});

test('invalid stage is rejected before database access', async () => {
  const res = response();
  await getAssignedPersonnel({ user: { roles: [{ code: 'ADMIN' }] }, query: { stage: 'OTHER' } }, res);
  assert.equal(res.statusCode, 400);
});

test('sub admins only get assignees from their clients, without requiring User Management access', async () => {
  const res = response();
  const people = [{ _id: b, name: 'Same Name', email: 'one@example.test' }];
  const clients = mock.method(Client, 'find', (filter) => {
    assert.deepEqual(filter, { _id: { $in: [a] } });
    return { select: () => ({ lean: async () => [{ _id: a, clientCode: 'CLIENT-A' }] }) };
  });
  const distinct = mock.method(Store, 'distinct', async (field, filter) => {
    assert.equal(field, 'workflow.recceAssignedTo');
    assert.deepEqual(filter, { ...storeScopeFilter({ ids: [a], codes: ['CLIENT-A'] }), [field]: { $ne: null } });
    return [b];
  });
  const users = mock.method(User, 'find', (filter) => {
    assert.deepEqual(filter, { _id: { $in: [b] } });
    return { select: (projection) => {
      assert.equal(projection, '_id name email');
      return { sort: () => ({ lean: async () => people }) };
    } };
  });
  try {
    await getAssignedPersonnel({ user: { roles: [{ name: 'Sub Admin' }], assignedClients: [a] }, query: { stage: 'RECCE' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { personnel: people });
  } finally { clients.mock.restore(); distinct.mock.restore(); users.mock.restore(); }
});

test('installation choices retain inactive assignees and distinct people with the same name', async () => {
  const res = response();
  const people = [{ _id: a, name: 'Same Name' }, { _id: b, name: 'Same Name' }];
  const distinct = mock.method(Store, 'distinct', async (field, filter) => {
    assert.equal(field, 'workflow.installationAssignedTo');
    assert.deepEqual(filter, { [field]: { $ne: null } });
    return [a, b];
  });
  const users = mock.method(User, 'find', (filter) => {
    assert.deepEqual(filter, { _id: { $in: [a, b] } }); // No isActive filter: historical assignments remain filterable.
    return { select: () => ({ sort: () => ({ lean: async () => people }) }) };
  });
  try {
    await getAssignedPersonnel({ user: { roles: [{ code: 'SUPER_ADMIN' }] }, query: { stage: 'INSTALLATION' } }, res);
    assert.deepEqual(res.body.personnel, people);
  } finally { distinct.mock.restore(); users.mock.restore(); }
});
