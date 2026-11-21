"""NEXORA 3.0 — Hardened FastAPI Bridge & Static SPA Server for VPS 2.

Replaces the legacy single-file server.py on port 9120 while preserving:
- Existing NEXORA_TOKEN, MAIN_VPS_IP, MAIN_VPS_USER, SSH_KEY, BRIDGE_PORT
- Existing nexora-tunnel.service (127.0.0.1:20128, :3900, :9377)
"""

import asyncio
import base64
import hmac
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import httpx
import psutil
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

MAIN_VPS_IP = os.getenv("MAIN_VPS_IP", "100.72.221.36")
MAIN_VPS_USER = os.getenv("MAIN_VPS_USER", "ubuntu")
SSH_KEY = os.getenv("SSH_KEY", str(Path.home() / ".ssh/id_ed25519_nexora"))
NEXORA_TOKEN = os.getenv("NEXORA_TOKEN", "")
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "9120"))
BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"

UPSTREAM_ENDPOINTS = {
    "hermes_dashboard": f"http://{MAIN_VPS_IP}:9119",
    "nine_router": "http://127.0.0.1:20128",
    "voicestudio": "http://127.0.0.1:3900",
    "camofox": "http://127.0.0.1:9377",
}

AGENT_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,48}$")

ALLOWED_SYSTEMD_UNITS: Set[str] = {
    "hermes-gateway",
    "hermes-dashboard",
    "9router",
    "voicestudio",
    "camofox",
}

ALLOWED_ROOT_FILES: Set[str] = {
    "SOUL.md",
    "USER.md",
    "OPERATING_RULES.md",
    "config.yaml",
}

DANGEROUS_PATTERNS = [
    r"\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-rf)\b",
    r"\bmkfs\b",
    r"\bdd\s+if=",
    r"\b(reboot|shutdown|poweroff|halt)\b",
    r"systemctl\s+(stop|disable|restart)\b",
    r"\biptables\s+(-F|--flush)\b",
    r"\btailscale\s+(down|logout)\b",
]


def _build_allowed_origins() -> List[str]:
    env_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    defaults = [
        f"http://127.0.0.1:{BRIDGE_PORT}",
        f"http://localhost:{BRIDGE_PORT}",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]
    return list(dict.fromkeys(defaults + env_origins))


