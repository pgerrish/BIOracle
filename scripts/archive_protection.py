"""Encrypt the static archive; keep the build key outside the published folder."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess


class ArchiveProtection:
    def __init__(self, root):
        self.root = root
        self.pages = {}
        self.config_path = root / '.env.archive'
        password = os.environ.get('BIORACLE_ARCHIVE_PASSWORD')
        if not shutil.which('node'):
            raise SystemExit('Archive encryption requires Node.js 18 or later.')
        if password:
            salt = os.urandom(16)
            iterations = 600_000
            key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations, 32)
            self.config = dict(salt=base64.b64encode(salt).decode(), iterations=iterations,
                               key=base64.b64encode(key).decode())
            fd = os.open(self.config_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as output:
                json.dump(self.config, output)
        elif self.config_path.exists():
            self.config = json.loads(self.config_path.read_text())
        else:
            raise SystemExit('Set BIORACLE_ARCHIVE_PASSWORD for the first build. '
                             'Later builds reuse the ignored .env.archive key file.')

    def write(self, source_data):
        dist = self.root / 'dist'
        files = []

        def add(name, data):
            files.append(dict(destination=str(dist / 'archive' / name),
                              data=base64.b64encode(data).decode()))

        add('content.enc', json.dumps(self.pages, ensure_ascii=False).encode())
        for name in ('analytics-source.zip', 'lab-source.zip', 'source-publications.bib'):
            add('downloads/' + name + '.enc', (self.root / 'content/archive' / name).read_bytes())
        add('downloads/source-records.json.enc', json.dumps(source_data, ensure_ascii=False, indent=2).encode())
        subprocess.run(['node', str(self.root / 'scripts/archive_crypto.cjs')],
                       input=json.dumps(dict(key=self.config['key'], files=files)), text=True, check=True)
        (dist / 'archive/access.json').write_text(json.dumps({
            'salt': self.config['salt'], 'iterations': self.config['iterations']
        }))
