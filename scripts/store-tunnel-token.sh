#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
secret_dir="$repo_dir/secrets"
secret_file="$secret_dir/cloudflare-tunnel-token"

umask 077
mkdir -p "$secret_dir"

read -r -s -p "Paste the Cloudflare Tunnel token: " tunnel_token
printf "\n"
if [[ -z "$tunnel_token" ]]; then
  echo "No token entered. Nothing was changed." >&2
  exit 1
fi

printf "%s" "$tunnel_token" > "$secret_file"
unset tunnel_token
chmod 600 "$secret_file"
echo "Tunnel token stored at $secret_file"
