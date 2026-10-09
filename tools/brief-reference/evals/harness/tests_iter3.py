"""Zero-cost checks for iteration 3 (no network, no model). Run from evals/: /tmp/stvenv/bin/python -m harness.tests_iter3
Synthetic unit tests for the generic scorer constructs (synthetic brief + synthetic answer key, no project data), the code-only
notice windows (CTO guardrails), banned legal-conclusion phrases, the no-exposure ranking rule, PM rules 2-4 and de-hardcoding."""
import copy, datetime as dt, importlib.util, json, os, shutil, sys, tempfile
from .fixture_tools import FixtureTools, fixture_settings
from . import notices
from .ranker import rank, verify_request
from .verifier import legal_hits, verify_insights, verify_brief
EVALS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("score_brief", os.path.join(EVALS, "score_brief.py")); SB = importlib.util.module_from_spec(spec); spec.loader.exec_module(SB)
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or bool(c)
res = []

# ---------------- A. scorer: synthetic brief + key (FICTIONAL "Test Tower") ----------------
def cite(r): return {"ref": r, "label": r}
def top(n, refs, conf="Likely", text="", action="", dd=None):
    t = {"item_id": f"T{n}", "rank": n, "headline": f"item {n} {text}", "body": "", "action": {"text": action, "due": "2030-01-02"}, "impact": {"method": "x"},
         "confidence": conf, "citations": [cite(r) for r in refs]}
    if dd: t["decision_deadline"] = {"date": dd, "kind": "x"}
    return t
def brief(tops, sections=None, fresh=None, words=100):
    S = {k: [] for k in ("schedule_risks", "cost_risks", "overdue_rfis", "overdue_submittals", "procurement_issues", "new_decisions", "unresolved_decisions", "significant_emails", "action_items")}
    S.update(sections or {})
    return {"top_items": tops, "sections": S, "freshness": fresh or [], "closed_since_last": [], "status": {"lines": []}, "gaps": [], "metrics": {"word_count_main": words}}
KEY = {"findings": [
    {"id": "A", "must_surface": True, "required_citations": ["x:rfi:1", "x:email:1"], "min_citations_matched": 1, "key_facts": {}, "reference_rank": 1, "rank_expectation": "top 2",
     "required_elements": [{"section": "management_attention", "value": "2030-03-15", "gate": True}], "forbidden_label": ["Confirmed"]},
    {"id": "B", "must_surface": True, "required_citations": ["x:po:2"], "min_citations_matched": 1, "key_facts": {}, "reference_rank": 2, "expected_label": "Signal"}],
    "must_not_flag": [{"id": "N1", "ref": "x:sub:9", "scope": "top_items_only"}, {"id": "N2", "ref": "x:sub:8"},
                      {"id": "N3", "check": {"type": "text_pattern", "pattern": r"because of (the )?rain"}}],
    "rank_constraints": [{"above": "A", "below": "B", "gate": True}],
    "required_freshness_disclosures": [{"source": "schedule", "must_state": "data date 2030-01-01", "freshness_band": "aging (9 days)"},
                                       {"source": "email", "must_state": "Only box@test.example is covered"}, {"source": "procore", "must_state": "Nightly sync time"}]}
FR = [{"source": "schedule", "band": "aging", "data_date": "2030-01-01"}, {"source": "msgraph_outlook", "band": "fresh", "scope_note": "Only box@test.example is covered"},
      {"source": "procore", "band": "fresh", "last_successful_sync": "2030-01-10T04:45:00-05:00"}]
act = lambda unb, text: {"action_id": "A1", "text": text, "owner": {"name": "x"}, "due": "2030-03-14", "unblocks": unb}
good = brief([top(1, ["x:rfi:1"], "Likely", "notice", "respond", "2030-03-15"), top(2, ["x:po:2"], "Signal")], fresh=FR)
r = SB.score(good, KEY); s = r["summary"]
res.append(ok(s["gate"] == "PASS" and s["required_elements_ok"] == "1/1" and s["labels_ok"] == "2/2" and s["rank_constraints_ok"] == "1/1" and s["freshness_disclosures_ok"] == "3/3"
              and s["status_items_ok"] == "none configured" and s["fabricated_refs"] == "no _ref_index.json" and "no reference_ranking" in s["top7_overlap_with_reference"],
              f"scorer synthetic: all constructs pass; optional status items/ref index/reference ranking absent -> {s['gate']}"))
