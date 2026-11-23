# Panduan Instalasi GALAXY di VPS Baru & Perintah Permanen `galaxy-update`

Panduan permanen ini digunakan setiap kali Anda membuat **VPS baru (Ubuntu / Debian)** untuk menjalankan dashboard **GALAXY** (port `9120`) yang terhubung ke server utama **`hermesagent` (`100.72.221.36`)** melalui jaringan privat **Tailscale**.

> **Catatan Isolasi**: Tidak ada perubahan, instalasi, atau restart apa pun pada Hermes, 9Router, maupun 2 bot Telegram utama (`default` & `vps-guardian`) di `hermesagent`. Di `hermesagent` Anda hanya menambahkan 1 baris kunci publik SSH milik VPS baru.

---

## Ringkasan Arsitektur
- **VPS Baru (Command Node — Port `9120`)**: Menjalankan `nexora-bridge.service` (FastAPI + UI produksi GALAXY + **Edge TTS**), `nexora-tunnel.service` (opsional, forward `:20128` & `:9377`), dan perintah permanen `/usr/local/bin/galaxy-update`.
- **VPS Utama (`hermesagent` — `100.72.221.36`)**: Menjalankan Hermes Gateway (`:9119`), 9Router (`:20128`), Camofox (`:9377`), dan profil agen terisolasi `~/.hermes/profiles/*`.

---

## Langkah 1 — Di VPS Baru: Update Dasar, Pasang Tailscale & Buat Kunci SSH

Masuk ke VPS baru Anda via SSH, lalu jalankan:

```bash
# 1) Pastikan paket dasar terpasang
sudo apt-get update -qq && sudo apt-get install -y -qq curl git openssh-client

# 2) Pasang & hubungkan Tailscale ke jaringan (tailnet) yang sama dengan hermesagent
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# 3) Uji koneksi Tailscale ke hermesagent (harus mendapat balasan pong)
tailscale ping -c 2 100.72.221.36

# 4) Buat kunci SSH khusus GALAXY (tanpa passphrase)
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_nexora -N "" -C "galaxy-vps2"

# 5) Tampilkan kunci publik — SALIN seluruh baris yang muncul
cat ~/.ssh/id_ed25519_nexora.pub
```

---

## Langkah 2 — Di `hermesagent` (`100.72.221.36`): Daftarkan Kunci Publik (Sekali Saja)

Masuk ke **`hermesagent`** lalu jalankan perintah berikut (ganti `PASTE_ISI_id_ed25519_nexora.pub_DI_SINI` dengan output langkah 1):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "PASTE_ISI_id_ed25519_nexora.pub_DI_SINI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Selesai di `hermesagent`. Anda tidak perlu menjalankan perintah lain apa pun di `hermesagent`.

---

## Langkah 3 — Di VPS Baru: Uji SSH, Instal GALAXY & Tanam `galaxy-update`

Kembali ke **VPS Baru**, lalu jalankan:

```bash
# 1) Uji koneksi SSH tanpa password ke hermesagent (WAJIB muncul: SSH_OK)
ssh -i ~/.ssh/id_ed25519_nexora -o StrictHostKeyChecking=accept-new ubuntu@100.72.221.36 "echo SSH_OK"

# 2) Clone repositori GALAXY & jalankan instalasi penuh + tanam perintah permanen galaxy-update
REPO_URL="https://github.com/ghostchess013-spec/Galaxy.git"
rm -rf ~/nexora-v3-src && git clone --depth 1 "$REPO_URL" ~/nexora-v3-src
bash ~/nexora-v3-src/deploy/migrate-vps2.sh "$REPO_URL"
```

> **Jika repositori GitHub bersifat Private**:
> Ganti nilai `REPO_URL` menggunakan Personal Access Token GitHub (scope `repo` / `Contents: Read`):
> ```bash
> REPO_URL="https://<USERNAME>:<GITHUB_TOKEN>@github.com/ghostchess013-spec/Galaxy.git"
> ```

### Yang Otomatis Dikerjakan oleh `migrate-vps2.sh`:
1. Memasang **Node.js 20 LTS** dan **Python 3 (`venv` + `pip`)** jika belum tersedia.
2. Mem-build bundel produksi GALAXY (`npm run build`).
3. Membuat virtualenv `~/nexora-bridge/.venv` dan memasang `fastapi`, `uvicorn[standard]`, `psutil`, `httpx`, `pydantic`, dan **`edge-tts`**.
4. Membuat dan mengaktifkan **`nexora-bridge.service`** (auto-start saat reboot) dengan `NEXORA_TOKEN` acak yang aman.
5. Menyimpan URL repositori ke `~/.config/galaxy-update.conf` dan **menanamkan perintah permanen `/usr/local/bin/galaxy-update`**.
6. Menampilkan **tautan akses dashboard beserta `?token=...`** di akhir proses — **simpan tautan tersebut** di bookmark peramban Anda.

