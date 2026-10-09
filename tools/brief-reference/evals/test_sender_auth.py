"""Tests for sender authentication (sender_auth field and display name checking)."""
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from harness.fixture_tools import FixtureTools
from harness.fact_rules import email_slip_rules, _received_later
from harness.stages.rank import delivery_complete_for
from harness.rules_engine import DayView
from harness.parties import party_for_record, check_sender_auth

def test_auth_fail_cant_suppress():
    """Auth fail from owner domain can't suppress steel slip."""
    T = FixtureTools("2026-10-06", "2026-10-05", fixture_dir=os.path.join(HERE, "fixture"))
    V = DayView(T, T.as_of)
    
    # Create a slip email from genuine owner
    slip_email = {
        "id": "msg_SLIP_AUTH",
        "ref": "msgraph_outlook:message:msg_SLIP_AUTH",
        "mailbox": T.project["project_mailbox"],
        "conversation_id": "conv_AUTH_TEST",
        "received_at": "2026-10-05T10:00:00-04:00",
        "from": {"name": "Dana Whitfield", "email": "dwhitfield@larkspurdev.example"},
        "to": [{"name": "Priya", "email": "pnair@ironbridgebuild.example"}],
        "subject": "Steel delay",
        "body_text": "Structural steel delivery delayed to 11/23.",
        "sender_auth": {"verdict": "pass", "spf": "pass", "dkim": "pass", "dmarc": "pass"}
    }
    
    # Create a suppression email from owner domain but with auth fail
    suppress_email = {
        "id": "msg_SUPPRESS_FAIL",
        "ref": "msgraph_outlook:message:msg_SUPPRESS_FAIL",
        "mailbox": T.project["project_mailbox"],
        "conversation_id": "conv_AUTH_TEST",
        "received_at": "2026-10-06T10:00:00-04:00",
        "from": {"name": "Dana Whitfield", "email": "dwhitfield@larkspurdev.example"},
        "to": [{"name": "Priya", "email": "pnair@ironbridgebuild.example"}],
        "subject": "Re: Steel delay",
        "body_text": "Steel received on site this morning.",
        "sender_auth": {"verdict": "fail", "spf": "fail", "dkim": "pass", "dmarc": "fail"}
    }
    
    # Check that auth fail email is NOT recognized as project party for suppression
    party_check = party_for_record(T.project, suppress_email, check_auth=True, allow_suppress=True)
    assert party_check is None, f"Auth fail email should not be recognized as party for suppression, got {party_check}"
    
    # Check that genuine email IS recognized
    party_genuine = party_for_record(T.project, slip_email, check_auth=True, allow_suppress=True)
    assert party_genuine is not None, "Genuine email with auth pass should be recognized"
    
    print("✓ Auth fail from owner domain can't suppress findings")
    return True

def test_display_name_mismatch_cant_suppress():
    """Exact-owner-domain spoof with mismatched display name can't suppress."""
    T = FixtureTools("2026-10-06", "2026-10-05", fixture_dir=os.path.join(HERE, "fixture"))
    
    # Email from exact owner domain but with spoofed display name (Bayline Steel employee)
    spoof_email = {
        "id": "msg_SPOOF",
        "ref": "msgraph_outlook:message:msg_SPOOF",
        "mailbox": T.project["project_mailbox"],
        "conversation_id": "conv_SPOOF_TEST",
        "received_at": "2026-10-06T10:00:00-04:00",
        "from": {"name": "Gus Moreno (Bayline Steel)", "email": "gus.moreno@larkspurdev.example"},
        "to": [{"name": "Priya", "email": "pnair@ironbridgebuild.example"}],
        "subject": "Steel received",
        "body_text": "Steel received on site this morning."
        # No sender_auth field = warn mode (interim check applies)
    }
    
    # In warn mode (default), missing sender_auth runs interim check
    # Display name "Gus Moreno (Bayline Steel)" doesn't match Larkspur Development Partners
    is_verified, warning = check_sender_auth(spoof_email, T.project)
    assert not is_verified or warning, f"Spoofed display name should trigger warning: verified={is_verified}, warning={warning}"
    
    # Check that it can't suppress findings
    party_spoof = party_for_record(T.project, spoof_email, check_auth=True, allow_suppress=True)
    assert party_spoof is None, f"Spoof email should not be able to suppress findings, got {party_spoof}"
    
    print("✓ Exact-owner-domain spoof with mismatched display name can't suppress")
    return True