b2 = brief([top(1, ["x:rfi:1"], "Likely", "notice"), top(2, ["x:po:2"], "Signal")], {"action_items": [act(["T1"], "respond by 3/15")]}, fresh=FR)
res.append(ok(SB.score(b2, KEY)["summary"]["required_elements_ok"] == "1/1", "required_elements: date as M/D in an action item that unblocks the matched top item"))
b3 = brief([top(1, ["x:rfi:1"], "Likely", "notice"), top(2, ["x:po:2"], "Signal", "due 3/15")], {"action_items": [act(["T2"], "by 3/15")]}, fresh=FR)
r3 = SB.score(b3, KEY)
res.append(ok(r3["summary"]["required_elements_ok"] == "0/1" and r3["summary"]["gate"] == "FAIL" and "A:management_attention" in r3["summary"]["gated_constructs_failed"],
              "required_elements (related scope): date on another item does not count; gated -> FAIL"))
k_sec = copy.deepcopy(KEY); k_sec["findings"][0]["required_elements"][0]["scope"] = "section"
res.append(ok(SB.score(b3, k_sec)["summary"]["required_elements_ok"] == "1/1", "required_elements scope=section: anywhere in the section counts"))
k_ng = copy.deepcopy(KEY); k_ng["findings"][0]["required_elements"][0]["gate"] = False
res.append(ok(SB.score(b3, k_ng)["summary"]["gate"] == "PASS", "required_elements ungated: informational only"))
b4 = brief([top(1, ["x:rfi:1"], "Confirmed", "", "", "2030-03-15"), top(2, ["x:po:2"], "Likely")], fresh=FR); r4 = SB.score(b4, KEY)
res.append(ok(r4["summary"]["labels_ok"] == "0/2" and r4["summary"]["gate"] == "PASS", "labels: forbidden Confirmed and expected Signal both flagged; label_gate false -> informational"))
k_lg = copy.deepcopy(KEY); k_lg["findings"][1]["label_gate"] = True
res.append(ok(SB.score(b4, k_lg)["summary"]["gate"] == "FAIL", "labels: label_gate true -> FAIL"))
b5 = brief([top(1, ["x:po:2"], "Signal"), top(2, ["x:rfi:1"], "Likely", "", "", "2030-03-15")], fresh=FR); r5 = SB.score(b5, KEY)
res.append(ok(r5["rank_constraints"][0]["ok"] is False and r5["summary"]["gate"] == "FAIL", "rank constraint A above B violated (gated) -> FAIL"))
k_rc = copy.deepcopy(KEY); k_rc["rank_constraints"][0]["gate"] = False
res.append(ok(SB.score(b5, k_rc)["summary"]["gate"] == "PASS", "rank constraint ungated -> informational"))
b6 = brief([top(1, ["x:rfi:1"], "Likely", "", "", "2030-03-15"), top(2, ["x:po:2"], "Signal")], {"overdue_submittals": [{"ref": "x:sub:9"}]}, fresh=FR)
res.append(ok(SB.score(b6, KEY)["summary"]["must_not_flag_violations"] == 0, "trap scope top_items_only: trap record in a section is NOT a violation"))
b7 = brief([top(1, ["x:rfi:1"], "Likely", "", "", "2030-03-15"), top(2, ["x:po:2"], "Signal"), top(3, ["x:sub:9"])], fresh=FR)
res.append(ok(SB.score(b7, KEY)["summary"]["must_not_flag_violations"] == 1, "trap scope top_items_only: trap record as a top item IS a violation"))
b8 = brief([top(1, ["x:rfi:1"], "Likely", "", "", "2030-03-15"), top(2, ["x:po:2"], "Signal")], {"overdue_submittals": [{"ref": "x:sub:8"}],
           "schedule_risks": [{"headline": "slab late because of the rain", "citations": [cite("x:log:1")]}]}, fresh=FR)
