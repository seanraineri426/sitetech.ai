#!/usr/bin/env python3
"""Build + validate the SiteTech intelligence eval fixture and M1 seed rows.
*** ALL DATA PRODUCED IS FICTIONAL. ***  Deterministic (uuid5, no randomness).  Usage: python3 build_fixture.py"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "src"))
from p3_comms_key import *

def dump(rel, obj):
    p = os.path.join(HERE, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as fh: json.dump(obj, fh, indent=2); fh.write("\n")

def main():
    r1, r2, s1, s2 = rfis_for(DAY1), rfis_for(DAY2), submittals_for(DAY1), submittals_for(DAY2)
    f1 = carry_lifecycle([], m1_findings(DAY1, r1, s1), DAY1)
    f2 = carry_lifecycle(f1, m1_findings(DAY2, r2, s2), DAY2)
    sched, logs, comm, bud, ces, dwg, em, mt, exp = (schedule_doc(), daily_logs(), commitments(), budget(), change_events_doc(),
                                                     drawing_revisions(), emails(), meetings(), expected())
    for rel, obj in [("project.json", project), ("m1/day1/rfis.json", r1), ("m1/day2/rfis.json", r2), ("m1/day1/submittals.json", s1),
                     ("m1/day2/submittals.json", s2), ("m1/day1/findings.json", f1), ("m1/day2/findings.json", f2),
                     ("m2/emails.json", em), ("m2/meetings.json", mt), ("m3/schedule.json", sched), ("m3/daily_logs.json", logs),
                     ("m3/commitments.json", comm), ("m3/budget.json", bud), ("m3/change_events.json", ces),
                     ("m3/drawing_revisions.json", dwg), ("expected_findings.json", exp)]:
        dump(rel, obj)
    # ---------- reference index + dangling-ref check
    refs = {f"procore:rfi:{r['external_id']}" for r in r1 + r2} | {f"procore:submittal:{s['external_id']}" for s in s1 + s2}
    refs |= {a["ref"] for a in sched["activities"]} | {u["ref"] for u in sched["updates"]} | {l["ref"] for l in logs["logs"]}
    for c in comm["commitments"]: refs.add(c["ref"]); refs |= {i["ref"] for i in c["invoices"]}
    refs |= {b["ref"] for b in bud["snapshots"]} | {c["ref"] for sn in ces["snapshots"] for c in sn["change_events"]}
    refs |= {d["ref"] for d in dwg["drawing_revisions"]} | {e["ref"] for e in em["emails"]}
    for m in mt["meetings"]: refs.add(m["ref"]); refs |= {i["ref"] for i in m["items"]}
    refs |= {ct["doc_ref"] for ct in project["contract_terms"]}
    missing = [(x["id"], r) for x in exp["findings"] for r in x["required_citations"] if r not in refs]
    missing += [(x["id"], r) for x in exp["status_items"] for r in x["refs"] if r not in refs]
    missing += [(x["id"], x["ref"]) for x in exp["must_not_flag"] if x["ref"] not in refs]
    missing += [(x["fingerprint"], c["ref"]) for x in f1 + f2 for c in x["citations"] if c["ref"] not in refs]
    assert not missing, f"dangling refs: {missing}"
    # ---------- numeric facts used by the answer key and the example brief
    c2 = bud["snapshots"][1]["owner_contingency"]
    assert c2["remaining_after_pending_usd"] == 95000 and abs(c2["pct_used_incl_pending"] - 0.924) < 1e-9
    tf = {(a["schedule_update_id"], a["activity_id"]): a["total_float_wd"] for a in sched["activities"]}
    assert (tf[("U1", "A1230")], tf[("U2", "A1230")]) == (8, 3) and (tf[("U1", "A3050")], tf[("U2", "A3050")]) == (15, 10)
    assert add_wd(D(2027, 8, 27), 7) == D(2027, 9, 8) and (D(2027, 9, 8) - D(2027, 8, 27)).days == 12   # Labor Day skipped
    assert wd_between(D(2026, 11, 9), D(2026, 11, 23)) == 10
    assert 10 - wd_between(D(2026, 9, 28), DAY2) == 4
    assert round(486500 * 0.04) == 19460
    wa = {"A1450": (15, 1.0), "A1490": (10, 1.0), "A1500": (15, 3 / 15), "A1510": (15, 0), "A1520": (15, 0), "A1530": (10, 0)}
    earned = sum(d * p for d, p in wa.values()) / sum(d for d, _ in wa.values())
    over = round((0.62 - earned) * 2600000)
    assert abs(earned - 0.35) < 0.01 and over == 702000, (earned, over)
    def get(fs, rule, ext): return [x for x in fs if x["rule_id"] == rule and x["external_id"] == ext]
    assert get(f2, "RFI-OVERDUE", "9042")[0]["days_overdue"] == 7
    assert get(f2, "SUB-REVIEW-OVERDUE", "6103")[0]["days_overdue"] == 5
    assert get(f2, "RFI-OVERDUE", "9038")[0]["status"] == "resolved"
    assert get(f2, "SUB-ROS-RISK", "6203")[0]["evidence"]["computed.margin_days"] == 0
    assert get(f2, "SUB-ROS-RISK", "6203")[0]["governing_date"] == "2026-10-21"
    assert get(f2, "SUB-REV-LOOP", "6203")[0]["evidence"]["rr_count"] == 3
    assert get(f2, "SUB-SUBMIT-BY-MISSED", "6501")[0]["days_overdue"] == 3
    assert all(isinstance(x["days_overdue"], int) and x["days_overdue"] >= 0 for x in f1 + f2)
    dump("_ref_index.json", sorted(refs))
    print(f"framing schedule-earned {earned:.3f}; overbilling est ${over:,}")
    print(f"refs indexed: {len(refs)} | day1 findings: {len(f1)} | day2 findings: {len(f2)}")
    for x in f2:
        print(f"  {x['rule_id']:<21} {x['record_label']:<30} sev={x['severity']:<8} days_overdue={x['days_overdue']:<3} {x['status']:<8} {x['change_since_prior_run']}")
    print("OK: fixture written and validated")

if __name__ == "__main__":
    main()
