#!/bin/sh
# Install Spine with one command (US-OPS-01).
#
#   ./install.sh                                 asks for the address people open Spine at
#   ./install.sh --app-url https://spine.example.com
#   ./install.sh --non-interactive               asks nothing: APP_URL from the environment, or http://localhost
#   ./install.sh --profile full                  also starts the Cloudflare tunnel (CLOUDFLARE_TUNNEL_TOKEN in .env)
#
# Runs from a release's files (install.sh next to docker-compose.yml) or from a
# clone (scripts/install.sh). Needs Docker 24+ with Compose 2.20+ on Linux or
# macOS (amd64 or arm64), or Windows through WSL2. An existing .env is never
# changed: running this again just starts Spine.
set -eu

MIN_DOCKER=24
MIN_COMPOSE_MINOR=20

say() { printf '%s\n' "$*"; }
fail() {
  printf 'Spine install: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
}

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$here/docker-compose.yml" ]; then
  root=$here
  scripts=.
elif [ -f "$here/../docker-compose.yml" ]; then
  root=$(CDPATH='' cd -- "$here/.." && pwd)
  scripts=scripts
else
  fail "docker-compose.yml isn't next to this script. Run it from the Spine folder you downloaded or cloned."
fi
cd "$root"

interactive=1
app_url=${APP_URL:-}
profile=minimal
while [ $# -gt 0 ]; do
  case $1 in
    --non-interactive) interactive=0 ;;
    --app-url)
      [ $# -ge 2 ] || fail "--app-url needs an address, e.g. --app-url https://spine.example.com"
      app_url=$2
      shift
      ;;
    --app-url=*) app_url=${1#*=} ;;
    --profile)
      [ $# -ge 2 ] || fail "--profile needs minimal or full"
      profile=$2
      shift
      ;;
    --profile=*) profile=${1#*=} ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) fail "Unknown option: $1 (see ./install.sh --help)" ;;
  esac
  shift
done
case $profile in
  minimal | full) ;;
  *) fail "--profile must be minimal or full (got: $profile)" ;;
esac
# An address given on the command line or in the environment means there's nothing to ask.
[ -z "$app_url" ] || interactive=0
[ -t 0 ] || interactive=0

# --- Prerequisites ---------------------------------------------------------

command -v docker >/dev/null 2>&1 || fail "Docker isn't installed. Install Docker $MIN_DOCKER or newer (https://docs.docker.com/get-docker/), then run this again."
docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null) ||
  fail "Docker is installed but isn't running, or you can't use it. Start Docker (or add yourself to the docker group), then run this again."
docker_major=${docker_version%%.*}
case $docker_major in
  '' | *[!0-9]*) fail "Couldn't read Docker's version (got: $docker_version)." ;;
esac
[ "$docker_major" -ge "$MIN_DOCKER" ] || fail "Docker $docker_version is too old. Spine needs Docker $MIN_DOCKER or newer."

compose_version=$(docker compose version --short 2>/dev/null) ||
  fail "Docker Compose v2 isn't installed (the 'docker compose' command). Install the Compose plugin (https://docs.docker.com/compose/install/), then run this again."
compose_version=${compose_version#v}
compose_major=${compose_version%%.*}
compose_rest=${compose_version#*.}
compose_minor=${compose_rest%%.*}
case "$compose_major$compose_minor" in
  '' | *[!0-9]*) fail "Couldn't read Docker Compose's version (got: $compose_version)." ;;
esac
if [ "$compose_major" -lt 2 ] || { [ "$compose_major" -eq 2 ] && [ "$compose_minor" -lt "$MIN_COMPOSE_MINOR" ]; }; then
  fail "Docker Compose $compose_version is too old. Spine needs Compose 2.$MIN_COMPOSE_MINOR or newer."
fi

# --- Settings (.env) -------------------------------------------------------

random() {
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | dd bs=1 count="$1" 2>/dev/null
}

if [ -f .env ]; then
  say "Keeping your existing .env — nothing in it is changed."
else
  [ -f .env.example ] || fail ".env.example is missing. Download the release's files again, or run this from a clone."
  if [ "$interactive" -eq 1 ]; then
    printf 'The address people will open Spine at [http://localhost]: '
    read -r app_url || app_url=
  fi
  app_url=${app_url:-http://localhost}
  app_url=${app_url%/}
  case $app_url in
    http://?* | https://?*) ;;
    *) fail "The address must start with http:// or https:// (got: $app_url)." ;;
  esac
  auth_secret=$(random 48)
  db_password=$(random 32)
  if [ ${#auth_secret} -ne 48 ] || [ ${#db_password} -ne 32 ]; then
    fail "Couldn't generate random secrets from /dev/urandom."
  fi
  umask 077
  awk -v app_url="$app_url" -v secret="$auth_secret" -v db_password="$db_password" '
    /^AUTH_SECRET=/ { print "AUTH_SECRET=" secret; next }
    /^APP_URL=/ { print "APP_URL=" app_url; next }
    /^API_URL=/ { print "API_URL=" app_url "/api"; next }
    /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" db_password; next }
    /^DATABASE_URL=/ { print "DATABASE_URL=postgres://spine:" db_password "@db:5432/spine"; next }
    { print }
  ' .env.example >.env
  say "Created .env for $app_url, with a random AUTH_SECRET and database password."
fi

app_url=$(sed -n 's/^APP_URL=//p' .env | tail -n 1)

# --- Start -----------------------------------------------------------------

say "Starting Spine (the $profile profile). The first start downloads Spine's images and sets up the database…"
# Images already on this machine are used as they are; the rest are downloaded.
docker compose --profile "$profile" pull --quiet --ignore-pull-failures >/dev/null 2>&1 || true
if ! docker compose --profile "$profile" up -d --no-build --wait --wait-timeout 300; then
  fail "Spine didn't start. See why with: docker compose logs api — if it couldn't download the images, check this machine's internet connection."
fi

say ""
say "Spine is running at $app_url — open it to create the first account."
say ""
say "  Logs:      docker compose logs -f"
say "  Back up:   $scripts/backup.sh"
say "  Upgrade:   $scripts/upgrade.sh"
say "  Stop:      docker compose --profile $profile down   (keeps your data — never add -v, which deletes it)"
