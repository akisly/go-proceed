import { createHash, createPublicKey, verify } from 'node:crypto';

// libsodium's release signing key, as https://doc.libsodium.org/installation
// publishes it (read 2026-09-24). It lives here, not in sodium-pin.json, so a
// pin bump cannot swap the key together with the digest and the signature:
// changing it is its own reviewed diff, and a unit test pins its value.
export const LIBSODIUM_MINISIGN_KEY = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3';

// Buffer.from(…, 'base64') skips characters it does not know, so every field is
// matched against strict base64 first and its decoded length checked exactly.
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function decode(field, value, length) {
  if (typeof value !== 'string' || !BASE64.test(value)) throw new Error(`minisign: ${field} is not base64`);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== length) throw new Error(`minisign: ${field} is ${bytes.length} bytes, not ${length}`);
  return bytes;
}

// Checks `data` against a minisign signature file's text (the .minisig, verbatim,
// LF line endings) made by `publicKey`, for the file named `fileName`:
// the prehashed algorithm only (`ED`: Ed25519 over BLAKE2b-512 of the data),
// the key id, the global signature over the signature and the trusted comment,
// and a trusted comment that names exactly this file. Throws on any mismatch.
// Format: https://jedisct1.github.io/minisign/ «Signature format».
export function verifyMinisign(data, signatureText, fileName, publicKey = LIBSODIUM_MINISIGN_KEY) {
  const key = decode('public key', publicKey, 42);
  // A public key's algorithm is always `Ed`, whichever way its signatures hash.
  if (key.subarray(0, 2).toString('latin1') !== 'Ed') throw new Error('minisign: the public key is not Ed25519');
  if (typeof signatureText !== 'string' || signatureText === '') throw new Error('minisign: no signature text (the pin carries no .minisig)');
  if (signatureText.includes('\r')) throw new Error('minisign: the signature text must use LF line endings');
  const lines = signatureText.split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length !== 4) throw new Error('minisign: the signature text is not four lines');
  if (!lines[0].startsWith('untrusted comment: ')) throw new Error('minisign: the first line is not an untrusted comment');
  if (!lines[2].startsWith('trusted comment: ')) throw new Error('minisign: the third line is not a trusted comment');
  const line = decode('signature', lines[1], 74);
  const algorithm = line.subarray(0, 2).toString('latin1');
  if (algorithm !== 'ED') throw new Error(`minisign: signature algorithm ${JSON.stringify(algorithm)} refused; only the prehashed ED is accepted`);
  if (!line.subarray(2, 10).equals(key.subarray(2, 10))) throw new Error('minisign: the signature was made by another key');
  const signature = line.subarray(10);
  const trusted = Buffer.from(lines[2].slice('trusted comment: '.length), 'utf8');
  const global = decode('global signature', lines[3], 64);
  const publicKeyObject = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, key.subarray(10)]), format: 'der', type: 'spki' });
  if (!verify(null, Buffer.concat([signature, trusted]), publicKeyObject, global)) throw new Error('minisign: the trusted comment does not verify');
  if (!trusted.toString('utf8').split(/\s+/).includes(`file:${fileName}`)) throw new Error(`minisign: the trusted comment does not name ${fileName}`);
  const digest = createHash('blake2b512').update(data).digest();
  if (!verify(null, digest, publicKeyObject, signature)) throw new Error(`minisign: ${fileName} does not match its signature`);
}
