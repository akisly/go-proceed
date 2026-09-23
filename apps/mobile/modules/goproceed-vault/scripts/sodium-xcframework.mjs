import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds the pinned libsodium from prepare-sodium.mjs for every iOS slice the
// app links (device arm64, simulator arm64 + x86_64) and packs it as the
// xcframework the podspec vendors. Output is a build product, never committed.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The stamp covers the pin and both build scripts, so a flag change also rebuilds.
const pin = createHash('sha256')
  .update(readFileSync(resolve(root, 'scripts/sodium-pin.json')))
  .update(readFileSync(resolve(root, 'scripts/prepare-sodium.mjs')))
  .update(readFileSync(resolve(root, 'scripts/sodium-xcframework.mjs')))
  .digest('hex');
const vendor = resolve(root, 'ios/Vendor');
const output = resolve(vendor, 'Sodium.xcframework');
const stamp = resolve(vendor, 'Sodium.stamp');
// Reused only when it was built from exactly this pin; a bump or a torn build rebuilds.
const current = existsSync(output) && existsSync(stamp) && readFileSync(stamp, 'utf8') === pin;
if (current && !process.argv.includes('--force')) process.exit(0);

const slice = (architecture, sdk) => {
  execFileSync(process.execPath, [resolve(root, 'scripts/prepare-sodium.mjs'), 'ios', architecture, sdk], { stdio: ['ignore', 'ignore', 'inherit'] });
  return JSON.parse(readFileSync(resolve(root, `.build/ios-${architecture}-${sdk}.json`), 'utf8')).install;
};
const device = slice('arm64', 'iphoneos');
const simulators = [slice('arm64', 'iphonesimulator'), slice('x86_64', 'iphonesimulator')];

const fat = resolve(root, '.build/ios-simulator-universal');
mkdirSync(fat, { recursive: true });
execFileSync('lipo', ['-create', ...simulators.map((install) => `${install}/lib/libsodium.a`), '-output', `${fat}/libsodium.a`], { stdio: 'inherit' });

mkdirSync(vendor, { recursive: true });
const staging = resolve(vendor, `.Sodium-${process.pid}.xcframework`);
rmSync(staging, { recursive: true, force: true });
execFileSync('xcodebuild', [
  '-create-xcframework',
  '-library', `${device}/lib/libsodium.a`, '-headers', `${device}/include`,
  '-library', `${fat}/libsodium.a`, '-headers', `${simulators[0]}/include`,
  '-output', staging,
], { stdio: 'inherit' });
rmSync(stamp, { force: true });
rmSync(output, { recursive: true, force: true });
renameSync(staging, output);
writeFileSync(stamp, pin);
