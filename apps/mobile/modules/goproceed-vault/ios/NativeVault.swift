import Foundation
import Security
import SQLite3

private let maximumBytes = 20 * 1024 * 1024
private let keyService = "com.lightholdlabs.goproceed.vault"
private let sqlTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
private func failure(_ code: String) -> NSError { NSError(domain: "GoProceedVault", code: 1, userInfo: [NSLocalizedDescriptionKey: code]) }
private func now() -> String { ISO8601DateFormatter().string(from: Date()) }
private func string(_ map: [String: Any], _ key: String) throws -> String {
  guard let value = map[key] as? String, !value.isEmpty, value.count <= 256, !value.contains("\n"), !value.contains("\0") else { throw failure("VAULT_INVALID_ARGUMENT") }
  return value
}
/** Requirement text is stored verbatim (content rules): newlines allowed, no NUL, bounded. */
private func label(_ map: [String: Any], _ key: String) throws -> String? {
  guard let raw = map[key] else { return nil }
  guard let value = raw as? String, !value.isEmpty, value.utf16.count <= 2000, !value.contains("\0") else { throw failure("VAULT_INVALID_ARGUMENT") }
  return value
}
private func vaultRoot() throws -> URL {
  try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("GoProceedVault", isDirectory: true)
}
private func installationMarker() throws -> URL {
  try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    .appendingPathComponent("GoProceedInstallation", isDirectory: true).appendingPathComponent("marker")
}
private func uuid(_ map: [String: Any], _ key: String) throws -> String {
  let value = try string(map, key)
  guard UUID(uuidString: value) != nil else { throw failure("VAULT_INVALID_ARGUMENT") }
  return value.lowercased()
}
private func hashText(_ value: String) -> String {
  var out = [CChar](repeating: 0, count: 65)
  gp_sha256_text(value, &out)
  return String(cString: out)
}

final class NativeVault {
  private let work = NSRecursiveLock()
  private let cancellation = NSLock()
  // Identity generation: changes only with authenticate/quarantine, so an import
  // survives backgrounding. Upload generation also changes on a plain pause.
  private var generation = 0
  private var uploadGeneration = 0
  private var identity: [String: String]?
  private var task: URLSessionTask?
  private var taskId: String?
  private var db: OpaquePointer?
  private var root: URL!
  private var origins = Set<String>()
  private var initialized = false

  /** Lock-only and synchronous: it must never wait behind a running call. */
  func cancel(_ quarantine: Bool) {
    cancellation.lock()
    uploadGeneration += 1
    if quarantine { generation += 1; identity = nil }
    let running = task
    cancellation.unlock()
    running?.cancel()
  }

  private func context() throws -> [String: String] {
    cancellation.lock(); defer { cancellation.unlock() }
    guard let identity else { throw failure("VAULT_AUTH_REQUIRED") }
    return identity
  }
  private func currentGeneration() -> Int {
    cancellation.lock(); defer { cancellation.unlock() }; return generation
  }
  private func currentUpload() -> [Int] {
    cancellation.lock(); defer { cancellation.unlock() }; return [generation, uploadGeneration]
  }
  private func owner(_ context: [String: String]) -> String { hashText(context["subjectId"]! + "\n" + context["workspaceId"]!) }
  private func owner(_ item: [String: Any]) throws -> String { hashText(try string(item, "subjectId") + "\n" + string(item, "workspaceId")) }
  private func binding(_ item: [String: Any]) throws -> String {
    try ["subjectId", "workspaceId", "id", "assignmentId", "occurrenceId", "originMethod", "mimeType", "claimedCaptureTime", "sourceAppVersion"].map { try string(item, $0) }.joined(separator: "\n")
  }
  private func location(_ id: String, part: Bool = false) -> URL { root.appendingPathComponent(id + (part ? ".part" : ".vault")) }

