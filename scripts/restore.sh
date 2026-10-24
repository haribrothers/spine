#!/bin/sh
# Restore a Spine backup (US-OPS-04).
#
#   ./restore.sh backups/spine-backup-20261023-020000.tar.gz
#   ./restore.sh <archive> --replace      on an install that already has data: deletes it all first
#   ./restore.sh <archive> --new-secret   restore although this install's AUTH_SECRET is new
#
# Onto a new machine: install Spine (./install.sh), put the old install's
# AUTH_SECRET in .env, then run this. Spine stops while it runs and starts
# again with the backup's data. An encrypted backup (.tar.gz.enc) asks for its
# passphrase, or reads BACKUP_PASSPHRASE. Everything is checked before
# anything is changed; a backup from a newer Spine is refused (upgrade first).
set -eu

say() { printf '%s\n' "$*"; }
fail() {
  printf 'Spine restore: %s\n' "$*" >&2
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

archive=
flags=
while [ $# -gt 0 ]; do
  case $1 in
    --replace) flags="$flags --replace" ;;
    --new-secret) flags="$flags --new-secret" ;;
    -h | --help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*) fail "Unknown option: $1 (see ./restore.sh --help)" ;;
    *)
      [ -z "$archive" ] || fail "Give one backup file."
      archive=$1
      ;;
  esac
  shift
done
[ -n "$archive" ] || fail "Which backup? ./restore.sh backups/spine-backup-<date>.tar.gz"
[ -f "$archive" ] || fail "There's no file at $archive."
archive=$(CDPATH='' cd -- "$(dirname -- "$archive")" && pwd)/$(basename -- "$archive")
cd "$root"
[ -f .env ] || fail "There's no .env here. Install Spine first (./install.sh), then restore."
command -v docker >/dev/null 2>&1 || fail "Docker isn't installed."

forward=
if [ "$(head -c 8 "$archive")" = "SPINEBK1" ] && [ -z "${BACKUP_PASSPHRASE:-}" ] && [ -z "$(sed -n 's/^BACKUP_PASSPHRASE=//p' .env | tail -n 1)" ]; then
  [ -t 0 ] || fail "This backup is encrypted. Set BACKUP_PASSPHRASE, or run this in a terminal to type it."
  stty -echo
  printf 'Passphrase for this backup: '
  read -r BACKUP_PASSPHRASE || BACKUP_PASSPHRASE=
  stty echo
  printf '\n'
  export BACKUP_PASSPHRASE
fi
[ -z "${BACKUP_PASSPHRASE:-}" ] || forward=BACKUP_PASSPHRASE

say "Stopping Spine while the backup is restored…"
docker compose up -d --no-build --wait db >/dev/null 2>&1 || fail "The database didn't start. See why with: docker compose logs db"
docker compose stop api web >/dev/null 2>&1 || true

status=0
# shellcheck disable=SC2086 # $flags holds whole options
if [ -n "$forward" ]; then
  docker compose run --rm --no-deps -T -e "$forward" api node apps/api/dist/scripts/restore.js --archive - $flags <"$archive" || status=$?
else
  docker compose run --rm --no-deps -T api node apps/api/dist/scripts/restore.js --archive - $flags <"$archive" || status=$?
fi

say "Starting Spine…"
if ! docker compose up -d --no-build --wait api web >/dev/null 2>&1; then
  fail "Spine didn't start again. See why with: docker compose logs api"
fi
if [ "$status" -eq 3 ]; then
  fail "Nothing was restored (the reason is above). Spine is running as it was."
elif [ "$status" -ne 0 ]; then
  fail "The restore failed part-way (the reason is above), so this install's data may be incomplete. Fix the cause and run it again with --replace."
fi
app_url=$(sed -n 's/^APP_URL=//p' .env | tail -n 1)
say "Restored. Spine is running at $app_url with the backup's data — sign in as before."
