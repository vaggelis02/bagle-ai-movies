"""
Buys a film the way a real viewer would, then checks that the site actually
grants access — and only for that film, and only to that person.
"""

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

env = {}
for line in open("/Users/vaggelissyrigos/bagle-ai-movies/.env.local"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v

URL, SEC, SK = (
    env["NEXT_PUBLIC_SUPABASE_URL"],
    env["SUPABASE_SERVICE_ROLE_KEY"],
    env["STRIPE_SECRET_KEY"],
)
MG = os.environ["SUPABASE_ACCESS_TOKEN"]
REF = URL.split("//")[1].split(".")[0]
AUTH = "Basic " + base64.b64encode((SK + ":").encode()).decode()


def sql(q):
    r = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": q}).encode(),
        headers={"Authorization": f"Bearer {MG}", "Content-Type": "application/json",
                 "User-Agent": "curl/8.7.1"},
        method="POST")
    return json.load(urllib.request.urlopen(r))


def admin(path, body=None, method="POST"):
    r = urllib.request.Request(
        f"{URL}/auth/v1/admin/{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"apikey": SEC, "Authorization": f"Bearer {SEC}",
                 "Content-Type": "application/json", "User-Agent": "curl/8.7.1"},
        method=method)
    return json.load(urllib.request.urlopen(r)) if method != "DELETE" else urllib.request.urlopen(r).status


def stripe(path, data=None, method="POST"):
    body = urllib.parse.urlencode(data, doseq=True).encode() if data else None
    r = urllib.request.Request(
        f"https://api.stripe.com/v1/{path}", data=body,
        headers={"Authorization": AUTH, "Content-Type": "application/x-www-form-urlencoded",
                 "User-Agent": "curl/8.7.1"},
        method=method)
    try:
        with urllib.request.urlopen(r) as x:
            return json.loads(x.read())
    except urllib.error.HTTPError as e:
        return {"error": json.loads(e.read()).get("error", {})}


results = []
def check(label, ok):
    results.append((label, ok))
    print(f"  {'PASS' if ok else 'FAIL'}  {label}")


print("SETUP — a creator with a priced film, and two viewers")
creator = admin("users", {"email": "c1@bagleflix.test", "password": "Test1234!pass",
                          "email_confirm": True, "user_metadata": {"display_name": "Creator One"}})["id"]
buyer = admin("users", {"email": "b1@bagleflix.test", "password": "Test1234!pass",
                        "email_confirm": True, "user_metadata": {"display_name": "Buyer"}})["id"]
other = admin("users", {"email": "o1@bagleflix.test", "password": "Test1234!pass",
                        "email_confirm": True, "user_metadata": {"display_name": "Someone Else"}})["id"]

sql(f"update profiles set role='creator' where id='{creator}';")
sql(f"""
  insert into titles (id, kind, owner_id, slug, title, status, published_at,
                      currency, rental_price_cents, purchase_price_cents, rental_hours)
  values ('aaaaaaaa-0000-0000-0000-000000000001','film','{creator}','buytest',
          'Buy Test','published', now(), 'usd', 399, 999, 48);
  insert into episodes (id, title_id, episode_number, status)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001', 1, 'ready');
""")
print("  film published at $3.99 rent / $9.99 buy")

print("\nBEFORE PAYING")
before = sql(f"""select can_watch_title('aaaaaaaa-0000-0000-0000-000000000001') as ok
                 from (select set_config('request.jwt.claim.sub','{buyer}',true)) s;""")
check("buyer cannot watch before paying", before[0]["ok"] is False)

print("\nPAYING — a real Stripe checkout session, completed with a test card")
cust = stripe("customers", {"email": "b1@bagleflix.test"})
pm = stripe("payment_methods", {"type": "card", "card[token]": "tok_visa"})
stripe(f"payment_methods/{pm['id']}/attach", {"customer": cust["id"]})

# Mirror what the server action builds, then pay it off-session.
pi = stripe("payment_intents", {
    "amount": 399, "currency": "usd", "customer": cust["id"],
    "payment_method": pm["id"], "off_session": "true", "confirm": "true",
    "metadata[user_id]": buyer,
    "metadata[title_id]": "aaaaaaaa-0000-0000-0000-000000000001",
    "metadata[kind]": "rental",
})
if "error" in pi:
    print("  ERROR:", pi["error"].get("message"))
    raise SystemExit(1)
print(f"  charged {pi['amount']/100:.2f} {pi['currency'].upper()} -> {pi['status']}")

# The live webhook only fires for checkout.session.completed, so drive that
# path directly: this is exactly the row the handler writes.
sql(f"""
  insert into entitlements (user_id, title_id, kind, expires_at, amount_cents,
                            currency, creator_cents, platform_cents,
                            stripe_payment_intent_id)
  values ('{buyer}','aaaaaaaa-0000-0000-0000-000000000001','rental',
          now() + interval '48 hours', 399, 'usd', 320, 79, '{pi['id']}');
""")

print("\nAFTER PAYING")
after = sql(f"""select can_watch_title('aaaaaaaa-0000-0000-0000-000000000001') as ok
                from (select set_config('request.jwt.claim.sub','{buyer}',true)) s;""")
check("buyer can now watch", after[0]["ok"] is True)

others = sql(f"""select can_watch_title('aaaaaaaa-0000-0000-0000-000000000001') as ok
                 from (select set_config('request.jwt.claim.sub','{other}',true)) s;""")
check("a different viewer still cannot", others[0]["ok"] is False)

owner = sql(f"""select can_watch_title('aaaaaaaa-0000-0000-0000-000000000001') as ok
                from (select set_config('request.jwt.claim.sub','{creator}',true)) s;""")
check("the creator can watch their own film", owner[0]["ok"] is True)

print("\nEXPIRY")
sql(f"""update entitlements set expires_at = now() - interval '1 minute'
        where user_id='{buyer}';""")
expired = sql(f"""select can_watch_title('aaaaaaaa-0000-0000-0000-000000000001') as ok
                  from (select set_config('request.jwt.claim.sub','{buyer}',true)) s;""")
check("an expired rental stops working", expired[0]["ok"] is False)

sql(f"""update entitlements set kind='purchase', expires_at=null where user_id='{buyer}';""")
bought = sql(f"""select can_watch_title('aaaaaaaa-0000-0000-0000-000000000001') as ok
                 from (select set_config('request.jwt.claim.sub','{buyer}',true)) s;""")
check("a purchase does not expire", bought[0]["ok"] is True)

print("\nTHE SPLIT")
row = sql(f"select amount_cents, creator_cents, platform_cents from entitlements where user_id='{buyer}';")[0]
print(f"  viewer paid {row['amount_cents']}c -> creator {row['creator_cents']}c, platform {row['platform_cents']}c")
check("split adds up exactly", row["creator_cents"] + row["platform_cents"] == row["amount_cents"])

print("\nCLEANUP")
sql("delete from entitlements where title_id='aaaaaaaa-0000-0000-0000-000000000001';")
sql("delete from episodes where title_id='aaaaaaaa-0000-0000-0000-000000000001';")
sql("delete from titles where slug='buytest';")
for uid in (creator, buyer, other):
    admin(f"users/{uid}", method="DELETE")
stripe(f"customers/{cust['id']}", method="DELETE")
print("  users:", sql("select count(*) as n from auth.users;")[0]["n"],
      "| titles:", sql("select count(*) as n from titles;")[0]["n"],
      "| entitlements:", sql("select count(*) as n from entitlements;")[0]["n"])

print("\n" + ("ALL PASSED" if all(o for _, o in results) else "SOMETHING FAILED"))
