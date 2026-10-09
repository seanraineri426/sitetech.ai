#!/usr/bin/env python3
"""
Compute script for SiteTech what-if examples.
Reproduces all worked examples and test case numbers from the spec.
"""

import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional

def load_fixture():
    with open('fixture.json', 'r') as f:
        return json.load(f)

def is_working_day(date: datetime, calendar: Dict, holidays: List[str]) -> bool:
    """Check if date is a working day per P6 calendar."""
    if date.strftime('%Y-%m-%d') in holidays:
        return False
    # weekday(): Monday=0, Sunday=6; P6 work_days: Monday=1, Sunday=7
    weekday_p6 = (date.weekday() + 1) % 7
    if weekday_p6 == 0:
        weekday_p6 = 7
    return weekday_p6 in calendar['work_days']

def add_working_days(start_date: datetime, days: int, calendar: Dict, holidays: List[str]) -> datetime:
    """Add working days to a date per P6 calendar."""
    current = start_date
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if is_working_day(current, calendar, holidays):
            remaining -= 1
    return current

def add_business_days(start_date: datetime, days: int, holidays: List[str]) -> datetime:
    """Add business days (Mon-Fri, skip holidays)."""
    current = start_date
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        # Monday=0, Friday=4
        if current.weekday() < 5 and current.strftime('%Y-%m-%d') not in holidays:
            remaining -= 1
    return current

def propagate_slip(fixture: Dict, activity_id: str, slip_working_days: int) -> Dict:
    """
    Propagate a slip forward through successors using P6 data.
    Returns impact summary.
    """
    calendar = fixture['calendar']
    holidays = calendar['holidays']
    hours_per_day = fixture['project']['hours_per_day']
    
    # Find the activity
    activity = next(a for a in fixture['activities'] if a['id'] == activity_id)
    
    # Apply slip to activity's early finish
    original_finish = datetime.strptime(activity['early_finish'], '%Y-%m-%d')
    new_finish = add_working_days(original_finish, slip_working_days, calendar, holidays)
    
    # Float consumed (capped at available float)
    float_days = activity['total_float_hours'] / hours_per_day
    float_consumed = min(slip_working_days, float_days)
    remaining_float = max(0, float_days - slip_working_days)
    
    # Track impacted activities
    impacted = [{
        'id': activity_id,
        'name': activity['name'],
        'original_finish': activity['early_finish'],
        'new_finish': new_finish.strftime('%Y-%m-%d'),
        'slip_working_days': slip_working_days,
        'float_consumed': float_consumed,
        'remaining_float': remaining_float,
        'critical': activity['total_float_hours'] <= 0
    }]
    
    # Propagate to successors (simplified: assumes chain)
    propagated_delay = max(0, slip_working_days - float_days)
    
    for rel in fixture['relationships']:
        if rel['predecessor_id'] == activity_id:
            succ = next(a for a in fixture['activities'] if a['id'] == rel['successor_id'])
            if propagated_delay > 0:
                succ_float_days = succ['total_float_hours'] / hours_per_day
                succ_float_consumed = min(propagated_delay, succ_float_days)
                succ_remaining_float = max(0, succ_float_days - propagated_delay)
                
                impacted.append({
                    'id': succ['id'],
                    'name': succ['name'],
                    'slip_working_days': propagated_delay,
                    'float_consumed': succ_float_consumed,
                    'remaining_float': succ_remaining_float,
                    'critical': succ['total_float_hours'] <= 0 or succ_remaining_float <= 0
                })
                
                # Continue propagation if successor becomes critical
                if succ_remaining_float <= 0:
                    propagated_delay = max(0, propagated_delay - succ_float_days)
    
    # Compute project completion slip (max over impacted)
    completion_slip_days = max(
        max(0, imp['slip_working_days'] - (imp['float_consumed'] if not imp['critical'] else 0))
        for imp in impacted
    )
    
    # Convert to calendar days for $ computation if delay cost is per calendar day
    # For now, assume slip converts 1:1 for critical path days
    calendar_days_slip = completion_slip_days  # Simplified
    
    return {
        'impacted': impacted,
        'completion_slip_working_days': completion_slip_days,
        'completion_slip_calendar_days': calendar_days_slip,
        'dollar_impact': completion_slip_days * fixture['project']['daily_delay_cost_usd'] if completion_slip_days > 0 else 0
    }

