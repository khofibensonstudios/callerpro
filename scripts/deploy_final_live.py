import paramiko
import time
import os

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"

def connect():
    last = None
    for i in range(10):
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            c.connect(HOST, username="root", password=PASSWORD, timeout=90, banner_timeout=120, auth_timeout=90, allow_agent=False, look_for_keys=False)
            return c
        except Exception as e:
            last = e
            print("retry", i + 1, e, flush=True)
            time.sleep(3 + i)
    raise last

def run(c, cmd, timeout=900):
    print(">>", cmd[:140], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err)[-5000:]
    print(text, flush=True)
    return code, text

c = connect()
s = c.open_sftp()
s.put(
    r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web\src\lib\live-webrtc.ts",
    "/var/www/connect-pro/web/src/lib/live-webrtc.ts",
)
with s.file("/etc/turnserver.conf", "w") as f:
    f.write(
        "listening-ip=0.0.0.0\n"
        "external-ip=67.217.59.81\n"
        "listening-port=3478\n"
        "fingerprint\n"
        "lt-cred-mech\n"
        "user=connectpro:CpLiveTurn2026!\n"
        "realm=67.217.59.81\n"
        "min-port=49160\n"
        "max-port=49200\n"
        "no-cli\n"
        "no-tls\n"
        "no-dtls\n"
    )
s.close()

run(c, "export DEBIAN_FRONTEND=noninteractive; dpkg --configure -a", 300)
run(c, "echo TURNSERVER_ENABLED=1 > /etc/default/coturn; systemctl restart coturn; sleep 2; systemctl is-active coturn; ss -ulnp | grep 3478 || true", 60)

# If systemd still broken, start binary in background via systemd-run or screen
run(
    c,
    "if ! ss -ulnp | grep -q 3478; then "
    "systemd-run --unit=cp-turn --working-directory=/ "
    "/usr/bin/turnserver -n -p 3478 -r 67.217.59.81 -X 67.217.59.81 "
    "--lt-cred-mech --user=connectpro:CpLiveTurn2026! "
    "--min-port=49160 --max-port=49200 --no-tls --no-dtls --no-cli; "
    "sleep 1; ss -ulnp | grep 3478 || true; fi",
    60,
)

run(c, "rm -f /var/www/connect-pro/web/.next/lock; pkill -f 'next build' || true; sleep 1; echo ready", 30)
code, _ = run(c, "cd /var/www/connect-pro/web && set -a && . ./.env.local && set +a && npm run build", 900)
if code != 0:
    raise SystemExit(code)
run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro; ss -ulnp | grep 3478 || true", 60)
print("ALL_OK")
c.close()
