import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    ("src/lib/db/schema.ts", "/var/www/connect-pro/web/src/lib/db/schema.ts"),
    ("src/lib/db/pool.ts", "/var/www/connect-pro/web/src/lib/db/pool.ts"),
    ("src/lib/live-shared.ts", "/var/www/connect-pro/web/src/lib/live-shared.ts"),
    ("src/lib/live.ts", "/var/www/connect-pro/web/src/lib/live.ts"),
    ("src/lib/types.ts", "/var/www/connect-pro/web/src/lib/types.ts"),
    ("src/app/api/live/[id]/route.ts", "/var/www/connect-pro/web/src/app/api/live/[id]/route.ts"),
    ("src/app/api/friends/route.ts", "/var/www/connect-pro/web/src/app/api/friends/route.ts"),
    ("src/app/api/users/[id]/route.ts", "/var/www/connect-pro/web/src/app/api/users/[id]/route.ts"),
    ("src/components/LiveStageChrome.tsx", "/var/www/connect-pro/web/src/components/LiveStageChrome.tsx"),
    ("src/components/LiveHostStudio.tsx", "/var/www/connect-pro/web/src/components/LiveHostStudio.tsx"),
    ("src/components/LiveViewer.tsx", "/var/www/connect-pro/web/src/components/LiveViewer.tsx"),
    ("src/components/LiveEndSheet.tsx", "/var/www/connect-pro/web/src/components/LiveEndSheet.tsx"),
]


def run(c, cmd, timeout=900):
    print(">>", cmd[:160], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-3500:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username="root",
        password=PASSWORD,
        timeout=60,
        banner_timeout=60,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    s = c.open_sftp()
    for rel, remote in FILES:
        s.put(ROOT + "\\" + rel.replace("/", "\\"), remote)
        print("uploaded", rel, flush=True)
    s.close()
    run(c, "cd /var/www/connect-pro/web && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro")
    print("LIVE_SUMMARY_READY")
    c.close()


if __name__ == "__main__":
    main()
