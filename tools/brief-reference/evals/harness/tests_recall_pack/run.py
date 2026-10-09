"""Zero-cost recall-pack suite. Run (from evals/): /tmp/stvenv/bin/python -m harness.tests_recall_pack [--json out.json] [--legacy]
Stages per case: build FICTIONAL fixture -> attach cached extraction facts (email_facts / rfi_facts; never calls a model here) ->
deterministic judgment (rules_engine.run_rules) -> default S7 impacts -> catch check. --legacy skips facts (pre-split behaviour).
Caught = right record cited + right finding type + date and/or $ shown (pack match criteria). Negatives must not fire."""
import json, re, sys, argparse, shutil, collections
from ..fixture_tools import FixtureTools
from ..rules_engine import run_rules
from ..candidates import default_impacts
from . import builder
from .cases import CASES, GUARDS, mixed_case

try:
    from .. import email_facts as EF
except Exception:   # frozen 44cd39f has no extraction layer
    EF = None

DATE_RX = re.compile(r"\b\d{1,2}/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b")

def tools(case, legacy=False):
    fx = builder.build(case["fx"]); a = case["fx"].get("as_of", builder.AS_OF); c = case["fx"].get("compare_to", builder.COMPARE_TO)
    T = FixtureTools(a, c, fixture_dir=fx)
    if EF and not legacy: EF.attach(T, runner=None)   # cache only
    return T, fx

def shown(T, f, imps):
    usd = any((x.get("delay_usd") or 0) > 0 or (x.get("total_usd") or 0) > 0 for x in imps)
    dl = any(x.get("deadline") for x in imps)
    return usd, bool(DATE_RX.search(f.get("title") or "")) or dl

def check(case, legacy=False):
    T, fx = tools(case, legacy)
    fs = run_rules(T, T.as_of)
    ex = case["expect"]; cite = set(ex["cite"])
    hits = [f for f in fs if f["rule_id"] in ex["rules"] and set(ex.get("each") or []) | {cite_ for cite_ in cite if not ex.get("each")} & {c["ref"] for c in f["citations"]}]
    hits = [f for f in fs if f["rule_id"] in ex["rules"] and ({c["ref"] for c in f["citations"]} & cite)]
    out = {"id": case["id"], "pattern": case["pattern"], "pol": case["pol"], "fired": [f["finding_id"] for f in hits]}
    if case["pol"] == "neg":
        out["ok"] = not hits; out["why"] = "" if out["ok"] else "false alarm: " + "; ".join(f["title"][:120] for f in hits)
        shutil.rmtree(fx, ignore_errors=True); return out
    why = []
    if case["pol"] == "guard":
        g = hits[0] if hits else None
        imps = default_impacts(T, g) if g else []
        nw = next((x for x in imps if x.get("type") == "notice_window"), {})
        ok = bool(g) and nw.get("deadline") is None and nw.get("status") == "deadline_unknown"
        out.update(ok=ok, why="" if ok else f"guard shape wrong: fired={bool(g)} deadline={nw.get('deadline')} status={nw.get('status')}")
        shutil.rmtree(fx, ignore_errors=True); return out
    groups = [[r] for r in ex["each"]] if ex.get("each") else [sorted(cite)]
    ok_all = True
    for need in groups:
        cand = [f for f in hits if set(need) <= {c["ref"] for c in f["citations"]}]
        if not cand:
            ok_all = False; why.append(f"no {'/'.join(sorted(ex['rules']))} citing {need}"); continue
        best = None
        for f in cand:
            imps = default_impacts(T, f); usd, dt_ = shown(T, f, imps); w = []
            if case["pattern"] == "P1" and not usd: w.append("no $ exposure")
            if not (usd or dt_): w.append("no date or $ shown")
            if ex.get("types") is not None and set(f["evidence"].get("notice_types") or []) != ex["types"]:
                w.append(f"types {f['evidence'].get('notice_types')} != {sorted(ex['types'])}")
            if ex.get("types") is not None:
                nw = next((x for x in imps if x.get("type") == "notice_window"), {})
                if not nw.get("deadline"): w.append(f"notice deadline not computed ({nw.get('status')})")
            if ex.get("location") and (f["evidence"].get("location") or "") != ex["location"]: w.append("location missing")
            if case["pattern"] == "P4" and not any(x.get("kind") == "site_condition_owner_notice_flag" for x in imps): w.append("no owner-notice flag")
            if ex.get("label") and f["evidence"].get("label") != ex["label"]: w.append(f"label {f['evidence'].get('label')} != {ex['label']}")
            if not w: best = f; break
            why.append(f"{f['finding_id']}: " + ", ".join(w))
        if not best: ok_all = False
    out["ok"] = ok_all; out["why"] = "" if ok_all else " | ".join(why)[:300]
    shutil.rmtree(fx, ignore_errors=True); return out

