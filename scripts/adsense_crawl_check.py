"""Simulate Google AdSense / AdsBot crawl against live site."""
import re
import ssl
import urllib.request

BASE = "https://67.217.59.81"
UA = "Mediapartners-Google"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch(url: str, max_body: int = 20000):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    r = urllib.request.urlopen(req, context=ctx, timeout=25)
    body = r.read(max_body).decode("utf-8", "replace")
    return r.status, r.geturl(), body


def analyze(url: str):
    st, final, body = fetch(url)
    login = "/login" in final
    title = re.search(r"<title[^>]*>([^<]+)", body, re.I)
    text = re.sub(r"<[^>]+>", " ", body)
    words = len(text.split())
    return {
        "url": url,
        "status": st,
        "final": final,
        "login_wall": login,
        "title": title.group(1).strip() if title else None,
        "words": words,
        "has_adsense_script": "pagead2.googlesyndication.com" in body,
        "has_adsbygoogle": "adsbygoogle" in body,
    }


def main():
    print("=== AdSense crawler simulation ===")
    print(f"Base: {BASE}  User-Agent: {UA}\n")

    # SSL check like real Google (strict verification)
    ssl_ok = True
    try:
        req = urllib.request.Request(f"{BASE}/robots.txt", headers={"User-Agent": UA})
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        ssl_ok = False
        print(f"SSL (strict, like Google): FAIL — {type(e).__name__}")
        print("  Google/AdSense bots will NOT trust https://67.217.59.81 (self-signed cert on IP).\n")

    pages = [
        f"{BASE}/robots.txt",
        f"{BASE}/ads.txt",
        f"{BASE}/sitemap.xml",
        f"{BASE}/",
        f"{BASE}/privacy",
        f"{BASE}/about",
        f"{BASE}/terms",
        f"{BASE}/contact",
        f"{BASE}/how-adsense-works",
        f"{BASE}/watch",
        f"{BASE}/blogs",
        f"{BASE}/search",
        f"{BASE}/login",
        f"{BASE}/messages",
    ]

    results = []
    for url in pages:
        try:
            results.append(analyze(url))
        except Exception as e:
            results.append({"url": url, "error": str(e)})

    for r in results:
        if "error" in r:
            print(f"FAIL {r['url']}: {r['error']}")
            continue
        flag = "LOGIN WALL" if r["login_wall"] else "OK"
        print(f"{flag} {r['url']}")
        print(f"  status={r['status']} final={r['final']}")
        print(f"  title={r['title']!r} words~={r['words']}")
        print(f"  adsense_script={r['has_adsense_script']} adsbygoogle={r['has_adsbygoogle']}")
        print()

    # ads.txt content
    try:
        _, _, ads = fetch(f"{BASE}/ads.txt", 2000)
        print("--- ads.txt ---")
        print(ads.strip())
        print()
    except Exception as e:
        print("ads.txt error:", e)

    # sample posts from sitemap
    try:
        _, _, sm = fetch(f"{BASE}/sitemap.xml", 500000)
        locs = re.findall(r"<loc>([^<]+)</loc>", sm)
        print(f"--- sitemap: {len(locs)} URLs ---")
        content = [u for u in locs if any(x in u for x in ("/p/", "/watch/", "/article/", "/u/"))][:6]
        for p in content:
            try:
                r = analyze(p)
                flag = "LOGIN WALL" if r["login_wall"] else "OK"
                print(f"{flag} {p} words~={r['words']}")
            except Exception as e:
                print(f"FAIL {p}: {e}")
    except Exception as e:
        print("sitemap error:", e)

    print("\n=== Summary for AdSense ===")
    login_walls = [r for r in results if not r.get("error") and r.get("login_wall")]
    print(f"Strict SSL trusted by Google: {'YES' if ssl_ok else 'NO (self-signed / invalid cert on IP)'}")
    print(f"Pages hitting login wall: {len(login_walls)}")
    for r in login_walls:
        print(f"  - {r['url']}")


if __name__ == "__main__":
    main()
