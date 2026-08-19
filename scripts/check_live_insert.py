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
# nginx cache?
grep -R "proxy_cache\|api/live\|connect-pro" /etc/nginx/ 2>/dev/null | head -40
echo '===='
# From inside the next process: read environ of PID 65098
PID=$(pgrep -f 'next start' | head -1); echo nextpid=$PID
tr '\0' '\n' < /proc/$PID/environ | grep DATABASE
echo '===='
# Use node -e with env from systemd to test pool
set -a; source /var/www/connect-pro/web/.env.local; set +a
cd /var/www/connect-pro/web
node <<'NODE'
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const c = await pool.connect();
  try {
    const before = await c.query("SELECT COUNT(*)::int AS n FROM live_sessions");
    console.log('before', before.rows[0]);
    await c.query(
      `INSERT INTO live_sessions (id, host_id, title, status, viewer_count, started_at)
       VALUES ($1,$2,'manual', 'live', 0, now())`,
      ['live_manual_test', 'u_aisha']
    );
    const after = await c.query("SELECT id, host_id, status FROM live_sessions");
    console.log('after', after.rows);
    await c.query("DELETE FROM live_sessions WHERE id='live_manual_test'");
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    c.release();
    await pool.end();
  }
})();
NODE
"""
_i, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode("utf-8", "replace"), flush=True)
print(e.read().decode("utf-8", "replace"), flush=True)
c.close()
