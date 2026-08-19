import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"


def run(c, cmd, timeout=900, allow_fail=False):
    print(">>", cmd[:220], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-8000:], flush=True)
    if code != 0 and not allow_fail:
        raise SystemExit(f"fail {code}: {cmd[:140]}")
    return text, code


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
    run(c, "curl --version | head -1; command -v ollama || echo MISSING; free -h | head -2")
    has, _ = run(c, "command -v ollama || echo MISSING")
    if "MISSING" in has:
        run(c, "curl -fsSL https://ollama.com/install.sh | sh", 700)
    else:
        print("ollama already installed", flush=True)

    run(
        c,
        """mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
EOF
systemctl daemon-reload
systemctl enable --now ollama
sleep 3
systemctl is-active ollama
ollama --version
""",
        180,
    )
    listed, _ = run(c, "ollama list")
    if "llama3.2" not in listed:
        run(c, "ollama pull llama3.2:latest", 900)
    else:
        print("llama3.2 already present", flush=True)
    listed, _ = run(c, "ollama list")
    if "qwen2.5-coder" not in listed:
        run(c, "ollama pull qwen2.5-coder:3b", 900)
    else:
        print("qwen2.5-coder already present", flush=True)
    run(c, "ollama list")
    run(c, "curl -sS http://127.0.0.1:11434/api/tags")
    run(
        c,
        """ENV=/var/www/connect-pro/web/.env.local
touch "$ENV"
grep -q '^OLLAMA_HOST=' "$ENV" && sed -i 's|^OLLAMA_HOST=.*|OLLAMA_HOST=http://127.0.0.1:11434|' "$ENV" || echo 'OLLAMA_HOST=http://127.0.0.1:11434' >> "$ENV"
grep -q '^OLLAMA_MODEL=' "$ENV" || echo 'OLLAMA_MODEL=llama3.2:latest' >> "$ENV"
grep OLLAMA "$ENV"
systemctl restart connect-pro || true
systemctl is-active connect-pro || true
""",
        120,
        allow_fail=True,
    )
    print("OLLAMA_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
