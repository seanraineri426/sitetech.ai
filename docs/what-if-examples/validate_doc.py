#!/usr/bin/env python3
"""
Validate that all activity IDs and dollar amounts in docs/what-if-math.md
match the reference fixture and expected.json.
Also validate that all N wd / N cd pairs in TC rows match expected.json.
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
    
    # Build TC map: tc_id -> (slip_wd, slip_cd, dollar)
    tc_map = {}
    for scenario in expected['scenarios']:
        if 'dollars' in scenario:
            valid_dollar_amounts.add(scenario['dollars']['dollar_impact'])
            valid_dollar_amounts.add(scenario['dollars']['daily_delay_cost_usd'])
        if 'completion' in scenario:
            tc_id = scenario['id']
            tc_map[tc_id] = {
                'slip_wd': scenario['completion']['slip_working_days'],
                'slip_cd': scenario['completion']['slip_calendar_days'],
                'dollar': scenario['dollars']['dollar_impact']
            }
    
    # Read the doc
    with open('../what-if-math.md') as f:
        doc = f.read()
    
    # Extract activity IDs (A\d{4})
    activity_ids = re.findall(r'\bA\d{4}\b', doc)
    
    # Extract dollar amounts ($X,XXX or $XXX,XXX)
    dollar_matches = re.findall(r'\$(\d{1,3}(?:,\d{3})+)', doc)
    dollar_amounts = [int(d.replace(',', '')) for d in dollar_matches]
    
    # Extract TC rows from markdown table
    # Pattern: | **TCN: ...** | ... | Completion slip: X wd = Y cd. $ = $Z |
    tc_rows = re.findall(
        r'\|\s*\*\*TC(\d+):[^|]+\|[^|]+\|\s*[^|]*Completion slip:\s*(\d+)\s*wd\s*=\s*(\d+)\s*cd\.\s*\$\s*=\s*\$([0-9,]+)',
        doc
    )
    
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
    
    # Check TC rows
    tc_mismatches = []
    for tc_num, wd_str, cd_str, dollar_str in tc_rows:
        tc_id = f'TC{tc_num}'
        wd = int(wd_str)
        cd = int(cd_str)
        dollar = int(dollar_str.replace(',', ''))
        
        if tc_id in tc_map:
            expected_vals = tc_map[tc_id]
            if (wd != expected_vals['slip_wd'] or 
                cd != expected_vals['slip_cd'] or 
                dollar != expected_vals['dollar']):
                tc_mismatches.append({
                    'tc_id': tc_id,
                    'found': f'{wd} wd = {cd} cd, ${dollar:,}',
                    'expected': f'{expected_vals["slip_wd"]} wd = {expected_vals["slip_cd"]} cd, ${expected_vals["dollar"]:,}'
                })
    
    # Report
    print(f"Found {len(set(activity_ids))} unique activity IDs in doc")
    print(f"Found {len(set(dollar_amounts))} unique dollar amounts in doc")
    print(f"Found {len(tc_rows)} TC rows with wd/cd/$ patterns")
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
    
    if tc_mismatches:
        print(f"❌ TC ROW MISMATCHES:")
        for m in tc_mismatches:
            print(f"   {m['tc_id']}: found {m['found']}, expected {m['expected']}")
        print()
    else:
        print(f"✓ All TC rows match expected.json")
        print()
    
    if invalid_ids or invalid_dollars or tc_mismatches:
        sys.exit(1)
    else:
        print("✓ All checks passed!")
        sys.exit(0)

if __name__ == '__main__':
    main()
