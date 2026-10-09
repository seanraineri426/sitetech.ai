"""PAID (one-time) extraction for the pack fixtures; outputs cached in evals/fact_cache/ so every later scoring run is free.
Run: /tmp/stvenv/bin/python -m harness.tests_recall_pack.extract --cap 1.0 [--dry]"""
import argparse, shutil
from ..fixture_tools import FixtureTools
from .. import email_facts as EF
from . import builder
from .cases import CASES, GUARDS, mixed_case

def all_pending():
    items = []
    for c in CASES + GUARDS + [mixed_case()]:
        fx = builder.build(c["fx"]); T = FixtureTools(c["fx"].get("as_of", builder.AS_OF), c["fx"].get("compare_to", builder.COMPARE_TO), fixture_dir=fx)
        items += EF.pending(T); shutil.rmtree(fx, ignore_errors=True)
    return items

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--cap", type=float, default=1.0); ap.add_argument("--dry", action="store_true"); a = ap.parse_args()
    items = all_pending()
    print(f"pending: {sum(1 for x in items if x[0]=='email')} emails, {sum(1 for x in items if x[0]=='rfi')} rfis (before dedupe)")
    if a.dry or not items: raise SystemExit(0)
    R = EF.facts_runner(a.cap, "recall_pack")
    n = EF.extract_items(items, R)
    print(f"calls={n} cost=${R.cost():.4f} ledger=${R.guard.spent:.4f}")
