import ExpoModulesCore

// Its own queue: an upload waits up to 185 s and must not hold Expo's shared
// AsyncFunction queue (SecureStore, camera) or delay cancel(). Concurrent because
// NativeVault serialises journal access itself and releases it during transfers.
private let vaultQueue = DispatchQueue(label: "com.lightholdlabs.goproceed.vault", qos: .userInitiated, attributes: .concurrent)

public class GoProceedVaultModule: Module {
  private let vault = NativeVault()
  public func definition() -> ModuleDefinition {
    Name("GoProceedVault")
    AsyncFunction("call") { (operation: String, payload: String) -> String in
      try self.vault.call(operation, payload)
    }.runOnQueue(vaultQueue)
    Function("cancel") { (quarantine: Bool) in self.vault.cancel(quarantine) }
    OnDestroy { self.vault.cancel(true) }
  }
}
