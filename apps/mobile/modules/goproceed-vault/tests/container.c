#include "GPVault.h"
#include <assert.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main(void) {
  char dir[] = "/tmp/goproceed-vault-test-XXXXXX";
  assert(mkdtemp(dir));
  char input[256], encrypted[256], second[256];
  snprintf(input, sizeof input, "%s/input", dir);
  snprintf(encrypted, sizeof encrypted, "%s/cipher", dir);
  snprintf(second, sizeof second, "%s/cipher2", dir);
  FILE *file = fopen(input, "wb");
  assert(file);
  for (int i = 0; i < GP_VAULT_CHUNK_BYTES * 3 + 7; i++) fputc(i % 251, file);
  fclose(file);
  unsigned char key[32], other[32];
  char hash[65], hash2[65];
  uint64_t size;
  assert(!gp_random_key(key)); assert(!gp_random_key(other));
  assert(!gp_encrypt_file(input, encrypted, key, "subject|workspace|capture", GP_VAULT_MAX_BYTES, hash, &size));
  assert(size == GP_VAULT_CHUNK_BYTES * 3 + 7);
  assert(!gp_verify_file(encrypted, key, "subject|workspace|capture", hash, size));
  assert(gp_verify_file(encrypted, other, "subject|workspace|capture", hash, size) == -1);
  assert(gp_verify_file(encrypted, key, "other|workspace|capture", hash, size) == -1);
  assert(gp_verify_file(encrypted, key, "subject|workspace|capture", hash, size + 1) == -1);
  assert(gp_verify_file(encrypted, key, "subject|workspace|capture", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", size) == -1);
  assert(gp_encrypt_file(input, second, key, "subject|workspace|capture", 1, hash2, &size) == -1);
  assert(!gp_encrypt_file(input, second, key, "subject|workspace|capture", GP_VAULT_MAX_BYTES, hash2, &size));
  assert(!strcmp(hash, hash2));
  gp_reader *reader = gp_reader_open(encrypted, key, "subject|workspace|capture", hash, size);
  assert(reader);
  unsigned char out[997];
  int count; size_t position = 0;
  while ((count = gp_reader_read(reader, out, sizeof out)) > 0) {
    for (int j = 0; j < count; j++) assert(out[j] == (position + j) % 251);
    position += count;
  }
  assert(count == 0 && position == size); gp_reader_close(reader);
  file = fopen(encrypted, "r+b"); fseek(file, 45, SEEK_SET); int c = fgetc(file); fseek(file, 45, SEEK_SET); fputc(c ^ 1, file); fclose(file);
  assert(gp_verify_file(encrypted, key, "subject|workspace|capture", hash, size) == -1);
  file = fopen(second, "ab"); fputc(0, file); fclose(file);
  assert(gp_verify_file(second, key, "subject|workspace|capture", hash, size) == -1);
  unlink(second);
  assert(!gp_encrypt_file(input, second, key, "subject|workspace|capture", GP_VAULT_MAX_BYTES, hash2, &size));
  FILE *cut = fopen(second, "r+b"); fseek(cut, 0, SEEK_END); long end = ftell(cut); assert(!ftruncate(fileno(cut), end - 1)); fclose(cut);
  assert(gp_verify_file(second, key, "subject|workspace|capture", hash, size) == -1);
  unlink(input); unlink(encrypted); unlink(second); rmdir(dir);
  gp_wipe(key, sizeof key); gp_wipe(other, sizeof other);
  puts("PASS: stream roundtrip, chunking, wrong key, identity binding, size/hash mismatch, cap, corruption, trailing bytes, truncated final tag");
  return 0;
}
