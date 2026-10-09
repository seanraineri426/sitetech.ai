"""Fixture-backed tool layer (FICTIONAL Linden Yard data). Answers the tools named in tools/tool_schemas.json
(agent-layer T0 tools) plus the integrations get_* data tools that the per-agent allow-lists reference, from evals/fixture/.
Policy: read-only. Only T0 tools execute. T1 writes (save_insights, link_entities, update_decisions_register, save_brief)
are NOT exposed to models in the eval; the pipeline persists stage outputs to the run directory itself. T2 tools return
{status: 'disabled_in_v1'} with no side effects. Every call is checked against the caller's allow-list and audit-logged."""
import json, os, re, datetime as dt
from .calendar_util import Calendar, d_

INTEL = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FX = os.path.join(INTEL, "evals", "fixture")
TOOLS = json.load(open(os.path.join(INTEL, "tools", "tool_schemas.json")))
ALLOW = TOOLS["x-agent-allowlists"]
AGENT_TOOL_TIER = {t["name"]: t["x-tier"] for t in TOOLS["tools"]}
AGENT_TOOL_STATUS = {t["name"]: t.get("x-status") for t in TOOLS["tools"]}
DATA_TOOLS = set(TOOLS["x-builds-on"]["data_tools"]) | {"get_meetings"}   # integrations reads (T0); get_meetings = requested tool


class ToolDenied(RuntimeError): pass

def derive_dates(fx):
    """as_of / compare_to from the M1 snapshots themselves (findings run_date of m1/day2 and m1/day1)."""
    out = {}
    for k, day in (("as_of", "day2"), ("compare_to", "day1")):
        fs = json.load(open(os.path.join(fx, "m1", day, "findings.json")))
        ds = sorted({f.get("run_date") for f in (fs if isinstance(fs, list) else fs.get("findings", [])) if f.get("run_date")})
        if not ds: raise ValueError(f"cannot derive {k}: no run_date in m1/{day}/findings.json; pass --{k.replace('_', '-')}")
        out[k] = ds[-1]
    return out

def fixture_settings(fx, yaml_cfg=None, cli=None):
    """Per-fixture run settings. Precedence: CLI flags > <fixture>/harness_fixture.yaml > derived. Derived: dates from the M1 snapshots;
    sync/cutoff simulated as the morning after as_of 04:45 in the project time zone (labelled `simulated`)."""
    import datetime as _dt
    from zoneinfo import ZoneInfo
    s = dict(yaml_cfg or {}); src = {k: "harness_fixture.yaml" for k in s}
    for k, v in (cli or {}).items():
        if v: s[k] = v; src[k] = "cli"
    if not s.get("as_of") or not s.get("compare_to"):
        d = derive_dates(fx)
        for k in ("as_of", "compare_to"):
            if not s.get(k): s[k] = d[k]; src[k] = "derived (m1 snapshot run_date)"
    tz = json.load(open(os.path.join(fx, "project.json"))).get("timezone")
    if not tz: raise ValueError("project.json `timezone` is required")
    sim = (_dt.datetime.fromisoformat(str(s["as_of"])) + _dt.timedelta(days=1)).replace(hour=4, minute=45, tzinfo=ZoneInfo(tz)).isoformat()
    for k in ("procore_last_sync", "mailbox_last_sync", "cutoff_at"):
        if not s.get(k): s[k] = sim; src[k] = "derived (simulated: as_of+1 04:45 project time)"
    s["as_of"], s["compare_to"] = str(s["as_of"]), str(s["compare_to"])
    s["_sources"] = src
    return s

