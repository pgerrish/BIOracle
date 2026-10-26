// Run: BIORACLE_ARCHIVE_PASSWORD=... node --test scripts/test_archive.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {webcrypto} = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const settings = JSON.parse(fs.readFileSync(path.join(dist, 'archive/access.json')));
const password = process.env.BIORACLE_ARCHIVE_PASSWORD;
assert.ok(password, 'Set BIORACLE_ARCHIVE_PASSWORD when running archive checks.');
const base = process.env.BIORACLE_TEST_BASE_PATH || '';

async function derive(value) {
  const material = await webcrypto.subtle.importKey('raw', Buffer.from(value), 'PBKDF2', false, ['deriveKey']);
  return webcrypto.subtle.deriveKey({name:'PBKDF2', salt:Buffer.from(settings.salt, 'base64'), iterations:settings.iterations, hash:'SHA-256'}, material, {name:'AES-GCM', length:256}, false, ['decrypt']);
}
async function decrypt(bytes, key) {
  return Buffer.from(await webcrypto.subtle.decrypt({name:'AES-GCM', iv:bytes.subarray(0, 12)}, key, bytes.subarray(12)));
}
const payload = fs.readFileSync(path.join(dist, 'archive/content.enc'));

test('correct password unlocks every archive route using browser-compatible Web Crypto', async () => {
  const pages = JSON.parse(await decrypt(payload, await derive(password)));
  assert.ok(pages['/archive/'].content.includes('The record,'));
  assert.ok(Object.keys(pages).length > 1);
  for (const [route, page] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(dist, route, 'index.html'), 'utf8');
    assert.ok(html.includes('id="archive-unlock"'), route);
    assert.ok(html.includes('content="noindex,nofollow"'), route);
    assert.ok(!html.includes('Biography as supplied.'), route);
    assert.ok(!html.includes('Original scope &amp; pricing.'), route);
    const config = JSON.parse(html.match(/id="archive-config" type="application\/json">([^<]+)/)[1]);
    assert.equal(config.base, base);
    assert.equal(config.page, route);
    assert.ok(page.content.includes(base + '/'));
    assert.ok(!page.content.includes('href="/assets/source-'));
    if (route === '/archive/') assert.ok(page.content.includes(`href="${base}/archive/downloads/lab-source.zip.enc"`));
  }
});

test('incorrect password and tampered ciphertext fail authentication', async () => {
  await assert.rejects(decrypt(payload, await derive(password + '-incorrect')), {name:'OperationError'});
  const tampered = Buffer.from(payload);
  tampered[25] ^= 1;
  await assert.rejects(decrypt(tampered, await derive(password)), {name:'OperationError'});
});

test('archive downloads decrypt to exact original bytes, with no public plaintext copies', async () => {
  const key = await derive(password);
  for (const name of ['analytics-source.zip','lab-source.zip','source-publications.bib','source-records.json']) {
    assert.equal(fs.existsSync(path.join(dist, 'assets', name)), false);
    const bytes = await decrypt(fs.readFileSync(path.join(dist, 'archive/downloads', name + '.enc')), key);
    if (name === 'source-records.json') {
      assert.deepEqual(JSON.parse(bytes), JSON.parse(fs.readFileSync(path.join(root, 'content/site.json'))));
    } else {
      assert.deepEqual(bytes, fs.readFileSync(path.join(root, 'content/archive', name)));
    }
  }
});

test('published files contain neither password nor build key; public pages stay accessible', () => {
  assert.deepEqual(Object.keys(settings).sort(), ['iterations','salt']);
  const local = JSON.parse(fs.readFileSync(path.join(root, '.env.archive')));
  function check(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) check(file);
      else if (/\.(html|js|json|css|xml|txt)$/.test(file)) {
        const text = fs.readFileSync(file, 'utf8');
        assert.ok(!text.includes(password), file);
        assert.ok(!text.includes(local.key), file);
        assert.ok(!/href="[^\"]*\/assets\/(analytics-source\.zip|lab-source\.zip|source-records\.json|source-publications\.bib)/.test(text), file);
      }
    }
  }
  check(dist);
  for (const route of ['', 'about', 'research', 'publications', 'contact']) {
    assert.ok(!fs.readFileSync(path.join(dist, route, 'index.html'), 'utf8').includes('id="archive-unlock"'));
  }
});

