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
cmd = r"""
cd /var/www/connect-pro/web
# Search built output for DATABASE_URL string or empty checks related to pool
find .next/server -name '*.js' -print0 | xargs -0 grep -l 'live_sessions' 2>/dev/null | head -10
echo '---'
find .next/server -name '*.js' -print0 | xargs -0 grep -n 'live_sessions' 2>/dev/null | head -5
echo '---'
# See how DATABASE_URL appears in any server chunk mentioning connectpro or 5432
find .next/server -name '*.js' -print0 | xargs -0 grep -n '5432\|DATABASE_URL\|usingPostgres' 2>/dev/null | head -40
echo '---'
# Quick runtime: ask node to import built module is hard; instead add temporary check via curl after we patch
# Check if next replaced env: look for postgresql:// in .next
find .next -name '*.js' -print0 | xargs -0 grep -l 'postgresql://' 2>/dev/null | head -5
"""
_i, o, e = c.exec_command(cmd, timeout=120)
print(o.read().decode("utf-8", "replace")[:8000], flush=True)
print(e.read().decode("utf-8", "replace")[:2000], flush=True)
c.close()
