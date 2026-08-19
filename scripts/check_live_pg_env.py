import paramiko
import time
import json
import urllib.request
import http.cookiejar

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
# Check whether node process sees DATABASE_URL and whether live uses postgres
cmd = r"""
cd /var/www/connect-pro/web && node -e "
require('dotenv').config({path:'.env.local'});
console.log('dotenv_url', process.env.DATABASE_URL ? 'yes' : 'no');
" 2>/dev/null || true
cd /var/www/connect-pro/web && node <<'NODE'
const {execSync}=require('child_process');
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const line=env.split(/\n/).find(l=>l.startsWith('DATABASE_URL='));
console.log('file_has_db', !!line);
NODE
# Inspect live module path by curling after a synthetic insert via psql then list API
sudo -u postgres psql -d connectpro -c "\d live_sessions"
# Check if Next has DATABASE_URL in process - dump from /proc
PID=$(systemctl show -p MainPID --value connect-pro); echo PID=$PID; tr '\0' '\n' < /proc/$PID/environ 2>/dev/null | grep -E 'DATABASE|NODE' || true
# child next pid
pgrep -P $PID -a; for p in $(pgrep -P $PID); do echo --- $p; tr '\0' '\n' < /proc/$p/environ 2>/dev/null | grep DATABASE || true; for c in $(pgrep -P $p); do echo child $c; tr '\0' '\n' < /proc/$c/environ 2>/dev/null | grep DATABASE || true; done; done
"""
_i, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode("utf-8", "replace"), flush=True)
print(e.read().decode("utf-8", "replace"), flush=True)
c.close()
