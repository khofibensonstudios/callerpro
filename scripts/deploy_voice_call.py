import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    ("src/components/LiveViewer.tsx", "/var/www/connect-pro/web/src/components/LiveViewer.tsx"),
    ("src/components/VoiceCallOverlay.tsx", "/var/www/connect-pro/web/src/components/VoiceCallOverlay.tsx"),
    ("src/app/messages/page.tsx", "/var/www/connect-pro/web/src/app/messages/page.tsx"),
    ("src/lib/chat-call.ts", "/var/www/connect-pro/web/src/lib/chat-call.ts"),
    ("src/lib/db/schema.ts", "/var/www/connect-pro/web/src/lib/db/schema.ts"),
    ("src/lib/db/pool.ts", "/var/www/connect-pro/web/src/lib/db/pool.ts"),
    ("src/app/api/inbox/[id]/call/route.ts", "/var/www/connect-pro/web/src/app/api/inbox/[id]/call/route.ts"),
    ("src/app/api/calls/route.ts", "/var/www/connect-pro/web/src/app/api/calls/route.ts"),
]


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
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
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
    s = c.open_sftp()
    for rel, remote in FILES:
        local = ROOT + "\\" + rel.replace("/", "\\")
        # ensure remote dirs for nested routes
        remote_dir = remote.rsplit("/", 1)[0]
        try:
            s.stat(remote_dir)
        except OSError:
            run(c, f"mkdir -p {remote_dir}")
        s.put(local, remote)
        print("uploaded", rel, flush=True)
    s.close()
    run(c, "rm -f /var/www/connect-pro/web/.next/lock; cd /var/www/connect-pro/web && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro")
    print("VOICE_CALL_AND_LIVE_PIP_READY")
    c.close()


if __name__ == "__main__":
    main()
