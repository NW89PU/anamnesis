# Deploying Anamnesis on TrueNAS SCALE (Custom App)

This deploys the prebuilt images from GHCR as a TrueNAS Custom App, behind your existing Nginx Proxy Manager.

## Prerequisites

- TrueNAS SCALE 25.10+ (Docker-based Apps system)
- Nginx Proxy Manager already running on the box (used for TLS + routing)
- DNS record for `anamnesis.<your-domain>` pointing at the server (orange-cloud or grey-cloud in Cloudflare)

## 1. Dataset

```bash
sudo zfs create -p ssd/apps/anamnesis
sudo mkdir -p /mnt/ssd/apps/anamnesis/{data,uploads,config}
sudo chown -R 568:568 /mnt/ssd/apps/anamnesis
```

`568:568` is the TrueNAS `apps` user/group.

## 2. Environment file

Copy `anamnesis.env.example` to the server, fill in secrets, and install with restrictive permissions:

```bash
openssl rand -hex 32   # run three times for API_TOKEN, ADMIN_TOKEN, SESSION_SECRET
openssl rand -hex 32   # once more for BACKUP_ENCRYPTION_KEY (store in password manager!)

# After editing locally:
scp anamnesis.env shop812@true.wndw.co.uk:/tmp/anamnesis.env
ssh shop812@true.wndw.co.uk '
  sudo install -m 600 -o 568 -g 568 /tmp/anamnesis.env /mnt/ssd/apps/anamnesis/config/anamnesis.env
  rm /tmp/anamnesis.env
'
```

## 3. Custom App

TrueNAS UI → **Apps → Discover Apps → Custom App**

- Application Name: `anamnesis`
- Paste the contents of `anamnesis.yaml` into the Custom Compose YAML field
- Save

The app will pull the three images from `ghcr.io/nw89pu/anamnesis-{backend,frontend,mcp}:latest`, mount the dataset, run init-db on first start, and listen on:
- `10.0.1.10:3013` — backend (internal, used only for debugging)
- `10.0.1.10:8090` — frontend (proxies /api and /uploads to the backend service via docker network)
- `100.100.10.10:7800` — MCP server (Tailscale only — exposes Anamnesis as MCP tools for Claude Code on the Win VM)

## 4. Nginx Proxy Manager

Add a Proxy Host:
- Domain: `anamnesis.wndw.co.uk`
- Forward to: `http://10.0.1.10:8090`
- Block Common Exploits: on
- Websockets Support: on (not strictly needed but harmless)
- Custom config under Advanced (the frontend container already handles /api routing internally, so a single forward is enough):
  ```
  client_max_body_size 100M;
  ```
- SSL: request a new Let's Encrypt cert (DNS-01 if the record is orange-clouded in Cloudflare)

## 5. Verify

```bash
curl -sk https://anamnesis.wndw.co.uk/api/health
# → {"status":"ok"}
```

Open `https://anamnesis.wndw.co.uk` in a browser. You should land on the PIN-login screen with the demo patient pre-seeded.

## Updating

A `git push` to the fork triggers the GHA workflow, which rebuilds and pushes new `:latest` images. To roll forward on the server:

```bash
sudo docker compose -f /mnt/.ix-apps/app_configs/anamnesis/versions/<...>/docker-compose.yaml pull
sudo docker compose -f /mnt/.ix-apps/app_configs/anamnesis/versions/<...>/docker-compose.yaml up -d
```

Or use **TrueNAS UI → Apps → anamnesis → Edit → Save** to force a pull. (The Custom App YAML is re-applied.)
