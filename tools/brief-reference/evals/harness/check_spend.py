#!/usr/bin/env python3
"""GET https://openrouter.ai/api/v1/key and print ONLY spend/limit fields (never the key or its label)."""
import json, os, sys, urllib.request
req = urllib.request.Request("https://openrouter.ai/api/v1/key", headers={"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"]})
d = json.loads(urllib.request.urlopen(req, timeout=30).read().decode()).get("data", {})
out = {k: d.get(k) for k in ("usage", "usage_daily", "limit", "limit_remaining", "is_free_tier")}
print(json.dumps(out))
if len(sys.argv) > 1: json.dump(out, open(sys.argv[1], "w"), indent=1)
