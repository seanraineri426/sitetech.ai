#!/usr/bin/env python3
"""Deterministic renderer: brief JSON (schemas/brief.schema.json) -> markdown. No model involved: the writer produces JSON,
code produces the page, so nothing can be added between verification and display.  Usage: render_brief.py <brief.json> [out.md]"""
import json, sys, datetime as dt
def d(s): return dt.date.fromisoformat(s[:10])
def short(s): x = d(s); return f"{x.strftime('%a')} {x.month}/{x.day}"
KIND = {'due_date': 'due', 'due_date (review)': 'review due', 'submit_by': 'submit-by', 'latest_return_date': 'latest return'}
def money(v): return f"${v/1000:,.0f}k" if v < 1_000_000 else f"${v/1_000_000:,.2f}M"
def cites(cs): return " · ".join(f"[{c['label']}]" for c in cs)
def render(b):
    o = []; st = b["status"]
    o.append(f"**SiteTech Daily Project Brief: {b['project_name']}**  ")
    gen = dt.datetime.fromisoformat(b["generated_at"])
    o.append(f"**Covers {short(b['as_of'])}** (day counts as of close of business) · generated {short(b['generated_at'])} {gen.strftime('%-I:%M %p')} ET · compared with {short(b['compare_to']['as_of']) if b['compare_to']['as_of'] else 'n/a'}  ")
    o.append("*Data: " + " · ".join(f"{f['as_of_label']} ({f['band']})" for f in b["freshness"]) + "*  ")
    for f in b["freshness"]:
        if f.get("scope_note"): o.append(f"*{f['scope_note']}*  ")
        if f.get("effect"): o.append(f"*{f['effect']}.*  ")
    o.append("")
    for ln in st["lines"]: o.append(f"**{ln}**  " if ln is st["lines"][0] else f"{ln}  ")
    o += ["", "#### Top of Brief (ranked by impact)", ""]
    for t in b["top_items"]:
        tag = f"{t['tag']} · " if t["tag"] not in ("UNCHANGED",) else ""
        o.append(f"**{t['rank']}. {tag}{t['headline']}** *{t['confidence']}*")
        if t.get("delta_text"): o.append(f"*Worse: {t['delta_text']}.*")
        o.append(t["body"])
        m = (t.get("impact") or {}).get("method", "")
        if m.startswith("Record facts: "): o.append(f"*{m.split(' || ')[0]}*")
        co = "".join(f"; {c['name']}" for c in t.get("co_owners", []))
        o.append(f"→ **{t['owner']['name']}** ({t['owner']['role']}{co}): {t['action']['text']} by **{short(t['action']['due'])}**.")
        o.append(f"*Sources: {cites(t['citations'])}*"); o.append("")
    sec = b["sections"]
    def entries(title, rows):
        rows = [r for r in rows if not r.get("item_id")]
        if not rows: return
        o.append(f"#### {title}")
        for r in rows:
            tag = f"{r['tag']} · " if r.get("tag") and r["tag"] != "UNCHANGED" else ""
            act = f" → {r['owner']['name']}: {r['action']}" if r.get("owner") and r.get("action") else ""
            o.append(f"- {tag}{r['headline']}{act} *{cites(r['citations'])}*")
        o.append("")
    entries("Schedule (not in top 7)", sec["schedule_risks"]); entries("Cost (not in top 7)", sec["cost_risks"])
    entries("Procurement (not in top 7)", sec["procurement_issues"])
    for title, key in (("Overdue RFIs", "overdue_rfis"), ("Overdue submittals", "overdue_submittals")):
        if sec[key]:
            o += [f"#### {title}", "| Record | Days overdue | Ball in court | Note |", "|---|---|---|---|"]
            for r in sec[key]:
                note = f"Top item {r['linked_item_id'][1:]}" if r.get("linked_item_id") else r.get("priority_note", "")
                o.append(f"| {r['label']}: {r.get('title','')} | {r['days_overdue']} ({KIND.get(r['governing_date_kind'], r['governing_date_kind'])} {short(r['governing_date'])}) | {r.get('ball_in_court') or '-'} | {note} |")
            o.append("")
    if sec["new_decisions"] or sec["unresolved_decisions"]:
        o.append("#### Decisions")
        for x in sec["new_decisions"]: o.append(f"- **Made:** {x['summary']} *{cites(x['citations'])}*")
        for x in sec["unresolved_decisions"]:
            late = f", {x['days_late']} days late" if x.get("days_late") else ""
            carried = f", carried forward {x['carried_count']}x" if x.get("carried_count") else ""
            need = f" needed by {short(x['needed_by'])}" if x.get("needed_by") else ""
            cow = f" Cost of waiting: {x['cost_of_waiting']}." if x.get("cost_of_waiting") else ""
            o.append(f"- **Pending ({x['owner']['name']}{need}{late}{carried}):** {x['summary']}.{cow} *{cites(x['citations'])}*")
        o.append("")
    if sec["significant_emails"]:
        o.append("#### Significant email (project mailbox only)")
        for e in sec["significant_emails"]:
            t = dt.datetime.fromisoformat(e["received_at"])
            o.append(f"- {e['from']}, {t.strftime('%-I:%M %p')}: \"{e['subject']}\": {e['why_significant']}.")
        o.append("")
    o += ["#### Action items", "| # | Action | Owner | Due | Unblocks |", "|---|---|---|---|---|"]
    for a in sec["action_items"]:
        o.append(f"| {a['action_id']} | {a['text']} | {a['owner']['name']} | {short(a['due'])} | {', '.join(u.replace('T','Item ') if u.startswith('T') else u for u in a['unblocks'])} |")
    o.append("")
    if b.get("watching"): o.append("**Watching:** " + " · ".join(w["headline"] for w in b["watching"]) + "  ")
    if b["closed_since_last"]: o.append("**Closed since last brief:** " + " · ".join(c["label"] for c in b["closed_since_last"]) + "  ")
    if b["gaps"]: o.append("**Gaps:** " + " · ".join(f"{g['reason']}: {g['effect']}" for g in b["gaps"]) + "  ")
    v = b["metrics"]["verifier"]
    o.append(f"*Main body {b['metrics']['word_count_main']} words · {v['claims_total']} claims checked: {v['passed']} passed, {v['downgraded']} downgraded, {v['dropped']} dropped*")
    return "\n".join(o) + "\n"
if __name__ == "__main__":
    b = json.load(open(sys.argv[1])); md = render(b)
    if len(sys.argv) > 2: open(sys.argv[2], "w").write(md)
    else: print(md)
