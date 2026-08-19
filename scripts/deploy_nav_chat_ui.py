import paramiko
import os
import time

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    "src/components/SiteChrome.tsx",
    "src/app/page.tsx",
    "src/components/StoriesRow.tsx",
    "src/components/CreateFlow.tsx",
    "src/app/messages/page.tsx",
    "src/components/InAppNotify.tsx",
    "src/components/LiveNowRow.tsx",
    "src/components/LivePresence.tsx",
    "src/components/PresenceBeat.tsx",
]


def connect(retries=5):
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
    print(">>", cmd[:160], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-4000:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")


def main():
    missing = [f for f in FILES if not os.path.isfile(os.path.join(ROOT, f.replace("/", os.sep)))]
    if missing:
        raise SystemExit("missing:\n" + "\n".join(missing))
    c = connect()
    s = c.open_sftp()
    for rel in FILES:
        local = os.path.join(ROOT, rel.replace("/", os.sep))
        remote = "/var/www/connect-pro/web/" + rel
        s.put(local, remote)
        print("uploaded", rel, flush=True)
    s.close()
    run(c, "cd /var/www/connect-pro/web && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro")
    print("DEPLOY_OK")
    c.close()


if __name__ == "__main__":
    main()
