#!/usr/bin/env bash
# NEXORA 3.0 — In-Place Migration Script for VPS 2 (vm-23-58-ubuntu)
# Replaces the legacy single-file dashboard on port 9120 while preserving:
# - Existing NEXORA_TOKEN, MAIN_VPS_IP, MAIN_VPS_USER, SSH_KEY, BRIDGE_PORT
# - Existing nexora-tunnel.service (ports 20128, 3900, 9377)
# - Automatic timestamped backup of ~/nexora-bridge for 1-line rollback
set -euo pipefail

CONFIG_FILE="$HOME/.config/galaxy-update.conf"
REPO_URL="${1:-${NEXORA_REPO_URL:-}}"
if [ -z "$REPO_URL" ] && [ -f "$CONFIG_FILE" ]; then
  REPO_URL="$(cat "$CONFIG_FILE" | tr -d '[:space:]')"
fi
SERVICE_FILE="/etc/systemd/system/nexora-bridge.service"
SRC_DIR="$HOME/nexora-v3-src"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "============================================================"
echo "  GALAXY — VPS 2 IN-PLACE UPGRADE (Port 9120)"
echo "============================================================"

# 1. Read existing configuration from nexora-bridge.service if present
read_env_from_service() {
  local key="$1"
  local fallback="$2"
  if [ -f "$SERVICE_FILE" ]; then
    local val
    val=$(grep -oP "(?<=Environment=\"${key}=)[^\"]+" "$SERVICE_FILE" | head -n1 || true)
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$fallback"
}

INSTALL_DIR="$HOME/nexora-bridge"
if [ -f "$SERVICE_FILE" ]; then
  EXISTING_WD=$(grep -oP '(?<=WorkingDirectory=).+' "$SERVICE_FILE" | head -n1 || true)
  if [ -n "$EXISTING_WD" ]; then
    INSTALL_DIR="$EXISTING_WD"
  fi
fi

MAIN_VPS_IP=$(read_env_from_service "MAIN_VPS_IP" "100.72.221.36")
MAIN_VPS_USER=$(read_env_from_service "MAIN_VPS_USER" "ubuntu")
SSH_KEY=$(read_env_from_service "SSH_KEY" "$HOME/.ssh/id_ed25519_nexora")
NEXORA_TOKEN=$(read_env_from_service "NEXORA_TOKEN" "nexora-$(openssl rand -hex 8 2>/dev/null || date +%s)")
BRIDGE_PORT=$(read_env_from_service "BRIDGE_PORT" "9120")

echo "Preserved config:"
echo "  Install dir : $INSTALL_DIR"
echo "  Main VPS    : ${MAIN_VPS_USER}@${MAIN_VPS_IP}"
echo "  Bridge port : $BRIDGE_PORT"
echo "  SSH key     : $SSH_KEY"
echo "  Token       : ${NEXORA_TOKEN:0:12}*** (preserved)"

# 2. Ensure Git and Node.js 20+ are available
echo ""
echo "[1/6] Memeriksa Git & Node.js..."
if ! command -v git >/dev/null 2>&1; then
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq git curl
fi

NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
  if [ "${NODE_MAJOR:-0}" -ge 20 ]; then
    NEED_NODE=0
    echo "  Node.js $(node -v) sudah siap."
  fi
fi

if [ "$NEED_NODE" -eq 1 ]; then
  echo "  Memasang Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y -qq nodejs
fi

# 3. Acquire or update source code
echo ""
echo "[2/6] Mengambil source code GALAXY..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$REPO_URL" ] && [ -f "$SCRIPT_DIR/../package.json" ]; then
  SRC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  echo "  Menggunakan direktori lokal: $SRC_DIR"
elif [ -n "$REPO_URL" ]; then
  if [ -d "$SRC_DIR/.git" ]; then
    echo "  Menarik update terbaru di $SRC_DIR..."
    git -C "$SRC_DIR" fetch --all --prune
    git -C "$SRC_DIR" reset --hard origin/HEAD
  else
    rm -rf "$SRC_DIR"
    git clone --depth 1 "$REPO_URL" "$SRC_DIR"
  fi
else
  echo "ERROR: Berikan URL repositori GitHub sebagai argumen pertama."
  echo "Contoh: bash migrate-vps2.sh https://github.com/ghostchess013-spec/Galaxy.git"
  exit 1
fi

# 4. Build production Vite frontend
echo ""
echo "[3/6] Mem-build frontend produksi GALAXY..."
cd "$SRC_DIR"
if [ -f "package-lock.json" ]; then
  npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
else
  npm install --legacy-peer-deps --no-audit --no-fund
fi
npm run build

if [ ! -f "$SRC_DIR/dist/index.html" ]; then
  echo "ERROR: Build gagal — dist/index.html tidak ditemukan."
  exit 1
fi

# 5. Timestamped backup of previous dashboard before replacing
echo ""
echo "[4/6] Membuat backup instalasi lama..."
BACKUP_DIR="${INSTALL_DIR}.bak-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$INSTALL_DIR"
if [ -f "$INSTALL_DIR/server.py" ] || [ -f "$INSTALL_DIR/index.html" ] || [ -d "$INSTALL_DIR/dist" ]; then
  mkdir -p "$BACKUP_DIR"
  [ -f "$INSTALL_DIR/server.py" ] && cp "$INSTALL_DIR/server.py" "$BACKUP_DIR/"
  [ -f "$INSTALL_DIR/index.html" ] && cp "$INSTALL_DIR/index.html" "$BACKUP_DIR/"
  [ -d "$INSTALL_DIR/dist" ] && cp -r "$INSTALL_DIR/dist" "$BACKUP_DIR/"
  echo "  Backup tersimpan di: $BACKUP_DIR"
