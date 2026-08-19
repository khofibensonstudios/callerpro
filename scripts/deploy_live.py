import os
import tarfile
import io
import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    "src/lib/live.ts",
    "src/lib/db/schema.ts",
    "src/lib/db/pool.ts",
    "src/components/CreateFlow.tsx",
    "src/components/LiveHostStudio.tsx",
    "src/components/LiveViewer.tsx",
    "src/components/LiveNowRow.tsx",
    "src/app/page.tsx",
    "src/app/api/live/route.ts",
    "src/app/api/live/[id]/route.ts",
    "src/app/api/live/[id]/signal/route.ts",
    "src/app/live/go/page.tsx",
    "src/app/live/[id]/page.tsx",
]


def run(c, cmd, timeout=900):
    print(">>", cmd[:160], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-5000:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")


def main():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in FILES:
            full = os.path.join(ROOT, *rel.split("/"))
            tar.add(full, arcname=rel)
    buf.seek(0)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    s = c.open_sftp()
    s.putfo(buf, "/tmp/cp-live.tgz")
    s.close()
    run(c, "tar -xzf /tmp/cp-live.tgz -C /var/www/connect-pro/web")
    run(c, "cd /var/www/connect-pro/web && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 4; curl -sI http://127.0.0.1:3000/live/go | head -8; curl -s http://127.0.0.1:3000/api/live | head -c 200; echo")
    print("LIVE_READY")
    c.close()


if __name__ == "__main__":
    main()
