#include "GPVault.h"
#include <sodium.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static const unsigned char magic[8] = {'G', 'P', 'V', 'L', 'T', 0, 0, 1};
struct gp_reader {
  FILE *file;
  crypto_secretstream_xchacha20poly1305_state stream;
  crypto_hash_sha256_state hash;
  unsigned char aad[32];
  unsigned char plain[GP_VAULT_CHUNK_BYTES];
  unsigned char cipher[GP_VAULT_CHUNK_BYTES + crypto_secretstream_xchacha20poly1305_ABYTES];
  unsigned char expected_hash[32];
  size_t offset, length;
  uint64_t size, expected_size;
  int final, failed;
};
void gp_wipe(void *p, size_t n) { sodium_memzero(p, n); }
int gp_random_key(unsigned char key[32]) {
  if (sodium_init() < 0) return -1;
  crypto_secretstream_xchacha20poly1305_keygen(key);
  return 0;
}
int gp_sha256_text(const char *value, char hex[65]) {
  unsigned char hash[32];
  if (sodium_init() < 0 || !value) return -1;
  crypto_hash_sha256(hash, (const unsigned char *)value, strlen(value));
  sodium_bin2hex(hex, 65, hash, sizeof hash);
  return 0;
}
static int write_frame(FILE *f, const unsigned char *p, unsigned long long n) {
  unsigned char length[4] = {(unsigned char)n, (unsigned char)(n >> 8), (unsigned char)(n >> 16), (unsigned char)(n >> 24)};
  return fwrite(length, 1, 4, f) == 4 && fwrite(p, 1, n, f) == n ? 0 : -1;
}
int gp_encrypt_file(const char *input, const char *output, const unsigned char key[32],
                    const char *binding, uint64_t maximum, char hash[65], uint64_t *size) {
  int result = -1;
  FILE *in = NULL, *out = NULL;
  unsigned char plain[GP_VAULT_CHUNK_BYTES], cipher[GP_VAULT_CHUNK_BYTES + crypto_secretstream_xchacha20poly1305_ABYTES];
  unsigned char header[crypto_secretstream_xchacha20poly1305_HEADERBYTES], aad[32], digest[32];
  crypto_hash_sha256_state sha;
  crypto_secretstream_xchacha20poly1305_state state;
  uint64_t total = 0;
  struct stat statbuf;
  if (sodium_init() < 0 || maximum == 0 || maximum > GP_VAULT_MAX_BYTES) goto done;
  int fd = open(input, O_RDONLY | O_NOFOLLOW);
  if (fd < 0) goto done;
  if (fstat(fd, &statbuf) || !S_ISREG(statbuf.st_mode) || statbuf.st_size <= 0 || (uint64_t)statbuf.st_size > maximum) { close(fd); goto done; }
  in = fdopen(fd, "rb");
  if (!in) { close(fd); goto done; }
  fd = open(output, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600);
  if (fd < 0) goto done;
  out = fdopen(fd, "wb");
  if (!out) { close(fd); goto done; }
  crypto_hash_sha256(aad, (const unsigned char *)binding, strlen(binding));
  crypto_hash_sha256_init(&sha);
  crypto_secretstream_xchacha20poly1305_init_push(&state, header, key);
  if (fwrite(magic, 1, sizeof magic, out) != sizeof magic || fwrite(header, 1, sizeof header, out) != sizeof header) goto done;
  for (;;) {
    size_t count = fread(plain, 1, sizeof plain, in);
    if (count == 0) { if (ferror(in)) goto done; break; }
    total += count;
    if (total > maximum) goto done;
    crypto_hash_sha256_update(&sha, plain, count);
    unsigned long long length;
    crypto_secretstream_xchacha20poly1305_push(&state, cipher, &length, plain, count, aad, sizeof aad, crypto_secretstream_xchacha20poly1305_TAG_MESSAGE);
    if (write_frame(out, cipher, length)) goto done;
  }
  if (total == 0 || total != (uint64_t)statbuf.st_size) goto done;
  unsigned long long length;
  crypto_secretstream_xchacha20poly1305_push(&state, cipher, &length, plain, 0, aad, sizeof aad, crypto_secretstream_xchacha20poly1305_TAG_FINAL);
  if (write_frame(out, cipher, length) || fflush(out) || fsync(fileno(out))) goto done;
  crypto_hash_sha256_final(&sha, digest);
  sodium_bin2hex(hash, 65, digest, sizeof digest);
  *size = total;
  result = 0;
done:
  if (in) fclose(in);
  if (out && fclose(out) != 0) result = -1;
  if (result != 0 && out) unlink(output);
  sodium_memzero(plain, sizeof plain); sodium_memzero(cipher, sizeof cipher);
  sodium_memzero(&state, sizeof state); sodium_memzero(&sha, sizeof sha);
  return result;
}
gp_reader *gp_reader_open(const char *path, const unsigned char key[32], const char *binding,
                          const char *expected_hash, uint64_t expected_size) {
  if (sodium_init() < 0 || expected_size == 0 || expected_size > GP_VAULT_MAX_BYTES || strlen(expected_hash) != 64) return NULL;
  gp_reader *r = calloc(1, sizeof *r);
  if (!r) return NULL;
  r->expected_size = expected_size;
  if (sodium_hex2bin(r->expected_hash, 32, expected_hash, 64, NULL, NULL, NULL)) goto fail;
  int fd = open(path, O_RDONLY | O_NOFOLLOW);
  if (fd < 0) goto fail;
  r->file = fdopen(fd, "rb");
  if (!r->file) { close(fd); goto fail; }
  unsigned char prefix[sizeof magic], header[crypto_secretstream_xchacha20poly1305_HEADERBYTES];
  if (fread(prefix, 1, sizeof prefix, r->file) != sizeof prefix || memcmp(prefix, magic, sizeof magic) || fread(header, 1, sizeof header, r->file) != sizeof header) goto fail;
  if (crypto_secretstream_xchacha20poly1305_init_pull(&r->stream, header, key)) goto fail;
  crypto_hash_sha256(r->aad, (const unsigned char *)binding, strlen(binding));
  crypto_hash_sha256_init(&r->hash);
  return r;
fail:
  gp_reader_close(r);
  return NULL;
}
int gp_reader_read(gp_reader *r, unsigned char *output, size_t maximum) {
  if (!r || r->failed || !maximum) return -1;
  if (r->offset == r->length && !r->final) {
    unsigned char bytes[4], tag;
    unsigned long long plain_size;
    if (fread(bytes, 1, 4, r->file) != 4) goto fail;
    uint32_t length = (uint32_t)bytes[0] | (uint32_t)bytes[1] << 8 | (uint32_t)bytes[2] << 16 | (uint32_t)bytes[3] << 24;
    if (length < crypto_secretstream_xchacha20poly1305_ABYTES || length > sizeof r->cipher || fread(r->cipher, 1, length, r->file) != length) goto fail;
    if (crypto_secretstream_xchacha20poly1305_pull(&r->stream, r->plain, &plain_size, &tag, r->cipher, length, r->aad, sizeof r->aad)) goto fail;
    r->size += plain_size;
    if (r->size > r->expected_size) goto fail;
    if (tag == crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
      unsigned char hash[32];
      if (plain_size != 0 || r->size != r->expected_size || fgetc(r->file) != EOF || ferror(r->file)) goto fail;
      crypto_hash_sha256_final(&r->hash, hash);
      if (sodium_memcmp(hash, r->expected_hash, sizeof hash)) goto fail;
      r->final = 1;
    } else if (tag != crypto_secretstream_xchacha20poly1305_TAG_MESSAGE || !plain_size) goto fail;
    else crypto_hash_sha256_update(&r->hash, r->plain, plain_size);
    r->offset = 0; r->length = (size_t)plain_size;
  }
  size_t n = r->length - r->offset;
  if (n > maximum) n = maximum;
  memcpy(output, r->plain + r->offset, n);
  sodium_memzero(r->plain + r->offset, n);
  r->offset += n;
  return (int)n;
fail:
  r->failed = 1;
  sodium_memzero(r->plain, sizeof r->plain);
  return -1;
}
void gp_reader_close(gp_reader *r) {
  if (!r) return;
  if (r->file) fclose(r->file);
  sodium_memzero(r, sizeof *r); free(r);
}
int gp_verify_file(const char *path, const unsigned char key[32], const char *binding,
                   const char *expected_hash, uint64_t expected_size) {
  gp_reader *r = gp_reader_open(path, key, binding, expected_hash, expected_size);
  if (!r) return -1;
  unsigned char buf[GP_VAULT_CHUNK_BYTES];
  int result;
  do { result = gp_reader_read(r, buf, sizeof buf); } while (result > 0);
  gp_reader_close(r); sodium_memzero(buf, sizeof buf);
  return result;
}