  func call(_ operation: String, _ json: String) throws -> String {
    work.lock(); defer { work.unlock() }
    guard let data = json.data(using: .utf8), let input = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw failure("VAULT_INVALID_ARGUMENT") }
    // These never open the journal: they must work when it cannot be opened.
    switch operation {
    case "wipe": return try encode(try wipe(input))
    case "installationCheck": return try encode(try installationCheck())
    case "installationMark": try installationMark(); return "null"
    default: break
    }
    try openJournal()
    var result: Any = NSNull()
    switch operation {
    case "initialize":
      guard let values = input["storageOrigins"] as? [String], !values.isEmpty else { throw failure("VAULT_INVALID_ORIGIN") }
      origins = try Set(values.map { try origin($0, exact: true) }); initialized = true
    case "authenticate":
      let next = ["subjectId": try uuid(input, "subjectId"), "workspaceId": try uuid(input, "workspaceId")]
      let previous = try? context()
      if previous != next { try quarantineRows() }
      cancellation.lock(); identity = next; generation += 1; uploadGeneration += 1; cancellation.unlock()
    case "quarantine":
      // Close the identity here too, so an authenticate reordered before it cannot leave it open.
      cancellation.lock(); identity = nil; generation += 1; uploadGeneration += 1; let running = task; cancellation.unlock()
      running?.cancel()
      try quarantineRows()
    case "list": result = try rows(owner(context())).filter { ($0["state"] as? String) != "server_confirmed" }
    case "importPhoto": result = try importPhoto(input)
    case "restore":
      for var item in try rows(owner(context())) where item["state"] as? String == "quarantined" {
        item["state"] = "not_sent"; item.removeValue(forKey: "quarantineWarnedAt"); try persist(item)
      }
    case "warnQuarantine":
      for var item in try rows(owner(context())) where item["state"] as? String == "quarantined" && item["quarantineWarnedAt"] == nil {
        item["quarantineWarnedAt"] = now(); try persist(item)
      }
    case "purgeExpired":
      for item in try rows(owner(context())) where item["state"] as? String == "quarantined" {
        if let value = item["quarantineWarnedAt"] as? String, let date = ISO8601DateFormatter().date(from: value), Date().timeIntervalSince(date) >= 7 * 86400 { try remove(item) }
      }
    default:
      let id = try uuid(input, "id")
      var item = try get(id)
      switch operation {
      case "setUploadIntent":
        try mutable(item)
        let intent = try uuid(input, "intentId")
        // A photo the user asked to delete never gets a new upload intent.
        if item["discardRequestedAt"] != nil && item["intentId"] == nil { throw failure("VAULT_DISCARD_REQUESTED") }
        if let existing = item["intentId"] as? String, existing != intent { throw failure("VAULT_IMMUTABLE_INTENT") }
        item["intentId"] = intent
        if input["evidenceId"] != nil {
          let evidence = try uuid(input, "evidenceId")
          if let existing = item["evidenceId"] as? String, existing != evidence { throw failure("VAULT_IMMUTABLE_EVIDENCE") }
          item["evidenceId"] = evidence
        }
        try persist(item)
      case "markAwaitingReceipt":
        try mutable(item)
        if item["discardRequestedAt"] != nil { throw failure("VAULT_DISCARD_REQUESTED") }
        item["state"] = "awaiting_receipt"; try persist(item)
      case "markFailed":
        try mutable(item)
        let code = try string(input, "errorCode")
        guard code.range(of: "^[A-Z][A-Z0-9_]{0,79}$", options: .regularExpression) != nil else { throw failure("VAULT_INVALID_ARGUMENT") }
        item["state"] = "failed"; item["errorCode"] = code; try persist(item)
      case "upload": result = try upload(item, input)
      case "confirmReceipt":
        try mutable(item)
        guard input["status"] as? String == "available", item["intentId"] != nil,
              let evidence = item["evidenceId"] as? String, evidence == input["evidenceId"] as? String,
              item["sha256"] as? String == input["sha256"] as? String,
              (item["byteSize"] as? NSNumber)?.int64Value == (input["byteSize"] as? NSNumber)?.int64Value else { throw failure("VAULT_RECEIPT_MISMATCH") }
        item["state"] = "server_confirmed"; item["receiptConfirmedAt"] = now()
        try persist(item) // FULL synchronous commit precedes deletion.
        try cleanup(item)
      case "requestDiscard":
        // The server may still receive it: hold it, never send it again, delete once the server says it did not.
        guard input["confirmed"] as? Bool == true else { throw failure("VAULT_CONFIRMATION_REQUIRED") }
        try mutable(item)
        cancellation.lock()
        var running: URLSessionTask?
        if taskId == id { uploadGeneration += 1; running = task }
        cancellation.unlock()
        running?.cancel()
        if item["discardRequestedAt"] == nil { item["discardRequestedAt"] = now(); try persist(item) }
        result = item
      case "discard":
        guard input["confirmed"] as? Bool == true else { throw failure("VAULT_CONFIRMATION_REQUIRED") }
        // Bytes already accepted by storage may still be finalized: «not received» would be false.
        guard item["state"] as? String != "awaiting_receipt" else { throw failure("VAULT_ITEM_LOCKED") }
        // A discard promises the server never gets the photo: stop its transfer first.
        cancellation.lock()
        var running: URLSessionTask?
        if taskId == id { uploadGeneration += 1; running = task }
        cancellation.unlock()
        running?.cancel()
        try remove(item)
      default: throw failure("VAULT_UNKNOWN_OPERATION")
      }
    }
    return try encode(result)
  }
  private func encode(_ result: Any) throws -> String {
    String(data: try JSONSerialization.data(withJSONObject: result, options: [.fragmentsAllowed, .sortedKeys]), encoding: .utf8)!
  }

  /**
   * Deletes every item of every identity: the journal may not open, so it cannot be
   * scoped. Keys first, then files; reports which parts are gone, never paths.
   */
  private func wipe(_ input: [String: Any]) throws -> [String: Bool] {
    guard input["confirmed"] as? Bool == true else { throw failure("VAULT_CONFIRMATION_REQUIRED") }
    cancellation.lock(); identity = nil; generation += 1; uploadGeneration += 1; let running = task; cancellation.unlock()
    running?.cancel()
    if let db { sqlite3_close_v2(db) }
    db = nil; initialized = false; origins = []
    let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: keyService] as CFDictionary)
    let keysDeleted = status == errSecSuccess || status == errSecItemNotFound
    let fm = FileManager.default
    let directory = try vaultRoot()
    if fm.fileExists(atPath: directory.path) { try? fm.removeItem(at: directory) }
    let directoryDeleted = !fm.fileExists(atPath: directory.path)
    let left = (try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
    let ciphertextDeleted = directoryDeleted || !left.contains { ["vault", "part", "import"].contains($0.pathExtension) }
    return ["keysDeleted": keysDeleted, "ciphertextDeleted": ciphertextDeleted, "directoryDeleted": directoryDeleted]
  }
  /**
   * A fresh installation has neither this marker nor a vault directory. An app update
   * keeps both directories, so it is never mistaken for a reinstall.
   */
  private func installationCheck() throws -> [String: Bool] {
    let fm = FileManager.default
    if fm.fileExists(atPath: try installationMarker().path) { return ["fresh": false] }
    return ["fresh": !fm.fileExists(atPath: try vaultRoot().path)]
  }
  private func installationMark() throws {
    let fm = FileManager.default
    let marker = try installationMarker()
    var directory = marker.deletingLastPathComponent()
    try fm.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var values = URLResourceValues(); values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
    if !fm.fileExists(atPath: marker.path) {
      try Data(UUID().uuidString.utf8).write(to: marker, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
  }

  private func openJournal() throws {
    if db != nil { return }
    let fm = FileManager.default
    root = try vaultRoot()
    try fm.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
    var values = URLResourceValues(); values.isExcludedFromBackup = true
    try root.setResourceValues(values)
    let marker = root.appendingPathComponent("installation")
    if !fm.fileExists(atPath: marker.path) {
      let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: keyService] as CFDictionary)
      guard status == errSecSuccess || status == errSecItemNotFound else { throw failure("VAULT_KEYSTORE_UNAVAILABLE") }
      try Data(UUID().uuidString.utf8).write(to: marker, options: [.atomic, .completeFileProtection])
    }
    guard sqlite3_open_v2(root.appendingPathComponent("journal.sqlite").path, &db, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { throw failure("VAULT_JOURNAL_UNAVAILABLE") }
    do {
      try sql("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS captures (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS captures_owner ON captures(owner);")
      let all = try rows(nil)
      for var item in all {
        let state = item["state"] as? String
        if state == "server_confirmed" || state == "discarded" { try cleanup(item) }
        else if state == "importing" { try cleanup(item) }
        else if state == "sending" { item["state"] = "not_sent"; try persist(item) }
      }
      // Only our own named ciphertext intermediates, never library originals.
      let retained = Set(try rows(nil).compactMap { $0["id"] as? String })
      for url in try fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) where ["part", "vault"].contains(url.pathExtension) {
        if url.pathExtension == "part" || !retained.contains(url.deletingPathExtension().lastPathComponent) { try fm.removeItem(at: url) }
      }
    } catch { sqlite3_close(db); db = nil; throw error }
  }
  private func sql(_ statement: String) throws {
    guard sqlite3_exec(db, statement, nil, nil, nil) == SQLITE_OK else { throw failure("VAULT_JOURNAL_WRITE_FAILED") }
  }
  private func rows(_ owner: String?) throws -> [[String: Any]] {
    var statement: OpaquePointer?
    let query = owner == nil ? "SELECT data FROM captures ORDER BY rowid" : "SELECT data FROM captures WHERE owner=? ORDER BY rowid"
    guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else { throw failure("VAULT_JOURNAL_READ_FAILED") }
    defer { sqlite3_finalize(statement) }
    if let owner { sqlite3_bind_text(statement, 1, owner, -1, sqlTransient) }
    var result = [[String: Any]]()
    var status = sqlite3_step(statement)
    while status == SQLITE_ROW {
      guard let value = sqlite3_column_text(statement, 0), let data = String(cString: value).data(using: .utf8), let row = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw failure("VAULT_JOURNAL_CORRUPT") }
      result.append(row); status = sqlite3_step(statement)
    }
    guard status == SQLITE_DONE else { throw failure("VAULT_JOURNAL_READ_FAILED") }
    return result
  }
  private func persist(_ item: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: item, options: [.sortedKeys])
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, "INSERT INTO captures(id,owner,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", -1, &statement, nil) == SQLITE_OK else { throw failure("VAULT_JOURNAL_WRITE_FAILED") }
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_text(statement, 1, try string(item, "id"), -1, sqlTransient)
    sqlite3_bind_text(statement, 2, try owner(item), -1, sqlTransient)
    sqlite3_bind_text(statement, 3, String(data: data, encoding: .utf8)!, -1, sqlTransient)
    guard sqlite3_step(statement) == SQLITE_DONE else { throw failure("VAULT_JOURNAL_WRITE_FAILED") }
  }
  private func get(_ id: String) throws -> [String: Any] {
    guard let item = try rows(owner(context())).first(where: { $0["id"] as? String == id }) else { throw failure("VAULT_NOT_FOUND") }
    return item
  }
  private func mutable(_ item: [String: Any]) throws {
    guard !["quarantined", "server_confirmed", "discarded", "importing"].contains(item["state"] as? String ?? "") else { throw failure("VAULT_ITEM_LOCKED") }
  }
  private func quarantineRows() throws {
    for var item in try rows(nil) where !["server_confirmed", "discarded", "importing"].contains(item["state"] as? String ?? "") {
      item["state"] = "quarantined"; try persist(item)
    }
  }
  private func keyQuery(_ item: [String: Any]) throws -> [CFString: Any] {
    [kSecClass: kSecClassGenericPassword, kSecAttrService: keyService, kSecAttrAccount: try owner(item) + ":" + string(item, "id")]
  }
  private func storeKey(_ key: [UInt8], _ item: [String: Any]) throws {
    var query = try keyQuery(item)
    query[kSecValueData] = Data(key); query[kSecAttrAccessible] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { throw failure("VAULT_KEYSTORE_UNAVAILABLE") }
  }
  private func loadKey(_ item: [String: Any]) throws -> [UInt8] {
    var query = try keyQuery(item); query[kSecReturnData] = true
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data, data.count == 32 else { throw failure("VAULT_KEY_UNAVAILABLE") }
    return Array(data)
  }
  private func cleanup(_ item: [String: Any]) throws {
    let id = try uuid(item, "id")
    let status = SecItemDelete(try keyQuery(item) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else { throw failure("VAULT_KEYSTORE_UNAVAILABLE") }
    for file in [location(id), location(id, part: true)] where FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, "DELETE FROM captures WHERE id=? AND owner=?", -1, &statement, nil) == SQLITE_OK else { throw failure("VAULT_JOURNAL_WRITE_FAILED") }
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_text(statement, 1, id, -1, sqlTransient); sqlite3_bind_text(statement, 2, try owner(item), -1, sqlTransient)
    guard sqlite3_step(statement) == SQLITE_DONE else { throw failure("VAULT_JOURNAL_WRITE_FAILED") }
    // secure_delete clears the pages; the WAL keeps old frames until a checkpoint. Best effort.
    sqlite3_wal_checkpoint_v2(db, nil, SQLITE_CHECKPOINT_TRUNCATE, nil, nil)
  }
  private func remove(_ item: [String: Any]) throws {
    var deleting = item; deleting["state"] = "discarded"; try persist(deleting); try cleanup(deleting)
  }
  private func importPhoto(_ input: [String: Any]) throws -> [String: Any] {
    guard initialized else { throw failure("VAULT_NOT_INITIALIZED") }
    // Identity and generation read together, and checked against what the caller authorized.
    cancellation.lock(); let current = identity; let version = generation; cancellation.unlock()
    guard let actor = current else { throw failure("VAULT_AUTH_REQUIRED") }
    guard actor["subjectId"] == (input["expectedSubjectId"] as? String)?.lowercased(),
          actor["workspaceId"] == (input["expectedWorkspaceId"] as? String)?.lowercased() else { throw failure("VAULT_IDENTITY_CHANGED") }
    guard let raw = input["uri"] as? String, let uri = URL(string: raw), uri.isFileURL else { throw failure("VAULT_INVALID_IMPORT") }
    let path = uri.resolvingSymlinksInPath().standardizedFileURL
    let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).map { $0.resolvingSymlinksInPath().standardizedFileURL.path + "/" }
    guard caches.contains(where: { path.path.hasPrefix($0) }), path.path != root.path,
          let cap = (input["maxBytes"] as? NSNumber)?.intValue, cap > 0,
          let origin = input["originMethod"] as? String, ["native_camera", "photo_picker"].contains(origin),
          let mime = input["mimeType"] as? String, ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"].contains(mime) else { throw failure("VAULT_INVALID_IMPORT") }
    let time = try string(input, "claimedCaptureTime")
    let date = ISO8601DateFormatter(); date.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard date.date(from: time) != nil || ISO8601DateFormatter().date(from: time) != nil else { throw failure("VAULT_INVALID_ARGUMENT") }
    let appVersion = try string(input, "sourceAppVersion")
    guard appVersion.count <= 50 else { throw failure("VAULT_INVALID_ARGUMENT") }
    let requirement = try label(input, "requirementLabel")
    let id = UUID().uuidString.lowercased()
    var item: [String: Any] = ["id": id, "subjectId": actor["subjectId"]!, "workspaceId": actor["workspaceId"]!, "assignmentId": try uuid(input, "assignmentId"), "occurrenceId": try uuid(input, "occurrenceId"), "originMethod": origin, "mimeType": mime, "claimedCaptureTime": time, "sourceAppVersion": appVersion, "createdAt": now(), "createIdempotencyKey": UUID().uuidString.lowercased(), "finalizeIdempotencyKey": UUID().uuidString.lowercased(), "state": "importing"]
    // Shown on the queue card offline; never part of the ciphertext binding.
    if let requirement { item["requirementLabel"] = requirement }
    var key = [UInt8](repeating: 0, count: 32)
    guard gp_random_key(&key) == 0 else { throw failure("VAULT_CRYPTO_UNAVAILABLE") }
    defer { gp_wipe(&key, key.count) }
    try persist(item)
    do {
      try storeKey(key, item)
      var hash = [CChar](repeating: 0, count: 65); var size: UInt64 = 0
      guard gp_encrypt_file(path.path, location(id, part: true).path, key, try binding(item), UInt64(min(cap, maximumBytes)), &hash, &size) == 0 else { throw failure("VAULT_IMPORT_FAILED") }
      try FileManager.default.moveItem(at: location(id, part: true), to: location(id))
      let fd = open(root.path, O_RDONLY); if fd >= 0 { _ = fsync(fd); close(fd) }
      item["sha256"] = String(cString: hash); item["byteSize"] = size
      item["state"] = version == currentGeneration() ? "not_sent" : "quarantined"
      try persist(item)
      // This is a copied camera/picker cache artifact, never a library original.
      try? FileManager.default.removeItem(at: path)
      guard version == currentGeneration() else { throw failure("VAULT_CANCELLED") }
      return item
    } catch {
      // Preserve committed ciphertext when cancellation raced with import.
      if item["state"] as? String == "importing" { try? cleanup(item) }
      throw error
    }
  }
  private func origin(_ raw: String, exact: Bool = false) throws -> String {
    guard let parts = URLComponents(string: raw), parts.scheme == "https", let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil, parts.fragment == nil else { throw failure("VAULT_INVALID_ORIGIN") }
    if exact && (!parts.path.isEmpty && parts.path != "/" || parts.query != nil) { throw failure("VAULT_INVALID_ORIGIN") }
    return "https://" + host.lowercased() + (parts.port.map { $0 == 443 ? "" : ":\($0)" } ?? "")
  }
  private func upload(_ source: [String: Any], _ input: [String: Any]) throws -> [String: Int] {
    guard initialized else { throw failure("VAULT_NOT_INITIALIZED") }
    try mutable(source)
    if source["discardRequestedAt"] != nil { throw failure("VAULT_DISCARD_REQUESTED") }
    guard source["intentId"] != nil, let raw = input["url"] as? String, origins.contains(try origin(raw)), let url = URL(string: raw), let headers = input["headers"] as? [String: String] else { throw failure("VAULT_INVALID_UPLOAD") }
    guard headers.allSatisfy({ $0.key.lowercased() == "content-type" && $0.value == source["mimeType"] as? String }) else { throw failure("VAULT_INVALID_UPLOAD_HEADER") }
    let id = try uuid(source, "id"), aad = try binding(source), expectedHash = try string(source, "sha256")
    guard let size = (source["byteSize"] as? NSNumber)?.uint64Value else { throw failure("VAULT_JOURNAL_CORRUPT") }
    var key = try loadKey(source); defer { gp_wipe(&key, key.count) }
    guard gp_verify_file(location(id).path, key, aad, expectedHash, size) == 0 else { throw failure("VAULT_CIPHERTEXT_CORRUPT") }
    let version = currentUpload()
    let stream = try VaultInputStream(path: location(id).path, key: key, binding: aad, hash: expectedHash, size: size, cancelled: { self.currentUpload() != version })
    defer { stream.close() }
    let delegate = VaultUploadDelegate(stream: stream)
    let config = URLSessionConfiguration.ephemeral
    config.urlCache = nil; config.httpCookieStorage = nil; config.urlCredentialStorage = nil
    config.timeoutIntervalForRequest = 60; config.timeoutIntervalForResource = 180
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    var request = URLRequest(url: url); request.httpMethod = "PUT"
    request.setValue(String(size), forHTTPHeaderField: "Content-Length")
    request.setValue(source["mimeType"] as? String, forHTTPHeaderField: "Content-Type")
    request.httpBodyStream = stream
    let running = session.uploadTask(withStreamedRequest: request)
    cancellation.lock()
    // One transfer slot natively, not only by the JavaScript single-flight.
    guard task == nil else { cancellation.unlock(); throw failure("VAULT_UPLOAD_BUSY") }
    task = running; taskId = id
    cancellation.unlock()
    var item = source; item["state"] = "sending"
    do { try persist(item) } catch {
      cancellation.lock(); if task === running { task = nil; taskId = nil }; cancellation.unlock()
      throw error
    }
    cancellation.lock()
    let valid = [generation, uploadGeneration] == version && identity != nil
    cancellation.unlock()
    if valid { running.resume() } else { running.cancel() }
    // The journal is released for the transfer so imports, listing and quarantine
    // are not held behind a slow network. call() holds `work` exactly once here.
    work.unlock()
    let completed = delegate.done.wait(timeout: .now() + 185) == .success
    work.lock()
    if !completed {
      // Stop the task and let its callbacks finish before the deferred stream close.
      running.cancel()
      _ = delegate.done.wait(timeout: .now() + 10)
    }
    cancellation.lock(); if task === running { task = nil; taskId = nil }; cancellation.unlock()
    // Another call may have quarantined or discarded the row meanwhile; never overwrite that.
    guard let latest = try rows(nil).first(where: { $0["id"] as? String == id }), latest["state"] as? String == "sending" else {
      throw failure("VAULT_UPLOAD_INTERRUPTED")
    }
    item = latest
    guard completed, currentUpload() == version, delegate.error == nil, let status = delegate.status else {
      item["state"] = currentUpload() == version ? "failed" : "not_sent"; try persist(item)
      throw failure("VAULT_UPLOAD_INTERRUPTED")
    }
    item["state"] = (200...299).contains(status) ? "awaiting_receipt" : "failed"; try persist(item)
    return ["status": status]
  }
}

