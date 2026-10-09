"""Stage 5 `deliver` (Inngest step "deliver"). Iteration 2: code assembles the brief; the model only words it.
  1. writer (LLM, effort low, json_object, WRITER contract): headline/body/action wording for the code-chosen top items
  2. numeric grounding of writer text against the item's verified evidence (ungrounded sentences removed; headline falls back to the
     verified insight headline / finding title)
  3. code assembly: status lines (templates), top items (impact/score/owner/action/citations/tag/delta from code), sections, decisions,
     emails, action items, gaps, closed_since_last
  4. pre-publish gate verify_brief (citations resolve + come from verified evidence, <=7 items, <=700 words, schema, loose ID-shaped
     strings scrubbed); deterministic trim if over length; render; save
Input: read + rules + verify outputs (+ rank for raw LLM outputs). Output: {writer_raw, brief, gate_report, coverage_report, paths}.
Tier: T1 save_brief. External delivery (email/Slack) = T2, recorded as approval-required, disabled_in_v1."""
import copy, datetime as dt, importlib.util, json, os, re
import jsonschema
from . import Actions
from ..cost_guard import BudgetExceeded
from .. import context as C
from ..contracts import WRITER
from ..calendar_util import d_
from ..ranker import fmt_delta
from ..verifier import verify_brief, word_count_main, SCHEMA, walk_refs, nums, grounded, pool_from, REF_RE

LOOSE = re.compile(r"\b(?:procore|p6|msgraph_outlook|msgraph_sharepoint|procore_schedule|sitetech|weather)[:][a-z_]+[:][A-Za-z0-9_.\-]*[A-Za-z0-9_]")
SECTIONS_ENTRY = ("schedule_risks", "cost_risks", "procurement_issues")
PREFIX_SECTION = {"SCH": "schedule_risks", "COST": "cost_risks", "PROC": "procurement_issues", "RFI": "schedule_risks", "SUB": "procurement_issues",
                  "DEC": "cost_risks", "EMAIL": "schedule_risks"}

def prompt(name): return open(os.path.join(C.INTEL, "prompts", name + ".md")).read()

def trim_bodies(brief, limit=700):
    while word_count_main(brief) > limit:
        t = max(brief["top_items"], key=lambda t: len(t["body"].split()))
        s = re.split(r"(?<=[.;])\s+", t["body"].strip())
        if len(s) <= 1: break
        t["body"] = " ".join(s[:-1])
    brief["metrics"]["word_count_main"] = word_count_main(brief)

def invented(T, obj):
    """refs that do not resolve: in `ref`-like fields anywhere + ID-shaped strings in free text."""
    s = json.dumps(obj, ensure_ascii=False)
    return sorted({m for m in LOOSE.findall(s) if not T.resolvable(m)})

def short_label(T, ref):
    t, r = T.index[ref]
    md = lambda s: f"{int(s[5:7])}/{int(s[8:10])}" if s and len(s) >= 10 else ""
    if t in ("rfi", "submittal"): return r["label"]
    if t == "email": return f"Email: {r['from'].split(' <')[0]} {md(r['received_at'])}"
    if t == "activity": return f"{r['activity_id']} {r['name']}"
    if t == "change_event": return f"{r['number']} {r.get('title', '')}".strip()
    if t == "commitment": return f"{r['number']} {r['vendor']}"
    if t == "requisition": return f"Pay app #{r['number']} {r['vendor']}"
    if t == "meeting_item": return f"{r['meeting']} item {r['number']}"
    if t == "budget_snapshot": return f"Owner budget {md(r['snapshot_date'])}"
    if t == "drawing_revision": return f"{r['number']} Rev {r['revision']}"
    if t == "schedule_update": return f"Schedule {r['schedule_update_id']} (data date {md(r['data_date'])})"
    if t == "document": return "Contract: " + ", ".join(c["clause"] for c in r["clauses"])[:100]
    return f"{t.replace('_', ' ')} {md(r.get('log_date') or r.get('date') or '')}".strip()

def person(T, directory, name, fallback_names):
    by = {p["name"].lower(): p for p in directory}
    for n in [name] + fallback_names:
        if n and n.lower() in by:
            p = by[n.lower()]; return {"name": p["name"], "role": p.get("title", ""), "company": p.get("company", "")}, n == name
    gcpm = next((p for p in directory if "project manager" in p.get("title", "").lower()), directory[0])
    return {"name": gcpm["name"], "role": gcpm.get("title", ""), "company": gcpm.get("company", "")}, False

