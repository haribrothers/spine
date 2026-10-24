#!/bin/sh
# Upgrade Spine with one command (US-OPS-50).
#
#   ./upgrade.sh                      to the latest release
#   ./upgrade.sh --version 1.0.1      to that version (needed for a beta: betas are never "latest")
#   ./upgrade.sh --files <folder>     with that version's release files from a folder, not downloaded
#
# It backs up first (./backup.sh), takes the new version's release files
# (checked against their SHA-256 sums), pulls its images and restarts. The API
# then applies the new version's database migrations, after a snapshot.
# Your .env is kept; only SPINE_VERSION in it changes. Spine never goes back a
# version: to return to an older one, restore a backup made on it.
# In a clone, check out the version's tag first (git checkout v<version>).
set -eu

REPO=haribrothers/spine

say() { printf '%s\n' "$*"; }
fail() {
  printf 'Spine upgrade: %s\n' "$*" >&2
  exit 1
}

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$here/docker-compose.yml" ]; then
  root=$here
  layout=release
  scripts=.
elif [ -f "$here/../docker-compose.yml" ]; then
  root=$(CDPATH='' cd -- "$here/.." && pwd)
  layout=clone
  scripts=scripts
else
  fail "docker-compose.yml isn't next to this script. Run it from your Spine folder."
fi

target=
files=
while [ $# -gt 0 ]; do
  case $1 in
    --version)
      [ $# -ge 2 ] || fail "--version needs a version, e.g. --version 1.0.1"
      target=${2#v}
      shift
      ;;
    --version=*) target=${1#*=} target=${target#v} ;;
    --files)
      [ $# -ge 2 ] || fail "--files needs the folder with the release's files"
      files=$(CDPATH='' cd -- "$2" && pwd) || fail "There's no folder at $2."
      shift
      ;;
    -h | --help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fail "Unknown option: $1 (see ./upgrade.sh --help)" ;;
  esac
  shift
done
cd "$root"
[ -f .env ] || fail "There's no .env here. Install Spine first (./install.sh)."
command -v docker >/dev/null 2>&1 || fail "Docker isn't installed."
[ -n "$(docker compose ps -q api 2>/dev/null)" ] || fail "Spine isn't running. Start it (docker compose up -d), then upgrade."

# --- Versions --------------------------------------------------------------

current=$(sed -n 's/^SPINE_VERSION=//p' .env | tail -n 1)
# shellcheck disable=SC2016 # the ${…} is the Compose file's own text
[ -n "$current" ] || current=$(sed -n 's/.*spine-api:\${SPINE_VERSION:-\([^}]*\)}.*/\1/p' docker-compose.yml | head -n 1)
[ -n "$current" ] || fail "Couldn't tell which version is installed."

if [ -z "$target" ]; then
  command -v curl >/dev/null 2>&1 || fail "curl isn't installed, so the latest release can't be looked up. Name the version: ./upgrade.sh --version <version>"
  target=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -n 1) || target=
  [ -n "$target" ] || fail "Couldn't find the latest release. Name the version: ./upgrade.sh --version <version>"
fi

# 1 if $1 is newer than $2, 0 if the same, -1 if older (semver, pre-releases before releases).
compare() {
  awk -v a="$1" -v b="$2" 'function part(v, i, n, x) { split(v, n, "-"); split(n[1], x, "."); return x[i] + 0 }
    function pre(v, n) { n = index(v, "-"); return n ? substr(v, n + 1) : "" }
    BEGIN {
      for (i = 1; i <= 3; i++) { if (part(a, i) > part(b, i)) { print 1; exit } if (part(a, i) < part(b, i)) { print -1; exit } }
      pa = pre(a); pb = pre(b)
      if (pa == pb) { print 0; exit }
      if (pa == "") { print 1; exit } if (pb == "") { print -1; exit }
      na = split(pa, x, "."); nb = split(pb, y, ".")
      for (i = 1; i <= (na > nb ? na : nb); i++) {
        if (i > na) { print -1; exit } if (i > nb) { print 1; exit }
        if (x[i] == y[i]) continue
        if (x[i] ~ /^[0-9]+$/ && y[i] ~ /^[0-9]+$/) { print (x[i] + 0 > y[i] + 0) ? 1 : -1; exit }
        print (x[i] > y[i]) ? 1 : -1; exit
      }
      print 0
    }'
}
case $(compare "$target" "$current") in
  0)
    say "Spine is already $current."
    exit 0
    ;;
  -1) fail "$target is older than this install ($current), and Spine can't go back a version. To return to $target's data, restore a backup made on $target into a fresh $target install." ;;
