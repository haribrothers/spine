#!/bin/sh
# US-OPS-50 (NFR-MNT-02) — upgrade-verify: install the previous release with
# the demo business, upgrade it to this commit with upgrade.sh, and check the
# trial balance and the files are unchanged. CI runs it on every v* tag with
# this commit's images built (as for restore-verify); with no earlier release
# there's nothing to upgrade from, and it says so.
#
# The previous release comes from GitHub (gh release download, GHCR images;
# GH_TOKEN), or from PREVIOUS_VERSION and PREVIOUS_FILES_DIR (a folder with its
# release files, its images already on this machine) to run it locally.
# Needs ports 80 and 443 free.
set -eu

repo=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
version=$(node -p "require('$repo/package.json').version")
work=$(mktemp -d)
api=http://localhost/api
jar="$work/cookies"
email="upgrade-verify@example.com"
password="Upgrade-verify-$(date +%s)"

step() { printf '\n▸ %s\n' "$*"; }
fail() {
  printf '✗ upgrade-verify: %s\n' "$*" >&2
  (cd "$work/spine" 2>/dev/null && docker compose logs --tail 40 api >&2) || true
  exit 1
}
cleanup() {
  (cd "$work/spine" 2>/dev/null && docker compose --profile minimal down -v >/dev/null 2>&1) || true
  rm -rf "$work"
}
trap cleanup EXIT

# The newest release before this version (semver order, pre-releases first).
previous=${PREVIOUS_VERSION:-$(git -C "$repo" tag --list 'v*' | sed 's/^v//' | node -e '
  const [cur, ...tags] = [process.argv[1], ...require("fs").readFileSync(0, "utf8").split("\n").filter(Boolean)];
  const key = (v) => { const [core, pre] = v.split("-", 2); return { n: core.split(".").map(Number), p: pre ? pre.split(".") : [] }; };
  const cmp = (a, b) => { const x = key(a), y = key(b);
    for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] - y.n[i];
    if (!x.p.length || !y.p.length) return y.p.length - x.p.length;
    for (let i = 0; i < Math.max(x.p.length, y.p.length); i++) { const p = x.p[i], q = y.p[i];
      if (p === undefined) return -1; if (q === undefined) return 1; if (p === q) continue;
      const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
      if (pn && qn) return Number(p) - Number(q); if (pn !== qn) return pn ? -1 : 1; return p < q ? -1 : 1; }
    return 0; };
  const older = tags.filter((t) => cmp(t, cur) < 0).sort(cmp);
  process.stdout.write(older.pop() ?? "");
' "$version")}
if [ -z "$previous" ]; then
  printf 'upgrade-verify: there is no release before %s to upgrade from, so there is nothing to check yet.\n' "$version"
  exit 0
fi

step "Install Spine $previous"
mkdir "$work/spine"
if [ -n "${PREVIOUS_FILES_DIR:-}" ]; then
  cp "$PREVIOUS_FILES_DIR"/* "$PREVIOUS_FILES_DIR"/.env.example "$work/spine/"
else
  gh release download "v$previous" --repo haribrothers/spine --dir "$work/spine"
fi
chmod +x "$work/spine"/*.sh
cd "$work/spine"
./install.sh --non-interactive

sign_in() {
  rm -f "$jar"
  curl -sf -c "$jar" -o /dev/null -H "Content-Type: application/json" -H "Origin: http://localhost" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" "$api/auth/sign-in/email" || fail "couldn't sign in"
}
trial_balance() {
  curl -sf -b "$jar" "$api/reports/trial-balance?asOf=2099-12-31" || fail "couldn't read the trial balance"
}
file_count() {
  docker compose exec -T db psql -U spine -d spine -tAc "select count(*) from files" | tr -d '[:space:]'
}
wait_for_pdfs() {
  i=0
  while [ "$(docker compose exec -T db psql -U spine -d spine -tAc "select count(*) from pgboss.job where name = 'store-issued-pdf' and state in ('created', 'retry', 'active')" | tr -d '[:space:]')" != 0 ]; do
    i=$((i + 1))
    [ "$i" -le 120 ] || fail "issued documents' PDFs were still being stored after 10 minutes"
    sleep 5
  done
}

step "Sign up and load the demo business"
curl -sf -o /dev/null -H "Content-Type: application/json" -H "Origin: http://localhost" \
  -d "{\"email\":\"$email\",\"password\":\"$password\",\"name\":\"Upgrade Verify\"}" "$api/auth/sign-up/email" || fail "couldn't sign up"
sign_in
seeded=$(curl -s -w '\n%{http_code}' -b "$jar" -X POST -H "Content-Type: application/json" -H "Idempotency-Key: $(node -e 'console.log(crypto.randomUUID())')" -d '{}' "$api/demo-data/seed")
[ "$(printf '%s' "$seeded" | tail -n 1)" = 201 ] || [ "$(printf '%s' "$seeded" | tail -n 1)" = 200 ] || fail "couldn't load the demo data: $seeded"
wait_for_pdfs
before_tb=$(trial_balance)
before_files=$(file_count)

step "Upgrade to $version"
next="$work/next"
mkdir "$next"
node "$repo/scripts/release/release-compose.mjs" "$version" >"$next/docker-compose.yml"
cp "$repo/docker/Caddyfile" "$repo/.env.example" "$repo/scripts/install.sh" "$repo/scripts/backup.sh" "$repo/scripts/restore.sh" "$repo/scripts/upgrade.sh" "$next/"
(
  cd "$next"
  if command -v sha256sum >/dev/null 2>&1; then sha256sum -- * .env.example >SHA256SUMS; else shasum -a 256 -- * .env.example >SHA256SUMS; fi
)
./upgrade.sh --version "$version" --files "$next"

step "Compare"
grep -qx "SPINE_VERSION=$version" .env || fail ".env doesn't name $version"
wait_for_pdfs
sign_in
after_tb=$(trial_balance)
after_files=$(file_count)
[ "$before_files" = "$after_files" ] || fail "file count: $before_files before, $after_files after"
[ "$before_tb" = "$after_tb" ] || fail "the trial balance differs after the upgrade"
printf '✓ upgrade-verify: %s → %s kept the trial balance and all %s files.\n' "$previous" "$version" "$after_files"
