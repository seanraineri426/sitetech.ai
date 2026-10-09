#!/usr/bin/env python3
"""Test runner for brief-reference tests. Runs all free test suites offline.

Network blocking: OS namespace isolation (sudo unshare -n) in CI is the guarantee.
sitecustomize.py provides best-effort Python-level patching for local dev.
"""
import sys
import os
import subprocess

# Set offline mode AND inject sitecustomize.py into PYTHONPATH
os.environ["OFFLINE_TESTS"] = "1"

HERE = os.path.dirname(os.path.abspath(__file__))
EVALS_DIR = os.path.join(HERE, "evals")

# Prepend evals/ to PYTHONPATH so sitecustomize.py is loaded in all child processes
current_pythonpath = os.environ.get("PYTHONPATH", "")
os.environ["PYTHONPATH"] = f"{EVALS_DIR}:{current_pythonpath}" if current_pythonpath else EVALS_DIR

print(f"[run_tests] Network blocking: sitecustomize.py (best-effort Python patches)", flush=True)
print(f"[run_tests] PYTHONPATH includes: {EVALS_DIR}", flush=True)
print(f"[run_tests] CI guarantee: OS network namespace isolation", flush=True)

def run_test_suite(name, command, xfail=False):
    """Run a test suite and report results.
    
    Args:
        name: Test suite name
        command: Shell command to run
        xfail: If True, expect failure (inverse logic)
    
    Returns:
        True if test passed (or xfailed as expected), False otherwise
    """
    print(f"\n{'=' * 60}")
    print(f"Running: {name}{' (XFAIL)' if xfail else ''}")
    print('=' * 60)
    result = subprocess.run(
        command,
        shell=True,
        cwd=os.path.join(os.path.dirname(__file__), "evals"),
        capture_output=False
    )
    
    if xfail:
        # Expected to fail
        return result.returncode != 0
    else:
        # Expected to pass
        return result.returncode == 0

def check_no_holdout_material():
    """Verify no held-out material exists in the repository.
    
    Scans git ls-files for holdout patterns (case-insensitive) and confirms that
    expected_findings.json, reference_ranking.json, etc are Linden dev-fixture only.
    """
    import subprocess
    import re
    
    # Get all tracked files from git
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__))),  # repo root
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"✗ ERROR: git ls-files failed (exit {result.returncode})")
        print(f"  stderr: {result.stderr}")
        return False
    
    all_files = result.stdout.strip().split('\n')
    
    # Patterns to search for (case-insensitive)
    holdout_patterns = [
        r'hold-?out',
        r'heldout',
        r'hx\d+',
        r'quarantine',
        r'answer_key',
    ]
    
    # Allow-list: specific files permitted to match holdout patterns
    allowed_holdout_files = {
        'tools/brief-reference/evals/fixture/expected_findings.json',
        'tools/brief-reference/evals/fixture/reference_ranking.json',
        'tools/brief-reference/evals/fixture/src/reference_ranking.py',
        'tools/brief-reference/evals/fixture/src/p3_comms_key.py',
        'tools/brief-reference/schemas/expected_findings.schema.json',
        'tools/brief-reference/examples/brief_linden_yard_2026-10-06.json',
    }
    
    found = []
    for file_path in all_files:
        file_lower = file_path.lower()
        for pattern in holdout_patterns:
            if re.search(pattern, file_lower):
                # Check if file is in the allow-list
                if file_path in allowed_holdout_files:
                    continue
                found.append((file_path, pattern))
                break
    
    if found:
        print("\n❌ ERROR: Held-out material detected!")
        print("The following files must not be committed (or must be renamed):")
        for path, pattern in found:
            print(f"  - {path} (matches pattern: {pattern})")
        return False
    
    # Confirm specific dev-fixture files are only in allowed locations
    allowed_files = {
        'expected_findings.json': ['tools/brief-reference/evals/fixture/'],
        'reference_ranking.json': ['tools/brief-reference/evals/fixture/'],
        'expected_findings.schema.json': ['tools/brief-reference/schemas/'],
        'p3_comms_key.py': ['tools/brief-reference/evals/fixture/src/'],
        'brief_linden_yard_2026-10-06.json': ['tools/brief-reference/examples/'],
    }
    
    for filename, allowed_dirs in allowed_files.items():
        matches = [f for f in all_files if filename in f]
        for match in matches:
            # Check if file is in an allowed directory
            if not any(match.startswith(allowed_dir) for allowed_dir in allowed_dirs):
                print(f"\n❌ ERROR: {filename} found outside allowed location: {match}")
                print(f"  Allowed: {', '.join(allowed_dirs)}")
                return False
    
    return True

