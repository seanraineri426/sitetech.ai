"""project_parties: domain → Company (role). Models never see raw email addresses (CTO, 2026-10-06).
Roles: owner | architect_engineer | gc | sub. Unknown domain → unknown party. Notice from an unknown party → deadline unknown."""
import re

ROLES = ("owner", "architect_engineer", "gc", "sub")
ROLE_MAP = [
    (re.compile(r"owner|developer|landlord", re.I), "owner"),
    (re.compile(r"architect|engineer|eor|design\s*consultant|consultant of record", re.I), "architect_engineer"),
    (re.compile(r"general\s*contractor|^gc\b", re.I), "gc"),
    (re.compile(r"sub(?:contractor)?|fabricat|supplier|install|vendor|trade|distributor", re.I), "sub"),
]

def _role(company):
    r = (company or {}).get("role") or ""
    if r in ROLES: return r
    for rx, name in ROLE_MAP:
        if rx.search(r): return name
    return None

def parties_of(project):
    """Prefer project['project_parties']; else derive from companies with a mappable role."""
    rows = project.get("project_parties")
    if rows is not None: return list(rows)
    out = []
    for c in project.get("companies") or []:
        role = _role(c)
        if not role or not c.get("domain"): continue
        out.append({"name": c["name"], "role": role, "domain": c["domain"].lower(), "company_id": c.get("id")})
    return out

def party_for_domain(project, domain):
    dom = (domain or "").lower()
    if not dom: return None
    for p in parties_of(project):
        if (p.get("domain") or "").lower() == dom: return p
    return None

def party_for_email_addr(project, email):
    m = re.search(r"@([A-Za-z0-9.\-]+)", email or "")
    return party_for_domain(project, m.group(1) if m else "")

def party_for_record(project, rec):
    fr = rec.get("from")
    if isinstance(fr, dict): return party_for_email_addr(project, fr.get("email") or "")
    if isinstance(fr, str): return party_for_email_addr(project, fr)
    return None

def label(party):
    if not party: return "unknown party"
    return f'{party["name"]} ({party["role"]})'

def display_from(project, rec):
    """Model-facing From: never the raw address. 'Company (role)' or 'Name · Company (role)'."""
    fr = rec.get("from")
    name = fr.get("name") if isinstance(fr, dict) else (fr.split(" <")[0] if isinstance(fr, str) and " <" in fr else None)
    p = party_for_record(project, rec)
    if p: return f"{name} · {label(p)}" if name and name.lower() not in (p["name"] or "").lower() else label(p)
    return f"{name} · unknown party" if name else "unknown party"
