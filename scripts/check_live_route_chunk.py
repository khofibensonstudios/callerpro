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
# Which server chunks does the live API route use?
find /var/www/connect-pro/web/.next/server -path '*api*live*' 2>/dev/null | head -40
echo '===='
find /var/www/connect-pro/web/.next/server/app/api/live -type f 2>/dev/null | head -40
echo '===='
# read the route entry
find /var/www/connect-pro/web/.next/server -name 'route.js' | xargs grep -l 'startLiveSession\|listLiveSessions' 2>/dev/null | head
echo '===='
ROUTE=$(find /var/www/connect-pro/web/.next/server -path '*app/api/live/route*' | head -1)
echo ROUTE=$ROUTE
# show imports / references
python3 - <<'PY'
import pathlib,re
paths=list(pathlib.Path('/var/www/connect-pro/web/.next/server').rglob('*'))
for p in paths:
  if 'api/live' in str(p).replace('\\\\','/') and p.suffix in {'.js','.json'}:
    print(p)
PY
"""
_i, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode("utf-8", "replace")[:8000], flush=True)
print(e.read().decode("utf-8", "replace")[:2000], flush=True)
c.close()
