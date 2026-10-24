#!/bin/sh
# US-OPS-04 (NFR-REL-03) — restore-verify: install Spine from the release's
# files with this commit's images, seed the demo business, back it up, wipe the
# install, install again with the same .env, restore, and check the trial
# balance and the file count match (restore.sh itself checks every file's
# checksum as it writes it). CI runs it on every v* tag; run it locally too:
#
#   docker build -f docker/Dockerfile.api -t ghcr.io/haribrothers/spine-api:<version> .
#   docker build -f docker/Dockerfile.web -t ghcr.io/haribrothers/spine-web:<version> .
#   scripts/ci/restore-verify.sh
#
# Needs ports 80 and 443 free.
set -eu

repo=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
version=$(node -p "require('$repo/package.json').version")
work=$(mktemp -d)
api=http://localhost/api
jar="$work/cookies"
email="restore-verify@example.com"
password="Restore-verify-$(date +%s)"

step() { printf '\n▸ %s\n' "$*"; }
fail() {
  printf '✗ restore-verify: %s\n' "$*" >&2
  printf '\nThe API'"'"'s last log lines:\n' >&2
  (cd "$work" && docker compose logs --tail 40 api >&2) || true
  exit 1
}
cleanup() {
  (cd "$work" && docker compose --profile minimal down -v >/dev/null 2>&1) || true
  rm -rf "$work"
}
trap cleanup EXIT

node "$repo/scripts/release/release-compose.mjs" "$version" >"$work/docker-compose.yml"
cp "$repo/docker/Caddyfile" "$repo/.env.example" "$repo/scripts/install.sh" "$repo/scripts/backup.sh" "$repo/scripts/restore.sh" "$work/"
cd "$work"

sign_in() {
  rm -f "$jar"
  curl -sf -c "$jar" -o /dev/null -H "Content-Type: application/json" -H "Origin: http://localhost" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" "$api/auth/sign-in/email" || fail "couldn't sign in"
}
trial_balance() {
  curl -sf -b "$jar" "$api/reports/trial-balance?asOf=2099-12-31" || fail "couldn't read the trial balance"
}
# Issued documents' PDFs are stored by a background job; the counts mean
# something only once none is waiting.
wait_for_pdfs() {
  i=0
  while [ "$(docker compose exec -T db psql -U spine -d spine -tAc "select count(*) from pgboss.job where name = 'store-issued-pdf' and state in ('created', 'retry', 'active')" | tr -d '[:space:]')" != 0 ]; do
    i=$((i + 1))
    [ "$i" -le 120 ] || fail "issued documents' PDFs were still being stored after 10 minutes"
    sleep 5
  done
}
file_count() {
  docker compose exec -T db psql -U spine -d spine -tAc "select count(*) from files" | tr -d '[:space:]'
}

step "Install Spine $version"
./install.sh --non-interactive

step "Sign up and load the demo business"
curl -sf -o /dev/null -H "Content-Type: application/json" -H "Origin: http://localhost" \
  -d "{\"email\":\"$email\",\"password\":\"$password\",\"name\":\"Restore Verify\"}" "$api/auth/sign-up/email" || fail "couldn't sign up"
sign_in
seeded=$(curl -s -w '\n%{http_code}' -b "$jar" -X POST -H "Content-Type: application/json" -H "Idempotency-Key: $(node -e 'console.log(crypto.randomUUID())')" -d '{}' "$api/demo-data/seed")
[ "$(printf '%s' "$seeded" | tail -n 1)" = 201 ] || [ "$(printf '%s' "$seeded" | tail -n 1)" = 200 ] || fail "couldn't load the demo data: $seeded"
wait_for_pdfs
before_tb=$(trial_balance)
before_files=$(file_count)
[ "$before_files" -gt 0 ] || fail "the demo business has no files to back up"
printf 'Trial balance read; %s files.\n' "$before_files"

step "Back up (encrypted)"
BACKUP_PASSPHRASE="restore-verify passphrase" ./backup.sh
archive=$(find backups -name "spine-backup-*.tar.gz.enc" | head -n 1)
[ -n "$archive" ] || fail "the backup wrote no archive"

step "Wipe the install, then install again with the same .env"
docker compose --profile minimal down -v
./install.sh --non-interactive

step "Restore"
BACKUP_PASSPHRASE="restore-verify passphrase" ./restore.sh "$archive"

step "Compare"
wait_for_pdfs
sign_in
after_tb=$(trial_balance)
after_files=$(file_count)
[ "$before_files" = "$after_files" ] || fail "file count: $before_files before, $after_files after"
[ "$before_tb" = "$after_tb" ] || fail "the trial balance differs after the restore"
printf '✓ restore-verify: the trial balance and all %s files match.\n' "$after_files"