class FixtureTools:
    def __init__(self, as_of=None, compare_to=None, audit=None, fixture_dir=None):
        """fixture_dir: any project fixture with the same layout (project.json, m1/day1|day2, m2/, m3/); default evals/fixture.
        Convention: m1/day1 = compare_to snapshot, m1/day2 = as_of snapshot. Dates default to the snapshots' own run_date."""
        self.fx = os.path.abspath(fixture_dir or FX)
        J = lambda *p: json.load(open(os.path.join(self.fx, *p)))
        if not as_of or not compare_to:
            d = derive_dates(self.fx); as_of = as_of or d["as_of"]; compare_to = compare_to or d["compare_to"]
        self.as_of, self.compare_to = d_(as_of), d_(compare_to)
        self.day = {compare_to: "day1", as_of: "day2"}
        self.project = J("project.json")
        if not self.project.get("timezone"): raise ValueError("project.json `timezone` is required (notice windows count days in project time)")
        hol = self.project["holidays"] if "holidays" in self.project else (self.project.get("calendar") or {}).get("holidays")
        if hol is None: raise ValueError("project.json `holidays` list is required (empty allowed)")
        self.cal = Calendar(hol)
        self.tz = self.project["timezone"]
        km = (self.project.get("key_milestones") or [{}])[0]
        self.milestone_name = km.get("name") or km.get("activity_id") or "key milestone"
        self.rfis = {k: J("m1", v, "rfis.json") for k, v in self.day.items()}
        self.subs = {k: J("m1", v, "submittals.json") for k, v in self.day.items()}
        self.findings = {k: J("m1", v, "findings.json") for k, v in self.day.items()}
        self.emails = J("m2", "emails.json"); self.meetings = J("m2", "meetings.json")["meetings"]
        self.budget = J("m3", "budget.json")["snapshots"]; self.ces = J("m3", "change_events.json")["snapshots"]
        self.commitments = J("m3", "commitments.json")["commitments"]; self.logs = J("m3", "daily_logs.json")["logs"]
        self.drawings = J("m3", "drawing_revisions.json")["drawing_revisions"]; self.sched = J("m3", "schedule.json")
        self.audit = audit if audit is not None else []
        ups = [u["schedule_update_id"] for u in self.sched["updates"]]
        self.cur_update, self.prev_update = ups[-1], (ups[-2] if len(ups) > 1 else ups[-1])   # latest / previous schedule update (any project)
        self._build_index()

    # ---------- records index (what resolve_refs can resolve; built from fixture DATA, not from the answer key) ----------
    def _build_index(self):
        idx = {}
        day = self.as_of.isoformat()
        for r in self.rfis[day]: idx[f'procore:rfi:{r["external_id"]}'] = ("rfi", self._rfi(r))
        for s in self.subs[day]: idx[f'procore:submittal:{s["external_id"]}'] = ("submittal", self._sub(s))
        for e in self.emails["emails"]: idx[e["ref"]] = ("email", self._email(e, body=True))
        for m in self.meetings:
            idx[m["ref"]] = ("meeting", {k: v for k, v in m.items() if k != "items"})
            for it in m.get("items", []): idx[it["ref"]] = ("meeting_item", dict(it, meeting=m["title"], meeting_date=m["date"]))
        for b in self.budget: idx[b["ref"]] = ("budget_snapshot", b)
        for snap in self.ces:
            for c in snap["change_events"]:
                if snap["snapshot_date"] == day or c["ref"] not in idx: idx[c["ref"]] = ("change_event", dict(c, snapshot_date=snap["snapshot_date"]))
        for c in self.commitments:
            idx[c["ref"]] = ("commitment", {k: v for k, v in c.items() if k != "invoices"})
            for inv in c.get("invoices", []): idx[inv["ref"]] = ("requisition", dict(inv, commitment_ref=c["ref"], vendor=c["vendor"], retainage_pct=c["retainage_pct"]))
        for l in self.logs: idx[l["ref"]] = (l["type"], l)
        for d in self.drawings: idx[d["ref"]] = ("drawing_revision", d)
        for u in self.sched["updates"]: idx[u["ref"]] = ("schedule_update", u)
        for a in self.sched["activities"]:
            if a["schedule_update_id"] == self.cur_update: idx[a["ref"]] = ("activity", self._act(a))
        for t in self.project["contract_terms"]:
            idx.setdefault(t["doc_ref"], ("document", {"ref": t["doc_ref"], "clauses": []}))[1]["clauses"].append(t)
        self.index = idx

    def resolvable(self, ref): return ref in self.index

    def sched_label(self, update_id=None):
        """Human label of the schedule source from the data (e.g. p6_xer -> 'XER'), never hardcoded per project."""
        u = next((x for x in self.sched["updates"] if x["schedule_update_id"] == (update_id or self.cur_update)), self.sched["updates"][-1])
        src = (u.get("source") or self.project.get("schedule_source") or "schedule").lower()
        return "XER" if "xer" in src else "Procore schedule" if "procore" in src else src.replace("_", " ")

    def local_date(self, ts):
        """Timestamp (UTC 'Z' or with offset) -> calendar date in the project time zone."""
        import datetime as _dt
        from zoneinfo import ZoneInfo
        x = _dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if x.tzinfo is None: raise ValueError(f"timestamp without zone: {ts}")
        return x.astimezone(ZoneInfo(self.tz)).date()

    # ---------- compact projections (Mode A approved fields only) ----------
    def _rfi(self, r):
        q = (r.get("questions") or [{}])[0]
        ans = [a for qq in r.get("questions") or [] for a in qq.get("answers", [])]
        return {"ref": f'procore:rfi:{r["external_id"]}', "label": f'RFI #{r["number"]}', "subject": r["subject"], "status": r["status"],
                "created_at": r["created_at"][:10], "due_date": r["due_date"], "time_resolved": r.get("time_resolved"),
                "ball_in_court": (r.get("ball_in_court") or {}).get("name"), "rfi_manager": (r.get("rfi_manager") or {}).get("name"),
                "received_from": (r.get("received_from") or {}).get("name"), "responsible_contractor": (r.get("responsible_contractor") or {}).get("name"),
                "spec_section": (r.get("specification_section") or {}).get("number"), "location": (r.get("location") or {}).get("name"),
                "drawing_number": r.get("drawing_number"), "schedule_impact": (r.get("schedule_impact") or {}).get("status"),
                "cost_impact": (r.get("cost_impact") or {}).get("status"), "question": q.get("plain_text_body"),
                "cost_impact_value": (r.get("cost_impact") or {}).get("value"), "schedule_impact_value": (r.get("schedule_impact") or {}).get("value"),
                "schedule_activity_id": r.get("schedule_activity_id"),
                "answers": [{"date": a["answer_date"][:10], "by": a["created_by"], "official": a.get("official"), "text": a["plain_text_body"]} for a in ans]}

    def _sub(self, s):
        return {"ref": f'procore:submittal:{s["external_id"]}', "label": f'Submittal {s["formatted_number"]} rev {s["revision"]}',
                "formatted_number": s["formatted_number"], "revision": s["revision"], "current_revision": s["current_revision"],
                "title": s["title"], "status": s["status"]["name"], "spec_section": (s.get("specification_section") or {}).get("number"),
                "responsible_contractor": (s.get("responsible_contractor") or {}).get("name"),
                "received_from": (s.get("received_from") or {}).get("name"), "submittal_manager": (s.get("submittal_manager") or {}).get("name"),
                "ball_in_court": [b["name"] for b in s.get("ball_in_court") or []],
                "approvers": [{"name": a["user"]["name"], "sent": a.get("sent_date"), "due": a.get("due_date"), "returned": a.get("returned_date"),
                               "response": (a.get("response") or {}).get("name")} for a in s.get("approvers") or []],
                **{k: s.get(k) for k in ("submit_by", "received_date", "due_date", "closed_at", "required_on_site_date", "lead_time",
                                         "design_team_review_time", "internal_review_time", "buffer_time", "confirmed_delivery_date")},
                "scheduled_task": (s.get("scheduled_task") or {}).get("key"),
                "schedule_activity_id": s.get("schedule_activity_id") or ((s.get("scheduled_task") or {}).get("key") or "").split("|")[-1] or None}

    def _email(self, e, body=True):
        o = {"ref": e["ref"], "received_at": e["received_at"], "from": f'{e["from"]["name"]} <{e["from"]["email"]}>',
             "to": [x["name"] for x in e.get("to", [])], "cc": [x["name"] for x in e.get("cc", [])], "subject": e["subject"],
             "attachments": [a if isinstance(a, str) else a.get("name") for a in e.get("attachments") or []]}
        if body: o["body_text"] = e["body_text"]
        return o

    def _act(self, a):
        keep = ("ref", "activity_id", "name", "schedule_update_id", "data_date", "early_start", "early_finish", "original_duration_wd",
                "total_float_wd", "free_float_wd", "is_critical", "near_critical", "pct_complete", "actual_start", "actual_finish",
                "on_driving_path_to_tco", "spec_sections", "cost_code", "location", "company", "predecessors", "planned_crew_size", "note")
        return {k: a.get(k) for k in keep if a.get(k) is not None}

    # ---------- dispatcher ----------
    def call(self, agent, name, args=None):
        args = args or {}
        allowed = ALLOW.get(agent, [])
        entry = {"agent": agent, "tool": name, "args": args}
        try:
            if name not in allowed and not (agent == "orchestrator_code"):
                raise ToolDenied(f"{name} not on {agent} allow-list")
            if name in AGENT_TOOL_TIER:
                if AGENT_TOOL_STATUS.get(name) == "disabled_in_v1":
                    entry["result"] = "disabled_in_v1"; return {"status": "disabled_in_v1"}
                if AGENT_TOOL_TIER[name] != "T0":
                    raise ToolDenied(f"{name} is {AGENT_TOOL_TIER[name]}; eval tool layer is read-only (T0 only)")
            elif name not in DATA_TOOLS:
                raise ToolDenied(f"unknown tool {name}")
            fn = getattr(self, "t_" + name, None)
            if fn is None: raise ToolDenied(f"{name} not implemented in fixture tool layer")
            out = fn(**args); entry["ok"] = True; return out
        except ToolDenied as e:
            entry["denied"] = str(e); raise
        finally:
            self.audit.append(entry)

    # ---------- integrations data tools (fixture-backed approximations of ../integrations get_* shapes) ----------
    def t_get_project(self):
        p = self.project
        return {k: p[k] for k in ("name", "location", "description", "project_mailbox", "schedule_source", "contract", "percent_complete_cost",
                                  "percent_complete_basis", "delay_cost_basis", "key_milestones", "long_lead_spec_sections")} | \
               {"people": [{"name": x["name"], "title": x["title"], "company": x["company"]} for x in p["people"]]}
    def t_get_rfis(self, status=None):
        rows = [self._rfi(r) for r in self.rfis[self.as_of.isoformat()]]
        return [r for r in rows if not status or r["status"] in status]
    def t_get_submittals(self, current_only=False):
        rows = [self._sub(s) for s in self.subs[self.as_of.isoformat()]]
        return [r for r in rows if r["current_revision"] or not current_only]
    def t_get_schedule(self, update_id=None):
        update_id = update_id or self.cur_update
        return {"update": next(u for u in self.sched["updates"] if u["schedule_update_id"] == update_id), "calendar": self.sched["calendar"],
                "activities": [self._act(a) for a in self.sched["activities"] if a["schedule_update_id"] == update_id]}
    def t_get_budget(self, snapshot_date=None):
        snaps = self.budget if snapshot_date is None else [b for b in self.budget if b["snapshot_date"] == snapshot_date]
        return [{k: v for k, v in b.items() if k != "_FICTIONAL"} for b in snaps]
    def t_get_change_orders(self, snapshot_date=None):
        sd = snapshot_date or self.as_of.isoformat()
        return next(s for s in self.ces if s["snapshot_date"] == sd)["change_events"]
    def ces_today(self):
        cs = [c for c in self.ces if c["snapshot_date"] <= self.as_of.isoformat()]
        return cs[-1]["change_events"] if cs else []
    def t_get_contracts(self):
        return [{k: v for k, v in c.items() if k != "invoices"} for c in self.commitments]
    def t_get_pay_apps(self):
        return [dict(inv, commitment_ref=c["ref"], commitment=c["number"], vendor=c["vendor"], retainage_pct=c["retainage_pct"])
                for c in self.commitments for inv in c.get("invoices", [])]
    def t_get_daily_reports(self, date_from=None, date_to=None, types=None):
        return [l for l in self.logs if (not date_from or l["log_date"] >= date_from) and (not date_to or l["log_date"] <= date_to)
                and (not types or l["type"] in types)]
    def t_get_drawings(self): return self.drawings
    def t_get_documents(self):
        return [{"ref": r, "kind": "contract", "clauses": [{k: c[k] for k in ("id", "page", "clause", "party", "confirmed_by_human")} for c in rec["clauses"]]}
                for r, (t, rec) in self.index.items() if t == "document"]
    def t_get_project_emails(self, received_after=None, body=True):
        return {"mailbox": self.project["project_mailbox"], "coverage_note": self.emails["coverage_note"],
                "messages": [self._email(e, body) for e in self.emails["emails"] if not received_after or e["received_at"] >= received_after]}
    def t_get_procurement_status(self):
        subs = {s["spec_section"]: s for s in self.t_get_submittals(current_only=True)}
        out = []
        for c in self.commitments:
            for sp in c["spec_sections"]:
                s = subs.get(sp)
                out.append({"commitment_ref": c["ref"], "number": c["number"], "type": c["type"], "vendor": c["vendor"], "status": c["status"],
                            "executed_date": c["executed_date"], "created_date": c.get("created_date"), "quote_terms": c.get("quote_terms"),
                            "quote_ref": c.get("quote_ref"), "spec_section": sp,
                            "submittal": s and {k: s[k] for k in ("ref", "label", "status", "approvers", "required_on_site_date", "lead_time", "closed_at", "scheduled_task")},
                            "risk": None})
        return {"items": out, "note": "risk field is advisory only (RECONCILE R13); not computed in fixture"}
    def t_get_project_activity(self):
        return {"meetings": self.meetings}
    def t_get_meetings(self): return self.meetings

    # ---------- agent-layer T0 tools ----------
    def t_list_findings(self, run_date=None, rule_ids=None, status=None, entity_refs=None, change_since_prior_run=None, min_severity=None, limit=200):
        rows = self.findings[run_date or self.as_of.isoformat()]
        sev = ["low", "medium", "high", "critical"]
        keep = ("rule_id", "fingerprint", "record_label", "title", "severity", "status", "days_overdue", "governing_date", "governing_date_kind",
                "ball_in_court", "spec_section", "first_detected_on", "resolved_on", "change_since_prior_run", "evidence", "citations")
        out = []
        for f in rows:
            if rule_ids and f["rule_id"] not in rule_ids: continue
            if status and f["status"] not in status: continue
            if change_since_prior_run and f["change_since_prior_run"] not in change_since_prior_run: continue
            if min_severity and sev.index(f["severity"]) < sev.index(min_severity): continue
            if entity_refs and not set(entity_refs) & {c["ref"] for c in f["citations"]}: continue
            out.append({"finding_id": f["fingerprint"], **{k: f[k] for k in keep}})
        return out[:limit]

    def t_diff_snapshots(self, from_as_of=None, to_as_of=None, scope=None):
        a, b = from_as_of or self.compare_to.isoformat(), to_as_of or self.as_of.isoformat()
        fa = {f["fingerprint"]: f for f in self.findings[a]}; fb = {f["fingerprint"]: f for f in self.findings[b]}
        rows = []
        for fp, f in fb.items():
            p = fa.get(fp)
            rows.append({"fingerprint": fp, "change": f["change_since_prior_run"], "label": f["record_label"],
                         "before": p and {"severity": p["severity"], "days_overdue": p["days_overdue"], "status": p["status"]},
                         "after": {"severity": f["severity"], "days_overdue": f["days_overdue"], "status": f["status"]}})
        ba = next(x for x in self.budget if x["snapshot_date"] == a)["owner_contingency"]; bb = next(x for x in self.budget if x["snapshot_date"] == b)["owner_contingency"]
        cea = {c["ref"]: c for c in self.t_get_change_orders(a)}; ceb = {c["ref"]: c for c in self.t_get_change_orders(b)}
        ce_changes = [{"ref": r, "before": cea.get(r) and {k: cea[r].get(k) for k in ("status", "rom_usd", "priced", "funding")},
                       "after": {k: c.get(k) for k in ("status", "rom_usd", "priced", "funding")}} for r, c in ceb.items()
                      if r not in cea or any(cea[r].get(k) != c.get(k) for k in ("status", "rom_usd", "priced", "funding"))]
        fc = self.t_get_float_changes()
        return {"from_as_of": a, "to_as_of": b, "findings": rows,
                "kpis": {"owner_contingency": {"before": ba, "after": bb}, "change_events_changed": ce_changes,
                         "float_changes_prev_to_cur_update": fc["activities"]},
                "note": "Findings diff from fixture lifecycle (carry_lifecycle). Insight-level diff: no prior brief exists in the fixture."}

    def t_get_project_snapshot(self, as_of, include=None):
        return {"as_of": as_of, "findings": self.t_list_findings(run_date=as_of),
                "kpis": {"owner_contingency": next(x for x in self.budget if x["snapshot_date"] == as_of)["owner_contingency"]}}

    def t_get_float_changes(self, from_update_id=None, to_update_id=None, activity_ids=None, watched_only=True, min_tf_change_wd=0, project_forward_to=None):
        f, t = from_update_id or self.prev_update, to_update_id or self.cur_update
        A = {a["activity_id"]: a for a in self.sched["activities"] if a["schedule_update_id"] == f}
        B = {a["activity_id"]: a for a in self.sched["activities"] if a["schedule_update_id"] == t}
        dd = d_(next(u for u in self.sched["updates"] if u["schedule_update_id"] == t)["data_date"])
        out = []
        for aid, b in B.items():
            if activity_ids and aid not in activity_ids: continue
            a = A.get(aid, {})
            row = {"ref": b["ref"], "activity_id": aid, "name": b["name"], "tf_before_wd": a.get("total_float_wd"), "tf_after_wd": b["total_float_wd"],
                   "tf_change_wd": (b["total_float_wd"] - a["total_float_wd"]) if a else None, "early_start": b["early_start"], "early_finish": b["early_finish"],
                   "duration_before_wd": a.get("original_duration_wd"), "duration_after_wd": b["original_duration_wd"], "pct_complete": b["pct_complete"],
                   "actual_start": b.get("actual_start"), "on_driving_path_to_tco": b["on_driving_path_to_tco"], "note": b.get("note")}
            if project_forward_to and not b.get("actual_start") and d_(b["early_start"]) <= d_(project_forward_to):
                row["projected_tf_wd"] = b["total_float_wd"] - self.cal.wd_between(dd, d_(project_forward_to))
                row["projected_to"] = project_forward_to
            out.append(row)
        return {"from": f, "to": t, "to_data_date": dd.isoformat(), "activities": out}

    def t_get_entity_links(self, refs, depth=1, min_confidence=0.6, link_types=None, include_proposed=False):
        """Deterministic L1/L2 links: shared spec section, record numbers in text, activity crosswalk (scheduled_task / activity_id_hint)."""
        return {"links": [l for l in self.links() if l["a"] in refs or l["b"] in refs]}

    def links(self):
        if hasattr(self, "_links"): return self._links
        L = []; idx = self.index
        def add(a, b, typ, conf, ev):
            if a != b and a in idx and b in idx and not any(x["a"] == a and x["b"] == b and x["type"] == typ for x in L):
                L.append({"a": a, "b": b, "type": typ, "confidence": conf, "evidence": ev})
        rfis = {r["label"].split("#")[1]: r for (t, r) in idx.values() if t == "rfi"}
        subs = [r for (t, r) in idx.values() if t == "submittal"]
        acts = {r["activity_id"]: r for (t, r) in idx.values() if t == "activity"}
        for s in subs:
            if s.get("scheduled_task"): add(s["ref"], "p6:activity:" + s["scheduled_task"].split("|")[1], "submittal_activity", 0.95, "scheduled_task crosswalk")
            for r in rfis.values():
                if r["spec_section"] and r["spec_section"] == s["spec_section"]: add(r["ref"], s["ref"], "same_spec", 0.85, f'spec {s["spec_section"]}')
            for a in acts.values():
                if s["spec_section"] in (a.get("spec_sections") or []): add(s["ref"], a["ref"], "spec_activity", 0.8, f'spec {s["spec_section"]}')
        for (t, r) in list(idx.values()):
            if t in ("manpower_log", "inspection_log", "delay_log") and r.get("activity_id_hint"):
                add(r["ref"], "p6:activity:" + r["activity_id_hint"], "log_activity", 0.9, "activity_id_hint")
        texty = [(r["ref"], json.dumps(r)) for (t, r) in idx.values() if t in ("email", "meeting_item", "notes_log", "delay_log", "inspection_log", "change_event", "commitment", "budget_snapshot")]
        for ref, txt in texty:
            for n in re.findall(r"RFI[ #-]*(\d{2})", txt): 
                if n in rfis: add(ref, rfis[n]["ref"], "mentions_record", 0.9, f"RFI {n}")
            for s in subs:
                if s["formatted_number"] in txt or s["formatted_number"].replace("-", " ") in txt: add(ref, s["ref"], "mentions_record", 0.85, s["formatted_number"])
            for m in re.findall(r"(?:CE|PCO|PO)-\d{3,4}", txt):
                for (t2, r2) in idx.values():
                    if t2 in ("change_event", "commitment") and m in (r2.get("number"), r2.get("pco_number")): add(ref, r2["ref"], "mentions_record", 0.9, m)
            for m in re.findall(r"procore:[a-z_]+:\d+|p6:activity:A\d+|msgraph_outlook:message:msg_E\d+", txt): add(ref, m, "explicit_ref", 1.0, "ref field")
        self._links = L; return L

    def t_resolve_refs(self, refs, fields=None):
        out = {}
        for r in refs:
            if r in self.index:
                t, rec = self.index[r]; out[r] = {"entity_type": t, "deleted": False, "record": rec}
            else:
                out[r] = {"error": "ref_not_found"}
        return out

    def t_get_decisions_register(self, status=None, owner=None, due_within_wd=None, include_follow_through=True):
        reg = []
        for m in self.meetings:
            for it in m.get("items", []):
                if it["type"] not in ("decision_pending", "decision_made"): continue
                reg.append({"decision_ref": it["ref"], "source": f'{m["title"]} item {it["number"]}', "kind": "pending" if it["type"] == "decision_pending" else "made",
                            "text": it["text"], "owner": it["assignee"], "needed_by": it["due_date"], "status": it["status"],
                            "carried_from": it.get("carried_from", []), "carried_count": len(it.get("carried_from", [])),
                            "days_late": max(0, (self.as_of - d_(it["due_date"])).days) if it["type"] == "decision_pending" and it["status"] == "open" else 0})
        return {"entries": reg, "note": "Register seeded from OAC minutes only; email decisions are extracted by the comms analyst."}

    def t_get_contract_terms(self, party="any", confirmed_only=True, topics=None):
        return [t for t in self.project["contract_terms"] if (party == "any" or t["party"] == party) and (t["confirmed_by_human"] or not confirmed_only)]

    def t_get_brief(self, as_of, version=None, include_claims=False):
        return {"error": "no published brief for this as_of in the fixture (first model run)"}

    def t_get_approval_status(self, approval_id):
        return {"error": "no approvals exist (T2 disabled in V1)"}

    def t_compute_impact(self, type, params, inputs_refs):
        from .impact import compute_impact
        return compute_impact(self, type, params, inputs_refs)