res.append(ok(SB.score(b8, KEY)["summary"]["must_not_flag_violations"] == 2, "trap default scope (anywhere) + text_pattern trap"))
bad_fr = [dict(FR[0], band="fresh"), dict(FR[1], scope_note="all mail"), {"source": "procore", "band": "fresh"}]
rf = SB.score(brief(good["top_items"], fresh=bad_fr), KEY)
res.append(ok(rf["summary"]["freshness_disclosures_ok"] == "0/3" and rf["summary"]["gate"] == "FAIL", "freshness (generic): wrong band, missing mailbox scope, no sync time -> 0/3 FAIL"))
k_st = copy.deepcopy(KEY); k_st["status_items"] = [{"id": "S1", "checks": [{"type": "in_section", "section": "overdue_submittals", "ref": "x:sub:8"}, {"type": "not_in_top", "ref": "x:sub:8"}]},
                                                    {"id": "S2", "expectation": "prose only"}]
rs = SB.score(b8, k_st)
res.append(ok(rs["summary"]["status_items_ok"] == "1/1" and rs["status_items"][1]["ok"] is None, "status items: machine checks scored; prose-only item human-judged (skipped)"))
res.append(ok(SB.score(brief([top(1, ["x:rfi:1"])], fresh=FR), KEY)["summary"]["recall"] == 0.5, "recall_min default (miss at most one) -> 1/2 fails gate"))
ak = json.load(open(os.path.join(os.path.dirname(EVALS), "schemas", "answer_key.schema.json")))
import jsonschema
res.append(ok(not list(jsonschema.Draft202012Validator(ak).iter_errors(KEY)) and not list(jsonschema.Draft202012Validator(ak).iter_errors(json.load(open(os.path.join(EVALS, "fixture", "expected_findings.json"))))),
              "answer_key.schema.json validates the synthetic key and the Linden Yard key"))

# ---------------- B. notice windows: configured periods only ----------------
T = FixtureTools(); E105 = "msgraph_outlook:message:msg_E105"
n = notices.for_notice_email(T, E105)
res.append(ok(n["deadline"] == "2026-10-15" and n["status"] == "computed" and n["sub_windows"] and n["sub_windows"][0]["deadline"] == "2026-10-01"
              and "may be running" in n["display"], f"notice: owner-GC 21 cd from ASI-07 9/24 -> {n['deadline']}; GC-sub 7 cd -> 10/1 shown as fact"))
T2 = FixtureTools(); T2.project = copy.deepcopy(T.project); T2.project["notice_periods"] = []
n2 = notices.for_notice_email(T2, E105)
res.append(ok(n2["deadline"] is None and n2["status"] == "deadline_unknown" and n2["display"].startswith("Deadline unknown, check the contract"),
              "notice: no configured row -> deadline null + 'Deadline unknown, check the contract' (no default days)"))
T3 = FixtureTools(); T3.project = copy.deepcopy(T.project)
T3.project["notice_periods"] = [dict(T.project["notice_periods"][0], days=5, day_basis="business", trigger="notice_received")]
n3 = notices.for_notice_email(T3, E105)
exp3 = T3.cal.add_wd(dt.date(2026, 10, 6), 5).isoformat()
res.append(ok(n3["deadline"] == exp3, f"notice: business-day basis on the project holiday calendar from notice receipt -> {n3['deadline']}"))
rec = T3.index[E105][1]; saved = rec["received_at"]
rec["received_at"] = "2026-10-06T02:30:00Z"   # 10:30 PM 10/5 in America/New_York
n4 = notices.for_notice_email(T3, E105); rec["received_at"] = saved
res.append(ok(n4["notice_received_local"] == "2026-10-05", f"notice: UTC receivedDateTime converted to project tz before counting (02:30Z -> {n4['notice_received_local']} local)"))
rec["source_flag"] = "bcc_fallback"; n5 = notices.for_notice_email(T3, E105); rec.pop("source_flag")
res.append(ok(n5["deadline"] is None and n5["status"] == "verify_notice_date" and "verify notice date" in n5["display"], "notice: forward/BCC source flag -> 'verify notice date', no firm deadline"))
q = {"type": "notice_window", "params": {"event_date": "2026-09-24"}, "inputs_refs": [E105], "basis_ref": E105, "basis_quote": "Notice of delay"}
r_, v_ = verify_request(T, q, {E105}); res.append(ok(r_ is None and "code" in v_["reason"], "model-proposed notice window rejected (code computes notice deadlines only)"))
src = open(os.path.join(os.path.dirname(__file__), "notices.py")).read() + open(os.path.join(os.path.dirname(__file__), "impact.py")).read()
res.append(ok("notice_days" not in src and "contract_terms" not in src, "no contract_terms/notice_days default left in notices.py / impact.py"))
tmp = tempfile.mkdtemp(); shutil.copytree(os.path.join(EVALS, "fixture"), os.path.join(tmp, "fx"))
pj = json.load(open(os.path.join(tmp, "fx", "project.json"))); pj.pop("timezone"); json.dump(pj, open(os.path.join(tmp, "fx", "project.json"), "w"))
try: FixtureTools(fixture_dir=os.path.join(tmp, "fx")); res.append(ok(False, "missing timezone must raise"))
except ValueError: res.append(ok(True, "project.json without `timezone` is rejected (no default zone)"))
# notice item is pinned (floor) with no $ and with unknown deadline
F = {"n": {"finding_id": "n", "rule_id": "EMAIL-NOTICE-LANGUAGE", "severity": "high", "citations": []}}
F.update({f"c{i}": {"finding_id": f"c{i}", "rule_id": "COST-X", "severity": "medium", "citations": []} for i in range(9)})
ins = [{"key": f"c{i}", "finding_ids": [f"c{i}"], "confidence": "Likely", "impacts": [{"type": "usd_sum", "kind": "escalation", "total_usd": 1000 * (i + 1)}]} for i in range(9)]
ins.append({"key": "notice", "finding_ids": ["n"], "confidence": "Likely", "decision_deadline_verified": {"date": "2026-10-07", "kind": "model"}, "impacts": [dict(n2, finding_id="n")]})
top_, _ = rank(T, ins, F); nn = next(i for i in ins if i["key"] == "notice")
res.append(ok("notice" in top_ and "notice_window" in nn["floors"] and nn["deadline"] is None, "formal notice pinned to top 7 with $0; model deadline ignored, unknown deadline stays null"))

