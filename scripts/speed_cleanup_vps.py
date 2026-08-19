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
    s.put(ROOT + r"\src\lib\store.ts", "/var/www/connect-pro/web/src/lib/store.ts")
    s.put(ROOT + r"\next.config.ts", "/var/www/connect-pro/web/next.config.ts")
    s.put(ROOT + r"\scripts\nginx-connect-pro.conf", "/etc/nginx/sites-available/connect-pro")
    s.close()
    run(
        c,
        "rm -f /var/www/connect-pro/web/data/store.json /tmp/connect-pro-web.tgz /tmp/cp-db.tgz "
        "/var/www/connect-pro/web/scripts/deploy_vps.py /var/www/connect-pro/web/scripts/deploy_postgres.py",
    )
    run(c, "nginx -t && systemctl reload nginx")
    run(c, "cd /var/www/connect-pro/web && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 4; curl -sI http://127.0.0.1:3000/login | head -12")
    run(c, "test ! -f /var/www/connect-pro/web/data/store.json && echo JSON_GONE")
    run(
        c,
        "sudo -u postgres psql -d connectpro -c \"SELECT length(coalesce(avatar_url,'')) AS n, name FROM users ORDER BY 1 DESC LIMIT 5;\"",
    )
    print("CLEAN_FAST")
    c.close()


if __name__ == "__main__":
    main()
