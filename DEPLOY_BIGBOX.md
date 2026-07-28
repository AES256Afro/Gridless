# Deploy Gridless on bigBox

This deployment serves the production Vite build from an unprivileged Nginx container and publishes it through a remotely managed Cloudflare Tunnel.

## Resulting topology

```text
www.foragefournuts.com
  -> Cloudflare edge
  -> outbound Cloudflare Tunnel
  -> Docker service gridless:8080
  -> production dist/ files
```

The web container also binds to `127.0.0.1:8088` for local health checks. It does not claim host ports 80 or 443, which remain available to Pi-hole.

## Security properties

- No router port forwarding
- No public A or AAAA record exposing bigBox
- Web origin bound to loopback only
- Read-only runtime containers
- All Linux capabilities dropped
- `no-new-privileges` enabled
- Cloudflare token stored outside Git and supplied through a Compose secret
- Hashed assets cached for one year while `index.html` remains revalidation-friendly

The tunnel token allows a connector to run this tunnel. Treat it as a secret and rotate it from Cloudflare if it is exposed.

## 1. Get the repository onto bigBox

The initial Gridless code is in draft PR 1. Before that PR is merged, use its branch:

```bash
mkdir -p "$HOME/Projects"
git clone --branch codex/parking-accessibility \
  https://github.com/AES256Afro/Gridless.git \
  "$HOME/Projects/Gridless"
cd "$HOME/Projects/Gridless"
```

After PR 1 is merged, new installations should clone `main` instead:

```bash
git clone https://github.com/AES256Afro/Gridless.git "$HOME/Projects/Gridless"
```

Do not clone over an existing checkout. If the directory already exists, inspect it first:

```bash
cd "$HOME/Projects/Gridless"
git status -sb
git remote -v
git branch --show-current
```

## 2. Start the private web origin

```bash
cd "$HOME/Projects/Gridless"
chmod +x scripts/*.sh
./scripts/deploy-bigbox.sh
```

Verify locally:

```bash
curl -fsS http://127.0.0.1:8088/healthz
curl -I http://127.0.0.1:8088/
docker compose ps
```

The health endpoint should return `ok`. Port 8088 should listen only on `127.0.0.1`.

## 3. Create the Cloudflare Tunnel

In Cloudflare:

1. Open **Networking > Tunnels**.
2. Select **Create tunnel**.
3. Choose **Cloudflared** and name it `bigbox-gridless`.
4. Choose the Docker environment.
5. Copy only the long tunnel token from the generated Docker command.

Store it without placing it in shell history:

```bash
cd "$HOME/Projects/Gridless"
./scripts/store-tunnel-token.sh
```

Paste the token at the hidden prompt.

## 4. Add the published application

Inside the `bigbox-gridless` tunnel, add a published application:

| Setting | Value |
| --- | --- |
| Subdomain | `www` |
| Domain | `foragefournuts.com` |
| Service type | `HTTP` |
| Service URL | `http://gridless:8080` |

The service URL uses the Compose service name because `cloudflared` and Gridless share the private Docker network.

Save the route. When created through the dashboard, Cloudflare should also create the proxied CNAME for `www.foragefournuts.com`.

## 5. Start and verify the tunnel

```bash
cd "$HOME/Projects/Gridless"
docker compose --profile tunnel up -d tunnel
docker compose --profile tunnel ps
docker compose logs --tail=100 tunnel
```

Then verify:

```bash
dig +short www.foragefournuts.com
curl -I https://www.foragefournuts.com/
```

The DNS response should be proxied by Cloudflare and the HTTPS request should return the Gridless site.

## Updating Gridless

After PR 1 is merged and the checkout is on `main`:

```bash
cd "$HOME/Projects/Gridless"
git status -sb
git pull --ff-only origin main
docker compose build --pull gridless
docker compose up -d gridless
curl -fsS http://127.0.0.1:8088/healthz
```

The tunnel container does not need to restart for a normal web update.

To update `cloudflared`:

```bash
docker compose --profile tunnel pull tunnel
docker compose --profile tunnel up -d tunnel
```

## Rotate the tunnel token

After rotating the token in Cloudflare:

```bash
cd "$HOME/Projects/Gridless"
./scripts/store-tunnel-token.sh
docker compose --profile tunnel up -d --force-recreate tunnel
```

## Stop or remove the public route

Stop the tunnel connector without stopping Gridless:

```bash
docker compose --profile tunnel stop tunnel
```

To make the hostname unavailable even if another connector has the same token, also remove or disable the published application route in Cloudflare.
