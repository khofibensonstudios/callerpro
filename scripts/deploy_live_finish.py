import paramiko
import time
import os

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    "src/lib/live-webrtc.ts",
    "src/lib/live.ts",
    "src/components/LiveViewer.tsx",
    "src/components/LiveHostStudio.tsx",
    "src/components/LiveStageChrome.tsx",
    "src/components/SiteChrome.tsx",
]


def connect():
    last = None
    for i in range(8):
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            c.connect(
                HOST,
                username="root",
                password=PASSWORD,
                timeout=90,
                banner_timeout=120,
                auth_timeout=90,
                allow_agent=False,
                look_for_keys=False,
            )
            return c
        except Exception as e:
            last = e
            print("retry", i + 1, e, flush=True)
            time.sleep(2 + i)
    raise last


def run(c, cmd, timeout=900):
    print(">>", cmd[:160], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-4500:], flush=True)
    return code


c = connect()
s = c.open_sftp()
for rel in FILES:
    s.put(os.path.join(ROOT, rel.replace("/", os.sep)), "/var/www/connect-pro/web/" + rel)
    print("up", rel, flush=True)
s.close()

run(
    c,
    "pkill -f 'next build' || true; pkill -f 'npm run build' || true; "
    "rm -rf /var/www/connect-pro/web/.next/lock /tmp/coturn_install.log 2>/dev/null; "
    "killall apt-get apt 2>/dev/null || true; sleep 2; echo cleaned",
    60,
)

code = run(c, "cd /var/www/connect-pro/web && set -a && . ./.env.local && set +a && npm run build", 900)
if code != 0:
    raise SystemExit(code)
run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro", 60)

# coturn if possible
run(
    c,
    "if ! command -v turnserver >/dev/null; then "
    "  DEBIAN_FRONTEND=noninteractive apt-get install -y coturn; "
    "fi; "
    "echo TURNSERVER_ENABLED=1 > /etc/default/coturn; "
    "systemctl enable coturn; systemctl restart coturn; sleep 1; "
    "systemctl is-active coturn; ss -ulnp | grep 3478 || true; "
    "ufw allow 3478/udp || true; ufw allow 3478/tcp || true; "
    "ufw allow 49160:49200/udp || true",
    400,
)
print("DEPLOY_OK", flush=True)
c.close()
