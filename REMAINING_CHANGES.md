# REMAINING CHANGES FOR what-if-math.md

## BLOCKER #2: Fix all examples with computed numbers
- Oct 15 + 21 working days = Nov 13, 2026 (not Nov 5)
- 21-day slip with 3 days float = 18 days completion slip (not 26)
- $ impact = $216,000 (18 × $12k), not $312k
- Successor float should be negative (exhausted), not 0
- Notice dates: Oct 15 + 7 business = Oct 26 (Mon), Nov 5 + 7 = Nov 16 (Mon)
- TC6: 10 working days = 14 calendar days (not 16)
- TC8: WIP uses remaining duration from data date
- Remove "drives the exterior envelope closeout" (not in JSON)

## BLOCKER #3: Remove CPM, use P6 critical status
- Rename "CPM float walk" to "slip propagation" throughout
- Critical status from P6 (total float ≤ 0 or XER driving flag)
- Completion slip = max over impacted of max(0, propagated delay - P6 total float)
- Remove "compute the critical path (longest path)"
- P6 XER only, drop "or Procore schedule" everywhere

## BLOCKER #4: Add Data requirements section
- schedule_activities.predecessors is text[], can't hold type or lag
- No calendars table, calendar_id, remaining/original duration, actual start/finish
- P6 float stored in hours (needs hours_per_day conversion)
- Propose: relationships as jsonb [{pred_id, type, lag_hrs}] or schedule_relationships table
- Propose: schedule_calendars table
- Propose: activity fields for remaining_duration_hrs, original_duration_hrs, actual_start, actual_finish
- State delay-cost unit: if per calendar day, slip must convert to calendar days
- Source: delay_costs/project_settings; today projects.daily_delay_cost_usd

## BLOCKER #5: Remove A6 from what-if suggestions, add A11
- Change "Delay notice to owner" to use A11 (outgoing-delay-notice)
- Remove "> 10 day threshold" (invented)
- Show: "If this happens: notice period per settings is 7 business days (§8.3), deadline Nov 16. Confirm with PX."
- What-if creates cards only when user taps

## BLOCKER #12: PM decisions clarifications
- Successors show "impacted activities, critical first, then least float" (not "10 immediate")
- Acceleration reports "days recovered only" (not $ savings)
- No caching: "use latest successful snapshot and show which one"
- Passed deadline: exact wording "Deadline per project settings was <date>; confirm with PX"
- Resolve "< 3 days" vs "< 2 business days" → < 2 business days

## NITS
- Say whether A1/A2 windows are calendar or working days
- State FS+1 convention once prominently
- Make SF "check in P6" flag prominent
- Update version history

FILES CREATED:
- docs/what-if-examples/fixture.json
- docs/what-if-examples/compute.py
