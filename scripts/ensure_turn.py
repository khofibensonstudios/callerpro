import paramiko
import time

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
            time.sleep(2 + i)
    raise last

c = connect()
# Start turn without touching dpkg
cmd = (
    "ss -ulnp | grep 3478 || true; "
    "if ! ss -ulnp | grep -q ':3478'; then "
    "systemd-run --unit=cp-turn /usr/bin/turnserver -n -p 3478 -r 67.217.59.81 -X 67.217.59.81 "
    "--lt-cred-mech --user=connectpro:CpLiveTurn2026! --min-port=49160 --max-port=49200 --no-tls --no-dtls --no-cli; "
    "sleep 2; fi; "
    "ss -ulnp | grep 3478 || true; systemctl is-active connect-pro; "
    "grep -n openrelay /var/www/connect-pro/web/src/lib/live-webrtc.ts | head"
)
_i, o, e = c.exec_command(cmd, timeout=30)
print(o.read().decode())
print(e.read().decode())
c.close()
