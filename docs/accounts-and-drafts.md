# BIOracle accounts and contract autosave

## Current setup state

The separate BIOracle Supabase project is active in the `pjg_music` organization in `us-east-1`, quoted at $0/month on its Free plan. Its project ref is `mrlxvxwxwayffzwcdaaw`. It does not alter the existing `violinist` project.

## Activate the backend

1. The project is already provisioned in `pjg_music` at the quoted $0/month cost.
2. The applied migration `20261026112342_create_bioracle_contract_drafts` creates the private draft table, RLS policies, and compare-and-set save function. The applied migration is also tracked in `supabase/migrations/20261026112342_create_bioracle_contract_drafts.sql`.
3. The project URL and publishable key are set in `content/accounts.json`. The key is explicitly designed for browser use and has no elevated database role.
4. In Supabase Authentication settings, set the Site URL to the deployed BIOracle site and add exact redirect URLs ending in `/business-model/` for the production host and local preview (`http://127.0.0.1:8000/business-model/`, `http://localhost:8000/business-model/`, including any project subpath). The account dialog uses PKCE for email confirmation and password-reset callbacks.
5. Email and password sign-in uses email confirmation. Supabase’s default mailer is restricted to pre-authorized team addresses and is rate-limited, so choose a production SMTP sender and add its credentials in the dashboard before public account registration. Auth credentials are not stored in this repository.
6. The security and performance advisors report no issues on this new project. Before public launch, test signup, email confirmation, login, password recovery, logout, and draft restoration with two accounts after the allowed URLs and email sender are configured.

## Implementation

- `scripts/accounts.py`: shared native HTML dialog and public build configuration.
- `dist/accounts.js`: signup, login, logout, password recovery, SDK session persistence, and account notifications. Account buttons appear in every navigation bar and above the contract form.
- `dist/vendor/supabase-2.116.0.js`: pinned Supabase SDK, vendored with its MIT license. No package install or CDN request is required at runtime.
- `dist/draft-sync.js`: tested autosave state machine with a 700 ms debounce, serialized writes, revision conflicts, and cancellation of stale account loads.
- `dist/contract-autosave.js`: form adapter. Only the schema's contract fields are saved; entries are restored on login and cleared from the page on logout or account change.
- `supabase/contract-drafts.sql`: server-side access control and compare-and-set saves. RLS applies even if a visitor modifies the JavaScript or sends API requests directly. The save function also checks the expected user ID so a late request cannot be written to a newly signed-in account.

The UI says “Saved” only after server confirmation. A network failure leaves the form dirty and offers retry; reconnection retries pending work. A failed initial load cannot overwrite a stored draft. If a guest draft or another device conflicts with a saved draft, the user chooses which version to keep. Logout attempts to finish saving first; if that fails, the user may explicitly discard pending edits. Navigating away with unsaved edits triggers the browser's standard unsaved-changes prompt.

One current draft is maintained per account. PDF generation does not require an account. The archive's separate shared-password encryption remains independent of these accounts.

## Verification

Run `node --test scripts/test_contract.cjs scripts/test_draft_sync.cjs scripts/test_accounts.cjs`. These exercise partial forms, PDF placeholders, auth dialog wiring, private account transitions, load/save failures, guest conflicts, multiple tabs, and stale requests. These local tests use mocked auth/storage adapters and do not verify email delivery or live browser sign-in.

On the selected live project, test with two authenticated users: each can insert/read/update only their own draft; another user ID and anonymous requests must be denied; changing `user_id` must be denied; stale revisions must fail with `40001`; current revisions must increment atomically. Verify restoration in a fresh browser session and check the security advisor results.

References: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