test('unlock form rejects a wrong password, remembers the tab, downloads, and locks', async () => {
  const handlers = {};
  const store = new Map();
  let reloads = 0;
  let downloadName;
  const status = {textContent:''};
  const input = {value:'wrong-password', select() {}};
  const submit = {disabled:false};
  const form = {querySelector:() => submit, addEventListener:(name, fn) => { handlers[name] = fn; }};
  const bar = {
    querySelector(selector) {
      return selector === 'button' ? {addEventListener:(_, fn) => { handlers.lock = fn; }} : status;
    }
  };
  const main = {
    innerHTML:'', prepend() {}, replaceChildren() { this.innerHTML = ''; },
    querySelector(selector) { return selector === 'h1' ? {focus() {}} : status; },
    addEventListener:(_, fn) => { handlers.download = fn; }
  };
  const nodes = {main, 'archive-unlock':form, 'archive-password':input, 'archive-status':status,
    'archive-config':{textContent:JSON.stringify({base, page:'/archive/'})}};
  const context = {
    document: {
      getElementById:id => nodes[id], body:{append() {}},
      createElement:tag => tag === 'section' ? bar : {click() { downloadName = this.download; }, remove() {}}
    },
    window:{crypto:webcrypto, addEventListener:(name, fn) => { handlers[name] = fn; }},
    crypto:webcrypto, TextEncoder, TextDecoder, Uint8Array, Blob,
    URL:{createObjectURL:() => 'blob:test-download', revokeObjectURL() {}},
    sessionStorage:{getItem:k => store.get(k), setItem:(k, v) => store.set(k, v), removeItem:k => store.delete(k)},
    location:{hash:'', reload:() => { reloads++; }},
    atob:value => Buffer.from(value, 'base64').toString('binary'),
    btoa:value => Buffer.from(value, 'binary').toString('base64'),
    setTimeout() {},
    fetch:async url => {
      const data = fs.readFileSync(path.join(dist, url.slice(base.length)));
      return {ok:true, json:async () => JSON.parse(data), arrayBuffer:async () => Uint8Array.from(data).buffer};
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(dist, 'archive-unlock.js'), 'utf8'), context);
  await handlers.submit({preventDefault() {}});
  assert.match(status.textContent, /Incorrect password/);
  assert.equal(main.innerHTML, '');
  assert.equal(store.size, 0);
  input.value = password;
  await handlers.submit({preventDefault() {}});
  assert.match(main.innerHTML, /The record,/);
  assert.equal(input.value, '');
  assert.equal(store.size, 1);
  const savedKey = [...store.values()][0];
  assert.notEqual(savedKey, password);
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(savedKey, 'base64'), 'AES-GCM', false, ['decrypt']);
  assert.ok((await decrypt(payload, key)).length > 0);
  main.innerHTML = '';
  vm.runInNewContext(fs.readFileSync(path.join(dist, 'archive-unlock.js'), 'utf8'), context);
  const deadline = Date.now() + 2000;
  while (!main.innerHTML && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.match(main.innerHTML, /The record,/, 'Navigation restores access from the tab key.');
  await handlers.download({preventDefault() {}, target:{closest:() => ({
    href:base + '/archive/downloads/source-publications.bib.enc', dataset:{archiveDownload:'source-publications.bib'}
  })}});
  assert.equal(downloadName, 'source-publications.bib');
  assert.match(status.textContent, /Download ready/);
  handlers.lock();
  assert.equal(store.size, 0);
  assert.equal(main.innerHTML, '');
  assert.equal(reloads, 1);
  handlers.pageshow({persisted:true});
  assert.equal(reloads, 2, 'Back-forward cache cannot restore an archive after it is locked.');
});
