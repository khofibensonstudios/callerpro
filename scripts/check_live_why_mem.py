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
# Are real users only in PG?
sudo -u postgres psql -d connectpro -c "SELECT COUNT(*) FROM users;"
# store.json?
ls -la /var/www/connect-pro/web/data/store.json 2>/dev/null
python3 - <<'PY'
import json,os
p='/var/www/connect-pro/web/data/store.json'
if os.path.exists(p):
  db=json.load(open(p))
  print('store users', len(db.get('users',[])), [u.get('email') for u in db.get('users',[])][:20])
else:
  print('no store.json')
PY

# Runtime env as seen by next - inject a tiny debug via node attaching? 
# Evaluate: does next rewrite process.env to empty for DATABASE_URL?
cd /var/www/connect-pro/web
node <<'NODE'
// Mimic next server env filtering? Just print
console.log('direct', !!process.env.DATABASE_URL, (process.env.DATABASE_URL||'').slice(0,30));
NODE

# Look in live compiled code for usingPostgres branch - search sessions Map
find .next/server -name '*.js' -print0 | xargs -0 grep -n 'status = .live.|mem\.sessions|new Map' 2>/dev/null | grep -i live | head -30

# Extract how startLiveSession decides - search INSERT INTO live_sessions in built files
find .next/server -name '*.js' -print0 | xargs -0 grep -n 'INSERT INTO live_sessions' 2>/dev/null | head
"""
_i, o, e = c.exec_command(cmd, timeout=120)
print(o.read().decode("utf-8", "replace")[:10000], flush=True)
print(e.read().decode("utf-8", "replace")[:3000], flush=True)
c.close()
