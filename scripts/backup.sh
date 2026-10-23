#!/bin/sh
# Back up Spine into one file (US-OPS-03).
#
#   ./backup.sh                     writes backups/spine-backup-<YYYYMMDD-HHMMSS>.tar.gz
#   ./backup.sh --passphrase        asks for a passphrase and encrypts it (.tar.gz.enc);
#                                   BACKUP_PASSPHRASE in .env does the same without asking
#   ./backup.sh --output /mnt/usb   writes it to that folder instead
#
# The archive holds the database, every stored file (from the files volume or
# the S3 bucket) and a manifest with the version and each file's checksum.
# With BACKUP_REMOTE in .env, the encrypted archive is also copied off-site,
# keeping 7 daily and 4 weekly copies. Restore with ./restore.sh.
#
# A nightly backup at 02:00 (add it with `crontab -e`; set BACKUP_PASSPHRASE in .env):
#   0 2 * * * cd /opt/spine && ./backup.sh >> backups/backup.log 2>&1
# Keep a copy off this machine too, e.g.:
#   rsync -a /opt/spine/backups/ you@other-host:spine-backups/
set -eu

say() { printf '%s\n' "$*"; }
fail() {
  printf 'Spine backup: %s\n' "$*" >&2
  exit 1
}

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$here/docker-compose.yml" ]; then
  root=$here
elif [ -f "$here/../docker-compose.yml" ]; then
  root=$(CDPATH='' cd -- "$here/.." && pwd)
else
  fail "docker-compose.yml isn't next to this script. Run it from your Spine folder."
fi
cd "$root"

ask=0
output=backups
while [ $# -gt 0 ]; do
  case $1 in
    --passphrase) ask=1 ;;
    --output)
      [ $# -ge 2 ] || fail "--output needs a folder"
      output=$2
      shift
      ;;
    --output=*) output=${1#*=} ;;
    -h | --help)
      sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fail "Unknown option: $1 (see ./backup.sh --help)" ;;
  esac
  shift
done

command -v docker >/dev/null 2>&1 || fail "Docker isn't installed."
[ -n "$(docker compose ps -q api 2>/dev/null)" ] || fail "Spine isn't running. Start it (./install.sh or docker compose up -d), then run this again."

forward=
if [ "$ask" -eq 1 ]; then
  [ -t 0 ] || fail "--passphrase asks for it, so it needs a terminal. For scheduled backups, set BACKUP_PASSPHRASE in .env."
  stty -echo
  printf 'Passphrase for this backup: '
  read -r first || first=
  printf '\nType it again: '
  read -r second || second=
  stty echo
  printf '\n'
  [ -n "$first" ] || fail "The passphrase can't be empty."
  [ "$first" = "$second" ] || fail "The two passphrases don't match."
  BACKUP_PASSPHRASE=$first
  export BACKUP_PASSPHRASE
fi
# A passphrase from this shell (or just typed) goes to the container; one in .env is already there.
[ -z "${BACKUP_PASSPHRASE:-}" ] || forward=BACKUP_PASSPHRASE
encrypted=0
if [ -n "${BACKUP_PASSPHRASE:-}" ] || [ -n "$(sed -n 's/^BACKUP_PASSPHRASE=//p' .env 2>/dev/null | tail -n 1)" ]; then
  encrypted=1
fi

name="spine-backup-$(date -u +%Y%m%d-%H%M%S).tar.gz"
[ "$encrypted" -eq 0 ] || name="$name.enc"
mkdir -p "$output"
chmod 700 "$output" 2>/dev/null || true
path="$output/$name"

cleanup() {
  rm -f "$path"
  docker compose exec -T api rm -f "/tmp/$name" >/dev/null 2>&1 || true
}
trap 'cleanup; exit 1' INT TERM

say "Backing up Spine…"
if [ -n "$forward" ]; then
  run_ok=0
  docker compose exec -T -e "$forward" api node apps/api/dist/scripts/backup.js --output "/tmp/$name" || run_ok=$?
else
  run_ok=0
  docker compose exec -T api node apps/api/dist/scripts/backup.js --output "/tmp/$name" || run_ok=$?
fi
if [ "$run_ok" -ne 0 ]; then
  cleanup
  fail "The backup didn't finish, and nothing was kept. The lines above say why."
fi
if ! docker compose cp "api:/tmp/$name" "$path" >/dev/null 2>&1; then
  cleanup
  fail "The backup was made but couldn't be copied out of the API container to $path."
fi
docker compose exec -T api rm -f "/tmp/$name" >/dev/null 2>&1 || true
# It holds the whole database: readable by you only.
chmod 600 "$path"

size=$(du -h "$path" | awk '{ print $1 }')
say "Backup saved: $path ($size)"
[ "$encrypted" -eq 1 ] || say "It isn't encrypted: keep it somewhere safe, or use --passphrase."
