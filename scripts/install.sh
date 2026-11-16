#!/bin/sh
# Install Spine with one command (US-OPS-01).
#
#   ./install.sh                                 asks for the address for links (suggests this machine's IP)
#   ./install.sh --app-url http://192.168.1.20:7746
#                                                on your network: plain HTTP on port 7746
#   ./install.sh --port 8080                     another port than 7746
#   ./install.sh --app-url https://spine.example.com
#                                                your domain: Caddy gets its HTTPS certificate (ports 80 and 443)
#   ./install.sh --app-url https://spine.tail1234.ts.net --behind-proxy
#                                                HTTPS handled in front (Tailscale, a Cloudflare Tunnel, your proxy)
#   ./install.sh --non-interactive               asks nothing: APP_URL from the environment, or http://localhost:7746
#   ./install.sh --profile full                  also starts the Cloudflare tunnel (CLOUDFLARE_TUNNEL_TOKEN in .env)
#
# Spine opens on one port (7746 unless --port says otherwise) at any address:
# http://localhost:7746 on this machine, http://<its IP>:7746 from the rest of
# the network. APP_URL is the address written into links (emails, PDFs,
# invitations), so use one the people you send them to can open.
# Runs from a release's files (install.sh next to docker-compose.yml) or from a
# clone (scripts/install.sh). Needs Docker 24+ with Compose 2.20+ on Linux or
# macOS (amd64 or arm64), or Windows through WSL2. An existing .env is never
# changed: running this again just starts Spine.
set -eu

MIN_DOCKER=24
MIN_COMPOSE_MINOR=20
DEFAULT_PORT=7746

say() { printf '%s\n' "$*"; }
fail() {
  printf 'Spine install: %s\n' "$*" >&2
  exit 1
}

usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
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
port=
behind_proxy=0
address_given=0
profile=minimal
while [ $# -gt 0 ]; do
  case $1 in
    --non-interactive) interactive=0 ;;
    --app-url)
      [ $# -ge 2 ] || fail "--app-url needs an address, e.g. --app-url https://spine.example.com"
      app_url=$2
      address_given=1
      shift
      ;;
    --app-url=*) app_url=${1#*=} address_given=1 ;;
    --port)
      [ $# -ge 2 ] || fail "--port needs a number, e.g. --port 8080"
      port=$2
      address_given=1
      shift
      ;;
    --port=*) port=${1#*=} address_given=1 ;;
    --behind-proxy) behind_proxy=1 address_given=1 ;;
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
is_port() {
  case $1 in
    '' | *[!0-9]*) return 1 ;;
  esac
  [ "${#1}" -le 5 ] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}
[ -z "$port" ] || is_port "$port" || fail "--port must be a number from 1 to 65535 (got: $port)"
# An address given on the command line or in the environment means there's nothing to ask.
[ -z "$app_url" ] || interactive=0
[ -t 0 ] || interactive=0

# This machine's address on the network, if it can tell (for the default address and the summary).
local_ip() {
  ip=
  if command -v ipconfig >/dev/null 2>&1; then
    for interface in en0 en1 en2; do
      ip=$(ipconfig getifaddr "$interface" 2>/dev/null || true)
      [ -z "$ip" ] || break
    done
  fi
  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{ for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit } }')
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{ print $1 }' || true)
  fi
  case $ip in
    *.*.*.*) printf '%s' "$ip" ;;
  esac
}

# Is the name only reachable on this machine or network (so no public certificate)?
is_local_name() {
  case $1 in
    localhost | *.localhost | *.local | *.lan | *.home.arpa | *.internal | \[*) return 0 ;;
    *[!0-9.]*) return 1 ;;
    *) return 0 ;;
  esac
}

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
  if [ "$address_given" -eq 1 ]; then
    say "Its address is kept too: --app-url, --port and --behind-proxy only apply when there's no .env yet."
    say "To change the address, change APP_URL and API_URL in .env; to change the port, SPINE_PORT."
  fi