---

## Langkah 4 — Di VPS Baru: Pasang SSH Tunnel Permanen (`nexora-tunnel.service`)

Tunnel ini meneruskan port lokal `9Router (:20128)` dan `Camofox (:9377)` dari `hermesagent` ke VPS baru agar latensi respons maksimal dan otomatis menyambung ulang jika jaringan berkedip *(bridge juga sudah punya fallback SSH otomatis bila tunnel sedang restart)*:

```bash
sudo tee /etc/systemd/system/nexora-tunnel.service > /dev/null << EOF
[Unit]
Description=NEXORA SSH Tunnel to hermesagent
After=network-online.target tailscaled.service

[Service]
User=$(whoami)
ExecStart=/usr/bin/ssh -NT -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -i $HOME/.ssh/id_ed25519_nexora -L 127.0.0.1:20128:127.0.0.1:20128 -L 127.0.0.1:9377:127.0.0.1:9377 ubuntu@100.72.221.36
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now nexora-tunnel.service
```

---

## Langkah 5 — Verifikasi Semua Berjalan Normal (Di VPS Baru)

Jalankan pemeriksaan berikut untuk memastikan seluruh komponen sehat:

```bash
# 1) Pastikan kedua service aktif dan enabled saat boot
sudo systemctl is-active nexora-bridge.service nexora-tunnel.service
sudo systemctl is-enabled nexora-bridge.service nexora-tunnel.service

# 2) Pastikan API bridge merespons normal (harus muncul "ok": true)
curl -fsS http://127.0.0.1:9120/api/health && echo ""

# 3) Pastikan perintah permanen galaxy-update sudah tertanam
which galaxy-update

# 4) Pastikan paket Edge TTS terpasang di venv bridge
~/nexora-bridge/.venv/bin/python -c "import edge_tts; print('EDGE_TTS_OK')"

# 5) Cetak tautan akses dashboard lengkap dengan token
echo "http://$(tailscale ip -4 | head -n1):9120/?token=$(grep -oP '(?<=NEXORA_TOKEN=)[^\"]+' /etc/systemd/system/nexora-bridge.service)"
```

Buka tautan pada poin 5 di peramban (HP/PC yang juga tersambung ke Tailscale). Token otomatis disimpan ke cookie sesi aman `HttpOnly` selama 30 hari dan dibersihkan dari bilah alamat.

---

## Langkah 6 — Cara Update Seterusnya (Permanen)

Setiap kali ada fitur baru, perbaikan, atau penambahan pada proyek **GALAXY**:
1. Lakukan **Commit & Push** ke GitHub.
2. Masuk ke VPS baru dan cukup ketik satu kata:

```bash
galaxy-update
```

Perintah `galaxy-update` otomatis akan:
- Menarik commit terbaru dari GitHub (`git fetch && git reset --hard origin/HEAD`).
- Mem-build ulang frontend produksi.
- Membuat folder backup bertanggal (`~/nexora-bridge.bak-YYYYMMDD-HHMMSS`).
- Memperbarui `server.py`, bundel `dist/`, serta paket Python (termasuk `edge-tts`).
- Me-restart `nexora-bridge.service` **tanpa mengubah `NEXORA_TOKEN` maupun kunci SSH** Anda.

Jika suatu saat URL repositori berubah, cukup jalankan sekali dengan URL baru (otomatis tersimpan permanen):
```bash
galaxy-update "https://github.com/USERNAME/REPO_BARU.git"
```

---

## Lampiran — Perintah Cepat Operasional & Pemulihan

```bash
# Pantau log real-time GALAXY bridge
sudo journalctl -u nexora-bridge -f

# Pantau log SSH tunnel
sudo journalctl -u nexora-tunnel -n 30 --no-pager

# Restart manual tunnel & bridge
sudo systemctl restart nexora-tunnel.service nexora-bridge.service

# Lihat daftar folder backup untuk rollback cepat
ls -dt ~/nexora-bridge.bak-*

# Rollback ke backup tertentu (ganti NAMA_BACKUP)
# cp -r ~/nexora-bridge.bak-NAMA_BACKUP/* ~/nexora-bridge/ && sudo systemctl restart nexora-bridge.service
```
