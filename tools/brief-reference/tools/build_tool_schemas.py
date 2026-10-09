#!/usr/bin/env python3
"""Generates tools/tool_schemas.json (agent-layer tools) and validates it.
Builds ON integrations/sitetech-tool-layer.json: its get_* data tools are referenced by exact name, never redefined."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
INTEG = os.path.normpath(os.path.join(HERE, "..", "..", "integrations", "sitetech-tool-layer.json"))
integ = json.load(open(INTEG))
DATA_TOOLS = [t["name"] for t in integ["tools"]]

REF = {"$ref": "#/$defs/Ref"}
def arr(x, **k): return {"type": "array", "items": x, **k}
def obj(props, req=(), addl=False, **k):
    o = {"type": "object", "properties": props, "additionalProperties": addl, **k}
    if req: o["required"] = list(req)
    return o
S = {"type": "string"}; D = {"type": "string", "format": "date"}; DT = {"type": "string", "format": "date-time"}
I = {"type": "integer"}; N = {"type": "number"}; B = {"type": "boolean"}
def E(*v): return {"type": "string", "enum": list(v)}

defs = {
 "Ref": {"type": "string", "pattern": "^(procore|msgraph_outlook|msgraph_sharepoint|p6|procore_schedule|sitetech):[a-z_]+:[A-Za-z0-9_.\\-]+$",
         "description": "source:entity_type:external_id. Integrations SourceRef {system, external_id} + entity_type (RECONCILE R2)."},
 "Citation": obj({"ref": REF, "fields": arr(S), "value": {}, "as_of": S, "quote": {"type": "string", "maxLength": 300}}, ["ref"]),
 "Confidence": E("Confirmed", "Likely", "Signal", "suppressed"),
 "Severity": E("low", "medium", "high", "critical"),
 "Tier": E("T0", "T1", "T2", "T3"),
 "Person": {"$ref": INTEG_ID + "#/$defs/Person"} if (INTEG_ID := integ["$id"]) else {},
 "Freshness": {"$ref": integ["$id"] + "#/$defs/Freshness"},
 "Gap": {"$ref": integ["$id"] + "#/$defs/Gap"},
 "FindingRow": obj({
    "id": S, "org_id": S, "project_id": S, "run_date": D, "rule_id": S, "rule_version": S, "entity_type": S, "entity_id": S, "source": S, "external_id": S,
    "record_label": S, "title": S, "severity": {"$ref": "#/$defs/Severity"}, "status": E("open", "resolved", "suppressed"),
    "days_overdue": {"type": "integer", "minimum": 0}, "governing_date": {"type": ["string", "null"], "format": "date"},
    "governing_date_kind": {"type": ["string", "null"]}, "ball_in_court": {"type": ["string", "null"]}, "spec_section": {"type": ["string", "null"]},
    "fingerprint": S, "first_detected_on": D, "last_seen_on": D, "resolved_on": {"type": ["string", "null"], "format": "date"},
    "change_since_prior_run": E("new", "worse", "better", "unchanged", "resolved"), "evidence": {"type": "object"},
    "citations": arr(obj({"ref": REF, "fields": arr(S)}, ["ref"]), minItems=1)},
    ["rule_id", "rule_version", "entity_type", "external_id", "severity", "days_overdue", "fingerprint", "evidence", "citations"],
    description="Same columns as evals/fixture/m1/SCHEMA_NOTES.md (findings)."),
 "Link": obj({"a_ref": REF, "b_ref": REF,
              "link_type": E("about", "blocks", "supersedes", "responds_to", "funds", "bills_against", "located_at", "decided_in", "same_as"),
              "method": E("key", "structural", "heuristic", "llm", "human", "native"), "confidence": {"type": "number", "minimum": 0, "maximum": 1},
              "evidence": obj({"keys": arr(obj({"key_type": S, "key_value": S}, ["key_type", "key_value"])), "rationale": {"type": "string", "maxLength": 400},
                               "quotes": arr(S)}, addl=False),
              "status": E("proposed", "accepted", "rejected", "superseded")}, ["a_ref", "b_ref", "link_type", "method", "confidence"]),
 "ApprovalPayload": obj({
    "action_type": E("send_email", "submit_rfi", "propose_schedule_change", "create_change_event"), "tier": {"const": "T2"},
    "target": obj({"system": S, "project_external_id": S}, ["system"]), "summary": {"type": "string", "maxLength": 200},
    "body": {"type": "object", "description": "Exact payload that would be executed."},
    "rationale_claims": arr(obj({"text": S, "citations": arr({"$ref": "#/$defs/Citation"}, minItems=1)}, ["text", "citations"]), minItems=1),
    "risk_notes": arr(S), "reversible": B, "expires_at": DT, "deadline_ref": {"type": ["string", "null"]}},
    ["action_type", "tier", "target", "summary", "body", "rationale_claims", "reversible", "expires_at"]),
}

def tool(name, desc, tier, inp, out, idem, milestone, callers, status="enabled", builds_on=None, read=True):
    t = {"name": name, "description": desc,
         "annotations": {"readOnlyHint": read, "destructiveHint": False, "idempotentHint": idem.startswith("idempotent")},
         "x-tier": tier, "x-idempotency": idem, "x-milestone": milestone, "x-status": status, "x-allowed-callers": callers,
         "inputSchema": inp, "outputSchema": out}
    if builds_on: t["x-builds-on"] = builds_on
    return t

ENV = lambda items: obj({"items": items, "freshness": {"$ref": "#/$defs/Freshness"}, "gaps": arr({"$ref": "#/$defs/Gap"})}, ["items"], addl=True)
ANALYSTS = ["schedule_analyst", "cost_analyst", "rfi_submittal_analyst", "procurement_analyst", "comms_decisions_analyst"]
ALL_LLM = ["orchestrator_chat"] + ANALYSTS + ["correlator", "verifier"]

tools = [
 # ---------------- T0 read (intelligence-owned state or deterministic computation) ----------------
 tool("get_project_snapshot", "Return the frozen project-state snapshot for an as_of date: open finding fingerprints with severity and days_overdue, insight anchors and impacts, KPI roll-ups (contingency used, overdue counts, float on watched activities), decisions register state, and source freshness. Use for 'what did the brief see' and as the base for diffs. Never use it as evidence for a claim about current state; cite the underlying records.",
      "T0", obj({"as_of": D, "include": arr(E("findings", "insights", "entities", "kpis", "decisions", "freshness"))}, ["as_of"]),
      obj({"as_of": D, "cutoff_at": DT, "snapshot": {"type": "object"}, "hash": S, "found": B}, ["as_of", "found"], addl=True),
      "idempotent (pure read)", "M2", ALL_LLM + ["brief_writer"]),
 tool("diff_snapshots", "Compute NEW / WORSE / BETTER / UNCHANGED / RESOLVED between two snapshots using the rules in DAILY_BRIEF_SPEC section 6.3. Deterministic code; returns per-fingerprint deltas with before/after values and the KPI deltas used in the status line.",
      "T0", obj({"from_as_of": D, "to_as_of": D, "scope": arr(E("findings", "insights", "kpis", "decisions", "entities"))}, ["from_as_of", "to_as_of"]),
      obj({"basis": E("prior_business_day_snapshot", "first_run_no_prior", "prior_snapshot_missing"),
           "changes": arr(obj({"fingerprint": S, "kind": E("finding", "insight", "kpi", "decision", "entity"), "change": E("new", "worse", "better", "unchanged", "resolved", "reopened"),
                               "before": {}, "after": {}, "delta_text": S}, ["fingerprint", "kind", "change"], addl=True))}, ["basis", "changes"], addl=True),
      "idempotent (pure read)", "M2", ALL_LLM),
 tool("get_float_changes", "Source-agnostic schedule diff between two schedule updates (P6 XER uploads or Procore schedule versions): total/free float, early finish, driving-path membership and milestone forecast per activity, plus projected float for unstarted activities past early start (TF minus workdays since data date). Built on the integrations get_schedule tool; adds update-to-update comparison that get_schedule does not provide.",
      "T0", obj({"from_update_id": {"type": ["string", "null"], "description": "Defaults to the second-latest update."}, "to_update_id": {"type": ["string", "null"]},
                 "activity_ids": arr(S), "watched_only": {"type": "boolean", "default": True}, "min_tf_change_wd": {"type": "integer", "default": 1},
                 "project_forward_to": {"type": ["string", "null"], "format": "date", "description": "If set, include projected TF for unstarted activities as of this date."}}),
      ENV(arr(obj({"activity_ref": REF, "activity_id": S, "name": S, "tf_before_wd": {"type": ["number", "null"]}, "tf_after_wd": {"type": ["number", "null"]},
                   "ff_after_wd": {"type": ["number", "null"]}, "early_finish_before": {"type": ["string", "null"]}, "early_finish_after": {"type": ["string", "null"]},
                   "driving_path_before": {"type": ["boolean", "null"]}, "driving_path_after": {"type": ["boolean", "null"]},
                   "projected_tf_wd": {"type": ["number", "null"]}, "update_ids": arr(S), "data_dates": arr(D)}, ["activity_ref", "activity_id"], addl=True))),
      "idempotent (pure read)", "M3", ["schedule_analyst", "procurement_analyst", "correlator", "verifier", "orchestrator_chat"],
      builds_on=["get_schedule"]),
 tool("list_findings", "List deterministic findings (layer 1) with filters. The only sanctioned source for days_overdue, severity and rule evidence. Analysts must start from findings, not from raw lists.",
      "T0", obj({"run_date": D, "rule_ids": arr(S), "status": arr(E("open", "resolved", "suppressed")), "min_severity": {"$ref": "#/$defs/Severity"},
                 "entity_refs": arr(REF), "change_since_prior_run": arr(E("new", "worse", "better", "unchanged", "resolved")),
                 "limit": {"type": "integer", "default": 200, "maximum": 1000}}),
      ENV(arr({"$ref": "#/$defs/FindingRow"})), "idempotent (pure read)", "M1", ALL_LLM + ["brief_writer"]),
 tool("get_entity_links", "Return the typed link neighbourhood of one or more records from the project knowledge graph (link_keys + entity_links), with link method, confidence and evidence. Use to assemble connected components for correlation.",
      "T0", obj({"refs": arr(REF, minItems=1), "depth": {"type": "integer", "minimum": 1, "maximum": 3, "default": 1}, "min_confidence": {"type": "number", "default": 0.6},
                 "link_types": arr(S), "include_proposed": {"type": "boolean", "default": False}}, ["refs"]),
      obj({"links": arr({"$ref": "#/$defs/Link"}), "nodes": arr(obj({"ref": REF, "label": S, "key_fields": {"type": "object"}}, ["ref"], addl=True)),
           "link_keys": arr(obj({"ref": REF, "key_type": S, "key_value": S, "derivation": S, "confidence": N}, ["ref", "key_type", "key_value"], addl=True))}, ["links", "nodes"], addl=True),
      "idempotent (pure read)", "M1", ALL_LLM),
 tool("resolve_refs", "Fetch exact current field values for cited refs from the normalized tables (approved Mode A fields only), including deleted flag and synced_at. Used by the verifier to check citations and by analysts to read a specific record. Point lookup only; for lists use the integrations get_* tools.",
      "T0", obj({"refs": arr(REF, minItems=1, maxItems=100), "fields": arr(S, description="Dotted paths; empty = all approved fields.")}, ["refs"]),
      obj({"records": arr(obj({"ref": REF, "found": B, "deleted": B, "synced_at": DT, "source_url": S, "fields": {"type": "object"}}, ["ref", "found"], addl=True))}, ["records"], addl=True),
      "idempotent (pure read)", "M1", ALL_LLM, builds_on=["get_rfis", "get_submittals", "get_schedule", "get_budget", "get_change_orders", "get_contracts", "get_pay_apps", "get_daily_reports", "get_drawings", "get_documents", "get_project_emails"]),
 tool("compute_impact", "Deterministic impact math (pipeline stage S7). Models request impacts; code computes. Types: delay_chain (slip through successors to a milestone on the project calendar), usd_sum, contingency, notice_window (event date + clause days, business-day countdown), ros_margin (ROS - lead - buffer vs projected return), payapp_earned (duration-weighted schedule-earned % vs billed %), manpower_shortfall (horizon x (1 - actual/planned)). Returns value plus a human-readable method string that must be shown with the number.",
      "T0", obj({"type": E("delay_chain", "usd_sum", "contingency", "notice_window", "ros_margin", "payapp_earned", "manpower_shortfall"),
                 "params": {"type": "object", "description": "Type-specific; e.g. delay_chain: {activity_ids[], slip_wd, milestone_activity_id}; notice_window: {event_date, notice_days, day_basis}."},
                 "inputs_refs": arr(REF, minItems=1, description="Records the inputs are read from; code re-reads them rather than trusting caller values.")}, ["type", "params", "inputs_refs"]),
      obj({"value": {"type": "object"}, "method": S, "inputs_used": arr({"$ref": "#/$defs/Citation"}), "confidence_cap": {"$ref": "#/$defs/Confidence"},
           "freshness_notes": arr(S)}, ["value", "method", "inputs_used"], addl=True),
      "idempotent (pure function of cited records at cutoff)", "M1 (ros_margin) / M3", ALL_LLM),
 tool("get_decisions_register", "Read the decisions register: pending and made decisions extracted from meeting items, email and owner-BIC records, with owner, needed-by, carried count, follow-through refs and status.",
      "T0", obj({"status": arr(E("pending", "made", "superseded", "closed")), "owner": S, "due_within_wd": I, "include_follow_through": {"type": "boolean", "default": True}}),
      ENV(arr(obj({"decision_ref": S, "kind": E("pending", "made"), "summary": S, "owner": S, "needed_by": {"type": ["string", "null"]}, "made_on": {"type": ["string", "null"]},
                   "carried_count": I, "source_refs": arr(REF), "follow_through_refs": arr(REF), "status": S}, ["decision_ref", "kind", "summary", "source_refs"], addl=True))),
      "idempotent (pure read)", "M2", ["comms_decisions_analyst", "correlator", "verifier", "orchestrator_chat", "cost_analyst"]),
 tool("get_contract_terms", "Read contract terms extracted from SharePoint contracts (notice periods, pay-app clauses, LDs) with page references and human-confirmation status. Notice-window rules must use confirmed terms only.",
      "T0", obj({"party": E("GC->Owner", "Sub->GC", "any"), "confirmed_only": {"type": "boolean", "default": True}, "topics": arr(E("notice", "payment", "retainage", "liquidated_damages", "weather", "default"))}),
      ENV(arr(obj({"id": S, "doc_ref": REF, "page": I, "clause": S, "text": S, "notice_days": {"type": ["integer", "null"]}, "day_basis": E("calendar", "business", "unknown"),
                   "party": S, "confirmed_by_human": B, "confirmed_by": {"type": ["string", "null"]}}, ["id", "doc_ref", "clause", "confirmed_by_human"], addl=True))),
      "idempotent (pure read)", "M2", ["comms_decisions_analyst", "cost_analyst", "correlator", "verifier", "orchestrator_chat"]),
 tool("get_brief", "Read a published brief (JSON per schemas/brief.schema.json) and optionally its claims with verifier verdicts. Powers 'why is this here / show me the source'.",
      "T0", obj({"as_of": D, "version": {"type": ["integer", "null"]}, "include_claims": {"type": "boolean", "default": False}}, ["as_of"]),
      obj({"brief": {"type": "object"}, "claims": arr({"type": "object"})}, ["brief"], addl=True), "idempotent (pure read)", "M2", ["orchestrator_chat", "correlator"]),
 tool("get_approval_status", "Read the state of an approval request (pending / approved / rejected / expired / executed / failed).",
      "T0", obj({"approval_id": S}, ["approval_id"]),
      obj({"approval_id": S, "status": E("pending", "approved", "rejected", "expired", "executed", "failed"), "decided_by": {"type": ["string", "null"]},
           "decided_at": {"type": ["string", "null"]}, "expires_at": DT, "execution_result": {"type": ["object", "null"]}}, ["approval_id", "status"], addl=True),
      "idempotent (pure read)", "M2", ALL_LLM),
 # ---------------- T1 internal writes (SiteTech tables only) ----------------
 tool("upsert_findings", "Write deterministic findings for a run. Rules engine only (code, not models). Upsert key (project_id, run_date, fingerprint); lifecycle fields (first_detected_on, change_since_prior_run, resolved rows) computed server-side from the prior run.",
      "T1", obj({"run_date": D, "run_id": S, "findings": arr({"$ref": "#/$defs/FindingRow"})}, ["run_date", "run_id", "findings"]),
      obj({"inserted": I, "updated": I, "resolved": I, "fingerprints": arr(S)}, ["inserted", "updated", "resolved"], addl=True),
      "idempotent (upsert on project_id+run_date+fingerprint)", "M1", ["rules_engine"], read=False),
 tool("set_finding_disposition", "Record a human disposition on a finding or brief item: mute, unmute, suppress (with reason), mark not useful, reassign owner. User-initiated from the UI; logged as feedback. Models may not call this.",
      "T1", obj({"target": obj({"finding_id": S, "insight_id": S}), "disposition": E("mute", "unmute", "suppress", "not_useful", "useful", "reassign"),
                 "reason": {"type": "string", "maxLength": 500}, "new_owner": S, "actor_user_id": S}, ["target", "disposition", "actor_user_id"]),
      obj({"ok": B, "audit_id": S}, ["ok"]), "idempotent (last-write-wins per target+disposition)", "M2", ["ui_user"], read=False),
 tool("link_entities", "Propose or record a typed link between two records with method, confidence and evidence. Links >= 0.80 are accepted automatically; 0.60-0.80 stored as proposed; < 0.60 rejected (ARCHITECTURE 5.1). Links never cross projects.",
      "T1", obj({"links": arr({"$ref": "#/$defs/Link"}, minItems=1, maxItems=200), "run_id": S}, ["links", "run_id"]),
      obj({"results": arr(obj({"a_ref": REF, "b_ref": REF, "link_type": S, "status": E("accepted", "proposed", "rejected", "unchanged"), "link_id": S}, ["status"], addl=True))}, ["results"], addl=True),
      "idempotent (upsert on a_ref+b_ref+link_type; higher-confidence evidence wins)", "M1", ["linker", "comms_decisions_analyst", "rfi_submittal_analyst", "ui_user"], read=False),
 tool("save_insights", "Persist analyst candidates or correlated insights with their claims (citations, numeric assertions) for verification. Does not publish anything.",
      "T1", obj({"run_id": S, "stage": E("analyst", "correlator"), "insights": arr(obj({
          "insight_id": S, "playbook_rule_ids": arr(S), "finding_ids": arr(S), "record_refs": arr(REF), "headline": S,
          "claims": arr(obj({"claim_id": S, "text": S, "claim_type": E("fact", "computed", "inference", "recommendation"),
                             "citations": arr({"$ref": "#/$defs/Citation"}, minItems=1), "numeric_assertions": arr({"type": "object"})}, ["text", "claim_type", "citations"], addl=True), minItems=1),
          "impact_request": {"type": ["object", "null"]}, "owner": {"type": ["object", "null"]}, "action": {"type": ["object", "null"]},
          "self_confidence": N, "fingerprint": S}, ["headline", "claims"], addl=True))}, ["run_id", "stage", "insights"]),
      obj({"saved": I, "insight_ids": arr(S)}, ["saved"], addl=True), "idempotent (upsert on run_id+stage+fingerprint)", "M2", ANALYSTS + ["correlator"], read=False),
 tool("save_brief", "Persist a verified brief JSON (must validate against schemas/brief.schema.json) and its rendered markdown. Only callable after the verifier stage passed for the run.",
      "T1", obj({"run_id": S, "as_of": D, "brief_json": {"type": "object"}, "rendered_md": S}, ["run_id", "as_of", "brief_json"]),
      obj({"brief_id": S, "version": I, "valid": B, "errors": arr(S)}, ["valid"], addl=True), "idempotent (run_id + content hash)", "M2", ["brief_writer", "pipeline"], read=False),
 tool("update_decisions_register", "Insert or update decisions register entries from meeting items, emails or records (pending/made, owner, needed_by, follow-through refs). Each entry must cite at least one source ref.",
      "T1", obj({"run_id": S, "entries": arr(obj({"decision_ref": S, "kind": E("pending", "made"), "summary": S, "owner": S, "needed_by": {"type": ["string", "null"]},
                                                   "made_on": {"type": ["string", "null"]}, "source_refs": arr(REF, minItems=1), "follow_through_refs": arr(REF),
                                                   "status": E("pending", "made", "superseded", "closed")}, ["decision_ref", "kind", "summary", "source_refs"]))}, ["run_id", "entries"]),
      obj({"upserted": I}, ["upserted"]), "idempotent (upsert on decision_ref)", "M2", ["comms_decisions_analyst"], read=False),
 tool("log_audit_event", "Append an audit event (append-only, hash-chained; ARCHITECTURE 14). Called by the runtime for every tool call, approval transition and publication; agents may add explicit events (e.g. 'gap.declared').",
      "T1", obj({"action": S, "tier": {"$ref": "#/$defs/Tier"}, "target_ref": {"type": ["string", "null"]}, "run_id": {"type": ["string", "null"]},
                 "approval_id": {"type": ["string", "null"]}, "details": {"type": "object"}, "idempotency_key": S}, ["action", "tier", "idempotency_key"]),
      obj({"audit_id": S, "row_hash": S}, ["audit_id"]), "idempotent (idempotency_key)", "M1", ["*"], read=False),
 tool("request_approval", "Create a T2 approval request with an exact, hashed payload (ARCHITECTURE 11.2). Creating the request is T1; nothing executes until a human approves and the executor re-validates the payload hash and preconditions. In V1 requests can be created for review but no T2 executor is enabled.",
      "T1", obj({"payload": {"$ref": "#/$defs/ApprovalPayload"}, "approver_roles": arr(S, minItems=1), "run_id": S}, ["payload", "approver_roles"]),
      obj({"approval_id": S, "payload_hash": S, "status": {"const": "pending"}, "expires_at": DT}, ["approval_id", "payload_hash", "status"]),
      "idempotent (payload_hash)", "M2", ["orchestrator_chat", "correlator", "pipeline"], read=False),
 tool("create_draft_message", "Create a SiteTech-internal draft (RFI chase, vendor follow-up, decision memo) that a human copies and sends. Not an Outlook draft (no Mail.ReadWrite). DISABLED IN V1 per CTO scope; returns {status:'disabled_in_v1'}.",
      "T1", obj({"kind": E("rfi_chase", "vendor_followup", "decision_memo", "escalation", "notice_review"), "to_people": arr(S), "subject": S, "body": S,
                 "linked_item_id": S, "citations": arr({"$ref": "#/$defs/Citation"}, minItems=1)}, ["kind", "subject", "body", "citations"]),
      obj({"status": E("created", "disabled_in_v1"), "draft_id": {"type": ["string", "null"]}}, ["status"]),
      "idempotent (linked_item_id + kind + body hash)", "post-V1", ["brief_writer", "orchestrator_chat"], status="disabled_in_v1", read=False),
 # ---------------- T2: external / system-of-record writes. Defined, disabled, approval-gated ----------------
 tool("submit_rfi", "Submit an RFI to Procore on approval. Executes through the integrations future write action 'create_rfi_draft (human-approved; Procore POST rfis)'. Requires an approved approval_id whose payload_hash matches. DISABLED IN V1 (GET-only Procore client).",
      "T2", obj({"approval_id": S, "payload_hash": S}, ["approval_id", "payload_hash"]),
      obj({"status": E("executed", "disabled_in_v1", "rejected_hash_mismatch", "expired", "precondition_failed"), "result_ref": {"type": ["string", "null"]}}, ["status"]),
      "idempotent (approval_id executes at most once)", "post-V1", ["approval_executor"], status="disabled_in_v1", builds_on=["get_rfis (x-future-write-actions: create_rfi_draft)"], read=False),
 tool("send_email", "Send an email on a user's behalf on approval. Requires Mail.Send, which V1 does not request. DISABLED IN V1.",
      "T2", obj({"approval_id": S, "payload_hash": S}, ["approval_id", "payload_hash"]),
      obj({"status": E("executed", "disabled_in_v1", "rejected_hash_mismatch", "expired", "precondition_failed")}, ["status"]),
      "idempotent (approval_id executes at most once)", "post-V1", ["approval_executor"], status="disabled_in_v1", read=False),
 tool("propose_schedule_change", "Package a proposed schedule change (activity, logic or duration edits) with evidence for the scheduler. V1 has no schedule write path (P6 via XER upload only), so even when enabled this produces an approval record and an exportable change list, never a direct edit. DISABLED IN V1.",
      "T2", obj({"changes": arr(obj({"activity_id": S, "field": E("duration", "start", "finish", "predecessor", "constraint"), "from": {}, "to": {}, "reason": S}, ["activity_id", "field", "to", "reason"]), minItems=1),
                 "citations": arr({"$ref": "#/$defs/Citation"}, minItems=1)}, ["changes", "citations"]),
      obj({"status": E("approval_requested", "disabled_in_v1"), "approval_id": {"type": ["string", "null"]}}, ["status"]),
      "idempotent (change-set hash)", "post-V1", ["schedule_analyst", "orchestrator_chat"], status="disabled_in_v1", read=False),
 tool("create_change_event", "Create a Procore change event on approval (e.g. to link an RFI answer with change language). DISABLED IN V1.",
      "T2", obj({"approval_id": S, "payload_hash": S}, ["approval_id", "payload_hash"]),
      obj({"status": E("executed", "disabled_in_v1", "rejected_hash_mismatch", "expired", "precondition_failed"), "result_ref": {"type": ["string", "null"]}}, ["status"]),
      "idempotent (approval_id executes at most once)", "post-V1", ["approval_executor"], status="disabled_in_v1", read=False),
]

doc = {
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://sitetech.ai/schemas/agent-layer-tools/v0.1.json",
 "title": "SiteTech intelligence layer: agent-layer tool definitions (draft v0.1)",
 "description": "Agent-layer tools that sit ON TOP of the integrations canonical data tools. Data reads use the integrations get_* tools by their exact names and shapes (referenced, not redefined). This file adds only: snapshots/diffs, schedule float diffs, findings read/write, entity links, ref resolution for citation checks, deterministic impact math, decisions register, contract terms, briefs, approvals, audit, and disabled draft/T2 tools. MCP/OpenAI-compatible: name, description, inputSchema, outputSchema, annotations. Generated by tools/build_tool_schemas.py.",
 "x-builds-on": {"file": "../../integrations/sitetech-tool-layer.json", "$id": integ["$id"], "data_tools": DATA_TOOLS,
                 "rule": "Agents call these data tools directly for lists. Field mismatches with the intelligence layer are tracked in ../RECONCILE.md."},
 "x-conventions": {
   "tenancy": "Same as integrations: tenant from the authenticated session, enforced by RLS; never a tool argument. project_id comes from run context.",
   "refs": "Citations use Ref = source:entity_type:external_id (see $defs/Ref).",
   "tiers": "T0 read; T1 SiteTech-internal write; T2 external/system-of-record write, approval required; T3 never a tool (payments, CO approval, contractual commitments, notices).",
   "status": "x-status 'disabled_in_v1' tools are registered so prompts and audits are stable, but return {status:'disabled_in_v1'} without side effects.",
   "allowed_callers": "x-allowed-callers is enforced by the runtime allow-list (ARCHITECTURE 8). '*' = runtime-wide.",
   "audit": "Every call (allowed or denied) writes audit_log; every model call writes llm_traces (Supabase tables, no extra vendor in V1).",
   "freshness": "Responses that derive from source data carry integrations Freshness/Gap objects; agents must propagate them."},
 "$defs": defs,
 "x-agent-allowlists": {
   "schedule_analyst": ["get_schedule", "get_daily_reports", "get_project_activity", "get_float_changes", "list_findings", "get_entity_links", "resolve_refs", "compute_impact", "save_insights"],
   "cost_analyst": ["get_budget", "get_change_orders", "get_contracts", "get_pay_apps", "get_schedule", "list_findings", "get_entity_links", "resolve_refs", "compute_impact", "get_contract_terms", "get_decisions_register", "save_insights"],
   "rfi_submittal_analyst": ["get_rfis", "get_submittals", "get_drawings", "list_findings", "get_entity_links", "resolve_refs", "compute_impact", "link_entities", "save_insights"],
   "procurement_analyst": ["get_procurement_status", "get_submittals", "get_contracts", "get_project_emails", "get_float_changes", "list_findings", "get_entity_links", "resolve_refs", "compute_impact", "save_insights"],
   "comms_decisions_analyst": ["get_project_emails", "get_documents", "get_project_activity", "get_decisions_register", "update_decisions_register", "get_contract_terms", "list_findings", "get_entity_links", "resolve_refs", "link_entities", "compute_impact", "save_insights"],
   "correlator": ["list_findings", "get_entity_links", "resolve_refs", "get_project_snapshot", "diff_snapshots", "get_decisions_register", "get_contract_terms", "compute_impact", "save_insights"],
   "verifier": ["resolve_refs", "compute_impact", "list_findings", "get_entity_links", "get_float_changes", "get_contract_terms"],
   "brief_writer": ["save_brief"],
   "orchestrator_chat": DATA_TOOLS + ["get_project_snapshot", "diff_snapshots", "get_float_changes", "list_findings", "get_entity_links", "resolve_refs", "compute_impact", "get_decisions_register", "get_contract_terms", "get_brief", "get_approval_status"]},
 "x-requested-data-tools": [
   {"name": "get_meetings", "owner": "integrations", "status": "requested (RECONCILE R9)", "why": "Decisions and action items (OAC minutes) are core to the brief; no data tool covers Procore Meetings or minutes in SharePoint.",
    "proposed_item_fields": ["meeting_id", "title", "date", "attendees[]", "items[]{item_id, number, type(decision_pending|decision_made|action|info), text, assignee, due_date, status, carried_from[]}", "sources[]"]},
   {"name": "get_project_emails (message-level mode)", "owner": "integrations", "status": "requested (RECONCILE R8)", "why": "Citations and notice clocks need message ids, received_at, sender and body (Mode A), not only thread summaries."}],
 "tools": tools,
}

out = os.path.join(HERE, "tool_schemas.json")
json.dump(doc, open(out, "w"), indent=2); open(out, "a").write("\n")

# ---------------- validation ----------------
d2 = json.load(open(out))
names = [t["name"] for t in d2["tools"]]
assert len(names) == len(set(names)), "duplicate tool names"
overlap = set(names) & set(DATA_TOOLS); assert not overlap, f"redefines integrations tools: {overlap}"
for agent, al in d2["x-agent-allowlists"].items():
    unknown = [n for n in al if n not in names and n not in DATA_TOOLS]; assert not unknown, (agent, unknown)
for t in d2["tools"]:
    for b in t.get("x-builds-on", []):
        assert b.split(" ")[0] in DATA_TOOLS, b
    for c in t["x-allowed-callers"]:
        pass
    assert t["x-tier"] in ("T0", "T1", "T2"), t["name"]
    if t["x-tier"] == "T2": assert t["x-status"] == "disabled_in_v1", t["name"]
try:
    import jsonschema
    from referencing import Registry, Resource
    reg = Registry().with_resources([(integ["$id"], Resource.from_contents(integ)), (d2["$id"], Resource.from_contents(d2))])
    for t in d2["tools"]:
        for key in ("inputSchema", "outputSchema"):
            sch = dict(t[key]); sch["$defs"] = d2["$defs"]
            jsonschema.Draft202012Validator.check_schema(sch)
            v = jsonschema.Draft202012Validator(sch, registry=reg)
            # resolve every $ref by walking
            def walk(o):
                if isinstance(o, dict):
                    if "$ref" in o: v._resolver.lookup(o["$ref"]) if hasattr(v, "_resolver") else None
                    for x in o.values(): walk(x)
                elif isinstance(o, list):
                    for x in o: walk(x)
            walk(sch)
    # contract test: the M1 seed findings must validate against list_findings output
    t = [x for x in d2["tools"] if x["name"] == "list_findings"][0]
    sch = dict(t["outputSchema"]); sch["$defs"] = d2["$defs"]
    rows = json.load(open(os.path.join(HERE, "..", "evals", "fixture", "m1", "day2", "findings.json")))
    inst = {"items": rows, "freshness": {"as_of": "2026-10-07T04:46:00-04:00", "sources": [{"system": "procore", "last_successful_sync": "2026-10-07T04:46:00-04:00", "mode": "poll", "stale": False}]}, "gaps": []}
    jsonschema.Draft202012Validator(sch, registry=reg).validate(inst)
    try:
        jsonschema.Draft202012Validator(sch, registry=reg).validate({**inst, "freshness": {"as_of": 123}}); raise SystemExit("cross-file $ref not enforced")
    except jsonschema.ValidationError:
        pass
    print("schemas: meta-valid; fixture findings validate against list_findings; cross-file $refs enforced")
except ImportError:
    print("jsonschema not installed: structural checks only")
print(f"OK: {len(names)} agent-layer tools; builds on {len(DATA_TOOLS)} integrations data tools; T2 all disabled_in_v1")
