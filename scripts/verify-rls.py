"""
Proves the core security rule: a browser client must never be able to read a
Bunny video id, and must never see an unpublished title.

Creates real rows with the service key, then attacks them with the public key
exactly as a browser would, then cleans up after itself.

Run it after ANY change to the schema or to a policy:

    SUPABASE_ACCESS_TOKEN=<personal access token> python3 scripts/verify-rls.py

Exits non-zero if any check fails, so it can be wired into CI later.
"""

import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

ENV_FILE = pathlib.Path(__file__).resolve().parent.parent / ".env.local"

env = {}
for line in open(ENV_FILE):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v

URL = env["NEXT_PUBLIC_SUPABASE_URL"]
ANON = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = env["SUPABASE_SERVICE_ROLE_KEY"]
MGMT = os.environ["SUPABASE_ACCESS_TOKEN"]
# https://<ref>.supabase.co
REF = URL.split("//", 1)[1].split(".", 1)[0]


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={
            "Authorization": f"Bearer {MGMT}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.7.1",
        },
        method="POST",
    )
    return json.load(urllib.request.urlopen(req))


def rest(path, key, method="GET", body=None):
    """Talk to PostgREST the way the browser does."""
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=json.dumps(body).encode() if body else None,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.7.1",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"[]")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


print("SETUP — creating a creator, a published film, and a secret video id")

# A real auth user, so the profile trigger fires like it would in production.
req = urllib.request.Request(
    f"{URL}/auth/v1/admin/users",
    data=json.dumps(
        {"email": "sectest@bagleflix.test", "password": "x9F!q2Lm7Tz#4vBn", "email_confirm": True}
    ).encode(),
    headers={
        "apikey": SERVICE,
        "Authorization": f"Bearer {SERVICE}",
        "Content-Type": "application/json",
        "User-Agent": "curl/8.7.1",
    },
    method="POST",
)
user = json.load(urllib.request.urlopen(req))
uid = user["id"]
print(f"  created auth user {uid}")

got = sql(f"select id, role from profiles where id = '{uid}';")
print(f"  profile auto-created by trigger: {got}")

sql(f"update profiles set role='creator' where id='{uid}';")
sql(
    f"""
    insert into titles (id, kind, owner_id, slug, title, status, published_at)
    values ('11111111-1111-1111-1111-111111111111', 'film', '{uid}',
            'sectest-published', 'Sec Test Published', 'published', now());
    insert into titles (id, kind, owner_id, slug, title, status)
    values ('22222222-2222-2222-2222-222222222222', 'film', '{uid}',
            'sectest-draft', 'Sec Test Draft', 'draft');
    insert into episodes (id, title_id, episode_number, status)
    values ('33333333-3333-3333-3333-333333333333',
            '11111111-1111-1111-1111-111111111111', 1, 'ready');
    insert into episode_sources (episode_id, bunny_video_id)
    values ('33333333-3333-3333-3333-333333333333', 'SUPER-SECRET-BUNNY-ID');
    """
)
print("  inserted 2 titles, 1 episode, 1 secret source")

print("\nATTACK — querying as an anonymous browser with the public key")

results = []

status, body = rest("episode_sources?select=*", ANON)
leaked = isinstance(body, list) and len(body) > 0
results.append(("episode_sources hidden from anon", not leaked))
print(f"  GET episode_sources        -> HTTP {status} {str(body)[:90]}")

status, body = rest("episodes?select=*", ANON)
print(f"  GET episodes               -> HTTP {status} {len(body) if isinstance(body,list) else body} row(s)")
if isinstance(body, list):
    exposed = [k for row in body for k in row if "bunny" in k.lower()]
    results.append(("no bunny column on episodes", not exposed))

status, body = rest("titles?select=title,status", ANON)
titles = [t["title"] for t in body] if isinstance(body, list) else []
print(f"  GET titles                 -> HTTP {status} {titles}")
results.append(("published title visible", "Sec Test Published" in titles))
results.append(("draft title hidden", "Sec Test Draft" not in titles))

status, body = rest(
    "titles", ANON, "POST",
    {"kind": "film", "owner_id": uid, "slug": "hack", "title": "Hacked", "status": "published"},
)
results.append(("anon cannot insert a title", status >= 400))
print(f"  POST titles (should fail)  -> HTTP {status}")

status, body = rest("profiles?select=*", ANON)
n = len(body) if isinstance(body, list) else -1
results.append(("anon cannot list profiles", n == 0))
print(f"  GET profiles               -> HTTP {status} {n} row(s)")

status, body = rest("subscriptions?select=*", ANON)
n = len(body) if isinstance(body, list) else -1
results.append(("anon cannot list subscriptions", n == 0))
print(f"  GET subscriptions          -> HTTP {status} {n} row(s)")

print("\nCONTROL — the server, holding the service key, CAN read the source")
status, body = rest("episode_sources?select=bunny_video_id", SERVICE)
ok = isinstance(body, list) and any(r.get("bunny_video_id") == "SUPER-SECRET-BUNNY-ID" for r in body)
results.append(("service role can read source", ok))
print(f"  GET episode_sources        -> HTTP {status} {'found the id' if ok else body}")

print("\nCLEANUP")
sql(
    """
    delete from episode_sources where episode_id='33333333-3333-3333-3333-333333333333';
    delete from episodes where id='33333333-3333-3333-3333-333333333333';
    delete from titles where slug in ('sectest-published','sectest-draft','hack');
    """
)
req = urllib.request.Request(
    f"{URL}/auth/v1/admin/users/{uid}",
    headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "User-Agent": "curl/8.7.1"},
    method="DELETE",
)
urllib.request.urlopen(req)
left = sql("select count(*) as n from titles;")
print(f"  removed test rows and user; titles remaining: {left}")

print("\nRESULT")
for name, passed in results:
    print(f"  {'PASS' if passed else 'FAIL'}  {name}")

if all(p for _, p in results):
    print("\nALL PASSED")
else:
    print("\nFAILED — do not ship until this is green")
    sys.exit(1)
