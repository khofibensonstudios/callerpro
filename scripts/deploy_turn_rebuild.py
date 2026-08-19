import paramiko
import time
import os

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"

def connect():
    last = None
    for i in range(8):
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            c.connect(HOST, username="root", password=PASSWORD, timeout=90, banner_timeout=120, auth_timeout=90, allow_agent=False, look_for_keys=False)
            return c
        except Exception as e:
            last = e
            print("retry", i + 1, e, flush=True)
            time.sleep(2 + i)
    raise last

c = connect()
s = c.open_sftp()
s.put(
    r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web\src\lib\live-webrtc.ts",
    "/var/www/connect-pro/web/src/lib/live-webrtc.ts",
)
s.close()
print("uploaded webrtc", flush=True)

cmds = [
    "ls -la $(command -v turnserver) 2>/dev/null; dpkg -l coturn 2>/dev/null | tail -1",
    "pkill -f turnserver || true; sleep 1; "
    "if [ -x /usr/bin/turnserver ]; then "
    "nohup /usr/bin/turnserver -n --log-file=/var/log/turnserver.log -p 3478 -r 67.217.59.81 -X 67.217.59.81 "
    "--lt-cred-mech --user=connectpro:CpLiveTurn2026! --min-port=49160 --max-port=49200 --no-tls --no-dtls --no-cli "
    ">/var/log/turnserver.out 2>&1 & sleep 1; fi; "
    "pgrep -a turnserver; ss -ulnp | grep 3478; tail -20 /var/log/turnserver.out 2>/dev/null; tail -20 /var/log/turnserver.log 2>/dev/null",
    "pkill -f 'next build' || true; rm -f /var/www/connect-pro/web/.next/lock; "
    "cd /var/www/connect-pro/web && set -a && . ./.env.local && set +a && npm run build",
    "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro",
]
for cmd in cmds:
    print(">>", cmd[:120], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=900)
    print(o.read().decode("utf-8", "replace")[-4000:], flush=True)
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err[-1500:], flush=True)
    code = o.channel.recv_exit_status()
    if code != 0 and "npm run build" in cmd:
        raise SystemExit(code)
print("OK")
c.close()
