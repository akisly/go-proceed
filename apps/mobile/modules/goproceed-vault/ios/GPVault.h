#ifndef GP_VAULT_H
#define GP_VAULT_H
#include <stddef.h>
#include <stdint.h>

#define GP_VAULT_KEY_BYTES 32
#define GP_VAULT_CHUNK_BYTES 65536
#define GP_VAULT_MAX_BYTES (20 * 1024 * 1024)
typedef struct gp_reader gp_reader;
/* All functions return generic error codes; paths/keys never reach errors. */
int gp_random_key(unsigned char key[GP_VAULT_KEY_BYTES]);
int gp_sha256_text(const char *value, char hex[65]);
int gp_encrypt_file(const char *input, const char *output, const unsigned char key[32],
                    const char *binding, uint64_t maximum, char hash[65], uint64_t *size);
gp_reader *gp_reader_open(const char *path, const unsigned char key[32], const char *binding,
                          const char *expected_hash, uint64_t expected_size);
/* 0 is authenticated EOF; -1 is corruption/IO. Never accept EOF until seen. */
int gp_reader_read(gp_reader *reader, unsigned char *output, size_t maximum);
void gp_reader_close(gp_reader *reader);
int gp_verify_file(const char *path, const unsigned char key[32], const char *binding,
                   const char *expected_hash, uint64_t expected_size);
void gp_wipe(void *memory, size_t length);
#endif
