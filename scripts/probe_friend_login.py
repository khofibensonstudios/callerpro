import json
import urllib.request
import ssl
import http.cookiejar

BASE = "https://67.217.59.81"
ctx = ssl._create_unverified_context()

def try_login(email, password):
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cj),
        urllib.request.HTTPSHandler(context=ctx),
    )
    data = json.dumps({"email": email, "password": password}).encode()
    r = urllib.request.Request(
        BASE + "/api/auth/login",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with opener.open(r, timeout=60) as res:
            body = json.loads(res.read().decode())
            print(email, res.status, body.get("user", {}).get("id"), body.get("user", {}).get("name"))
            if res.status == 200:
                # start live
                r2 = urllib.request.Request(
                    BASE + "/api/live",
                    data=json.dumps({"title": f"{email} probe"}).encode(),
                    method="POST",
                    headers={"Content-Type": "application/json"},
                )
                with opener.open(r2, timeout=60) as res2:
                    live = json.loads(res2.read().decode())
                    print("  live", res2.status, live.get("session", {}).get("id"), "host", (live.get("session") or {}).get("host"))
                r3 = urllib.request.Request(BASE + "/api/live", method="GET")
                with opener.open(r3, timeout=60) as res3:
                    listing = json.loads(res3.read().decode())
                    print("  list count", len(listing.get("lives") or []), [x.get("hostId") for x in listing.get("lives") or []])
    except Exception as e:
        print(email, "FAIL", e)

try_login("ben@gmail.com", "demo1234")
try_login("ben@gmail.com", "password")
try_login("demello@connect.pro", "demo1234")
try_login("kwasibest@gmail.com", "demo1234")
