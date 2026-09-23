package expo.modules.goproceedvault

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GoProceedVaultModule : Module() {
  private val vault by lazy { NativeVault(requireNotNull(appContext.reactContext).applicationContext) }
  override fun definition() = ModuleDefinition {
    Name("GoProceedVault")
    AsyncFunction("call") { operation: String, payload: String -> vault.call(operation, payload) }
    AsyncFunction("cancel") { quarantine: Boolean -> vault.cancel(quarantine) }
    OnDestroy { vault.cancel(true) }
  }
}
