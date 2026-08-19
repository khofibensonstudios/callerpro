import os
import paramiko

HOST = "67.217.59.81"
PASSWORD = "3040064@Reno"
ROOT = r"c:\Users\KBS\AndroidStudioProjects\Connect Pro\web"
REMOTE = "/var/www/connect-pro/web"
FILES = [
    "src/components/shop/ShopSetup.tsx",
    "src/components/shop/PlacesSearch.tsx",
    "src/components/SettingsScreen.tsx",
    "src/components/ProfileActions.tsx",
    "src/components/SiteChrome.tsx",
    "src/components/Providers.tsx",
    "src/app/settings/page.tsx",
    "src/app/shop/setup/page.tsx",
    "src/app/earn/page.tsx",
    "src/app/u/[id]/page.tsx",
    "src/app/layout.tsx",
    "src/app/globals.css",
    "src/app/api/shop/mine/route.ts",
    "src/app/api/places/autocomplete/route.ts",
    "src/app/api/places/details/route.ts",
    "src/lib/shop.ts",
    "src/lib/shop-shared.ts",
    "src/lib/settings.ts",
    "src/lib/file-range.ts",
    "src/lib/db/schema.ts",
    "src/lib/db/pool.ts",
    "src/middleware.ts",
    "next.config.ts",
]


def run(c, cmd, timeout=900):
    print(">>", cmd[:180], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    print((out + err)[-3500:], flush=True)
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
    dirs = sorted({os.path.dirname(f).replace("\\", "/") for f in FILES if os.path.dirname(f)})
    run(c, "mkdir -p " + " ".join(f"{REMOTE}/{d}" for d in dirs))
    s = c.open_sftp()
    for rel in FILES:
        local = os.path.join(ROOT, rel.replace("/", os.sep))
        remote = f"{REMOTE}/{rel}"
        s.put(local, remote)
        print("uploaded", rel, flush=True)
    s.close()
    run(c, f"rm -f {REMOTE}/src/components/SettingsSheet.tsx")
    run(c, f"rm -f {REMOTE}/.next/lock; cd {REMOTE} && npm run build", 900)
    run(c, "systemctl restart connect-pro; sleep 2; systemctl is-active connect-pro")
    print("SETTINGS_SHOP_LIVE")
    c.close()


if __name__ == "__main__":
    main()