def test_genuine_owner_with_pass_works():
    """Genuine owner email with verdict pass still works."""
    T = FixtureTools("2026-10-06", "2026-10-05", fixture_dir=os.path.join(HERE, "fixture"))
    
    genuine_email = {
        "id": "msg_GENUINE",
        "ref": "msgraph_outlook:message:msg_GENUINE",
        "mailbox": T.project["project_mailbox"],
        "conversation_id": "conv_GENUINE",
        "received_at": "2026-10-06T10:00:00-04:00",
        "from": {"name": "Dana Whitfield", "email": "dwhitfield@larkspurdev.example"},
        "to": [{"name": "Priya", "email": "pnair@ironbridgebuild.example"}],
        "subject": "Status update",
        "body_text": "Material received on site.",
        "sender_auth": {"verdict": "pass", "spf": "pass", "dkim": "pass", "dmarc": "pass"}
    }
    
    # Should be verified
    is_verified, warning = check_sender_auth(genuine_email, T.project)
    assert is_verified and not warning, f"Genuine email with pass should be fully verified: verified={is_verified}, warning={warning}"
    
    # Should be recognized as party
    party = party_for_record(T.project, genuine_email, check_auth=True, allow_suppress=True)
    assert party is not None, "Genuine email should be recognized as project party"
    assert party.get("role") == "owner", f"Should be recognized as owner, got {party.get('role')}"
    
    print("✓ Genuine owner email with verdict pass works correctly")
    return True

def test_enforce_mode():
    """In enforce mode, missing sender_auth field blocks verification."""
    T = FixtureTools("2026-10-06", "2026-10-05", fixture_dir=os.path.join(HERE, "fixture"))
    T.project["auth_mode"] = "enforce"
    
    email_no_auth = {
        "id": "msg_NO_AUTH",
        "ref": "msgraph_outlook:message:msg_NO_AUTH",
        "from": {"name": "Dana Whitfield", "email": "dwhitfield@larkspurdev.example"},
        "subject": "Test",
        "body_text": "Test"
        # No sender_auth field
    }
    
    is_verified, warning = check_sender_auth(email_no_auth, T.project)
    assert not is_verified, f"Enforce mode should block missing sender_auth: verified={is_verified}"
    assert "enforce mode" in warning.lower(), f"Warning should mention enforce mode: {warning}"
    
    party = party_for_record(T.project, email_no_auth, check_auth=True)
    assert party is None, "Enforce mode should block party recognition without auth"
    
    print("✓ Enforce mode blocks missing sender_auth")
    return True

def test_warn_mode_default():
    """Warn mode (default) treats missing sender_auth as verified but runs interim check."""
    T = FixtureTools("2026-10-06", "2026-10-05", fixture_dir=os.path.join(HERE, "fixture"))
    # auth_mode defaults to "warn"
    
    # Legitimate-looking email without sender_auth
    email_legit = {
        "id": "msg_LEGIT_NO_AUTH",
        "ref": "msgraph_outlook:message:msg_LEGIT_NO_AUTH",
        "from": {"name": "Dana", "email": "dwhitfield@larkspurdev.example"},
        "subject": "Test",
        "body_text": "Test"
        # No sender_auth field, but display name is reasonable
    }
    
    is_verified, warning = check_sender_auth(email_legit, T.project)
    # Should be verified (warn mode) and pass interim check (simple name)
    assert is_verified, f"Warn mode should allow missing auth: verified={is_verified}"
    
    party = party_for_record(T.project, email_legit, check_auth=True)
    assert party is not None, "Warn mode should recognize party with reasonable display name"
    
    print("✓ Warn mode (default) allows missing sender_auth with interim check")
    return True

if __name__ == "__main__":
    tests = [
        ("Auth fail can't suppress", test_auth_fail_cant_suppress),
        ("Display name mismatch can't suppress", test_display_name_mismatch_cant_suppress),
        ("Genuine owner with pass works", test_genuine_owner_with_pass_works),
        ("Enforce mode blocks missing auth", test_enforce_mode),
        ("Warn mode is default", test_warn_mode_default),
    ]
    
    print("\n" + "="*70)
    print("SENDER AUTHENTICATION TESTS")
    print("="*70 + "\n")
    
    passed = 0
    failed = 0
    for name, test_fn in tests:
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            print(f"✗ {name}: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {name}: {type(e).__name__}: {e}")
            failed += 1
    
    print("\n" + "="*70)
    print(f"SUMMARY: {passed} passed, {failed} failed")
    print("="*70)
    
    if failed > 0:
        print("❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("✓ ALL SENDER AUTH TESTS PASSED")
        sys.exit(0)
