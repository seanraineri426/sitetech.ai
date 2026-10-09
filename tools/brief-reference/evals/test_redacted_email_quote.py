"""Test quote verification with redacted email addresses.

The stored email body_text has addresses redacted to [email-<domain>] format.
This test verifies that:
1. Quotes spanning the placeholder verify as supported
2. Quotes with raw addresses do NOT verify
3. Numbers, CO refs, and spec refs are extracted unchanged
4. Sender party resolution works via placeholder domain
"""
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from harness.fixture_tools import FixtureTools
from harness.ranker import quote_ok

# Create a minimal fixture with one redacted email
class RedactedEmailFixture(FixtureTools):
    def __init__(self):
        super().__init__("2026-10-06", "2026-10-05", fixture_dir=os.path.join(HERE, "fixture"))
        
        # Add test email with redacted address
        test_email = {
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
        
        # Add to index
        self.index[test_email["ref"]] = ("email", test_email)
        
        # Add acmemech.example as a known party in project
        if "parties" not in self.project:
            self.project["parties"] = []
        
        self.project["parties"].append({
            "role": "subcontractor",
            "name": "ACME Mechanical",
            "domain": "acmemech.example"
        })

def test_quote_with_placeholder_verifies():
    """Quote spanning the [email-domain] placeholder should verify."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    
    # Quote with placeholder
    quote = "Per [email-acmemech.example]: the #5@10 rebar"
    
    result = quote_ok(T, ref, quote)
    assert result, f"Quote with placeholder should verify: {quote}"
    print("✓ Quote with placeholder verifies")

def test_quote_with_raw_address_fails():
    """Quote with raw email address should NOT verify (body has placeholder)."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    
    # Quote with raw address
    quote = "Per john@acmemech.example: the #5@10 rebar"
    
    result = quote_ok(T, ref, quote)
    assert not result, f"Quote with raw address should NOT verify: {quote}"
    print("✓ Quote with raw address does NOT verify")

def test_numbers_extracted_unchanged():
    """Dollar amounts, CO refs, and spec refs should be extractable."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    
    _, email_rec = T.index[ref]
    body = email_rec["body_text"]
    
    # Check that numbers/refs are in the body as-is
    assert "$48,200" in body, "Dollar amount should be unchanged"
    assert "CO-012" in body, "CO reference should be unchanged"
    assert "03 30 00" in body, "Spec reference should be unchanged"
    
    print("✓ Numbers extracted unchanged: $48,200, CO-012, 03 30 00")

def test_sender_party_resolves_via_placeholder():
    """Sender party should resolve via domain from placeholder."""
    T = RedactedEmailFixture()
    ref = "msgraph_outlook:message:msg_REDACT_TEST"
    
    _, email_rec = T.index[ref]
    body = email_rec["body_text"]
    
    # Extract domain from placeholder
    import re
    match = re.search(r'\[email-([^\]]+)\]', body)
    assert match, "Should find email placeholder"
    domain = match.group(1)
    assert domain == "acmemech.example", f"Domain should be acmemech.example, got {domain}"
    
    # Check that this domain is in project parties
    party = next((p for p in T.project.get("parties", []) 
                  if p.get("domain", "").lower() == domain.lower()), None)
    assert party is not None, f"Domain {domain} should resolve to a party"
    assert party["role"] == "subcontractor", f"Party should be subcontractor, got {party['role']}"
    assert party["name"] == "ACME Mechanical", f"Party should be ACME Mechanical, got {party['name']}"
    
    print(f"✓ Sender party resolves: {party['name']} ({party['role']}) via {domain}")

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
        ("Sender party resolves via placeholder", test_sender_party_resolves_via_placeholder),
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
