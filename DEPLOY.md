# Self-hosted production deploy

This is the guide for deploying Anamnesis on your own VPS. For local development, see the "Getting started" section of [README.md](README.md).

Anamnesis is designed to run **on a single VPS** without Docker — just Node.js, systemd, and nginx. Git is the deploy mechanism.

> Throughout this guide, replace placeholders with your own values:
> - `YOUR_VPS_IP` — IP address of your server
> - `your-domain.com` — your actual domain
> - `your-user` — the non-root Linux user that runs the app (suggested: `anamnesis`)
> - `/opt/anamnesis` — install path (change if you prefer another)

## 1. VPS requirements

- Ubuntu 22.04 or 24.04 LTS (or Debian 12+)
- Minimum 1 GB RAM, 10 GB disk
- Public IP + DNS A-record pointing to it
- SSH access with key-based authentication

## 2. Install system dependencies

```bash
ssh root@YOUR_VPS_IP

apt update && apt upgrade -y
apt install -y nodejs npm nginx certbot python3-certbot-nginx \
               poppler-utils openssl ufw fail2ban \
               git unattended-upgrades

# Node 22 (if apt version is older)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version  # should be v22.x
```

## 3. Create dedicated user

Running Node as root is a security anti-pattern. Create a system user:

```bash
useradd --system --create-home --shell /usr/sbin/nologin anamnesis
```

All application files will be owned by this user. The systemd unit runs as this user with additional hardening.

## 4. Deploy key for private GitHub access (if repo is private)

If you forked into a private repo:

```bash
sudo -u anamnesis ssh-keygen -t ed25519 -f /home/anamnesis/.ssh/anamnesis_key -N ''
cat /home/anamnesis/.ssh/anamnesis_key.pub
# Add this public key as a Deploy Key on GitHub (repo → Settings → Deploy keys)

# SSH config:
cat >> /home/anamnesis/.ssh/config <<'EOF'
Host github-anamnesis
  Hostname github.com
  IdentityFile ~/.ssh/anamnesis_key
  User git
EOF
chown -R anamnesis:anamnesis /home/anamnesis/.ssh
chmod 600 /home/anamnesis/.ssh/config
```

For a public repo, skip this step and use the regular `https://github.com/...` URL.

## 5. Clone and initial build

```bash
cd /opt
git clone https://github.com/YOUR_USER/anamnesis.git
chown -R anamnesis:anamnesis /opt/anamnesis
cd /opt/anamnesis

# Create .env from template
cp .env.example backend/.env
nano backend/.env
# Fill in ALL of these:
#   APP_PIN=<your 6-digit PIN>
#   API_TOKEN=<openssl rand -hex 32>
#   ADMIN_TOKEN=<openssl rand -hex 32>
#   BACKUP_ENCRYPTION_KEY=<openssl rand -hex 32>  ← store in password manager!
#   CORS_ORIGINS=https://your-domain.com
#   WEBAUTHN_RP_ID=your-domain.com
#   TELEGRAM_BOT_TOKEN=<optional>
#   TELEGRAM_CHAT_ID=<optional>

chown anamnesis:anamnesis backend/.env
chmod 600 backend/.env

# Backend
cd backend
sudo -u anamnesis npm install --production
sudo -u anamnesis npm run init-db

# Frontend build
cd ../frontend
sudo -u anamnesis npm install
sudo -u anamnesis npm run build

# File permissions
chown -R anamnesis:anamnesis /opt/anamnesis
chmod 600 /opt/anamnesis/backend/.env
chmod 700 /opt/anamnesis/backend/data /opt/anamnesis/backend/uploads
chmod -R a+rX /opt/anamnesis/frontend/dist    # nginx needs to read
```

## 6. systemd unit

Create `/etc/systemd/system/anamnesis.service`:

