# Running the Spine beta

How to run a beta of Spine on your own server for an accountant and other testers before 1.0 ([D-265](prd/12-decisions.md), US-OPS-52). It takes about an hour the first time. On a server run by Coolify, follow [self-hosting-coolify.md](self-hosting-coolify.md) for the server part instead.

The repo, its releases and its images are public ([D-278](prd/12-decisions.md)), so the server downloads them without a GitHub account. Testers never need GitHub: they just open the beta's address.

## What you need

- **A small Linux server** (a VPS) with a public IP address:
  - 2 vCPUs, 4 GB of memory and 40 GB of disk is plenty for a beta;
  - Ubuntu 24.04 is assumed below;
  - amd64 (Intel or AMD) or arm64. Betas before `1.0.0-beta.3` are amd64 only.
- **A name for it**, such as `beta.h4loom.com`: an `A` record pointing at the server's IP address. Caddy gets the HTTPS certificate by itself once the name resolves and ports 80 and 443 are open.
- **An email service** for sending invitations and documents (SMTP): your mail provider's SMTP, or a service such as Postmark, Resend or Amazon SES.
- **A passphrase for the backups.** Write it down somewhere other than the server: without it, a backup can't be restored.

## Set up the server

1. Install Docker (24 or newer, with the Compose plugin):

   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # then log out and back in
   ```

2. Download the beta's files and install it at your address:

   ```sh
   mkdir -p ~/spine && cd ~/spine
   v=v1.0.0-beta.6
   for f in install.sh backup.sh restore.sh upgrade.sh docker-compose.yml env.example; do
     curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"
   done
   chmod +x *.sh
   ./install.sh --app-url https://beta.h4loom.com
   ```

   With `v1.0.0-beta.1` only, first run `mv default.env.example .env.example`: GitHub renamed that file because its name starts with a dot. Later releases ship it as `env.example`.

   It prints "Spine is running at https://beta.h4loom.com — open it to create the first account."

3. Before anyone else signs up, open the address and create your own account. The first account is the Owner, and after it Spine is invite-only.

4. Add the email service and the backup passphrase to `~/spine/.env`, then restart with `docker compose --profile minimal up -d`:

   ```sh
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=…
   SMTP_PASSWORD=…
   SMTP_FROM="Spine beta <beta@h4loom.com>"
   BACKUP_PASSPHRASE=…
   ```

5. Turn on nightly backups (`crontab -e`):

   ```sh
   0 2 * * * cd ~/spine && ./backup.sh >> backups/backup.log 2>&1
   ```

   Copy `backups/` off the server now and then, or set `BACKUP_REMOTE` in `.env` to copy each backup to an S3, R2 or B2 bucket automatically (see `.env.example`).

6. Keep a copy of `.env` somewhere safe as well. A restore needs its `AUTH_SECRET`.

## Invite the testers

- **Team › Users › Invite** sends each tester an email to join. Invite people as Staff, or as Field for someone who'll use only the phone app. Nobody is made an Owner at invitation.
- **The accountant** should see all the books. Once they've joined, either make them an Owner (Team › Users › their row › Change role), or give them a Team with every report and the accounting rights.
- **The phone app:** send Android testers the APK's link (see [The phone app](#the-phone-app)), and iPhone testers the TestFlight invitation if you build for iPhone. In the app they type the beta's address, `https://beta.h4loom.com`, and sign in with the same account.

The demo business (Settings › Data › Demo data) is a quick way to see Spine full of work. The accountant may prefer to enter a few real-looking transactions of their own, too. "Delete all demo data" removes only the demo.

## The phone app

Each beta's phone app is built on your Mac with `scripts/mobile/build-beta.sh` ([D-271](prd/12-decisions.md)). No Expo account is needed. After 1.0, once the repo is public, GitHub's macOS runners take over the store builds.

The beta can be Android only ([D-272](prd/12-decisions.md)). The Android APK needs no developer account. The iPhone app goes through TestFlight, which needs the Apple Developer Program (a yearly fee), so leave it out until you've joined.

**Once, before the first beta:**

1. **Tools:**
   - Android Studio (for the Android SDK);
   - JDK 17 (`brew install openjdk@17`);
   - for iPhone, Xcode, signed in to your Apple developer account (Xcode › Settings › Accounts).
