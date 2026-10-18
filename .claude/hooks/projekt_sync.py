#!/usr/bin/env python3
"""
Hält das Notion-Board "Projekte" aus Claude Code heraus aktuell.

Aufrufe:
  projekt_sync.py start   # SessionStart-Hook: Status Aktiv, Account eintragen, Zeitstempel
  projekt_sync.py touch   # Stop-Hook: Zeitstempel + Letzter Kontext
  projekt_sync.py end     # SessionEnd-Hook: Zeitstempel + Letzter Kontext
  projekt_sync.py sweep   # Launchd täglich: Aktiv -> Pausiert nach INACTIVE_HOURS ohne Aktivität

Liest NOTION_TOKEN aus ~/.config/notion-projekte/env (Zeile: NOTION_TOKEN=secret_...).
Hooks bekommen das Event-JSON auf stdin (cwd, transcript_path, ...).
"""
import json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

DATABASE_ID = "712283de224a4d159a0d63db82c5152d"
INACTIVE_HOURS = 24
ACCOUNTS = {
    "mail@paulschoettler.de": "paulschoettler",
    "info@abimanufaktur.de": "abimanufaktur",
}
ENV_FILE = Path.home() / ".config" / "notion-projekte" / "env"
LOG_FILE = Path.home() / ".config" / "notion-projekte" / "sync.log"


def log(msg):
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(f"{datetime.now().isoformat(timespec='seconds')} {msg}\n")
    except Exception:
        pass


def load_token():
    if os.environ.get("NOTION_TOKEN"):
        return os.environ["NOTION_TOKEN"]
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith("NOTION_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


TOKEN = load_token()


def notion(method, path, body=None):
    req = urllib.request.Request(
        f"https://api.notion.com/v1{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        log(f"HTTP {e.code} {path}: {e.read().decode()[:300]}")
        return None
    except Exception as e:
        log(f"Fehler {path}: {e}")
        return None


def current_account():
    """Ermittelt den eingeloggten Claude-Account über ~/.claude.json (bzw. CLAUDE_CONFIG_DIR)."""
    if os.environ.get("CLAUDE_ACCOUNT"):
        return os.environ["CLAUDE_ACCOUNT"]
    cfg_dir = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))
    for candidate in (cfg_dir / ".claude.json", Path.home() / ".claude.json"):
        try:
            data = json.loads(candidate.read_text())
            email = (data.get("oauthAccount") or {}).get("emailAddress", "")
            if email in ACCOUNTS:
                return ACCOUNTS[email]
            if email:
                return email.split("@")[0]
        except Exception:
            continue
    return "unbekannt"


def project_key(cwd):
    """Projekt-Key = Inhalt von .claude-project im Repo, sonst Ordnername."""
    p = Path(cwd)
    for d in [p, *p.parents]:
        f = d / ".claude-project"
        if f.exists():
            return f.read_text().strip()
        if (d / ".git").exists():
            return d.name
    return p.name


def find_page(key):
    res = notion("POST", f"/databases/{DATABASE_ID}/query", {
        "filter": {"property": "Projekt-Key", "rich_text": {"equals": key}},
        "page_size": 1,
    })
    if res and res.get("results"):
        return res["results"][0]
    return None


def rich(text):
    return {"rich_text": [{"text": {"content": text[:1900]}}]}


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def last_assistant_text(transcript_path):
    """Letzte Assistant-Nachricht aus dem JSONL-Transkript, auf einen Satz gekürzt."""
    try:
        last = ""
        with open(transcript_path) as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                if obj.get("type") != "assistant":
                    continue
                content = obj.get("message", {}).get("content", [])
                if isinstance(content, str):
                    last = content
                else:
                    texts = [c.get("text", "") for c in content if c.get("type") == "text"]
                    if texts:
                        last = " ".join(texts)
        last = " ".join(last.split())
        return last[:200]
    except Exception:
        return ""


def read_event():
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def cmd_start(event):
    cwd = event.get("cwd") or os.getcwd()
    key = project_key(cwd)
    account = current_account()
    page = find_page(key)
    if not page:
        # Diese Ausgabe landet bei SessionStart im Kontext von Claude Code.
        print(f"[notion-projekte] Kein Projekt mit Projekt-Key '{key}' im Notion-Board gefunden. "
              f"Frag Paul, ob du es anlegen sollst (Name, Typ, Priorität), und erinnere ihn an die Konvention: "
              f"Projekt-Key = Ordnername des Repos oder Inhalt der Datei .claude-project.")
        log(f"start: kein Match für {key}")
        return
    existing = [o["name"] for o in page["properties"]["Aktiver Account"]["multi_select"]]
    accounts = sorted(set(existing + [account]))
    props = {
        "Status": {"select": {"name": "Aktiv"}},
        "Aktiver Account": {"multi_select": [{"name": a} for a in accounts]},
        "Zuletzt aktiv": {"date": {"start": now_iso()}},
    }
    if not page["properties"]["Repo-Pfad"]["rich_text"]:
        props["Repo-Pfad"] = rich(cwd)
    notion("PATCH", f"/pages/{page['id']}", {"properties": props})
    name = "".join(t["plain_text"] for t in page["properties"]["Name"]["title"])
    print(f"[notion-projekte] Projekt '{name}' ist jetzt Aktiv ({account}).")
    log(f"start: {key} -> Aktiv ({account})")


def cmd_touch(event, with_context=True):
    cwd = event.get("cwd") or os.getcwd()
    key = project_key(cwd)
    page = find_page(key)
    if not page:
        return
    props = {"Zuletzt aktiv": {"date": {"start": now_iso()}}}
    if with_context and event.get("transcript_path"):
        ctx = last_assistant_text(event["transcript_path"])
        if ctx:
            props["Letzter Kontext"] = rich(f"{datetime.now():%d.%m. %H:%M} {current_account()}: {ctx}")
    notion("PATCH", f"/pages/{page['id']}", {"properties": props})
    log(f"touch: {key}")


def cmd_sweep():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=INACTIVE_HOURS)
    res = notion("POST", f"/databases/{DATABASE_ID}/query", {
        "filter": {"property": "Status", "select": {"equals": "Aktiv"}},
        "page_size": 100,
    })
    if not res:
        return
    for page in res.get("results", []):
        typ = (page["properties"]["Typ"]["select"] or {}).get("name")
        if typ == "Extern":
            continue  # externe Projekte werden nur manuell gepflegt
        last = page["properties"]["Zuletzt aktiv"]["date"]
        if not last:
            continue  # noch nie von einem Hook berührt, also manuell gesetzt
        last_dt = datetime.fromisoformat(last["start"].replace("Z", "+00:00"))
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if last_dt < cutoff:
            notion("PATCH", f"/pages/{page['id']}", {"properties": {
                "Status": {"select": {"name": "Pausiert"}},
                "Aktiver Account": {"multi_select": []},
            }})
            name = "".join(t["plain_text"] for t in page["properties"]["Name"]["title"])
            log(f"sweep: {name} -> Pausiert")


def main():
    if not TOKEN:
        log("Kein NOTION_TOKEN gefunden")
        return
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "start":
        cmd_start(read_event())
    elif cmd == "touch":
        cmd_touch(read_event())
    elif cmd == "end":
        cmd_touch(read_event())
    elif cmd == "sweep":
        cmd_sweep()
    else:
        print(__doc__)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"Unerwarteter Fehler: {e}")
    sys.exit(0)  # Hooks dürfen Claude Code nie blockieren
