import paramiko
import time

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"

def connect():
    last = None
    for i in range(6):
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
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
            return c
        except Exception as e:
            last = e
            print("retry", i + 1, e, flush=True)
            time.sleep(2 + i)
    raise last

c = connect()
sql = r"""
SELECT id, host_id, title, status, started_at, ended_at
FROM live_sessions
ORDER BY started_at DESC
LIMIT 25;
"""
sql2 = r"""
SELECT id, name, email FROM users ORDER BY created_at DESC NULLS LAST LIMIT 30;
"""
cmds = [
    f"sudo -u postgres psql -d connectpro -c \"{sql}\"",
    f"sudo -u postgres psql -d connectpro -c \"{sql2}\"",
    "sudo -u postgres psql -d connectpro -c \"SELECT status, COUNT(*) FROM live_sessions GROUP BY status;\"",
    "journalctl -u connect-pro -n 80 --no-pager",
]
for cmd in cmds:
    print(">>", cmd[:90], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", "replace")[-5000:], flush=True)
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err[-2000:], flush=True)
c.close()
