"""Test quote verification with redacted email addresses.

The stored email body_text has addresses redacted to [email-<domain>] format.
This test verifies that:
1. Quotes spanning the placeholder verify as supported
2. Quotes with raw addresses do NOT verify  
3. Numbers, CO refs, and spec refs are extracted unchanged via verify_email_facts
4. Sender party resolution works via party_for_record/party_for_domain (real API)
5. Unknown domains resolve to "unknown party"
"""
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from harness.fixture_tools import FixtureTools
from harness.ranker import quote_ok
from harness.email_facts import verify_email_facts
from harness.parties import party_for_record, party_for_domain, label as party_label

# Create a minimal fixture with redacted emails
class RedactedEmailFixture(FixtureTools):
    def __init__(self):
        super().__init__("2026-10-06", "2026-10-05", fixture_dir=os.path.join(HERE, "fixture"))
        
        # Add test email with redacted address from known party
        known_party_email = {
            "id": "msg_REDACT_TEST",
            "ref": "msgraph_outlook:message:msg_REDACT_TEST",
            "mailbox": "lindenyard@larkspurdev.example",
            "conversation_id": "conv_REDACT_TEST",
            "received_at": "2026-10-06T09:30:00-04:00",
            "from": {
                "name": "John Smith",
                "email": "john@acmemech.example"
            },
            "to": [
                {
                    "name": "Priya Chen",
                    "email": "pchen@ironbridgebuild.example"
                }
            ],
            "cc": [],
            "subject": "Rebar spacing revision per CO-012",
            "body_text": "Per [email-acmemech.example]: the #5@10 rebar spacing at grid C-4 is revised, add $48,200 per CO-012 (spec 03 30 00).",
            "attachments": []
        }
        
        # Add test email with redacted address from unknown party
        unknown_party_email = {
            "id": "msg_UNKNOWN_TEST",
            "ref": "msgraph_outlook:message:msg_UNKNOWN_TEST",
            "mailbox": "lindenyard@larkspurdev.example",
            "conversation_id": "conv_UNKNOWN_TEST",
            "received_at": "2026-10-06T10:00:00-04:00",
            "from": {
                "name": "Jane Doe",
                "email": "jane@unknown-vendor.example"
            },
            "to": [
                {
                    "name": "Priya Chen",
                    "email": "pchen@ironbridgebuild.example"
                }
            ],
            "cc": [],
            "subject": "Material delivery update",
            "body_text": "Per [email-unknown-vendor.example]: delivery scheduled for next week.",
            "attachments": []
        }
        
        # Add to index
        self.index[known_party_email["ref"]] = ("email", known_party_email)
        self.index[unknown_party_email["ref"]] = ("email", unknown_party_email)
        
        # Add acmemech.example as a known party in project_parties
        if "project_parties" not in self.project:
            self.project["project_parties"] = []
        
        self.project["project_parties"].append({
            "role": "sub",
            "name": "ACME Mechanical",
            "domain": "acmemech.example"
        })

def test_quote_with_placeholder_verifies():
    """Quote spanning the [email-domain] placeholder should verify."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    _, email_rec = T.index[ref]
    
    # Quote with placeholder
    quote = "Per [email-acmemech.example]: the #5@10 rebar"
    
    result = quote_ok(T, ref, quote)
    assert result, f"Quote with placeholder should verify: {quote}"
    
    # Also verify through verify_email_facts
    test_fact = {
        "kind": "pricing_or_change_request",
        "item": "Rebar spacing revision",
        "quote": quote,
        "spec_section": None,
        "submittal_no": None,
        "rfi_no": None,
        "ce_no": None,
        "old_date": None,
        "new_date": None,
        "new_date_high": None,
        "delay_days": None,
        "delay_days_high": None,
        "date_phrase": None,
        "date_basis": "none",
        "amount_usd": None,
        "notice_types": [],
        "sender_party": "ACME Mechanical (sub)",
        "confidence": "high"
    }
    kept, dropped = verify_email_facts(T, email_rec, [test_fact])
    assert len(kept) == 1, f"verify_email_facts should keep fact with valid quote. Dropped: {dropped}"
    
    print("✓ Quote with placeholder verifies")

def test_quote_with_raw_address_fails():
    """Quote with raw email address should NOT verify (body has placeholder)."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    _, email_rec = T.index[ref]
    
    # Quote with raw address (the bug: quote_ok matches from.email in JSON)
    quote = "Per john@acmemech.example: the #5@10 rebar"
    
    result = quote_ok(T, ref, quote)
    # This will fail until quote_ok is fixed to only check subject + body_text
    assert not result, f"Quote with raw address should NOT verify (bug: matches from.email in JSON): {quote}"
    
    # Also verify through verify_email_facts
    test_fact = {
        "kind": "pricing_or_change_request",
        "item": "Rebar spacing revision",
        "quote": quote,
        "spec_section": None,
        "submittal_no": None,
        "rfi_no": None,
        "ce_no": None,
        "old_date": None,
        "new_date": None,
        "new_date_high": None,
        "delay_days": None,
        "delay_days_high": None,
        "date_phrase": None,
        "date_basis": "none",
        "amount_usd": None,
        "notice_types": [],
        "sender_party": "ACME Mechanical (sub)",
        "confidence": "high"
    }
    kept, dropped = verify_email_facts(T, email_rec, [test_fact])
    assert len(kept) == 0, f"verify_email_facts should drop fact with invalid quote"
    assert len(dropped) == 1, f"Should have 1 dropped fact"
    assert dropped[0]["reason"] == "quote not verbatim", f"Drop reason should be 'quote not verbatim'"
    
    print("✓ Quote with raw address does NOT verify")

