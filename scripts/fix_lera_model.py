import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"


def run(c, cmd, timeout=180, allow_fail=False):
    print(">>", cmd[:180], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-3000:], flush=True)
    if code != 0 and not allow_fail:
        print(f"exit {code}", flush=True)
    return text, code


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=90)
    run(c, "free -h; ollama ps 2>/dev/null; journalctl -u ollama -n 15 --no-pager 2>/dev/null | tail -15", 60, True)
    run(c, "ollama stop llama3.2:latest 2>/dev/null; ollama stop qwen2.5-coder:3b 2>/dev/null; sleep 2; ollama ps", 60, True)
    text, code = run(
        c,
        """curl -sS -m 90 -X POST http://127.0.0.1:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen2.5-coder:3b","prompt":"Say hello in five words","stream":false,"options":{"num_predict":16}}'""",
        100,
        allow_fail=True,
    )
    if code != 0 or "error" in text.lower():
        print("qwen failed, trying tiny pull...", flush=True)
        run(c, "ollama pull llama3.2:1b", 600, True)
        run(
            c,
            """curl -sS -m 90 -X POST http://127.0.0.1:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2:1b","prompt":"Say hello","stream":false,"options":{"num_predict":12}}'""",
            100,
            allow_fail=True,
        )
    run(
        c,
        """ENV=/var/www/connect-pro/web/.env.local
sed -i 's|^OLLAMA_MODEL=.*|OLLAMA_MODEL=qwen2.5-coder:3b|' "$ENV"
grep OLLAMA "$ENV"
systemctl restart connect-pro
sleep 2
systemctl is-active connect-pro
""",
        60,
    )
    print("MODEL_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
