// US-MOB-28 — build the field app's beta on the Owner's Mac. Run: pnpm test:scripts
// build-beta.sh checks the release keystore with the real keytool, then stops at a fake `npx`
// (expo prebuild), so nothing is built.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

const repo = new URL("../..", import.meta.url).pathname;
const keytool = [process.env.JAVA_HOME && join(process.env.JAVA_HOME, "bin/keytool"), spawnSync("sh", ["-c", "command -v keytool"], { encoding: "utf8" }).stdout.trim()]
  .filter(Boolean)
  .find((path) => existsSync(path));

const FAKE_NPX = `#!/bin/sh
echo "$*" >> "$FAKE_NPX_LOG"
exit 1
`;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "spine-build-beta-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "npx"), FAKE_NPX);
  chmodSync(join(bin, "npx"), 0o755);
  mkdirSync(join(dir, "android-sdk"));
  const keystore = (name, type, storePass, keyPass = storePass) => {
    const file = join(dir, name);
    const args = ["-genkeypair", "-storetype", type, "-keystore", file, "-alias", "spine", "-keyalg", "RSA", "-keysize", "2048", "-validity", "30", "-dname", "CN=Spine test", "-storepass", storePass];
    const made = spawnSync(keytool, type === "JKS" ? [...args, "-keypass", keyPass] : args, { encoding: "utf8" });
    assert.equal(made.status, 0, made.stderr);
    return file;
  };
  const log = join(dir, "npx.log");
  const run = (env) => {
    const result = spawnSync("sh", [join(repo, "scripts/mobile/build-beta.sh"), "--android"], {
      encoding: "utf8",
      env: {
        PATH: [bin, dirname(process.execPath), dirname(keytool), "/usr/bin", "/bin"].join(":"),
        HOME: dir,
        ANDROID_HOME: join(dir, "android-sdk"),
        FAKE_NPX_LOG: log,
        SPINE_ANDROID_KEY_ALIAS: "spine",
        ...env,
      },
    });
    return { ...result, built: existsSync(log) && readFileSync(log, "utf8").includes("expo prebuild") };
  };
  return { keystore, run };
}

describe("US-MOB-28 · the beta build checks the release keystore before building", { skip: !keytool && "keytool isn't installed" }, () => {
  it("goes on to build with the right passwords, and a key password of its own (JKS)", () => {
    const { keystore, run } = setup();
    const file = keystore("spine.jks", "JKS", "st$re! pass", "k3y pass");
    const result = run({ SPINE_ANDROID_KEYSTORE: file, SPINE_ANDROID_KEYSTORE_PASSWORD: "st$re! pass", SPINE_ANDROID_KEY_PASSWORD: "k3y pass" });
    assert.ok(result.built, result.stderr);
  });

  it("stops before building when the keystore's password is wrong", () => {
    const { keystore, run } = setup();
    const file = keystore("spine.jks", "JKS", "right-pass");
    const result = run({ SPINE_ANDROID_KEYSTORE: file, SPINE_ANDROID_KEYSTORE_PASSWORD: "…", SPINE_ANDROID_KEY_PASSWORD: "…" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SPINE_ANDROID_KEYSTORE_PASSWORD doesn't open .*spine\.jks\. Set it again, in single quotes/);
    assert.ok(!result.built);
  });

  it("stops before building when there's no key by that alias", () => {
    const { keystore, run } = setup();
    const file = keystore("spine.jks", "JKS", "right-pass");
    const result = run({ SPINE_ANDROID_KEYSTORE: file, SPINE_ANDROID_KEYSTORE_PASSWORD: "right-pass", SPINE_ANDROID_KEY_PASSWORD: "right-pass", SPINE_ANDROID_KEY_ALIAS: "release" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /There's no key called release in /);
    assert.ok(!result.built);
  });

  it("stops before building when the key's password is wrong (JKS)", () => {
    const { keystore, run } = setup();
    const file = keystore("spine.jks", "JKS", "right-pass", "key-pass");
    const result = run({ SPINE_ANDROID_KEYSTORE: file, SPINE_ANDROID_KEYSTORE_PASSWORD: "right-pass", SPINE_ANDROID_KEY_PASSWORD: "right-pass" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SPINE_ANDROID_KEY_PASSWORD doesn't open the key spine\. If you pressed Return/);
    assert.ok(!result.built);
  });

  it("a PKCS12 keystore's key password must be the keystore's", () => {
    const { keystore, run } = setup();
    const file = keystore("spine.p12", "PKCS12", "right-pass");
    const wrong = run({ SPINE_ANDROID_KEYSTORE: file, SPINE_ANDROID_KEYSTORE_PASSWORD: "right-pass", SPINE_ANDROID_KEY_PASSWORD: "other" });
    assert.equal(wrong.status, 1);
    assert.match(wrong.stderr, /must be the same as SPINE_ANDROID_KEYSTORE_PASSWORD/);
    assert.ok(!wrong.built);
    const right = run({ SPINE_ANDROID_KEYSTORE: file, SPINE_ANDROID_KEYSTORE_PASSWORD: "right-pass", SPINE_ANDROID_KEY_PASSWORD: "right-pass" });
    assert.ok(right.built, right.stderr);
  });
});