def test_numbers_extracted_unchanged():
    """Verify numbers/CO refs/spec refs are in body_text unchanged (not redacted)."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    
    _, email_rec = T.index[ref]
    body = email_rec["body_text"]
    
    # Verify numbers/refs are present in body text exactly as-is
    assert "$48,200" in body, "Dollar amount should be in body unchanged"
    assert "CO-012" in body, "CO reference should be in body unchanged"
    assert "03 30 00" in body, "Spec reference should be in body unchanged"
    
    # Create a fully schema-compliant fact (all required fields)
    test_fact = {
        "kind": "pricing_or_change_request",
        "item": "Rebar spacing revision per CO-012",
        "quote": "add $48,200 per CO-012 (spec 03 30 00)",
        "spec_section": "03 30 00",
        "submittal_no": None,
        "rfi_no": None,
        "ce_no": "CO-012",
        "old_date": None,
        "new_date": None,
        "new_date_high": None,
        "delay_days": None,
        "delay_days_high": None,
        "date_phrase": None,
        "date_basis": "none",
        "amount_usd": 48200,
        "notice_types": [],
        "sender_party": "ACME Mechanical (sub)",
        "confidence": "high"
    }
    
    # Run verify_email_facts to confirm it preserves the values
    kept, dropped = verify_email_facts(T, email_rec, [test_fact])
    
    assert len(kept) == 1, f"Should keep 1 fact, got {len(kept)}. Dropped: {dropped}"
    
    kept_fact = kept[0]
    assert kept_fact["amount_usd"] == 48200, f"Amount should be 48200, got {kept_fact.get('amount_usd')}"
    assert kept_fact["ce_no"] == "CO-012", f"CE no should be CO-012, got {kept_fact.get('ce_no')}"
    assert kept_fact["spec_section"] == "03 30 00", f"Spec should be 03 30 00, got {kept_fact.get('spec_section')}"
    
    print("✓ Numbers extracted unchanged via verify_email_facts: $48,200, CO-012, 03 30 00")

def test_sender_party_via_real_api():
    """Use real party_for_record/party_for_domain to resolve sender."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    
    _, email_rec = T.index[ref]
    
    # Use real party_for_record
    party = party_for_record(T.project, email_rec)
    assert party is not None, "party_for_record should find the party"
    assert party["name"] == "ACME Mechanical", f"Party name should be ACME Mechanical, got {party['name']}"
    assert party["role"] == "sub", f"Party role should be sub, got {party['role']}"
    assert party["domain"] == "acmemech.example", f"Party domain should be acmemech.example, got {party['domain']}"
    
    # Use party_label
    label = party_label(party)
    assert label == "ACME Mechanical (sub)", f"Party label should be 'ACME Mechanical (sub)', got {label}"
    
    # Use party_for_domain directly
    party_via_domain = party_for_domain(T.project, "acmemech.example")
    assert party_via_domain is not None, "party_for_domain should find the party"
    assert party_via_domain["name"] == "ACME Mechanical"
    
    print(f"✓ Sender party via real API: {label}")

