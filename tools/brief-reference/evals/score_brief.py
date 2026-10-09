#!/usr/bin/env python3
"""Score a Daily Brief JSON against a fixture answer key.  Usage: score_brief.py <brief.json> [--json] [--fixture <dir>]
Automated metrics (EVALS.md section 3): recall of planted risks, rank expectations, key-fact accuracy (heuristic numeric/date
matching; human audit confirms), must-not-flag violations, status items, freshness disclosures, fabricated refs, schema/length.
Human-judged metrics (citation support, action usefulness) are NOT computed here; see EVALS.md section 4.

Generic (iteration 3): nothing here is specific to one project. Every check is driven by answer-key fields defined in
schemas/expected_findings.schema.json (documented in EVALS.md section 3.1):
  findings[].required_elements   [{section, value, scope?, gate?}]   a string/date that must appear in a named brief section
  findings[].expected_label / forbidden_label (+ label_gate)          confidence label of the matched brief unit
  must_not_flag[] (traps)        {ref | check:{type:text_pattern, pattern}, scope: anywhere | top_items_only}
  rank_constraints[]             {above, below, gate?}                 finding `above` must rank above finding `below`
  required_freshness_disclosures {source, must_state, freshness_band?, checks?}   any fixture
  status_items[].checks          optional, machine-checkable; status items are optional per fixture
  reference_ranking.json, _ref_index.json   optional files (top-7 overlap / fabricated-ref check skipped when absent)
Gate = A1 recall >= scoring.gate.recall_min (default: miss at most one) AND 0 trap violations AND 0 fabricated refs AND all
freshness disclosures AND <= 700 words AND every construct marked `gate: true` passes."""
import json, os, re, sys

SECTION_ALIASES = {"management_attention": ("top_items", "action_items"), "decisions": ("new_decisions", "unresolved_decisions")}
SOURCE_ALIASES = {"email": "msgraph_outlook", "mail": "msgraph_outlook", "mailbox": "msgraph_outlook", "p6": "schedule", "xer": "schedule"}
LABELS = ("Signal", "Likely", "Confirmed")

def units(b):
    out = []
    for t in b["top_items"]:
        out.append({"kind": "top", "rank": t["rank"], "id": t["item_id"], "refs": [c["ref"] for c in t["citations"]],
                    "text": " ".join([t["headline"], t["body"], t.get("delta_text", ""), t["action"]["text"], json.dumps(t["impact"])]),
                    "conf": t["confidence"], "dd": (t.get("decision_deadline") or {}).get("date", "")})
    for sec, rows in b["sections"].items():
        for r in rows:
            if r.get("item_id"): continue
            refs = [c["ref"] for c in r.get("citations", [])] + ([r["ref"]] if r.get("ref") else [])
            text = " ".join(str(r.get(k, "")) for k in ("headline", "title", "summary", "why_significant", "action", "cost_of_waiting", "priority_note", "days_overdue", "needed_by", "days_late", "carried_count", "governing_date", "text"))
            out.append({"kind": sec, "rank": None, "id": r.get("ref") or r.get("decision_ref") or r.get("action_id") or r.get("headline", "")[:30], "refs": refs,
                        "text": text, "conf": r.get("confidence"), "unblocks": r.get("unblocks") or []})
    return out

NUM = re.compile(r"-?\$?\d[\d,]*\.?\d*\s*[kKmM%]?")
def numbers(text):
    vals = []
    for m in NUM.findall(text):
        s = m.replace("$", "").replace(",", "").strip(); mult = 1
        if s[-1:] in "kK": mult, s = 1e3, s[:-1]
        elif s[-1:] in "mM": mult, s = 1e6, s[:-1]
        pct = s.endswith("%"); s = s.rstrip("%").strip()
        try: v = float(s) * mult
        except ValueError: continue
        vals.append(v / 100 if pct else v); vals.append(v)
    return vals
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
def date_forms(iso):
    y, m, d = iso.split("-"); return [iso, f"{int(m)}/{int(d)}"]
def date_in(iso, text):
    y, m, d = iso.split("-")
    return iso in text or bool(re.search(rf"(?<![\d/]){int(m)}/{int(d)}(?![\d])", text))
def fact_ok(val, text):
    nums = numbers(text)
    if isinstance(val, bool): return None
    if isinstance(val, (int, float)):
        return any(abs(n - val) <= max(1e-9, abs(val) * 0.005) for n in nums)
    if isinstance(val, str):
        return any(f in text for f in date_forms(val)) if ISO.match(val) else (val.lower() in text.lower())
    if isinstance(val, dict) and "value" in val:
        v = val["value"]; tol = val.get("tolerance"); tp = val.get("tolerance_pct")
        lo, hi = (v - tol, v + tol) if tol is not None else (v * (1 - tp / 100), v * (1 + tp / 100)) if tp is not None else (v, v)
        return any(lo <= n <= hi for n in nums)
    if isinstance(val, list):
        return all(fact_ok(x, text) for x in val)
    return None
