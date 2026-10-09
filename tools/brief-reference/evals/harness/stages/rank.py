"""Stage 3 `rank` (Inngest step "rank"). Iteration 2: the model proposes, code decides.
  1. comms extraction (LLM, one call, per-email rows, capped) -> code scores significance (§4.9) and verifies quotes/links
  2. per-cluster LLM calls (parallel; one issue cluster each): group findings into insights, cited claims, owner/action, optional
     scenario requests with a verbatim basis quote. Coverage contract: every finding is in an insight or set aside with a reason.
  3. S7 (code): default impacts of each finding + model scenarios that pass verify_request (quote verbatim, slip derivable)
  4. code ranking (ranker.rank: PM rule)
Input: read + rules outputs. Output: {comms, cluster_outputs, insights, order, top_keys, coverage_precheck, s7_verdicts}.
Tier: T0 reads/compute; T1 save_insights (= this stage's saved output)."""
import json, os, zlib, concurrent.futures as cf
from . import Actions
from ..cost_guard import BudgetExceeded
from .. import context as C
from ..contracts import CLUSTER, COMMS, SIGNALS
from ..packs import cluster_pack, comms_pack
from ..ranker import verify_request, quote_ok, quoted_dates, rank, NOTICE_RULES
from ..candidates import default_impacts
from ..notices import NOTICE_TYPES, code_types

CODE_OWNED = {"SCH-DWG-REV-AFTER-APPROVAL"} | NOTICE_RULES   # PM rules 1-2: own items, never merged, never set aside by the model

SECTION_BY_PREFIX = {"SCH": "schedule_risks", "COST": "cost_risks", "PROC": "procurement_issues", "RFI": "overdue_rfis", "SUB": "overdue_submittals",
                     "DEC": "unresolved_decisions", "EMAIL": "schedule_risks"}
POINTS = {"dated_consequence": 3, "cost_scope": 2, "decision_by_principal": 2, "cash_strain": 2, "from_lender_owner_ahj_utility": 2, "design_return": 1,
          "internal_or_social": -5}
DELIVERY_DELAY_RE = __import__("re").compile(
    r"\b(delivery\s+(?:has\s+been\s+)?delay\w*|delayed\s+delivery|shipment\s+delay\w*|tracking\s+(?:update|alert)|"
    r"package\s+(?:delayed|exception)|carrier\s+(?:delay|exception)|out\s+for\s+delivery\s+exception)\b", __import__("re").I)
AUTO_SENDER_RE = __import__("re").compile(r"noreply|no-reply|donotreply|notifications?@|tracking@|shipnotif|automated", __import__("re").I)
# Later email (or Procore note) clearly says the same material was received / delivered / on site.
MATERIAL_RECEIVED_RE = __import__("re").compile(
    r"\b(?:(?:is|are|was|were|has been|have been)\s+)?"
    r"(?:on[ -]?site|received(?:\s+complete)?|delivered|inventoried|unloaded|"
    r"in\s+(?:the\s+)?(?:east |west |north |south )?laydown|tagged\s+(?:in|at|and))\b|"
    r"\b(?:on[ -]?site\s+and\s+inventoried|delivered\s+and\s+tagged|received\s+and\s+(?:inventoried|tagged)|"
    r"ignore\s+this\s+(?:notice|delay)|can\s+ignore\s+this\s+notice)\b",
    __import__("re").I)
# Requires at least one digit; optional letters + optional hyphen + digits (e.g. PO-123, CO12, 12345)
ORDER_KEY_RE = __import__("re").compile(r"\b(?:PO|SO|order|shipment|sales\s+order)[-#:\s]*([A-Z]*-?\d+)\b", __import__("re").I)

RFI_STALE_CLAIM_RE = __import__("re").compile(
    r"\bRFI\s*#?\s*(\d+)\b[\s\S]{0,80}?\b(?:overdue|unanswered|still\s+open|past\s+due|awaiting\s+(?:your\s+)?(?:answer|response)|no\s+answer)\b|"
    r"\b(?:overdue|unanswered|still\s+open|past\s+due|awaiting\s+(?:your\s+)?(?:answer|response)|no\s+answer)\b[\s\S]{0,80}?\bRFI\s*#?\s*(\d+)\b",
    __import__("re").I)

