import io
import os
import tarfile
import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
REMOTE = "/var/www/connect-pro/web"
SKIP_DIRS = {"node_modules", ".next", ".git", ".turbo", "data"}


def env_value(value):
    if any(ch in value for ch in " $\n#'\""):
        return "'" + value.replace("'", "'\"'\"'") + "'"
    return value


def local_ops_env():
    path = os.path.join(ROOT, ".env.local")
    vals = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
                value = value[1:-1]
            if key in {"OPS_GATE_PATH", "OPS_EMAIL", "OPS_PASSWORD_HASH", "OPS_JWT_SECRET", "OLLAMA_HOST", "OLLAMA_MODEL"}:
                vals[key] = value
    return vals


def upsert_ops_env(c, vals):
    remote = f"{REMOTE}/.env.local"
    s = c.open_sftp()
    try:
        with s.file(remote, "r") as fh:
            text = fh.read().decode("utf-8", "replace")
    except FileNotFoundError:
        text = ""
    lines = text.splitlines()
    keys = set(vals)
    out = []
    seen = set()
    for line in lines:
        raw = line.strip()
        if raw and not raw.startswith("#") and "=" in raw:
            key = raw.split("=", 1)[0]
            if key == "OPS_PASSWORD":
                continue
            if key in keys:
                out.append(f"{key}={env_value(vals[key])}")
                seen.add(key)
                continue
        out.append(line)
    for key, value in vals.items():
        if key not in seen:
            out.append(f"{key}={env_value(value)}")
    body = "\n".join(out).rstrip() + "\n"
    with s.file(remote, "w") as fh:
        fh.write(body)
    s.close()
    print("ops env keys", ",".join(sorted(vals)), flush=True)


def make_tar():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        src = os.path.join(ROOT, "src")
        for dirpath, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for name in files:
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, ROOT).replace("\\", "/")
                tar.add(full, arcname=rel)
        for extra in ("next.config.ts",):
            tar.add(os.path.join(ROOT, extra), arcname=extra)
    buf.seek(0)
    return buf


def run(c, cmd, timeout=900):
    print(">>", cmd[:180], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-4000:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")


def main():
    buf = make_tar()
    print("tar bytes", buf.getbuffer().nbytes, flush=True)
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
    s.putfo(buf, "/tmp/connect-pro-src.tgz")
    s.close()
    run(c, f"tar -xzf /tmp/connect-pro-src.tgz -C {REMOTE}")
    run(c, f"rm -f {REMOTE}/src/components/SettingsSheet.tsx")
    upsert_ops_env(c, local_ops_env())
    run(c, f"rm -f {REMOTE}/.next/lock; cd {REMOTE} && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 3; systemctl is-active connect-pro")
    print("LIVE_OK")
    c.close()


if __name__ == "__main__":
    main()