def value_in(value, text):
    return date_in(value, text) if ISO.match(str(value)) else str(value).lower() in text.lower()
def as_list(x): return [] if x is None else list(x) if isinstance(x, (list, tuple)) else [x]

def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "ref" and isinstance(v, str): yield v
            else: yield from walk(v)
    elif isinstance(o, list):
        for v in o: yield from walk(v)

def score(brief, exp, ref_index=None, ref_rank=None):
    U = units(brief)
    report = {"findings": [], "must_not_flag": [], "status_items": [], "freshness": [], "fabricated_refs": [], "required_elements": [],
              "labels": [], "rank_constraints": [], "summary": {}}
    must = [f for f in exp["findings"] if f.get("must_surface")]
    match_of = {}
    for f in exp["findings"]:
        need = f.get("min_citations_matched", 1); req = set(f["required_citations"])
        cands = [u for u in U if len(req & set(u["refs"])) >= min(need, len(req))]
        best, best_score = None, -1
        for u in cands:
            checks = [fact_ok(v, u["text"]) for v in f.get("key_facts", {}).values()]
            checks = [c for c in checks if c is not None]
            sc = (sum(checks) / len(checks)) if checks else 1.0
            if u["kind"] == "top": sc += 0.01
            if sc > best_score: best, best_score = u, sc
        matched = best is not None and best_score >= 0.6
        rank_ok = None
        m = re.match(r"top (\d+)", f.get("rank_expectation", ""))
        if m: rank_ok = bool(best and best["kind"] == "top" and best["rank"] <= int(m.group(1)))
        match_of[f["id"]] = best if matched else None
        report["findings"].append({"id": f["id"], "matched": matched, "matched_unit": best and best["id"], "unit_kind": best and best["kind"],
                                   "rank": best and best["rank"], "rank_expectation": f.get("rank_expectation"), "rank_ok": rank_ok,
                                   "key_fact_score": round(best_score, 2) if best else 0})
        # required elements (string/date in a named section)
        for el in f.get("required_elements") or []:
            secs = SECTION_ALIASES.get(el["section"], (el["section"],))
            texts = []
            for s_ in secs:
                if s_ == "top_items":
                    texts += [u["text"] + " " + u["dd"] for u in U if u["kind"] == "top" and (u is match_of[f["id"]] or req & set(u["refs"]))]
                elif s_ == "action_items":
                    tops = {u["id"] for u in U if u["kind"] == "top" and (u is match_of[f["id"]] or req & set(u["refs"]))}
                    rows = brief["sections"].get("action_items", [])
                    texts += [json.dumps(a) for a in rows if el.get("scope") == "section" or set(a.get("unblocks") or []) & tops]
                elif s_ == "status":
                    texts.append(json.dumps(brief.get("status", {})))
                elif s_ == "freshness":
                    texts.append(json.dumps(brief.get("freshness", [])))
                elif s_ == "gaps":
                    texts.append(json.dumps(brief.get("gaps", [])))
                else:
                    rows = brief["sections"].get(s_, [])
                    texts += [json.dumps(r) for r in rows if el.get("scope") == "section" or req & set([c.get("ref") for c in r.get("citations", [])] + [r.get("ref")])]
            ok = any(value_in(el["value"], t) for t in texts)
            report["required_elements"].append({"finding": f["id"], "section": el["section"], "value": el["value"], "ok": ok, "gate": bool(el.get("gate"))})
        # labels
        if f.get("expected_label") or f.get("forbidden_label"):
            u = match_of[f["id"]]; conf = u and u.get("conf")
            exp_l, forb = as_list(f.get("expected_label")), as_list(f.get("forbidden_label"))
            ok = None if not conf else ((not exp_l or conf in exp_l) and conf not in forb)
            report["labels"].append({"finding": f["id"], "got": conf, "expected": exp_l, "forbidden": forb, "ok": ok, "gate": bool(f.get("label_gate")),
                                     "note": None if conf else "no matched unit with a confidence label"})
    # traps (must_not_flag); scope: anywhere (default) | top_items_only
    for n in exp.get("must_not_flag", []) + exp.get("traps", []):
        pool = [u for u in U if u["kind"] == "top"] if n.get("scope") == "top_items_only" else U
        chk = n.get("check") or {}
        if chk.get("type") == "text_pattern":
            rx = re.compile(chk["pattern"], re.I); viol = [u["id"] for u in pool if rx.search(u["text"])]
        elif n.get("ref"):
            viol = [u["id"] for u in pool if u["refs"] and u["refs"][0] == n["ref"] and u["kind"] != "new_decisions"]
        else:
            viol = []; n = dict(n, note="no machine check defined")
        report["must_not_flag"].append({"id": n["id"], "scope": n.get("scope", "anywhere"), "violations": viol} | ({"note": n["note"]} if n.get("note") else {}))
    # status items (optional per fixture; only entries with machine `checks` are scored)
    secs = brief["sections"]; closed = {c["ref"] for c in brief.get("closed_since_last", [])}
    top_first = {u["refs"][0] for u in U if u["kind"] == "top" and u["refs"]}
    def sec_refs(k):
        out = set()
        for r in secs.get(k, []):
            if r.get("ref"): out.add(r["ref"])
            out |= {c["ref"] for c in r.get("citations", [])}
        return out
    CHK = {"in_closed": lambda c: c["ref"] in closed, "in_section": lambda c: c["ref"] in sec_refs(c["section"]),
           "not_in_section": lambda c: c["ref"] not in sec_refs(c["section"]), "not_in_top": lambda c: c["ref"] not in top_first,
           "in_top": lambda c: c["ref"] in top_first}
    for s_ in exp.get("status_items") or []:
        if not s_.get("checks"): report["status_items"].append({"id": s_["id"], "ok": None, "note": "no machine checks; human-judged"}); continue
        res = [CHK[c["type"]](c) for c in s_["checks"]]
        report["status_items"].append({"id": s_["id"], "ok": all(res)})
    st_scored = [x for x in report["status_items"] if x["ok"] is not None]
    # freshness disclosures (generic)
    fr = {f["source"]: f for f in brief.get("freshness", [])}
    for d in exp.get("required_freshness_disclosures") or []:
        src = SOURCE_ALIASES.get(d["source"], d["source"]); e = fr.get(src)
        if not e: report["freshness"].append({"source": d["source"], "ok": False, "note": "no freshness entry for source"}); continue
        txt = json.dumps(e); c = d.get("checks") or {}
        must_state = d.get("must_state", "")
        dates = c.get("dates", re.findall(r"\d{4}-\d{2}-\d{2}", must_state))
        emails = c.get("contains", re.findall(r"[\w.+-]+@[\w.-]+\.\w+", must_state))
        bands = c.get("band_in") or ([w for w in ("fresh", "aging", "stale", "missing") if w in (d.get("freshness_band") or "").lower()][:1])
        ok = all(x in txt for x in dates) and all(x.lower() in txt.lower() for x in emails)
        if bands: ok = ok and e.get("band") in bands + (["stale"] if bands == ["aging"] else [])
        if not dates and not emails and not bands: ok = bool(e.get("last_successful_sync") or e.get("as_of_label"))
        report["freshness"].append({"source": d["source"], "ok": bool(ok)})
    # fabricated refs (needs the fixture ref index)
    if ref_index is not None:
        REFS = set(ref_index if isinstance(ref_index, list) else ref_index.keys())
        report["fabricated_refs"] = sorted({r for r in walk(brief) if r not in REFS})
    # rank constraints (A above B); unranked (not in top) = +inf
    rank_of = lambda fid: (match_of.get(fid) or {}).get("rank") or float("inf")
    for rc in exp.get("rank_constraints") or []:
        a, b_ = rank_of(rc["above"]), rank_of(rc["below"])
        ok = None if a == b_ == float("inf") else a < b_
        report["rank_constraints"].append({"above": rc["above"], "below": rc["below"], "rank_above": None if a == float("inf") else a,
                                           "rank_below": None if b_ == float("inf") else b_, "ok": ok, "gate": bool(rc.get("gate"))})
    # summary
    top_match = {r["id"]: r for r in report["findings"] if r["unit_kind"] == "top"}
    got_top7 = {fid for fid, r in top_match.items() if r["matched"]}
    recall = sum(1 for r in report["findings"] if r["matched"] and r["id"] in {f["id"] for f in must}) / len(must) if must else 1.0
    rank_checks = [r["rank_ok"] for r in report["findings"] if r["rank_ok"] is not None]
    ref_of = {f["id"]: f.get("reference_rank") for f in exp["findings"]}
    pairs = [(r["rank"], ref_of[r["id"]]) for r in report["findings"] if r["unit_kind"] == "top" and r["matched"] and ref_of.get(r["id"]) is not None]
    conc = disc = 0
    for i in range(len(pairs)):
        for j in range(i + 1, len(pairs)):
            s_ = (pairs[i][0] - pairs[j][0]) * (pairs[i][1] - pairs[j][1]); conc += s_ > 0; disc += s_ < 0
    tau = round((conc - disc) / (conc + disc), 3) if conc + disc else None
    gated = [x for k in ("required_elements", "labels", "rank_constraints") for x in report[k] if x["gate"]]
    S = {"kendall_tau_vs_reference": tau,
         "recall_must_surface": f"{sum(1 for r in report['findings'] if r['matched'] and r['id'] in {f['id'] for f in must})}/{len(must)}", "recall": round(recall, 3),
         "rank_expectations_met": f"{sum(rank_checks)}/{len(rank_checks)}",
         "top7_overlap_with_reference": f"{len(set(ref_rank['top7']) & got_top7)}/{len(ref_rank['top7'])}" if ref_rank and ref_rank.get("top7") else "no reference_ranking.json",
         "must_not_flag_violations": sum(len(n["violations"]) for n in report["must_not_flag"]),
         "status_items_ok": f"{sum(x['ok'] for x in st_scored)}/{len(st_scored)}" if st_scored else "none configured",
         "freshness_disclosures_ok": f"{sum(x['ok'] for x in report['freshness'])}/{len(report['freshness'])}" if report["freshness"] else "none configured",
         "required_elements_ok": f"{sum(bool(x['ok']) for x in report['required_elements'])}/{len(report['required_elements'])}" if report["required_elements"] else "none configured",
         "labels_ok": (f"{sum(bool(x['ok']) for x in report['labels'])}/{sum(x['ok'] is not None for x in report['labels'])}"
                       + (f" ({sum(x['ok'] is None for x in report['labels'])} not evaluable)" if any(x['ok'] is None for x in report['labels']) else "")) if report["labels"] else "none configured",
         "rank_constraints_ok": f"{sum(bool(x['ok']) for x in report['rank_constraints'])}/{len(report['rank_constraints'])}" if report["rank_constraints"] else "none configured",
         "gated_constructs_failed": [f'{x.get("finding") or (x.get("above", "") + ">" + x.get("below", ""))}:{x.get("section") or x.get("got") or ""}' for x in gated if not x["ok"]],
         "fabricated_refs": len(report["fabricated_refs"]) if ref_index is not None else "no _ref_index.json",
         "word_count_main": brief["metrics"]["word_count_main"], "top_items": len(brief["top_items"])}
    rmin = ((exp.get("scoring") or {}).get("gate") or {}).get("recall_min")
    if rmin is None: rmin = (len(must) - 1) / len(must) if len(must) > 1 else 1.0
    gate = (recall >= rmin - 1e-9 and S["must_not_flag_violations"] == 0 and not report["fabricated_refs"]
            and all(x["ok"] for x in report["freshness"]) and brief["metrics"]["word_count_main"] <= 700 and not S["gated_constructs_failed"])
    S["gate"] = "PASS" if gate else "FAIL"; S["recall_min"] = round(rmin, 3)
    report["summary"] = S
    return report