def rfi_answered_in_procore(T, email_ref):
    """False-alarm rule 10 (T6): email claims an RFI is overdue/open; Procore shows answered/closed → suppress. Procore wins."""
    if email_ref not in T.index or T.index[email_ref][0] != "email": return None
    rec = T.index[email_ref][1]
    text = _email_text(rec)
    nums = set()
    for m in RFI_STALE_CLAIM_RE.finditer(text):
        nums.add(m.group(1) or m.group(2))
    # also plain "RFI #N" when paired with overdue-ish language nearby already covered; if none, bail
    if not nums: return None
    email_day = (rec.get("received_at") or "")[:10]
    for ref, (typ, r) in T.index.items():
        if typ != "rfi": continue
        label = str(r.get("label") or "")
        m = __import__("re").search(r"#\s*(\d+)", label)
        num = m.group(1) if m else None
        if num not in nums: continue
        st = str(r.get("status") or "").lower()
        answers = r.get("answers") or []
        closed = st in ("closed", "resolved", "answered") or bool(r.get("time_resolved"))
        # answered on/after the email, or already closed in Procore → stale email
        later_ans = [a for a in answers if (a.get("date") or "") >= email_day] if email_day else answers
        if closed or later_ans or answers:
            # Prefer suppress when Procore has any official answer or closed status (email is stale vs SoR)
            if closed or answers:
                return {"ref": ref, "rfi_number": num, "status": r.get("status"),
                        "answered_on": (answers[-1].get("date") if answers else (r.get("time_resolved") or "")[:10]),
                        "reason": "Procore RFI answered/closed; stale email claim suppressed"}
    return None


def _email_text(rec):
    return ((rec.get("subject") or "") + " " + (rec.get("body_text") or ""))

def _order_keys(text):
    return {k.lower() for k in ORDER_KEY_RE.findall(text or "")}

def delivery_complete_for(T, email_ref):
    """Suppress delivery-delay when a delivery_log OR a later email/Procore record shows the same material received/on-site."""
    from ..parties import party_for_record
    if email_ref not in T.index: return None
    rec = T.index[email_ref][1]; text = _email_text(rec)
    keys = _order_keys(text)
    logs = [l for l in T.logs if l.get("type") == "delivery_log"]
    linked = {l["b"] if l["a"] == email_ref else l["a"] for l in T.links() if email_ref in (l["a"], l["b"])}
    for d in logs:
        status = str(d.get("status") or d.get("delivery_status") or "").lower()
        if status not in ("received", "complete", "completed", "delivered", "received_complete", "received complete"): continue
        if d["ref"] in linked: return d
        blob = " ".join(str(d.get(k) or "") for k in ("order_number", "po_number", "description", "comment", "tracking_number"))
        if keys and any(k.lower() in blob.lower() for k in keys): return d
        if d.get("order_number") and str(d["order_number"]).lower() in text.lower(): return d
    # Later email in the same thread (or naming the same PO/SO) that clearly says received / on site / delivered.
    # Only emails from project parties may confirm receipt.
    emails = T.emails["emails"] if isinstance(T.emails, dict) else (T.emails or [])
    conv = rec.get("conversation_id"); recv_at = rec.get("received_at") or ""
    for e in emails:
        if e.get("ref") == email_ref: continue
        if (e.get("received_at") or "") <= recv_at: continue
        # Only project parties may confirm delivery
        if not party_for_record(T.project, e): continue
        et = _email_text(e)
        if not MATERIAL_RECEIVED_RE.search(et): continue
        same_thread = conv and e.get("conversation_id") == conv
        shared = keys & _order_keys(et)
        if same_thread or shared:
            return {"ref": e["ref"], "type": "email_received_confirmation", "status": "received",
                    "order_number": next(iter(shared), None), "source": "email"}
    # Typed Procore notes_log / delivery-adjacent comment naming the same order and saying received.
    for l in T.logs:
        if l.get("type") not in ("notes_log", "delivery_log"): continue
        if (l.get("log_date") or "") < (recv_at[:10] if recv_at else ""): continue
        blob = " ".join(str(l.get(k) or "") for k in ("description", "comment", "notes", "order_number", "po_number"))
        if keys and any(k in blob.lower() for k in keys) and MATERIAL_RECEIVED_RE.search(blob):
            return {"ref": l["ref"], "type": l.get("type"), "status": "received", "source": "procore_log"}
    return None

