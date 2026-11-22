"""NEXORA 3.0 — Hardened FastAPI Bridge & Static SPA Server for VPS 2.

Replaces the legacy single-file server.py on port 9120 while preserving:
- Existing NEXORA_TOKEN, MAIN_VPS_IP, MAIN_VPS_USER, SSH_KEY, BRIDGE_PORT
- Existing nexora-tunnel.service (127.0.0.1:20128, :3900, :9377)
"""

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse

import httpx
import psutil
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
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
MODEL_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$")

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
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

active_tasks: Dict[str, Dict[str, Any]] = {}
blackbox_logs: List[Dict[str, Any]] = []
pending_approvals: Dict[str, Dict[str, Any]] = {}
ws_clients: Set[WebSocket] = set()
_chat_ctx_cache: Dict[str, Dict[str, Any]] = {}
_models_cache: Dict[str, Any] = {"models": [], "source": "fallback", "ts": 0.0}
_recently_deleted_profiles: Dict[str, float] = {}
_preferred_router_key: str = ""
CHAT_CTX_TTL_SEC = 180.0
MODELS_CACHE_TTL_SEC = 60.0
DELETED_PROFILE_GRACE_SEC = 15.0


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


SESSION_COOKIE_NAME = "galaxy_session"
SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
TAILSCALE_ORIGIN_RE = re.compile(
    r"^https?://(100\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(:\d+)?$"
)


def _token_matches(candidate: str) -> bool:
    if not NEXORA_TOKEN or not candidate:
        return False
    return hmac.compare_digest(candidate.encode("utf-8"), NEXORA_TOKEN.encode("utf-8"))


def _expected_session_cookie() -> str:
    if not NEXORA_TOKEN:
        return ""
    return hmac.new(
        NEXORA_TOKEN.encode("utf-8"),
        b"galaxy-bridge-session-v1",
        hashlib.sha256,
    ).hexdigest()


def _cookie_matches(candidate: Optional[str]) -> bool:
    expected = _expected_session_cookie()
    if not expected or not candidate:
        return False
    return hmac.compare_digest(candidate.strip().encode("utf-8"), expected.encode("utf-8"))


def _is_https_request(request: Request) -> bool:
    xf_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    return xf_proto == "https" or request.url.scheme == "https"


def _set_session_cookie(response: Response, request: Request) -> None:
    sig = _expected_session_cookie()
    if not sig:
        return
    is_https = _is_https_request(request)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sig,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=is_https,
        path="/",
    )


def _is_trusted_origin(origin: Optional[str], host: Optional[str]) -> bool:
    if not origin:
        return True
    if origin in _build_allowed_origins() or TAILSCALE_ORIGIN_RE.match(origin):
        return True
    if host:
        try:
            parsed = urlparse(origin)
            if parsed.netloc and parsed.netloc.lower() == host.lower():
                return True
        except Exception:
            pass
    return False


def _has_valid_request_auth(request: Request) -> bool:
    auth_header = request.headers.get("authorization") or ""
    if auth_header.startswith("Bearer ") and _token_matches(auth_header.split(" ", 1)[1].strip()):
        return True
    q_token = request.query_params.get("token") or ""
    if _token_matches(q_token.strip()):
        return True
    return _cookie_matches(request.cookies.get(SESSION_COOKIE_NAME))


def verify_token(
    request: Request,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> str:
    if authorization and authorization.startswith("Bearer "):
        raw = authorization.split(" ", 1)[1].strip()
        if _token_matches(raw):
            return raw
    if token and _token_matches(token.strip()):
        return token.strip()
    cookie_val = request.cookies.get(SESSION_COOKIE_NAME)
    if _cookie_matches(cookie_val):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            origin = request.headers.get("origin")
            host = request.headers.get("x-forwarded-host") or request.headers.get("host")
            xrw = request.headers.get("x-requested-with", "").lower()
            if not (xrw == "galaxy-ui" or (origin and _is_trusted_origin(origin, host))):
                raise HTTPException(status_code=403, detail="Cross-site request blocked")
        return "cookie-session"
    raise HTTPException(status_code=401, detail="Unauthorized")


EXCLUDED_CORE_PROFILES = {"default", "vps-guardian"}


def validate_agent_slug(agent_id: str, allow_default: bool = False) -> str:
    slug = agent_id.strip().lower()
    if slug in EXCLUDED_CORE_PROFILES:
        if allow_default and slug == "default":
            return "default"
        raise HTTPException(
            status_code=403,
            detail="Core Telegram agent profiles (default & vps-guardian) are isolated from this dashboard",
        )
    if not AGENT_SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="Invalid agent profile identifier")
    return slug


