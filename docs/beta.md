# Running the Spine beta

How to run a beta of Spine on your own server for an accountant and other testers before 1.0 ([D-265](prd/12-decisions.md), US-OPS-52). It takes about an hour the first time.

The repo and its images are private until 1.0. So the server needs a GitHub token to download them. Testers never need GitHub: they just open the beta's address.

## What you need

- **A small Linux server** (a VPS) with a public IP address:
  - 2 vCPUs, 4 GB of memory and 40 GB of disk is plenty for a beta;
  - Ubuntu 24.04 is assumed below;
  - amd64 (Intel or AMD), since betas are built for amd64 only while the repo is private.
- **A name for it**, such as `beta.<domain>`: an `A` record pointing at the server's IP address. Caddy gets the HTTPS certificate by itself once the name resolves and ports 80 and 443 are open.
- **An email service** for sending invitations and documents (SMTP): your mail provider's SMTP, or a service such as Postmark, Resend or Amazon SES.
- **A GitHub token** with read-only access to the Spine repo's contents and packages, made under GitHub › Settings › Developer settings › Personal access tokens. A classic token needs `repo` and `read:packages`.
- **A passphrase for the backups.** Write it down somewhere other than the server: without it, a backup can't be restored.

## Set up the server

1. Install Docker (24 or newer, with the Compose plugin):

   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # then log out and back in
   ```

2. Let Docker download Spine's private images, and the `gh` tool download the release:

   ```sh
   echo <token> | docker login ghcr.io -u <your GitHub user> --password-stdin
   sudo apt-get install -y gh && echo <token> | gh auth login --with-token
   ```

3. Download the beta's files and install it at your address:

   ```sh
   mkdir -p ~/spine && cd ~/spine
   gh release download v1.0.0-beta.1 --repo haribrothers/spine
   chmod +x *.sh
   ./install.sh --app-url https://beta.<domain>
   ```

   It prints "Spine is running at https://beta.<domain> — open it to create the first account."

4. Before anyone else signs up, open the address and create your own account. The first account is the Owner, and after it Spine is invite-only.

5. Add the email service and the backup passphrase to `~/spine/.env`, then restart with `docker compose --profile minimal up -d`:

   ```sh
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=…
   SMTP_PASSWORD=…
   SMTP_FROM="Spine beta <beta@<domain>>"
   BACKUP_PASSPHRASE=…
   ```

6. Turn on nightly backups (`crontab -e`):

   ```sh
   0 2 * * * cd ~/spine && ./backup.sh >> backups/backup.log 2>&1
   ```

   Copy `backups/` off the server now and then, or set `BACKUP_REMOTE` in `.env` to copy each backup to an S3, R2 or B2 bucket automatically (see `.env.example`).

7. Keep a copy of `.env` somewhere safe as well. A restore needs its `AUTH_SECRET`.

## Invite the testers

- **Team › Users › Invite** sends each tester an email to join. Invite people as Staff, or as Field for someone who'll use only the phone app. Nobody is made an Owner at invitation.
- **The accountant** should see all the books. Once they've joined, either make them an Owner (Team › Users › their row › Change role), or give them a Team with every report and the accounting rights.
- **The phone app:** send testers the TestFlight invitation (iPhone) and the APK link (Android) from the beta's GitHub release notes. In the app they type the beta's address, `https://beta.<domain>`, and sign in with the same account.

The demo business (Settings › Data › Demo data) is a quick way to see Spine full of work. The accountant may prefer to enter a few real-looking transactions of their own, too. "Delete all demo data" removes only the demo.

## The phone app (one-time setup)

Each beta tag builds the field app on EAS, Expo's build service: iOS goes to TestFlight, and Android becomes an APK attached to the GitHub release. That needs a few accounts, set up once. Until then the release skips the phone app with a notice and everything else still publishes.

1. **The bundle id comes first.** Pick the app's final id from the domain, e.g. `com.<domain>.spine`. It can never change after the first TestFlight upload, and both stores use it. Set it as GitHub repository variables `SPINE_IOS_BUNDLE_ID` and `SPINE_ANDROID_PACKAGE` (Settings › Secrets and variables › Actions › Variables).
2. **Expo:** create an account at expo.dev. In `apps/mobile`, run `npx eas-cli init` and set the project id it prints as the variable `EAS_PROJECT_ID`. Create an access token (expo.dev › Account settings › Access tokens) and add it as the secret `EXPO_TOKEN`.
3. **Apple:** with your Apple Developer account, create the app in App Store Connect with that bundle id. In `apps/mobile`, run `npx eas-cli credentials` once to make the signing certificate, and give EAS an App Store Connect API key for uploads (`npx eas-cli submit --platform ios` asks for it the first time).
4. **TestFlight:** in App Store Connect › TestFlight, create an external group, add the testers' emails or turn on a public link, and add each new build to the group. Apple reviews the first build for external testers, which usually takes about a day.
5. **Android** needs no account for the beta. Testers open the APK link from the release on their phone and allow installing it. Each new APK installs over the last.

## A new beta

When a new beta is tagged (`v1.0.0-beta.2` and so on):

```sh
cd ~/spine
./upgrade.sh --version 1.0.0-beta.2
```

It backs up first, downloads the new version's files, restarts, and prints "Spine is now 1.0.0-beta.2. Your backup is …". Everyone's data carries over. Testers see the new version under Settings › About Spine.

Phones update through TestFlight. On Android, testers install the new APK over the old one.

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
