import io
import os
import secrets
import tarfile
import paramiko

HOST = "67.217.59.81"
USER = "root"
PASSWORD = "3040064@Reno"
LOCAL_WEB = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
REMOTE_DIR = "/var/www/connect-pro"
JWT = secrets.token_urlsafe(48)
SITE = "http://67.217.59.81"
SKIP = {"node_modules", ".next", ".git", ".turbo"}


def ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    return c


def run(c, cmd, timeout=600):
    print(">>", cmd[:200])
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:].encode("utf-8", "replace").decode("utf-8", "replace"))
    if code != 0:
        print(err[-4000:].encode("utf-8", "replace").decode("utf-8", "replace"))
        raise SystemExit(f"cmd failed {code}: {cmd}")
    return out


def make_tar(path):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in SKIP]
            for name in files:
                if name in {".env.local", "deploy_vps.py"}:
                    continue
                full = os.path.join(root, name)
                rel = os.path.relpath(full, path).replace("\\", "/")
                tar.add(full, arcname=rel)
    buf.seek(0)
    return buf


def main():
    c = ssh()
    run(c, "uname -a; free -h; df -h / | tail -1; nproc")
    run(
        c,
        "export DEBIAN_FRONTEND=noninteractive; "
        "apt-get update -y; "
        "apt-get install -y nginx curl ca-certificates gnupg tar; "
        "if ! command -v node >/dev/null; then "
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; "
        "apt-get install -y nodejs; fi; "
        "node -v; npm -v; "
        "if [ ! -f /swapfile ]; then "
        "fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048; "
        "chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile; "
        "grep -q swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab; fi; "
        "free -h",
        timeout=300,
    )
    run(c, f"mkdir -p {REMOTE_DIR}/web")
    print("packing and uploading web/")
    buf = make_tar(LOCAL_WEB)
    print("tar bytes", buf.getbuffer().nbytes)
    sftp = c.open_sftp()
    sftp.putfo(buf, "/tmp/connect-pro-web.tgz")
    sftp.close()
    run(c, f"rm -rf {REMOTE_DIR}/web && mkdir -p {REMOTE_DIR}/web && tar -xzf /tmp/connect-pro-web.tgz -C {REMOTE_DIR}/web")
    env = (
        f"JWT_SECRET={JWT}\n"
        f"NEXT_PUBLIC_SITE_URL={SITE}\n"
        "NODE_ENV=production\n"
        "PORT=3000\n"
    )
    run(c, f"cat > {REMOTE_DIR}/web/.env.local <<'EOF'\n{env}EOF")
    run(
        c,
        f"cd {REMOTE_DIR}/web && npm install && npm run build",
        timeout=900,
    )
    unit = f"""[Unit]
Description=Connect Pro
After=network.target

[Service]
Type=simple
WorkingDirectory={REMOTE_DIR}/web
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=-{REMOTE_DIR}/web/.env.local
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=4

[Install]
WantedBy=multi-user.target
"""
    run(c, "cat > /etc/systemd/system/connect-pro.service <<'EOF'\n" + unit + "EOF")
    nginx = r"""
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
"""
    run(c, "cat > /etc/nginx/sites-available/connect-pro <<'EOF'\n" + nginx + "EOF")
    run(
        c,
        "rm -f /etc/nginx/sites-enabled/default; "
        "ln -sfn /etc/nginx/sites-available/connect-pro /etc/nginx/sites-enabled/connect-pro; "
        "nginx -t; "
        "systemctl daemon-reload; "
        "systemctl enable --now connect-pro nginx; "
        "systemctl restart connect-pro nginx; "
        "sleep 2; "
        "systemctl is-active connect-pro nginx; "
        "curl -sI http://127.0.0.1:3000 | head -8; "
        "curl -sI http://127.0.0.1 | head -8",
        timeout=60,
    )
    print("DONE", SITE)
    c.close()


if __name__ == "__main__":
    main()
