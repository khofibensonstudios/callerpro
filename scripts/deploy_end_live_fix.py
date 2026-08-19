import paramiko
import os
import time

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    "src/lib/live.ts",
    "src/components/LiveNowRow.tsx",
    "src/components/LiveViewer.tsx",
    "src/components/LiveHostStudio.tsx",
]


def connect():
    last = None
    for i in range(12):
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
    print((out + err)[-4000:], flush=True)
    return code


c = connect()
s = c.open_sftp()
for rel in FILES:
    s.put(os.path.join(ROOT, rel.replace("/", os.sep)), "/var/www/connect-pro/web/" + rel)
    print("up", rel, flush=True)
s.close()
run(c, "rm -f /var/www/connect-pro/web/.next/lock; pkill -f 'next build' || true; sleep 1", 30)
code = run(c, "cd /var/www/connect-pro/web && set -a && . ./.env.local && set +a && npm run build", 900)
if code != 0:
    raise SystemExit(code)
run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro", 60)
# Clear any leftover ghost live rows with no recent heartbeat
run(
    c,
    """sudo -u postgres psql -d connectpro -c "UPDATE live_sessions SET status='ended', ended_at=COALESCE(ended_at, now()) WHERE status='live' AND COALESCE(last_heartbeat_at, started_at) < now() - interval '2 minutes'; SELECT id, status, host_id FROM live_sessions WHERE status='live';" """,
    60,
)
print("DEPLOY_OK")
c.close()
