import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"


def run(c, cmd, timeout=900):
    print(">>", cmd[:180], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-6000:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    s = c.open_sftp()
    s.put(ROOT + r"\src\components\LiveHostStudio.tsx", "/var/www/connect-pro/web/src/components/LiveHostStudio.tsx")
    s.put(ROOT + r"\scripts\nginx-connect-pro.conf", "/etc/nginx/sites-available/connect-pro")
    s.close()
    run(
        c,
        "mkdir -p /etc/nginx/ssl; "
        "if [ ! -f /etc/nginx/ssl/connect-pro.crt ]; then "
        "openssl req -x509 -nodes -newkey rsa:2048 -days 825 "
        "-keyout /etc/nginx/ssl/connect-pro.key -out /etc/nginx/ssl/connect-pro.crt "
        "-subj '/CN=67.217.59.81' "
        "-addext 'subjectAltName=IP:67.217.59.81'; fi",
    )
    run(
        c,
        "grep -q NEXT_PUBLIC_SITE_URL /var/www/connect-pro/web/.env.local && "
        "sed -i 's|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://67.217.59.81|' /var/www/connect-pro/web/.env.local || "
        "echo 'NEXT_PUBLIC_SITE_URL=https://67.217.59.81' >> /var/www/connect-pro/web/.env.local",
    )
    run(c, "nginx -t && systemctl reload nginx")
    run(c, "cd /var/www/connect-pro/web && npm run build", 900)
    run(
        c,
        "systemctl restart connect-pro; sleep 4; "
        "curl -skI https://127.0.0.1/live/go | head -10; "
        "curl -sI http://127.0.0.1/live/go | head -6",
    )
    print("HTTPS_LIVE_READY")
    c.close()


if __name__ == "__main__":
    main()
