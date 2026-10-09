"""Unverified sender tracking: unknown-sender emails that would have fired rules.
PM-approved feature: list unknown-sender claims with hypothetical impacts, allowing manual party addition."""
import re
from .calendar_util import d_
from .parties import party_for_record

def edit_distance(s1, s2):
    """Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]

def similar_party(domain, project_parties, threshold=2):
    """Find party with domain within edit distance threshold. Returns (party, distance) or (None, None)."""
    best_party, best_dist = None, float('inf')
    for p in project_parties or []:
        party_domain = p.get("domain", "")
        if not party_domain:
            continue
        dist = edit_distance(domain.lower(), party_domain.lower())
        if dist <= threshold and dist < best_dist:
            best_party, best_dist = p, dist
    return (best_party, best_dist) if best_dist <= threshold else (None, None)

def extract_domain(email_addr):
    """Extract domain from email address."""
    if not email_addr:
        return None
    if isinstance(email_addr, dict):
        email_addr = email_addr.get("email", "")
    match = re.search(r'@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:>|$)', str(email_addr))
    if match:
        return match.group(1).lower()
    parts = str(email_addr).split('@')
    if len(parts) == 2:
        return parts[1].split('>')[0].strip().lower()
    return None

def extract_company_name(from_field):
    """Extract suggested company name from display name in From field."""
    if isinstance(from_field, dict):
        return from_field.get("name", "").split("<")[0].strip()
    return str(from_field).split("<")[0].strip()

def is_forwarded_with_statement(email):
    """Check if email is forwarded by a project party with their own statement.
    Returns (is_forwarded_with_statement, forwarder_party) or (False, None)."""
    # This is a simplified check - in production, would analyze email structure more carefully
    # For now, we'll just return False, None
    # TODO: Implement forwarded email detection
    return False, None

def track_unverified_email_finding(T, V, email, finding_type, claim_text, hypothetical_impact, metadata=None):
    """Track an unknown-sender email that would have fired a rule.
    
    Args:
        T: FixtureTools instance
        V: DayView instance
        email: The email record
        finding_type: Type of finding (e.g. 'schedule_slip', 'on_site_receipt', 'notice', 'owner_directive', 'rfi_link', 'submittal_link')
        claim_text: Human-readable claim description
        hypothetical_impact: Dict with computed impact (e.g. {'slip_cd': 12, 'exposure_usd': 96000})
        metadata: Additional metadata dict
    
    Returns:
        Unverified sender row dict
    """
    from_field = email.get("from", "")
    domain = extract_domain(from_field)
    company = extract_company_name(from_field)
    
    # Check if domain is similar to a known party
    similar, distance = similar_party(domain, T.project.get("project_parties", []))
    
    # Check if it's a formal notice
    is_notice = finding_type == "notice"
    
    row = {
        "email_ref": email.get("ref"),
        "received_at": email.get("received_at"),
        "from": from_field,
        "domain": domain,
        "suggested_company": company,
        "finding_type": finding_type,
        "claim_text": claim_text,
        "hypothetical_impact": hypothetical_impact or {},
        "label": "UNVERIFIED",
        "counts_toward_totals": False,
        **(metadata or {})
    }
    
    if similar:
        row["similar_party"] = similar.get("name")
        row["similar_party_domain"] = similar.get("domain")
        row["domain_edit_distance"] = distance
        row["warning"] = f"Looks like {similar.get('name')}. Check the domain"
        row["add_party_allowed"] = False
    else:
        row["add_party_allowed"] = True
        row["role_options"] = ["owner", "architect_engineer", "gc", "sub"]
    
    if is_notice:
        row["escalate_to_px_same_day"] = True
        row["deadline"] = "unknown"
    
    return row

def collect_unverified_findings(T, V):
    """Collect all unverified findings from unknown senders that would have fired rules.
    
    Returns list of unverified sender rows.
    """
    unverified = []
    
    # Check each email
    for email in V.emails:
        party = party_for_record(T.project, email)
        if party:
            continue  # Skip verified senders
        
        # Check if forwarded with statement
        is_fwd, fwd_party = is_forwarded_with_statement(email)
        if is_fwd and fwd_party:
            continue  # Treat forwarder as sender
        
        # Check if this email would have fired any rules
        # We'll integrate this with the actual rule functions
        # For now, create placeholder structure
        pass
    
    return unverified