def prompt(name): return open(os.path.join(C.INTEL, "prompts", name + ".md")).read()

def comms_step(T, R, cfg, read_out, rules_out, A):
    sh = read_out["shared"]
    sysmsg = C.read("prompts", "_shared_rules.md") + "\n\n" + prompt("comms_decisions_analyst").split("**Output schema")[0] + C.COMMS_RT
    try:
        obj, rep = R.llm_contract("comms", sysmsg, comms_pack(T, sh["project_context"], sh["records_index"]), cfg["stages"]["comms"], COMMS)
    except BudgetExceeded:
        raise   # a cap hit aborts the run; never silently replaced by code fallbacks
    except Exception as e:
        print(f"  [comms] FAILED: {e}; continuing without email extraction (gap)", flush=True)
        obj, rep = {"emails": [], "gaps": [f"comms extraction failed: {str(e)[:150]}"]}, {"error": str(e)[:300]}
    A.add("llm:comms extraction -> save_insights(draft)", "T1")
    open_refs = {c["ref"] for f in rules_out["findings"] for c in f["citations"]}
    rows, flags, links = [], [], []
    for e in obj.get("emails", []):
        ref = e.get("ref")
        if ref not in T.index or T.index[ref][0] != "email": flags.append({"drop_email_row": ref}); continue
        e = dict(e); e["links"] = [l for l in e.get("links") or [] if l in T.index]
        if e.get("quote") and not quote_ok(T, ref, e["quote"]): flags.append({"email": ref, "quote_not_verbatim": e["quote"][:80]}); e["quote"] = ""
        rec = T.index[ref][1]
        from ..rules_engine import NOTICE_RE as _NOTICE_RE
        from ..fact_rules import notice_fact as _nf
        _n = _nf(T, ref)
        notice = _n[0] if _n is not None else bool(_NOTICE_RE.search(rec["subject"] + "\n" + rec["body_text"]))
        sig = e.get("signals") or {}
        pts = sum(v for k, v in POINTS.items() if sig.get(k))
        linked = bool(set(e["links"]) & open_refs) or any(l["a"] == ref and l["b"] in open_refs for l in T.links())
        pts += 1 if linked else 0
        # Trap: automated delivery-delay email when the delivery log shows the order already received complete → never Significant / top claim
        deliv = None
        if DELIVERY_DELAY_RE.search(rec["subject"] + " " + rec["body_text"]) or AUTO_SENDER_RE.search(rec.get("from") if isinstance(rec.get("from"), str) else (rec.get("from") or {}).get("email", "")):
            deliv = delivery_complete_for(T, ref)
        stale_rfi = rfi_answered_in_procore(T, ref)
        if deliv:
            pts = min(pts, 0); notice = False
            flags.append({"email": ref, "delivery_delay_suppressed": deliv["ref"],
                         "reason": "delivery_log or later email/record shows received/on-site"})
            sig = dict(sig); sig["internal_or_social"] = True
        if stale_rfi:
            pts = min(pts, 0); notice = False
            flags.append({"email": ref, "stale_rfi_suppressed": stale_rfi["ref"],
                         "reason": stale_rfi["reason"]})
            sig = dict(sig); sig["internal_or_social"] = True
        suppressed = bool(deliv) or bool(stale_rfi)
        # PM clarification 4 (noise_email_no_impact): email is a finding ONLY if deterministic rules attach
        # formal notice, owner/OR directive, schedule-date slip, or a link to an open RFI/submittal finding.
        attach_rules = {"EMAIL-NOTICE-LANGUAGE", "EMAIL-FORMAL-NOTICE", "COST-OWNER-DIRECTIVE-NO-CE", "SCH-EMAIL-DATE-SLIP"}
        findings_by_ref = []
        for f in rules_out["findings"]:
            if any(c.get("ref") == ref for c in f.get("citations") or []):
                findings_by_ref.append(f)
        has_attach_rule = any(f["rule_id"] in attach_rules for f in findings_by_ref)
        # link to an open RFI / submittal finding (finding cites an RFI/submittal that this email links to, or email cites those findings)
        open_rfi_sub_refs = {c["ref"] for f in rules_out["findings"] for c in f["citations"]
                             if f["rule_id"].startswith(("RFI-", "SUB-", "SCH-DWG", "COST-DIFFERING"))
                             and (":rfi:" in c["ref"] or ":submittal:" in c["ref"] or ":drawing_revision:" in c["ref"])}
        email_links = set(e.get("links") or []) | {l["b"] if l["a"] == ref else l["a"] for l in T.links() if ref in (l["a"], l["b"])}
        linked_rfi_sub_finding = bool(email_links & open_rfi_sub_refs) or bool(email_links & open_refs and any(
            (":rfi:" in x or ":submittal:" in x) for x in email_links))
        # also: open_refs intersection where the open finding itself is RFI/SUB-prefixed
        open_findings_for_links = [f for f in rules_out["findings"]
                                   if f["rule_id"].startswith(("RFI-", "SUB-", "SCH-DWG", "COST-DIFFERING"))
                                   and any(c["ref"] in email_links or c["ref"] == ref for c in f.get("citations") or [])]
        linked_rfi_sub_finding = linked_rfi_sub_finding or bool(open_findings_for_links)
        deterministic_attach = (notice and not sig.get("internal_or_social")) or has_attach_rule or linked_rfi_sub_finding
        drop_noise = (not suppressed) and (not deterministic_attach)
        if drop_noise:
            flags.append({"email": ref, "drop_reason": "noise_email_no_impact"})
        e["code_score"] = {"points": pts, "auto_include_notice": notice and not sig.get("internal_or_social"), "linked_to_open_finding": linked,
                           "model_notice_flag": bool(sig.get("notice_language")), "delivery_suppressed": bool(deliv),
                           "stale_rfi_suppressed": bool(stale_rfi), "deterministic_attach": deterministic_attach,
                           "drop_reason": "noise_email_no_impact" if drop_noise else None}
        e["significant"] = False if (suppressed or drop_noise) else True
        fn = e.get("formal_notice") or {}
        if fn.get("is_formal_notice"):
            # the model only classifies + cites; the classification needs a verbatim quote. Any deadline it may add is dropped.
            from ..notices import PRODUCT_NOTICE_TYPES, PERIOD_TYPE
            allowed = set(NOTICE_TYPES) | set(PRODUCT_NOTICE_TYPES)
            if fn.get("quote") and quote_ok(T, ref, fn["quote"]):
                e["formal_notice"] = {"is_formal_notice": True,
                                      "notice_types": [t for t in fn.get("notice_types") or [] if t in allowed],
                                      "quote": fn["quote"]}
                # Formal notice (verified quote) is a deterministic attach — keep significant unless suppressed.
                if not deliv and not stale_rfi:
                    e["significant"] = True
                    e["code_score"]["drop_reason"] = None
                    e["code_score"]["deterministic_attach"] = True
            else:
                flags.append({"email": ref, "formal_notice_rejected": "quote not verbatim"}); e["formal_notice"] = {"is_formal_notice": False}
        d = e.get("decision") or {}
        if d.get("kind") in ("made", "requested") and d.get("needed_by") and d["needed_by"] not in [x.isoformat() for x in quoted_dates(rec["body_text"] + " " + rec["subject"], T.as_of.year)]:
            flags.append({"email": ref, "needed_by_not_in_email": d["needed_by"]}); d["needed_by"] = None
        rows.append(e)
        links += [{"a": ref, "b": l, "type": "comms_proposed", "confidence": 0.7, "evidence": "comms extraction"} for l in e["links"]]
    return {"raw": obj, "contract_report": rep, "rows": rows, "flags": flags, "links": links, "gaps": obj.get("gaps", [])}

