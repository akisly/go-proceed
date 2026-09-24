cmake_minimum_required(VERSION 3.22.1)
project(goproceedvault C)

# The vault's C core is shared with iOS (ios/GPVault.c). libsodium is the
# sha256-pinned 1.0.22 that scripts/prepare-sodium.mjs builds per ABI before this
# step runs (Gradle task prepareSodium); its JSON output names the install dir.
get_filename_component(VAULT_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../.." ABSOLUTE)
set(SODIUM_MANIFEST "${VAULT_ROOT}/.build/android-${ANDROID_ABI}-default.json")
set(SODIUM_PIN "${VAULT_ROOT}/scripts/sodium-pin.json")
if(NOT EXISTS "${SODIUM_MANIFEST}")
  message(FATAL_ERROR "Pinned libsodium for ${ANDROID_ABI} is missing: run the prepareSodium Gradle task")
endif()
# A re-pinned libsodium rewrites the manifest; reconfigure instead of linking the old build.
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${SODIUM_MANIFEST}" "${SODIUM_PIN}")
file(READ "${SODIUM_MANIFEST}" SODIUM_JSON)
file(READ "${SODIUM_PIN}" PIN_JSON)
string(JSON SODIUM_INSTALL GET "${SODIUM_JSON}" install)
string(JSON SODIUM_DIGEST GET "${SODIUM_JSON}" digest)
string(JSON PIN_DIGEST GET "${PIN_JSON}" digest)
if(NOT SODIUM_DIGEST STREQUAL PIN_DIGEST OR NOT EXISTS "${SODIUM_INSTALL}/../.installed")
  message(FATAL_ERROR "libsodium for ${ANDROID_ABI} does not match scripts/sodium-pin.json: run the prepareSodium Gradle task")
endif()

add_library(sodium STATIC IMPORTED)
set_target_properties(sodium PROPERTIES IMPORTED_LOCATION "${SODIUM_INSTALL}/lib/libsodium.a")

add_library(goproceed-vault SHARED vault-jni.c "${VAULT_ROOT}/ios/GPVault.c")
target_include_directories(goproceed-vault PRIVATE "${VAULT_ROOT}/ios" "${SODIUM_INSTALL}/include")
target_compile_options(goproceed-vault PRIVATE -Wall -Wextra -Werror -O2 -fstack-protector-strong -ffunction-sections -fdata-sections -fvisibility=hidden)
target_link_libraries(goproceed-vault PRIVATE sodium)
# 16 KB page alignment (required for Android 15+ devices with 16 KB pages); only
# the JNI entry points (JNIEXPORT) are exported: -fvisibility=hidden hides the vault core, --exclude-libs libsodium.
target_link_options(goproceed-vault PRIVATE "-Wl,-z,max-page-size=16384" "-Wl,-z,common-page-size=16384" "-Wl,--gc-sections" "-Wl,--exclude-libs,ALL")