def due_from(T, deadline):
    if deadline and d_(deadline["date"]) > T.as_of:
        d = d_(deadline["date"]) - dt.timedelta(days=1)
        while not T.cal.is_wd(d): d -= dt.timedelta(days=1)
        return max(d, T.as_of).isoformat()
    return T.cal.add_wd(T.as_of, 1).isoformat()

def grounded_text(text, pool, keep_sentences=True):
    """Remove sentences whose numbers are not in the pool. Returns (text, removed)."""
    out, removed = [], []
    for s in re.split(r"(?<=[.;!?])\s+", (text or "").strip()):
        miss = [m for m, v, p in nums(s) if not grounded(v, p, pool, m.startswith("~"))]
        (removed if miss else out).append(s)
    return " ".join(out).strip(), removed

STOP = set("this that with from have been will into than then they their there what when which while would could should about after before other these those only still under over same such more most also must does were each".split())
def on_topic(text, corpus, thr=0.35):
    """Writer text must be about THIS item: share of its content words (>=4 letters) found in the item's verified facts / headline /
    impacts / owner. Guards against a writer answer aligned to the wrong item_id (numbers-free sentences would pass grounding)."""
    w = [x for x in re.findall(r"[a-z][a-z0-9\-]{3,}", (text or "").lower()) if x not in STOP]
    if not w: return True, 1.0
    c = set(re.findall(r"[a-z][a-z0-9\-]{3,}", corpus.lower())); r = sum(x in c for x in w) / len(w)
    return r >= thr, round(r, 2)

def item_impact(i, label):
    ex = i["exposure"]; imp = {"method": ""}; meth = []
    sched = [x for x in i["impacts"] if x.get("type") in ("delay_chain", "manpower_shortfall") and x.get("delay_usd")]
    if sched:
        b = max(sched, key=lambda x: x["delay_usd"])
        acts = list((b.get("activity_tf_wd") or {}).keys()) or ([b["activity"]] if b.get("activity") else [])
        imp["schedule"] = {"milestone_wd": int(b.get("milestone_wd") or 0), "milestone_cd": int(b.get("milestone_cd") or 0),
                           "activity_refs": [f"p6:activity:{a}" for a in acts], "label": label}
        if b.get("condition"): imp["schedule"]["condition"] = b["condition"][:200]
        imp["delay_usd"] = b["delay_usd"]; meth.append(b.get("method", ""))
    if ex["cost_usd"]:
        k = max(ex["cost_parts"], key=lambda p: p["usd"])["kind"]
        imp["cost"] = {"usd_low": ex["cost_usd"], "usd_high": ex["cost_usd"], "kind": k, "label": label}
        meth += [x.get("method", "") for x in i["impacts"] if x.get("type") == "usd_sum" and x.get("method")]
    meth += [x.get("method", "") for x in i["impacts"] if x.get("type") in ("contingency", "payapp_earned", "notice_window") and x.get("method")]
    imp["method"] = "; ".join(dict.fromkeys(m for m in meth if m))[:600] or "no quantified impact (code)"
    return imp

def _local_iso(T, hms):
    from zoneinfo import ZoneInfo
    return dt.datetime.fromisoformat(f"{T.as_of.isoformat()}T{hms}").replace(tzinfo=ZoneInfo(T.tz)).isoformat()

def _md(x): return f"{int(x[5:7])}/{int(x[8:10])}"

def notice_of(i):
    from ..ranker import notice_impact
    return notice_impact(i)