def short_ref(rec): return f'Email: {rec["from"].split(" <")[0]}' if isinstance(rec.get("from"), str) else "Email"

def auto_insight(f, cluster_id, why):
    return {"key": f"{cluster_id}-auto-{zlib.crc32(f['finding_id'].encode()) % 10000}", "cluster_id": cluster_id, "finding_ids": [f["finding_id"]],
            "section": SECTION_BY_PREFIX.get(f["rule_id"].split("-")[0], "schedule_risks"), "headline": f["title"][:150], "mechanism": "",
            "claims": [{"text": f["title"][:260], "kind": "fact", "refs": [c["ref"] for c in f["citations"]][:6], "label": "Confirmed"}],
            "impact_requests": [], "decision_deadline": None, "owner": {"name": f.get("ball_in_court") or "", "why": "ball in court"},
            "action": "", "confidence": "Likely", "origin": "code_auto", "origin_reason": why}

def code_item(T, f, cid, F, extra=None):
    """PM rules 1-2: code-owned items (formal notice; submittal approved before a later design revision)."""
    ai = auto_insight(f, cid, "code-owned item (PM rule)"); ai["origin"] = "code_owned"
    refs = [c["ref"] for c in f["citations"]]
    if f["rule_id"] == "SCH-DWG-REV-AFTER-APPROVAL":
        group = [f] + [g for g in (extra or [])]
        sref = next(r for r in refs if ":submittal:" in r); s_ = T.index[sref][1]
        dws = sorted({next(c["ref"] for c in g["citations"] if ":drawing_revision:" in c["ref"]) for g in group})
        ds = [T.index[r][1] for r in dws]; md = lambda x: f"{int(x[5:7])}/{int(x[8:10])}"
        who = (s_.get("responsible_contractor") or s_.get("label"))
        via = sorted({d.get("issued_via") for d in ds if d.get("issued_via")})
        ai["finding_ids"] = [g["finding_id"] for g in group]
        refs = list(dict.fromkeys(r for g in group for r in (c["ref"] for c in g["citations"])))
        ai["headline"] = (f'{s_["label"]} ({who}) approved {md(f["evidence"]["submittal_approved"])} before '
                          f'{", ".join(d["number"] + " Rev " + str(d["revision"]) for d in ds)} ({", ".join(via)}, issued {md(min(d["issued_date"] for d in ds))}): '
                          f'approved before revision, confirm fabrication hold')[:220]
        ai["action"] = f"Confirm fabrication hold with {who} and whether {s_['label']} must be resubmitted against the revised drawings"
        ai["section"] = "procurement_issues"
        ai["claims"] = [{"text": ai["headline"], "kind": "fact", "refs": refs[:6], "label": "Confirmed"}]
    else:
        em = next(r for r in refs if T.index[r][0] == "email"); rec = T.index[em][1]
        sender = rec["from"].split(" <")[0]
        from ..notices import company_of
        co = f["evidence"].get("company") or (company_of(T, rec) or {}).get("name")
        ai["headline"] = (f'Formal notice from {sender}' + (f' ({co})' if co else "") + f': {rec["subject"]}')[:200]
        ai["section"] = "schedule_risks"; ai["confidence"] = "Confirmed"
        ai["action"] = "GC PM to review the notice and decide on any notice to the owner; response window may be running"
    return ai