esac

# --- The new version's files ------------------------------------------------

if [ "$layout" = clone ]; then
  tag=$(git describe --tags --exact-match 2>/dev/null || true)
  [ "$tag" = "v$target" ] || [ -n "$files" ] || fail "This is a clone: check out v$target first (git fetch --tags && git checkout v$target), then run ./scripts/upgrade.sh --version $target again."
fi

staged=
if [ "$layout" = release ]; then
  staged=$(mktemp -d)
  trap 'rm -rf "$staged"' EXIT
  if [ -n "$files" ]; then
    for f in docker-compose.yml Caddyfile env.example install.sh backup.sh restore.sh upgrade.sh SHA256SUMS; do
      [ ! -f "$files/$f" ] || cp "$files/$f" "$staged/$f"
    done
    [ -f "$staged/docker-compose.yml" ] || fail "There's no docker-compose.yml in $files."
  else
    command -v curl >/dev/null 2>&1 || fail "curl isn't installed. Download Spine $target's release files and run ./upgrade.sh --version $target --files <folder>."
    say "Downloading Spine $target's files…"
    for f in docker-compose.yml Caddyfile env.example install.sh backup.sh restore.sh upgrade.sh SHA256SUMS; do
      curl -fsSL -o "$staged/$f" "https://github.com/$REPO/releases/download/v$target/$f" || fail "Couldn't download $f for Spine $target. Check the version, or download the files yourself and use --files."
    done
  fi
  if [ -f "$staged/SHA256SUMS" ]; then
    (cd "$staged" && if command -v sha256sum >/dev/null 2>&1; then sha256sum -c --quiet SHA256SUMS; else shasum -a 256 -c --quiet SHA256SUMS; fi) ||
      fail "Spine $target's files don't match their checksums, so nothing was changed. Download them again."
  fi
  grep -q "spine-api:\${SPINE_VERSION:-$target}" "$staged/docker-compose.yml" || fail "Those files aren't Spine $target's (docker-compose.yml names another version)."
fi

# --- Back up, then switch ---------------------------------------------------

say "Backing up before the upgrade…"
backup_out=$("$scripts/backup.sh") || fail "The backup didn't finish, so nothing was upgraded. The reason is above."
printf '%s\n' "$backup_out"
backup=$(printf '%s\n' "$backup_out" | sed -n 's/^Backup saved: \(.*\) (.*)$/\1/p' | tail -n 1)

if [ -n "$staged" ]; then
  mkdir -p .previous
  for f in docker-compose.yml Caddyfile env.example install.sh backup.sh restore.sh upgrade.sh; do
    [ ! -f "$f" ] || cp -p "$f" ".previous/$f"
    # Renamed into place: this script keeps running from its own copy while upgrade.sh is replaced.
    if [ -f "$staged/$f" ]; then
      cp "$staged/$f" "$f.next"
      case $f in *.sh) chmod +x "$f.next" ;; esac
      mv -f "$f.next" "$f"
    fi
  done
fi
if grep -q '^SPINE_VERSION=' .env; then
  awk -v v="$target" '/^SPINE_VERSION=/ { print "SPINE_VERSION=" v; next } { print }' .env >.env.next && cat .env.next >.env && rm -f .env.next
else
  printf '\n# The installed version (./upgrade.sh sets it).\nSPINE_VERSION=%s\n' "$target" >>.env
fi

profile=minimal
docker compose ps --services --status running 2>/dev/null | grep -qx tunnel && profile=full

say "Starting Spine ${target}…"
docker compose --profile "$profile" pull --quiet --ignore-pull-failures >/dev/null 2>&1 || true
if ! docker compose --profile "$profile" up -d --no-build --wait --wait-timeout 600; then
  say ""
  say "Spine $target didn't start. See why with: docker compose logs api"
  say "Your data is safe: a failed migration changes nothing, and your backup is ${backup:-in backups/}."
  say "To go back: set SPINE_VERSION=$current in .env${staged:+, put the files in .previous/ back,} and run docker compose up -d."
  exit 1
fi

say ""
say "Spine is now $target. Your backup is ${backup:-in backups/}."
