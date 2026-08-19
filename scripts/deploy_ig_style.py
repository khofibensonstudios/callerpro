import os
import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
FILES = [
    "src/components/PostActions.tsx",
    "src/components/FeedCard.tsx",
    "src/components/StoriesRow.tsx",
    "src/components/LiveNowRow.tsx",
    "src/components/SiteChrome.tsx",
    "src/components/ProfileActions.tsx",
    "src/components/ProfileHeroMedia.tsx",
    "src/components/ProfilePeopleSheet.tsx",
    "src/components/FollowButton.tsx",
    "src/components/WatchReel.tsx",
    "src/app/page.tsx",
    "src/app/u/[id]/page.tsx",
    "src/app/messages/page.tsx",
]


def run(c, cmd, timeout=900):
    print(">>", cmd[:180], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-2500:], flush=True)
    if code != 0:
        raise SystemExit(f"fail {code}")


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
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
    s = c.open_sftp()
    for rel in FILES:
        remote = "/var/www/connect-pro/web/" + rel
        s.put(os.path.join(ROOT, rel.replace("/", os.sep)), remote)
        print("uploaded", rel, flush=True)
    s.close()
    run(c, "rm -f /var/www/connect-pro/web/.next/lock; cd /var/www/connect-pro/web && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro")
    print("IG_RESTYLE_READY")
    c.close()


if __name__ == "__main__":
    main()
