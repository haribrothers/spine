const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Sets `android:largeHeap="true"` on the Android `<application>` tag —
 * required for this app specifically, not a generic default worth adding to
 * every Expo app. Confirmed as a real, reproducible fix (not a workaround
 * for an unrelated environment issue): navigating to the Date & Time Picker
 * demo crashed with a real `OutOfMemoryError` inside Compose's
 * `LayoutNode.<init>` on a genuinely fresh app process (PID freshly
 * launched after a full emulator reboot, ruling out session-long heap
 * buildup) — confirmed via `adb logcat`'s full stack trace hitting a fixed
 * 192MB heap ceiling (`target footprint 201326592`) regardless of the
 * emulator's own configured `vm.heapSize=228` in `config.ini`, meaning the
 * app's default (non-`largeHeap`) manifest heap growth limit was capping
 * below what the AVD actually makes available. Material3's `DatePicker`
 * (this repo's `@expo/ui/community/datetime-picker`'s Android backing,
 * `DatePickerView.kt`) is a genuinely heavy Compose subtree — a full
 * calendar grid, year picker, etc. — stacked on top of the rest of this
 * showcase app's already-composed tree (NativeTabs host, the Components
 * list still on the back-stack), plausibly enough to tip a real device/AVD
 * over a non-`largeHeap` ceiling. `largeHeap` is the correct, standard
 * Android mechanism for exactly this situation (an app that legitimately
 * needs more heap than the OS default grants) — not a memory-leak
 * workaround.
 */
function withAndroidLargeHeap(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:largeHeap"] = "true";
    }
    return config;
  });
}

module.exports = withAndroidLargeHeap;
