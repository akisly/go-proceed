#include <jni.h>
#include <stdint.h>
#include <stdio.h>
#include "GPVault.h"

/* JNI forbids further calls while an exception is pending (an OOM from the VM): keep that one. */
static void error(JNIEnv *env) {
  if ((*env)->ExceptionCheck(env)) return;
  (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/IllegalStateException"), "VAULT_CRYPTO_FAILED");
}
/* GetStringUTFChars can fail with an OOM pending: stop at the first NULL and release what was obtained. */
static int strings3(JNIEnv *env, jstring a, const char **ca, jstring b, const char **cb, jstring c, const char **cc) {
  *ca = (*env)->GetStringUTFChars(env, a, NULL);
  *cb = *ca ? (*env)->GetStringUTFChars(env, b, NULL) : NULL;
  *cc = *cb ? (*env)->GetStringUTFChars(env, c, NULL) : NULL;
  return *cc ? 0 : -1;
}
static void release3(JNIEnv *env, jstring a, const char *ca, jstring b, const char *cb, jstring c, const char *cc) {
  if (ca) (*env)->ReleaseStringUTFChars(env, a, ca);
  if (cb) (*env)->ReleaseStringUTFChars(env, b, cb);
  if (cc) (*env)->ReleaseStringUTFChars(env, c, cc);
}
static int copy_key(JNIEnv *env, jbyteArray source, unsigned char key[32]) {
  if ((*env)->GetArrayLength(env, source) != 32) { error(env); return -1; }
  (*env)->GetByteArrayRegion(env, source, 0, 32, (jbyte *)key); return 0;
}
JNIEXPORT jbyteArray JNICALL Java_expo_modules_goproceedvault_VaultCrypto_key(JNIEnv *env, jobject object) {
  (void)object;
  unsigned char key[32]; if (gp_random_key(key)) { error(env); return NULL; }
  jbyteArray result = (*env)->NewByteArray(env, 32);
  if (result) (*env)->SetByteArrayRegion(env, result, 0, 32, (jbyte *)key);
  gp_wipe(key, 32); return result; /* NULL leaves the pending OutOfMemoryError */
}
JNIEXPORT jstring JNICALL Java_expo_modules_goproceedvault_VaultCrypto_encrypt(JNIEnv *env, jobject object, jstring in, jstring out, jbyteArray source, jstring binding, jlong cap) {
  (void)object;
  unsigned char key[32]; if (copy_key(env, source, key)) return NULL;
  const char *input, *output, *aad;
  if (strings3(env, in, &input, out, &output, binding, &aad)) { gp_wipe(key, 32); release3(env, in, input, out, output, binding, aad); error(env); return NULL; }
  char hash[65], result[100]; uint64_t size = 0;
  int status = gp_encrypt_file(input, output, key, aad, (uint64_t)cap, hash, &size);
  gp_wipe(key, 32);
  release3(env, in, input, out, output, binding, aad);
  if (status) { error(env); return NULL; }
  snprintf(result, sizeof result, "%s|%llu", hash, (unsigned long long)size);
  return (*env)->NewStringUTF(env, result);
}
JNIEXPORT jboolean JNICALL Java_expo_modules_goproceedvault_VaultCrypto_verify(JNIEnv *env, jobject object, jstring path, jbyteArray source, jstring binding, jstring hash, jlong size) {
  (void)object;
  unsigned char key[32]; if (copy_key(env, source, key)) return JNI_FALSE;
  const char *file, *aad, *digest;
  if (strings3(env, path, &file, binding, &aad, hash, &digest)) { gp_wipe(key, 32); release3(env, path, file, binding, aad, hash, digest); error(env); return JNI_FALSE; }
  int status = gp_verify_file(file, key, aad, digest, (uint64_t)size);
  gp_wipe(key, 32);
  release3(env, path, file, binding, aad, hash, digest);
  return status == 0 ? JNI_TRUE : JNI_FALSE;
}
JNIEXPORT jlong JNICALL Java_expo_modules_goproceedvault_VaultCrypto_open(JNIEnv *env, jobject object, jstring path, jbyteArray source, jstring binding, jstring hash, jlong size) {
  (void)object;
  unsigned char key[32]; if (copy_key(env, source, key)) return 0;
  const char *file, *aad, *digest;
  if (strings3(env, path, &file, binding, &aad, hash, &digest)) { gp_wipe(key, 32); release3(env, path, file, binding, aad, hash, digest); error(env); return 0; }
  gp_reader *reader = gp_reader_open(file, key, aad, digest, (uint64_t)size);
  gp_wipe(key, 32);
  release3(env, path, file, binding, aad, hash, digest);
  if (!reader) error(env);
  return (jlong)(intptr_t)reader;
}
JNIEXPORT jbyteArray JNICALL Java_expo_modules_goproceedvault_VaultCrypto_read(JNIEnv *env, jobject object, jlong handle) {
  (void)object;
  unsigned char chunk[GP_VAULT_CHUNK_BYTES];
  int size = gp_reader_read((gp_reader *)(intptr_t)handle, chunk, sizeof chunk);
  if (size < 0) { gp_wipe(chunk, sizeof chunk); error(env); return NULL; }
  jbyteArray result = (*env)->NewByteArray(env, size);
  if (result && size) (*env)->SetByteArrayRegion(env, result, 0, size, (jbyte *)chunk);
  gp_wipe(chunk, sizeof chunk); return result;
}
JNIEXPORT void JNICALL Java_expo_modules_goproceedvault_VaultCrypto_close(JNIEnv *env, jobject object, jlong handle) {
  (void)env; (void)object; gp_reader_close((gp_reader *)(intptr_t)handle);
}
