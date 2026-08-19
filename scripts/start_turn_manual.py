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
            c.connect(HOST, username="root", password=PASSWORD, timeout=90, banner_timeout=120, auth_timeout=90, allow_agent=False, look_for_keys=False)
            return c
        except Exception as e:
            last = e
            print("retry", i + 1, e, flush=True)
            time.sleep(2 + i)
    raise last

c = connect()
cmd = r"""
# stop stuck package managers lightly
killall -9 apt-get apt dpkg 2>/dev/null || true
# if turnserver binary exists, run it directly (bypass broken systemd unit)
if command -v turnserver >/dev/null 2>&1; then
  pkill -f 'turnserver' || true
  sleep 1
  nohup turnserver -n --log-file=/var/log/turnserver.log \
    -p 3478 \
    -r 67.217.59.81 \
    -X 67.217.59.81 \
    --lt-cred-mech \
    --user=connectpro:CpLiveTurn2026! \
    --min-port=49160 --max-port=49200 \
    --no-tls --no-dtls --no-cli \
    >/var/log/turnserver.out 2>&1 &
  sleep 1
  ss -ulnp | grep 3478 || true
  pgrep -a turnserver || true
  echo TURN_MANUAL_OK
else
  echo NO_TURNSERVER_BINARY
  ls /usr/bin/turn* 2>/dev/null || true
fi
"""
_i, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode(), e.read().decode())
c.close()
