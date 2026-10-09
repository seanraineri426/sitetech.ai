#!/usr/bin/env python3
"""Test runner for brief-reference tests. Runs all free test suites offline."""
import sys
import os
import socket
import subprocess

# Network guard: block all socket connections
_original_socket = socket.socket

def _blocked_socket(*args, **kwargs):
    raise RuntimeError(
        "NETWORK ACCESS BLOCKED: Tests must run fully offline. "
        "If you see this error, a test is trying to make a network request."
    )

# Apply the network guard
socket.socket = _blocked_socket

# Set environment guard for provider checks
os.environ["OFFLINE_TESTS"] = "1"

def run_test_suite(name, command):
    """Run a test suite and report results."""
    print(f"\n{'=' * 60}")
    print(f"Running: {name}")
    print('=' * 60)
    result = subprocess.run(
        command,
        shell=True,
        cwd=os.path.join(os.path.dirname(__file__), "evals"),
        capture_output=False
    )
    return result.returncode == 0

def check_no_holdout_material():
    """Verify no held-out material exists in the repository."""
    import glob
    
    holdout_patterns = [
        "**/holdout/**",
        "**/hx[0-9]/**",
        "**/quarantine/**",
        "**/heldout/**"
    ]
    
    found = []
    for pattern in holdout_patterns:
        matches = glob.glob(pattern, recursive=True)
        found.extend(matches)
    
    if found:
        print("\n❌ ERROR: Held-out material detected!")
        print("The following files/directories must not be committed:")
        for path in found:
            print(f"  - {path}")
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
    
    # Run test suites
    suites = [
        ("tests_iter4", "python3 -m harness.tests_iter4"),
        ("tests_iter3", "python3 -m harness.tests_iter3"),
        ("tests_zero_cost", "python3 -m harness.tests_zero_cost"),
        ("tests_recall_pack", "python3 -m harness.tests_recall_pack"),
        ("scorer_validation", "python3 test_scorer_on_gold_example.py"),
        ("linden_gate", "python3 test_linden_gate.py"),
        ("prompt_injection_defense", "python3 -m harness.tests_prompt_injection"),
    ]
    
    for name, command in suites:
        if not run_test_suite(name, command):
            all_passed = False
            print(f"❌ FAILED: {name}")
        else:
            print(f"✓ PASSED: {name}")
    
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