```ini
[Unit]
Description=Anamnesis Backend
After=network.target

[Service]
Type=simple
User=anamnesis
Group=anamnesis
WorkingDirectory=/opt/anamnesis/backend
ExecStart=/usr/bin/node /opt/anamnesis/backend/src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=/opt/anamnesis/backend/data /opt/anamnesis/backend/uploads
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable --now anamnesis
systemctl status anamnesis
curl http://127.0.0.1:3010/api/health   # should return {"status":"ok"}
```

## 7. nginx + TLS

```bash
# Get certificate
certbot --nginx -d your-domain.com
```

Create `/etc/nginx/sites-available/anamnesis`:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_tickets off;
    server_tokens off;

    # Security headers (include once per location)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.telegram.org; frame-ancestors 'none'" always;

    # API
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
    }

    # Uploads
    location ^~ /uploads/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        add_header X-Download-Options noopen always;
    }

    # Service worker — never cached
    location = /sw.js {
        root /opt/anamnesis/frontend/dist;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }

    # Manifest — never cached
    location = /manifest.json {
        root /opt/anamnesis/frontend/dist;
        add_header Cache-Control "no-cache" always;
    }

    # SPA
    location / {
        root /opt/anamnesis/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

```bash
ln -s /etc/nginx/sites-available/anamnesis /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 8. Firewall + fail2ban

```bash
# UFW
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment 'SSH with rate limit'
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# fail2ban — /etc/fail2ban/jail.local
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 3
backend  = systemd

[sshd]
enabled  = true
maxretry = 3
bantime  = 1h

[nginx-botsearch]
enabled = true

[nginx-limit-req]
enabled = true
EOF

systemctl restart fail2ban
fail2ban-client status
```

## 9. SSH hardening

Create `/etc/ssh/sshd_config.d/99-anamnesis.conf`:

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
LogLevel VERBOSE
```

```bash
sshd -t && systemctl restart sshd
```

**Warning**: make sure your SSH key works before restarting! Otherwise you lock yourself out.

## 10. Update workflow (pull-deploy)

Create `/opt/anamnesis/pull-deploy.sh`:

```bash
#!/bin/bash
set -e
cd /opt/anamnesis

echo "=== Stop service ==="
systemctl stop anamnesis

echo "=== Save DB and uploads ==="
mkdir -p /tmp/anamnesis-backup
cp backend/data/*.db* /tmp/anamnesis-backup/ 2>/dev/null || true
cp -r backend/uploads /tmp/anamnesis-backup/ 2>/dev/null || true

echo "=== Pull from GitHub ==="
git fetch origin master
git reset --hard origin/master

echo "=== Restore DB and uploads ==="
cp /tmp/anamnesis-backup/*.db* backend/data/ 2>/dev/null || true
cp -r /tmp/anamnesis-backup/uploads/* backend/uploads/ 2>/dev/null || true

echo "=== Install deps ==="
cd backend && sudo -u anamnesis npm install --production

echo "=== Build frontend ==="
cd ../frontend && sudo -u anamnesis npm install && sudo -u anamnesis npm run build

echo "=== Permissions ==="
chown -R anamnesis:anamnesis /opt/anamnesis
chmod 600 /opt/anamnesis/backend/.env /opt/anamnesis/backend/data/*.db* 2>/dev/null || true
chmod 700 /opt/anamnesis/backend/data /opt/anamnesis/backend/uploads
chmod -R a+rX /opt/anamnesis/frontend/dist

echo "=== Start service ==="
systemctl start anamnesis
sleep 2
systemctl status anamnesis --no-pager
```

```bash
chmod 750 /opt/anamnesis/pull-deploy.sh
```

Now deploying updates is one command from your laptop:

```bash
ssh root@YOUR_VPS_IP "bash /opt/anamnesis/pull-deploy.sh"
```

## 11. Backups — three tiers

Backups are built into the app:

1. **Hot snapshots every 6 h** (local) — SQLite `.backup()` → `backend/data/backups/`
2. **Daily full archives** (local, encrypted) — tar.gz of DB + uploads, encrypted with `BACKUP_ENCRYPTION_KEY` using AES-256-CBC/PBKDF2, stored in `backend/data/backups/archives/`
3. **Offsite Telegram backup** — if `TELEGRAM_BOT_TOKEN` is set, the daily encrypted archive is sent to your Telegram bot (geo-redundant — survives VPS loss)

**Critical**: `BACKUP_ENCRYPTION_KEY` must be stored in a password manager, SEPARATELY from the VPS. Without it, Telegram archives are useless after the VPS is gone.

### Manual backup trigger

```bash
TOKEN=$(curl -s -X POST https://your-domain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"pin":"YOUR_PIN"}' | jq -r '.token')

ADMIN=$(ssh root@YOUR_VPS_IP "grep ^ADMIN_TOKEN /opt/anamnesis/backend/.env | cut -d= -f2")

curl -X POST https://your-domain.com/api/admin/tools/backup-now \
  -H "Authorization: Bearer $ADMIN" \
  -H "X-Session-Token: $TOKEN" \
  -H 'X-Patient-Id: 1'
```

### Restore from a Telegram archive

```bash
# 1. Download the encrypted file from your Telegram bot.
# 2. Decrypt:
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in anamnesis-full-YYYY-MM-DD.tar.gz.enc \
  -out restore.tar.gz \
  -pass pass:YOUR_BACKUP_ENCRYPTION_KEY

# 3. Extract:
tar -xzf restore.tar.gz

# 4. Copy DB and uploads to a fresh installation:
scp *.db root@NEW_VPS:/opt/anamnesis/backend/data/anamnesis.db
scp -r uploads root@NEW_VPS:/opt/anamnesis/backend/
ssh root@NEW_VPS "chown -R anamnesis:anamnesis /opt/anamnesis && systemctl restart anamnesis"
```

## 12. Monitoring

```bash
# Real-time logs
journalctl -u anamnesis -f

# Health check
curl https://your-domain.com/api/health

# DB size
du -sh /opt/anamnesis/backend/data

# Active sessions
sqlite3 /opt/anamnesis/backend/data/anamnesis.db \
  'SELECT COUNT(*) FROM sessions WHERE revoked=0 AND expires_at > datetime("now")'

# fail2ban banned IPs
fail2ban-client status sshd
```

## Disaster recovery — rough timing

- **Corrupted DB, VPS alive** → restore from local hot snapshot → ~1 minute
- **VPS alive, uploads lost** → decrypt last daily archive, extract uploads → ~10 minutes
- **VPS completely gone** → provision new VPS, clone repo, decrypt Telegram archive, restore DB and uploads → ~30-60 minutes (with password manager)
- **GitHub account lost AND laptop lost** → Telegram-encrypted archive is the last line of defense. Keep an offline copy of the repo once in a while just in case.

## Optional: remove the demo patient after first setup

After you add your real patient, the demo Ivanov still occupies `patient_id=1`. Either:
- Ask your AI coordinator to wipe and re-seed (easiest, see README), or
- Delete manually:
  ```sql
  BEGIN;
  DELETE FROM audit_log;
  DELETE FROM lab_results WHERE patient_id=1;
  DELETE FROM growth_log WHERE patient_id=1;
  DELETE FROM vaccinations WHERE patient_id=1;
  DELETE FROM comments WHERE patient_id=1;
  DELETE FROM reminders WHERE patient_id=1;
  DELETE FROM plan WHERE patient_id=1;
  DELETE FROM documents WHERE patient_id=1;
  DELETE FROM timeline WHERE patient_id=1;
  DELETE FROM medical_errors WHERE patient_id=1;
  DELETE FROM prescriptions WHERE patient_id=1;
  DELETE FROM medications WHERE patient_id=1;
  DELETE FROM diagnoses WHERE patient_id=1;
  DELETE FROM specialists WHERE patient_id=1;
  -- Then INSERT your real patient:
  UPDATE patient SET full_name='YOUR NAME', birth_date='YYYY-MM-DD' WHERE id=1;
  COMMIT;
  ```
