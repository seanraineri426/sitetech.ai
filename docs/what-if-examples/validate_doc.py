#!/usr/bin/env python3
"""
Validate that all activity IDs and dollar amounts in docs/what-if-math.md
match the reference fixture and expected.json.
"""
import json
import re
import sys

def main():
    # Load fixture and expected
    with open('fixture.json') as f:
        fixture = json.load(f)
    with open('expected.json') as f:
        expected = json.load(f)
    
    # Build valid sets
    valid_activity_ids = set(a['id'] for a in fixture['activities'])
    valid_dollar_amounts = set()
    for scenario in expected['scenarios']:
        if 'dollars' in scenario:
            valid_dollar_amounts.add(scenario['dollars']['dollar_impact'])
            valid_dollar_amounts.add(scenario['dollars']['daily_delay_cost_usd'])
    
    # Read the doc
    with open('../what-if-math.md') as f:
        doc = f.read()
    
    # Extract activity IDs (A\d{4})
    activity_ids = re.findall(r'\bA\d{4}\b', doc)
    
    # Extract dollar amounts ($X,XXX or $XXX,XXX)
    dollar_matches = re.findall(r'\$(\d{1,3}(?:,\d{3})+)', doc)
    dollar_amounts = [int(d.replace(',', '')) for d in dollar_matches]
    
    # Check activity IDs
    invalid_ids = []
    for aid in set(activity_ids):
        if aid not in valid_activity_ids:
            invalid_ids.append(aid)
    
    # Check dollar amounts
    invalid_dollars = []
    for amt in set(dollar_amounts):
        if amt not in valid_dollar_amounts:
            invalid_dollars.append(amt)
    
    # Report
    print(f"Found {len(set(activity_ids))} unique activity IDs in doc")
    print(f"Found {len(set(dollar_amounts))} unique dollar amounts in doc")
    print()
    
    if invalid_ids:
        print(f"❌ INVALID ACTIVITY IDs (not in fixture.json):")
        for aid in sorted(invalid_ids):
            count = activity_ids.count(aid)
            print(f"   {aid} (appears {count} times)")
        print()
    else:
        print("✓ All activity IDs are valid")
        print()
    
    if invalid_dollars:
        print(f"❌ INVALID DOLLAR AMOUNTS (not in expected.json):")
        for amt in sorted(invalid_dollars):
            count = dollar_amounts.count(amt)
            print(f"   ${amt:,} (appears {count} times)")
        print()
    else:
        print("✓ All dollar amounts are valid")
        print()
    
    if invalid_ids or invalid_dollars:
        sys.exit(1)
    else:
        print("✓ All checks passed!")
        sys.exit(0)

if __name__ == '__main__':
    main()
