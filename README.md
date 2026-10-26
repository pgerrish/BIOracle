# BIOracle

A buildless, responsive website for BIOracle, combining the Evolutionary Risk Analytics and Evolutionary Processes Lab archives with the earlier Bio-Cyber-Security Agentics site.

This repository is the source for future publishing. It includes the complete site, images, original archives, and generated HTML.

## Clone to the Mac

The local project folder is `~/Documents/GitHub/BIOracle`, alongside the other website repositories. Run these commands in Terminal on the Mac:

```sh
mkdir -p "$HOME/Documents/GitHub"
git clone git@github.com:pgerrish/BIOracle.git "$HOME/Documents/GitHub/BIOracle"
cd "$HOME/Documents/GitHub/BIOracle"
```

The SSH URL matches the existing Mac GitHub workflow. Alternatively, clone `pgerrish/BIOracle` in GitHub Desktop and choose `Documents/GitHub` as the local parent folder.

## Edit and preview

The `/about/` page presents BIOracle's mission, its entrepreneurship/research/teaching model, and its three scientific foundations. Edit its text in the `about()` function in `scripts/build.py`. About appears in the main navigation, footer, and sitemap.

The opening About block links to the full mission statement at `/mission/` in a new tab or window. Edit it in `mission()` in `scripts/build.py`; it discusses student preparedness, rapid change, and the Academy's planned weekly faculty–student brainstorming meetings.

The same block links to `/business-model/`, which explains a proposed funding framework and provides a contract PDF generator. The page copy is in `scripts/business_model.py`; fields are defined in `content/contract-fields.json`. Allocation amounts, institutional identity, payment deadlines, governing law, IP arrangements, and other project-specific terms are entered by the user rather than asserted as established BIOracle policy.

The generator supports research-services and sponsored-research drafts. Only five fields are required: agreement type, project title, provider legal entity, client/sponsor legal entity, and scope. They are marked by accessible red asterisks. Optional blanks receive explicit “to be agreed” placeholders in the PDF. Supplied dates and amounts are validated; the budget must balance when all allocations and the total are supplied. Award-specific fields remain optional for drafting. The PDF includes 14 numbered sections, the entered project terms, financial and student-support provisions, IP, confidentiality, termination, dispute terms, and unsigned signature blocks. It is a template for legal review, not a grant-award instrument or an executed agreement.

`dist/contract-core.js` builds and paginates the PDF; `dist/contract-form.js` handles the form and download. PDF-lib 1.17.1 is vendored locally under `dist/vendor/`, with its MIT license; visitors do not need an external service or a server to generate the PDF. PDF generation remains in the browser. When logged in, raw form answers are automatically saved to the user’s private Supabase account draft; signed-out entries remain only in the open page until login. Passwords and session tokens are never stored in the draft. The generator remains disabled if JavaScript or the PDF library does not load. Standard PDF fonts support Latin-script names and punctuation; unsupported characters produce an explicit field error instead of being omitted from the contract.

