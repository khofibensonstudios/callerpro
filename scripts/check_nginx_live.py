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
cat /etc/nginx/sites-enabled/connect-pro
echo '===='
ps aux | grep -E 'next|node|connect' | grep -v grep
echo '===='
# Prove whether Next process.env.DATABASE_URL is visible to the app by hitting a one-line patch
# Write a tiny debug route file and we'll deploy properly instead
"""
_i, o, e = c.exec_command(cmd, timeout=30)
print(o.read().decode("utf-8", "replace")[:8000], flush=True)
c.close()
