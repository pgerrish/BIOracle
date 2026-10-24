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

Edit `content/site.json` and `scripts/build.py` for page content and structure. The stylesheet and browser interactions are in `dist/styles.css` and `dist/site.js`.

Python 3.9 or later is sufficient; no third-party packages or Node installation are required. Rebuild after changing the generator or data:

```sh
python3 scripts/build.py
python3 -m http.server --bind 127.0.0.1 --directory dist 8000
```

Open `http://127.0.0.1:8000/`. Press Control-C to stop the preview. `make build` and `make preview` are shortcuts for these commands.

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

Connect the hosting service to `pgerrish/BIOracle` and its `main` branch. The publish directory is `dist`. When a host runs a build, use `python3 scripts/build.py`; no dependency-install step is necessary.

Set `BIORACLE_SITE_URL` to the final public root URL when building. It controls canonical URLs, social metadata, and the sitemap. If the URL contains a project path, the build prefixes navigation and asset URLs accordingly. For example:

```sh
BIORACLE_SITE_URL=https://pgerrish.github.io/BIOracle python3 scripts/build.py
```

The default URL remains the existing ChatGPT-hosted preview, `https://bioracle.philip-gerrish.chatgpt.site`. That preview is a separate deployment; pushing to this repository does not update it or publish a new public site until a hosting integration is connected.

## Preserved content

The original archives are preserved intact in `dist/assets/analytics-source.zip` and `dist/assets/lab-source.zip`. Unconfirmed template records are contextualized under `/archive/` and are excluded from the public sitemap. The main consortium contains the eight supplied named faculty members. Original translations are retained in `content/site.json` and the downloadable source material.

The contact form prepares an email draft for the visitor to review and send, and includes a copy-inquiry fallback. It does not claim to submit messages to a backend.

## Artwork

The graphite pencil backdrop was generated with the built-in image-generation tool and saved as `dist/assets/evolution-pencil.webp`. Prompt: “A spare, sophisticated graphite field notebook composition of things that evolve: a giraffe, a cow, a corn plant, tiny bacteria, a generic virus particle, a financial model graph, and a small AI robot; fine graphite on warm ivory; wide composition, generous central negative space; understated Danish editorial style; no text, labels, or logo.”

The supplied BIOracle logo and researcher photographs are retained. Font licensing is included in `dist/assets/font-license.txt`.
