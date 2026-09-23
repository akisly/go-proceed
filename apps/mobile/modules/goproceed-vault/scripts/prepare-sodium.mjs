import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// The release asset digest is published by GitHub's release API. No floating
// package, pod, prebuilt binary or system libsodium can satisfy this build.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version, digest } = JSON.parse(readFileSync(resolve(root, 'scripts/sodium-pin.json'), 'utf8'));
const cache = resolve(root, '.build');
// Named by digest, not version alone: a re-pinned release never reuses an old tree.
const tag = `${version}-${digest.slice(0, 16)}`;
const source = resolve(cache, `libsodium-${tag}`);
const archive = resolve(cache, `libsodium-${tag}.tar.gz`);
mkdirSync(cache, { recursive: true });
if (!existsSync(archive)) {
  execFileSync('curl', ['--fail', '--location', '--proto', '=https', '--tlsv1.2', '--output', `${archive}.part`, `https://github.com/jedisct1/libsodium/releases/download/${version}-RELEASE/libsodium-${version}.tar.gz`], { stdio: 'inherit' });
  if (createHash('sha256').update(readFileSync(`${archive}.part`)).digest('hex') !== digest) throw new Error('Sodium release checksum mismatch');
  renameSync(`${archive}.part`, archive);
}
if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== digest) throw new Error('Sodium release checksum mismatch');
if (!existsSync(source)) {
  // Extract aside and rename, so an interrupted tar is never taken for a verified tree.
  const staging = resolve(cache, `.extract-${process.pid}`);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging);
  execFileSync('tar', ['-xzf', archive, '-C', staging]);
  renameSync(resolve(staging, `libsodium-${version}`), source);
  rmSync(staging, { recursive: true, force: true });
}

const target = process.argv[2] ?? 'host';
const architecture = process.argv[3] ?? process.arch;
const sdk = process.argv[4] ?? '';
const slice = `${target}-${architecture}-${sdk ? sdk.replaceAll(/[^a-zA-Z0-9]/g, '_') : 'default'}`;
const env = { ...process.env };
const args = ['--disable-shared', '--enable-static', '--with-pic', '--disable-dependency-tracking'];
if (target === 'ios') {
  const sdkPath = execFileSync('xcrun', ['--sdk', sdk, '--show-sdk-path'], { encoding: 'utf8' }).trim();
  env.CC = execFileSync('xcrun', ['--sdk', sdk, '--find', 'clang'], { encoding: 'utf8' }).trim();
  const triple = architecture === 'arm64' ? 'aarch64' : 'x86_64';
  args.push(`--host=${triple}-apple-darwin`);
  env.CFLAGS = `-arch ${architecture} -isysroot ${sdkPath} -m${sdk === 'iphoneos' ? 'iphoneos' : 'ios-simulator'}-version-min=16.4 -O2`;
  env.LDFLAGS = env.CFLAGS;
} else if (target === 'android') {
  const ndk = process.env.ANDROID_NDK_HOME;
  if (!ndk) throw new Error('ANDROID_NDK_HOME is required');
  const host = process.platform === 'darwin' ? 'darwin-x86_64' : 'linux-x86_64';
  const bin = resolve(ndk, 'toolchains', 'llvm', 'prebuilt', host, 'bin');
  const triples = { 'arm64-v8a': ['aarch64-linux-android', 'aarch64-linux-android'], 'armeabi-v7a': ['armv7a-linux-androideabi', 'arm-linux-androideabi'], x86: ['i686-linux-android', 'i686-linux-android'], x86_64: ['x86_64-linux-android', 'x86_64-linux-android'] };
  const pair = triples[architecture];
  if (!pair) throw new Error('Unsupported Android ABI');
  env.CC = resolve(bin, `${pair[0]}29-clang`);
  env.AR = resolve(bin, 'llvm-ar');
  env.RANLIB = resolve(bin, 'llvm-ranlib');
  env.STRIP = resolve(bin, 'llvm-strip');
  env.CFLAGS = '-O2 -fPIC';
  args.push(`--host=${pair[1]}`);
}
// The build directory is keyed by everything that shapes the library, flags included.
const recipe = createHash('sha256').update(JSON.stringify([args, env.CC ?? '', env.CFLAGS ?? '', env.LDFLAGS ?? '', env.AR ?? ''])).digest('hex').slice(0, 12);
const build = resolve(cache, `${tag}-${slice}-${recipe}`);
const install = resolve(build, 'installed');
mkdirSync(build, { recursive: true });
args.push(`--prefix=${install}`);
const result = resolve(install, 'lib/libsodium.a');
// Written after `make install` returns: an interrupted install leaves no marker and rebuilds.
const complete = resolve(build, '.installed');
if (!existsSync(result) || !existsSync(complete)) {
  execFileSync(resolve(source, 'configure'), args, { cwd: build, env, stdio: 'inherit' });
  execFileSync('make', ['-j2'], { cwd: build, env, stdio: 'inherit' });
  execFileSync('make', ['install'], { cwd: build, env, stdio: 'inherit' });
  writeFileSync(complete, tag);
}
// Machine-readable output used by build scripts; paths contain no user secrets.
writeFileSync(resolve(cache, `${target}-${architecture}-${sdk || 'default'}.json`), JSON.stringify({ version, digest, install }));
process.stdout.write(`${install}\n`);
