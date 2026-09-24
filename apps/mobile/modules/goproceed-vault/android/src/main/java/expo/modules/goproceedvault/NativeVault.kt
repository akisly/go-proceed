package expo.modules.goproceedvault

import android.content.ContentValues
import android.content.Context
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.system.Os
import android.system.OsConstants
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URI
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.net.ssl.HttpsURLConnection

private const val MAXIMUM_BYTES = 20L * 1024 * 1024
// HttpsURLConnection has no write timeout: bound the whole transfer, as iOS does.
private const val TRANSFER_DEADLINE_MS = 185_000L
private const val KEY_PREFIX = "goproceed.vault."
// An item key (owner hash + item id) or an earlier build's per-identity key; never the self-test alias.
private val KEY_ALIAS = Regex(Regex.escape(KEY_PREFIX) + "[0-9a-f]{64}(?:\\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?")
private fun fail(code: String): Nothing = throw IllegalStateException(code)
private fun text(data: JSONObject, key: String): String {
  val value = data.opt(key) as? String ?: fail("VAULT_INVALID_ARGUMENT")
  if (value.isEmpty() || value.length > 256 || value.contains('\n') || value.contains('\u0000')) fail("VAULT_INVALID_ARGUMENT")
  return value
}
private fun uuid(data: JSONObject, key: String): String {
  val value = text(data, key).lowercase()
  if (!Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").matches(value)) fail("VAULT_INVALID_ARGUMENT")
  return value
}
/** Requirement text is stored verbatim (content rules): newlines allowed, no NUL, bounded. */
private fun label(data: JSONObject, key: String): String? {
  if (!data.has(key)) return null
  val value = data.opt(key) as? String ?: fail("VAULT_INVALID_ARGUMENT")
  if (value.isEmpty() || value.length > 2000 || value.contains('\u0000')) fail("VAULT_INVALID_ARGUMENT")
  return value
}
private fun hash(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
private fun owner(item: JSONObject) = hash(text(item, "subjectId") + "\n" + text(item, "workspaceId"))
private fun binding(item: JSONObject) = listOf("subjectId", "workspaceId", "id", "assignmentId", "occurrenceId", "originMethod", "mimeType", "claimedCaptureTime", "sourceAppVersion").joinToString("\n") { text(item, it) }

internal class NativeVault private constructor(private val context: Context) {
  companion object {
    @Volatile private var instance: NativeVault? = null
    /**
     * One vault per process: its lock guards the journal and the key sweep. A JS reload
     * creates a new module while the old one may still be importing; a second instance
     * would sweep a key between its generation and the journal write.
     */
    fun shared(context: Context): NativeVault = instance ?: synchronized(this) {
      instance ?: NativeVault(context.applicationContext).also { instance = it }
    }
  }
  // Journal lock. Reentrant so upload() can release it (held exactly once by call())
  // for the transfer and take it back.
  private val lock = ReentrantLock()
  private val cancellation = Any()
  // Identity generation changes only with authenticate/quarantine, so an import
  // survives backgrounding; the upload generation also changes on a plain pause.
  @Volatile private var generation = 0L
  @Volatile private var uploadGeneration = 0L
  @Volatile private var identity: JSONObject? = null
  @Volatile private var connection: HttpsURLConnection? = null
  @Volatile private var connectionId: String? = null
  private var database: SQLiteDatabase? = null
  private val root = File(context.noBackupFilesDir, "goproceed-vault")
  private var origins = emptySet<String>()
  private var initialized = false

  /** Lock-only: never waits behind a running call. */
  fun cancel(quarantine: Boolean) {
    val running = synchronized(cancellation) {
      uploadGeneration++
      if (quarantine) { generation++; identity = null }
      connection
    }
    disconnectLater(running)
  }
  /** A socket or TLS close can block; never on the caller's (JS) thread. */
  private fun disconnectLater(running: HttpsURLConnection?) {
    if (running != null) Thread({ runCatching { running.disconnect() } }, "goproceed-vault-cancel").start()
  }
  private fun uploadVersion() = synchronized(cancellation) { listOf(generation, uploadGeneration) }
  private fun actor() = identity ?: fail("VAULT_AUTH_REQUIRED")
  private fun file(id: String, suffix: String = ".vault") = File(root, id + suffix)
  private fun publicItem(item: JSONObject): JSONObject = JSONObject(item.toString()).also { it.remove("wrappedKey"); it.remove("keyIV") }

  fun call(operation: String, payload: String): String = lock.withLock {
    try {
      val input = JSONObject(payload)
      // These never open the journal: they must work when it cannot be opened.
      when (operation) {
        "wipe" -> return@withLock wipe(input).toString()
        "installationCheck" -> return@withLock JSONObject().put("fresh", installationFresh()).toString()
        "installationMark" -> { installationMark(); return@withLock "null" }
      }
      openJournal()
      var result: Any = JSONObject.NULL
      when (operation) {
        "initialize" -> {
          val values = input.optJSONArray("storageOrigins") ?: fail("VAULT_INVALID_ORIGIN")
          if (values.length() == 0) fail("VAULT_INVALID_ORIGIN")
          val allowed = (0 until values.length()).map { origin(values.getString(it), true) }.toSet()
          // Fail closed at start, not after the shutter: load the native library and
          // round-trip a few bytes through it before reporting ready. A failed re-run
          // leaves the vault uninitialized.
          initialized = false
          selfTest()
          origins = allowed; initialized = true
        }
        "authenticate" -> {
          val next = JSONObject().put("subjectId", uuid(input, "subjectId")).put("workspaceId", uuid(input, "workspaceId"))
          // One read: cancel(true) may null it concurrently from the JS thread.
          val previous = synchronized(cancellation) { identity }
          val changed = previous == null || owner(previous) != owner(next)
          if (changed) quarantineRows()
          val running = synchronized(cancellation) { identity = next; generation++; uploadGeneration++; if (changed) connection else null }
          disconnectLater(running)
        }
        "quarantine" -> {
          // Close the identity here too, so an authenticate reordered before it cannot leave it open.
          val running = synchronized(cancellation) { identity = null; generation++; uploadGeneration++; connection }
          disconnectLater(running)
          quarantineRows()
        }
        "list" -> result = JSONArray(rows(owner(actor())).filter { it.optString("state") != "server_confirmed" }.map(::publicItem))
        "importPhoto" -> result = publicItem(importPhoto(input))
        "restore" -> rows(owner(actor())).filter { it.optString("state") == "quarantined" }.forEach {
          it.put("state", "not_sent"); it.remove("quarantineWarnedAt"); persist(it)
        }
        "warnQuarantine" -> rows(owner(actor())).filter { it.optString("state") == "quarantined" && !it.has("quarantineWarnedAt") }.forEach {
          it.put("quarantineWarnedAt", Instant.now().toString()); persist(it)
        }
        "purgeExpired" -> rows(owner(actor())).filter { it.optString("state") == "quarantined" && it.has("quarantineWarnedAt") }.forEach {
          if (Instant.now().epochSecond - Instant.parse(it.getString("quarantineWarnedAt")).epochSecond >= 7 * 86400) remove(it)
        }
        else -> {
          val id = uuid(input, "id")
          val item = rows(owner(actor())).firstOrNull { it.optString("id") == id } ?: fail("VAULT_NOT_FOUND")
          when (operation) {
            "setUploadIntent" -> {
              mutable(item)
              val intent = uuid(input, "intentId")
              // A photo the user asked to delete never gets a new upload intent.
              if (item.has("discardRequestedAt") && !item.has("intentId")) fail("VAULT_DISCARD_REQUESTED")
              if (item.has("intentId") && item.getString("intentId") != intent) fail("VAULT_IMMUTABLE_INTENT")
              item.put("intentId", intent)
              if (input.has("evidenceId")) {
                val evidence = uuid(input, "evidenceId")
                if (item.has("evidenceId") && item.getString("evidenceId") != evidence) fail("VAULT_IMMUTABLE_EVIDENCE")
                item.put("evidenceId", evidence)
              }
              persist(item)
            }
            "markAwaitingReceipt" -> {
              mutable(item)
              if (item.has("discardRequestedAt")) fail("VAULT_DISCARD_REQUESTED")
              item.put("state", "awaiting_receipt"); persist(item)
            }
            "markFailed" -> {
              mutable(item)
              val code = text(input, "errorCode")
              if (!Regex("^[A-Z][A-Z0-9_]{0,79}$").matches(code)) fail("VAULT_INVALID_ARGUMENT")
              item.put("state", "failed").put("errorCode", code); persist(item)
            }
            "upload" -> result = upload(item, input)
            "confirmReceipt" -> {
              mutable(item)
              if (input.optString("status") != "available" || !item.has("intentId") || !item.has("evidenceId") || item.getString("evidenceId") != input.optString("evidenceId") || item.getString("sha256") != input.optString("sha256") || item.getLong("byteSize") != input.optLong("byteSize", -1)) fail("VAULT_RECEIPT_MISMATCH")
              item.put("state", "server_confirmed").put("receiptConfirmedAt", Instant.now().toString()); persist(item)
              cleanup(item)
            }
            "requestDiscard" -> {
              // The server may still receive it: hold it, never send it again, delete once the server says it did not.
              if (input.optBoolean("confirmed") != true) fail("VAULT_CONFIRMATION_REQUIRED")
              mutable(item)
              val running = synchronized(cancellation) { if (connectionId == id) { uploadGeneration++; connection } else null }
              disconnectLater(running)
              if (!item.has("discardRequestedAt")) { item.put("discardRequestedAt", Instant.now().toString()); persist(item) }
              result = publicItem(item)
            }
            "discard" -> {
              if (input.optBoolean("confirmed") != true) fail("VAULT_CONFIRMATION_REQUIRED")
              // Bytes already accepted by storage may still be finalized: «not received» would be false.
              if (item.optString("state") == "awaiting_receipt") fail("VAULT_ITEM_LOCKED")
              // A discard promises the server never gets the photo: stop its transfer first.
              val running = synchronized(cancellation) { if (connectionId == id) { uploadGeneration++; connection } else null }
              disconnectLater(running)
              remove(item)
            }
            else -> fail("VAULT_UNKNOWN_OPERATION")
          }
        }
      }
      if (result === JSONObject.NULL) "null" else result.toString()
    } catch (error: Throwable) {
      // Network errors may include signed URLs. Never bridge their messages.
      // Throwable: a missing native library is an Error (UnsatisfiedLinkError).
      if (error is UnsatisfiedLinkError || error is ExceptionInInitializerError || error is NoClassDefFoundError) {
        throw IllegalStateException("VAULT_CRYPTO_UNAVAILABLE")
      }
      val message = error.message.orEmpty()
      throw IllegalStateException(if (Regex("^VAULT_[A-Z_]+$").matches(message)) message else "VAULT_OPERATION_FAILED")
    }
  }
  /**
   * Deletes every item of every identity: the journal may not open, so it cannot be
   * scoped. Keys first, then files; reports which parts are gone, never paths.
   */
  private fun wipe(input: JSONObject): JSONObject {
    if (input.optBoolean("confirmed") != true) fail("VAULT_CONFIRMATION_REQUIRED")
    val running = synchronized(cancellation) { identity = null; generation++; uploadGeneration++; connection }
    disconnectLater(running)
    runCatching { database?.close() }
    database = null; initialized = false; origins = emptySet()
    val keysDeleted = runCatching {
      val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      store.aliases().toList().filter { it.startsWith(KEY_PREFIX) }.forEach { store.deleteEntry(it) }
      store.aliases().toList().none { it.startsWith(KEY_PREFIX) }
    }.getOrDefault(false)
    root.deleteRecursively()
    val directoryDeleted = !root.exists()
    // A directory that survives and cannot be listed counts as not deleted.
    val ciphertextDeleted = directoryDeleted || (root.listFiles()?.none { it.extension in listOf("vault", "part", "import") } ?: false)
    return JSONObject().put("keysDeleted", keysDeleted).put("ciphertextDeleted", ciphertextDeleted).put("directoryDeleted", directoryDeleted)
  }
  private val installation = File(File(context.noBackupFilesDir, "goproceed-installation"), "marker")
  /** A fresh installation has neither this marker nor a vault directory; an update keeps both. */
  private fun installationFresh() = !installation.exists() && !root.exists()
  private fun installationMark() {
    val directory = installation.parentFile!!
    if (!directory.mkdirs() && !directory.isDirectory) fail("VAULT_JOURNAL_UNAVAILABLE")
    if (!installation.exists()) installation.writeText(UUID.randomUUID().toString())
  }
  private fun selfTest() {
    val probe = File(root, "selftest.probe"); val sealed = File(root, "selftest.sealed")
    // A process killed mid-test leaves these; encrypt opens its output with O_EXCL.
    probe.delete(); sealed.delete()
    val key = VaultCrypto.key()
    try {
      probe.writeBytes(ByteArray(4096) { it.toByte() })
      val result = VaultCrypto.encrypt(probe.path, sealed.path, key, "selftest", 8192).split('|')
      if (result.size != 2 || !VaultCrypto.verify(sealed.path, key, "selftest", result[0], result[1].toLong())) fail("VAULT_CRYPTO_UNAVAILABLE")
      keystoreSelfTest(key)
    } finally { key.fill(0); probe.delete(); sealed.delete() }
  }
  /** Keystore is first needed at import, after the shutter: prove it works before reporting ready. */
  private fun keystoreSelfTest(key: ByteArray) {
    val alias = KEY_PREFIX + "selftest"
    try {
      val secret = generateWrappingKey(alias)
      val sealer = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, secret) }
      val wrapped = sealer.doFinal(key)
      val opener = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, secret, GCMParameterSpec(128, sealer.iv)) }
      val opened = opener.doFinal(wrapped)
      try { if (!opened.contentEquals(key)) fail("VAULT_KEYSTORE_UNAVAILABLE") } finally { opened.fill(0) }
    } catch (error: Exception) {
      if (error.message == "VAULT_KEYSTORE_UNAVAILABLE") throw error
      fail("VAULT_KEYSTORE_UNAVAILABLE")
    } finally {
      runCatching { KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias) }
    }
  }
  private fun openJournal() {
    if (database != null) return
    if (!root.mkdirs() && !root.isDirectory) fail("VAULT_JOURNAL_UNAVAILABLE")
    // Never the platform's default handler: it deletes a corrupt journal, and the sweep
    // below would then delete every identity's photos without anyone deciding to. A corrupt
    // journal fails the open instead (the error state, where the user may choose a wipe).
    val keep = DatabaseErrorHandler { }
    val db = SQLiteDatabase.openDatabase(File(root, "journal.sqlite").path, null, SQLiteDatabase.CREATE_IF_NECESSARY or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING, keep)
    database = db
    try {
      // PRAGMAs that return a row are refused by execSQL; read them through rawQuery.
      for (pragma in listOf("PRAGMA synchronous=FULL", "PRAGMA secure_delete=ON")) db.rawQuery(pragma, null).use { it.moveToFirst() }
      db.execSQL("CREATE TABLE IF NOT EXISTS captures(id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL)")
      db.execSQL("CREATE INDEX IF NOT EXISTS captures_owner ON captures(owner)")
      rows(null).forEach {
        when (it.optString("state")) {
          "server_confirmed", "discarded", "importing" -> cleanup(it)
          "sending" -> { it.put("state", "not_sent"); persist(it) }
        }
      }
      val retained = rows(null).map { it.getString("id") }.toSet()
      root.listFiles()?.filter { it.extension in listOf("part", "vault", "import") }?.forEach {
        if (it.extension != "vault" || it.nameWithoutExtension !in retained) { if (!it.delete()) fail("VAULT_CLEANUP_FAILED") }
      }
      sweepKeys(retained)
    } catch (error: Exception) { db.close(); database = null; throw error }
  }
  /**
   * A key whose row is gone (a process killed between key generation and the
   * journal write, or a per-identity key from an earlier build) opens nothing and
   * is deleted. Best effort: the next start tries again.
   */
  private fun sweepKeys(retained: Set<String>) {
    runCatching {
      val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      for (alias in store.aliases().toList()) {
        val match = KEY_ALIAS.matchEntire(alias) ?: continue
        val id = match.groupValues[1]
        if (id.isEmpty() || id !in retained) runCatching { store.deleteEntry(alias) }
      }
    }
  }
  private fun rows(owner: String?): List<JSONObject> {
    val rows = mutableListOf<JSONObject>()
    database!!.rawQuery(if (owner == null) "SELECT data FROM captures ORDER BY rowid" else "SELECT data FROM captures WHERE owner=? ORDER BY rowid", owner?.let { arrayOf(it) }).use {
      while (it.moveToNext()) rows.add(JSONObject(it.getString(0)))
    }
    return rows
  }
  private fun persist(item: JSONObject) {
    val db = database!!
    db.beginTransaction()
    try {
      val values = ContentValues().apply { put("id", text(item, "id")); put("owner", owner(item)); put("data", item.toString()) }
      if (db.insertWithOnConflict("captures", null, values, SQLiteDatabase.CONFLICT_REPLACE) == -1L) fail("VAULT_JOURNAL_WRITE_FAILED")
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
  }
  private fun mutable(item: JSONObject) {
    if (item.optString("state") in listOf("quarantined", "server_confirmed", "discarded", "importing")) fail("VAULT_ITEM_LOCKED")
  }
  private fun quarantineRows() {
    rows(null).filter { it.optString("state") !in listOf("server_confirmed", "discarded", "importing") }.forEach { it.put("state", "quarantined"); persist(it) }
  }
  // One key per item, as on iOS: deleting the item deletes the only key that opens it.
  private fun alias(item: JSONObject) = KEY_PREFIX + owner(item) + "." + uuid(item, "id")
  private fun wrappingKey(item: JSONObject, create: Boolean): SecretKey {
    val alias = alias(item)
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(alias, null) as? SecretKey)?.let { return it }
    if (!create) fail("VAULT_KEY_UNAVAILABLE")
    return generateWrappingKey(alias)
  }
  private fun generateWrappingKey(alias: String): SecretKey {
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256).setRandomizedEncryptionRequired(true)
    // Usable only while the phone is unlocked, like iOS WhenUnlockedThisDeviceOnly. Android
    // 12–14 cannot create such keys without a secure lock screen and delete them when it
    // is removed; the platform documentation says to use it on Android 15 and later only.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) spec.setUnlockedDeviceRequired(true)
    generator.init(spec.build())
    return generator.generateKey()
  }
  // Error codes as on iOS: a store that cannot seal is unavailable; a key that cannot open is gone.
  private fun wrap(key: ByteArray, item: JSONObject) {
    val sealed = try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, wrappingKey(item, true)); cipher.updateAAD(binding(item).toByteArray(Charsets.UTF_8))
      cipher.doFinal(key) to cipher.iv
    } catch (error: Exception) { fail("VAULT_KEYSTORE_UNAVAILABLE") }
    item.put("wrappedKey", Base64.encodeToString(sealed.first, Base64.NO_WRAP)).put("keyIV", Base64.encodeToString(sealed.second, Base64.NO_WRAP))
  }
  private fun unwrap(item: JSONObject): ByteArray {
    val key = try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, wrappingKey(item, false), GCMParameterSpec(128, Base64.decode(item.getString("keyIV"), Base64.NO_WRAP)))
      cipher.updateAAD(binding(item).toByteArray(Charsets.UTF_8))
      cipher.doFinal(Base64.decode(item.getString("wrappedKey"), Base64.NO_WRAP))
    } catch (error: Exception) { fail("VAULT_KEY_UNAVAILABLE") }
    if (key.size != 32) { key.fill(0); fail("VAULT_KEY_UNAVAILABLE") }
    return key
  }
  private fun cleanup(item: JSONObject) {
    val id = uuid(item, "id")
    // The key goes first, as on iOS: without it the ciphertext and any old WAL copy of
    // the wrapped key open nothing. A failure keeps the row, so the next start retries.
    try {
      // A key already gone is success (iOS accepts errSecItemNotFound); some stores throw for it.
      val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      val alias = alias(item)
      if (store.containsAlias(alias)) store.deleteEntry(alias)
    } catch (error: Exception) { fail("VAULT_KEYSTORE_UNAVAILABLE") }
    for (suffix in listOf(".vault", ".part", ".import")) {
      val target = file(id, suffix)
      if (target.exists() && !target.delete()) fail("VAULT_CLEANUP_FAILED")
    }
    val db = database!!
    if (db.delete("captures", "id=? AND owner=?", arrayOf(id, owner(item))) != 1) fail("VAULT_JOURNAL_WRITE_FAILED")
    // secure_delete clears the database pages; the WAL keeps old frames until a checkpoint.
    // Best effort: the row is already gone and the key with it, so never report a failure.
    runCatching { db.rawQuery("PRAGMA wal_checkpoint(TRUNCATE)", null).use { it.moveToFirst() } }
  }
  private fun remove(item: JSONObject) { item.put("state", "discarded"); persist(item); cleanup(item) }
  private fun importPhoto(input: JSONObject): JSONObject {
    if (!initialized) fail("VAULT_NOT_INITIALIZED")
    // Identity and generation read together, and checked against what the caller authorized.
    val (current, version) = synchronized(cancellation) { identity to generation }
    val actor = current ?: fail("VAULT_AUTH_REQUIRED")
    if (actor.getString("subjectId") != input.optString("expectedSubjectId").lowercase()
      || actor.getString("workspaceId") != input.optString("expectedWorkspaceId").lowercase()) fail("VAULT_IDENTITY_CHANGED")
    val uri = Uri.parse(input.getString("uri"))
    if (uri.scheme != "file" || uri.authority?.isNotEmpty() == true) fail("VAULT_INVALID_IMPORT")
    val source = File(uri.path ?: fail("VAULT_INVALID_IMPORT")).canonicalFile
    if (!source.path.startsWith(context.cacheDir.canonicalPath + File.separator) || !source.isFile) fail("VAULT_INVALID_IMPORT")
    val cap = input.optLong("maxBytes", -1)
    val origin = text(input, "originMethod"); val mime = text(input, "mimeType")
    if (cap <= 0 || origin !in listOf("native_camera", "photo_picker") || mime !in listOf("image/jpeg", "image/png", "image/heic", "image/heif", "image/webp")) fail("VAULT_INVALID_IMPORT")
    val capturedAt = text(input, "claimedCaptureTime"); Instant.parse(capturedAt)
    val appVersion = text(input, "sourceAppVersion"); if (appVersion.length > 50) fail("VAULT_INVALID_ARGUMENT")
    val requirement = label(input, "requirementLabel")
    val id = UUID.randomUUID().toString()
    val item = JSONObject().put("id", id).put("subjectId", actor.getString("subjectId")).put("workspaceId", actor.getString("workspaceId"))
      .put("assignmentId", uuid(input, "assignmentId")).put("occurrenceId", uuid(input, "occurrenceId"))
      .put("originMethod", origin).put("mimeType", mime).put("claimedCaptureTime", capturedAt).put("sourceAppVersion", appVersion)
      .put("createdAt", Instant.now().toString()).put("createIdempotencyKey", UUID.randomUUID().toString()).put("finalizeIdempotencyKey", UUID.randomUUID().toString()).put("state", "importing")
    // Shown on the queue card offline; never part of the ciphertext binding.
    if (requirement != null) item.put("requirementLabel", requirement)
    val key = VaultCrypto.key()
    try {
      wrap(key, item); persist(item)
      // Own the transient copy so only our staging directory needs sweeping.
      val staging = file(id, ".import")
      if (!source.renameTo(staging)) fail("VAULT_IMPORT_FAILED")
      val result = VaultCrypto.encrypt(staging.path, file(id, ".part").path, key, binding(item), minOf(cap, MAXIMUM_BYTES)).split('|')
      if (!file(id, ".part").renameTo(file(id))) fail("VAULT_IMPORT_FAILED")
      // android.system.OsConstants has no O_DIRECTORY; a read-only open of a directory is enough for fsync.
      val fd = Os.open(root.path, OsConstants.O_RDONLY, 0)
      try { Os.fsync(fd) } finally { Os.close(fd) }
      item.put("sha256", result[0]).put("byteSize", result[1].toLong()).put("state", if (generation == version) "not_sent" else "quarantined")
      persist(item)
      if (!staging.delete()) fail("VAULT_CLEANUP_FAILED")
      if (generation != version) fail("VAULT_CANCELLED")
      return item
    } catch (error: Exception) {
      if (item.optString("state") == "importing") runCatching { cleanup(item) }
      throw error
    } finally { key.fill(0) }
  }
  private fun origin(raw: String, exact: Boolean = false): String {
    val uri = URI(raw)
    if (uri.scheme != "https" || uri.host.isNullOrEmpty() || uri.rawUserInfo != null || uri.rawFragment != null || (exact && (!uri.rawPath.isNullOrEmpty() && uri.rawPath != "/" || uri.rawQuery != null))) fail("VAULT_INVALID_ORIGIN")
    return "https://" + uri.host.lowercase() + if (uri.port == -1 || uri.port == 443) "" else ":${uri.port}"
  }
  private fun upload(item: JSONObject, input: JSONObject): JSONObject {
    if (!initialized) fail("VAULT_NOT_INITIALIZED")
    mutable(item)
    if (item.has("discardRequestedAt")) fail("VAULT_DISCARD_REQUESTED")
    val raw = input.getString("url")
    if (!item.has("intentId") || origin(raw) !in origins) fail("VAULT_INVALID_UPLOAD")
    val headers = input.getJSONObject("headers")
    headers.keys().forEach { if (it.lowercase() != "content-type" || headers.getString(it) != item.getString("mimeType")) fail("VAULT_INVALID_UPLOAD_HEADER") }
    val id = uuid(item, "id"); val key = unwrap(item); val version = uploadVersion()
    var reader = 0L
    var request: HttpsURLConnection? = null
    var claimed = false
    var outcome: Int? = null
    try {
      if (!VaultCrypto.verify(file(id).path, key, binding(item), item.getString("sha256"), item.getLong("byteSize"))) fail("VAULT_CIPHERTEXT_CORRUPT")
      reader = VaultCrypto.open(file(id).path, key, binding(item), item.getString("sha256"), item.getLong("byteSize"))
      request = URI(raw).toURL().openConnection() as HttpsURLConnection
      request.instanceFollowRedirects = false; request.useCaches = false
      request.connectTimeout = 30_000; request.readTimeout = 60_000
      request.requestMethod = "PUT"; request.doOutput = true
      request.setFixedLengthStreamingMode(item.getLong("byteSize"))
      request.setRequestProperty("Content-Type", item.getString("mimeType"))
      // One transfer slot natively, not only by the JavaScript single-flight.
      synchronized(cancellation) {
        if (connection != null) fail("VAULT_UPLOAD_BUSY")
        if (listOf(generation, uploadGeneration) != version || identity == null) fail("VAULT_CANCELLED")
        connection = request; connectionId = id; claimed = true
      }
      item.put("state", "sending"); persist(item)
      // Created before the journal is released: a thread that cannot start must not
      // leave the lock unowned.
      val watchdog = java.util.Timer("goproceed-vault-deadline", true)
      watchdog.schedule(object : java.util.TimerTask() {
        // A deadline is a failed send (retryable), not a cancellation: only disconnect.
        override fun run() { disconnectLater(request) }
      }, TRANSFER_DEADLINE_MS)
      // The journal is released for the transfer so imports, listing and quarantine
      // are not held behind a slow network. call() holds the lock exactly once here.
      lock.unlock()
      try {
        outcome = runCatching {
          request.outputStream.use { output ->
            while (true) {
              if (uploadVersion() != version) fail("VAULT_CANCELLED")
              val chunk = VaultCrypto.read(reader)
              try { if (chunk.isEmpty()) break; output.write(chunk) } finally { chunk.fill(0) }
            }
            output.flush()
          }
          if (uploadVersion() != version) fail("VAULT_CANCELLED")
          request.responseCode
        }.getOrNull()
      } finally {
        // A close can block: do it before taking the journal back.
        watchdog.cancel(); runCatching { request.disconnect() }; lock.lock()
      }
      // Another call may have quarantined or discarded the row meanwhile; never overwrite that.
      val latest = rows(null).firstOrNull { it.optString("id") == id }
      if (latest == null || latest.optString("state") != "sending") fail("VAULT_UPLOAD_INTERRUPTED")
      val status = outcome
      if (status == null || uploadVersion() != version) {
        latest.put("state", if (uploadVersion() == version) "failed" else "not_sent"); persist(latest)
        fail("VAULT_UPLOAD_INTERRUPTED")
      }
      latest.put("state", if (status in 200..299) "awaiting_receipt" else "failed"); persist(latest)
      return JSONObject().put("status", status)
    } finally {
      if (claimed) synchronized(cancellation) { if (connection === request) { connection = null; connectionId = null } }
      request?.disconnect(); if (reader != 0L) VaultCrypto.close(reader); key.fill(0)
    }
  }
}