app = FastAPI(title="NEXORA 3.0 Hermes Fleet Bridge", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_origin_regex=r"^https?://(100\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

active_tasks: Dict[str, Dict[str, Any]] = {}
blackbox_logs: List[Dict[str, Any]] = []
pending_approvals: Dict[str, Dict[str, Any]] = {}
ws_clients: Set[WebSocket] = set()
_chat_ctx_cache: Dict[str, Dict[str, Any]] = {}
_preferred_router_key: str = ""
CHAT_CTX_TTL_SEC = 180.0


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


def record_blackbox(
    agent_id: str, category: str, action: str, detail: str, level: str = "INFO"
) -> Dict[str, Any]:
    entry = {
        "id": str(uuid.uuid4())[:8],
        "time": utc_now(),
        "agent": agent_id,
        "category": category,
        "action": action,
        "detail": detail,
        "level": level,
    }
    blackbox_logs.insert(0, entry)
    if len(blackbox_logs) > 250:
        blackbox_logs.pop()
    return entry


def _token_matches(candidate: str) -> bool:
    if not NEXORA_TOKEN or not candidate:
        return False
    return hmac.compare_digest(candidate.encode("utf-8"), NEXORA_TOKEN.encode("utf-8"))


def verify_token(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> str:
    raw = ""
    if authorization and authorization.startswith("Bearer "):
        raw = authorization.split(" ", 1)[1].strip()
    elif token:
        raw = token.strip()
    if not _token_matches(raw):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return raw


def validate_agent_slug(agent_id: str, allow_default: bool = True) -> str:
    slug = agent_id.strip().lower()
    if allow_default and slug == "default":
        return "default"
    if not AGENT_SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="Invalid agent profile identifier")
    return slug


def validate_avatar_value(raw: Optional[str]) -> str:
    if not raw:
        return ""
    val = raw.strip()
    if len(val) > 150_000:
        raise HTTPException(status_code=400, detail="Avatar payload exceeds 150 KB limit")
    if re.match(r"^/src/assets/images/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$", val):
        return val
    if re.match(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$", val):
        return val
    raise HTTPException(status_code=400, detail="Unsupported avatar image format")


def validate_hermes_relpath(raw_path: str) -> str:
    cleaned = raw_path.strip()
    if cleaned.startswith("~/.hermes/"):
        cleaned = cleaned[len("~/.hermes/") :]
    cleaned = cleaned.lstrip("/")
    if not cleaned or ".." in cleaned or "\\" in cleaned or "\x00" in cleaned:
        raise HTTPException(status_code=400, detail="Invalid workspace file path")

    if cleaned in ALLOWED_ROOT_FILES:
        return cleaned

    m = re.match(r"^profiles/([a-z0-9][a-z0-9-]{0,48})/(SOUL\.md|USER\.md|config\.yaml)$", cleaned)
    if m:
        return cleaned

    raise HTTPException(
        status_code=403,
        detail="Only SOUL.md, USER.md, OPERATING_RULES.md, config.yaml, and profile SOUL files may be edited",
    )


async def ssh_exec(remote_cmd: str, timeout: float = 12.0) -> Dict[str, Any]:
    ssh_args = [
        "ssh",
        "-i",
        SSH_KEY,
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ControlMaster=auto",
        "-o",
        "ControlPersist=120s",
        "-o",
        "ControlPath=/tmp/nexora-ctl-%r@%h:%p",
        f"{MAIN_VPS_USER}@{MAIN_VPS_IP}",
        remote_cmd,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *ssh_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return {
            "ok": proc.returncode == 0,
            "code": proc.returncode,
            "stdout": stdout.decode("utf-8", errors="replace").strip(),
            "stderr": stderr.decode("utf-8", errors="replace").strip(),
        }
    except Exception as exc:
        return {"ok": False, "code": -1, "stdout": "", "stderr": str(exc)}


async def ssh_run_python(script: str, timeout: float = 10.0) -> Dict[str, Any]:
    encoded = base64.b64encode(script.encode("utf-8")).decode("ascii")
    return await ssh_exec(
        f"python3 -c \"import base64; exec(base64.b64decode('{encoded}'))\"",
        timeout=timeout,
    )


REMOTE_PROBE_SCRIPT = r"""
import json, os, shutil, socket, time
from pathlib import Path

def read_cpu():
    with open('/proc/stat') as f:
        p1 = [float(x) for x in f.readline().split()[1:8]]
    time.sleep(0.15)
    with open('/proc/stat') as f:
        p2 = [float(x) for x in f.readline().split()[1:8]]
    d = [b - a for a, b in zip(p1, p2)]
    tot = sum(d) or 1.0
    return round(100.0 * (1.0 - (d[3] + d[4]) / tot), 1)

def port_open(host, port):
    t0 = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=0.6):
            return True, max(1, int((time.perf_counter() - t0) * 1000))
    except Exception:
        return False, 0

mem = {}
with open('/proc/meminfo') as f:
    for line in f:
        k, v = line.split(':', 1)
        mem[k.strip()] = int(v.strip().split()[0])
ram_tot = round(mem.get('MemTotal', 1) / (1024*1024), 2)
ram_avail = round(mem.get('MemAvailable', 0) / (1024*1024), 2)
ram_used = round(max(0.0, ram_tot - ram_avail), 2)
ram_pct = round((ram_used / (ram_tot or 1)) * 100.0, 1)

du = shutil.disk_usage('/')
disk_tot = round(du.total / (1024**3), 1)
disk_used = round(du.used / (1024**3), 1)
disk_pct = round((du.used / (du.total or 1)) * 100.0, 1)

port_checks = [
    ('hermes-dashboard (:9119)', '100.72.221.36', 9119, 'hermes-dashboard'),
    ('9router (:20128)', '127.0.0.1', 20128, '9router'),
    ('voicestudio (:3900)', '127.0.0.1', 3900, 'voicestudio'),
    ('camofox (:9377)', '127.0.0.1', 9377, 'camofox'),
]
services = []
for label, host, port, unit in port_checks:
    up, lat = port_open(host, port)
    services.append({'name': label, 'unit': unit, 'state': 'active' if up else 'down', 'healthy': up, 'latency_ms': lat})

h_home = Path.home() / '.hermes'
gw_pid_file = h_home / 'gateway.pid'
gw_up = False
if gw_pid_file.exists():
    try:
        raw = gw_pid_file.read_text().strip()
        pid = int(json.loads(raw).get('pid', 0)) if raw.startswith('{') else int(raw)
        if pid > 0:
            os.kill(pid, 0)
            gw_up = True
    except Exception:
        gw_up = False
services.insert(0, {'name': 'hermes-gateway', 'unit': 'hermes-gateway', 'state': 'active' if gw_up else 'inactive', 'healthy': gw_up, 'latency_ms': 2 if gw_up else 0})

profiles = []
default_soul = (h_home / 'SOUL.md').read_text(errors='replace') if (h_home / 'SOUL.md').exists() else ''
default_meta = {'model': 'combo-best', 'role': 'Primary Hermes HQ Orchestrator', 'arch': 'hq_spire'}
if (h_home / 'nexora_meta.json').exists():
    try:
        default_meta.update(json.loads((h_home / 'nexora_meta.json').read_text()))
    except Exception:
        pass

busy_agents = set()
proc_file = h_home / 'processes.json'
if proc_file.exists():
    try:
        pdata = json.loads(proc_file.read_text())
        if (isinstance(pdata, list) and len(pdata) > 0) or (isinstance(pdata, dict) and len(pdata) > 0):
            busy_agents.add('default')
    except Exception:
        pass

profiles.append({
    'id': 'default',
    'name': 'default',
    'role': default_meta['role'],
    'model': default_meta['model'],
    'arch': 'hq_spire',
    'avatar': default_meta.get('avatar', ''),
    'soul': default_soul,
    'is_core': True,
    'remote_busy': 'default' in busy_agents,
})

p_root = h_home / 'profiles'
if p_root.exists():
    for d in sorted(p_root.iterdir()):
        if not d.is_dir() or d.name == 'default':
            continue
        meta = {
            'role': 'Systemd Sentinel & Watchdog' if d.name == 'vps-guardian' else 'Hermes Specialist Agent',
            'model': 'combo-best',
            'arch': 'care_pavilion' if d.name == 'vps-guardian' else 'observatory_dome',
            'avatar': '',
        }
        if (d / 'nexora_meta.json').exists():
            try:
                meta.update(json.loads((d / 'nexora_meta.json').read_text()))
            except Exception:
                pass
        soul = (d / 'SOUL.md').read_text(errors='replace') if (d / 'SOUL.md').exists() else ''
        profiles.append({
            'id': d.name,
            'name': d.name,
            'role': meta['role'],
            'model': meta['model'],
            'arch': meta['arch'],
            'avatar': meta.get('avatar', ''),
            'soul': soul,
            'is_core': d.name == 'vps-guardian',
            'remote_busy': d.name in busy_agents,
        })

print(json.dumps({
    'cpu': {'percent': read_cpu(), 'cores': os.cpu_count() or 4},
    'ram': {'used_gb': ram_used, 'total_gb': ram_tot, 'percent': ram_pct},
    'disk': {'used_gb': disk_used, 'total_gb': disk_tot, 'percent': disk_pct},
    'services': services,
    'profiles': profiles,
}))
"""


async def collect_telemetry() -> Dict[str, Any]:
    ssh_res = await ssh_run_python(REMOTE_PROBE_SCRIPT, timeout=8.0)

    local_cpu = psutil.cpu_percent(interval=None)
    local_vm = psutil.virtual_memory()
    cmd_node = {
        "host": "vm-23-58-ubuntu (VPS 2)",
        "cpu_percent": round(local_cpu, 1),
        "cpu_cores": psutil.cpu_count(logical=True) or 2,
        "ram_used_gb": round(local_vm.used / (1024**3), 2),
        "ram_total_gb": round(local_vm.total / (1024**3), 2),
    }

    if not ssh_res["ok"] or not ssh_res["stdout"]:
        return {
            "timestamp": utc_now(),
            "connected": False,
            "error": ssh_res["stderr"] or "Waiting for SSH link to hermesagent...",
            "host": f"hermesagent ({MAIN_VPS_IP})",
            "command_node": cmd_node,
            "cpu": {"percent": 0, "cores": 4},
            "ram": {"used_gb": 0, "total_gb": 24, "percent": 0},
            "disk": {"used_gb": 0, "total_gb": 200, "percent": 0},
            "vps_alert": True,
            "services": [],
            "agents": [
                {
                    "id": "default",
                    "name": "default",
                    "role": "Waiting for SSH Link...",
                    "model": "combo-best",
                    "arch": "hq_spire",
                    "soul": "",
                    "status": "ALERT",
                    "task": "SSH LINK OFFLINE",
                    "is_core": True,
                },
                {
                    "id": "vps-guardian",
                    "name": "vps-guardian",
                    "role": "Waiting for SSH Link...",
                    "model": "combo-best",
                    "arch": "care_pavilion",
                    "soul": "",
                    "status": "ALERT",
                    "task": "LINK OFFLINE",
                    "is_core": True,
                },
            ],
            "pending_approvals": list(pending_approvals.values()),
            "blackbox": blackbox_logs[:40],
        }

    remote = json.loads(ssh_res["stdout"])
    down_svcs = [s["name"] for s in remote["services"] if not s["healthy"]]
    vps_alert = remote["cpu"]["percent"] > 88.0 or remote["ram"]["percent"] > 92.0 or len(down_svcs) > 0

    agents = []
    for p in remote["profiles"]:
        slug = p["id"]
        has_hitl = any(a["agent"] == slug for a in pending_approvals.values())
        if has_hitl or (slug == "vps-guardian" and vps_alert):
            p["status"] = "ALERT"
            p["task"] = "APPROVAL GATE" if has_hitl else f"ALERT: {', '.join(down_svcs) or 'HIGH LOAD'}"
        elif slug in active_tasks:
            p["status"] = "EXECUTING"
            p["task"] = active_tasks[slug]["task"]
        elif p.get("remote_busy"):
            p["status"] = "EXECUTING"
            p["task"] = "HERMES ACTIVE PROCESS"
        else:
            p["status"] = "IDLE"
            p["task"] = "STANDBY"
        agents.append(p)

    return {
        "timestamp": utc_now(),
        "connected": True,
        "host": f"hermesagent ({MAIN_VPS_IP})",
        "command_node": cmd_node,
        "cpu": remote["cpu"],
        "ram": remote["ram"],
        "disk": remote["disk"],
        "vps_alert": vps_alert,
        "services": remote["services"],
        "agents": agents,
        "pending_approvals": list(pending_approvals.values()),
        "blackbox": blackbox_logs[:40],
    }


class CreateAgentReq(BaseModel):
    slug: str
    role: str
    model: str = "combo-best"
    arch: str = "observatory_dome"
    soul: Optional[str] = None
    avatar: Optional[str] = None


class UpdateAvatarReq(BaseModel):
    avatar: str


class UpdateSoulReq(BaseModel):
    soul: str
    model: Optional[str] = None


class SaveFileReq(BaseModel):
    path: str
    content: str


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    agent_id: str = "default"
    message: str
    model: Optional[str] = None
    history: Optional[List[ChatHistoryItem]] = None


class VoiceReq(BaseModel):
    agent_id: str = "default"
    text: str
    voice: str = "alloy"


class ShellReq(BaseModel):
    agent_id: str = "vps-guardian"
    command: str
    force: bool = False


@app.get("/api/health")
async def health():
    return {"ok": True, "version": "3.0.0", "main_vps": MAIN_VPS_IP, "time": utc_now()}


@app.get("/api/status", dependencies=[Depends(verify_token)])
async def get_status():
    return await collect_telemetry()


@app.post("/api/agents", dependencies=[Depends(verify_token)])
async def create_agent(req: CreateAgentReq):
    raw_slug = re.sub(r"[^a-z0-9\-]", "-", req.slug.lower().strip()).strip("-")
    slug = validate_agent_slug(raw_slug, allow_default=False)
    safe_avatar = validate_avatar_value(req.avatar)
    soul = req.soul or f"# SOUL.md — {slug}\nRole: {req.role}\n"
    meta = {"role": req.role, "model": req.model, "arch": req.arch, "avatar": safe_avatar}
    py = (
        "import json; from pathlib import Path; "
        f"root = (Path.home() / '.hermes' / 'profiles').resolve(); "
        f"d = (root / {json.dumps(slug)}).resolve(); "
        "assert str(d).startswith(str(root) + '/'); "
        "d.mkdir(parents=True, exist_ok=True); "
        f"(d / 'nexora_meta.json').write_text({json.dumps(json.dumps(meta))}, encoding='utf-8'); "
        f"(d / 'SOUL.md').write_text({json.dumps(soul)}, encoding='utf-8')"
    )
    res = await ssh_run_python(py)
    if not res["ok"]:
        raise HTTPException(status_code=500, detail=res["stderr"] or "Failed to create profile")
    record_blackbox("default", "FLEET", "DEPLOY_AGENT", f"Created profile '{slug}' at ~/.hermes/profiles/{slug}")
    return {"ok": True, "slug": slug}


@app.put("/api/agents/{agent_id}/avatar", dependencies=[Depends(verify_token)])
async def update_avatar(agent_id: str, req: UpdateAvatarReq):
    slug = validate_agent_slug(agent_id, allow_default=True)
    safe_avatar = validate_avatar_value(req.avatar)
    if slug == "default":
        py = (
            "import json; from pathlib import Path; "
            "fp = Path.home() / '.hermes' / 'nexora_meta.json'; "
            "meta = json.loads(fp.read_text(encoding='utf-8')) if fp.exists() else {}; "
            f"meta['avatar'] = {json.dumps(safe_avatar)}; "
            "fp.write_text(json.dumps(meta), encoding='utf-8')"
        )
    else:
        py = (
            "import json; from pathlib import Path; "
            "root = (Path.home() / '.hermes' / 'profiles').resolve(); "
            f"d = (root / {json.dumps(slug)}).resolve(); "
            "assert str(d).startswith(str(root) + '/'); "
            "d.mkdir(parents=True, exist_ok=True); "
            "fp = d / 'nexora_meta.json'; "
            "meta = json.loads(fp.read_text(encoding='utf-8')) if fp.exists() else {}; "
            f"meta['avatar'] = {json.dumps(safe_avatar)}; "
            "fp.write_text(json.dumps(meta), encoding='utf-8')"
        )
    res = await ssh_run_python(py)
    if not res["ok"]:
        raise HTTPException(status_code=500, detail=res["stderr"] or "Failed to save avatar")
    record_blackbox(slug, "CONFIG", "UPDATE_AVATAR", f"Updated portrait ({slug})")
    return {"ok": True}


@app.put("/api/agents/{agent_id}/soul", dependencies=[Depends(verify_token)])
async def update_soul(agent_id: str, req: UpdateSoulReq):
    slug = validate_agent_slug(agent_id, allow_default=True)
    if slug == "default":
        py = (
            "from pathlib import Path; "
            f"(Path.home() / '.hermes' / 'SOUL.md').write_text({json.dumps(req.soul)}, encoding='utf-8')"
        )
    else:
        py = (
            "from pathlib import Path; "
            "root = (Path.home() / '.hermes' / 'profiles').resolve(); "
            f"d = (root / {json.dumps(slug)}).resolve(); "
            "assert str(d).startswith(str(root) + '/'); "
            "d.mkdir(parents=True, exist_ok=True); "
            f"(d / 'SOUL.md').write_text({json.dumps(req.soul)}, encoding='utf-8')"
        )
    res = await ssh_run_python(py)
    if not res["ok"]:
        raise HTTPException(status_code=500, detail=res["stderr"] or "Failed to save SOUL.md")
    record_blackbox(slug, "CONFIG", "UPDATE_SOUL", f"Updated SOUL.md ({slug})")
    return {"ok": True}


@app.delete("/api/agents/{agent_id}", dependencies=[Depends(verify_token)])
async def delete_agent(agent_id: str):
    slug = validate_agent_slug(agent_id, allow_default=True)
    if slug in ("default", "vps-guardian"):
        raise HTTPException(status_code=400, detail="Core profiles cannot be deleted")
    py = (
        "import shutil; from pathlib import Path; "
        "root = (Path.home() / '.hermes' / 'profiles').resolve(); "
        f"target = (root / {json.dumps(slug)}).resolve(); "
        "assert str(target).startswith(str(root) + '/'); "
        "shutil.rmtree(target, ignore_errors=True)"
    )
    res = await ssh_run_python(py)
    if not res["ok"]:
        raise HTTPException(status_code=500, detail=res["stderr"] or "Failed to remove profile")
    record_blackbox("default", "FLEET", "DECOMMISSION", f"Deleted profile '{slug}'", level="WARN")
    return {"ok": True}


@app.get("/api/files", dependencies=[Depends(verify_token)])
async def list_workspace_files():
    py = r"""
import json
from datetime import datetime
from pathlib import Path

h_home = Path.home() / '.hermes'
targets = [
    ('SOUL.md', 'default', 'markdown'),
    ('USER.md', 'default', 'markdown'),
    ('OPERATING_RULES.md', 'default', 'markdown'),
    ('config.yaml', 'default', 'yaml'),
]
p_root = h_home / 'profiles'
if p_root.exists():
    for d in sorted(p_root.iterdir()):
        if d.is_dir():
            soul = d / 'SOUL.md'
            if soul.exists():
                targets.append((f'profiles/{d.name}/SOUL.md', d.name, 'markdown'))

out = []
for rel, agent_id, lang in targets:
    fp = h_home / rel
    if not fp.exists():
        continue
    stat = fp.stat()
    content = fp.read_text(encoding='utf-8', errors='replace')[:180000]
    out.append({
        'id': 'live-' + rel.replace('/', '-').replace('.', '-'),
        'path': f'~/.hermes/{rel}',
        'folder': '~/.hermes/' if '/' not in rel else '~/.hermes/' + rel.rsplit('/', 1)[0] + '/',
        'agentId': 'executor' if agent_id == 'default' else agent_id,
        'language': lang,
        'updatedAt': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
        'content': content,
    })
print(json.dumps(out))
"""
    res = await ssh_run_python(py, timeout=10.0)
    if not res["ok"]:
        raise HTTPException(status_code=502, detail=res["stderr"] or "Unable to read ~/.hermes files")
    return {"ok": True, "files": json.loads(res["stdout"] or "[]")}


@app.put("/api/files", dependencies=[Depends(verify_token)])
async def save_workspace_file(req: SaveFileReq):
    rel = validate_hermes_relpath(req.path)
    py = (
        "from pathlib import Path; "
        "root = (Path.home() / '.hermes').resolve(); "
        f"fp = (root / {json.dumps(rel)}).resolve(); "
        "assert str(fp).startswith(str(root) + '/'); "
        "fp.parent.mkdir(parents=True, exist_ok=True); "
        f"fp.write_text({json.dumps(req.content)}, encoding='utf-8')"
    )
    res = await ssh_run_python(py, timeout=10.0)
    if not res["ok"]:
        raise HTTPException(status_code=500, detail=res["stderr"] or "Failed to write file")
    record_blackbox("default", "FILES", "SAVE", f"Updated ~/.hermes/{rel}")
    return {"ok": True, "path": f"~/.hermes/{rel}"}


def _parse_local_env_keys() -> List[str]:
    candidates: List[str] = []
    env_names = (
        "NINE_ROUTER_API_KEY",
        "ROUTER_API_KEY",
        "OPENAI_API_KEY",
        "CUSTOM_API_KEY",
        "HERMES_API_KEY",
        "LLM_API_KEY",
        "API_KEY",
    )
    for name in env_names:
        val = os.getenv(name, "").strip().strip('"').strip("'")
        if val and not val.startswith("${"):
            candidates.append(val)

    local_env = BASE_DIR / ".env"
    if local_env.is_file():
        try:
            for line in local_env.read_text(encoding="utf-8", errors="replace").splitlines():
                s = line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k, v = s.split("=", 1)
                k = k.strip().removeprefix("export ").strip()
                v = v.strip().strip('"').strip("'")
                if k in env_names and v and not v.startswith("${"):
                    candidates.append(v)
        except Exception:
            pass
    return list(dict.fromkeys(candidates))


async def _discover_chat_context(agent_id: str, force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    cached = _chat_ctx_cache.get(agent_id)
    if not force_refresh and cached and (now - cached.get("ts", 0.0)) < CHAT_CTX_TTL_SEC:
        return cached

    local_keys = _parse_local_env_keys()
    remote_script_tpl = r"""
import glob, json, os, re, sqlite3, subprocess
from pathlib import Path

slug = __SLUG__
home = Path.home()
h_home = home / '.hermes'
p_dir = h_home if slug == 'default' else (h_home / 'profiles' / slug)

soul = ''
for sp in [p_dir / 'SOUL.md', h_home / 'SOUL.md']:
    if sp.is_file():
        soul = sp.read_text(encoding='utf-8', errors='replace')[:4000]
        break

env_map = {}
keys = []
key_names = (
    'NINE_ROUTER_API_KEY', 'ROUTER_API_KEY', 'OPENAI_API_KEY',
    'CUSTOM_API_KEY', 'HERMES_API_KEY', 'LLM_API_KEY',
    'API_KEY', 'OPENROUTER_API_KEY', 'NOUS_API_KEY'
)

def add_key(v):
    if not v or not isinstance(v, str):
        return
    c = v.strip().strip('"').strip("'")
    if not c or len(c) < 4 or c.startswith('${') or c.lower() in ('none', 'null', 'changeme', 'your-api-key', 'your_api_key'):
        return
    if c not in keys:
        keys.append(c)

def parse_env_file(fp):
    if not fp.is_file():
        return
    try:
        for line in fp.read_text(encoding='utf-8', errors='replace').splitlines():
            s = line.strip()
            if not s or s.startswith('#') or '=' not in s:
                continue
            k, v = s.split('=', 1)
            k = k.strip()
            if k.startswith('export '):
                k = k[7:].strip()
            v = v.strip().strip('"').strip("'")
            if k:
                env_map[k] = v
                if k in key_names or (k.endswith('_API_KEY') and '9ROUTER' in k.upper()):
                    add_key(v)
    except Exception:
        pass

for ef in [p_dir / '.env', h_home / '.env', home / '.9router' / '.env', home / '9router' / '.env']:
    parse_env_file(ef)

def resolve_val(raw):
    m = re.match(r'^\$\{?([A-Za-z0-9_]+)\}?$', raw.strip())
    if m:
        return env_map.get(m.group(1), '')
    return raw

yaml_key_re = re.compile(r'(?:api_key|openai_api_key|custom_api_key|router_api_key)\s*:\s*["\']?([^\s#"\']+)["\']?', re.I)
for cf in [p_dir / 'config.yaml', h_home / 'config.yaml']:
    if not cf.is_file():
        continue
    try:
        txt = cf.read_text(encoding='utf-8', errors='replace')
        for m in yaml_key_re.finditer(txt):
            add_key(resolve_val(m.group(1)))
    except Exception:
        pass

for jf in [p_dir / 'auth.json', h_home / 'auth.json', h_home / 'credentials.json']:
    if not jf.is_file():
        continue
    try:
        obj = json.loads(jf.read_text(encoding='utf-8', errors='replace'))
        stack = [obj]
        while stack:
            cur = stack.pop()
            if isinstance(cur, dict):
                for k, v in cur.items():
                    if isinstance(v, str) and ('key' in k.lower() or 'token' in k.lower()):
                        add_key(v)
                    elif isinstance(v, (dict, list)):
                        stack.append(v)
            elif isinstance(cur, list):
                stack.extend(cur)
    except Exception:
        pass

json_candidates = [
    home / '.9router' / 'db.json',
    home / '9router' / 'db.json',
    home / '9router' / 'data' / 'db.json',
    home / '.config' / '9router' / 'db.json',
    home / '.local' / 'share' / '9router' / 'db.json',
    Path('/opt/9router/db.json'),
    Path('/var/lib/9router/db.json'),
]
for pat in [str(home / '*9router*' / 'db.json'), str(home / '*9router*' / '*' / 'db.json')]:
    for found in glob.glob(pat):
        p = Path(found)
        if p not in json_candidates:
            json_candidates.append(p)

for dbp in json_candidates:
    if not dbp.is_file():
        continue
    try:
        data = json.loads(dbp.read_text(encoding='utf-8', errors='replace'))
        if isinstance(data, dict):
            for item in data.get('apiKeys', []) or []:
                if isinstance(item, dict):
                    add_key(item.get('key') or item.get('apiKey') or item.get('value'))
                elif isinstance(item, str):
                    add_key(item)
            for k in ('apiKey', 'api_key', 'masterKey', 'secretKey'):
                add_key(data.get(k))
    except Exception:
        pass

sqlite_candidates = [
    home / '.9router' / 'storage.sqlite',
    home / '.9router' / 'db.sqlite',
    home / '.9router' / '9router.db',
    home / '9router' / 'storage.sqlite',
    home / '9router' / 'data' / 'storage.sqlite',
]
for sp in sqlite_candidates:
    if not sp.is_file():
        continue
    try:
        conn = sqlite3.connect(f'file:{sp}?mode=ro', uri=True)
        cur = conn.cursor()
        tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        for t in tables:
            tl = t.lower()
            if 'key' in tl:
                cols = [r[1] for r in cur.execute(f'PRAGMA table_info("{t}")').fetchall()]
                for col in cols:
                    if col.lower() in ('key', 'api_key', 'apikey', 'token', 'value'):
                        for row in cur.execute(f'SELECT "{col}" FROM "{t}" LIMIT 10').fetchall():
                            add_key(row[0])
        conn.close()
    except Exception:
        pass

try:
    out = subprocess.check_output(['systemctl', '--user', 'show-environment'], stderr=subprocess.DEVNULL, timeout=2).decode('utf-8', errors='replace')
    for line in out.splitlines():
        if '=' in line:
            k, v = line.split('=', 1)
            if k in key_names:
                add_key(v)
except Exception:
    pass

print(json.dumps({'keys': keys[:12], 'soul': soul}))
"""
    remote_script = remote_script_tpl.replace("__SLUG__", json.dumps(agent_id))
    remote_keys: List[str] = []
    soul = ""
    res = await ssh_run_python(remote_script, timeout=8.0)
    if res["ok"] and res["stdout"]:
        try:
            parsed = json.loads(res["stdout"])
            remote_keys = [str(k) for k in parsed.get("keys", []) if isinstance(k, str) and k.strip()]
            soul = str(parsed.get("soul", "") or "")
        except Exception:
            pass

    merged_keys: List[str] = []
    if _preferred_router_key:
        merged_keys.append(_preferred_router_key)
    for k in local_keys + remote_keys + ["sk-9router-local"]:
        if k and k not in merged_keys:
            merged_keys.append(k)

    ctx = {"ts": now, "keys": merged_keys, "soul": soul}
    _chat_ctx_cache[agent_id] = ctx
    return ctx


def _extract_router_error(data: Any, status_code: int, raw_text: str) -> str:
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            msg = err.get("message") or err.get("detail") or err.get("code")
            if msg:
                return str(msg)
        elif isinstance(err, str) and err:
            return err
        if data.get("detail"):
            return str(data["detail"])
    return f"HTTP {status_code}: {raw_text[:200]}"


def _is_auth_error(status_code: int, data: Any) -> bool:
    if status_code in (401, 403):
        return True
    if isinstance(data, dict) and isinstance(data.get("error"), dict):
        err = data["error"]
        etype = str(err.get("type", "")).lower()
        ecode = str(err.get("code", "")).lower()
        emsg = str(err.get("message", "")).lower()
        if "auth" in etype or "api_key" in ecode or "api key" in emsg or "unauthorized" in emsg:
            return True
    return False


@app.post("/api/chat", dependencies=[Depends(verify_token)])
async def chat_agent(req: ChatReq):
    global _preferred_router_key
    agent_id = validate_agent_slug(req.agent_id, allow_default=True)
    model = (req.model or "combo-best").strip() or "combo-best"
    active_tasks[agent_id] = {"task": f"9ROUTER: {model}", "started": time.time()}
    record_blackbox(agent_id, "9ROUTER", "INFERENCE", f"{model}: {req.message[:70]}")
    t0 = time.perf_counter()

    try:
        ctx = await _discover_chat_context(agent_id, force_refresh=False)
        soul_block = ctx.get("soul", "").strip()
        system_prompt = (
            f"You are Hermes agent '{agent_id}' operating on hermesagent via GALAXY Operator System."
        )
        if soul_block:
            system_prompt += f"\n\nProfile SOUL.md:\n{soul_block[:3000]}"

        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if req.history:
            for item in req.history[-16:]:
                role = "assistant" if item.role == "assistant" else "user"
                content = (item.content or "").strip()
                if content:
                    messages.append({"role": role, "content": content[:4000]})
        messages.append({"role": "user", "content": req.message})

        async def _try_keys(candidate_keys: List[str]):
            nonlocal model
            last_err = "No valid 9Router API key found"
            saw_auth_err = False
            async with httpx.AsyncClient(timeout=60.0) as client:
                for api_key in candidate_keys:
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "x-api-key": api_key,
                        "Content-Type": "application/json",
                    }
                    resp = await client.post(
                        f"{UPSTREAM_ENDPOINTS['nine_router']}/v1/chat/completions",
                        headers=headers,
                        json={"model": model, "messages": messages},
                    )
                    try:
                        data = resp.json()
                    except Exception:
                        data = None

                    if resp.status_code < 400 and isinstance(data, dict) and data.get("choices"):
                        choice0 = data["choices"][0] if isinstance(data["choices"], list) and data["choices"] else {}
                        msg_obj = choice0.get("message", {}) if isinstance(choice0, dict) else {}
                        content = msg_obj.get("content")
                        if content is not None:
                            return True, str(content), str(data.get("model", model)), api_key, False

                    err_msg = _extract_router_error(data, resp.status_code, resp.text)
                    last_err = err_msg
                    if _is_auth_error(resp.status_code, data):
                        saw_auth_err = True
                        continue
                    # Non-auth upstream error (e.g. model quota/timeout) — stop retrying keys
                    return False, err_msg, model, "", False

            return False, last_err, model, "", saw_auth_err

        ok, result_text, used_model, winning_key, saw_auth_err = await _try_keys(ctx.get("keys", []))

        if not ok and saw_auth_err:
            # Refresh key cache once in case API key was newly created or rotated in 9Router
            _preferred_router_key = ""
            fresh_ctx = await _discover_chat_context(agent_id, force_refresh=True)
            ok, result_text, used_model, winning_key, _ = await _try_keys(fresh_ctx.get("keys", []))

        if not ok:
            record_blackbox(agent_id, "9ROUTER", "ERROR", result_text[:180], level="ERROR")
            raise HTTPException(
                status_code=502,
                detail=f"9Router ({model}): {result_text}. Set NINE_ROUTER_API_KEY in nexora-bridge.service or ~/.hermes/.env if using a custom key.",
            )

        _preferred_router_key = winning_key
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return {"ok": True, "reply": result_text, "model": used_model, "latency_ms": latency_ms}
    except HTTPException:
        raise
    except Exception as exc:
        record_blackbox(agent_id, "9ROUTER", "ERROR", str(exc), level="ERROR")
        raise HTTPException(status_code=502, detail=f"9Router error: {exc}")
    finally:
        active_tasks.pop(agent_id, None)


@app.post("/api/voice/speak", dependencies=[Depends(verify_token)])
async def voice_speak(req: VoiceReq):
    agent_id = validate_agent_slug(req.agent_id, allow_default=True)
    active_tasks[agent_id] = {"task": "VOICESTUDIO :3900", "started": time.time()}
    record_blackbox(agent_id, "VOICE", "TTS", req.text[:60])
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                f"{UPSTREAM_ENDPOINTS['voicestudio']}/v1/audio/speech",
                json={
                    "model": "tts-1",
                    "input": req.text,
                    "voice": req.voice or "alloy",
                    "response_format": "wav",
                },
            )
            if resp.status_code == 404:
                resp = await client.post(
                    f"{UPSTREAM_ENDPOINTS['voicestudio']}/api/tts",
                    json={"text": req.text, "voice": req.voice},
                )

            ctype = resp.headers.get("content-type", "")
            if resp.status_code < 400 and ("audio/" in ctype or "application/octet-stream" in ctype):
                return Response(content=resp.content, media_type=ctype.split(";")[0] or "audio/wav")

            return {"ok": resp.status_code < 400, "status_code": resp.status_code, "detail": resp.text[:250]}
    except Exception as exc:
        record_blackbox(agent_id, "VOICE", "ERROR", str(exc), level="ERROR")
        raise HTTPException(status_code=502, detail=f"VoiceStudio error: {exc}")
    finally:
        active_tasks.pop(agent_id, None)


@app.post("/api/shell", dependencies=[Depends(verify_token)])
async def run_shell(req: ShellReq):
    agent_id = validate_agent_slug(req.agent_id, allow_default=True)
    if not req.force and any(re.search(p, req.command, re.IGNORECASE) for p in DANGEROUS_PATTERNS):
        gid = str(uuid.uuid4())[:8]
        pending_approvals[gid] = {
            "id": gid,
            "agent": agent_id,
            "command": req.command,
            "time": utc_now(),
        }
        record_blackbox(agent_id, "HITL_GATE", "BLOCKED", f"[{gid}] {req.command}", level="ALERT")
        return {
            "ok": False,
            "status": "approval_required",
            "approval_id": gid,
            "command": req.command,
        }

    active_tasks[agent_id] = {"task": f"SHELL: {req.command[:22]}", "started": time.time()}
    record_blackbox(agent_id, "SHELL", "EXEC", req.command)
    try:
        return await ssh_exec(req.command, timeout=20.0)
    finally:
        active_tasks.pop(agent_id, None)


@app.post("/api/approvals/{approval_id}/{decision}", dependencies=[Depends(verify_token)])
async def decide_approval(approval_id: str, decision: str):
    item = pending_approvals.pop(approval_id, None)
    if not item:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if decision == "approve":
        record_blackbox(item["agent"], "HITL_GATE", "APPROVED", item["command"], level="WARN")
        return await run_shell(ShellReq(agent_id=item["agent"], command=item["command"], force=True))
    record_blackbox(item["agent"], "HITL_GATE", "REJECTED", item["command"])
    return {"ok": True, "status": "rejected"}


@app.post("/api/systemd/{service}/{action}", dependencies=[Depends(verify_token)])
async def systemd_ctl(service: str, action: str):
    unit = service.strip().lower().removesuffix(".service")
    if unit not in ALLOWED_SYSTEMD_UNITS:
        raise HTTPException(status_code=403, detail="Service unit not in allowlist")
    if action not in ("restart", "status"):
        raise HTTPException(status_code=400, detail="Unsupported systemd action")

    active_tasks["vps-guardian"] = {"task": f"SYSTEMD {action.upper()} {unit}", "started": time.time()}
    record_blackbox("vps-guardian", "SYSTEMD", action.upper(), unit, level="WARN")
    try:
        cmd = f"systemctl --user {action} {unit}.service || sudo -n systemctl {action} {unit}.service"
        return await ssh_exec(cmd, timeout=15.0)
    finally:
        active_tasks.pop("vps-guardian", None)


@app.post("/api/kill-switch", dependencies=[Depends(verify_token)])
async def kill_switch():
    active_tasks.clear()
    pending_approvals.clear()
    record_blackbox("default", "SECURITY", "KILL_SWITCH", "All active tasks and pending approvals cleared", level="ALERT")
    return {"ok": True}


@app.websocket("/ws")
async def ws_telemetry(ws: WebSocket, token: str = Query("")):
    if not _token_matches(token):
        await ws.close(code=1008)
        return
    await ws.accept()
    ws_clients.add(ws)
    try:
        while True:
            data = await collect_telemetry()
            await ws.send_json({"type": "telemetry", "data": data})
            await asyncio.sleep(2.5)
    except WebSocketDisconnect:
        pass
    finally:
        ws_clients.discard(ws)


# Static frontend asset mounts for the built NEXORA 3.0 Vite bundle
if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")
if (DIST_DIR / "src" / "assets").is_dir():
    app.mount("/src/assets", StaticFiles(directory=str(DIST_DIR / "src" / "assets")), name="src_assets")


@app.get("/", response_class=HTMLResponse)
async def serve_root():
    index_dist = DIST_DIR / "index.html"
    if index_dist.is_file():
        return FileResponse(index_dist)
    legacy = BASE_DIR / "index.html"
    if legacy.is_file():
        return HTMLResponse(legacy.read_text(encoding="utf-8"))
    raise HTTPException(status_code=503, detail="NEXORA frontend bundle not built yet")


@app.get("/{full_path:path}")
async def serve_spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path == "ws":
        raise HTTPException(status_code=404, detail="Not found")
    candidate = (DIST_DIR / full_path).resolve()
    if DIST_DIR.is_dir() and str(candidate).startswith(str(DIST_DIR.resolve()) + os.sep) and candidate.is_file():
        return FileResponse(candidate)
    index_dist = DIST_DIR / "index.html"
    if index_dist.is_file():
        return FileResponse(index_dist)
    raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn

    record_blackbox("default", "BRIDGE", "BOOT", f"NEXORA 3.0 Command Node online -> {MAIN_VPS_IP}")
    uvicorn.run(app, host="0.0.0.0", port=BRIDGE_PORT)