def cluster_step(T, R, cfg, read_out, rules_out, comms, A):
    F = {f["finding_id"]: f for f in rules_out["findings"]}; sh = read_out["shared"]
    sysmsg = C.read("prompts", "_shared_rules.md") + "\n\n" + prompt("correlator").split("**Output schema**")[0] + C.CLUSTER_RT
    def one(cl):
        pack = cluster_pack(T, cl, F, rules_out["candidates"], comms["links"], sh["project_context"], sh["contract_terms"])
        try:
            obj, rep = R.llm_contract("cluster_" + cl["cluster_id"], sysmsg, pack, cfg["stages"]["cluster"], CLUSTER)
            return cl, pack, obj, rep, None
        except BudgetExceeded:
            raise   # a cap hit aborts the run; never silently replaced by code fallbacks
        except Exception as e:
            print(f"  [cluster_{cl['cluster_id']}] FAILED: {e}; code auto-insights for its findings", flush=True)
            return cl, pack, None, None, str(e)[:300]
    with cf.ThreadPoolExecutor(cfg["stages"].get("cluster_parallelism", 6)) as ex:
        res = list(ex.map(one, rules_out["clusters"]))
    A.add("llm:cluster analysts (one per issue cluster) -> save_insights(draft)", "T1", {"calls": len(res)})
    insights, outputs, s7, cov = [], {}, [], []
    for cl, pack, obj, rep, err in res:
        cid = cl["cluster_id"]; outputs[cid] = {"output": obj, "contract_report": rep, "error": err, "finding_ids": cl["finding_ids"]}
        allowed = set(pack["allowed_refs"]); placed = {}
        for n, ins in enumerate((obj or {}).get("insights", []) or [], 1):
            fids = [i for i in ins.get("finding_ids", []) if i in cl["finding_ids"] and i not in placed and F[i]["rule_id"] not in CODE_OWNED - NOTICE_RULES]
            if not fids: cov.append({"cluster": cid, "dropped_model_insight": ins.get("headline", "")[:80], "reason": "no valid finding_ids"}); continue
            key = f"{cid}-{ins.get('key') or n}"
            for i in fids: placed[i] = key
            imp = [dict(x) for c in rules_out["candidates"] if c["finding_id"] in fids for x in c["default_impacts"]]
            for q in ins.get("impact_requests") or []:
                r, v = verify_request(T, q, allowed); v["insight"] = key; s7.append(v)
                A.add(f"compute_impact:{q.get('type')} (model scenario)", "T0", {"insight": key, "status": v["status"]})
                if r: imp.append(r)
            dd = ins.get("decision_deadline")
            ddv = None
            if isinstance(dd, dict) and dd.get("basis_ref") in allowed and quote_ok(T, dd["basis_ref"], dd.get("basis_quote")):
                if any(x.isoformat() == dd.get("date") for x in quoted_dates(dd["basis_quote"], T.as_of.year)):
                    ddv = {"date": dd["date"], "kind": dd.get("kind") or "decision deadline", "basis_ref": dd["basis_ref"]}
            if dd and not ddv: s7.append({"insight": key, "type": "decision_deadline", "status": "rejected", "reason": "date not stated in the verbatim quote"})
            insights.append(dict(ins, key=key, cluster_id=cid, finding_ids=fids, impacts=imp, decision_deadline_verified=ddv, origin="model", allowed_refs=sorted(allowed)))
        aside = {s["finding_id"]: s["reason"] for s in (obj or {}).get("set_aside", []) or [] if s.get("finding_id") in cl["finding_ids"] and s["finding_id"] not in placed
                 and F[s["finding_id"]]["rule_id"] not in CODE_OWNED}
        dwg = {}
        for i in cl["finding_ids"]:
            if F[i]["rule_id"] == "SCH-DWG-REV-AFTER-APPROVAL":
                dwg.setdefault(next(c["ref"] for c in F[i]["citations"] if ":submittal:" in c["ref"]), []).append(i)
        dwg_lead = {v[0]: v[1:] for v in dwg.values()}; dwg_rest = {x: v[0] for v in dwg.values() for x in v[1:]}
        from ..candidates import far_float_overdue_reason as _far_float
        for i in cl["finding_ids"]:
            if i in dwg_rest:
                cov.append({"finding_id": i, "status": "code_owned_item", "reason": "same submittal as " + dwg_rest[i], "insight": None, "_lead": dwg_rest[i]}); continue
            # False-alarm rule 9: far-float overdue submittal → code set-aside (still listed in overdue sections via record_rows)
            if i not in placed and _far_float(T, F[i]):
                why = _far_float(T, F[i])
                cov.append({"finding_id": i, "status": "set_aside_by_model", "reason": why, "severity": F[i]["severity"],
                            "origin": "code_far_float"}); continue
            if F[i]["rule_id"] in CODE_OWNED - NOTICE_RULES or (F[i]["rule_id"] in NOTICE_RULES and i not in placed):
                ai = code_item(T, F[i], cid, F, [F[x] for x in dwg_lead.get(i, [])])
                ai["impacts"] = [dict(x) for c in rules_out["candidates"] if c["finding_id"] in ai["finding_ids"] for x in c["default_impacts"]]
                ai["allowed_refs"] = sorted(allowed | {c["ref"] for c in F[i]["citations"]}); ai["decision_deadline_verified"] = None
                insights.append(ai); cov.append({"finding_id": i, "status": "code_owned_item", "reason": "PM rule (own item)", "insight": ai["key"]})
                for c in cov:
                    if c.get("_lead") == i: c["insight"] = ai["key"]; c.pop("_lead")
                continue
            if i in placed: cov.append({"finding_id": i, "status": "in_insight", "insight": placed[i]})
            elif i in aside: cov.append({"finding_id": i, "status": "set_aside_by_model", "reason": aside[i], "severity": F[i]["severity"]})
            else:
                why = "cluster call failed" if err else "model did not address this finding"
                # attach to the model insight in this cluster that already cites this finding's anchor record (avoids a duplicate item);
                # its impacts (own exposure line, flags) come along. Otherwise a code auto-insight.
                own = [c["ref"] for c in F[i]["citations"]]
                host = next((x for x in insights if x.get("cluster_id") == cid and x.get("origin") == "model" and
                             own[0] in {r for c in x.get("claims") or [] for r in c.get("refs") or []}), None) if not err else None
                if host:
                    host["finding_ids"].append(i); placed[i] = host["key"]
                    host["impacts"] += [dict(x) for c in rules_out["candidates"] if c["finding_id"] == i for x in c["default_impacts"]]
                    cov.append({"finding_id": i, "status": "in_insight", "insight": host["key"], "note": "attached by code (anchor record cited)"}); continue
                ai = auto_insight(F[i], cid, why); ai["impacts"] = [dict(x) for c in rules_out["candidates"] if c["finding_id"] == i for x in c["default_impacts"]]
                ai["allowed_refs"] = sorted(allowed | {c["ref"] for c in F[i]["citations"]}); ai["decision_deadline_verified"] = None
                insights.append(ai); cov.append({"finding_id": i, "status": "auto_included_by_code", "reason": why, "insight": ai["key"]})
    return insights, outputs, s7, cov