def main():
    fixture = load_fixture()
    
    print("=" * 80)
    print("SITETECH WHAT-IF EXAMPLES - COMPUTED FROM FIXTURE")
    print("=" * 80)
    print()
    
    print("FIXTURE SUMMARY")
    print("-" * 80)
    print(f"Project: {fixture['project']['name']}")
    print(f"Data date: {fixture['data_date']}")
    print(f"Hours per day: {fixture['project']['hours_per_day']}")
    print(f"Daily delay cost: ${fixture['project']['daily_delay_cost_usd']:,} per {fixture['project']['delay_cost_unit']}")
    print(f"Calendar: {fixture['calendar']['name']}")
    print(f"Work days: {fixture['calendar']['work_days']} (1=Mon, 5=Fri)")
    print(f"Holidays: {', '.join(fixture['calendar']['holidays'])}")
    print()
    
    print("ACTIVITIES")
    print("-" * 80)
    for act in fixture['activities']:
        float_days = act['total_float_hours'] / fixture['project']['hours_per_day']
        print(f"{act['id']}: {act['name']}")
        print(f"  Early: {act['early_start']} to {act['early_finish']}")
        print(f"  Late:  {act['late_start']} to {act['late_finish']}")
        print(f"  Float: {float_days} days ({act['total_float_hours']} hrs)")
        print(f"  Critical: {act['total_float_hours'] <= 0}")
        print()
    
    print("EXAMPLE 1: L3 shaft framing slips 21 working days")
    print("-" * 80)
    result = propagate_slip(fixture, 'A2310', 21)
    print(f"Primary activity: A2310")
    for imp in result['impacted']:
        if imp['id'] == 'A2310':
            print(f"  Original finish: {imp['original_finish']}")
            print(f"  New finish: {imp['new_finish']}")
            print(f"  Slip: {imp['slip_working_days']} working days")
            print(f"  Float consumed: {imp['float_consumed']} days")
            print(f"  Remaining float: {imp['remaining_float']} days")
    print()
    print(f"Completion slip: {result['completion_slip_working_days']} working days")
    print(f"Dollar impact: ${result['dollar_impact']:,}")
    print()
    
    # Compute date math examples
    print("DATE MATH EXAMPLES")
    print("-" * 80)
    
    # Oct 15 + 21 working days
    oct15 = datetime.strptime('2026-10-15', '%Y-%m-%d')
    result_date = add_working_days(oct15, 21, fixture['calendar'], fixture['calendar']['holidays'])
    print(f"Oct 15 + 21 working days = {result_date.strftime('%b %d, %Y')}")
    
    # Oct 15 + 7 business days (for notice)
    result_notice = add_business_days(oct15, 7, fixture['calendar']['holidays'])
    print(f"Oct 15 + 7 business days = {result_notice.strftime('%b %d, %Y')}")
    
    # Nov 5 + 7 business days
    nov5 = datetime.strptime('2026-11-05', '%Y-%m-%d')
    result_nov = add_business_days(nov5, 7, fixture['calendar']['holidays'])
    print(f"Nov 5 + 7 business days = {result_nov.strftime('%b %d, %Y')}")
    
    print()
    
    print("TC6: Holiday spanning (Thanksgiving week)")
    print("-" * 80)
    # Slip by 10 working days where days 3-5 fall on Thu-Fri + weekend
    # Starting Oct 15, working days: Oct 15(W), 16(Th), 17(F), 20(M), 21(T), 22(W), 23(Th), 24(F), 27(M), 28(T)
    # But if we hit Nov 26-27 (Thanksgiving), those are skipped
    result_tc6 = add_working_days(oct15, 10, fixture['calendar'], fixture['calendar']['holidays'])
    calendar_days = (result_tc6 - oct15).days
    print(f"Oct 15 + 10 working days = {result_tc6.strftime('%b %d')} ({calendar_days} calendar days)")
    print()

if __name__ == '__main__':
    main()
