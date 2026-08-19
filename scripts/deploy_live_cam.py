import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    ("src/lib/live-camera.ts", "/var/www/connect-pro/web/src/lib/live-camera.ts"),
    ("src/components/LiveHostStudio.tsx", "/var/www/connect-pro/web/src/components/LiveHostStudio.tsx"),
    ("src/components/LiveViewer.tsx", "/var/www/connect-pro/web/src/components/LiveViewer.tsx"),
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
    c.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    s = c.open_sftp()
    for rel, remote in FILES:
        s.put(ROOT + "\\" + rel.replace("/", "\\"), remote)
    s.close()
    run(c, "cd /var/www/connect-pro/web && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 3; systemctl is-active connect-pro")
    print("CAM_FIT_READY")
    c.close()


if __name__ == "__main__":
    main()
