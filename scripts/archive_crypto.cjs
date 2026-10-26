// Build-time encryption using Node's native, authenticated AES-256-GCM.
const {createCipheriv, createDecipheriv, randomBytes} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const key = Buffer.from(input.key, 'base64');
for (const item of input.files) {
  const plaintext = Buffer.from(item.data, 'base64');
  // Keep unchanged ciphertext stable across ordinary site rebuilds.
  if (fs.existsSync(item.destination)) {
    try {
      const previous = fs.readFileSync(item.destination);
      const decipher = createDecipheriv('aes-256-gcm', key, previous.subarray(0, 12));
      decipher.setAuthTag(previous.subarray(-16));
      const decoded = Buffer.concat([decipher.update(previous.subarray(12, -16)), decipher.final()]);
      if (decoded.equals(plaintext)) continue;
    } catch { /* A new key or invalid old payload requires fresh encryption. */ }
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([iv, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  fs.mkdirSync(path.dirname(item.destination), {recursive:true});
  fs.writeFileSync(item.destination, encrypted);
}
