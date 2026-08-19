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
cmds = [
    "sudo -u postgres psql -lqt",
    "ls -la /var/www/connect-pro/web/.env* 2>/dev/null; cat /var/www/connect-pro/web/.env.local 2>/dev/null | sed 's/PASSWORD=.*/PASSWORD=***/;s/SECRET=.*/SECRET=***/'",
    "systemctl show connect-pro -p Environment -p EnvironmentFiles -p ExecStart",
    "ls /etc/systemd/system/connect-pro* 2>/dev/null; cat /etc/systemd/system/connect-pro.service 2>/dev/null",
]
for cmd in cmds:
    print(">>", cmd[:80], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", "replace"), flush=True)
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err, flush=True)
c.close()
