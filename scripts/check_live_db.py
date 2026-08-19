import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)

cmds = [
    "sudo -u postgres psql -d connect_pro -c \"SELECT id, host_id, title, status, started_at FROM live_sessions ORDER BY started_at DESC LIMIT 20;\"",
    "sudo -u postgres psql -d connect_pro -c \"SELECT id, name, email FROM users LIMIT 30;\"",
    "curl -sS http://127.0.0.1:3000/api/live | head -c 2000",
]
for cmd in cmds:
    print(">>", cmd[:100])
    _i, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", "replace"))
    err = e.read().decode("utf-8", "replace")
    if err:
        print("ERR", err)
c.close()
