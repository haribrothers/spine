---
title: Upgrades
description: Know when a new version is out, and upgrade with one command.
sidebar:
  order: 6
---

## Know when there's a new version

Once a day, Spine asks GitHub Releases for its latest release. When there's a newer one, Owners see a banner at the top of every page:

> **Spine 1.1.0 is available.** You're on 1.0.0. Updating runs database migrations automatically and takes a backup first.

**What's new** opens that release's notes; **How to update** opens this page. Closing the banner hides it until the next version. Staff and Field users never see it.

The check sends nothing about your install — not your address, your version or your business. Pre-releases (betas) are never offered. To turn the check off, set `UPDATE_CHECK=off` in `.env`: no request is made at all.

## Upgrade

From the folder with your `.env`:

```bash
./upgrade.sh                    # to the latest release
./upgrade.sh --version 1.0.1    # to a given version (a beta needs its version named)
```

It:

1. backs up first, with `backup.sh`;
2. downloads the new version's release files and checks them against their SHA-256 sums;
3. pulls the new images and restarts.

When the API starts, it takes a **database snapshot** (the last three are kept on the `spine_snapshots` volume), then applies the new version's migrations before it serves anyone. If a migration fails, Spine stops without serving, changes nothing, and the log names the snapshot to restore.

Your `.env` is kept; only `SPINE_VERSION` in it changes. **Settings › About Spine** shows the version you're on.

:::note[In a clone of the repository]
Check out the version's tag first (`git fetch --tags && git checkout v1.0.1`), then run `./scripts/upgrade.sh --version 1.0.1`.
:::

## Going back

Spine never goes back a version, because migrations only go forward. To return to an older version, [restore a backup](../backups/#restore) made on it — `upgrade.sh` made one just before upgrading.

## The field app

The phone app updates from the App Store or Play Store. When a server needs a newer app (`MOBILE_MIN_VERSION`), an older one shows "Update Spine to keep going".

## On Coolify

See [Running on Coolify](../coolify/#upgrading).
