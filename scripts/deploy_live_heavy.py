import paramiko
import os
import time

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

TURN_CONF = r"""
listening-port=3478
fingerprint
lt-cred-mech
user=connectpro:CpLiveTurn2026!
realm=67.217.59.81
server-name=connect-pro
external-ip=67.217.59.81
min-port=49160
max-port=49200
no-cli
no-tls
no-dtls
no-multicast-peers
"""


def connect(retries=8):
    last = None
    for i in range(retries):
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
            print(f"ssh retry {i + 1}/{retries}: {e}", flush=True)
            time.sleep(3 + i * 2)
    raise last


def run(c, cmd, timeout=900):
    print(">>", cmd[:180], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-5000:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}: {cmd}")


def main():
    c = connect()
    s = c.open_sftp()
    for rel in FILES:
        local = os.path.join(ROOT, rel.replace("/", os.sep))
        remote = "/var/www/connect-pro/web/" + rel
        s.put(local, remote)
        print("uploaded", rel, flush=True)
    with s.file("/etc/turnserver.conf", "w") as f:
        f.write(TURN_CONF)
    print("wrote turnserver.conf", flush=True)
    s.close()

    run(
        c,
        "export DEBIAN_FRONTEND=noninteractive; "
        "apt-get update -qq && apt-get install -y -qq coturn >/tmp/coturn_install.log 2>&1 || true; "
        "sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true; "
        "grep -q TURNSERVER_ENABLED=1 /etc/default/coturn || echo TURNSERVER_ENABLED=1 >> /etc/default/coturn; "
        "systemctl enable coturn; systemctl restart coturn; sleep 1; systemctl is-active coturn || true; "
        "ufw allow 3478/udp || true; ufw allow 3478/tcp || true; "
        "ufw allow 49160:49200/udp || true; "
        "ss -ulnp | grep 3478 || netstat -ulnp | grep 3478 || true",
        600,
    )
    run(c, "cd /var/www/connect-pro/web && set -a && . ./.env.local && set +a && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro")
    print("DEPLOY_OK")
    c.close()


if __name__ == "__main__":
    main()
