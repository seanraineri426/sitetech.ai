#!/usr/bin/env python3
"""Test runner for brief-reference tests. Runs all free test suites offline.

Network blocking is enforced via sitecustomize.py injected into PYTHONPATH,
which patches socket/urllib/subprocess in every child process.
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

print(f"[run_tests] Network blocking active via sitecustomize.py", flush=True)
print(f"[run_tests] PYTHONPATH includes: {EVALS_DIR}", flush=True)

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
    
    # Run network blocking probe test first
    print("\n" + "=" * 60)
    print("Running: network_blocking_probe")
    print("=" * 60)
    if not run_test_suite("network_blocking_probe", "python3 test_network_block.py"):
        print("❌ FAILED: network_blocking_probe")
        print("Network blocking is not working - tests would reach external services!")
        return 1
    print("✓ PASSED: network_blocking_probe")
    
    # Run test suites
    suites = [
        ("tests_iter4", "python3 -m harness.tests_iter4", False),
        ("tests_iter3", "python3 -m harness.tests_iter3", False),
        ("tests_zero_cost", "python3 -m harness.tests_zero_cost", False),
        ("tests_recall_pack", "python3 -m harness.tests_recall_pack", False),
        ("scorer_validation", "python3 test_scorer_on_gold_example.py", False),
        ("linden_gate", "python3 test_linden_gate.py", True),  # XFAIL: 8/11 recall, needs deterministic linking
        ("prompt_injection_defense", "python3 -m harness.tests_prompt_injection", False),
    ]
    
    for name, command, xfail in suites:
        passed = run_test_suite(name, command, xfail)
        if not passed:
            all_passed = False
            if xfail:
                print(f"❌ FAILED (expected to fail, but passed): {name}")
            else:
                print(f"❌ FAILED: {name}")
        else:
            if xfail:
                print(f"✓ XFAIL (expected failure): {name}")
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
