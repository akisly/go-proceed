Pod::Spec.new do |s|
  s.name           = 'GoProceedVault'
  s.version        = '1.0.0'
  s.summary        = 'GoProceed encrypted local evidence vault'
  s.description    = 'Streaming libsodium secretstream vault with a SQLite journal for the GoProceed field client.'
  s.author         = 'Lighthold Labs'
  s.homepage       = 'https://github.com/akisly/GoProceed'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # GPVault.c needs the pinned libsodium; pod install builds it once (see
  # scripts/sodium-xcframework.mjs) and it is linked as a static xcframework.
  unless system('node', File.join(__dir__, '..', 'scripts', 'sodium-xcframework.mjs'))
    raise 'GoProceedVault: building the pinned libsodium xcframework failed'
  end
  s.vendored_frameworks = 'Vendor/Sodium.xcframework'

  # Top level only: the xcframework's sodium headers must not join the umbrella.
  s.source_files = "*.{h,c,m,mm,swift,hpp,cpp}"
end
