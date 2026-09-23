#include <jni.h>
#include <stdint.h>
#include <stdio.h>
#include "GPVault.h"

static void error(JNIEnv *env) { (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/IllegalStateException"), "VAULT_CRYPTO_FAILED"); }
static int copy_key(JNIEnv *env, jbyteArray source, unsigned char key[32]) {
  if ((*env)->GetArrayLength(env, source) != 32) { error(env); return -1; }
  (*env)->GetByteArrayRegion(env, source, 0, 32, (jbyte *)key); return 0;
}
JNIEXPORT jbyteArray JNICALL Java_expo_modules_goproceedvault_VaultCrypto_key(JNIEnv *env, jobject object) {
  (void)object;
  unsigned char key[32]; if (gp_random_key(key)) { error(env); return NULL; }
  jbyteArray result = (*env)->NewByteArray(env, 32);
  if (result) (*env)->SetByteArrayRegion(env, result, 0, 32, (jbyte *)key);
  gp_wipe(key, 32); return result;
}
JNIEXPORT jstring JNICALL Java_expo_modules_goproceedvault_VaultCrypto_encrypt(JNIEnv *env, jobject object, jstring in, jstring out, jbyteArray source, jstring binding, jlong cap) {
  (void)object;
  unsigned char key[32]; if (copy_key(env, source, key)) return NULL;
  const char *input = (*env)->GetStringUTFChars(env, in, NULL), *output = (*env)->GetStringUTFChars(env, out, NULL), *aad = (*env)->GetStringUTFChars(env, binding, NULL);
  char hash[65], result[100]; uint64_t size = 0;
  int status = gp_encrypt_file(input, output, key, aad, (uint64_t)cap, hash, &size);
  gp_wipe(key, 32);
  (*env)->ReleaseStringUTFChars(env, in, input); (*env)->ReleaseStringUTFChars(env, out, output); (*env)->ReleaseStringUTFChars(env, binding, aad);
  if (status) { error(env); return NULL; }
  snprintf(result, sizeof result, "%s|%llu", hash, (unsigned long long)size);
  return (*env)->NewStringUTF(env, result);
}
JNIEXPORT jboolean JNICALL Java_expo_modules_goproceedvault_VaultCrypto_verify(JNIEnv *env, jobject object, jstring path, jbyteArray source, jstring binding, jstring hash, jlong size) {
  (void)object;
  unsigned char key[32]; if (copy_key(env, source, key)) return JNI_FALSE;
  const char *file = (*env)->GetStringUTFChars(env, path, NULL), *aad = (*env)->GetStringUTFChars(env, binding, NULL), *digest = (*env)->GetStringUTFChars(env, hash, NULL);
  int status = gp_verify_file(file, key, aad, digest, (uint64_t)size);
  gp_wipe(key, 32);
  (*env)->ReleaseStringUTFChars(env, path, file); (*env)->ReleaseStringUTFChars(env, binding, aad); (*env)->ReleaseStringUTFChars(env, hash, digest);
  return status == 0 ? JNI_TRUE : JNI_FALSE;
}
JNIEXPORT jlong JNICALL Java_expo_modules_goproceedvault_VaultCrypto_open(JNIEnv *env, jobject object, jstring path, jbyteArray source, jstring binding, jstring hash, jlong size) {
  (void)object;
  unsigned char key[32]; if (copy_key(env, source, key)) return 0;
  const char *file = (*env)->GetStringUTFChars(env, path, NULL), *aad = (*env)->GetStringUTFChars(env, binding, NULL), *digest = (*env)->GetStringUTFChars(env, hash, NULL);
  gp_reader *reader = gp_reader_open(file, key, aad, digest, (uint64_t)size);
  gp_wipe(key, 32);
  (*env)->ReleaseStringUTFChars(env, path, file); (*env)->ReleaseStringUTFChars(env, binding, aad); (*env)->ReleaseStringUTFChars(env, hash, digest);
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
