import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"


def run(c, cmd, timeout=120):
    print(">>", cmd[:160], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-2500:], flush=True)
    return code, text


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=90)
    run(c, "ollama stop llama3.2:latest 2>/dev/null; ollama stop qwen2.5-coder:3b 2>/dev/null; sleep 2; ollama ps", 60)
    run(
        c,
        """ENV=/var/www/connect-pro/web/.env.local
sed -i 's|^OLLAMA_MODEL=.*|OLLAMA_MODEL=llama3.2:1b|' "$ENV"
grep OLLAMA "$ENV"
""",
        30,
    )
    code, text = run(
        c,
        """curl -sS -m 90 -X POST http://127.0.0.1:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2:1b","prompt":"Say hi briefly","stream":false,"keep_alive":"30m","options":{"num_predict":12}}'""",
        100,
    )
    if code != 0:
        raise SystemExit("warm failed")
    run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro", 30)
    print("LERA_WARM_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