def validate_avatar_value(raw: Optional[str], strict: bool = True) -> str:
    if not raw:
        return ""
    val = raw.strip()
    if len(val) > 350_000:
        if strict:
            raise HTTPException(status_code=400, detail="Avatar payload exceeds 350 KB limit")
        return ""
    if re.match(r"^/(src/assets/images|assets)/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$", val):
        return val
    if re.match(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$", val):
        return val
    if strict:
        raise HTTPException(status_code=400, detail="Unsupported avatar image format")
    return ""


def _format_exc(exc: BaseException) -> str:
    msg = str(exc).strip()
    name = type(exc).__name__
    return f"{name}: {msg}" if msg else name


def _extract_yaml_model(raw_text: str) -> str:
    if not raw_text:
        return ""
    lines = raw_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        m_top = re.match(r"^model\s*:\s*(.*)$", line)
        if m_top:
            rest = m_top.group(1).strip()
            if rest and not rest.startswith("#"):
                val = rest.split("#", 1)[0].strip().strip('"').strip("'")
                if val and MODEL_ID_RE.match(val):
                    return val
                return ""
            i += 1
            while i < len(lines):
                nxt = lines[i]
                stripped = nxt.lstrip(" ")
                indent = len(nxt) - len(stripped)
                if stripped and not stripped.startswith("#") and indent == 0:
                    break
                m_sub = re.match(r"^\s+(default|name|id)\s*:\s*(.*)$", nxt)
                if m_sub:
                    val = m_sub.group(2).split("#", 1)[0].strip().strip('"').strip("'")
                    if val and MODEL_ID_RE.match(val):
                        return val
                i += 1
            break
        i += 1
    return ""


def normalize_router_model(raw: Optional[str]) -> str:
    val = (raw or "").strip()
    if not val or val.lower() == "default":
        return "combo-best"
    # Legacy UI preset labels like "9router / claude-sonnet-4" are not valid 9Router provider IDs
    if re.match(r"^9router\s*/", val, re.IGNORECASE):
        return "combo-best"
    return val


def validate_model_id(raw: Optional[str]) -> str:
    val = normalize_router_model(raw)
    if not MODEL_ID_RE.match(val):
        raise HTTPException(
            status_code=400,
            detail="Invalid model identifier (use letters, numbers, and . _ : / @ + - only)",
        )
    return val


def validate_hermes_relpath(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("~/.hermes/"):
        cleaned = cleaned[len("~/.hermes/") :]
    cleaned = cleaned.lstrip("/")
    if not cleaned or ".." in cleaned or "\\" in cleaned or "\x00" in cleaned:
        raise HTTPException(status_code=400, detail="Invalid workspace file path")

    # Never allow modifying the isolated Telegram core agents' SOUL.md files
    if cleaned == "SOUL.md" or cleaned.startswith("profiles/vps-guardian/"):
        raise HTTPException(
            status_code=403,
            detail="Core Telegram agent files (default & vps-guardian) are isolated from this dashboard",
        )

    if cleaned in ALLOWED_ROOT_FILES:
        return cleaned

    m = re.match(r"^profiles/([a-z0-9][a-z0-9-]{0,48})/(SOUL\.md|USER\.md|config\.yaml)$", cleaned)
    if m and m.group(1) not in EXCLUDED_CORE_PROFILES:
        return cleaned

    raise HTTPException(
        status_code=403,
        detail="Only USER.md, OPERATING_RULES.md, config.yaml, and dashboard agent profile files may be edited",
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
import json, os, re, shutil, socket, time
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
busy_agents = set()
excluded_core = {'default', 'vps-guardian'}

p_root = h_home / 'profiles'
if p_root.exists():
    for d in sorted(p_root.iterdir()):
        if not d.is_dir() or d.name in excluded_core:
            continue
        meta = {
            'name': d.name,
            'building_name': '',
            'role': 'Hermes Specialist Agent',
            'model': 'combo-best',
            'arch': 'observatory_dome',
            'avatar': '',
        }
        if (d / 'nexora_meta.json').exists():
            try:
                meta.update(json.loads((d / 'nexora_meta.json').read_text()))
            except Exception:
                pass
        soul = (d / 'SOUL.md').read_text(errors='replace') if (d / 'SOUL.md').exists() else ''
        raw_model = str(meta.get('model') or '').strip()
        if (not raw_model or raw_model.lower().startswith('9router')) and (d / 'config.yaml').is_file():
            try:
                cfg_txt = (d / 'config.yaml').read_text(encoding='utf-8', errors='replace')
                m_def = re.search(r'(?m)^\s*(?:default|name)\s*:\s*["\']?([^\s#"\']+)["\']?', cfg_txt)
                if m_def:
                    raw_model = m_def.group(1).strip()
            except Exception:
                pass
        if not raw_model or raw_model.lower().startswith('9router'):
            raw_model = 'combo-best'
        profiles.append({
            'id': d.name,
            'name': meta.get('name') or d.name,
            'building_name': meta.get('building_name') or '',
            'role': meta['role'],
            'model': raw_model,
            'arch': meta['arch'],
            'avatar': meta.get('avatar', ''),
            'soul': soul,
            'is_core': False,
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
            "agents": [],
            "pending_approvals": list(pending_approvals.values()),
            "blackbox": blackbox_logs[:40],
        }

    remote = json.loads(ssh_res["stdout"])
    down_svcs = [s["name"] for s in remote["services"] if not s["healthy"]]
    vps_alert = remote["cpu"]["percent"] > 88.0 or remote["ram"]["percent"] > 92.0 or len(down_svcs) > 0

    now_ts = time.time()
    expired_deleted = [k for k, exp in _recently_deleted_profiles.items() if exp <= now_ts]
    for k in expired_deleted:
        _recently_deleted_profiles.pop(k, None)

    agents = []
    for p in remote["profiles"]:
        slug = p["id"]
        if slug in EXCLUDED_CORE_PROFILES or slug in _recently_deleted_profiles:
            continue
        has_hitl = any(a["agent"] == slug for a in pending_approvals.values())
        if has_hitl:
            p["status"] = "ALERT"
            p["task"] = "APPROVAL GATE"
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
    name: Optional[str] = None
    building_name: Optional[str] = None
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


class UpdateModelReq(BaseModel):
    model: str


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


class SessionAuthReq(BaseModel):
    token: Optional[str] = None


@app.get("/api/health")
async def health(request: Request):
    return {
        "ok": True,
        "version": "3.0.0",
        "main_vps": MAIN_VPS_IP,
        "time": utc_now(),
        "authenticated": _has_valid_request_auth(request),
    }


@app.post("/api/auth/session")
async def create_auth_session(
    request: Request,
    req: Optional[SessionAuthReq] = None,
    authorization: Optional[str] = Header(None),
):
    candidate = ""
    if authorization and authorization.startswith("Bearer "):
        candidate = authorization.split(" ", 1)[1].strip()
    elif req and req.token:
        candidate = req.token.strip()

    if not (_token_matches(candidate) or _cookie_matches(request.cookies.get(SESSION_COOKIE_NAME))):
        raise HTTPException(status_code=401, detail="Invalid NEXORA_TOKEN")

    resp = JSONResponse({"ok": True, "authenticated": True})
    _set_session_cookie(resp, request)
    return resp


@app.post("/api/auth/logout")
async def clear_auth_session(request: Request, _=Depends(verify_token)):
    resp = JSONResponse({"ok": True, "authenticated": False})
    resp.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return resp


@app.get("/api/status", dependencies=[Depends(verify_token)])
async def get_status():
    return await collect_telemetry()


@app.post("/api/agents", dependencies=[Depends(verify_token)])
async def create_agent(req: CreateAgentReq):
    raw_slug = re.sub(r"[^a-z0-9\-]+", "-", req.slug.lower().strip()).strip("-")
    slug = validate_agent_slug(raw_slug, allow_default=False)
    if slug in EXCLUDED_CORE_PROFILES:
        raise HTTPException(
            status_code=403,
            detail="Core Telegram profiles (default & vps-guardian) are reserved and isolated",
        )
    safe_avatar = validate_avatar_value(req.avatar, strict=False)
    safe_model = validate_model_id(req.model)
    display_name = (req.name or slug).strip()[:64] or slug
    building_name = (req.building_name or "").strip()[:80]
    soul = req.soul or f"# SOUL.md — {display_name}\nRole: {req.role}\n"
    meta = {
        "name": display_name,
        "building_name": building_name,
        "role": req.role,
        "model": safe_model,
        "arch": req.arch,
        "avatar": safe_avatar,
        "skills_linked": True,
        "tools_enabled": True,
    }
    provision_tpl = r"""
import json, os, re
from pathlib import Path

payload = json.loads(__PAYLOAD_JSON__)
slug = payload['slug']
meta = payload['meta']
soul = payload['soul']
chosen_model = str(meta.get('model') or 'combo-best').strip()

def upsert_config_model(raw_text: str, new_model: str) -> str:
    lines = raw_text.splitlines() if raw_text else []
    updated = False
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m_top = re.match(r'^model\s*:\s*(.*)$', line)
        if m_top and not updated:
            rest = m_top.group(1).strip()
            if rest and not rest.startswith('#'):
                # Scalar top-level `model: ...`
                out.append(f'model: {new_model}')
                updated = True
                i += 1
                continue
            # Nested `model:` block
            out.append(line)
            i += 1
            block_lines = []
            block_indent = None
            while i < len(lines):
                nxt = lines[i]
                stripped = nxt.lstrip(' ')
                indent = len(nxt) - len(stripped)
                if stripped and not stripped.startswith('#') and indent == 0:
                    break
                if stripped and not stripped.startswith('#') and block_indent is None:
                    block_indent = indent
                block_lines.append(nxt)
                i += 1
            ind_str = ' ' * (block_indent or 2)
            replaced_in_block = False
            for bl in block_lines:
                m_key = re.match(r'^(\s*)(default|name)\s*:\s*(.*)$', bl)
                if m_key and not replaced_in_block:
                    out.append(f'{m_key.group(1)}{m_key.group(2)}: {new_model}')
                    replaced_in_block = True
                else:
                    out.append(bl)
            if not replaced_in_block:
                out.append(f'{ind_str}default: {new_model}')
            updated = True
            continue
        out.append(line)
        i += 1
    if not updated:
        if out and out[-1].strip():
            out.append('')
        out.append('model:')
        out.append(f'  default: {new_model}')
    return '\n'.join(out) + '\n'

h_home = (Path.home() / '.hermes').resolve()
root = h_home / 'profiles'
root.mkdir(parents=True, exist_ok=True)
root = root.resolve()
d = (root / slug).resolve()
assert str(d).startswith(str(root) + '/'), f'Unsafe target path: {d}'
d.mkdir(parents=True, exist_ok=True)
(d / 'memories').mkdir(exist_ok=True)

# 1. Inherit all installed Hermes skills via symlink so every dashboard agent has full skills access
shared_skills = h_home / 'skills'
target_skills = d / 'skills'
skills_linked = target_skills.exists() or target_skills.is_symlink()
if shared_skills.exists() and not skills_linked:
    try:
        os.symlink(shared_skills, target_skills)
        skills_linked = True
    except Exception:
        skills_linked = False

# 2. Copy sanitized .env (LLM/tool API keys only — explicitly strip Telegram/Discord/bot tokens)
src_env = h_home / '.env'
dst_env = d / '.env'
env_copied = dst_env.is_file()
blocked_env_re = re.compile(r'^(export\s+)?(TELEGRAM|TG_|DISCORD|SLACK|WHATSAPP|MESSENGER|SIGNAL_|BOT_TOKEN|CHAT_ID|WEBHOOK|GATEWAY_TOKEN)', re.I)
if src_env.is_file() and not env_copied:
    kept = []
    for line in src_env.read_text(encoding='utf-8', errors='replace').splitlines():
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        if blocked_env_re.search(s):
            continue
        kept.append(line)
    if kept:
        dst_env.write_text('\n'.join(kept) + '\n', encoding='utf-8')
        try:
            os.chmod(dst_env, 0o600)
        except Exception:
            pass
        env_copied = True

# 3. Copy sanitized config.yaml (strips messaging/telegram sections) and set agent's chosen model
src_cfg = h_home / 'config.yaml'
dst_cfg = d / 'config.yaml'
config_copied = dst_cfg.is_file()
if src_cfg.is_file() and not config_copied:
    raw_lines = src_cfg.read_text(encoding='utf-8', errors='replace').splitlines()
    out_lines = []
    skip_indent = None
    skip_section_re = re.compile(r'^(\s*)(telegram|discord|slack|whatsapp|messaging|platforms|channels)\s*:', re.I)
    blocked_cfg_re = re.compile(r'(bot_token|telegram_token|chat_id|allowed_users|webhook_url)', re.I)
    for line in raw_lines:
        stripped = line.lstrip(' ')
        indent = len(line) - len(stripped)
        if skip_indent is not None:
            if stripped and not stripped.startswith('#') and indent <= skip_indent:
                skip_indent = None
            else:
                continue
        m = skip_section_re.match(line)
        if m:
            skip_indent = len(m.group(1))
            continue
        if blocked_cfg_re.search(line):
            continue
        out_lines.append(line)
    dst_cfg.write_text(upsert_config_model('\n'.join(out_lines), chosen_model), encoding='utf-8')
    config_copied = True
elif dst_cfg.is_file():
    dst_cfg.write_text(upsert_config_model(dst_cfg.read_text(encoding='utf-8', errors='replace'), chosen_model), encoding='utf-8')
else:
    dst_cfg.write_text(upsert_config_model('', chosen_model), encoding='utf-8')
    config_copied = True

# 4. Inherit sanitized auth.json if present (LLM provider credentials only, never Telegram/Discord tokens)
src_auth = h_home / 'auth.json'
dst_auth = d / 'auth.json'
if src_auth.is_file() and not dst_auth.is_file():
    try:
        auth_obj = json.loads(src_auth.read_text(encoding='utf-8', errors='replace'))
        if isinstance(auth_obj, dict):
            cleaned_auth = {
                k: v for k, v in auth_obj.items()
                if not re.search(r'(telegram|discord|slack|whatsapp|bot_token|chat_id)', str(k), re.I)
            }
            dst_auth.write_text(json.dumps(cleaned_auth, indent=2), encoding='utf-8')
            try:
                os.chmod(dst_auth, 0o600)
            except Exception:
                pass
    except Exception:
        pass

(d / 'nexora_meta.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
(d / 'SOUL.md').write_text(soul, encoding='utf-8')
assert (d / 'SOUL.md').is_file() and (d / 'nexora_meta.json').is_file()
print(json.dumps({
    'ok': True,
    'slug': slug,
    'path': str(d),
    'model': chosen_model,
    'skills_linked': skills_linked,
    'env_copied': env_copied,
    'config_copied': config_copied,
}))
"""
    encoded_payload = json.dumps(json.dumps({"slug": slug, "meta": meta, "soul": soul}))
    py = provision_tpl.replace("__PAYLOAD_JSON__", encoded_payload)
    res = await ssh_run_python(py, timeout=15.0)
    if not res["ok"]:
        detail = res["stderr"] or res["stdout"] or "Failed to create profile on hermesagent"
        record_blackbox(slug, "FLEET", "DEPLOY_ERROR", detail[:180], level="ERROR")
        raise HTTPException(status_code=500, detail=detail)
    _recently_deleted_profiles.pop(slug, None)
    details: Dict[str, Any] = {}
    try:
        details = json.loads(res["stdout"].splitlines()[-1]) if res["stdout"] else {}
    except Exception:
        details = {}
    record_blackbox(slug, "FLEET", "DEPLOY_AGENT", f"Created isolated profile '{slug}' with shared ~/.hermes/skills")
    asyncio.create_task(_broadcast_fresh_telemetry())
    return {
        "ok": True,
        "slug": slug,
        "skills_linked": bool(details.get("skills_linked", False)),
        "env_copied": bool(details.get("env_copied", False)),
        "config_copied": bool(details.get("config_copied", False)),
    }


@app.put("/api/agents/{agent_id}/avatar", dependencies=[Depends(verify_token)])
async def update_avatar(agent_id: str, req: UpdateAvatarReq):
    slug = validate_agent_slug(agent_id, allow_default=False)
    if slug in EXCLUDED_CORE_PROFILES:
        raise HTTPException(status_code=403, detail="Core Telegram profiles are isolated from this dashboard")
    safe_avatar = validate_avatar_value(req.avatar)
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
    slug = validate_agent_slug(agent_id, allow_default=False)
    if slug in EXCLUDED_CORE_PROFILES:
        raise HTTPException(status_code=403, detail="Core Telegram profiles are isolated from this dashboard")
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


def _parse_models_payload(data: Any, seen: Set[str], out: List[Dict[str, str]]) -> int:
    added = 0
    raw_items: List[Any] = []
    if isinstance(data, dict):
        for key in ("data", "models", "combos", "items"):
            val = data.get(key)
            if isinstance(val, list):
                raw_items.extend(val)
    elif isinstance(data, list):
        raw_items = data

    for item in raw_items:
        if isinstance(item, str):
            mid = item.strip()
            owner = ""
        elif isinstance(item, dict):
            mid = str(item.get("id") or item.get("name") or "").strip()
            owner = str(item.get("owned_by") or item.get("provider") or item.get("type") or "").strip()
        else:
            continue
        if not mid or mid in seen or not MODEL_ID_RE.match(mid):
            continue
        seen.add(mid)
        is_combo = mid.lower().startswith("combo") or owner.lower() == "combo"
        group = "combo" if is_combo else (owner or (mid.split("/", 1)[0] if "/" in mid else "9router"))
        out.append({"id": mid, "label": mid, "group": group})
        added += 1
    return added


async def _fetch_9router_models_via_ssh(candidate_keys: List[str]) -> Dict[str, Any]:
    """Fallback model discovery directly on hermesagent (:20128 + db.json combos + ~/.hermes/config.yaml)."""
    script_tpl = r"""
import glob, json, re, urllib.request, urllib.error
from pathlib import Path

keys = json.loads(__KEYS_JSON__)
items = []
source = 'fallback'

for key in keys:
    headers = {'Accept': 'application/json'}
    if key:
        headers['Authorization'] = f'Bearer {key}'
        headers['x-api-key'] = key
    for path in ('/v1/models', '/api/combos'):
        try:
            req = urllib.request.Request(f'http://127.0.0.1:20128{path}', headers=headers, method='GET')
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode('utf-8', errors='replace')
                data = json.loads(raw)
                arr = data.get('data') if isinstance(data, dict) else (data if isinstance(data, list) else [])
                if isinstance(data, dict) and not arr:
                    arr = data.get('combos') or data.get('models') or []
                if isinstance(arr, list) and arr:
                    for it in arr:
                        if isinstance(it, dict) and path == '/api/combos' and 'owned_by' not in it:
                            it = dict(it)
                            it['owned_by'] = 'combo'
                        items.append(it)
                    source = '9router'
        except Exception:
            continue
    if source == '9router':
        break

# Also read 9Router db.json combos if available
home = Path.home()
db_candidates = [
    home / '.9router' / 'db.json',
    home / '9router' / 'db.json',
    home / '9router' / 'data' / 'db.json',
    home / '.config' / '9router' / 'db.json',
    home / '.local' / 'share' / '9router' / 'db.json',
]
for pat in [str(home / '*9router*' / 'db.json'), str(home / '*9router*' / '*' / 'db.json')]:
    for found in glob.glob(pat):
        p = Path(found)
        if p not in db_candidates:
            db_candidates.append(p)
for dbp in db_candidates:
    if not dbp.is_file():
        continue
    try:
        d = json.loads(dbp.read_text(encoding='utf-8', errors='replace'))
        if isinstance(d, dict):
            for c in d.get('combos', []) or []:
                if isinstance(c, dict) and (c.get('name') or c.get('id')):
                    items.append({'id': str(c.get('name') or c.get('id')), 'owned_by': 'combo'})
                    source = '9router'
    except Exception:
        pass

# Read active Hermes default model from ~/.hermes/config.yaml
hermes_default = ''
cfg_fp = home / '.hermes' / 'config.yaml'
if cfg_fp.is_file():
    try:
        txt = cfg_fp.read_text(encoding='utf-8', errors='replace')
        m_top = re.search(r'(?m)^model\s*:\s*([^\s#\n][^\n]*)$', txt)
        if m_top:
            hermes_default = m_top.group(1).split('#', 1)[0].strip().strip('"').strip("'")
        else:
            m_sub = re.search(r'(?m)^\s+(?:default|name)\s*:\s*["\']?([^\s#"\']+)["\']?', txt)
            if m_sub:
                hermes_default = m_sub.group(1).strip()
    except Exception:
        pass

print(json.dumps({'source': source, 'items': items, 'hermes_default': hermes_default}))
"""
    script = script_tpl.replace("__KEYS_JSON__", json.dumps(json.dumps(candidate_keys[:8])))
    res = await ssh_run_python(script, timeout=10.0)
    if not res["ok"] or not res["stdout"]:
        return {"source": "fallback", "items": [], "hermes_default": ""}
    try:
        return json.loads(res["stdout"].splitlines()[-1])
    except Exception:
        return {"source": "fallback", "items": [], "hermes_default": ""}


@app.get("/api/models", dependencies=[Depends(verify_token)])
async def list_router_models(refresh: int = 0):
    """Fetches real available models & combos directly from 9Router (:20128/v1/models) with SSH fallback."""
    now_ts = time.time()
    cache_ttl = MODELS_CACHE_TTL_SEC if _models_cache.get("source") == "9router" else 5.0
    if not refresh and _models_cache["models"] and (now_ts - float(_models_cache["ts"])) < cache_ttl:
        return {
            "ok": True,
            "source": _models_cache["source"],
            "default_model": _models_cache.get("default_model", "combo-best"),
            "models": _models_cache["models"],
        }

    ctx = await _discover_chat_context("operator", force_refresh=bool(refresh))
    candidate_keys = list(ctx.get("keys", []))
    if "" not in candidate_keys:
        candidate_keys.append("")

    discovered: List[Dict[str, str]] = []
    seen: Set[str] = set()
    source = "fallback"
    hermes_default = str(ctx.get("default_model") or "").strip()

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=3.5, read=6.0, write=5.0, pool=3.5)) as client:
            for api_key in candidate_keys:
                headers: Dict[str, str] = {"Accept": "application/json"}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                    headers["x-api-key"] = api_key
                try:
                    resp = await client.get(f"{UPSTREAM_ENDPOINTS['nine_router']}/v1/models", headers=headers)
                    if resp.status_code >= 400:
                        continue
                    data = resp.json()
                    if _parse_models_payload(data, seen, discovered) > 0:
                        source = "9router"
                        break
                except Exception:
                    continue
    except Exception:
        pass

    # If VPS 2 tunnel returned no models, query 9Router directly on hermesagent via SSH
    if source != "9router":
        ssh_data = await _fetch_9router_models_via_ssh(candidate_keys)
        if ssh_data.get("hermes_default") and not hermes_default:
            hermes_default = str(ssh_data["hermes_default"]).strip()
        if _parse_models_payload(ssh_data.get("items", []), seen, discovered) > 0:
            source = "9router"

    if hermes_default and MODEL_ID_RE.match(hermes_default) and hermes_default not in seen:
        seen.add(hermes_default)
        is_combo = hermes_default.lower().startswith("combo")
        discovered.append({
            "id": hermes_default,
            "label": hermes_default,
            "group": "combo" if is_combo else "hermes",
        })

    if discovered:
        discovered.sort(key=lambda m: (0 if m["group"] == "combo" else 1, m["id"].lower()))
    else:
        discovered = [{"id": "combo-best", "label": "combo-best", "group": "combo"}]

    default_model = hermes_default if (hermes_default and MODEL_ID_RE.match(hermes_default)) else discovered[0]["id"]
    _models_cache["models"] = discovered
    _models_cache["source"] = source
    _models_cache["default_model"] = default_model
    _models_cache["ts"] = now_ts
    return {"ok": True, "source": source, "default_model": default_model, "models": discovered}


@app.put("/api/agents/{agent_id}/model", dependencies=[Depends(verify_token)])
async def update_agent_model(agent_id: str, req: UpdateModelReq):
    """Updates an isolated dashboard agent's model in both nexora_meta.json and Hermes profile config.yaml."""
    slug = validate_agent_slug(agent_id, allow_default=False)
    if slug in EXCLUDED_CORE_PROFILES:
        raise HTTPException(status_code=403, detail="Core Telegram profiles are isolated from this dashboard")
    safe_model = validate_model_id(req.model)

    update_tpl = r"""
import json, re
from pathlib import Path

payload = json.loads(__PAYLOAD_JSON__)
slug = payload['slug']
new_model = payload['model']

def upsert_config_model(raw_text: str, chosen: str) -> str:
    lines = raw_text.splitlines() if raw_text else []
    updated = False
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m_top = re.match(r'^model\s*:\s*(.*)$', line)
        if m_top and not updated:
            rest = m_top.group(1).strip()
            if rest and not rest.startswith('#'):
                out.append(f'model: {chosen}')
                updated = True
                i += 1
                continue
            out.append(line)
            i += 1
            block_lines = []
            block_indent = None
            while i < len(lines):
                nxt = lines[i]
                stripped = nxt.lstrip(' ')
                indent = len(nxt) - len(stripped)
                if stripped and not stripped.startswith('#') and indent == 0:
                    break
                if stripped and not stripped.startswith('#') and block_indent is None:
                    block_indent = indent
                block_lines.append(nxt)
                i += 1
            ind_str = ' ' * (block_indent or 2)
            replaced_in_block = False
            for bl in block_lines:
                m_key = re.match(r'^(\s*)(default|name)\s*:\s*(.*)$', bl)
                if m_key and not replaced_in_block:
                    out.append(f'{m_key.group(1)}{m_key.group(2)}: {chosen}')
                    replaced_in_block = True
                else:
                    out.append(bl)
            if not replaced_in_block:
                out.append(f'{ind_str}default: {chosen}')
            updated = True
            continue
        out.append(line)
        i += 1
    if not updated:
        if out and out[-1].strip():
            out.append('')
        out.append('model:')
        out.append(f'  default: {chosen}')
    return '\n'.join(out) + '\n'

h_home = (Path.home() / '.hermes').resolve()
root = h_home / 'profiles'
root.mkdir(parents=True, exist_ok=True)
root = root.resolve()
d = (root / slug).resolve()
assert str(d).startswith(str(root) + '/'), f'Unsafe target path: {d}'
d.mkdir(parents=True, exist_ok=True)

# 1. Update nexora_meta.json
meta_fp = d / 'nexora_meta.json'
meta = {}
if meta_fp.exists():
    try:
        meta = json.loads(meta_fp.read_text(encoding='utf-8'))
    except Exception:
        meta = {}
meta['model'] = new_model
meta_fp.write_text(json.dumps(meta, indent=2), encoding='utf-8')

# 2. Update Hermes profile config.yaml (if missing, seed sanitized copy from ~/.hermes/config.yaml first)
cfg_fp = d / 'config.yaml'
if cfg_fp.is_file():
    raw_cfg = cfg_fp.read_text(encoding='utf-8', errors='replace')
else:
    src_cfg = h_home / 'config.yaml'
    raw_cfg = ''
    if src_cfg.is_file():
        out_lines = []
        skip_indent = None
        skip_section_re = re.compile(r'^(\s*)(telegram|discord|slack|whatsapp|messaging|platforms|channels)\s*:', re.I)
        blocked_cfg_re = re.compile(r'(bot_token|telegram_token|chat_id|allowed_users|webhook_url)', re.I)
        for line in src_cfg.read_text(encoding='utf-8', errors='replace').splitlines():
            stripped = line.lstrip(' ')
            indent = len(line) - len(stripped)
            if skip_indent is not None:
                if stripped and not stripped.startswith('#') and indent <= skip_indent:
                    skip_indent = None
                else:
                    continue
            m = skip_section_re.match(line)
            if m:
                skip_indent = len(m.group(1))
                continue
            if blocked_cfg_re.search(line):
                continue
            out_lines.append(line)
        raw_cfg = '\n'.join(out_lines)

cfg_fp.write_text(upsert_config_model(raw_cfg, new_model), encoding='utf-8')
print(json.dumps({'ok': True, 'slug': slug, 'model': new_model, 'config_updated': True}))
"""
    encoded_payload = json.dumps(json.dumps({"slug": slug, "model": safe_model}))
    py = update_tpl.replace("__PAYLOAD_JSON__", encoded_payload)
    res = await ssh_run_python(py, timeout=12.0)
    if not res["ok"]:
        raise HTTPException(status_code=500, detail=res["stderr"] or "Failed to update agent model")
    _chat_ctx_cache.pop(slug, None)
    record_blackbox(slug, "CONFIG", "UPDATE_MODEL", f"Switched model to '{safe_model}' & synced config.yaml")
    asyncio.create_task(_broadcast_fresh_telemetry())
    return {"ok": True, "slug": slug, "model": safe_model, "config_updated": True}


async def _broadcast_fresh_telemetry() -> None:
    if not ws_clients:
        return
    try:
        data = await collect_telemetry()
        dead: List[WebSocket] = []
        for client in list(ws_clients):
            try:
                await client.send_json({"type": "telemetry", "data": data})
            except Exception:
                dead.append(client)
        for client in dead:
            ws_clients.discard(client)
    except Exception:
        pass


@app.delete("/api/agents/{agent_id}", dependencies=[Depends(verify_token)])
async def delete_agent(agent_id: str):
    slug = validate_agent_slug(agent_id, allow_default=False)

    # Immediately suppress in-flight telemetry probes from re-emitting this slug while SSH rmtree runs
    _recently_deleted_profiles[slug] = time.time() + DELETED_PROFILE_GRACE_SEC
    active_tasks.pop(slug, None)
    _chat_ctx_cache.pop(slug, None)

    py = (
        "import shutil, subprocess\n"
        "from pathlib import Path\n"
        "root = (Path.home() / '.hermes' / 'profiles').resolve()\n"
        f"target = (root / {json.dumps(slug)}).resolve()\n"
        "assert str(target).startswith(str(root) + '/')\n"
        "if target.exists():\n"
        "    shutil.rmtree(target, ignore_errors=True)\n"
        "if target.exists():\n"
        "    subprocess.run(['rm', '-rf', str(target)], check=False)\n"
        "assert not target.exists(), f'Profile directory still exists: {target}'\n"
    )
    res = await ssh_run_python(py)
    if not res["ok"]:
        _recently_deleted_profiles.pop(slug, None)
        raise HTTPException(status_code=500, detail=res["stderr"] or "Failed to remove profile")
    record_blackbox("system", "FLEET", "DECOMMISSION", f"Deleted profile '{slug}'", level="WARN")
    asyncio.create_task(_broadcast_fresh_telemetry())
    return {"ok": True, "slug": slug}


@app.get("/api/files", dependencies=[Depends(verify_token)])
async def list_workspace_files():
    py = r"""
import json
from datetime import datetime
from pathlib import Path

h_home = Path.home() / '.hermes'
targets = [
    ('USER.md', 'operator', 'markdown'),
    ('OPERATING_RULES.md', 'operator', 'markdown'),
    ('config.yaml', 'operator', 'yaml'),
]
excluded_core = {'default', 'vps-guardian'}
p_root = h_home / 'profiles'
if p_root.exists():
    for d in sorted(p_root.iterdir()):
        if d.is_dir() and d.name not in excluded_core:
            soul = d / 'SOUL.md'
            if soul.exists():
                targets.append((f'profiles/{d.name}/SOUL.md', d.name, 'markdown'))
            cfg = d / 'config.yaml'
            if cfg.exists():
                targets.append((f'profiles/{d.name}/config.yaml', d.name, 'yaml'))

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
        'agentId': agent_id,
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
default_model = ''
for cf in [p_dir / 'config.yaml', h_home / 'config.yaml']:
    if not cf.is_file():
        continue
    try:
        txt = cf.read_text(encoding='utf-8', errors='replace')
        for m in yaml_key_re.finditer(txt):
            add_key(resolve_val(m.group(1)))
        if not default_model:
            m_top = re.search(r'(?m)^model\s*:\s*([^\s#\n][^\n]*)$', txt)
            if m_top:
                default_model = m_top.group(1).split('#', 1)[0].strip().strip('"').strip("'")
            else:
                m_sub = re.search(r'(?m)^\s+(?:default|name)\s*:\s*["\']?([^\s#"\']+)["\']?', txt)
                if m_sub:
                    default_model = m_sub.group(1).strip()
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

print(json.dumps({'keys': keys[:12], 'soul': soul, 'default_model': default_model}))
"""
    remote_script = remote_script_tpl.replace("__SLUG__", json.dumps(agent_id))
    remote_keys: List[str] = []
    soul = ""
    default_model = ""
    res = await ssh_run_python(remote_script, timeout=8.0)
    if res["ok"] and res["stdout"]:
        try:
            parsed = json.loads(res["stdout"])
            remote_keys = [str(k) for k in parsed.get("keys", []) if isinstance(k, str) and k.strip()]
            soul = str(parsed.get("soul", "") or "")
            default_model = str(parsed.get("default_model", "") or "").strip()
        except Exception:
            pass

    merged_keys: List[str] = []
    if _preferred_router_key:
        merged_keys.append(_preferred_router_key)
    for k in local_keys + remote_keys + ["sk-9router-local"]:
        if k and k not in merged_keys:
            merged_keys.append(k)

    ctx = {"ts": now, "keys": merged_keys, "soul": soul, "default_model": default_model}
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


async def _try_hermes_cli_chat(
    agent_id: str,
    message: str,
    history: Optional[List[ChatHistoryItem]],
    model: str,
) -> Optional[Dict[str, Any]]:
    """
    Attempts to execute a one-shot turn via the real `hermes` CLI inside the isolated
    profile `~/.hermes/profiles/<agent_id>` so dashboard-created agents can invoke real
    Hermes skills and tools. Returns None cleanly if the CLI is unavailable or unsupported,
    allowing chat_agent to fall back seamlessly to 9Router direct completion.
    """
    prompt_parts: List[str] = []
    if history:
        recent = history[-6:]
        ctx_lines: List[str] = []
        for item in recent:
            txt = (item.content or "").strip()
            if txt:
                speaker = "Assistant" if item.role == "assistant" else "Operator"
                ctx_lines.append(f"{speaker}: {txt[:800]}")
        if ctx_lines:
            prompt_parts.append("Recent conversation context:\n" + "\n".join(ctx_lines))
    prompt_parts.append(f"Operator message:\n{message}")
    combined_prompt = "\n\n".join(prompt_parts)

    runner_tpl = r"""
import json, os, re, shutil, subprocess
from pathlib import Path

slug = __SLUG__
prompt = __PROMPT__
model = __MODEL__

home = Path.home()
h_home = home / '.hermes'
p_dir = (h_home / 'profiles' / slug).resolve()
if not p_dir.is_dir():
    print(json.dumps({'ok': False, 'reason': 'profile_missing'}))
    raise SystemExit(0)

# Ensure shared skills symlink exists for older profiles created before this upgrade
shared_skills = h_home / 'skills'
target_skills = p_dir / 'skills'
if shared_skills.exists() and not target_skills.exists() and not target_skills.is_symlink():
    try:
        os.symlink(shared_skills, target_skills)
    except Exception:
        pass

candidates = [
    shutil.which('hermes'),
    str(home / '.local' / 'bin' / 'hermes'),
    '/usr/local/bin/hermes',
    str(h_home / 'hermes-agent' / '.venv' / 'bin' / 'hermes'),
    str(home / 'hermes-agent' / '.venv' / 'bin' / 'hermes'),
]
hermes_bin = next((c for c in candidates if c and os.path.isfile(c) and os.access(c, os.X_OK)), None)
if not hermes_bin:
    print(json.dumps({'ok': False, 'reason': 'hermes_bin_not_found'}))
    raise SystemExit(0)

help_text = ''
try:
    hp = subprocess.run([hermes_bin, 'chat', '--help'], capture_output=True, text=True, timeout=5)
    help_text = (hp.stdout or '') + '\n' + (hp.stderr or '')
except Exception:
    pass

argv = [hermes_bin, 'chat']
env = os.environ.copy()
# Isolate profile runtime via HERMES_HOME=p_dir (do NOT pass --profile to avoid double-nested profiles/<slug>/profiles/<slug>)
# and explicitly blank Telegram tokens so the user's Telegram bots are never disturbed
env['HERMES_HOME'] = str(p_dir)
env.pop('HERMES_PROFILE', None)
env['TELEGRAM_BOT_TOKEN'] = ''
env['NO_COLOR'] = '1'

if '-q' in help_text or '--query' in help_text:
    argv.extend(['-q', prompt])
elif '--prompt' in help_text:
    argv.extend(['--prompt', prompt])
else:
    print(json.dumps({'ok': False, 'reason': 'unsupported_cli_flags'}))
    raise SystemExit(0)

if '--quiet' in help_text:
    argv.append('--quiet')
if model and model != 'combo-best' and ('--model' in help_text or '-m,' in help_text):
    argv.extend(['--model', model])

try:
    proc = subprocess.run(
        argv,
        capture_output=True,
        text=True,
        timeout=45,
        env=env,
        cwd=str(p_dir),
    )
    ansi_re = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')
    out = ansi_re.sub('', proc.stdout or '').strip()
    err = ansi_re.sub('', proc.stderr or '').strip()
    if proc.returncode == 0 and out:
        print(json.dumps({'ok': True, 'reply': out, 'model': model}))
    else:
        print(json.dumps({'ok': False, 'reason': f'rc={proc.returncode}', 'stderr': err[:300]}))
except Exception as exc:
    print(json.dumps({'ok': False, 'reason': f'{type(exc).__name__}: {exc}'[:200]}))
"""
    script = (
        runner_tpl.replace("__SLUG__", json.dumps(agent_id))
        .replace("__PROMPT__", json.dumps(combined_prompt))
        .replace("__MODEL__", json.dumps(model))
    )
    res = await ssh_run_python(script, timeout=52.0)
    if not res["ok"] or not res["stdout"]:
        record_blackbox(agent_id, "HERMES_CLI", "FALLBACK", (res.get("stderr") or "ssh_exec_failed")[:160])
        return None
    try:
        last_line = res["stdout"].splitlines()[-1].strip()
        parsed = json.loads(last_line)
        if parsed.get("ok") and parsed.get("reply"):
            return parsed
        reason = parsed.get("stderr") or parsed.get("reason") or "cli_failed"
        record_blackbox(agent_id, "HERMES_CLI", "FALLBACK", str(reason)[:160])
    except Exception:
        return None
    return None


async def _call_9router_chat_via_ssh(
    candidate_keys: List[str],
    target_model: str,
    messages: List[Dict[str, str]],
) -> tuple[bool, str, str, str, bool]:
    """Direct fallback to 127.0.0.1:20128 on hermesagent via SSH when VPS 2 tunnel stalls/times out."""
    script_tpl = r"""
import json, urllib.request, urllib.error

payload = json.loads(__PAYLOAD_JSON__)
keys = payload['keys']
model = payload['model']
messages = payload['messages']
body = json.dumps({'model': model, 'messages': messages}).encode('utf-8')

last_err = 'No valid 9Router API key found'
saw_auth = False

for key in keys:
    headers = {'Content-Type': 'application/json'}
    if key:
        headers['Authorization'] = f'Bearer {key}'
        headers['x-api-key'] = key
    req = urllib.request.Request(
        'http://127.0.0.1:20128/v1/chat/completions',
        data=body,
        headers=headers,
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=55) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            data = json.loads(raw)
            choices = data.get('choices') if isinstance(data, dict) else None
            if isinstance(choices, list) and choices:
                msg = choices[0].get('message', {}) if isinstance(choices[0], dict) else {}
                content = msg.get('content')
                if content is not None:
                    print(json.dumps({
                        'ok': True,
                        'text': str(content),
                        'model': str(data.get('model', model)),
                        'key': key,
                        'saw_auth': False,
                    }))
                    raise SystemExit(0)
            last_err = f'Unexpected 9Router response: {raw[:180]}'
            break
    except urllib.error.HTTPError as he:
        raw = ''
        try:
            raw = he.read().decode('utf-8', errors='replace')
        except Exception:
            pass
        try:
            edata = json.loads(raw)
        except Exception:
            edata = None
        err_msg = f'HTTP {he.code}: {raw[:180]}'
        if isinstance(edata, dict):
            eobj = edata.get('error')
            if isinstance(eobj, dict):
                err_msg = str(eobj.get('message') or eobj.get('detail') or eobj.get('code') or err_msg)
            elif isinstance(eobj, str) and eobj:
                err_msg = eobj
        last_err = err_msg
        if he.code in (401, 403) or 'api key' in err_msg.lower() or 'unauthorized' in err_msg.lower():
            saw_auth = True
            continue
        break
    except Exception as exc:
        last_err = f'{type(exc).__name__}: {exc}' if str(exc) else type(exc).__name__
        break

print(json.dumps({'ok': False, 'text': last_err, 'model': model, 'key': '', 'saw_auth': saw_auth}))
"""
    encoded = json.dumps(
        json.dumps({"keys": candidate_keys[:8] or [""], "model": target_model, "messages": messages})
    )
    script = script_tpl.replace("__PAYLOAD_JSON__", encoded)
    res = await ssh_run_python(script, timeout=62.0)
    if not res["ok"] or not res["stdout"]:
        err = res.get("stderr") or "SSH 9Router fallback failed"
        return False, err[:240], target_model, "", False
    try:
        parsed = json.loads(res["stdout"].splitlines()[-1])
        return (
            bool(parsed.get("ok")),
            str(parsed.get("text") or "Unknown 9Router SSH error"),
            str(parsed.get("model") or target_model),
            str(parsed.get("key") or ""),
            bool(parsed.get("saw_auth", False)),
        )
    except Exception as exc:
        return False, _format_exc(exc), target_model, "", False


@app.post("/api/chat", dependencies=[Depends(verify_token)])
async def chat_agent(req: ChatReq):
    global _preferred_router_key
    agent_id = validate_agent_slug(req.agent_id, allow_default=False)
    if agent_id in EXCLUDED_CORE_PROFILES:
        raise HTTPException(
            status_code=403,
            detail="Core Telegram agents (default & vps-guardian) are isolated from this dashboard",
        )
    model = normalize_router_model(req.model)
    active_tasks[agent_id] = {"task": f"HERMES RUNTIME: {model}", "started": time.time()}
    record_blackbox(agent_id, "HERMES", "INFERENCE", f"{model}: {req.message[:70]}")
    t0 = time.perf_counter()

    try:
        # 1. Try executing via real Hermes CLI first so profile gets full Hermes skills & tools
        cli_res = await _try_hermes_cli_chat(agent_id, req.message, req.history, model)
        if cli_res and cli_res.get("reply"):
            latency_ms = int((time.perf_counter() - t0) * 1000)
            return {
                "ok": True,
                "reply": str(cli_res["reply"]),
                "model": str(cli_res.get("model") or model),
                "latency_ms": latency_ms,
                "runtime": "hermes-cli",
                "tools_enabled": True,
            }

        # 2. Automatic fallback to 9Router direct completion (VPS 2 tunnel + automatic SSH fallback)
        active_tasks[agent_id] = {"task": f"9ROUTER: {model}", "started": time.time()}
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

        async def _try_keys(candidate_keys: List[str], target_model: str):
            last_err = "No valid 9Router API key found"
            saw_auth_err = False
            saw_network_err = False
            timeout_cfg = httpx.Timeout(connect=5.0, read=65.0, write=15.0, pool=5.0)
            async with httpx.AsyncClient(timeout=timeout_cfg) as client:
                for api_key in candidate_keys:
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "x-api-key": api_key,
                        "Content-Type": "application/json",
                    }
                    try:
                        resp = await client.post(
                            f"{UPSTREAM_ENDPOINTS['nine_router']}/v1/chat/completions",
                            headers=headers,
                            json={"model": target_model, "messages": messages},
                        )
                    except httpx.HTTPError as exc:
                        last_err = _format_exc(exc)
                        saw_network_err = True
                        break

                    try:
                        data = resp.json()
                    except Exception:
                        data = None

                    if resp.status_code < 400 and isinstance(data, dict) and data.get("choices"):
                        choice0 = data["choices"][0] if isinstance(data["choices"], list) and data["choices"] else {}
                        msg_obj = choice0.get("message", {}) if isinstance(choice0, dict) else {}
                        content = msg_obj.get("content")
                        if content is not None:
                            return True, str(content), str(data.get("model", target_model)), api_key, False

                    err_msg = _extract_router_error(data, resp.status_code, resp.text)
                    last_err = err_msg
                    if _is_auth_error(resp.status_code, data):
                        saw_auth_err = True
                        continue
                    return False, err_msg, target_model, "", False

            if saw_network_err:
                record_blackbox(
                    agent_id,
                    "9ROUTER",
                    "SSH_FALLBACK",
                    f"Tunnel error ({last_err[:100]}), retrying 9Router directly on hermesagent",
                    level="WARN",
                )
                return await _call_9router_chat_via_ssh(candidate_keys, target_model, messages)

            return False, last_err, target_model, "", saw_auth_err

        ok, result_text, used_model, winning_key, saw_auth_err = await _try_keys(ctx.get("keys", []), model)

        if not ok and saw_auth_err:
            _preferred_router_key = ""
            fresh_ctx = await _discover_chat_context(agent_id, force_refresh=True)
            ctx = fresh_ctx
            ok, result_text, used_model, winning_key, _ = await _try_keys(fresh_ctx.get("keys", []), model)

        # Fallback chain: if chosen model failed, try real ~/.hermes/config.yaml default model and combo-best
        fallback_models: List[str] = []
        hermes_def = str(ctx.get("default_model") or "").strip()
        if hermes_def and MODEL_ID_RE.match(hermes_def) and hermes_def != model:
            fallback_models.append(hermes_def)
        if model != "combo-best" and "combo-best" not in fallback_models:
            fallback_models.append("combo-best")

        for fb_model in fallback_models:
            if ok:
                break
            model = fb_model
            active_tasks[agent_id] = {"task": f"9ROUTER: {fb_model}", "started": time.time()}
            ok, result_text, used_model, winning_key, _ = await _try_keys(ctx.get("keys", []), fb_model)

        if not ok:
            clean_err = result_text.strip() or "9Router did not return a reply"
            record_blackbox(agent_id, "9ROUTER", "ERROR", clean_err[:180], level="ERROR")
            raise HTTPException(
                status_code=502,
                detail=f"9Router ({model}): {clean_err}",
            )

        _preferred_router_key = winning_key
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return {
            "ok": True,
            "reply": result_text,
            "model": used_model,
            "latency_ms": latency_ms,
            "runtime": "9router-direct",
            "tools_enabled": False,
        }
    except HTTPException:
        raise
    except Exception as exc:
        err_desc = _format_exc(exc)
        record_blackbox(agent_id, "9ROUTER", "ERROR", err_desc[:180], level="ERROR")
        raise HTTPException(status_code=502, detail=f"9Router error ({model}): {err_desc}")
    finally:
        active_tasks.pop(agent_id, None)


@app.post("/api/voice/speak", dependencies=[Depends(verify_token)])
async def voice_speak(req: VoiceReq):
    raw_id = (req.agent_id or "operator").strip().lower()
    agent_id = "operator" if raw_id in EXCLUDED_CORE_PROFILES else validate_agent_slug(raw_id, allow_default=False)
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
        err_desc = _format_exc(exc)
        record_blackbox(agent_id, "VOICE", "ERROR", err_desc[:180], level="ERROR")
        raise HTTPException(status_code=502, detail=f"VoiceStudio error: {err_desc}")
    finally:
        active_tasks.pop(agent_id, None)


@app.post("/api/shell", dependencies=[Depends(verify_token)])
async def run_shell(req: ShellReq):
    raw_id = (req.agent_id or "operator").strip().lower()
    agent_id = "operator" if raw_id in EXCLUDED_CORE_PROFILES else validate_agent_slug(raw_id, allow_default=False)
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
    has_token = _token_matches(token)
    has_cookie = _cookie_matches(ws.cookies.get(SESSION_COOKIE_NAME))
    if not has_token:
        origin = ws.headers.get("origin")
        host = ws.headers.get("x-forwarded-host") or ws.headers.get("host")
        if not (has_cookie and _is_trusted_origin(origin, host)):
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
async def serve_root(request: Request, token: Optional[str] = Query(None)):
    index_dist = DIST_DIR / "index.html"
    if index_dist.is_file():
        resp: Response = FileResponse(index_dist)
    else:
        legacy = BASE_DIR / "index.html"
        if legacy.is_file():
            resp = HTMLResponse(legacy.read_text(encoding="utf-8"))
        else:
            raise HTTPException(status_code=503, detail="NEXORA frontend bundle not built yet")
    if token and _token_matches(token.strip()):
        _set_session_cookie(resp, request)
    return resp


@app.get("/{full_path:path}")
async def serve_spa_fallback(request: Request, full_path: str, token: Optional[str] = Query(None)):
    if full_path.startswith("api/") or full_path == "ws":
        raise HTTPException(status_code=404, detail="Not found")
    candidate = (DIST_DIR / full_path).resolve()
    if DIST_DIR.is_dir() and str(candidate).startswith(str(DIST_DIR.resolve()) + os.sep) and candidate.is_file():
        return FileResponse(candidate)
    index_dist = DIST_DIR / "index.html"
    if index_dist.is_file():
        resp: Response = FileResponse(index_dist)
        if token and _token_matches(token.strip()):
            _set_session_cookie(resp, request)
        return resp
    raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn

    record_blackbox("default", "BRIDGE", "BOOT", f"NEXORA 3.0 Command Node online -> {MAIN_VPS_IP}")
    uvicorn.run(app, host="0.0.0.0", port=BRIDGE_PORT)
