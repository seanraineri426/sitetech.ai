"""Per-agent output contracts (JSON Schema with per-field length caps). One source of truth for: the prompt (schema is shown to the
model), response_format (json_object: the Bedrock endpoint rejects strict json_schema, see runs/_probes), and code validation.
Caps are enforced in code by clamp() (truncate + record), so an over-long answer can never truncate the JSON itself.
Port: each SCHEMA maps to a Zod schema for AI SDK generateObject({ schema })."""
import copy, re
import jsonschema

REF = {"type": "string", "pattern": r"^(procore|msgraph_outlook|msgraph_sharepoint|p6|procore_schedule|sitetech):[a-z_]+:[A-Za-z0-9_.\-]+$"}
DATE = {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}$"}
LABEL = {"enum": ["Confirmed", "Likely", "Signal"]}
def S(n): return {"type": "string", "maxLength": n}
def A(item, n, mn=0): return {"type": "array", "items": item, "maxItems": n, "minItems": mn}
def O(props, req=None): return {"type": "object", "properties": props, "required": req or list(props), "additionalProperties": False}

IMPACT_REQ = O({"type": {"enum": ["delay_chain", "usd_sum", "manpower_shortfall", "payapp_earned", "ros_margin", "contingency"]},   # notice windows: code only
                "params": {"type": "object"}, "inputs_refs": A(REF, 8), "basis_ref": REF, "basis_quote": S(220)})

CLUSTER = O({
    "cluster_id": S(10),
    "insights": A(O({
        "key": S(12), "finding_ids": A(S(120), 12, 1),
        "section": {"enum": ["schedule_risks", "cost_risks", "procurement_issues", "overdue_rfis", "overdue_submittals", "unresolved_decisions"]},
        "headline": S(150), "mechanism": S(260),
        "claims": A(O({"text": S(260), "kind": {"enum": ["fact", "impact", "inference"]}, "refs": A(REF, 6, 1), "label": LABEL}), 5, 1),
        "impact_requests": A(IMPACT_REQ, 3),
        "decision_deadline": {"anyOf": [{"type": "null"}, O({"date": DATE, "kind": S(40), "basis_ref": REF, "basis_quote": S(200)})]},
        "owner": O({"name": S(60), "why": S(100)}), "action": S(170), "confidence": LABEL}), 6),
    "set_aside": A(O({"finding_id": S(120), "reason": S(170)}), 12),
    "proposed_links": A(O({"a": REF, "b": REF, "reason": S(120)}), 5),
    "gaps": A(S(170), 3)})

SIGNALS = ["notice_language", "dated_consequence", "cost_scope", "decision_by_principal", "cash_strain", "from_lender_owner_ahj_utility",
           "design_return", "internal_or_social"]
_EMAIL_ROW = {
    "ref": REF, "category": {"enum": ["contractual_notice", "schedule_slip", "cost_scope", "decision", "payment", "lender_owner", "design_response", "other"]},
    "signals": O({k: {"type": "boolean"} for k in SIGNALS}), "why": S(150),
    "decision": O({"kind": {"enum": ["made", "requested", "none"]}, "summary": S(170), "decider": S(60), "needed_by": {"anyOf": [{"type": "null"}, DATE]}}),
    "formal_notice": O({"is_formal_notice": {"type": "boolean"}, "notice_types": A({"enum": ["delay", "cost_or_change_claim", "differing_site_condition", "other", "delay_time_extension", "cost_change_claim", "cure_default"]}, 4),
                        "quote": S(220)}, ["is_formal_notice"]),
    "links": A(REF, 4), "quote": S(220)}
# formal_notice is optional (iteration 3): an omitted classification means "not classified" (the code notice regex still applies),
# so a missing field never triggers a paid repair call
COMMS = O({"emails": A(O(_EMAIL_ROW, [k for k in _EMAIL_ROW if k != "formal_notice"]), 40), "gaps": A(S(170), 3)})

WRITER = O({"items": A(O({"item_id": S(4), "headline": S(140), "body": S(420), "action_text": S(170), "definition_of_done": S(120)}), 7),
            "status_line": S(240)})

def clamp(obj, schema, path="", log=None):
    """Truncate strings over maxLength (at a word boundary) and arrays over maxItems; record each fix. Returns new obj."""
    log = [] if log is None else log
    if isinstance(obj, str) and schema.get("maxLength") and len(obj) > schema["maxLength"]:
        cut = obj[:schema["maxLength"]].rsplit(" ", 1)[0].rstrip(",;:") ; log.append({"path": path, "fix": f"string {len(obj)} -> {len(cut)} chars"}); return cut
    if isinstance(obj, list):
        it = schema.get("items", {})
        if schema.get("maxItems") is not None and len(obj) > schema["maxItems"]:
            log.append({"path": path, "fix": f"array {len(obj)} -> {schema['maxItems']} items"}); obj = obj[:schema["maxItems"]]
        return [clamp(x, it, f"{path}[{i}]", log) for i, x in enumerate(obj)]
    if isinstance(obj, dict):
        props = schema.get("properties") or {}
        if not props and "anyOf" in schema:
            props = next((s.get("properties") for s in schema["anyOf"] if s.get("type") == "object"), {}) or {}
        out = {}
        for k, v in obj.items():
            if props and k not in props and schema.get("additionalProperties") is False:
                log.append({"path": f"{path}.{k}", "fix": "unknown field dropped"}); continue
            out[k] = clamp(v, props.get(k, {}), f"{path}.{k}", log)
        return out
    return obj

def validate(obj, schema):
    return [f'{"/".join(map(str, e.path))}: {e.message[:160]}' for e in jsonschema.Draft202012Validator(schema).iter_errors(obj)]

def prompt_schema(schema):
    """Compact schema text for the prompt."""
    import json
    return json.dumps(schema, separators=(",", ":"))