else
  # A clone has .env.example; a release has env.example (GitHub renames files starting with a dot).
  template=.env.example
  [ -f "$template" ] || template=env.example
  [ -f "$template" ] || fail "env.example is missing. Download the release's files again, or run this from a clone."
  spine_port=${port:-$DEFAULT_PORT}
  with_port() { if [ "$spine_port" = 80 ]; then printf 'http://%s' "$1"; else printf 'http://%s:%s' "$1" "$spine_port"; fi; }
  if [ "$interactive" -eq 1 ]; then
    suggested=$(with_port "$(local_ip)")
    [ "$suggested" != "http://" ] && [ "$suggested" != "http://:$spine_port" ] || suggested=$(with_port localhost)
    say "Spine will open on port $spine_port at any address: http://localhost:$spine_port here, this machine's IP from other devices."
    printf 'The address for links in emails and PDFs (one the people you send them to can open) [%s]: ' "$suggested"
    read -r app_url || app_url=
    app_url=${app_url:-$suggested}
  fi
  app_url=${app_url:-$(with_port localhost)}
  app_url=${app_url%/}
  case $app_url in
    http://?* | https://?*) ;;
    *) fail "The address must start with http:// or https:// (got: $app_url)." ;;
  esac

  scheme=${app_url%%://*}
  host_port=${app_url#*://}
  host_port=${host_port%%/*}
  url_path=${app_url#*://"$host_port"}
  host=$host_port
  url_port=
  case $host_port in
    \[*\]:*) url_port=${host_port##*]:} host=${host_port%:*} ;;
    \[*) ;;
    *:*) url_port=${host_port##*:} host=${host_port%%:*} ;;
  esac
  [ -z "$url_port" ] || is_port "$url_port" || fail "The address's port must be a number from 1 to 65535 (got: $app_url)."

  # How Spine is reached: on its port (plain HTTP, any address), with its own
  # certificate for a domain, or behind something else that handles HTTPS.
  site_address=
  trusted_proxies=
  if [ "$scheme" = http ]; then
    if [ -n "$url_port" ]; then
      [ -z "$port" ] || [ "$port" = "$url_port" ] || fail "The address already has port $url_port, and --port says $port. Give the port once."
      spine_port=$url_port
    elif [ "$spine_port" != 80 ]; then
      # The port people type is Spine's port: put it in the address.
      app_url="http://$host_port:$spine_port$url_path"
    fi
    [ "$behind_proxy" -eq 0 ] || trusted_proxies=private_ranges
  elif [ "$behind_proxy" -eq 1 ]; then
    trusted_proxies=private_ranges
  else
    is_local_name "$host" &&
      fail "$host can't get an HTTPS certificate: it isn't a domain on the internet. Use http://$host:$spine_port, or for HTTPS without a domain, Tailscale (https://<machine>.<tailnet>.ts.net) with --behind-proxy."
    [ -z "$url_port" ] || [ "$url_port" = 443 ] ||
      fail "With a domain, Caddy needs ports 80 and 443 to get the certificate, so the address can't have port $url_port. If something in front handles HTTPS on that port, add --behind-proxy."
    app_url="https://$host$url_path"
    site_address="$host, :$DEFAULT_PORT"
    [ ! -e docker-compose.override.yml ] ||
      fail "docker-compose.override.yml is already here, so the installer won't write ports 80 and 443 into it. Publish \"80:80\" and \"443:443\" for the caddy service in it yourself, or move it away and run this again."
    # The plain port stays on this machine: everyone else uses the domain.
    spine_port="127.0.0.1:$spine_port"
  fi

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
    /^#? ?(SPINE_PORT|SITE_ADDRESS|TRUSTED_PROXIES)=/ { next }
    { print }
  ' "$template" >.env
  {
    printf '\n# How Spine is reached (D-279; ./install.sh wrote these). SPINE_PORT is the\n'
    printf '# port Spine opens on at any address, or 127.0.0.1:<port> for this machine only.\n'
    printf 'SPINE_PORT=%s\n' "$spine_port"
    [ -z "$site_address" ] || printf '# Caddy gets the HTTPS certificate for the domain (ports 80 and 443).\nSITE_ADDRESS=%s\n' "$site_address"
    [ -z "$trusted_proxies" ] || printf '# HTTPS is handled in front: believe its X-Forwarded-For.\nTRUSTED_PROXIES=%s\n' "$trusted_proxies"
  } >>.env
  say "Created .env for $app_url, with a random AUTH_SECRET and database password."
  if [ -n "$site_address" ]; then
    cat >docker-compose.override.yml <<'EOF'
# Written by install.sh (D-279): Spine has a domain, so Caddy also takes ports
# 80 and 443 to get and serve its HTTPS certificate. Docker Compose reads this
# file along with docker-compose.yml.
services:
  caddy:
    ports:
      - "80:80"
      - "443:443"
EOF
    say "Wrote docker-compose.override.yml: Caddy takes ports 80 and 443 for $host's certificate."
  fi
fi

app_url=$(sed -n 's/^APP_URL=//p' .env | tail -n 1)
spine_port=$(sed -n 's/^SPINE_PORT=//p' .env | tail -n 1)

# --- Start -----------------------------------------------------------------

say "Starting Spine (the $profile profile). The first start downloads Spine's images and sets up the database…"
# Images already on this machine are used as they are; the rest are downloaded.
docker compose --profile "$profile" pull --quiet --ignore-pull-failures >/dev/null 2>&1 || true
if ! docker compose --profile "$profile" up -d --no-build --wait --wait-timeout 300; then
  fail "Spine didn't start. See why with: docker compose logs api — if it couldn't download the images, check this machine's internet connection. \"port is already allocated\" means another program has the port: install with --port <another>, or change SPINE_PORT in .env."
fi

say ""
say "Spine is running at $app_url — open it to create the first account."
case $spine_port in
  '' | *:*) ;;
  *)
    ip=$(local_ip)
    suffix=":$spine_port"
    [ "$spine_port" != 80 ] || suffix=
    # The addresses other than the one just printed.
    here="http://localhost$suffix on this machine"
    [ "http://localhost$suffix" != "$app_url" ] || here=
    there=
    [ -z "$ip" ] || [ "http://$ip$suffix" = "$app_url" ] || there="http://$ip$suffix from other devices on your network"
    if [ -n "$here" ] && [ -n "$there" ]; then
      say "It also opens at $here, and at $there."
    elif [ -n "$here$there" ]; then
      say "It also opens at $here$there."
    fi
    ;;
esac
say ""
say "  Logs:      docker compose logs -f"
say "  Back up:   $scripts/backup.sh"
say "  Upgrade:   $scripts/upgrade.sh"
say "  Stop:      docker compose --profile $profile down   (keeps your data — never add -v, which deletes it)"
