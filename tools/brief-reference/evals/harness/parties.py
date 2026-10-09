"""project_parties: domain → Company (role). Models never see raw email addresses (CTO, 2026-10-06).
Roles: owner | architect_engineer | gc | sub. Unknown domain → unknown party. Notice from an unknown party → deadline unknown.

Sender authentication (CTO-approved): emails must pass SPF/DKIM/DMARC checks (sender_auth.verdict == 'pass') to be verified.
auth_mode: 'warn' (default, treat missing as verified but run interim check) | 'enforce' (fail/unknown/missing = unverified).
Interim check: party-domain email with display name not matching known contacts → can't suppress findings."""
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

def check_sender_auth(rec, project):
    """Check sender authentication. Returns (is_verified, warning_message).
    
    Authentication logic:
    - If sender_auth.verdict == 'pass': verified
    - If sender_auth.verdict == 'fail' or 'unknown': unverified
    - If sender_auth missing: depends on auth_mode
      - 'warn' (default): treat as verified, but run interim check (display name matching)
      - 'enforce': treat as unverified
    
    Interim check (warn mode only): display name must match known contacts for the party.
    """
    auth_mode = project.get("auth_mode", "warn")  # 'warn' | 'enforce'
    sender_auth = rec.get("sender_auth")
    
    # Check verdict
    if sender_auth:
        verdict = sender_auth.get("verdict")
        if verdict == "pass":
            return True, None
        elif verdict in ("fail", "unknown"):
            return False, f"sender_auth verdict: {verdict}"
    
    # Missing sender_auth field
    if auth_mode == "enforce":
        return False, "sender_auth missing (enforce mode)"
    
    # Warn mode: treat as verified but run interim check
    # Interim check: display name must match known contacts
    fr = rec.get("from")
    if not isinstance(fr, dict):
        return True, None  # String format, can't check display name
    
    display_name = (fr.get("name") or "").strip()
    if not display_name:
        return True, None
    
    # Get party for this domain
    email_addr = fr.get("email", "")
    party = party_for_email_addr(project, email_addr)
    if not party:
        return True, None  # Unknown domain, no interim check needed
    
    # Check if display name matches known contacts for this party
    # Interim check: flag if display name contains DIFFERENT company name
    company_name = party.get("name", "").lower()
    display_lower = display_name.lower()
    
    # Extract words from display name, removing punctuation
    import string
    display_clean = display_lower.translate(str.maketrans('', '', string.punctuation))
    display_words = set(display_clean.split())
    company_clean = company_name.translate(str.maketrans('', '', string.punctuation))
    company_words = set(company_clean.split()) - {'fictional', 'inc', 'llc', 'ltd', 'corporation', 'corp'}
    
    # Check if display name mentions a DIFFERENT company name (major red flag)
    # Common company suffixes that indicate it's mentioning another company
    other_company_indicators = {'steel', 'construction', 'mechanical', 'electric', 'plumbing', 'hvac', 
                                 'framing', 'concrete', 'masonry', 'roofing', 'contractors', 'builders',
                                 'engineering', 'architects', 'development', 'group', 'company', 'associates'}
    
    # If display name has company indicators but doesn't match the actual party company
    has_company_indicator = bool(display_words & other_company_indicators)
    has_company_match = bool(display_words & company_words)
    
    if has_company_indicator and not has_company_match:
        # Display name mentions a company, but it's not THIS company - likely spoof
        return False, "display name mismatch, confirm sender"
    
    return True, None

def party_for_record(project, rec, check_auth=True, allow_suppress=False):
    """Get party for a record, optionally checking sender authentication.
    
    Args:
        project: Project dict with parties and auth_mode
        rec: Email/record dict
        check_auth: If True, apply sender authentication checks
        allow_suppress: If True, this email can suppress findings (requires auth check to pass)
    
    Returns:
        Party dict if verified, None otherwise
    """
    fr = rec.get("from")
    if isinstance(fr, dict):
        party = party_for_email_addr(project, fr.get("email") or "")
    elif isinstance(fr, str):
        party = party_for_email_addr(project, fr)
    else:
        return None
    
    if not party:
        return None
    
    # Apply sender authentication checks
    if check_auth:
        is_verified, warning = check_sender_auth(rec, project)
        if not is_verified:
            # Store warning for potential unverified_senders tracking
            if not hasattr(rec, '_auth_warning'):
                rec['_auth_warning'] = warning
            return None
        
        # If this email needs to suppress findings, it must pass full verification
        if allow_suppress and warning:
            rec['_auth_warning'] = warning
            return None
    
    return party

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
