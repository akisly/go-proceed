import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LIBSODIUM_MINISIGN_KEY, verifyMinisign } from './minisign.mjs';

const pin = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'sodium-pin.json'), 'utf8'));
const FILE = 'libsodium-9.9.9.tar.gz';

// A throwaway key that signs the way minisign does, so every refusal can be
// driven without network access or the real archive.
function signer() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const id = randomBytes(8);
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const key = Buffer.concat([Buffer.from('Ed'), id, raw]).toString('base64');
  const signatureText = (data, { algorithm = 'ED', trusted = `timestamp:1\tfile:${FILE}\thashed`, keyId = id } = {}) => {
    const signed = algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data;
    const signature = sign(null, signed, privateKey);
    const global = sign(null, Buffer.concat([signature, Buffer.from(trusted)]), privateKey);
    const line = Buffer.concat([Buffer.from(algorithm), keyId, signature]).toString('base64');
    return `untrusted comment: test\n${line}\ntrusted comment: ${trusted}\n${global.toString('base64')}\n`;
  };
  return { key, signatureText };
}

const data = Buffer.from('the pinned archive');
const flip = (base64, index) => {
  const bytes = Buffer.from(base64, 'base64');
  bytes[index] ^= 1;
  return bytes.toString('base64');
};
const replaceLine = (text, index, value) => text.split('\n').map((line, i) => (i === index ? value : line)).join('\n');

describe('verifyMinisign', () => {
  it('pins the key libsodium publishes, apart from the pin file', () => {
    expect(LIBSODIUM_MINISIGN_KEY).toBe('RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3');
    expect(Object.keys(pin).sort()).toEqual(['digest', 'minisig', 'version']);
  });

  it('reads the committed signature: prehashed, by the pinned key, for this release', () => {
    const lines = pin.minisig.split('\n');
    const line = Buffer.from(lines[1], 'base64');
    expect(line.subarray(0, 2).toString('latin1')).toBe('ED');
    expect(line.subarray(2, 10).equals(Buffer.from(LIBSODIUM_MINISIGN_KEY, 'base64').subarray(2, 10))).toBe(true);
    expect(lines[2].split(/\s+/)).toContain(`file:libsodium-${pin.version}.tar.gz`);
    // Without the archive the file signature fails, but only after the key id,
    // the global signature and the trusted comment have all passed.
    expect(() => verifyMinisign(Buffer.alloc(0), pin.minisig, `libsodium-${pin.version}.tar.gz`))
      .toThrow(`minisign: libsodium-${pin.version}.tar.gz does not match its signature`);
  });

  it('accepts a valid signature and refuses a flipped bit in the data or the signature', () => {
    const { key, signatureText } = signer();
    const text = signatureText(data);
    expect(() => verifyMinisign(data, text, FILE, key)).not.toThrow();
    const tampered = Buffer.from(data);
    tampered[0] ^= 1;
    expect(() => verifyMinisign(tampered, text, FILE, key)).toThrow('does not match its signature');
    const lines = text.split('\n');
    expect(() => verifyMinisign(data, replaceLine(text, 1, flip(lines[1], 20)), FILE, key)).toThrow('minisign:');
  });

  it('refuses the legacy unhashed algorithm even with a valid signature', () => {
    const { key, signatureText } = signer();
    expect(() => verifyMinisign(data, signatureText(data, { algorithm: 'Ed' }), FILE, key)).toThrow('only the prehashed ED');
  });

  it('refuses a signature made by another key, or a key changed only in the pin', () => {
    const { key, signatureText } = signer();
    expect(() => verifyMinisign(data, signatureText(data, { keyId: randomBytes(8) }), FILE, key)).toThrow('made by another key');
    expect(() => verifyMinisign(data, signatureText(data), FILE)).toThrow('made by another key');
    expect(() => verifyMinisign(data, pin.minisig, `libsodium-${pin.version}.tar.gz`, key)).toThrow('made by another key');
  });

  it('refuses an edited trusted comment, a flipped global signature and a comment naming another file', () => {
    const { key, signatureText } = signer();
    const text = signatureText(data);
    expect(() => verifyMinisign(data, text.replace(`file:${FILE}`, 'file:other.tar.gz'), FILE, key)).toThrow('trusted comment does not verify');
    expect(() => verifyMinisign(data, replaceLine(text, 3, flip(text.split('\n')[3], 5)), FILE, key)).toThrow('trusted comment does not verify');
    for (const trusted of [`xfile:${FILE}`, `file:${FILE}.x`, `timestamp:1 file:other.tar.gz`]) {
      expect(() => verifyMinisign(data, signatureText(data, { trusted }), FILE, key)).toThrow(`does not name ${FILE}`);
    }
  });

  it('refuses malformed text: bad base64, wrong lengths, missing lines, CRLF', () => {
    const { key, signatureText } = signer();
    const text = signatureText(data);
    const [, line, , global] = text.split('\n');
    expect(() => verifyMinisign(data, replaceLine(text, 1, `${line.slice(0, 10)}*${line.slice(11)}`), FILE, key)).toThrow('signature is not base64');
    const bytes = Buffer.from(line, 'base64');
    expect(() => verifyMinisign(data, replaceLine(text, 1, bytes.subarray(0, 73).toString('base64')), FILE, key)).toThrow('73 bytes, not 74');
    expect(() => verifyMinisign(data, replaceLine(text, 1, Buffer.concat([bytes, Buffer.alloc(1)]).toString('base64')), FILE, key)).toThrow('75 bytes, not 74');
    expect(() => verifyMinisign(data, replaceLine(text, 3, Buffer.from(global, 'base64').subarray(0, 63).toString('base64')), FILE, key)).toThrow('63 bytes, not 64');
    expect(() => verifyMinisign(data, text.split('\n').slice(0, 3).join('\n'), FILE, key)).toThrow('not four lines');
    expect(() => verifyMinisign(data, replaceLine(text, 0, 'comment: test'), FILE, key)).toThrow('untrusted comment');
    expect(() => verifyMinisign(data, text.replaceAll('\n', '\r\n'), FILE, key)).toThrow('LF line endings');
    expect(() => verifyMinisign(data, text, FILE, 'RWQ*')).toThrow('public key is not base64');
  });
});