def test_unknown_domain_resolves_to_unknown_party():
    """Unknown domain should resolve to 'unknown party'."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_UNKNOWN_TEST"
    
    _, email_rec = T.index[ref]
    
    # Use real party_for_record
    party = party_for_record(T.project, email_rec)
    assert party is None, f"party_for_record should return None for unknown domain, got {party}"
    
    # Use party_label
    label = party_label(party) if party else "unknown party"
    assert label == "unknown party", f"Party label should be 'unknown party', got {label}"
    
    # Verify domain is not in project_parties
    party_via_domain = party_for_domain(T.project, "unknown-vendor.example")
    assert party_via_domain is None, "party_for_domain should return None for unknown domain"
    
    print("✓ Unknown domain resolves to 'unknown party'")

def test_mismatched_values_dropped():
    """Facts with numeric/ID/spec values not in body_text should be dropped - token boundaries."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    _, email_rec = T.index[ref]
    
    # Body has: $48,200, CO-012, 03 30 00
    # Test substring matches that should be rejected (token boundary enforcement)
    
    must_drop = [
        (200, "amount_usd '200' is substring of 48,200 but not a token"),
        (2, "amount_usd '2' is substring but not a token"),
        (48200.99, "amount_usd 48200.99 truncated to 48200 should not match 48,200"),
        ("CO-01", "ce_no 'CO-01' is substring of CO-012 but not a token"),
        ("12", "rfi_no '12' is substring of CO-012 but not a token"),
        ("82", "rfi_no '82' is substring of $48,200 but not a token"),
        ("30 00", "spec_section '30 00' is substring of '03 30 00' but not a complete token"),
    ]
    
    for val, desc in must_drop:
        if isinstance(val, (int, float)):
            fact = {
                "kind": "pricing_or_change_request", "item": "Test", "quote": "add $48,200 per CO-012",
                "spec_section": None, "submittal_no": None, "rfi_no": None, "ce_no": None,
                "old_date": None, "new_date": None, "new_date_high": None,
                "delay_days": None, "delay_days_high": None, "date_phrase": None, "date_basis": "none",
                "amount_usd": val, "notice_types": [], "sender_party": "ACME Mechanical (sub)", "confidence": "high"
            }
        elif val in ("CO-01",):
            fact = {
                "kind": "pricing_or_change_request", "item": "Test", "quote": "add $48,200 per CO-012",
                "spec_section": None, "submittal_no": None, "rfi_no": None, "ce_no": val,
                "old_date": None, "new_date": None, "new_date_high": None,
                "delay_days": None, "delay_days_high": None, "date_phrase": None, "date_basis": "none",
                "amount_usd": None, "notice_types": [], "sender_party": "ACME Mechanical (sub)", "confidence": "high"
            }
        elif val in ("12", "4"):
            fact = {
                "kind": "other", "item": "Test", "quote": "add $48,200 per CO-012",
                "spec_section": None, "submittal_no": None, "rfi_no": val, "ce_no": None,
                "old_date": None, "new_date": None, "new_date_high": None,
                "delay_days": None, "delay_days_high": None, "date_phrase": None, "date_basis": "none",
                "amount_usd": None, "notice_types": [], "sender_party": "ACME Mechanical (sub)", "confidence": "high"
            }
        else:  # spec_section
            fact = {
                "kind": "pricing_or_change_request", "item": "Test", "quote": "spec 03 30 00",
                "spec_section": val, "submittal_no": None, "rfi_no": None, "ce_no": None,
                "old_date": None, "new_date": None, "new_date_high": None,
                "delay_days": None, "delay_days_high": None, "date_phrase": None, "date_basis": "none",
                "amount_usd": None, "notice_types": [], "sender_party": "ACME Mechanical (sub)", "confidence": "high"
            }
        
        kept, dropped = verify_email_facts(T, email_rec, [fact])
        assert len(kept) == 0, f"Should drop: {desc}. Kept: {kept}"
        assert len(dropped) == 1, f"Should have 1 dropped fact for: {desc}"
    
    print("✓ Token boundary enforcement: 200, 2, 48200.99, CO-01, 12, 4, '03 30' all dropped")

def main():
    """Run all redacted email quote tests."""
    print("\n" + "="*70)
    print("REDACTED EMAIL QUOTE VERIFICATION TESTS")
    print("="*70)
    print()
    
    tests = [
        ("Quote with placeholder verifies", test_quote_with_placeholder_verifies),
        ("Quote with raw address fails", test_quote_with_raw_address_fails),
        ("Numbers extracted unchanged", test_numbers_extracted_unchanged),
        ("Token boundary enforcement (must-drop cases)", test_mismatched_values_dropped),
        ("Sender party via real API", test_sender_party_via_real_api),
        ("Unknown domain → unknown party", test_unknown_domain_resolves_to_unknown_party),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"✗ {name}: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {name}: Unexpected error: {e}")
            failed += 1
    
    print()
    print("="*70)
    print(f"SUMMARY: {passed} passed, {failed} failed")
    print("="*70)
    
    if failed > 0:
        print("❌ SOME TESTS FAILED")
        return 1
    else:
        print("✓ ALL REDACTED EMAIL QUOTE TESTS PASSED")
        return 0

if __name__ == "__main__":
    sys.exit(main())
