'use strict';

(() => {
  const config = window.BIOracleAccountConfig || {};
  const dialog = document.getElementById('account-dialog');
  const form = document.getElementById('account-form');
  const email = document.getElementById('account-email');
  const password = document.getElementById('account-password');
  const confirmation = document.getElementById('account-confirm');
  const submit = document.getElementById('account-submit');
  const status = document.getElementById('account-status');
  const modes = document.getElementById('account-mode-buttons');
  const signedIn = document.getElementById('account-signed-in');
  const signoutAnyway = document.getElementById('account-signout-anyway');
  const subscribers = new Set();
  let mode = 'signin', user = null, loading = true, client = null, ready = false;
  let signoutGuard = async () => true;
  let opener = null;
  const state = () => ({user, loading, configured:!!client});
  function notify() {
    document.querySelectorAll('[data-account-button]').forEach(button => { button.textContent = user ? 'Account' : 'Log in'; });
    for (const handler of subscribers) handler(state());
  }
  function render() {
    const loggedIn = !!user && mode !== 'reset';
    form.hidden = loggedIn;
    signedIn.hidden = !loggedIn;
    modes.hidden = loggedIn || mode === 'reset';
    document.getElementById('account-title').textContent = loggedIn ? 'Your account' : ({signin:'Log in', signup:'Create account', forgot:'Reset your password', reset:'Choose a new password'}[mode]);
    document.getElementById('account-description').hidden = loggedIn;
    document.getElementById('account-identity').textContent = user?.email || '';
    const newPassword = mode === 'signup' || mode === 'reset';
    document.getElementById('account-email-field').hidden = mode === 'reset';
    email.disabled = mode === 'reset';
    document.getElementById('account-password-field').hidden = mode === 'forgot';
    password.disabled = mode === 'forgot';
    password.minLength = newPassword ? 10 : 1;
    password.autocomplete = newPassword ? 'new-password' : 'current-password';
    document.getElementById('account-confirm-field').hidden = !newPassword;
    confirmation.disabled = !newPassword;
    confirmation.required = newPassword;
    document.getElementById('account-password-hint').hidden = !newPassword;
    document.getElementById('account-forgot').hidden = mode !== 'signin';
    submit.textContent = {signin:'Log in', signup:'Create account', forgot:'Send reset link', reset:'Save new password'}[mode];
    submit.disabled = !ready;
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.authMode === mode)));
  }
  function open() {
    opener = document.activeElement;
    render();
    if (!dialog.open) dialog.showModal();
    if (!client) status.textContent = 'Account sign-in is not available yet. You can still generate a contract draft without logging in.';
    else if (loading) status.textContent = 'Checking your account…';
    if (!user) email.focus();
  }
  window.BIOracleAccount = {
    get client() { return client; },
    get state() { return state(); },
    subscribe(handler) { subscribers.add(handler); handler(state()); return () => subscribers.delete(handler); },
    beforeSignOut(handler) { signoutGuard = handler; }, open
  };
  document.querySelectorAll('[data-account-button]').forEach(button => button.addEventListener('click', open));
  document.getElementById('account-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { password.value = ''; confirmation.value = ''; signoutAnyway.hidden = true; opener?.focus(); });
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.authMode; status.textContent = ''; password.value = ''; confirmation.value = ''; render(); email.focus();
  }));
  document.getElementById('account-forgot').addEventListener('click', () => { mode = 'forgot'; status.textContent = ''; render(); email.focus(); });
  function authError(error) {
    if (error.status === 429 || /rate_limit/.test(error.code || '')) return 'Too many attempts. Please wait a few minutes and try again.';
    if (error.code === 'email_not_confirmed') return 'Please confirm your email address using the account email, then log in.';
    if (error.code === 'invalid_credentials') return 'The email or password is incorrect.';
    if (error.code === 'weak_password') return 'Please choose a stronger password with at least 10 characters.';
    return 'We could not complete that request. Check your connection and try again.';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || !form.reportValidity()) return;
    if ((mode === 'signup' || mode === 'reset') && password.value !== confirmation.value) {
      status.textContent = 'The passwords do not match.'; confirmation.focus(); return;
    }
    submit.disabled = true; status.textContent = 'Please wait…';
    const redirectTo = `${location.origin}${config.basePath || ''}/business-model/`;
    try {
      if (mode === 'signin') {
        const {error} = await client.auth.signInWithPassword({email:email.value.trim(), password:password.value});
        if (error) throw error;
        status.textContent = ''; dialog.close();
      } else if (mode === 'signup') {
        const {data, error} = await client.auth.signUp({email:email.value.trim(), password:password.value, options:{emailRedirectTo:redirectTo}});
        if (error) throw error;
        password.value = ''; confirmation.value = '';
        if (data.session) { status.textContent = ''; dialog.close(); }
        else { mode = 'signin'; render(); status.textContent = 'Check your email to confirm your account, then return here and log in. Your current form entries will remain in this tab.'; }
      } else if (mode === 'forgot') {
        const {error} = await client.auth.resetPasswordForEmail(email.value.trim(), {redirectTo});
        if (error) throw error;
        status.textContent = 'If this address has an account, a password-reset email will arrive shortly.';
      } else {
        const {error} = await client.auth.updateUser({password:password.value});
        if (error) throw error;
        password.value = ''; confirmation.value = ''; mode = 'signin'; render(); status.textContent = 'Your password has been updated.';
      }
    } catch (error) { status.textContent = authError(error); }
    finally { submit.disabled = !ready; }
  });
  async function signOut(force = false) {
    const button = document.getElementById('account-signout');
    button.disabled = true;
    try {
      if (!force && !(await signoutGuard())) {
        status.textContent = 'Your latest changes have not been saved. Retry saving on the form, or choose to log out without those changes.';
        signoutAnyway.hidden = false; return;
      }
      const {error} = await client.auth.signOut({scope:'local'});
      if (error) throw error;
      status.textContent = ''; mode = 'signin'; dialog.close();
    } catch { status.textContent = 'Unable to log out. Please check your connection and try again.'; }
    finally { button.disabled = false; }
  }
  document.getElementById('account-signout').addEventListener('click', () => signOut());
  signoutAnyway.addEventListener('click', () => signOut(true));

  if (!config.supabaseUrl || !config.publishableKey || !window.supabase) {
    loading = false; render(); notify(); return;
  }
  try {
    client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
      auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce', storageKey:`bioracle-account-${new URL(config.supabaseUrl).hostname}`},
      global:{fetch:(url, options = {}) => fetch(url, {...options, signal:options.signal || AbortSignal.timeout(15000)})}
    });
    client.auth.onAuthStateChange((event, session) => {
      // Do not await Supabase calls inside this callback (the SDK holds an auth lock).
      user = session?.user ? {id:session.user.id, email:session.user.email} : null;
      loading = false; ready = true;
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') { mode = 'reset'; open(); }
        else render();
        notify();
      }, 0);
    });
    client.auth.getSession().then(({error}) => {
      if (error) { loading = false; ready = true; status.textContent = 'Unable to restore your session. Please log in again.'; render(); notify(); }
    }).catch(() => { loading = false; ready = true; render(); notify(); });
  } catch {
    client = null; loading = false; render(); notify();
  }
})();
