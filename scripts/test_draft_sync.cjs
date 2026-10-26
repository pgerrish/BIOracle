const test = require('node:test');
const assert = require('node:assert/strict');
const DraftSync = require('../dist/draft-sync.js');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };

function fixture(initialRows = {}) {
  const rows = new Map(Object.entries(initialRows));
  const events = [];
  const calls = [];
  let values = {};
  const sync = new DraftSync({
    delay:10000,
    read:() => values,
    write:data => { values = structuredClone(data); },
    changed:state => events.push(state),
    load:async user => rows.get(user) || null,
    save:async (user, answers, revision) => {
      calls.push({user,answers,revision});
      if ((rows.get(user)?.revision || 0) !== revision) {const e = new Error('Conflict'); e.code='40001'; throw e;}
      const row = {answers:structuredClone(answers), revision:revision + 1, updated_at:new Date().toISOString()};
      rows.set(user,row); return row;
    }
  });
  return {sync,rows,events,calls,edit(data) {values = data;sync.edit();},read:() => values};
}

test('partial answers save and restore after logout and login; account changes clear the form', async () => {
  const f=fixture();
  await f.sync.setUser('alice'); f.edit({scope:'Half-written scope', projectTitle:''});
  assert.equal(await f.sync.flush(),true);
  await f.sync.setUser(null); assert.deepEqual(f.read(),{});
  await f.sync.setUser('bob'); assert.deepEqual(f.read(),{}); assert.equal(f.calls.length,1);
  await f.sync.setUser(null); await f.sync.setUser('alice');
  assert.equal(f.read().scope,'Half-written scope');
  f.sync.cancel();
});

test('a new account adopts guest entries, but an existing draft prompts a choice', async () => {
  const f=fixture({alice:{answers:{scope:'Saved'},revision:4}});
  f.edit({scope:'Guest draft'}); await f.sync.setUser('alice');
  assert.equal(f.read().scope,'Guest draft'); assert.equal(f.events.at(-1).status,'conflict');
  assert.equal(await f.sync.flush(),false); assert.equal(f.calls.length,0);
  f.sync.useSaved(); assert.equal(f.read().scope,'Saved'); assert.equal(f.sync.dirty,false);
  await f.sync.setUser(null); f.edit({scope:'New guest draft'}); await f.sync.setUser('bob');
  await f.sync.flush(); assert.equal(f.rows.get('bob').answers.scope,'New guest draft');
  f.sync.cancel();
});

test('late load from the previous account cannot populate the next account', async () => {
  const f=fixture();const first=deferred();
  f.sync.load=async user => user==='alice' ? first.promise : {answers:{scope:'Bob'},revision:1};
  const pending=f.sync.setUser('alice'); await f.sync.setUser('bob');
  first.resolve({answers:{scope:'Private Alice text'},revision:1});await pending;
  assert.equal(f.read().scope,'Bob');assert.equal(f.sync.userId,'bob');
});

test('typing during a save is serialized and the latest answers win', async () => {
  const f=fixture(); await f.sync.setUser('alice');const pending=deferred();let count=0;
  f.sync.save=async (user,answers,revision) => {f.calls.push({user,answers,revision}); if (++count===1) await pending.promise; return {revision:revision+1,updated_at:new Date().toISOString()};};
  f.edit({scope:'First'});const saving=f.sync.flush();await new Promise(resolve => setImmediate(resolve));
  f.edit({scope:'Latest'});pending.resolve();await saving;
  assert.deepEqual(f.calls.map(c => c.answers.scope),['First','Latest']);
  assert.deepEqual(f.calls.map(c => c.revision),[0,1]);assert.equal(f.sync.dirty,false);f.sync.cancel();
});

test('failed save stays dirty and retry succeeds without false saved status', async () => {
  const f=fixture(); await f.sync.setUser('alice');const save=f.sync.save;
  f.sync.save=async () => {throw new Error('Offline');};f.edit({scope:'Unsaved'});
  assert.equal(await f.sync.flush(),false);assert.equal(f.sync.dirty,true);assert.equal(f.events.at(-1).status,'save-error');
  f.sync.save=save;assert.equal(await f.sync.retry(),true);assert.equal(f.rows.get('alice').answers.scope,'Unsaved');f.sync.cancel();
});

test('concurrent remote edit produces a conflict instead of silently overwriting it', async () => {
  const f=fixture({alice:{answers:{scope:'Initial'},revision:1}});await f.sync.setUser('alice');
  f.rows.set('alice',{answers:{scope:'Another device'},revision:2});f.edit({scope:'This device'});
  assert.equal(await f.sync.flush(),false);assert.equal(f.rows.get('alice').answers.scope,'Another device');
  f.sync.keepLocal();assert.equal(await f.sync.flush(),true);assert.equal(f.rows.get('alice').revision,3);assert.equal(f.rows.get('alice').answers.scope,'This device');f.sync.cancel();
});

test('load failure does not overwrite the server with an empty form', async () => {
  const f=fixture();f.sync.load=async () => {throw new Error('Offline');};await f.sync.setUser('alice');
  f.edit({scope:'New text'});assert.equal(await f.sync.flush(),false);assert.equal(f.calls.length,0);
  f.sync.load=async () => ({answers:{scope:'Saved elsewhere'},revision:1});await f.sync.retry();
  assert.equal(f.events.at(-1).status,'conflict');assert.equal(f.calls.length,0);f.sync.cancel();
});

test('switching accounts during a save cannot queue the previous answers for the new account', async () => {
  const f=fixture();await f.sync.setUser('alice');const pending=deferred();
  f.sync.save=async (user,answers,revision) => {f.calls.push({user,answers,revision});await pending.promise;return {revision:1};};
  f.edit({scope:'Private Alice text'});const saving=f.sync.flush();await new Promise(resolve => setImmediate(resolve));
  await f.sync.setUser('bob');pending.resolve();assert.equal(await saving,false);
  assert.deepEqual(f.read(),{});assert.equal(f.calls.length,1);assert.equal(f.calls[0].user,'alice');f.sync.cancel();
});
