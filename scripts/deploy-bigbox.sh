#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required." >&2
  exit 1
}
docker compose version >/dev/null

echo "Building and starting the loopback-only Gridless web service..."
docker compose up -d --build gridless

check_gridless_health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS http://127.0.0.1:8088/healthz >/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O /dev/null http://127.0.0.1:8088/healthz
  else
    docker compose exec -T gridless wget -q -O /dev/null http://127.0.0.1:8080/healthz
  fi
}

for attempt in {1..30}; do
  if check_gridless_health; then
    echo "Gridless web health check passed on http://127.0.0.1:8088/healthz"
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "Gridless did not become healthy. Inspect: docker compose logs gridless" >&2
    exit 1
  fi
  sleep 1
done

secret_file="$repo_dir/secrets/cloudflare-tunnel-token"
if [[ -s "$secret_file" ]]; then
  echo "Starting the Cloudflare Tunnel connector..."
  docker compose --profile tunnel up -d tunnel
  echo "Tunnel requested. Inspect: docker compose logs --tail=100 tunnel"
else
  echo "Web service is ready. Add the tunnel token with ./scripts/store-tunnel-token.sh"
fi

docker compose --profile tunnel ps