Run `node --test scripts/test_contract.cjs` for contract checks. It also creates a fictional review sample at `output/pdf/business-model-example-contract.pdf` and a long-text stress sample under `tmp/pdfs/`. These use illustrative terms, not adopted BIOracle policies. Only `dist` is published. Funding-policy background for U.S. federal awards is linked to the official [2 CFR Part 200 cost principles](https://www.govinfo.gov/content/pkg/CFR-2026-title2-vol01/xhtml/CFR-2026-title2-vol01-part200-subpartE.html); other jurisdictions and award conditions need their own review.

Account login and autosave are implemented using the locally vendored Supabase SDK. The separate `$0/month` `bioracle` project is connected in the `pjg_music` organization; its RLS-protected private-draft schema is installed. Public sign-ups require Supabase email confirmations, so configure a production SMTP sender and the exact Auth redirect URLs before enabling general registration. See [account setup and verification](docs/accounts-and-drafts.md). Run `node --test scripts/test_accounts.cjs scripts/test_draft_sync.cjs` for local auth-dialog and autosave state-machine checks.

Edit `content/site.json` and `scripts/build.py` for page content and structure. The stylesheet and browser interactions are in `dist/styles.css` and `dist/site.js`.

Previewing requires Python 3.9 or later. Rebuilding also requires Node.js 18 or later for native archive encryption; no third-party packages are required. Install the global preview command once:

```sh
bash scripts/install-preview-command.sh
source ~/.zshrc
```

Start the preview from any directory:

```sh
preview_bioracle
```

It serves the current files from `~/Documents/GitHub/BIOracle/dist` at `http://127.0.0.1:8000/` and opens your browser. Refresh the browser after edits. Keep the Terminal window open; press Control-C to stop. Previewing does not change files or contact GitHub.

After changing `content/site.json` or the page generator, rebuild and preview with:

```sh
preview_bioracle --build
```

The default preview leaves direct HTML edits intact. If port 8000 is busy, choose another:

```sh
preview_bioracle 8001
```

Use `--no-open` to serve without opening a browser. Set `BIORACLE_REPO` if the clone lives elsewhere, or `BIORACLE_PYTHON` to select another Python executable. Builds with a project URL path such as `/BIOracle/` are also served at that path locally.

You can still rebuild with `python3 scripts/build.py` or `make build`; `make preview` runs the same preview command from the current repository. Re-run the preview installer after updating the script.

The generated `dist/` files are committed, so the repository can also be published directly as a static site.

## Sync changes

Install the global publishing command once, using the same `~/bin` convention as `publish_unm`:

```sh
bash scripts/install-publish-command.sh
source ~/.zshrc
```

After editing, run this from any directory:

```sh
publish_bioracle
```

To supply a commit message:

```sh
publish_bioracle "Refine the homepage"
```

The command uses `~/Documents/GitHub/BIOracle`, fetches the latest GitHub changes, temporarily saves uncommitted edits (including untracked files), rebases `main`, restores the edits, commits all changes, and pushes to `pgerrish/BIOracle`. The default commit message is `Update BIOracle website`. Existing stashes are preserved; synchronization stops on conflicts and retains the backup of your original edits. Pushes use ordinary Git without force.

When changing `content/site.json` or `scripts/build.py`, regenerate the site with `python3 scripts/build.py` before running `publish_bioracle`. CSS, JavaScript, images, and direct edits to existing files are published as they are. The publishing command does not regenerate files or deploy to a hosting service.

Re-run the installer after updating the publishing script. If the clone lives elsewhere, set `BIORACLE_REPO` to its absolute path. The remote is `pgerrish/BIOracle`; the primary branch is `main`.

## Publishing

The GitHub Pages workflow in `.github/workflows/deploy-pages.yml` publishes only the committed `dist/` directory when it changes on `main`. The BIOracle source repository stays private; the original archive files are not part of the Pages artifact. GitHub Pages sites are public even when their source repository is private. GitHub permits Pages from private repositories only on Pro, Team, or Enterprise plans. If this account is on Free, do not change this repository's visibility: publish `dist` from a separate public deployment repository instead.

The project URL is `https://pgerrish.github.io/BIOracle/`. Before building, set `BIORACLE_SITE_URL` to that exact URL. It controls canonical URLs, social metadata, the sitemap, and the `/BIOracle/` asset/navigation prefix:

```sh
BIORACLE_SITE_URL=https://pgerrish.github.io/BIOracle/ python3 scripts/build.py
```

To finish enabling Pages, open `pgerrish/BIOracle` → Settings → Pages, choose **GitHub Actions** as the source, and save. The workflow then deploys `dist/` on the next `main` push or a manual workflow run. Pages from a private repository require an eligible GitHub plan. The separate ChatGPT-hosted deployment at `https://bioracle.philip-gerrish.chatgpt.site` is unchanged.

For account confirmation and password reset links, add `https://pgerrish.github.io/BIOracle/business-model/` to the redirect URL allowlist in the Bioracle Supabase project's Auth URL settings. Public account email also requires configured SMTP. AI PDF analysis requires `OPENAI_API_KEY` in Supabase Edge Function secrets; the key must never be committed to this repository.

## Preserved content

The original archives are preserved intact in `content/archive/analytics-source.zip` and `content/archive/lab-source.zip`. Encrypted downloads are published under `dist/archive/downloads/`; plaintext originals are outside the publish directory. Unconfirmed template records are contextualized under `/archive/` and are excluded from the public sitemap. The main consortium contains the eight supplied named faculty members. Original translations are retained in `content/site.json` and the password-protected downloadable source material.

The contact form prepares an email draft for the visitor to review and send, and includes a copy-inquiry fallback. It does not claim to submit messages to a backend.

## Archive password protection

The archive index, all archive profile pages, and its ZIP, JSON, and bibliography downloads are encrypted with AES-256-GCM. The password derives the key using PBKDF2-SHA-256 with 600,000 iterations and a random salt. Published HTML contains only the password form; the password and build key are never included in `dist`. Browsers unlock it using [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) over HTTPS or the localhost preview.

Unlocking remembers the derived key in session storage for the current tab. “Lock archive” clears it. Disabling JavaScript or following a direct profile/download URL does not reveal plaintext archive content.

The current local build is configured. On a fresh clone, set `BIORACLE_ARCHIVE_PASSWORD` to the archive password for the first build. The build saves a private key file in `.env.archive` (ignored by Git and outside `dist`); subsequent local builds can reuse it without the environment variable. To change the password, supply a new value and rebuild, then deploy the entire updated `dist` folder. Hosting builds need the password supplied as a build secret. Missing configuration stops the build rather than publishing an unprotected archive.

Run the archive checks with `BIORACLE_ARCHIVE_PASSWORD` set: `node --test scripts/test_archive.cjs`. Checks cover correct and incorrect passwords, tamper detection, every archive route, downloads, tab access, locking, and absence of plaintext secrets in published files.

Publish only `dist`, and remove the old public `/assets/analytics-source.zip`, `/assets/lab-source.zip`, `/assets/source-records.json`, and `/assets/source-publications.bib` from an existing deployment when updating. This protects the static website, not the repository's source/history or copies already downloaded. Static encryption cannot rate-limit offline password guesses; it is not a replacement for server access control for confidential records.

## Artwork

The active background is `dist/assets/scattered-pencil-evolution-equations.webp`: varied coarse gray-and-dark-green pencil caricatures of viruses, bacteriophages, proteins, immune cells, flagellated and dividing bacteria, financial plots, and AI bots, with handwritten Fisher and Price equations. The wallpaper is displayed at 25% opacity over a soft forest-green solid background (`#d8e5dd`), with sketches another 20% smaller than the preceding version, with stable page-specific placement and 50% scroll-speed parallax. The homepage headline reads “Evolution is the hammer.” on one line.

Small labels, navigation, captions, and supporting text use larger type throughout, including responsive layouts. Text sections sit on subtle liquid-glass surfaces defined in `dist/atmosphere.css`, with translucent highlights, soft blur, and restrained borders. More opaque fallbacks support browsers without backdrop filtering and visitors who request reduced transparency. Decorative artwork is applied through CSS and is absent from the accessibility tree.

The built-in image-generation tool created the background. The full prompt and implementation notes are in [docs/scattered-pencil-glass.md](docs/scattered-pencil-glass.md). The preceding `dist/assets/scattered-pencil-caricatures.webp` and `dist/assets/scattered-pencil-science.webp` wallpapers, the earlier `dist/assets/evolution-pencil.webp` illustration and all eight studies in `artwork/originals/` and `dist/assets/artwork/` remain available.

The logo symbol uses the original blue-toned image, `dist/assets/bioracle-logo.png`, throughout the site at the current enlarged size; the HTML wordmark is unchanged. The green variant, `dist/assets/bioracle-logo-green.webp`, and its [edit prompt](docs/bioracle-logo-green-prompt.md) are retained. Researcher photographs are preserved. Font licensing is included in `dist/assets/font-license.txt`.
