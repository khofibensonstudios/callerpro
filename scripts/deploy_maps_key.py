import os
import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
REMOTE = "/var/www/connect-pro/web"
KEYS = ("GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY")


def env_value(value):
    if any(ch in value for ch in " $\n#'\""):
        return "'" + value.replace("'", "'\"'\"'") + "'"
    return value


def local_keys():
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
            if key in KEYS and value:
                vals[key] = value
    if not vals:
        raise SystemExit("no maps key in local .env.local")
    return vals


def upsert(c, vals):
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
    print("set", ",".join(sorted(vals)), flush=True)


def run(c, cmd, timeout=120):
    print(">>", cmd[:160], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-2000:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")


def main():
    vals = local_keys()
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
    upsert(c, vals)
    run(c, "systemctl restart connect-pro; sleep 3; systemctl is-active connect-pro")
    print("MAPS_KEY_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