# ---------------- C. legal-conclusion ban ----------------
res.append(ok(all(legal_hits(x) for x in ["Polar's rights are waived", "the claim is accepted", "time-barred", "Polar is entitled to costs", "notice was late"])
              and not any(legal_hits(x) for x in ["response window may be running", "notice received 10/6", "we reserve our rights"]), "banned legal phrases detected; risk wording allowed"))
kept, verdicts, _ = verify_insights([{"insight_id": "i1", "narrative_claims": [{"text": "Polar waived its rights under 9.3", "citations": [{"ref": E105}]},
                                                                             {"text": "Polar sent notice of delay", "citations": [{"ref": E105}]}]}], T, {}, [])
res.append(ok(len(kept[0]["narrative_claims"]) == 1 and any("legal_conclusion" in v.get("reasons", []) for v in verdicts), "verify_insights drops a legal-conclusion claim"))
raw = {"status": {"lines": []}, "top_items": [{"item_id": "T1", "rank": 1, "headline": "Polar notice", "body": "Response window may be running. The claim is accepted by the owner.",
       "action": {"text": "Review", "due": "2026-10-07"}, "citations": [{"ref": E105}], "tag": "NEW", "confidence": "Likely", "impact": {"method": "x"}}], "sections": {}, "watching": [], "gaps": []}
rows = {"overdue_rfis": [], "overdue_submittals": []}
b, rep = verify_brief(raw, T, {E105}, {"metrics": {}}, rows)
res.append(ok(b["top_items"][0]["body"] == "Response window may be running." and rep["legal_conclusions_removed"], "verify_brief removes the legal-conclusion sentence and reports it"))

# ---------------- D. ranking: no-exposure items by severity, then due date ----------------
SEVF = {s: {"finding_id": s, "rule_id": "DEC-X", "severity": s, "citations": []} for s in ("low", "medium", "high", "critical")}
mk = lambda k, sev, dl=None, cost=0: {"key": k, "finding_ids": [sev], "confidence": "Likely", "decision_deadline_verified": {"date": dl, "kind": "x"} if dl else None,
                                       "impacts": [{"type": "usd_sum", "kind": "at_risk", "total_usd": cost}] if cost else []}
ins = [mk("credit_soon", "medium", "2026-10-07"), mk("risk_high_late", "high", "2026-10-20"), mk("exposure_small", "low", None, 500), mk("risk_high_soon", "high", "2026-10-09")]
_, order = rank(T, ins, SEVF)
res.append(ok(order == ["exposure_small", "risk_high_soon", "risk_high_late", "credit_soon"], f"no-$ items below any $ item, then severity, then due date: {order}"))

