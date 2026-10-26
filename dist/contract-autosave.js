'use strict';

(() => {
  const account = window.BIOracleAccount;
  const form = document.getElementById('contract-form');
  const schema = JSON.parse(document.getElementById('contract-schema').textContent).flatMap(group => group.fields);
  const status = document.getElementById('draft-save-status');
  const retry = document.getElementById('draft-save-retry');
  const conflict = document.getElementById('draft-conflict');
  if (!account || !window.BIOracleDraftSync) { status.textContent = 'Account saving is unavailable. Please reload to try again.'; return; }
  const read = () => Object.fromEntries(schema.map(field => [field.name, form.elements[field.name].value]));
  function normalized(answers = {}) {
    return Object.fromEntries(schema.map(field => [field.name, typeof answers[field.name] === 'string' ? answers[field.name] : '']));
  }
  const sync = new window.BIOracleDraftSync({
    read,
    write(answers) {
      const values = normalized(answers);
      for (const field of schema) form.elements[field.name].value = values[field.name];
      form.dispatchEvent(new Event('draft-restored'));
    },
    async load(userId) {
      const {data, error} = await account.client.from('bioracle_contract_drafts').select('answers,revision,updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data ? {...data, answers:normalized(data.answers)} : null;
    },
    async save(userId, answers, revision) {
      const {data, error} = await account.client.rpc('save_bioracle_contract_draft', {p_user_id:userId, p_answers:answers, p_expected_revision:revision});
      if (error) throw error;
      if (!data?.[0]) throw new Error('No save confirmation received');
      return data[0];
    },
    changed(state) {
      if (!account.state.configured) {
        status.textContent = 'Account saving is not available yet. Your entries can still be used to generate a PDF.';
        return;
      }
      retry.hidden = !['load-error','save-error'].includes(state.status);
      conflict.hidden = state.status !== 'conflict';
      const messages = {
        'signed-out': 'Log in to save your progress. Entries in this tab are not yet saved to an account.',
        loading:'Loading your saved draft…', ready:'Automatic saving is on. Your changes will be saved to your account.',
        pending:'Unsaved changes…', saving:'Saving to your account…',
        'load-error':'We could not load your saved draft. Your entries are still here; saving is paused to protect your existing work.',
        'save-error':'Changes are not saved yet. Check your connection; we will retry when you reconnect, or select Retry saving.',
        conflict:'Saving is paused until you choose which version to keep.'
      };
      if (state.status === 'saved') {
        const time = new Date(state.updatedAt);
        status.textContent = Number.isFinite(time.getTime()) ? `Saved to your account at ${time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.` : 'Saved to your account.';
      } else status.textContent = messages[state.status] || '';
    }
  });
  account.subscribe(state => {
    if (state.loading) { status.textContent = 'Checking your account…'; return; }
    if (!state.configured) { status.textContent = 'Account saving is not available yet. Your entries can still be used to generate a PDF.'; return; }
    void sync.setUser(state.user?.id || null);
  });
  account.beforeSignOut(() => sync.flush());
  form.addEventListener('input', () => sync.edit());
  form.addEventListener('change', () => sync.edit());
  retry.addEventListener('click', () => { void sync.retry(); });
  document.getElementById('draft-use-saved').addEventListener('click', () => sync.useSaved());
  document.getElementById('draft-use-local').addEventListener('click', () => sync.keepLocal());
  window.addEventListener('online', () => { if (sync.dirty || !sync.loaded) void sync.retry(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && sync.dirty) void sync.flush(); });
  window.addEventListener('beforeunload', event => {
    if (sync.dirty) { event.preventDefault(); event.returnValue = ''; }
  });
})();
