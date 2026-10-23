# 15 · Mobile release

The field app is `apps/mobile` (Expo SDK 57, expo-router native tabs, `@expo/ui` controls). It ships in Phase 5. It talks to whichever self-hosted Spine server the user enters at sign-in ([D-049](12-decisions.md)).

## Identity

| Item | Value |
|---|---|
| Display name | Spine |
| Expo slug | `spine-mobile` |
| iOS bundle id | `com.spine.app` |
| Android package | `com.spine.app` |
| URL scheme | `spine` |
| Orientation | Portrait (phones); iPad runs the phone layout |
| Minimum OS | iOS 17, Android 10 / API 29 (NFR-COMP-03) |
| Appearance | Follows the system (light/dark), overridable in Profile |

Bundle ids are placeholders until the owner registers a domain; changing them after the first store upload creates a new app listing.

## Builds and distribution

| Track | Built by | Audience |
|---|---|---|
| Development | `eas build --profile development` (dev client) | Developers; required because `@expo/ui` needs native code (no Expo Go) |
| Beta | `eas build --profile beta` on a pre-release tag (`release.yml`, US-MOB-28) | Testers during the beta: iOS through TestFlight (store distribution, auto-submitted), Android as an APK attached to the GitHub release ([D-265](12-decisions.md)) |
| Production | `eas build --profile production` on a `v*` tag | App Store and Play Store, submitted after the v1.0 tag ([D-266](12-decisions.md)); during the beta, testers get the preview build through TestFlight and an APK link ([D-265](12-decisions.md)) |

- Signing: EAS-managed credentials (Apple distribution certificate + provisioning profile; Android upload keystore). Credentials never live in the repo.
- Version: `apps/mobile/app.config.js` takes the product version from the root `package.json`. The stores' version is its `X.Y.Z`, and a beta's full version (`1.0.0-beta.1`) is `extra.spineVersion`, which Profile shows with "Beta" (US-MOB-28). `buildNumber` / `versionCode` auto-increment per build (`eas.json`, `appVersionSource: remote`). The bundle id and EAS project come from `SPINE_IOS_BUNDLE_ID`, `SPINE_ANDROID_PACKAGE` and `EAS_PROJECT_ID` when they're set.
- Store review: provide reviewer notes with a hosted demo server address and a Field test account, since sign-in needs a server ([R-11](13-risks-open-questions.md)).

## Over-the-air updates

- `expo-updates` with a runtime version policy of `appVersion`: JS-only fixes ship OTA within the same `X.Y`; any native change (new module, SDK bump, permission) requires a store build.
- OTA updates are never used to change what data the app can reach; server authorisation is the boundary.
- The server rejects clients below its minimum supported version with `426 CLIENT_TOO_OLD`; the app shows "Update Spine to keep going" with a store link. The links live in `app.json` › `extra.storeLinks`; the App Store one is a placeholder until the listing exists.
- Server address: people type the link they open Spine with on a computer. The app looks for the API at `<address>/api` (a real install, behind Caddy) and then at the address itself (the API's own port in development), using `GET /health`'s `service: "spine"` to know it found Spine.

## Permissions

| Permission | Platform key | Purpose string | Asked when |
|---|---|---|---|
| Camera | `NSCameraUsageDescription` / `CAMERA` | "Spine uses the camera for site photos and receipt pictures." | First "Add photos" or receipt capture, after the in-app explainer (US-MOB-14) |
| Photo library (read) | `NSPhotoLibraryUsageDescription` / Android photo picker (no permission) | "Choose existing photos and receipts to attach." | First gallery pick |
| Notifications | — | Not requested in v1 (no native push) | — |
| Location | — | Not requested | — |

## Deep links

| Link | Opens |
|---|---|
| `spine://jobs/<id>` | Job detail (after sign-in) |
| `spine://expenses/<id>` | Expense detail |
| `spine://sync` | Sync screen |

Links to records the user can't access open the job list with "You don't have access to that job." Universal links / app links are not used in v1 (each instance has its own domain).

## Push notifications

Native push is out of scope for v1. Field users are notified by email and see changes on next sync. Web push (browser) is covered by US-NTF-04/05.

## Data and privacy labels

| Data | Collected | Linked to user | Purpose |
|---|---|---|---|
| Name, email | Yes (sign-in) | Yes | App functionality |
| Photos | Yes (user-initiated) | Yes | App functionality |
| Financial info | Own expense amounts only | Yes | App functionality |
| Usage data, diagnostics, location, identifiers for tracking | No | — | — |

All data goes only to the user's own Spine server; the publisher receives nothing. App Store "Data not used to track you"; Play "No data shared with third parties".

## Offline storage on the device

- Session token in the secure store (Keychain / Keystore); cleared on sign-out.
- Read cache and outbox in SQLite; photos and receipts compressed before queueing, server cap 10 MB ([D-053](12-decisions.md)).
- Sign-out with unsent items asks first (US-MOB-02).