def load_fixture(fx):
    j = lambda n: json.load(open(os.path.join(fx, n))) if os.path.exists(os.path.join(fx, n)) else None
    return j("expected_findings.json"), j("_ref_index.json"), j("reference_ranking.json")

def main(argv):
    here = os.path.dirname(os.path.abspath(__file__))
    fx = os.path.abspath(argv[argv.index("--fixture") + 1]) if "--fixture" in argv else os.path.join(here, "fixture")
    brief = json.load(open(argv[1])); exp, ri, rr = load_fixture(fx)
    report = score(brief, exp, ri, rr); gate = report["summary"]["gate"] == "PASS"
    if "--json" in argv:
        print(json.dumps(report, indent=2)); print("GATE:", "PASS" if gate else "FAIL", file=sys.stderr); return 0 if gate else 1
    for r in report["findings"]:
        print(f'{r["id"]:<4} matched={str(r["matched"]):<5} via={str(r["matched_unit"]):<34} rank={str(r["rank"]):<4} expect={str(r["rank_expectation"]):<26} rank_ok={r["rank_ok"]}  facts={r["key_fact_score"]}')
    for k in ("required_elements", "labels", "rank_constraints"):
        for x in report[k]: print(f"  {k}: {x}")
    print(json.dumps(report["summary"], indent=2))
    print("GATE:", "PASS" if gate else "FAIL"); return 0 if gate else 1

if __name__ == "__main__":
    sys.exit(main(sys.argv))