def run(T, R, cfg, read_out, rules_out):
    A = Actions("rank")
    comms = comms_step(T, R, cfg, read_out, rules_out, A)
    insights, outputs, s7, cov = cluster_step(T, R, cfg, read_out, rules_out, comms, A)
    F = {f["finding_id"]: f for f in rules_out["findings"]}
    # formal notices: model classification refines notice types on regex findings; a model-classified notice the regex missed becomes
    # its own code-owned finding (EMAIL-FORMAL-NOTICE). Windows always recomputed by code from configured periods.
    notice_f = {c["ref"]: f for f in F.values() if f["rule_id"] in NOTICE_RULES for c in f["citations"]}
    for e in comms["rows"]:
        fn = e.get("formal_notice") or {}
        if not fn.get("is_formal_notice"): continue
        from ..fact_rules import notice_fact as _nf2
        _n2 = _nf2(T, e["ref"])
        if _n2 is not None and not _n2[0]: continue   # extraction facts say not a notice: the comms row does not override them
        rec = T.index[e["ref"]][1]
        if T.local_date(rec["received_at"]) != T.as_of: continue
        f = notice_f.get(e["ref"])
        if f:
            # PM: code_types is authoritative; conflicting model type → other (never wrong typed row).
            from ..notices import PERIOD_TYPE, code_types as _ct
            from ..fact_rules import notice_fact as _nf
            _n = _nf(T, e["ref"])
            code_t = _n[1] if (_n and _n[0]) else _ct(rec["subject"] + "\n" + rec["body_text"])
            model_t = [t for t in (fn.get("notice_types") or [])]
            if code_t == ["other"]:
                f["evidence"]["notice_types"] = ["other"]
            else:
                code_p = {PERIOD_TYPE.get(t) for t in code_t}
                model_p = {PERIOD_TYPE.get(t) for t in model_t if PERIOD_TYPE.get(t)}
                if model_p and code_p and not (model_p & code_p):
                    f["evidence"]["notice_types"] = ["other"]
                else:
                    f["evidence"]["notice_types"] = code_t
            for ins in insights:
                if f["finding_id"] in ins["finding_ids"]:
                    ins["impacts"] = [x for x in ins["impacts"] if not (x.get("type") == "notice_window" and x.get("finding_id") == f["finding_id"])] + default_impacts(T, f)
            continue
        f = {"finding_id": f"EMAIL-FORMAL-NOTICE|{e['ref']}", "fingerprint": f"EMAIL-FORMAL-NOTICE|{e['ref']}", "rule_id": "EMAIL-FORMAL-NOTICE",
             "rule_version": "harness-m3-0.2", "record_label": short_ref(rec), "title": f'Formal notice (model-classified, quote verified): "{fn["quote"][:120]}"',
             "severity": "high", "status": "open", "days_overdue": 0, "governing_date": None, "governing_date_kind": None, "decision_deadline": None,
             "ball_in_court": None, "spec_section": None, "metrics": {}, "citations": [{"ref": e["ref"]}], "source": "comms_classification",
             "evidence": {"notice_types": code_types(rec["subject"] + "\n" + rec["body_text"]), "quote": fn["quote"],
                          "company": None}, "run_date": T.as_of.isoformat(), "change_since_prior_run": "new", "delta": None}
        rules_out["findings"].append(f); F[f["finding_id"]] = f
        rules_out["candidates"].append({"finding_id": f["finding_id"], "default_impacts": default_impacts(T, f)})
        ai = code_item(T, f, "CN", F); ai["impacts"] = default_impacts(T, f); ai["allowed_refs"] = [e["ref"]]; ai["decision_deadline_verified"] = None
        insights.append(ai); cov.append({"finding_id": f["finding_id"], "status": "code_owned_item", "reason": "model-classified formal notice", "insight": ai["key"]})
    # never a model-proposed deadline on a notice item
    for ins in insights:
        if any(F[i]["rule_id"] in NOTICE_RULES for i in ins["finding_ids"] if i in F) and ins.get("decision_deadline_verified"):
            s7.append({"insight": ins["key"], "type": "decision_deadline", "status": "rejected", "reason": "notice deadlines are code-computed only"})
            ins["decision_deadline_verified"] = None
    # Drop model-placed far-float-only insights from top consideration (rule 9); keep coverage as set_aside.
    from ..candidates import far_float_overdue_reason as _far_float2
    kept_ins = []
    for ins in insights:
        fids = [i for i in ins.get("finding_ids") or [] if i in F]
        if fids and all(_far_float2(T, F[i]) for i in fids) and not any((x.get("delay_usd") or 0) > 0 or (x.get("total_usd") or 0) > 0 for x in ins.get("impacts") or []):
            why = _far_float2(T, F[fids[0]])
            for i in fids:
                if not any(c.get("finding_id") == i for c in cov):
                    cov.append({"finding_id": i, "status": "set_aside_by_model", "reason": why, "severity": F[i]["severity"],
                                "origin": "code_far_float"})
            continue
        kept_ins.append(ins)
    insights = kept_ins
    top, order = rank(T, insights, F)
    A.add("code ranking (PM rule: schedule $ then cost $; floors; Signal cap)", "T0", {"top": top})
    print(f"  [rank] insights={len(insights)} top={top}", flush=True)
    return {"comms": comms, "cluster_outputs": outputs, "insights": insights, "top_keys": top, "order": order,
            "coverage_precheck": cov, "s7_verdicts": s7}, A
