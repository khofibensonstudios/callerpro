import paramiko
import time

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"

CONF = """listening-ip=0.0.0.0
relay-ip=67.217.59.81
external-ip=67.217.59.81
listening-port=3478
fingerprint
lt-cred-mech
user=connectpro:CpLiveTurn2026!
realm=67.217.59.81
server-name=connect-pro
min-port=49160
max-port=49200
no-cli
no-tls
no-dtls
no-multicast-peers
simple-log
"""

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
with s.file("/etc/turnserver.conf", "w") as f:
    f.write(CONF)
s.close()

cmds = [
    "dpkg --configure -a || true",
    "command -v turnserver || DEBIAN_FRONTEND=noninteractive apt-get install -y coturn",
    "echo TURNSERVER_ENABLED=1 > /etc/default/coturn",
    "systemctl daemon-reload",
    "systemctl restart coturn",
    "sleep 1",
    "systemctl status coturn --no-pager -l | head -40",
    "journalctl -u coturn -n 30 --no-pager",
    "ss -ulnp | grep 3478 || true",
]
for cmd in cmds:
    print(">>", cmd, flush=True)
    _i, o, e = c.exec_command(cmd, timeout=300)
    print(o.read().decode("utf-8", "replace")[-2000:], flush=True)
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err[-1000:], flush=True)
print("TURN_DONE")
c.close()
