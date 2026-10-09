#!/usr/bin/env python3
"""
SiteTech what-if math: reproducible computation from fixture.json

Counting rule: Day 1 is the first working day AFTER the start date.
The start date itself is not counted.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

def load_fixture():
    with open('fixture.json', 'r') as f:
        return json.load(f)

def is_working_day(date: datetime, calendar: Dict, holidays: List[str]) -> bool:
    """Check if date is a working day per calendar."""
    if date.strftime('%Y-%m-%d') in holidays:
        return False
    # weekday(): Monday=0, Sunday=6; calendar work_days: Monday=1, Sunday=7
    weekday = date.weekday() + 1
    if weekday == 7:
        weekday = 0  # Sunday
    return weekday in calendar['work_days']

def add_working_days(start: datetime, days: int, calendar: Dict, holidays: List[str]) -> datetime:
    """
    Add working days to a start date.
    Day 1 is the first working day AFTER start. Start date is not counted.
    """
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if is_working_day(current, calendar, holidays):
            added += 1
    return current

def add_business_days(start: datetime, days: int, holidays: List[str]) -> datetime:
    """
    Add business days (Mon-Fri excluding holidays) to start date.
    Used for notice deadline calculations.
    Day 1 is the first business day AFTER start.
    """
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5 and current.strftime('%Y-%m-%d') not in holidays:
            added += 1
    return current

def count_calendar_days(start: datetime, end: datetime) -> int:
    """Count calendar days between two dates (end - start, inclusive)."""
    return (end - start).days

def propagate_slip(fixture: Dict, activity_id: str, slip_working_days: int) -> Dict:
    """
    Propagate a slip forward through successors using P6 FS/SS/FF logic.
    Total float is shared along a path - we track the cumulative delay
    and remaining float at each activity.
    
    Returns impact summary with working→calendar day conversion for $.
    """
    calendar = fixture['calendar']
    holidays = calendar['holidays']
    hours_per_day = fixture['project']['hours_per_day']
    
    # Build activity and relationship lookups
    activities = {a['id']: a for a in fixture['activities']}
    successors_by_pred = {}
    for rel in fixture['relationships']:
        pred = rel['predecessor_id']
        if pred not in successors_by_pred:
            successors_by_pred[pred] = []
        successors_by_pred[pred].append(rel)
    
    # Find project completion activity (driving_path=True or zero float)
    completion_activity = next((a for a in fixture['activities'] 
                                if a.get('driving_path') or a['total_float_days'] == 0), 
                               fixture['activities'][-1])
    
    # Track impacted activities
    impacted = []
    
    # Queue: (activity_id, delay_working_days)
    queue = [(activity_id, slip_working_days)]
    visited = set()
    
    while queue:
        current_id, current_delay = queue.pop(0)
        if current_id in visited:
            continue
        visited.add(current_id)
        
        activity = activities[current_id]
        float_days = activity['total_float_days']
        
        # Remaining float after this delay
        resulting_float = float_days - current_delay
        
        # Record impact
        original_finish = datetime.strptime(activity['early_finish'], '%Y-%m-%d')
        new_finish = add_working_days(original_finish, current_delay, calendar, holidays)
        
        impacted.append({
            'id': current_id,
            'name': activity['name'],
            'original_finish': activity['early_finish'],
            'new_finish': new_finish.strftime('%Y-%m-%d'),
            'propagated_delay_working_days': current_delay,
            'p6_total_float_days': float_days,
            'resulting_float_days': resulting_float,
            'on_critical_path': resulting_float <= 0
        })
        
        # Propagate to successors
        if current_id in successors_by_pred:
            for rel in successors_by_pred[current_id]:
                succ_id = rel['successor_id']
                rel_type = rel['type']
                lag_days = rel['lag_hours'] / hours_per_day if hours_per_day > 0 else 0
                
                if rel_type == 'FS':
                    # Finish-to-start: successor starts when predecessor finishes + lag
                    # Delay propagates forward only if we've consumed all predecessor float
                    propagated = max(0, current_delay - float_days)
                    queue.append((succ_id, propagated))
                elif rel_type == 'SS':
                    # Start-to-start: delay propagates to successor start
                    propagated = max(0, current_delay - float_days)
                    queue.append((succ_id, propagated))
                elif rel_type == 'FF':
                    # Finish-to-finish: delay propagates to successor finish
                    propagated = max(0, current_delay - float_days)
                    queue.append((succ_id, propagated))
                elif rel_type == 'SF':
                    # Start-to-finish: warn and treat as FS
                    propagated = max(0, current_delay - float_days)
                    queue.append((succ_id, propagated))
    
    # Find completion slip from the completion activity
    completion_impact = next((imp for imp in impacted if imp['id'] == completion_activity['id']), None)
    
    if completion_impact and completion_impact['resulting_float_days'] < 0:
        # Completion slips by the amount of negative float
        completion_slip_working_days = abs(completion_impact['resulting_float_days'])
        
        # Convert to calendar days
        original_completion = datetime.strptime(completion_activity['early_finish'], '%Y-%m-%d')
        new_completion = add_working_days(original_completion, int(completion_slip_working_days), 
                                         calendar, holidays)
        completion_slip_calendar_days = count_calendar_days(original_completion, new_completion)
        
        dollar_impact = completion_slip_calendar_days * fixture['project']['daily_delay_cost_usd']
    else:
        completion_slip_working_days = 0
        completion_slip_calendar_days = 0
        dollar_impact = 0
    
    return {
        'impacted': impacted,
        'completion_slip_working_days': completion_slip_working_days,
        'completion_slip_calendar_days': completion_slip_calendar_days,
        'dollar_impact': dollar_impact,
        'completion_activity': completion_activity['id']
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
    for activity in fixture['activities']:
        print(f"{activity['id']}: {activity['name']}")
        print(f"  Early: {activity['early_start']} to {activity['early_finish']}")
        print(f"  Late:  {activity['late_start']} to {activity['late_finish']}")
        print(f"  Float: {activity['total_float_days']} days")
        print(f"  Critical: {activity.get('driving_path', False)}")
        print()
    
    print("EXAMPLE 1: L3 shaft framing slips 21 working days")
    print("-" * 80)
    result = propagate_slip(fixture, 'A2310', 21)
    
    primary = result['impacted'][0]
    print(f"Primary activity: {primary['id']}")
    print(f"  Original finish: {primary['original_finish']}")
    print(f"  New finish: {primary['new_finish']}")
    print(f"  Slip: {primary['propagated_delay_working_days']} working days")
    print(f"  P6 total float: {primary['p6_total_float_days']} days")
    print(f"  Resulting float: {primary['resulting_float_days']} days")
    print()
    
    print("PROPAGATION CHAIN:")
    for imp in result['impacted']:
        print(f"  {imp['id']}: {imp['name']}")
        print(f"    Propagated delay: {imp['propagated_delay_working_days']} working days")
        print(f"    P6 total float: {imp['p6_total_float_days']} days")
        print(f"    Resulting float: {imp['resulting_float_days']} days")
        print(f"    On critical path: {imp['on_critical_path']}")
    print()
    
    print(f"Completion activity: {result['completion_activity']}")
    print(f"Completion slip: {result['completion_slip_working_days']} working days = {result['completion_slip_calendar_days']} calendar days")
    print(f"Dollar impact: {result['completion_slip_working_days']} working days → {result['completion_slip_calendar_days']} calendar days × ${fixture['project']['daily_delay_cost_usd']:,}/calendar day = ${result['dollar_impact']:,}")
    print()
    
    # Date math examples
    print("DATE MATH EXAMPLES")
    print("-" * 80)
    
    # Oct 22 + 21 working days
    oct22 = datetime.strptime('2026-10-22', '%Y-%m-%d')
    result_date = add_working_days(oct22, 21, fixture['calendar'], fixture['calendar']['holidays'])
    print(f"Oct 22 + 21 working days = {result_date.strftime('%b %d, %Y')}")
    
    # Oct 22 + 7 business days (notice)
    result_notice = add_business_days(oct22, 7, fixture['calendar']['holidays'])
    print(f"Oct 22 + 7 business days = {result_notice.strftime('%b %d, %Y')}")
    
    # Nov 13 + 7 business days
    nov13 = datetime.strptime('2026-11-13', '%Y-%m-%d')
    result_nov = add_business_days(nov13, 7, fixture['calendar']['holidays'])
    print(f"Nov 13 + 7 business days = {result_nov.strftime('%b %d, %Y')}")
    print()
    
    # TC6: Holiday spanning
    print("TC6: Holiday spanning (Thanksgiving Nov 26-27)")
    print("-" * 80)
    nov18 = datetime.strptime('2026-11-18', '%Y-%m-%d')
    result_tc6 = add_working_days(nov18, 10, fixture['calendar'], fixture['calendar']['holidays'])
    calendar_days_tc6 = count_calendar_days(nov18, result_tc6)
    print(f"Nov 18 + 10 working days = {result_tc6.strftime('%b %d')} ({calendar_days_tc6} calendar days)")
    
    # Enumerate working days for TC6
    print(f"  Working days: ", end="")
    current = nov18
    count = 0
    days_list = []
    while count < 10:
        current += timedelta(days=1)
        if is_working_day(current, fixture['calendar'], fixture['calendar']['holidays']):
            count += 1
            days_list.append(f"{current.strftime('%b %d')}")
    print(", ".join(days_list))
    print()
    
    # Test critical path slip (10 working days on critical activity)
    print("TC1: Critical path activity slips 10 working days")
    print("-" * 80)
    result_tc1 = propagate_slip(fixture, 'A3000', 10)
    print(f"Completion slip: {result_tc1['completion_slip_working_days']} working days = {result_tc1['completion_slip_calendar_days']} calendar days")
    print(f"Dollar impact: ${result_tc1['dollar_impact']:,}")
    print()
    
    # Test positive float (slip within float)
    print("TC2: Activity with 3 days float slips 2 working days")
    print("-" * 80)
    result_tc2 = propagate_slip(fixture, 'A2310', 2)
    tc2_primary = result_tc2['impacted'][0]
    print(f"Float consumed: {tc2_primary['propagated_delay_working_days']} days")
    print(f"Remaining float: {tc2_primary['resulting_float_days']} days")
    print(f"Completion slip: {result_tc2['completion_slip_working_days']} working days")
    print(f"Dollar impact: ${result_tc2['dollar_impact']:,}")
    print()
    
    # Test float exhausted
    print("TC3: Activity with 3 days float slips 8 working days")
    print("-" * 80)
    result_tc3 = propagate_slip(fixture, 'A2310', 8)
    tc3_primary = result_tc3['impacted'][0]
    print(f"Primary activity resulting float: {tc3_primary['resulting_float_days']} days")
    print(f"Completion slip: {result_tc3['completion_slip_working_days']} working days = {result_tc3['completion_slip_calendar_days']} calendar days")
    print(f"Dollar impact: ${result_tc3['dollar_impact']:,}")
    print()

if __name__ == '__main__':
    main()
