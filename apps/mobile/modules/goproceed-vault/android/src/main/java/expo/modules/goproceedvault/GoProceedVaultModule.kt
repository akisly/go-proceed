package expo.modules.goproceedvault

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

// Its own scope: an upload can take minutes and must not hold Expo's shared
// AsyncFunction thread (other modules, SecureStore) or delay cancel(). Calls may
// run concurrently; NativeVault serialises journal access itself and releases it
// during a transfer.
private val vaultScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

class GoProceedVaultModule : Module() {
  private val vault by lazy { NativeVault.shared(requireNotNull(appContext.reactContext)) }
  override fun definition() = ModuleDefinition {
    Name("GoProceedVault")
    AsyncFunction("call") { operation: String, payload: String -> vault.call(operation, payload) }.runOnQueue(vaultScope)
    // Lock-only and synchronous: it must never wait behind a running call.
    Function("cancel") { quarantine: Boolean -> vault.cancel(quarantine) }
    OnDestroy { vault.cancel(true) }
  }
}
