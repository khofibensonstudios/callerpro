import os
import secrets
import tarfile
import io
import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
DB_PASS = secrets.token_urlsafe(24)
DB_URL = f"postgresql://connectpro:{DB_PASS}@127.0.0.1:5432/connectpro"


def ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    return c


def run(c, cmd, timeout=900):
    print(">>", cmd[:180], flush=True)
    i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err)[-8000:]
    print(text, flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")
    return out


def main():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in [
            "src/lib/store.ts",
            "src/lib/db/schema.ts",
            "src/lib/db/pool.ts",
            "src/lib/db/persist.ts",
            "src/app/api/posts/route.ts",
            "next.config.ts",
            "package.json",
            "package-lock.json",
        ]:
            full = os.path.join(ROOT, rel.replace("/", os.sep))
            tar.add(full, arcname=rel)
    buf.seek(0)
    print("upload", buf.getbuffer().nbytes)
    c = ssh()
    s = c.open_sftp()
    s.putfo(buf, "/tmp/cp-db.tgz")
    s.close()
    run(c, "tar -xzf /tmp/cp-db.tgz -C /var/www/connect-pro/web")
    run(
        c,
        "export DEBIAN_FRONTEND=noninteractive; apt-get update -y; apt-get install -y postgresql postgresql-contrib; systemctl enable --now postgresql",
        300,
    )
    run(
        c,
        "sudo -u postgres psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='connectpro'\" | grep -q 1 || "
        f"sudo -u postgres psql -c \"CREATE USER connectpro WITH PASSWORD '{DB_PASS}';\"; "
        "sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname='connectpro'\" | grep -q 1 || "
        "sudo -u postgres psql -c 'CREATE DATABASE connectpro OWNER connectpro;'; "
        "sudo -u postgres psql -c 'GRANT ALL PRIVILEGES ON DATABASE connectpro TO connectpro;'",
    )
    run(
        c,
        "grep -q DATABASE_URL /var/www/connect-pro/web/.env.local && "
        f"sed -i 's|^DATABASE_URL=.*|DATABASE_URL={DB_URL}|' /var/www/connect-pro/web/.env.local || "
        f"echo 'DATABASE_URL={DB_URL}' >> /var/www/connect-pro/web/.env.local",
    )
    run(c, "cd /var/www/connect-pro/web && npm install && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 4; systemctl is-active connect-pro; curl -sI http://127.0.0.1:3000 | head -8")
    run(
        c,
        "sudo -u postgres psql -d connectpro -c \"SELECT COUNT(*) AS users FROM users;\" "
        "-c \"SELECT COUNT(*) AS posts FROM posts;\" "
        "-c \"SELECT COUNT(*) AS follows FROM follows;\" "
        "-c \"SELECT COUNT(*) AS messages FROM messages;\"",
    )
    print("PG_READY")
    c.close()


if __name__ == "__main__":
    main()