2. **An Android release keystore.** Every update must be signed with the same one. Without it, testers would have to uninstall the app before installing the next beta. Back it, and its passwords, up somewhere other than your Mac:

   ```sh
   keytool -genkeypair -v -storetype JKS -keystore ~/spine-release.jks -alias spine -keyalg RSA -keysize 2048 -validity 10000
   ```

   When it asks for the key's password, press Return to use the keystore's.

3. **For iPhone:**
   - create the app in App Store Connect with the bundle id `com.h4loom.spine` (final from the first upload), and note your team id (developer.apple.com › Membership);
   - in App Store Connect › TestFlight, create an external group, then add the testers' emails or turn on a public link. Apple reviews the first build for external testers, which usually takes about a day.

**For each beta**, from its tag (here `v1.0.0-beta.2`):

```sh
git checkout v1.0.0-beta.2 && pnpm install
export SPINE_ANDROID_KEYSTORE=~/spine-release.jks SPINE_ANDROID_KEY_ALIAS=spine
export SPINE_ANDROID_KEYSTORE_PASSWORD='<keystore password>' SPINE_ANDROID_KEY_PASSWORD='<key password>'
scripts/mobile/build-beta.sh --android
```

- Keep the single quotes, so a password with `$`, `!` or spaces reaches the script as typed.
- The script checks the keystore and both passwords before it builds, and says which one is wrong. (From the beta after `1.0.0-beta.2`; earlier tags find out only at the end of the build.)
- For iPhone as well, also set `SPINE_APPLE_TEAM_ID=<team id>` and leave out `--android`. Once Apple has processed the build, it appears in TestFlight: add it to the external group.

It takes about 10–30 minutes and prints "Built: …/apps/mobile/build/spine-1.0.0-beta.2.apk".

**Give testers the APK.** `--upload` attaches it to the GitHub release, and testers can download it from the release page on their phone. Or share it one of these ways:

- **Google Drive:** upload the APK and share it with the testers (or "Anyone with the link"). They open the link on the phone, download it and tap it to install.
- **Firebase App Distribution** (free, with a Google account): upload the APK to a Firebase project and add the testers' emails. They get an email and install through the App Tester app, which also tells them about each new beta.

The first time, Android asks to allow installs from the app that opened the APK (Drive, Files or Chrome): allow it. Each new APK installs over the last, keeping the signed-in account.

## A new beta

When a new beta is tagged (`v1.0.0-beta.2` and so on):

```sh
cd ~/spine
./upgrade.sh --version 1.0.0-beta.2
```

It backs up first, downloads the new version's files, checks them, hands over to the new version's own `upgrade.sh`, restarts, and prints "Spine is now 1.0.0-beta.2. Your backup is …".

From `1.0.0-beta.1` only, take the new script first, because beta.1's predates that hand-over:

```sh
curl -fsSLO https://github.com/haribrothers/spine/releases/download/v1.0.0-beta.2/upgrade.sh && chmod +x upgrade.sh
```

Everyone's data carries over. Testers see the new version under Settings › About Spine.

On Android, testers install the new APK over the old one. iPhones update through TestFlight.

## Reporting a problem

Send this section to testers.

> **Found something wrong?** Send an email to <your address> with:
>
> 1. **What you did:** the page, and the steps, e.g. "Invoices › New invoice, added two lines, chose GST 18%, clicked Issue".
> 2. **What you expected,** and **what happened instead.**
> 3. **A screenshot,** if you can.
> 4. **The version:** Settings › About Spine (for example "Spine 1.0.0-beta.1"), or Profile in the phone app.
> 5. If an error page shows a **request id**, include it.
>
> Accounting questions ("this should have gone to a different account") are just as welcome as things that don't work.

Each report becomes a fix in the next beta. The accountant's review has its own checklist: [accounting-review.md](accounting-review.md).

## When the beta ends

1.0 is tagged once the accountant has signed off in [accounting-review.md](accounting-review.md) and the rest of Phase 12 is done. The beta server can then upgrade to 1.0 like any other version (`./upgrade.sh --version 1.0.0`), or be switched off: `docker compose --profile minimal down` keeps the data, and `down -v` deletes it.