NEED = {"26 24 13-001": "2026-11-02", "26 24 16-001": "2026-11-02", "26 24 19-001": "2026-11-09", "08 41 13-001": "2026-11-02"}

def extraction_accuracy():
    """Per pattern, per field: does the extracted (pre-judgment) fact match the gold? Measures the MODEL output (sender_party as the
    model wrote it, before code overwrites it). date = new_date, or old_date/need date + delay_days for duration-only statements."""
    import datetime as _dt
    from ..calendar_util import d_
    acc = collections.OrderedDict()
    def tick(p, field, ok):
        a = acc.setdefault(p, collections.OrderedDict()).setdefault(field, [0, 0]); a[1] += 1; a[0] += 1 if ok else 0
    misses = []
    for c in CASES:
        if not c.get("gold") and not c.get("rfi_gold"): continue
        T, fx = tools(c)
        for ref, g in (c.get("gold") or {}).items():
            facts = (getattr(T, "email_facts", {}) or {}).get(ref)
            if facts is None: tick(c["pattern"], "extracted", False); misses.append((c["id"], "no cached extraction")); continue
            tick(c["pattern"], "extracted", True)
            if g["kind"] == "not_notice":
                ok = not any(f["kind"] == "formal_notice" for f in facts); tick(c["pattern"], "kind", ok)
                if not ok: misses.append((c["id"], "kind: notice extracted on a non-notice"))
                continue
            f = next((x for x in facts if x["kind"] == g["kind"]), facts[0] if facts else None)
            ok = bool(f) and f["kind"] == g["kind"]; tick(c["pattern"], "kind", ok)
            if not ok: misses.append((c["id"], f"kind {f and f['kind']} != {g['kind']}"))
            if not f: continue
            if "date" in g and g["date"]:
                nd = f.get("new_date")
                if not nd and f.get("delay_days") is not None:
                    base = f.get("old_date") or NEED.get(g.get("ref_key"))
                    nd = base and (d_(base) + _dt.timedelta(days=int(f["delay_days"]))).isoformat()
                ok = bool(nd) and abs((d_(nd) - d_(g["date"])).days) <= (g.get("date_tol") or 0); tick(c["pattern"], "new_date", ok)
                if not ok: misses.append((c["id"], f"new_date {nd} != {g['date']}"))
            if g.get("date_hi"):
                hi = f.get("new_date_high")
                if not hi and f.get("delay_days_high") is not None:
                    base = f.get("old_date") or NEED.get(g.get("ref_key")); hi = (d_(base) + _dt.timedelta(days=int(f["delay_days_high"]))).isoformat()
                ok = hi == g["date_hi"]; tick(c["pattern"], "range_high", ok)
                if not ok: misses.append((c["id"], f"range_high {hi} != {g['date_hi']}"))
            if g.get("ref_key"):
                got = f.get("submittal_no") or f.get("rfi_no")
                ok = bool(got) and re.sub(r"\W", "", got) == re.sub(r"\W", "", g["ref_key"]); tick(c["pattern"], "record_key", ok)
                if not ok: misses.append((c["id"], f"record_key {got} != {g['ref_key']}"))
            if "notice_types" in g:
                ok = set(f.get("notice_types") or []) == g["notice_types"]; tick(c["pattern"], "notice_types", ok)
                if not ok: misses.append((c["id"], f"notice_types {f.get('notice_types')} != {sorted(g['notice_types'])}"))
            if g.get("sender_party"):
                ok = f.get("sender_party_model", f.get("sender_party")) == g["sender_party"]; tick(c["pattern"], "sender_party", ok)
                if not ok: misses.append((c["id"], f"sender_party {f.get('sender_party_model')!r}"))
            tick(c["pattern"], "quote_verbatim", True)   # facts with a non-verbatim quote are dropped before this point
        for ref, g in (c.get("rfi_gold") or {}).items():
            f = (getattr(T, "rfi_facts", {}) or {}).get(ref)
            if f is None: tick(c["pattern"], "extracted", False); misses.append((c["id"], "no cached RFI extraction")); continue
            tick(c["pattern"], "extracted", True)
            for k, v in g.items():
                ok = f.get(k) == v; tick(c["pattern"], k, ok)
                if not ok: misses.append((c["id"], f"{k} {f.get(k)} != {v}"))
        shutil.rmtree(fx, ignore_errors=True)
    dropped = 0
    return acc, misses

