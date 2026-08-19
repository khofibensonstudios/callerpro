import paramiko
import time
import json
import urllib.request
import http.cookiejar
import ssl

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
BASE = f"https://{HOST}"

ctx = ssl._create_unverified_context()
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cj),
    urllib.request.HTTPSHandler(context=ctx),
)

def req(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with opener.open(r, timeout=60) as res:
        return res.status, json.loads(res.read().decode())

print("login...", flush=True)
st, login = req("POST", "/api/auth/login", {"email": "aisha@connect.pro", "password": "demo1234"})
print("login", st, login.get("user", {}).get("id"), login.get("user", {}).get("name"), flush=True)

print("start live...", flush=True)
st, live = req("POST", "/api/live", {"title": "Probe live"})
print("start", st, live, flush=True)

print("list live...", flush=True)
st, listing = req("GET", "/api/live")
print("list", st, listing, flush=True)

# check db via ssh
def connect():
    last = None
    for i in range(6):
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            c.connect(HOST, username="root", password=PASSWORD, timeout=90, banner_timeout=120, auth_timeout=90, allow_agent=False, look_for_keys=False)
            return c
        except Exception as e:
            last = e
            time.sleep(2 + i)
    raise last

c = connect()
_i, o, e = c.exec_command(
    'sudo -u postgres psql -d connectpro -c "SELECT id, host_id, title, status FROM live_sessions ORDER BY started_at DESC LIMIT 5;"',
    timeout=30,
)
print("DB rows:", o.read().decode(), e.read().decode(), flush=True)

# end live if created
sid = (live.get("session") or {}).get("id")
if sid:
    st, ended = req("DELETE", f"/api/live/{sid}")
    print("end", st, ended, flush=True)

c.close()
