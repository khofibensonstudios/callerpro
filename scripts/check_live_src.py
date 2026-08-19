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
sed -n '183,240p' /var/www/connect-pro/web/src/lib/live.ts
echo '==== ROUTE ===='
cat /var/www/connect-pro/web/src/app/api/live/route.ts
echo '==== extract startLive from bundle ===='
# Pull a window around INSERT INTO live_sessions from the chunk that has it
FILE=$(find /var/www/connect-pro/web/.next/server -name '*.js' -print0 | xargs -0 grep -l 'INSERT INTO live_sessions' | head -1)
echo FILE=$FILE
# Show whether usingPostgres gates it - get 500 chars before INSERT
python3 - <<PY
import pathlib
p=pathlib.Path("$FILE")
t=p.read_text(errors='replace')
i=t.find('INSERT INTO live_sessions')
print(t[max(0,i-800):i+200])
PY
"""
_i, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode("utf-8", "replace")[:12000], flush=True)
print(e.read().decode("utf-8", "replace")[:2000], flush=True)
c.close()