def mixed(legacy=False):
    from ..stages.rank import auto_insight, code_item
    from ..ranker import rank, NOTICE_RULES
    case = mixed_case(); T, fx = tools(case, legacy)
    fs = run_rules(T, T.as_of); F = {f["finding_id"]: f for f in fs}; ins = []
    for f in fs:
        ai = code_item(T, f, "C", F) if f["rule_id"] in NOTICE_RULES else auto_insight(f, "C", "pack mixed set (code only)")
        ai["impacts"] = default_impacts(T, f); ai["decision_deadline_verified"] = None; ins.append(ai)
    top, order = rank(T, ins, F)
    first = next(i for i in ins if i["key"] == order[0]) if order else None
    ok = bool(first) and any(case["p1_ref"] in {c["ref"] for c in F[x]["citations"]} for x in first["finding_ids"])
    shutil.rmtree(fx, ignore_errors=True)
    return {"ok": ok, "rank1": first and first["headline"][:140], "n_items": len(ins),
            "order": [(next(i for i in ins if i["key"] == k)["headline"][:70]) for k in order[:7]]}

def guards(legacy=False):
    out = []
    for g in GUARDS:
        T, fx = tools(g, legacy); fs = [f for f in run_rules(T, T.as_of) if f["rule_id"] == "SCH-EMAIL-DATE-SLIP"]
        usd = any((x.get("delay_usd") or 0) > 0 for f in fs for x in default_impacts(T, f))
        ok = (not fs) or (all("confirm activity" in f["title"] for f in fs) and not usd)
        out.append({"id": g["id"], "ok": ok, "fired": [f["title"][:120] for f in fs], "usd": usd}); shutil.rmtree(fx, ignore_errors=True)
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--json"); ap.add_argument("--legacy", action="store_true"); a = ap.parse_args()
    rows = [check(c, a.legacy) for c in CASES]
    per = collections.OrderedDict()
    for r in rows:
        p = per.setdefault(r["pattern"], {"pos": [0, 0], "neg": [0, 0]})
        k = "pos" if r["pol"] == "pos" else "neg"
        p[k][1] += 1; p[k][0] += 1 if r["ok"] else 0
    mx = mixed(a.legacy); gd = guards(a.legacy)
    acc, xmiss = extraction_accuracy() if (EF and not a.legacy) else ({}, [])
    if acc:
        print("extraction accuracy (model facts vs gold, before judgment):")
        for p, fields in acc.items(): print(f"  {p}: " + ", ".join(f"{k} {v[0]}/{v[1]}" for k, v in fields.items()))
        for m in xmiss: print("  XMISS", *m)
    for r in rows:
        if not r["ok"]: print(f"MISS {r['id']:7} {r['why']}")
    print("\npattern  positives      negatives(+guard)  bar")
    allpass = True
    for p, v in per.items():
        bar = v["pos"][0] >= 0.9 * v["pos"][1] and v["neg"][0] == v["neg"][1]; allpass &= bar
        print(f"{p:7}  {v['pos'][0]:2}/{v['pos'][1]:2} ({v['pos'][0]/v['pos'][1]:.0%})   {v['neg'][0]}/{v['neg'][1]}                {'PASS' if bar else 'FAIL'}")
    print(f"mixed set: P1 zero-float ranked #1: {mx['ok']} (rank1={mx['rank1']!r}; {mx['n_items']} items)")
    for g in gd: print(f"guard {g['id']}: {'PASS' if g['ok'] else 'FAIL'} {g['fired']}")
    allpass &= mx["ok"] and all(g["ok"] for g in gd)
    if a.json: json.dump({"rows": rows, "per_pattern": per, "mixed": mx, "guards": gd, "extraction_accuracy": acc, "extraction_misses": xmiss, "pass": allpass}, open(a.json, "w"), indent=1)
    print("PACK", "PASS" if allpass else "FAIL")
    sys.exit(0 if allpass else 1)
