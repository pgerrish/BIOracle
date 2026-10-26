"""Shared account dialog; the client configuration contains public keys only."""
import json
import os


def write_account_config(root, dist, base_path):
    settings = json.loads((root / 'content/accounts.json').read_text())
    url = os.environ.get('BIORACLE_SUPABASE_URL', settings.get('supabaseUrl', '')).rstrip('/')
    key = os.environ.get('BIORACLE_SUPABASE_PUBLISHABLE_KEY', settings.get('publishableKey', ''))
    if bool(url) != bool(key):
        raise SystemExit('Set both BIORACLE_SUPABASE_URL and BIORACLE_SUPABASE_PUBLISHABLE_KEY, or leave both unset.')
    if key and not key.startswith('sb_publishable_'):
        raise SystemExit('Account client configuration requires an sb_publishable_ key, never a secret or service-role key.')
    if url and (not url.startswith('https://') or not url.endswith('.supabase.co')):
        raise SystemExit('Use the HTTPS Supabase project URL for account configuration.')
    config = dict(supabaseUrl=url, publishableKey=key, basePath=base_path)
    (dist / 'account-config.js').write_text('window.BIOracleAccountConfig = ' + json.dumps(config).replace('<', '\\u003c') + ';\n')


def account_dialog():
    return '''<dialog id="account-dialog" class="account-dialog" aria-labelledby="account-title">
      <div class="account-dialog-top"><p class="eyebrow">BIOracle account</p><button type="button" id="account-close" class="account-close" aria-label="Close account dialog">×</button></div>
      <h2 id="account-title">Log in</h2>
      <p id="account-description">Save your contract responses and continue whenever you return.</p>
      <div id="account-mode-buttons" class="account-mode-buttons"><button type="button" data-auth-mode="signin" aria-pressed="true">Log in</button><button type="button" data-auth-mode="signup" aria-pressed="false">Create account</button></div>
      <form id="account-form">
        <div class="form-field" id="account-email-field"><label for="account-email">Email address</label><input id="account-email" type="email" autocomplete="email" required maxlength="254"></div>
        <div class="form-field" id="account-password-field"><label for="account-password">Password</label><input id="account-password" type="password" autocomplete="current-password" required maxlength="200"></div>
        <div class="form-field" id="account-confirm-field" hidden><label for="account-confirm">Confirm password</label><input id="account-confirm" type="password" autocomplete="new-password" maxlength="200"></div>
        <p id="account-password-hint" class="form-note" hidden>Use at least 10 characters.</p>
        <button type="submit" id="account-submit" class="button" disabled>Log in</button>
        <button type="button" id="account-forgot" class="text-button">Forgot password?</button>
      </form>
      <div id="account-signed-in" hidden><p id="account-identity"></p><p>Your contract responses are saved privately to your account while you work.</p><button type="button" id="account-signout" class="button button-quiet">Log out</button><button type="button" id="account-signout-anyway" class="text-button" hidden>Log out without saving pending changes</button></div>
      <p id="account-status" class="form-status" role="status" aria-live="polite"></p>
      <noscript><p>Enable JavaScript to use your account.</p></noscript>
    </dialog>'''
