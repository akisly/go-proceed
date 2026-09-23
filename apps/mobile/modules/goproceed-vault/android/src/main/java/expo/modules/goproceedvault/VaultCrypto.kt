package expo.modules.goproceedvault

internal object VaultCrypto {
  init { System.loadLibrary("goproceed-vault") }
  external fun key(): ByteArray
  external fun encrypt(input: String, output: String, key: ByteArray, binding: String, maximum: Long): String
  external fun verify(path: String, key: ByteArray, binding: String, hash: String, size: Long): Boolean
  external fun open(path: String, key: ByteArray, binding: String, hash: String, size: Long): Long
  external fun read(reader: Long): ByteArray
  external fun close(reader: Long)
}
