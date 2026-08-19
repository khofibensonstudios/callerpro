import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"


def run(c, cmd, timeout=180):
    print(">>", cmd[:160], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-2000:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")
    return text


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=90)
    run(c, "systemctl is-active ollama")
    run(
        c,
        """curl -sS -m 120 -X POST http://127.0.0.1:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2:latest","prompt":"hi","stream":false,"options":{"num_predict":8}}' \
  | head -c 300""",
        130,
    )
    print("WARM_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