# ---------------- E. PM rules 2-4 + de-hardcode on the fixture (code only) ----------------
from .rules_engine import run_rules
from .candidates import default_impacts
fs = run_rules(T, T.as_of); FF = {f["finding_id"]: f for f in fs}
dsc = [f for f in fs if f["rule_id"] == "COST-DIFFERING-SITE-CONDITION"]
imps = default_impacts(T, dsc[0]) if dsc else []
res.append(ok(dsc and any(x.get("type") == "usd_sum" and x.get("own_line") and x["total_usd"] == 145000 for x in imps)
              and any(x.get("kind") == "site_condition_owner_notice_flag" and "Owner notice may be required" in x["display"] and x["deadline"] is None for x in imps),
              "DSC: own exposure line (linked CE ROM) + owner-notice flag; no configured DSC period -> 'deadline unknown, check the contract'"))
from .stages.rank import code_item
dw = [f for f in fs if f["rule_id"] == "SCH-DWG-REV-AFTER-APPROVAL"]
ci = code_item(T, dw[0], "CX", FF, dw[1:]) if dw else {}
res.append(ok(dw and "approved before revision, confirm fabrication hold" in ci["headline"] and set(ci["finding_ids"]) == {f["finding_id"] for f in dw},
              f"DWG-rev-after-approval: one code-owned item per submittal: {ci.get('headline', '')[:90]}"))
from .stages import rules as RS, verify as VS
ro, _ = RS.run(T); mats = VS.materials(T, {"rows": []}, ro, {})
pav = next((d for d in mats["unresolved_decisions"] if "paver" in (d.get("summary") or "").lower()), None)
# M1/M2: COST-BUYOUT-GAP disabled — paver DEC may no longer share a cluster with submit-by; blocking date optional.
# Keep the materials path healthy: unresolved decisions still emit for the open owner item.
res.append(ok(pav is not None and pav.get("kind") == "pending",
              f"open owner paver decision still in unresolved_decisions (M1/M2: buyout cluster link deferred): {pav and pav.get('cost_of_waiting')}"))
T4 = FixtureTools(); T4.project = copy.deepcopy(T.project); T4.project["key_milestones"][0]["name"] = "Substantial Completion"
T4.milestone_name = "Substantial Completion"
for u in T4.sched["updates"]: u["source"] = "procore_schedule"
mfs = [f for f in run_rules(T4, T4.as_of) if f["rule_id"] == "SCH-FLOAT-EROSION"]
from .impact import compute_impact
x = compute_impact(T4, "delay_chain", {"activity_ids": ["A3050"], "slip_wd": 15}, ["p6:activity:A3050"])
res.append(ok("Substantial Completion" in x["method"] and "TCO" not in x["method"] and "XER" not in x["method"] and "Procore schedule" in x["method"],
              f"milestone name and schedule-source label come from project.json/schedule: {x['method'][:110]}"))
src = "".join(open(os.path.join(os.path.dirname(__file__), p)).read() for p in ("impact.py", "stages/rules.py", "stages/read.py", "rules_engine.py", "candidates.py", "ranker.py", "stages/deliver.py", "stages/rank.py", "stages/verify.py", "notices.py"))
import re as _re
res.append(ok(not _re.search(r"\"TCO\"|'TCO'|XER U2|2026-09-28|2026-10-0[0-9]\"", src), "no 'TCO' / 'XER U2' / fixture-date literals in the five stages + rules"))
pj["timezone"] = "America/New_York"; json.dump(pj, open(os.path.join(tmp, "fx", "project.json"), "w"))
s1 = fixture_settings(os.path.join(tmp, "fx"), None, {})
s2 = fixture_settings(os.path.join(tmp, "fx"), {"as_of": "2026-10-06", "compare_to": "2026-10-05", "cutoff_at": "2026-10-07T05:00:00-04:00"}, {"cutoff_at": "2026-10-07T06:00:00-04:00"})
res.append(ok(s1["as_of"] == "2026-10-06" and s1["compare_to"] == "2026-10-05" and s1["cutoff_at"].startswith("2026-10-07T04:45") and "derived" in s1["_sources"]["cutoff_at"]
              and s2["cutoff_at"] == "2026-10-07T06:00:00-04:00" and s2["_sources"]["cutoff_at"] == "cli",
              "per-fixture settings: derived from the fixture when no yaml/CLI; CLI > harness_fixture.yaml"))
shutil.rmtree(tmp, ignore_errors=True)
print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)
