'use strict';

(() => {
  const config = JSON.parse(document.getElementById('archive-config').textContent);
  const main = document.getElementById('main');
  const form = document.getElementById('archive-unlock');
  const password = document.getElementById('archive-password');
  const status = document.getElementById('archive-status');
  const submit = form.querySelector('button');
  const storageKey = `bioracle-archive:${config.base}`;
  let key;
  let remembered = false;
  const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const encode = value => btoa(String.fromCharCode(...new Uint8Array(value)));
  function stored() { try { return sessionStorage.getItem(storageKey); } catch { return null; } }
  function forget() { try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ } }
  async function getFile(url, json = false) {
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error('The archive could not be loaded. Please try again.');
    return json ? response.json() : response.arrayBuffer();
  }
  async function decrypt(bytes, secret) {
    return crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.slice(0, 12)}, secret, bytes.slice(12));
  }
  async function unlock(secret) {
    const bytes = await getFile(`${config.base}/archive/content.enc`);
    const pages = JSON.parse(new TextDecoder().decode(await decrypt(bytes, secret)));
    const page = pages[config.page];
    if (!page) throw new Error('This archive page is unavailable.');
    key = secret;
    main.innerHTML = page.content;
    document.title = `${page.title} | BIOracle`;
    const bar = document.createElement('section');
    bar.className = 'wrap archive-access';
    bar.innerHTML = '<p>Archive unlocked for this tab.</p><button type="button" class="text-button">Lock archive</button><p class="form-status" role="status" aria-live="polite"></p>';
    bar.querySelector('button').addEventListener('click', () => {
      forget();
      key = null;
      main.replaceChildren();
      location.reload();
    });
    main.prepend(bar);
    const heading = main.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    if (location.hash) {
      try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView(); } catch { /* Invalid fragment. */ }
    }
  }

  main.addEventListener('click', async event => {
    const link = event.target.closest('a[data-archive-download]');
    if (!link || !key) return;
    event.preventDefault();
    const message = main.querySelector('.archive-access [role="status"]');
    message.textContent = 'Preparing download…';
    try {
      const bytes = await getFile(link.href);
      const data = await decrypt(bytes, key);
      const url = URL.createObjectURL(new Blob([data], {type:'application/octet-stream'}));
      const download = document.createElement('a');
      download.href = url;
      download.download = link.dataset.archiveDownload;
      document.body.append(download);
      download.click();
      download.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      message.textContent = 'Download ready.';
    } catch { message.textContent = 'Unable to download this file. Please try again.'; }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Unlocking…';
    try {
      const settings = await getFile(`${config.base}/archive/access.json`, true);
      const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.value), 'PBKDF2', false, ['deriveKey']);
      const secret = await crypto.subtle.deriveKey({name:'PBKDF2', salt:decode(settings.salt), iterations:settings.iterations, hash:'SHA-256'}, material, {name:'AES-GCM', length:256}, true, ['decrypt']);
      await unlock(secret);
      password.value = '';
      try {
        sessionStorage.setItem(storageKey, encode(await crypto.subtle.exportKey('raw', secret)));
        remembered = true;
      } catch { /* Unlocking still works when tab storage is unavailable. */ }
    } catch (error) {
      status.textContent = error.name === 'OperationError' ? 'Incorrect password. Please try again.' : 'Unable to unlock the archive. Please reload and try again.';
      password.select();
    } finally { submit.disabled = false; }
  });

  window.addEventListener('pageshow', event => {
    if (event.persisted && remembered && !stored()) {
      main.replaceChildren();
      location.reload();
    }
  });
  (async () => {
    if (!window.crypto?.subtle) {
      submit.disabled = true;
      status.textContent = 'Please open this page over HTTPS or in the localhost preview to unlock the archive.';
      return;
    }
    const saved = stored();
    if (!saved) return;
    submit.disabled = true;
    try {
      const secret = await crypto.subtle.importKey('raw', decode(saved), {name:'AES-GCM'}, false, ['decrypt']);
      await unlock(secret);
      remembered = true;
    } catch {
      forget();
      status.textContent = 'Enter the archive password to continue.';
    } finally { submit.disabled = false; }
  })();
})();
