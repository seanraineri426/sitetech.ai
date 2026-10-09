#!/usr/bin/env python3
"""Linden Gate: End-to-end test using the hand-built example brief as the gold standard.

This validates that the scorer and verifier work correctly on a complete brief.
The example brief was hand-built to the spec and represents perfect output (11/11 recall, 0 false alarms, 0 fabricated refs).

This is NOT a full pipeline test (that requires paid model calls and config.yaml with API keys).
This validates the scoring and verification logic against known-good output.
"""
import json, os, sys, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
EXAMPLE_BRIEF = os.path.join(HERE, "..", "examples", "brief_linden_yard_2026-10-06.json")
FIXTURE = os.path.join(HERE, "fixture")

def main():
    print("=" * 70)
    print("Scorer Validation: Testing scorer on gold-standard brief")
    print("=" * 70)
    print()
    
    # Run the scorer on the example brief
    print("Running score_brief.py on the hand-built Linden Yard example...")
    print(f"  Brief: {EXAMPLE_BRIEF}")
    print(f"  Fixture: {FIXTURE}")
    print()
    
    result = subprocess.run(
        [sys.executable, os.path.join(HERE, "score_brief.py"), EXAMPLE_BRIEF, "--fixture", FIXTURE],
        capture_output=True,
        text=True
    )
    
    # Print the output
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    
    # Check the result
    if "11/11" in result.stdout and "0 must-not-flag" in result.stdout.lower() or "must_not_flag_violations\": 0" in result.stdout:
        if "fabricated_refs\": 0" in result.stdout or "0 fabricated" in result.stdout:
            print()
            print("=" * 70)
            print("✓ SCORER VALIDATION PASSED")
            print("  - Scorer correctly identifies 11/11 findings")
            print("  - 0 must-not-flag violations detected")
            print("  - 0 fabricated refs detected")
            print("=" * 70)
            return 0
    
    print()
    print("=" * 70)
    print("❌ SCORER VALIDATION FAILED")
    print("=" * 70)
    return 1

if __name__ == "__main__":
    sys.exit(main())