def entry_facts(T, i, F, label_of):
    """Iteration 3, task 1 (generic): record facts appended to a section entry: each record's due/governing date with days overdue and
    ball-in-court, open activities' total float with the schedule basis, slip basis, own $ exposure lines, notice/owner-notice flags."""
    parts = []
    fs = [F[f] for f in i["finding_ids"] if f in F]
    for f in fs:
        g = f.get("governing_date")
        if g:
            od = (T.as_of - d_(g)).days
            bic = f.get("ball_in_court"); bic = ", ".join(bic) if isinstance(bic, list) else bic
            parts.append(f'{f["record_label"]} {(f.get("governing_date_kind") or "due").replace("_", " ")} {_md(g)}'
                         + (f" ({od} day{'s' if od != 1 else ''} overdue)" if od > 0 else " (today)" if od == 0 else f" ({-od} day{'s' if od != -1 else ''} out)") + (f", BIC {bic}" if bic else ""))
    acts = dict.fromkeys(c["ref"] for f in fs for c in f["citations"] if T.index.get(c["ref"], ("",))[0] == "activity")
    for r in list(acts)[:2]:
        a = T.index[r][1]
        if a.get("total_float_wd") is not None and (a.get("pct_complete") or 0) < 100:
            parts.append(f'{a["activity_id"]} TF {a["total_float_wd"]} wd ({T.sched_label(a.get("schedule_update_id"))} {a.get("schedule_update_id")} data date {_md(a["data_date"])})')
    ex = i["exposure"]
    if ex.get("milestone_cd"):
        parts.append(f'slip up to {ex["milestone_cd"]} cd to {T.milestone_name} ({ex.get("milestone_wd")} wd beyond float, {"model scenario, quote-verified" if ex.get("schedule_basis") == "model_scenario" else "code"})')
    for p in ex.get("cost_parts") or []:
        lbl = ", ".join(str(label_of(r)).split(" ")[0] for r in p.get("refs") or [] if r in T.index)
        parts.append(f'${p["usd"]:,.0f} {p["kind"].replace("_", " ")}' + (f" ({lbl})" if lbl else " (pending PCO rise since compare-to)" if p["kind"] == "recognized" else ""))
    if any("counted once in totals" in n for n in ex.get("dedupe_notes") or []): parts.append("counted once in contingency totals")
    for x in i["impacts"]:
        if x.get("type") == "notice_window" and x.get("display"): parts.append(x["display"].rstrip("."))
    return "; ".join(dict.fromkeys(parts))