else
  echo "  Tidak ada instalasi lama untuk di-backup."
fi

# 6. Install new FastAPI bridge + built dist/ bundle
echo ""
echo "[5/6] Memasang server.py v3.0 & bundel dist/ ke $INSTALL_DIR..."
rm -rf "$INSTALL_DIR/dist"
cp -r "$SRC_DIR/dist" "$INSTALL_DIR/dist"
cp "$SRC_DIR/deploy/nexora_bridge_server.py" "$INSTALL_DIR/server.py"

if [ ! -x "$INSTALL_DIR/.venv/bin/python" ]; then
  echo "  Membuat Python venv baru di $INSTALL_DIR/.venv..."
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq python3 python3-venv python3-pip
  python3 -m venv "$INSTALL_DIR/.venv"
fi
"$INSTALL_DIR/.venv/bin/pip" install -q fastapi "uvicorn[standard]" psutil httpx pydantic edge-tts

# Ensure systemd service exists (preserving token & tunnel if already present)
if [ ! -f "$SERVICE_FILE" ]; then
  echo "  Membuat nexora-bridge.service baru..."
  $SUDO tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=NEXORA 3.0 Hermes Fleet Command Bridge & Web UI
After=network-online.target
Wants=nexora-tunnel.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${INSTALL_DIR}
Environment="MAIN_VPS_IP=${MAIN_VPS_IP}"
Environment="MAIN_VPS_USER=${MAIN_VPS_USER}"
Environment="SSH_KEY=${SSH_KEY}"
Environment="NEXORA_TOKEN=${NEXORA_TOKEN}"
Environment="BRIDGE_PORT=${BRIDGE_PORT}"
ExecStart=${INSTALL_DIR}/.venv/bin/python ${INSTALL_DIR}/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
fi

# Install permanent `galaxy-update` command for 1-word future updates
if [ -z "$REPO_URL" ] && [ -d "$SRC_DIR/.git" ]; then
  REPO_URL="$(git -C "$SRC_DIR" remote get-url origin 2>/dev/null || true)"
fi
if [ -n "$REPO_URL" ]; then
  mkdir -p "$HOME/.config"
  printf '%s\n' "$REPO_URL" > "$CONFIG_FILE"
fi

$SUDO tee /usr/local/bin/galaxy-update > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
CONFIG_FILE="$HOME/.config/galaxy-update.conf"
SRC_DIR="$HOME/nexora-v3-src"
REPO_URL="${1:-}"
if [ -z "$REPO_URL" ] && [ -f "$CONFIG_FILE" ]; then
  REPO_URL="$(cat "$CONFIG_FILE" | tr -d '[:space:]')"
fi
if [ -z "$REPO_URL" ]; then
  echo "Usage: galaxy-update <GITHUB_REPO_URL>"
  exit 1
fi
if [ -d "$SRC_DIR/.git" ]; then
  git -C "$SRC_DIR" remote set-url origin "$REPO_URL" 2>/dev/null || true
  git -C "$SRC_DIR" fetch --all --prune
  git -C "$SRC_DIR" reset --hard origin/HEAD
else
  rm -rf "$SRC_DIR"
  git clone --depth 1 "$REPO_URL" "$SRC_DIR"
fi
exec bash "$SRC_DIR/deploy/migrate-vps2.sh" "$REPO_URL"
EOF
$SUDO chmod +x /usr/local/bin/galaxy-update

echo ""
echo "[6/6] Merestart nexora-bridge.service & verifikasi..."
$SUDO systemctl daemon-reload
$SUDO systemctl restart nexora-bridge.service
sleep 2

HEALTH_OUT=$(curl -fsS "http://127.0.0.1:${BRIDGE_PORT}/api/health" || true)
TS_IP=$(tailscale ip -4 2>/dev/null | head -n1 || hostname -I | awk '{print $1}')

echo ""
echo "============================================================"
echo "  UPGRADE GALAXY SELESAI!"
echo "  Health check   : ${HEALTH_OUT:-GAGAL (cek: sudo journalctl -u nexora-bridge -n 30)}"
echo "  Tunnel status  : $($SUDO systemctl is-active nexora-tunnel.service 2>/dev/null || echo 'tidak terpasang')"
echo "  Perintah update: galaxy-update  (permanen untuk update berikutnya)"
echo "============================================================"
echo "  BUKA DASHBOARD BARU DI BROWSER (Token lama tetap dipakai):"
echo "  http://${TS_IP}:${BRIDGE_PORT}/?token=${NEXORA_TOKEN}"
echo ""
if [ -d "$BACKUP_DIR" ]; then
  echo "  Rollback cepat jika perlu:"
  echo "  cp -r ${BACKUP_DIR}/* ${INSTALL_DIR}/ && sudo systemctl restart nexora-bridge"
fi
echo "============================================================"
