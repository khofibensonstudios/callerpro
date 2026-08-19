import paramiko
import time

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"

def connect():
    last = None
    for i in range(8):
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
cmds = [
    # Find inlined DATABASE_URL or usingPostgres in built chunks
    "grep -R \"usingPostgres\\|DATABASE_URL\" /var/www/connect-pro/web/.next/server -g '*.js' 2>/dev/null | head -40",
    "grep -R \"live_sessions\" /var/www/connect-pro/web/.next/server -g '*.js' 2>/dev/null | head -20",
    "ls /var/www/connect-pro/web/.next/server/chunks 2>/dev/null | head",
    # Runtime check via a one-off eval against running app by hitting a temp - instead read pool from source on disk
    "grep -n \"databaseUrl\\|usingPostgres\\|process.env\" /var/www/connect-pro/web/src/lib/db/pool.ts",
    "head -c 200 /var/www/connect-pro/web/src/lib/live.ts; echo; grep -n \"usingPostgres\" /var/www/connect-pro/web/src/lib/live.ts | head",
]
for cmd in cmds:
    print(">>", cmd[:100], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", "replace")[:4000], flush=True)
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err[:1000], flush=True)
c.close()
