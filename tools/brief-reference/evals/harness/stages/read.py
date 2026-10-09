"""Stage 1 `read` (Inngest step "read"): source freshness (S0) and every T0 data read the later stages need, from the fixture tool layer.
Input: FixtureTools, config. Output: {freshness, reads: {agent: {tool_label: result}}, shared: {...}}. Tier: T0 only."""
from . import Actions
from ..context import project_context, records_index
import datetime as dt
from ..calendar_util import d_

def freshness(T, cfg):
    upd = T.sched["updates"][-1]; dd = d_(upd["data_date"]); age = (T.as_of - dd).days
    band = "fresh" if age <= 7 else "aging" if age <= 14 else "stale" if age <= 28 else "missing"
    f = cfg["fixture"]; mb = T.project["project_mailbox"]
    def lab(ts): x = dt.datetime.fromisoformat(ts); return f"{x.strftime('%a')} {x.month}/{x.day} {x.strftime('%-I:%M %p')}"
    up = dt.datetime.fromisoformat(upd["uploaded_at"])
    return [
        {"source": "procore", "system": "procore_dmsa", "band": "fresh", "as_of_label": f"Procore synced {lab(f['procore_last_sync'])}",
         "last_successful_sync": f["procore_last_sync"]},
        {"source": "msgraph_outlook", "band": "fresh", "as_of_label": f"Project mailbox synced {lab(f['mailbox_last_sync'])}",
         "last_successful_sync": f["mailbox_last_sync"], "scope_note": f"Only {mb} is covered; threads that never copy it are invisible"},
        {"source": "schedule", "system": upd["source"], "band": band,
         "as_of_label": f"Schedule as of {T.sched_label()} data date {dd.strftime('%a')} {dd.month}/{dd.day} (uploaded {up.strftime('%a')} {up.month}/{up.day})",
         "last_successful_sync": upd["uploaded_at"], "data_date": upd["data_date"], "uploaded_at": upd["uploaded_at"],
         "schedule_update_id": upd["schedule_update_id"],
         "effect": f"Schedule is {age} days past its data date ({band}): float and {T.milestone_name} impacts are capped at Likely unless corroborated by fresher records" if band != "fresh" else ""},
        {"source": "msgraph_sharepoint", "band": "fresh", "as_of_label": terms_label(T),
         "last_successful_sync": f["mailbox_last_sync"]}]

def terms_label(T):
    np_ = T.project.get("notice_periods") or []
    if np_:   # configured notice periods (mirror of project_notice_periods) are the only source of notice deadlines
        last = max(str(r.get("entered_at") or "")[:10] for r in np_); dd = d_(last) if last else None
        who = sorted({r.get("entered_by") for r in np_ if r.get("entered_by")})
        return f"Contract notice periods configured: {len(np_)} rows" + (f" (entered by {', '.join(who)} {dd.month}/{dd.day})" if dd else "")
    if "notice_periods" in T.project or T.project.get("contract_terms") is not None:
        return "No contract notice periods configured: notice deadlines show as unknown (check the contract)"
    ct = [t for t in T.project.get("contract_terms", []) if t.get("confirmed_by_human")]
    if not ct: return "No contract notice terms confirmed by a human yet"
    last = max(t.get("confirmed_on") or "" for t in ct); dd = d_(last) if last else None
    return f"Contract notice terms {'/'.join(t['id'] for t in ct)} confirmed by GC" + (f" {dd.month}/{dd.day}" if dd else "")

def run(T, cfg):
    A = Actions("read"); asof = T.as_of.isoformat(); wk = (T.as_of - dt.timedelta(days=7)).isoformat(); cu = T.cur_update
    def c(agent, name, **a):
        A.add(f"{agent}:{name}", "T0", a or None); return T.call(agent, name, a)
    fr = freshness(T, cfg)
    reads = {
        "schedule_analyst": {"get_schedule(latest)": c("schedule_analyst", "get_schedule", update_id=cu),
                             "get_float_changes(prev->latest, project_forward_to=as_of)": c("schedule_analyst", "get_float_changes", project_forward_to=asof),
                             "get_daily_reports(as_of-7..as_of)": c("schedule_analyst", "get_daily_reports", date_from=wk, date_to=asof),
                             "get_entity_links(watched activities)": c("schedule_analyst", "get_entity_links", refs=[r for r in T.index if r.startswith("p6:activity:")])},
        "cost_analyst": {"get_budget(both snapshots)": c("cost_analyst", "get_budget"), "get_change_orders(as_of)": c("cost_analyst", "get_change_orders"),
                         "get_change_orders(compare_to)": c("cost_analyst", "get_change_orders", snapshot_date=T.compare_to.isoformat()),
                         "get_contracts": c("cost_analyst", "get_contracts"), "get_pay_apps": c("cost_analyst", "get_pay_apps"),
                         "get_schedule(latest)": c("cost_analyst", "get_schedule", update_id=cu),
                         "get_contract_terms": c("cost_analyst", "get_contract_terms", confirmed_only=False),
                         "get_decisions_register": c("cost_analyst", "get_decisions_register")},
        "rfi_submittal_analyst": {"get_rfis": c("rfi_submittal_analyst", "get_rfis"), "get_submittals": c("rfi_submittal_analyst", "get_submittals"),
                                  "get_drawings": c("rfi_submittal_analyst", "get_drawings"),
                                  "get_entity_links(rfis+submittals)": c("rfi_submittal_analyst", "get_entity_links", refs=[r for r in T.index if ":rfi:" in r or ":submittal:" in r])},
        "procurement_analyst": {"get_procurement_status": c("procurement_analyst", "get_procurement_status"),
                                "get_submittals(current)": c("procurement_analyst", "get_submittals", current_only=True),
                                "get_contracts": c("procurement_analyst", "get_contracts"), "get_project_emails": c("procurement_analyst", "get_project_emails"),
                                "get_float_changes(project_forward_to=as_of)": c("procurement_analyst", "get_float_changes", project_forward_to=asof)},
        "comms_decisions_analyst": {"get_project_emails": c("comms_decisions_analyst", "get_project_emails"),
                                    "get_project_activity(meetings)": c("comms_decisions_analyst", "get_project_activity"),
                                    "get_documents": c("comms_decisions_analyst", "get_documents"),
                                    "get_decisions_register": c("comms_decisions_analyst", "get_decisions_register"),
                                    "get_contract_terms": c("comms_decisions_analyst", "get_contract_terms", confirmed_only=False),
                                    "get_entity_links(emails)": c("comms_decisions_analyst", "get_entity_links", refs=[r for r in T.index if r.startswith("msgraph_outlook")])}}
    shared = {"project_context": project_context(T, fr), "records_index": records_index(T),
              "decisions_register": c("correlator", "get_decisions_register"),
              "contract_terms": c("correlator", "get_contract_terms", confirmed_only=False),
              "entity_links": c("correlator", "get_entity_links", refs=list(T.index))}
    return {"freshness": fr, "reads": reads, "shared": shared}, A