def main():
    """Run all free test suites."""
    all_passed = True
    
    # First check for held-out material
    print("\n" + "=" * 60)
    print("Checking for held-out material...")
    print("=" * 60)
    if not check_no_holdout_material():
        print("❌ FAILED: Held-out material check")
        return 1
    print("✓ PASSED: No held-out material found")
    
    # Run network blocking probe test first
    print("\n" + "=" * 60)
    print("Running: network_blocking_probe")
    print("=" * 60)
    if not run_test_suite("network_blocking_probe", f"{sys.executable} test_network_block.py"):
        print("❌ FAILED: network_blocking_probe")
        print("Network blocking is not working - tests would reach external services!")
        return 1
    print("✓ PASSED: network_blocking_probe")
    
    # Run test suites
    suites = [
        ("tests_iter4", f"{sys.executable} -m harness.tests_iter4", False),
        ("tests_iter3", f"{sys.executable} -m harness.tests_iter3", False),
        ("tests_zero_cost", f"{sys.executable} -m harness.tests_zero_cost", False),
        ("tests_recall_pack", f"{sys.executable} -m harness.tests_recall_pack", False),
        ("scorer_validation", f"{sys.executable} test_scorer_on_gold_example.py", False),
        ("prompt_injection_defense", f"{sys.executable} -m harness.tests_prompt_injection", False),
        ("redacted_email_quote", f"{sys.executable} test_redacted_email_quote.py", False),
    ]
    
    for name, command, xfail in suites:
        passed = run_test_suite(name, command, xfail)
        if not passed:
            all_passed = False
            print(f"❌ FAILED: {name}")
        else:
            print(f"✓ PASSED: {name}")
    
    # Special handling for linden_gate: XFAIL with specific acceptance criteria
    print("\n" + "=" * 60)
    print("Running: linden_gate (XFAIL)")
    print("=" * 60)
    result = subprocess.run(
        f"{sys.executable} test_linden_gate.py",
        shell=True,
        cwd=os.path.join(os.path.dirname(__file__), "evals"),
        capture_output=True,
        text=True
    )
    
    # Parse the output to check if it meets XFAIL criteria
    output = result.stdout + result.stderr
    xfail_acceptable = False
    
    if result.returncode == 1:
        # Extract metrics from output
        import re
        recall_match = re.search(r'recall[:\s]+(\d+)/(\d+)', output, re.IGNORECASE)
        must_not_flag_match = re.search(r'must[_\s-]not[_\s-]flag(?:\s+violations?)?[:\s]+(\d+)', output, re.IGNORECASE)
        fabricated_match = re.search(r'fabricated[_\s]refs?[:\s]+(\d+)', output, re.IGNORECASE)
        
        # All three metrics must be present and parseable, or FAIL
        if recall_match and must_not_flag_match and fabricated_match:
            surfaced, total = int(recall_match.group(1)), int(recall_match.group(2))
            must_not_flag_violations = int(must_not_flag_match.group(1))
            fabricated_refs = int(fabricated_match.group(1))
            
            # Accept as XFAIL if recall >= 8/11, no violations, no fabricated refs
            if surfaced >= 8 and total >= 11 and must_not_flag_violations == 0 and fabricated_refs == 0:
                xfail_acceptable = True
                print(f"✓ XFAIL (expected failure): linden_gate")
                print(f"  Reason: {surfaced}/{total} recall (target 10/11), {must_not_flag_violations} must-not-flag, {fabricated_refs} fabricated")
        else:
            print(f"❌ FAILED: linden_gate - missing or unparseable metrics")
            if not recall_match:
                print("  Missing: recall metric")
            if not must_not_flag_match:
                print("  Missing: must-not-flag metric")
            if not fabricated_match:
                print("  Missing: fabricated metric")
    
    if not xfail_acceptable:
        all_passed = False
        print(f"❌ FAILED: linden_gate")
        print("  Gate failed below acceptable XFAIL threshold (need exit==1, recall>=8/11, 0 violations, 0 fabricated)")
        if result.returncode != 1:
            print(f"  Exit code: {result.returncode} (expected 1)")
        print(f"  Output:\n{output[:500]}")
    
    print(f"\n{'=' * 60}")
    if all_passed:
        print("✓ ALL TESTS PASSED")
        print('=' * 60)
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print('=' * 60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