def run(T, R, cfg, read_out, rules_out, rank_out, verify_out, run_id, run_dir):
    A = Actions("deliver"); shared = C.read("prompts", "_shared_rules.md")
    F = {f["finding_id"]: f for f in rules_out["findings"]}
    ins = {i["key"]: i for i in verify_out["verified_insights"]}; top = [ins[k] for k in verify_out["top_keys"]]
    rows = rules_out["record_rows"]; sf = rules_out["status_facts"]; fr = read_out["freshness"]
    directory = read_out["shared"]["project_context"]["directory"]; ridx = read_out["shared"]["records_index"]
    band = next((f["band"] for f in fr if f["source"] == "schedule"), "fresh")
    label_of = lambda r: short_label(T, r)

    # ---- per-item code facts (also the writer's closed book) ----
    items = []
    for n, i in enumerate(top, 1):
        fs = [F[x] for x in i["finding_ids"]]
        chg = [f.get("change_since_prior_run") for f in fs]
        tag = "NEW" if "new" in chg else "WORSE" if "worse" in chg else "UNCHANGED"
        delta = fmt_delta([d for f in fs for d in (f.get("delta") or [])]) if tag == "WORSE" else ""
        if tag == "WORSE" and not delta: tag = "UNCHANGED"
        bic = [f.get("ball_in_court") for f in fs if f.get("ball_in_court")]
        owner, model_owner_ok = person(T, directory, (i.get("owner") or {}).get("name"), bic)
        cites = []
        for c in i["narrative_claims"]:
            for ci in c["citations"]:
                if ci["ref"] not in [x["ref"] for x in cites]: cites.append({"ref": ci["ref"], "label": str(label_of(ci["ref"]) or ci["ref"])[:120]})
        pool = pool_from([c["text"] for c in i["narrative_claims"]] + [T.index[c["ref"]][1] for c in cites] + fs + i["impacts"] +
                         [i["exposure"], i.get("deadline") or {}, delta])
        items.append({"n": n, "i": i, "fs": fs, "tag": tag, "delta": delta, "owner": owner, "model_owner_ok": model_owner_ok, "cites": cites, "pool": pool,
                      "due": due_from(T, i.get("deadline"))})
    writer_in = {"project": T.project["name"], "as_of": T.as_of.isoformat(), "daily_delay_cost_usd": T.project["delay_cost_basis"]["daily_delay_cost_usd"],
                 "items": [{"item_id": f"T{x['n']}", "tag": x["tag"], "delta_text": x["delta"], "confidence": x["i"]["confidence"],
                            "schedule_basis": band if any(m.get("type") in ("delay_chain", "manpower_shortfall") for m in x["i"]["impacts"]) else "n/a",
                            "facts": [c["text"] for c in x["i"]["narrative_claims"]], "mechanism": x["i"].get("mechanism", ""),
                            "impacts": [m.get("method") for m in x["i"]["impacts"] if m.get("method")][:4],
                            "exposure": {"schedule_usd": x["i"]["exposure"]["schedule_usd"], "milestone_cd": x["i"]["exposure"]["milestone_cd"],
                                         "cost_usd": x["i"]["exposure"]["cost_usd"]},
                            "deadline": x["i"].get("deadline"), "owner": x["owner"], "model_action": x["i"].get("action", ""), "action_due": x["due"],
                            "notice": (notice_of(x["i"]) or {}).get("display")}
                           for x in items]}
    try:
        wobj, wrep = R.llm_contract("brief_writer", shared + "\n\n" + prompt("brief_writer").split("**Output schema.**")[0] + C.WRITER_RT, writer_in, cfg["stages"]["writer"], WRITER)
    except BudgetExceeded:
        raise   # a cap hit aborts the run; never silently replaced by code fallbacks
    except Exception as e:
        print(f"  [writer] FAILED: {e}; using verified claim text", flush=True); wobj, wrep = {"items": [], "status_line": ""}, {"error": str(e)[:300]}
    A.add("llm:brief_writer (wording only, closed book)", "T1")
    wmap = {w.get("item_id"): w for w in wobj.get("items", [])}; wflags = []

    # ---- top items (code) ----
    top_items, action_items = [], []
    for x in items:
        i = x["i"]; w = dict(wmap.get(f"T{x['n']}", {})); pool = x["pool"]
        corpus = " ".join([i.get("headline", ""), i.get("mechanism", ""), i.get("action", ""), x["owner"]["name"], x["delta"]] +
                          [c["text"] for c in i["narrative_claims"]] + [m.get("method", "") + " " + str(m.get("condition") or "") for m in i["impacts"]] +
                          [c["label"] for c in x["cites"]] + [f["title"] for f in x["fs"]])
        for fld in ("headline", "body", "action_text", "definition_of_done"):
            ok_, r = on_topic(w.get(fld, ""), corpus)
            if not ok_: wflags.append({"item": f"T{x['n']}", "off_topic_" + fld: r, "text": w[fld][:120]}); w[fld] = ""
        hl, rm = grounded_text(w.get("headline", ""), pool)
        if rm or not hl: wflags.append({"item": f"T{x['n']}", "headline_fallback": rm or "empty"}); hl = grounded_text(i.get("headline", ""), pool)[0] or x["fs"][0]["title"]
        body, rm = grounded_text(w.get("body", ""), pool)
        if rm: wflags.append({"item": f"T{x['n']}", "body_sentences_removed": rm})
        if not body: body = " ".join(c["text"] for c in i["narrative_claims"][:2])
        act, rm = grounded_text(w.get("action_text", ""), pool)
        if rm or not act: act = grounded_text(i.get("action", ""), pool)[0] or f"{x['owner']['name']} to resolve: {hl}"
        dod, _ = grounded_text(w.get("definition_of_done", ""), pool)
        nt = notice_of(i)
        if nt and "notice_window" in (i.get("floors") or []):
            # PM rule 1 + CTO guardrails: code-computed response deadline (or "deadline unknown" / "verify notice date") is always shown
            act = (act.rstrip(". ") + ". " + nt["display"]).strip()
        for sc in [m for m in i["impacts"] if m.get("kind") == "site_condition_owner_notice_flag" and m.get("display")][:1]:
            act = (act.rstrip(". ") + ". " + sc["display"]).strip()   # PM rule 3: owner-notice flag on a differing site condition
        floor = (i.get("floors") or [None])[0]
        t = {"item_id": f"T{x['n']}", "rank": x["n"], "insight_id": i["key"], "finding_ids": i["finding_ids"], "tag": x["tag"],
             "section": i.get("section") if i.get("section") in SCHEMA["$defs"]["item"]["properties"]["section"]["enum"] else PREFIX_SECTION.get(x["fs"][0]["rule_id"].split("-")[0], "schedule_risks"),
             "headline": hl[:160], "body": body[:700], "confidence": i["confidence"],
             "confidence_note": f"schedule data is {band}" if band != "fresh" and "schedule" in item_impact(i, i["confidence"]) else "",
             "impact": item_impact(i, i["confidence"]),
             "score": {"value": float(i["exposure"]["schedule_usd"] or i["exposure"]["cost_usd"] or 0), "floor": floor},
             "owner": x["owner"], "action": {"text": act[:300], "due": x["due"]}, "claim_ids": [c["claim_id"] for c in i["narrative_claims"]],
             "citations": x["cites"]}
        if not t["confidence_note"]: t.pop("confidence_note")
        if dod: t["action"]["definition_of_done"] = dod[:200]
        if x["delta"]: t["delta_text"] = x["delta"]
        if i.get("deadline"): t["decision_deadline"] = {"date": i["deadline"]["date"], "kind": i["deadline"].get("kind", "deadline")[:60]}
        if nt and nt.get("method"): t["impact"]["method"] = (nt["method"] + "; " + t["impact"]["method"].replace(nt["method"], "").strip("; "))[:700]
        fx = entry_facts(T, i, F, label_of)   # task 1: record facts on top items too (rendered as a "Record facts" line; not main-body words)
        if fx: t["impact"]["method"] = ("Record facts: " + fx + " || " + t["impact"]["method"])[:1200]
        top_items.append(t)
        ai = {"action_id": f"A{x['n']}", "text": t["action"]["text"], "owner": x["owner"], "due": x["due"], "unblocks": [t["item_id"]]}
        if dod: ai["definition_of_done"] = dod[:200]
        action_items.append(ai)

    # ---- sections (code) ----
    sec = {k: [] for k in SCHEMA["properties"]["sections"]["required"]}; rendered = {}
    for t in top_items:
        if t["section"] in SECTIONS_ENTRY: sec[t["section"]].append({"item_id": t["item_id"], "headline": t["headline"], "citations": t["citations"][:2]})
    for k in verify_out["order"]:
        i = ins[k]
        if i["top_rank"]: continue
        s = i.get("section") if i.get("section") in SECTIONS_ENTRY else PREFIX_SECTION.get(F[i["finding_ids"][0]]["rule_id"].split("-")[0], "schedule_risks")
        row_fids = {r["finding_id"] for rr in rows.values() for r in rr}
        if all(f in row_fids or F[f]["rule_id"].startswith("DEC-") for f in i["finding_ids"]):
            continue   # fully represented by code record rows / decision register rows
        if i.get("section") not in SECTIONS_ENTRY:   # mixed insight (e.g. a late decision holding a submittal + buyout): keep it as an entry
            first = next(f for f in i["finding_ids"] if f not in row_fids and not F[f]["rule_id"].startswith("DEC-"))
            s = PREFIX_SECTION.get(F[first]["rule_id"].split("-")[0], "schedule_risks")
        pool = pool_from([c["text"] for c in i["narrative_claims"]] + [F[f] for f in i["finding_ids"]] + i["impacts"])
        hl = grounded_text(i.get("headline", ""), pool)[0] or F[i["finding_ids"][0]]["title"]
        cites = []
        for c in i["narrative_claims"]:
            for ci in c["citations"]:
                if ci["ref"] not in [y["ref"] for y in cites]: cites.append({"ref": ci["ref"], "label": str(label_of(ci["ref"]) or ci["ref"])[:120]})
        fx = entry_facts(T, i, F, label_of)
        e = {"headline": (hl[:200] + (" | " + fx if fx else ""))[:520], "confidence": i["confidence"], "citations": cites[:4]}
        o, _ = person(T, directory, (i.get("owner") or {}).get("name"), [F[f].get("ball_in_court") for f in i["finding_ids"] if F[f].get("ball_in_court")])
        e["owner"] = o
        if i.get("action"): e["action"] = grounded_text(i["action"], pool)[0][:200]
        sec[s].append(e); rendered[i["key"]] = s
    top_refs = {t["citations"][0]["ref"]: t["item_id"] for t in top_items}
    all_top_refs = {c["ref"]: t["item_id"] for t in top_items for c in t["citations"]}
    for key in ("overdue_rfis", "overdue_submittals"):
        for r in rows[key]:
            row = dict(r)
            if r["ref"] in all_top_refs: row["linked_item_id"] = all_top_refs[r["ref"]]
            sec[key].append(row)
    mats = verify_out["materials"]
    sec["new_decisions"] = copy.deepcopy(mats["new_decisions"]); sec["unresolved_decisions"] = copy.deepcopy(mats["unresolved_decisions"])
    sec["significant_emails"] = copy.deepcopy(mats["significant_emails"]); sec["action_items"] = action_items
    for d in sec["new_decisions"] + sec["unresolved_decisions"] + sec["significant_emails"]:
        if d.get("linked_item_id"):
            tk = d["linked_item_id"]; d["linked_item_id"] = next((t["item_id"] for t in top_items if t["insight_id"] == tk), None)
            if not d["linked_item_id"]: d.pop("linked_item_id")

    # ---- status (code templates) ----
    c = sf["contingency"]; ms = sf["milestone"]
    big = max(top_items, key=lambda t: t["impact"].get("delay_usd", 0), default=None)
    dl_week = sum(1 for t in top_items if t.get("decision_deadline") and d_(t["decision_deadline"]["date"]) <= T.cal.add_wd(T.as_of, 5))
    lines = [f"{ms['name']} forecast {ms['forecast']} vs baseline {ms['baseline']} ({ms['basis']}; schedule {band}).",
             f"Owner contingency {c['pct_used_incl_pending']:.1%} used incl. pending vs {c['pct_complete_cost']:.0%} complete; ${c['remaining_usd']:,.0f} remaining."]
    if big and big["impact"].get("delay_usd"):
        lines.append(f"Largest schedule exposure: {big['item_id']} up to {big['impact']['schedule']['milestone_cd']} cd x ${T.project['delay_cost_basis']['daily_delay_cost_usd']:,}/day = ${big['impact']['delay_usd']:,.0f} if not acted on.")
    status = {"health": sf["health"], "health_rule": sf["health_rule"], "lines": lines,
              "milestone": {k: v for k, v in ms.items() if k in ("name", "activity_ref", "baseline", "forecast", "basis")},
              "decisions_needed_this_week": dl_week, "items_flagged": len(ins), "items_shown": len(top_items)}

    # ---- gaps (code + model, as text) ----
    gaps = [{"source": "model", "reason": str(g)[:200], "effect": "flagged by an analyst; not verified"} for g in verify_out["gaps"][:4]]
    for cv in verify_out["coverage_high_missing"]:
        gaps.append({"source": "coverage", "reason": f"high-severity finding {cv['finding_id']} not represented", "effect": "see coverage_report.json"})
    if rank_out["comms"]["contract_report"].get("error"): gaps.append({"source": "msgraph_outlook", "reason": "email extraction failed", "effect": "email sections may be incomplete"})

    deterministic = {"_FICTIONAL": "ALL DATA IN THIS BRIEF IS FICTIONAL (eval fixture). Model-worded, code-ranked, code-verified.",
                     "schema_version": "1.0", "brief_id": f"brief-{T.project['project_id']}-{T.as_of.isoformat()}-{run_id}", "run_id": run_id, "version": 1,
                     "org_id": T.project["org_id"], "project_id": T.project["project_id"], "project_name": T.project["name"], "as_of": T.as_of.isoformat(),
                     "coverage": {"window_start": _local_iso(T, "00:00:00"), "window_end": _local_iso(T, "23:59:59"), "cutoff_at": cfg["fixture"]["cutoff_at"]},
                     "generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
                     "compare_to": {"as_of": T.compare_to.isoformat(), "brief_id": None, "basis": "prior_business_day_snapshot"},
                     "freshness": fr, "closed_since_last": rules_out["closed_since_last"],
                     "metrics": {"word_count_main": 0, "items_flagged_total": len(ins), "llm_cost_usd": None,
                                 "verifier": {k: verify_out["summary"][k] for k in ("claims_total", "passed", "downgraded", "dropped")} | {"independent_provider": False}}}
    raw = {"status": status, "top_items": top_items, "sections": sec, "watching": [], "gaps": gaps}
    allowed = set(walk_refs(raw)) | {sf["budget_ref"], ms.get("activity_ref")}
    brief, rep = verify_brief(raw, T, allowed, copy.deepcopy(deterministic), rows)
    A.add("pre-publish gate (code verify_brief)", "T0")
    if brief["metrics"]["word_count_main"] > 700:
        trim_bodies(brief); rep["flags"].append({"fix": f"deterministic body trim -> {brief['metrics']['word_count_main']} words"})
    brief["metrics"]["llm_cost_usd"] = round(R.cost(), 4)
    rep["writer_flags"] = wflags; rep["writer_contract"] = wrep
    rep["schema_errors_final"] = [f'{"/".join(map(str, e.path))}: {e.message[:200]}' for e in
                                  jsonschema.Draft202012Validator(SCHEMA, format_checker=jsonschema.FormatChecker()).iter_errors(brief)]
    # invented IDs before (all raw LLM outputs) / after (final brief)
    raw_llm = {"comms": rank_out["comms"].get("raw"), "clusters": {k: v.get("output") for k, v in rank_out["cluster_outputs"].items()}, "writer": wobj}
    rep["invented_ids_before_verifier"] = invented(T, raw_llm)
    rep["invented_ids_after_verifier"] = sorted(set(invented(T, brief)) | {r for r in walk_refs(brief) if not T.resolvable(r)})
    print(f"  [deliver:gate] schema_errors_final={len(rep['schema_errors_final'])} invented_before={rep['invented_ids_before_verifier']} "
          f"after={rep['invented_ids_after_verifier']} words={brief['metrics']['word_count_main']} flags={len(rep['flags'])}", flush=True)
    # coverage report (final): where each finding landed in the published brief
    pub_ins = {t["insight_id"]: t["item_id"] for t in brief["top_items"]}
    cov = []
    for cv in verify_out["coverage"]:
        cv = dict(cv)
        if cv["status"] == "top":
            cv["brief_item"] = pub_ins.get(cv["insight"])
            if not cv["brief_item"]: cv["status"] = "section"; cv["note"] = "dropped from top by gate"
        if cv["status"] == "section":   # must be backed by something actually rendered
            in_rows = any(r.get("finding_id") == cv["finding_id"] for k in ("overdue_rfis", "overdue_submittals") for r in brief["sections"][k])
            dec = F[cv["finding_id"]]["rule_id"].startswith("DEC-") and any(d.get("decision_ref") in {c["ref"] for c in F[cv["finding_id"]]["citations"]}
                                                                          for d in brief["sections"]["unresolved_decisions"])
            if in_rows: cv["where"] = "record row"
            elif dec: cv["where"] = "decision register row"
            elif cv.get("insight") in rendered: cv["where"] = rendered[cv["insight"]]
            else: cv["status"] = "MISSING"; cv["note"] = "insight not rendered in any section"
        cov.append(cv)
    hi = [c for c in cov if c["severity"] in ("high", "critical")]
    cov_rep = {"rule": "every high/critical finding is in the brief (top item or section) or set aside with a reason; nothing silently dropped",
               "high_or_critical_total": len(hi), "in_top": sum(c["status"] == "top" for c in hi), "in_sections": sum(c["status"] == "section" for c in hi),
               "set_aside_with_reason": sum(c["status"] == "set_aside" for c in hi), "auto_included_by_code": sum(c.get("origin") == "code_auto" for c in hi),
               "missing": [c["finding_id"] for c in hi if c["status"] == "MISSING"], "findings": cov,
               "pass": not any(c["status"] == "MISSING" for c in hi)}
    spec = importlib.util.spec_from_file_location("render_brief", os.path.join(C.INTEL, "examples", "render_brief.py"))
    rb = importlib.util.module_from_spec(spec); spec.loader.exec_module(rb)
    bp = os.path.join(run_dir, "brief_verified.json"); mp = os.path.join(run_dir, "brief_rendered.md"); cp = os.path.join(run_dir, "coverage_report.json")
    json.dump(brief, open(bp, "w"), indent=1, ensure_ascii=False); open(mp, "w").write(rb.render(brief)); json.dump(cov_rep, open(cp, "w"), indent=1)
    A.add("save_brief (brief JSON + rendered markdown + coverage report, run dir)", "T1", {"paths": [bp, mp, cp]})
    A.add("send_brief_email / post to Slack", "T2", {"reason": "external delivery requires approval; disabled_in_v1 (no Mail.Send)"})
    print(f"  [coverage] high/critical={cov_rep['high_or_critical_total']} top={cov_rep['in_top']} sections={cov_rep['in_sections']} "
          f"set_aside={cov_rep['set_aside_with_reason']} missing={cov_rep['missing']}", flush=True)
    return {"writer_raw": wobj, "writer_input": writer_in, "brief": brief, "gate_report": rep, "coverage_report": cov_rep,
            "brief_path": bp, "markdown_path": mp, "coverage_path": cp}, A
