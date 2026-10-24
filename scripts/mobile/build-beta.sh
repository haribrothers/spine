#!/bin/sh
# Build a beta of the field app on your Mac (US-MOB-28, D-271).
#
#   scripts/mobile/build-beta.sh              iOS for TestFlight, then the Android APK
#   scripts/mobile/build-beta.sh --ios        iOS only
#   scripts/mobile/build-beta.sh --android    the Android APK only
#   scripts/mobile/build-beta.sh --upload     also attach the APK to the GitHub release (gh)
#
# Run it from the beta's tag (git checkout v1.0.0-beta.1). It regenerates
# apps/mobile/ios and android (expo prebuild), then:
# - iOS: Xcode archives and uploads to App Store Connect, where it appears in
#   TestFlight once Apple has processed it. Needs Xcode signed in to your Apple
#   developer account (Xcode › Settings › Accounts) and SPINE_APPLE_TEAM_ID
#   (your team id, from developer.apple.com › Membership).
# - Android: Gradle builds apps/mobile/build/spine-<version>.apk, signed with
#   your release keystore: SPINE_ANDROID_KEYSTORE (the .jks file),
#   SPINE_ANDROID_KEYSTORE_PASSWORD, SPINE_ANDROID_KEY_ALIAS,
#   SPINE_ANDROID_KEY_PASSWORD. Every update must be signed with the same
#   keystore, so keep it, and its passwords, safe and backed up.
# The build number is the commit count, so each build is newer than the last.
set -eu

say() { printf '%s\n' "$*"; }
fail() {
  printf 'Field app build: %s\n' "$*" >&2
  exit 1
}

ios=1
android=1
upload=0
while [ $# -gt 0 ]; do
  case $1 in
    --ios) android=0 ;;
    --android) ios=0 ;;
    --upload) upload=1 ;;
    -h | --help)
      sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fail "Unknown option: $1 (see --help)" ;;
  esac
  shift
done

repo=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
app="$repo/apps/mobile"
version=$(node -p "require('$repo/package.json').version")
tag=$(git -C "$repo" describe --tags --exact-match 2>/dev/null || true)
[ "$tag" = "v$version" ] || say "Note: this commit isn't tagged v$version, so this build won't match a release."
SPINE_BUILD_NUMBER=$(git -C "$repo" rev-list --count HEAD)
export SPINE_BUILD_NUMBER
# Gradle and Xcode start Expo's bundler with plain `node`, not pnpm's launcher,
# so they need pnpm's hoisted packages on NODE_PATH as the launcher sets it
# (otherwise Babel can't find its presets and plugins).
NODE_PATH="$repo/node_modules/.pnpm/node_modules${NODE_PATH:+:$NODE_PATH}"
export NODE_PATH
mkdir -p "$app/build"

say "Spine $version, build $SPINE_BUILD_NUMBER."

# --- Check everything first -------------------------------------------------

if [ "$ios" -eq 1 ]; then
  [ "$(uname)" = Darwin ] || fail "The iOS build needs a Mac."
  command -v xcodebuild >/dev/null 2>&1 || fail "Xcode isn't installed. Install it from the App Store, then run this again."
  [ -n "${SPINE_APPLE_TEAM_ID:-}" ] || fail "Set SPINE_APPLE_TEAM_ID to your Apple team id (developer.apple.com › Membership)."
fi
if [ "$android" -eq 1 ]; then
  : "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
  export ANDROID_HOME
  [ -d "$ANDROID_HOME" ] || fail "The Android SDK isn't at $ANDROID_HOME. Install Android Studio, or set ANDROID_HOME."
  command -v java >/dev/null 2>&1 || fail "Java isn't installed. Install JDK 17 (brew install openjdk@17)."
  for var in SPINE_ANDROID_KEYSTORE SPINE_ANDROID_KEYSTORE_PASSWORD SPINE_ANDROID_KEY_ALIAS SPINE_ANDROID_KEY_PASSWORD; do
    eval "value=\${$var:-}"
    [ -n "$value" ] || fail "Set $var (see --help): the APK is signed with your release keystore."
  done
  [ -f "$SPINE_ANDROID_KEYSTORE" ] || fail "There's no keystore at $SPINE_ANDROID_KEYSTORE."
fi
if [ "$upload" -eq 1 ]; then
  command -v gh >/dev/null 2>&1 || fail "--upload needs the gh tool (brew install gh), signed in."
fi

# --- Generate the native projects -------------------------------------------

say "Generating the iOS and Android projects (expo prebuild)…"
cd "$app"
platforms=
[ "$ios" -eq 0 ] || platforms=ios
[ "$android" -eq 0 ] || platforms=${platforms:+all}${platforms:-android}
CI=1 npx expo prebuild --clean --platform "$platforms" >/dev/null

# --- iOS: archive and upload to TestFlight ----------------------------------

if [ "$ios" -eq 1 ]; then
  say "Building iOS (this takes a while)…"
  archive="$app/build/Spine.xcarchive"
  rm -rf "$archive"
  xcodebuild -workspace ios/Spine.xcworkspace -scheme Spine -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$archive" \
    -allowProvisioningUpdates DEVELOPMENT_TEAM="$SPINE_APPLE_TEAM_ID" archive -quiet ||
    fail "The iOS build failed. The lines above say why."
  options="$app/build/ExportOptions.plist"
  cat >"$options" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$SPINE_APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST
  say "Uploading to App Store Connect…"
  xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist "$options" -exportPath "$app/build/ios" -allowProvisioningUpdates -quiet ||
    fail "The upload to App Store Connect failed. The lines above say why."
  say "Uploaded: Spine $version ($SPINE_BUILD_NUMBER) appears in TestFlight once Apple has processed it."
fi

# --- Android: a signed APK --------------------------------------------------

if [ "$android" -eq 1 ]; then
  say "Building the Android APK…"
  # 64-bit ARM only: every phone from the last several years, at less than half the size.
  (cd android && ./gradlew --quiet assembleRelease -PreactNativeArchitectures=arm64-v8a \
    -Pandroid.injected.signing.store.file="$SPINE_ANDROID_KEYSTORE" \
    -Pandroid.injected.signing.store.password="$SPINE_ANDROID_KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias="$SPINE_ANDROID_KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$SPINE_ANDROID_KEY_PASSWORD") ||
    fail "The Android build failed. The lines above say why."
  apk="$app/build/spine-$version.apk"
  cp android/app/build/outputs/apk/release/app-release.apk "$apk"
  say "Built: $apk"
  if [ "$upload" -eq 1 ]; then
    gh release upload "v$version" "$apk" --repo haribrothers/spine --clobber || fail "Couldn't attach the APK to the v$version release."
    say "Attached to the v$version release."
  fi
fi
