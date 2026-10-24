#!/bin/bash
# Start BIOracle's local preview from any directory. Compatible with macOS Bash.
set -euo pipefail

repo_dir="${BIORACLE_REPO:-$HOME/Documents/GitHub/BIOracle}"
python_bin="${BIORACLE_PYTHON:-python3}"
command -v "$python_bin" >/dev/null 2>&1 || {
    printf 'preview_bioracle requires Python 3.\n' >&2
    exit 1
}

exec "$python_bin" - "$repo_dir" "$@" <<'PY'
import argparse
import errno
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit
import webbrowser

parser = argparse.ArgumentParser(
    prog='preview_bioracle',
    description='Serve the local BIOracle website and open it in your browser.'
)
parser.add_argument('port', nargs='?', type=int, default=8000,
                    help='Local port (default: 8000; 0 selects an available port).')
parser.add_argument('--build', action='store_true',
                    help='Regenerate the HTML from the content data and page generator first.')
parser.add_argument('--no-open', action='store_true',
                    help='Start the preview without opening a browser.')
args = parser.parse_args(sys.argv[2:])
if not 0 <= args.port <= 65535:
    parser.error('The port must be between 0 and 65535.')

repo = Path(sys.argv[1]).expanduser().resolve()
if not repo.is_dir():
    parser.exit(1, f'BIOracle folder not found: {repo}\n')

if args.build:
    generator = repo / 'scripts/build.py'
    if not generator.is_file():
        parser.exit(1, f'Page generator not found: {generator}\n')
    result = subprocess.run([sys.executable, str(generator)], cwd=repo)
    if result.returncode:
        parser.exit(1, 'The build failed; the preview was not started.\n')

directory = repo / 'dist'
index = directory / 'index.html'
if not index.is_file():
    parser.exit(1, 'dist/index.html is missing. Try: preview_bioracle --build\n')


class CanonicalURL(HTMLParser):
    canonical = ''

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == 'link' and 'canonical' in attributes.get('rel', '').lower().split():
            self.canonical = attributes.get('href', '')


metadata = CanonicalURL()
metadata.feed(index.read_text(encoding='utf-8'))
base_path = urlsplit(metadata.canonical).path.rstrip('/')
if not base_path.startswith('/'):
    base_path = ''


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Also support builds intended for a project path such as /BIOracle/.
        parsed = urlsplit(path)
        if base_path and (parsed.path == base_path or parsed.path.startswith(base_path + '/')):
            parsed = parsed._replace(path=parsed.path[len(base_path):] or '/')
            path = urlunsplit(parsed)
        return super().translate_path(path)


handler = partial(PreviewHandler, directory=str(directory))
try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except OSError as error:
    if error.errno == errno.EADDRINUSE:
        parser.exit(1, f'Port {args.port} is already in use. Choose another, for example: preview_bioracle 8001\n')
    parser.exit(1, f'Could not start the preview: {error}\n')

with server:
    url = f'http://127.0.0.1:{server.server_port}{base_path}/'
    print(f'BIOracle preview: {url}', flush=True)
    print(f'Local files: {directory}', flush=True)
    print('Refresh your browser after edits. Press Control-C to stop.', flush=True)
    if not args.no_open:
        try:
            opened = webbrowser.open(url, new=2)
        except (webbrowser.Error, OSError):
            opened = False
        if not opened:
            print('Open the preview URL above in your browser.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nBIOracle preview stopped.', flush=True)
PY