private final class VaultInputStream: InputStream {
  // URLSession reads on its own thread while the uploader may close on timeout.
  private let access = NSLock()
  private var reader: OpaquePointer?
  private let cancelled: () -> Bool
  private var status: Stream.Status = .notOpen
  init(path: String, key: [UInt8], binding: String, hash: String, size: UInt64, cancelled: @escaping () -> Bool) throws {
    self.cancelled = cancelled
    reader = gp_reader_open(path, key, binding, hash, size)
    guard reader != nil else { throw failure("VAULT_CIPHERTEXT_CORRUPT") }
    super.init(data: Data())
  }
  override func open() { access.lock(); status = .open; access.unlock() }
  override func close() {
    access.lock(); defer { access.unlock() }
    if let reader { gp_reader_close(reader); self.reader = nil }; status = .closed
  }
  override var streamStatus: Stream.Status { access.lock(); defer { access.unlock() }; return status }
  override var hasBytesAvailable: Bool { streamStatus == .open }
  override var streamError: Error? { streamStatus == .error ? failure("VAULT_STREAM_FAILED") : nil }
  override func read(_ buffer: UnsafeMutablePointer<UInt8>, maxLength len: Int) -> Int {
    access.lock(); defer { access.unlock() }
    guard !cancelled(), let reader else { status = .error; return -1 }
    let count = Int(gp_reader_read(reader, buffer, len))
    if count == 0 { status = .atEnd }; if count < 0 { status = .error }
    return count
  }
  override func getBuffer(_ buffer: UnsafeMutablePointer<UnsafeMutablePointer<UInt8>?>, length len: UnsafeMutablePointer<Int>) -> Bool { false }
  override func schedule(in aRunLoop: RunLoop, forMode mode: RunLoop.Mode) {}
  override func remove(from aRunLoop: RunLoop, forMode mode: RunLoop.Mode) {}
  deinit { close() }
}
private final class VaultUploadDelegate: NSObject, URLSessionTaskDelegate, URLSessionDataDelegate, @unchecked Sendable {
  let done = DispatchSemaphore(value: 0)
  let stream: InputStream
  var error: Error?
  var status: Int?
  private var supplied = false
  init(stream: InputStream) { self.stream = stream }
  func urlSession(_ session: URLSession, task: URLSessionTask, needNewBodyStream completionHandler: @escaping (InputStream?) -> Void) {
    if supplied { completionHandler(nil) } else { supplied = true; completionHandler(stream) }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) { /* Never retain or log storage response bodies. */ }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    self.error = error; status = (task.response as? HTTPURLResponse)?.statusCode; done.signal()
  }
}
