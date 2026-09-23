package expo.modules.goproceedvault

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
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
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.net.ssl.HttpsURLConnection

private const val MAXIMUM_BYTES = 20L * 1024 * 1024
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
private fun hash(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
private fun owner(item: JSONObject) = hash(text(item, "subjectId") + "\n" + text(item, "workspaceId"))
private fun binding(item: JSONObject) = listOf("subjectId", "workspaceId", "id", "assignmentId", "occurrenceId", "originMethod", "mimeType", "claimedCaptureTime", "sourceAppVersion").joinToString("\n") { text(item, it) }

internal class NativeVault(private val context: Context) {
  private val lock = Any()
  private val cancellation = Any()
  @Volatile private var generation = 0L
  @Volatile private var identity: JSONObject? = null
  @Volatile private var connection: HttpsURLConnection? = null
  private var database: SQLiteDatabase? = null
  private val root = File(context.noBackupFilesDir, "goproceed-vault")
  private var origins = emptySet<String>()
  private var initialized = false

  fun cancel(quarantine: Boolean) {
    synchronized(cancellation) { generation++; if (quarantine) identity = null }
    connection?.disconnect()
  }
  private fun actor() = identity ?: fail("VAULT_AUTH_REQUIRED")
  private fun file(id: String, suffix: String = ".vault") = File(root, id + suffix)
  private fun publicItem(item: JSONObject): JSONObject = JSONObject(item.toString()).also { it.remove("wrappedKey"); it.remove("keyIV") }

  fun call(operation: String, payload: String): String = synchronized(lock) {
    try {
      openJournal()
      val input = JSONObject(payload)
      var result: Any = JSONObject.NULL
      when (operation) {
        "initialize" -> {
          val values = input.optJSONArray("storageOrigins") ?: fail("VAULT_INVALID_ORIGIN")
          if (values.length() == 0) fail("VAULT_INVALID_ORIGIN")
          origins = (0 until values.length()).map { origin(values.getString(it), true) }.toSet(); initialized = true
        }
        "authenticate" -> {
          val next = JSONObject().put("subjectId", uuid(input, "subjectId")).put("workspaceId", uuid(input, "workspaceId"))
          if (identity == null || owner(identity!!) != owner(next)) quarantineRows()
          synchronized(cancellation) { identity = next; generation++ }
        }
        "quarantine" -> quarantineRows()
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
              if (item.has("intentId") && item.getString("intentId") != intent) fail("VAULT_IMMUTABLE_INTENT")
              item.put("intentId", intent)
              if (input.has("evidenceId")) {
                val evidence = uuid(input, "evidenceId")
                if (item.has("evidenceId") && item.getString("evidenceId") != evidence) fail("VAULT_IMMUTABLE_EVIDENCE")
                item.put("evidenceId", evidence)
              }
              persist(item)
            }
            "markAwaitingReceipt" -> { mutable(item); item.put("state", "awaiting_receipt"); persist(item) }
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
            "discard" -> { if (input.optBoolean("confirmed") != true) fail("VAULT_CONFIRMATION_REQUIRED"); remove(item) }
            else -> fail("VAULT_UNKNOWN_OPERATION")
          }
        }
      }
      if (result === JSONObject.NULL) "null" else result.toString()
    } catch (error: Exception) {
      // Network errors may include signed URLs. Never bridge their messages.
      val message = error.message.orEmpty()
      throw IllegalStateException(if (Regex("^VAULT_[A-Z_]+$").matches(message)) message else "VAULT_OPERATION_FAILED")
    }
  }
  private fun openJournal() {
    if (database != null) return
    if (!root.mkdirs() && !root.isDirectory) fail("VAULT_JOURNAL_UNAVAILABLE")
    val db = SQLiteDatabase.openDatabase(File(root, "journal.sqlite").path, null, SQLiteDatabase.CREATE_IF_NECESSARY or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING)
    database = db
    try {
      db.execSQL("PRAGMA synchronous=FULL"); db.execSQL("PRAGMA secure_delete=ON")
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
    } catch (error: Exception) { db.close(); database = null; throw error }
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
  private fun wrappingKey(item: JSONObject, create: Boolean): SecretKey {
    val alias = "goproceed.vault." + owner(item)
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(alias, null) as? SecretKey)?.let { return it }
    if (!create) fail("VAULT_KEY_UNAVAILABLE")
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256).setRandomizedEncryptionRequired(true).build())
    return generator.generateKey()
  }
  private fun wrap(key: ByteArray, item: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, wrappingKey(item, true)); cipher.updateAAD(binding(item).toByteArray(Charsets.UTF_8))
    item.put("wrappedKey", Base64.encodeToString(cipher.doFinal(key), Base64.NO_WRAP)).put("keyIV", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
  }
  private fun unwrap(item: JSONObject): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, wrappingKey(item, false), GCMParameterSpec(128, Base64.decode(item.getString("keyIV"), Base64.NO_WRAP)))
    cipher.updateAAD(binding(item).toByteArray(Charsets.UTF_8))
    val key = cipher.doFinal(Base64.decode(item.getString("wrappedKey"), Base64.NO_WRAP))
    if (key.size != 32) fail("VAULT_KEY_UNAVAILABLE")
    return key
  }
  private fun cleanup(item: JSONObject) {
    val id = uuid(item, "id")
    for (suffix in listOf(".vault", ".part", ".import")) {
      val target = file(id, suffix)
      if (target.exists() && !target.delete()) fail("VAULT_CLEANUP_FAILED")
    }
    if (database!!.delete("captures", "id=? AND owner=?", arrayOf(id, owner(item))) != 1) fail("VAULT_JOURNAL_WRITE_FAILED")
  }
  private fun remove(item: JSONObject) { item.put("state", "discarded"); persist(item); cleanup(item) }
  private fun importPhoto(input: JSONObject): JSONObject {
    if (!initialized) fail("VAULT_NOT_INITIALIZED")
    val actor = actor(); val version = generation
    val uri = Uri.parse(input.getString("uri"))
    if (uri.scheme != "file" || uri.authority?.isNotEmpty() == true) fail("VAULT_INVALID_IMPORT")
    val source = File(uri.path ?: fail("VAULT_INVALID_IMPORT")).canonicalFile
    if (!source.path.startsWith(context.cacheDir.canonicalPath + File.separator) || !source.isFile) fail("VAULT_INVALID_IMPORT")
    val cap = input.optLong("maxBytes", -1)
    val origin = text(input, "originMethod"); val mime = text(input, "mimeType")
    if (cap <= 0 || origin !in listOf("native_camera", "photo_picker") || mime !in listOf("image/jpeg", "image/png", "image/heic", "image/heif", "image/webp")) fail("VAULT_INVALID_IMPORT")
    val capturedAt = text(input, "claimedCaptureTime"); Instant.parse(capturedAt)
    val appVersion = text(input, "sourceAppVersion"); if (appVersion.length > 50) fail("VAULT_INVALID_ARGUMENT")
    val id = UUID.randomUUID().toString()
    val item = JSONObject().put("id", id).put("subjectId", actor.getString("subjectId")).put("workspaceId", actor.getString("workspaceId"))
      .put("assignmentId", uuid(input, "assignmentId")).put("occurrenceId", uuid(input, "occurrenceId"))
      .put("originMethod", origin).put("mimeType", mime).put("claimedCaptureTime", capturedAt).put("sourceAppVersion", appVersion)
      .put("createdAt", Instant.now().toString()).put("createIdempotencyKey", UUID.randomUUID().toString()).put("finalizeIdempotencyKey", UUID.randomUUID().toString()).put("state", "importing")
    val key = VaultCrypto.key()
    try {
      wrap(key, item); persist(item)
      // Own the transient copy so only our staging directory needs sweeping.
      val staging = file(id, ".import")
      if (!source.renameTo(staging)) fail("VAULT_IMPORT_FAILED")
      val result = VaultCrypto.encrypt(staging.path, file(id, ".part").path, key, binding(item), minOf(cap, MAXIMUM_BYTES)).split('|')
      if (!file(id, ".part").renameTo(file(id))) fail("VAULT_IMPORT_FAILED")
      val fd = Os.open(root.path, OsConstants.O_RDONLY or OsConstants.O_DIRECTORY, 0)
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
    val raw = input.getString("url")
    if (!item.has("intentId") || origin(raw) !in origins) fail("VAULT_INVALID_UPLOAD")
    val headers = input.getJSONObject("headers")
    headers.keys().forEach { if (it.lowercase() != "content-type" || headers.getString(it) != item.getString("mimeType")) fail("VAULT_INVALID_UPLOAD_HEADER") }
    val id = uuid(item, "id"); val key = unwrap(item); val version = generation
    var reader = 0L
    var request: HttpsURLConnection? = null
    try {
      if (!VaultCrypto.verify(file(id).path, key, binding(item), item.getString("sha256"), item.getLong("byteSize"))) fail("VAULT_CIPHERTEXT_CORRUPT")
      reader = VaultCrypto.open(file(id).path, key, binding(item), item.getString("sha256"), item.getLong("byteSize"))
      request = URI(raw).toURL().openConnection() as HttpsURLConnection
      request.instanceFollowRedirects = false; request.useCaches = false
      request.connectTimeout = 30_000; request.readTimeout = 60_000
      request.requestMethod = "PUT"; request.doOutput = true
      request.setFixedLengthStreamingMode(item.getLong("byteSize"))
      request.setRequestProperty("Content-Type", item.getString("mimeType"))
      item.put("state", "sending"); persist(item)
      synchronized(cancellation) { if (generation != version || identity == null) fail("VAULT_CANCELLED"); connection = request }
      request.outputStream.use { output ->
        while (true) {
          if (generation != version) fail("VAULT_CANCELLED")
          val chunk = VaultCrypto.read(reader)
          try { if (chunk.isEmpty()) break; output.write(chunk) } finally { chunk.fill(0) }
        }
        output.flush()
      }
      if (generation != version) fail("VAULT_CANCELLED")
      val status = request.responseCode
      item.put("state", if (status in 200..299) "awaiting_receipt" else "failed"); persist(item)
      return JSONObject().put("status", status)
    } catch (error: Exception) {
      item.put("state", if (generation == version) "failed" else "not_sent"); persist(item)
      fail("VAULT_UPLOAD_INTERRUPTED")
    } finally {
      connection = null; request?.disconnect(); if (reader != 0L) VaultCrypto.close(reader); key.fill(0)
    }
  }
}
