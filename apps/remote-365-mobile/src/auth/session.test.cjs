const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const compiled = ts.transpileModule(fs.readFileSync(`${__dirname}/session.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const { createSessionManager } = exportsObject;
const original = { accessToken: 'expired', refreshToken: 'refresh', user: { id: 'one', email: 'one@example.com' } };
const renewed = { ...original, accessToken: 'renewed', refreshToken: 'rotated' };
function setup(refresh) {
  const changes = [], writes = [];
  return { changes, writes, manager: createSessionManager({ refresh, onChange: x => changes.push(x), persist: async x => { writes.push(x); } }) };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

test('expired saved session refreshes and persists rotated credentials', async () => {
  const { manager, writes } = setup(async token => { assert.equal(token, 'refresh'); return renewed; });
  await manager.set(original);
  await manager.refresh();
  assert.equal(manager.get().accessToken, 'renewed');
  assert.equal(writes.at(-1).refreshToken, 'rotated');
});
test('remember unchecked keeps credentials in memory only, including after refresh', async () => {
  const { manager, writes } = setup(async () => renewed);
  await manager.set(original, false);
  await manager.refresh();
  assert.equal(manager.get().accessToken, 'renewed');
  assert.ok(writes.every(x => x === null));
});
test('concurrent refreshes share one server request', async () => {
  const request = deferred(); let calls = 0;
  const { manager } = setup(() => { calls++; return request.promise; });
  await manager.set(original);
  const first = manager.refresh(), second = manager.refresh();
  request.resolve(renewed);
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});
test('late refresh cannot undo logout or repersist credentials', async () => {
  const request = deferred(); const { manager, writes } = setup(() => request.promise);
  await manager.set(original);
  const refresh = manager.refresh();
  await manager.set(null);
  request.resolve(renewed);
  assert.equal(await refresh, null);
  assert.equal(manager.get(), null);
  assert.equal(writes.at(-1), null);
});
test('late refresh cannot overwrite a different sign-in', async () => {
  const request = deferred(); const { manager } = setup(() => request.promise);
  await manager.set(original);
  const refresh = manager.refresh();
  const next = { ...original, accessToken: 'new-login', user: { id: 'two', email: 'two@example.com' } };
  await manager.set(next);
  request.resolve(renewed);
  await refresh;
  assert.equal(manager.get(), next);
});
test('network failure retains session and allows a later retry', async () => {
  let calls = 0;
  const { manager, writes } = setup(async () => { if (++calls === 1) throw new Error('Offline'); return renewed; });
  await manager.set(original);
  await assert.rejects(manager.refresh(), /Offline/);
  assert.equal(manager.get(), original);
  assert.equal(writes.at(-1), original);
  await manager.refresh();
  assert.equal(manager.get().accessToken, 'renewed');
});
test('missing or rejected refresh credentials report authentication failure', async () => {
  const { manager } = setup(async () => { throw Object.assign(new Error('Revoked'), { status: 401 }); });
  await manager.set({ ...original, refreshToken: undefined });
  await assert.rejects(manager.refresh(), e => e.status === 401);
  await manager.set(original);
  await assert.rejects(manager.refresh(), e => e.status === 401);
});
test('invalid refresh response cannot replace working account data', async () => {
  const { manager } = setup(async () => ({}));
  await manager.set(original);
  await assert.rejects(manager.refresh(), /Invalid session/);
  assert.equal(manager.get(), original);
});
