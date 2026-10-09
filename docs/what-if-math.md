# What-If Scenario Math Specification
**Owner:** Engineering + Product  
**Status:** Draft, Oct 9, 2026  
**Purpose:** Deterministic computation rules for Ask SiteTech scenario analysis ("what if the switchgear slips 3 more weeks"). All days, dollars, and notice deadlines are computed by code, not estimated by the model.

---

## Overview

The "what if" feature lets users ask plain-English schedule questions:
- "What if the switchgear slips 3 weeks?"
- "What happens if we delay the steel delivery?"
- "If the curtain wall is 10 days late, what's the impact?"

The system:
1. **Parses** the question into a structured scenario (activity id, slip days) using the model, with confirmation of the matched activity
2. **Computes** the impact using deterministic code: slip propagation through P6 dependencies, dollars, notice deadlines
3. **Explains** the result in plain language (model-generated, but constrained to cite code outputs)
4. **Drafts** any registered actions triggered by the scenario (e.g., outgoing delay notice, expedite request)

**Core principle:** The model only parses the question and explains the numbers. All numbers come from code.

**Slip unit:** Working days on the activity's P6 calendar. "Weeks" convert to 5 working days per week (Mon-Fri standard calendar).

---

## Input: Structured scenario

The model parses the user's plain-English question into a structured JSON scenario:

```json
{
  "activityId": "A2310",
  "activityName": "L3 shaft framing",
  "slipDays": 21,
  "confidence": "high",
  "matchReason": "Exact match on activity name 'shaft framing' and location 'L3'",
  "alternativeMatches": []
}
```

**Fields:**
- `activityId` (string): P6 or Procore schedule activity unique id
- `activityName` (string): Activity description from schedule
- `slipDays` (integer): Number of days to slip the activity finish date (positive = delay, negative = accelerate)
- `confidence` (enum): `"high"`, `"medium"`, `"low"` – model's confidence in the activity match
- `matchReason` (string): Human-readable explanation of why this activity was matched (for user confirmation)
- `alternativeMatches` (array of objects, optional): Up to 3 alternative activities if confidence < high, each with `{ activityId, activityName, matchReason }`

### Confidence and confirmation rules

**The confidence enum (`high`, `medium`, `low`) is internal.** The user only sees the Confirm chip or picker, never the confidence score itself.

| Internal confidence | UI behavior |
|---|---|
| **high** | Proceed immediately with computation; show activity name + confirm chip ("Is this the right activity? Yes / No") |
| **medium** | Show top match + alternatives (up to 3) in a picker; user selects before computation |
| **low** | Show "I found these activities that might match: [list]. Which one?" – user must pick or rephrase |

**If the user says "No" to a high-confidence match:** fall back to medium behavior (show alternatives).

**If no activity matches:** "I couldn't find an activity matching '[user's query]'. Try searching by activity ID or a more specific name."

**Activity matching rules:** Normalize case, spaces, and hyphens before matching ("curtainwall" = "curtain wall" = "curtain-wall"). Support both activity name substring match and exact ID match. Always confirm the matched activity with a Confirm chip or picker.

---

## Data requirements

**Current state (on main branch):**
- `schedule_activities.predecessors` is `text[]`, which cannot hold relationship type or lag
- No `calendars` table, no `calendar_id` on activities
- No `remaining_duration_hrs`, `original_duration_hrs`, `actual_start`, `actual_finish` fields
- P6 float is stored in hours in `total_float_hours`; converting to days requires `hours_per_day` (typically 8)

**Proposed schema changes for M2:**

### schedule_relationships table (new)
```sql
CREATE TABLE schedule_relationships (
  id UUID PRIMARY KEY,
  schedule_snapshot_id UUID REFERENCES schedule_snapshots(id),
  predecessor_id TEXT REFERENCES schedule_activities(activity_id),
  successor_id TEXT REFERENCES schedule_activities(activity_id),
  type TEXT CHECK (type IN ('FS', 'SS', 'FF', 'SF')),
  lag_hours INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Alternative:** store as `jsonb` in schedule_activities:
```sql
ALTER TABLE schedule_activities ADD COLUMN relationships jsonb;
-- Format: [{"pred_id": "A100", "type": "FS", "lag_hrs": 0}, ...]
```

### schedule_calendars table (new)
```sql
CREATE TABLE schedule_calendars (
  id UUID PRIMARY KEY,
  schedule_snapshot_id UUID REFERENCES schedule_snapshots(id),
  calendar_id TEXT,
  calendar_name TEXT,
  work_days INTEGER[] CHECK (ALL(work_days BETWEEN 1 AND 7)), -- 1=Mon, 7=Sun
  holidays DATE[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### schedule_activities additional fields
```sql
ALTER TABLE schedule_activities
  ADD COLUMN calendar_id TEXT,
  ADD COLUMN remaining_duration_hrs INTEGER,
  ADD COLUMN original_duration_hrs INTEGER,
  ADD COLUMN actual_start DATE,
  ADD COLUMN actual_finish DATE,
  ADD COLUMN driving_path BOOLEAN DEFAULT FALSE;
```

### Delay cost configuration
**Current:** `projects.daily_delay_cost_usd` (assumed per calendar day)

**Proposed:** Add `delay_cost_unit` to clarify:
```sql
ALTER TABLE projects ADD COLUMN delay_cost_unit TEXT DEFAULT 'calendar_day' CHECK (delay_cost_unit IN ('calendar_day', 'working_day'));
```

**If delay cost is per calendar day:** slip propagation (in working days) must be converted to calendar days for $ computation. Conversion: count calendar days between original completion and new completion, accounting for non-working days.

**Source tables:**
- `delay_costs` or `project_settings` (future; today it's `projects.daily_delay_cost_usd`)
- Notice periods: `contract_notice_periods` keyed on `(contract_kind, counterparty_name, notice_type)`

---

## Computation: slip propagation + dollars + notice deadline

All computation is deterministic code over the latest successful P6 XER snapshot. No model estimates. **V1 is P6 XER only.**

### 1. Slip propagation (NOT a schedule engine)

**CTO guardrail: We are NOT building a schedule engine.** Float and dates come straight from the P6 XER file. What-if pushes a slip forward through successor activities using P6's dependencies (FS, SS, FF), lags, and calendars. The result is labeled **"estimate, confirm in P6"**. Constraints and resource leveling stay in P6.

**Critical status:** Taken from P6 XER (total_float ≤ 0, or the XER's driving/longest-path flag if present).

**Completion slip:** `max over impacted activities of max(0, propagated delay − P6 total float in days)`

**Goal:** Compute the impact of slipping an activity by N working days on:
- The activity's finish date (accounting for P6 working calendar + holidays)
- Float consumed (from P6's total_float field, converted from hours using hours_per_day)
- Successor activities' start/finish dates (propagated via P6 relationships)
- Project completion date (if slip exceeds available float on any path to completion)

**Algorithm (forward slip propagation):**

1. **Load the latest successful P6 XER snapshot:** Use P6's calculated float values (total_float in hours), calendars, and relationships. Convert float to days using project's hours_per_day setting.
2. **Identify the activity:** by `activityId` from the scenario input
3. **Apply the slip:**
   - New finish date = original early finish + `slipDays` working days (per activity's P6 calendar: skip non-working days, project holidays)
   - **For in-progress activities:** use P6's remaining_duration from the data date, not original finish
4. **Propagate to successors:** for each P6 relationship:
   - **FS (finish-to-start):** Successor's new early start = max(successor's original early start, activity's new finish + lag + 1 working day). **Note:** The +1 working day is the FS convention (activity finishes Friday → successor starts Monday).
   - **SS (start-to-start):** Successor's new early start = max(original, activity's new start + lag)
   - **FF (finish-to-finish):** Successor's new early finish = max(original, activity's new finish + lag); back-calculate start from duration
   - **SF (start-to-finish, rare):** ⚠️ **Treat as FS and flag result "SF relationship detected, check in P6".** SF logic is complex; verify manually in P6.
   - If successor has multiple predecessors, take the latest (driving) constraint
   - Recurse through successors until no more delays propagate
5. **Compute float consumed:**
   - Float from P6's total_float (hours → days via hours_per_day)
   - Float consumed = min(propagated delay to this activity, P6 float)
   - Remaining float = max(0, P6 float − propagated delay)
   - Negative float (< 0 remaining) = activity slipped past its late finish, impacts completion
6. **Completion slip:** For all impacted activities, compute `max(0, propagated delay − P6 float)`. The maximum across all impacted activities is the project completion slip.
7. **Working calendar:** Use P6 calendar from XER + project holidays from settings. Skip non-working days when computing new dates.
8. **Label:** All results labeled **"estimate, confirm in P6"** (not a full recalculation).

**What this does NOT do (stays in P6):**
- Constraint checking (must-start, must-finish, SNET, FNLT, etc.)
- Resource leveling
- Baseline comparisons
- Activity splitting
- Recalculating total float (we use P6's values)

**Output (per activity impacted):**

```json
{
  "activityId": "A2310",
  "activityName": "L3 shaft framing",
  "originalEarlyFinish": "2026-10-15",
  "newEarlyFinish": "2026-11-13",
  "slipWorkingDays": 21,
  "floatConsumed": 3.0,
  "remainingFloat": 0,
  "onCriticalPath": false
}
```

**Test cases required:**
1. **Zero float (critical):** slip directly impacts completion
2. **Positive float:** slip absorbed by float, no completion impact
3. **Negative float:** activity already late; additional slip extends lateness
4. **Multi-path:** multiple successors; only critical path matters for completion
5. **Holiday spanning:** slip correctly skips non-working days per P6 calendar
6. **Shutdown period:** slip correctly uses P6 calendar non-work periods
7. **In-progress activity:** uses P6 remaining_duration from data date
8. **FS lag:** FS+5 is the driving relationship, lag preserved
9. **SS logic:** start-to-start propagation
10. **FF logic:** finish-to-finish propagation
11. **SF logic:** ⚠️ start-to-finish flagged "check in P6"

---

### 2. Dollars computation

**Formula:**  
`$ impact = (days on critical path) × (daily delay cost)`

**Rules:**
- **Daily delay cost** comes from project settings (GC general conditions + owner carry cost per day, entered by PX during onboarding)
- **No default:** if daily delay cost is not set, show "Set delay cost in settings to see $ impact" – never guess
- **Days on critical path:** only days that slip the project completion date count toward $
  - If the slip is absorbed by float (no critical path impact), $ impact = $0 (but show "X days of float consumed")
  - If the slip consumes float partially, only the days beyond float (negative float on the completion activity) count toward $

**Working days → Calendar days conversion:**
- The slip propagation algorithm operates in **working days** (per the project calendar)
- When `delay_cost_unit = "calendar_day"`, completion slip must be converted to **calendar days** before multiplying
- Conversion: count calendar days between original and new completion dates on the project calendar (including weekends and holidays)
- Both working days and calendar days are reported in the result

**Example (from computed fixture):**
- Activity A2310 slips 8 working days
- Float on A2310: 3 days
- Propagated delay to completion activity A3000: 2 working days (after absorbing float along the chain)
- Completion slip: 2 working days = 4 calendar days (counting calendar days between original Nov 19 and new Nov 23)
- $ impact: 4 calendar days × $12,000/calendar day = **$48,000**

**Output:**

```json
{
  "dollarImpact": 48000,
  "completionSlipWorkingDays": 2,
  "completionSlipCalendarDays": 4,
  "dailyDelayCost": 12000,
  "dailyDelayCostUnit": "calendar_day",
  "dailyDelayCostSource": "project_settings"
}
```

**Edge cases:**
- **Activity not on critical path, slip absorbed by float:** `dollarImpact = 0`, `completionSlipWorkingDays = 0`, `completionSlipCalendarDays = 0`
- **Activity on critical path (zero float):** `dollarImpact = completionSlipCalendarDays × dailyDelayCost` (or working days if `delay_cost_unit = "working_day"`)
- **Daily delay cost not set:** `dollarImpact = null`, `dailyDelayCost = null`, `dailyDelayCostSource = "not_configured"`

---

### 3. Notice deadline computation

**Formula:**  
`Notice deadline = event date + notice period`

**Rules:**
- **Notice period** comes from project settings (configured per notice type: delay/time, cost/change claim, differing site condition, change directive dispute, cure notice, injury/property damage)
- **Calendar vs. business days:** project setting per notice type
  - Calendar days: count every day including weekends/holidays
  - Business days: skip weekends + observed holidays (from project settings)
- **No default:** if notice period is not configured for the notice type, show "Notice period not configured for [type], confirm deadline" – never guess
- **Time zone:** project time zone (from settings) for date calculations

**Output:**

```json
{
  "noticeType": "delay_time_extension",
  "eventDate": "2026-10-15",
  "noticePeriodDays": 7,
  "calendarOrBusiness": "business",
  "noticeDeadline": "2026-10-26",
  "deadlineSource": "project_settings_contract_section_8.3"
}
```

**Edge cases:**
- **Deadline falls on weekend/holiday (business days):** advance to next business day
- **Deadline falls on weekend/holiday (calendar days):** deadline is that day (no adjustment)
- **Notice period not configured:** `noticeDeadline = null`, `deadlineSource = "not_configured"`
- **Urgent notice (< 2 business days):** handled by action routing (A6 escalates from PM to PX same day if deadline < 2 business days from response requirement)
- **Deadline has already passed:** Card text must be exactly: "Deadline per project settings was \<date\>; confirm with PX". Must not draw any legal conclusion (no "waived", "defaulted", "forfeited", etc.).

---

## Output: What-if result JSON

The computation returns a structured result that the model uses to generate a plain-English explanation:

```json
{
  "scenario": {
    "activityId": "A2310",
    "activityName": "L3 shaft framing",
    "slipWorkingDays": 21
  },
  "impacts": {
    "primaryActivity": {
      "activityId": "A2310",
      "activityName": "L3 shaft framing",
      "originalEarlyFinish": "2026-10-22",
      "newEarlyFinish": "2026-11-20",
      "slipWorkingDays": 21,
      "floatConsumed": 3.0,
      "remainingFloat": -18.0,
      "onCriticalPath": true
    },
    "successors": [
      {
        "activityId": "A2320",
        "activityName": "L3 MEP rough-in",
        "propagatedDelay": 18.0,
        "p6TotalFloat": 3.0,
        "resultingFloat": -15.0,
        "onCriticalPath": true
      },
      {
        "activityId": "A3000",
        "activityName": "Exterior envelope closeout",
        "propagatedDelay": 15.0,
        "p6TotalFloat": 0.0,
        "resultingFloat": -15.0,
        "onCriticalPath": true
      }
    ],
    "projectCompletion": {
      "originalDate": "2026-11-19",
      "newDate": "2026-12-14",
      "slipWorkingDays": 15,
      "slipCalendarDays": 25
    }
  },
  "dollars": {
    "dollarImpact": 300000,
    "completionSlipWorkingDays": 15,
    "completionSlipCalendarDays": 25,
    "dailyDelayCost": 12000,
    "dailyDelayCostUnit": "calendar_day",
    "dailyDelayCostSource": "project_settings"
  },
  "notices": [
    {
      "noticeType": "delay_time_extension",
      "noticeInfo": "If this happens: notice period per settings is 7 business days (§8.3), deadline Dec 3. Confirm with PX.",
      "eventDate": "2026-11-20",
      "noticePeriodDays": 7,
      "calendarOrBusiness": "business",
      "noticeDeadline": "2026-12-03",
      "deadlineSource": "project_settings_contract_section_8.3"
    }
  ],
  "suggestedActions": [
    {
      "actionId": "schedule-slip-recovery",
      "actionName": "Vendor slip recovery options",
      "targetActivityId": "A2310",
      "reason": "Activity slips and consumes float"
    },
    {
      "actionId": "outgoing-delay-notice",
      "actionName": "Outgoing delay notice to owner (A11)",
      "targetActivityId": null,
      "reason": "Project completion slips by 25 calendar days, triggering delay notice requirement"
    }
  ],
  "sourceData": {
    "scheduleSnapshot": "P6_XER_2026-10-08_05-12",
    "scheduleDataDate": "2026-10-08",
    "projectSettings": "project_12345_settings_v3",
    "computedAt": "2026-10-09T18:27:42Z"
  },
  "estimateLabel": "estimate, confirm in P6"
}
```

### JSON schema summary

**Top-level:**
- `scenario` (object): echoes the input scenario (activityId, activityName, slipWorkingDays)
- `impacts` (object): computation results
  - `primaryActivity` (object): the activity the user asked about
  - `successors` (array of objects): impacted successor activities. **Ordering:** critical-path activities (remaining float ≤ 0) first, then rest ordered by least float (ascending).
  - `projectCompletion` (object): project finish date impact (slipWorkingDays and slipCalendarDays)
- `dollars` (object): $ impact breakdown (completionSlipWorkingDays, completionSlipCalendarDays, dollarImpact)
- `notices` (array of objects): triggered notice requirements (from contract notice periods)
- `suggestedActions` (array of objects): registered actions that would be triggered by this scenario (for drafting)
- `sourceData` (object): audit trail (schedule snapshot id, **schedule data date**, settings version, timestamp)
- **`estimateLabel`** (string): Always "estimate, confirm in P6" to remind users this is NOT a full schedule recalculation

---

## UI: Chart series and display rules

The what-if result is displayed as:
1. **Summary card** (top): activity name, slip days, float consumed, $ impact (bold, large), project completion impact
2. **Gantt-style timeline** (middle): original schedule (gray) vs. new schedule (red = critical path, yellow = float consumed) for the primary activity + key successors
3. **Action buttons** (bottom): draft suggested actions (if any)

### Chart series

**X-axis:** Time (dates), from 2 weeks before the primary activity's original start to 2 weeks after the latest impacted successor's new finish (or project completion)

**Y-axis:** Activities (rows), sorted by schedule order (earliest start first)

**Series:**
1. **Original schedule (gray bars):** early start to early finish for each activity (baseline or current schedule)
2. **New schedule (colored bars):**
   - Red: activities on the critical path (remaining float ≤ 0 after slip)
   - Yellow: activities with float consumed but not on critical path (remaining float > 0)
   - Green: activities not impacted (no slip)
3. **Float indicator (dotted line):** from new finish to late finish (shows remaining float)
4. **Today line (vertical):** current date
5. **Milestones (diamonds):** project completion (original vs. new)

**Labels:**
- Each bar: activity name, slip days (if > 0), remaining float
- Hover: full activity details (id, original dates, new dates, float consumed, $ impact if on critical path)
- **Result labeled:** All charts and outputs include the label **"estimate, confirm in P6"** to remind users this is NOT a full schedule recalculation

**Successor display:** Show the impacted activities. **Ordering:** critical-path activities (remaining float ≤ 0) first, then rest ordered by least float (ascending). Display all impacted successors in the propagation chain; if there are many, the UI can collapse/expand.

---

## Model explanation rules

The model generates a plain-English explanation of the what-if result, constrained to:
1. **Cite the source JSON:** every number must come from the `impacts`, `dollars`, or `notices` objects (no guessing)
2. **Structure:** (a) restate the scenario, (b) explain the primary impact, (c) mention key successors (up to 3), (d) state the $ impact and project completion impact, (e) list any triggered notices, (f) offer to draft suggested actions
3. **Tone:** direct, construction-professional, no jargon ("3 weeks" not "21 business days", "$ at risk" not "cost exposure")
4. **Banned wording:** waived, liable, breach, entitled (same as actions)
5. **Always show float:** "This slip consumes 21 days of float; 3 days remain" (helps users understand why $ impact may be $0)

**Example explanation (model-generated, but citing code):**

> If **L3 shaft framing** slips **15 working days** (3 weeks), here's what happens:
>
> - The activity finishes **Nov 12** instead of **Oct 22**, consuming its **3 days of float**. Resulting float: **-12 days** (now critical).
> - **L3 MEP rough-in** receives **12 working days** of propagated delay, consuming its **3 days of float**. Resulting float: **-9 days** (critical).
> - **Exterior envelope closeout** (already critical) receives **9 working days** of delay.
> - **Project completion** slips **9 working days = 15 calendar days** (from Nov 19 to Dec 4).
> - **$ impact: $180,000** (15 calendar days × $12,000/calendar day delay cost).
>
> **If this happens:** notice period per settings is 7 business days (§8.3), deadline Dec 1. Confirm with PX.
>
> **What would you like to do?**
> - Review outgoing delay notice requirements (A11)
> - See recovery options for L3 shaft framing
> - Show me the propagation chain

**Confirmation prompt (always included):**
> Is **L3 shaft framing** (activity A2310) the right activity? [Yes] [No, show alternatives]

---

## Citation rules (every number on screen must cite its source)

Every number displayed in the what-if result must include a citation (tap to see source):
- **Float days consumed:** cites the schedule snapshot + schedule data date + P6's calculated float values (shows original float from P6, slip propagated, remaining float)
- **$ impact:** cites the daily delay cost (from project settings, line item) + critical path slip days (from schedule impact walk) + schedule data date
- **Notice deadline:** cites the contract notice period (from project settings, contract section) + event date + business day calculation log
- **Project completion date:** cites the schedule snapshot + schedule data date + critical path slip propagation
- **Successor impacts:** cites the successor logic (from schedule: predecessor, lag, relationship type FS/SS/FF) + slip propagation + schedule data date

**All citations include:**
- The schedule snapshot's data date (the "as of" date for all schedule data)
- The reminder: "estimate, confirm in P6"

**Example citation card (shown on tap):**

> **$ impact: $312,000**
>
> **Source:**  
> - Critical path slip: 26 days (from schedule impact walk, P6 XER snapshot P6_XER_2026-10-08_05-12)
> - Schedule data date: Oct 8, 2026
> - Daily delay cost: $12,000/calendar day (from project settings)
> - Computation: 26 days × $12,000/day = $312,000
> - **Note:** This is an estimate. Confirm in P6 (constraints and resource leveling not applied).
>
> [View schedule snapshot] [View project settings]

**Citation links (PM):** Link to the schedule snapshot summary for M2. Direct deep-links to Procore activities or P6 web UI rows are desirable for M3 but require deep-link support from those tools.

---

## Test cases required (deterministic correctness)

Each test case includes:
1. **Input:** scenario (activityId, slipDays) + schedule fixture (P6 XER or Procore JSON) + project settings (daily delay cost, holidays, notice periods)
2. **Expected output:** impacts (primaryActivity, successors, projectCompletion), dollars, notices (all fields)
3. **Assertion:** computed output matches expected output exactly (no tolerance; deterministic)

### Test case list (minimum for M2)

| Test | Scenario | Expected result |
|---|---|---|
| **TC1: Zero float (critical path)** | Slip critical path activity A3000 (float = 0) by 10 working days | Completion slip: 10 working days = 18 calendar days. $ impact = 18 calendar days × $12,000/calendar day = **$216,000**. |
| **TC2: Positive float** | Slip activity A2310 (3 days float) by 2 working days | Activity finish slips 2 working days; float consumed = 2 days; remaining float = 1 day; completion slip = 0; $ impact = $0 |
| **TC3: Float exhausted** | Slip activity A2310 (3 days float) by 8 working days | Resulting float = -5 days. Completion slip = 2 working days = 4 calendar days. $ impact = 4 calendar days × $12,000/calendar day = **$48,000**. |
| **TC4: Negative float** | Slip a critical path activity by 10 working days | Completion slip = 10 working days = (convert to calendar days on project calendar). $ impact = (calendar days) × $12,000/calendar day. |
| **TC5: Multi-path** | Slip an activity with 2 successors: one on critical path (float = 0), one with float = 15 days | Only the critical path successor impacts project completion; $ impact based on critical path slip only |
| **TC6: Holiday spanning** | Slip Nov 18 by 10 working days, spanning Thanksgiving holidays (Nov 26-27) | New finish = Dec 4 (16 calendar days from Nov 18). Working days: Nov 19, Nov 20, Nov 23, Nov 24, Nov 25, Nov 30, Dec 01, Dec 02, Dec 03, Dec 04 (10 working days). |
| **TC7: Shutdown period** | Slip an activity by 10 working days spanning winter shutdown (Dec 24-25, Dec 31-Jan 1) per P6 calendar | New finish accounts for shutdown days per P6 calendar; 10 working days = more calendar days due to holidays |
| **TC8: In-progress activity** | Slip an in-progress activity (data date Oct 8, remaining duration 7 working days from P6, planned finish Oct 15) by 5 working days | Uses P6 remaining_duration from data date (Oct 8 + 7 working days = Oct 15); new finish = Oct 22 (5 working days from Oct 15); successors slip accordingly |
| **TC9: FS lag** | Slip an activity by 10 working days; **FS+5 is the driving relationship** to successor | Successor start slips by 10 working days (FS+5 lag is preserved, FS+5 is driving); project completion slips if successor is on critical path |
| **TC10: SS logic** | Slip an activity with start-to-start (SS) successor logic by 10 working days | Successor start slips by 10 working days (or slip + lag if SS+lag); verify propagation |
| **TC11: FF logic** | Slip an activity with finish-to-finish (FF) successor logic by 10 working days | Successor finish slips by 10 working days (or slip + lag if FF+lag); verify back-calculation of start |
| **TC12: SF logic** | Slip an activity with start-to-finish (SF) successor logic | ⚠️ Treated as FS; result flagged "SF relationship detected, check in P6" |
| **TC13: Daily delay cost not set** | Slip a critical path activity by 10 working days, daily delay cost = null in settings | Completion slip: 10 working days = (calendar days). $ impact = null. UI shows "Set delay cost to see $ impact". |
| **TC14: Notice triggered** | Slip causes project completion to slip, triggering delay notice requirement per contract settings | `notices` array includes delay_time_extension with noticeInfo: "If this happens: notice period per settings is 7 business days (§8.3), deadline [date]. Confirm with PX." |
| **TC15: Notice deadline passed** | Slip causes project completion to slip, and notice deadline (computed from settings) has already passed (deadline < today) | Card text exactly: "Deadline per project settings was \<date\>; confirm with PX". No legal conclusions (no "waived", "defaulted", etc.). |
| **TC16: No successors** | Slip an activity with no successors (end of a path, not on critical path) | Activity finish slips; float consumed; no impact on project completion; $ impact = $0 |
| **TC17: Accelerate (negative slip)** | Slip an activity by -5 working days (acceleration) | Activity finish moves earlier; successors' early start may move earlier if this is the driving predecessor; float increases; **days recovered reported** (no $ savings computed) |

---

## Performance requirements

- **Computation time:** < 500ms for a scenario with up to 5,000 activities (typical P6 project)
- **Successor depth:** walk up to 100 levels deep (typical max for construction schedules)
- **UI render time:** < 1s to show the summary card + chart after computation completes
- **Concurrent requests:** support 10 concurrent what-if scenarios per project (users exploring different options)
- **Caching (PM):** Not needed for M2; 500ms is fast enough. May revisit for M3 if performance requires it.

---

## Open questions

**Most OPEN items have been resolved as of Oct 9, 2026 (PM answers in PR #17 comments + CTO guardrail).** The following have been answered and incorporated into the spec above:

1. ✅ **Relationship types (PM):** Support FS, SS, FF with lags in M2 (from P6 XER). SF (start-to-finish, rare) is treated as FS with "check in P6" flag.
2. ✅ **Shutdown periods (PM):** Use P6 calendars in the XER (they carry non-work periods) plus project holidays from settings. No separate manual calendar for M2.
3. ✅ **Activity matching (PM):** Normalize case, spaces, and hyphens ("curtainwall" = "curtain wall"). Confidence enum stays internal; user only sees Confirm chip or picker.
4. ✅ **Successor display (PM):** Show impacted activities. Successors ordered: critical-path activities first, then rest by least float (ascending).
5. ✅ **Citation links (PM):** Link to schedule snapshot summary for M2. Direct deep-links to Procore/P6 desirable for M3 but require tool support. Every citation shows the schedule snapshot's data date.
6. ✅ **Acceleration savings (PM):** Do not compute $ savings for acceleration (negative slip). Delay impact only. (Savings are less common and harder to justify; delay impact is the primary use case.)
7. ✅ **Cache results (PM):** Not needed for M2; 500ms is fast enough. May revisit for M3.
8. ✅ **Notice threshold (PM):** Handled by action routing. A6 escalates to PX same day if deadline < 2 business days.
9. ✅ **CTO guardrail applied:** We are NOT building a schedule engine. Float and dates come from P6 file; what-if pushes slips forward using P6 dependencies, lags, and calendars. Constraints and resource leveling stay in P6. Result labeled "estimate, confirm in P6".

**One remaining consideration for M3 (not blocking M2):**
- **Default lead time for what-if scenarios:** Related to A2 action – should what-if scenarios use a default lead time if not specified per activity, or always require explicit lead time? (Always require is safer for M2; default may be useful for M3 exploration.)

**No blocking OPEN items for M2.** All computation rules are deterministic and testable.

---

## Version history

- **v1.0 (Oct 9, 2026, 14:00 UTC):** Initial spec for M2. Open questions noted inline.
- **v1.1 (Oct 9, 2026, 18:07 UTC):** PM resolved 9 OPEN questions. Applied CTO guardrail (NOT building schedule engine).
- **v1.2 (Oct 9, 2026, 18:14 UTC):** Lead review at 1966299 (first round). Renamed "slip propagation". Added Data requirements section. P6 XER only. Fixed FS+1 convention, SF flag, notice deadline calculation. Created fixture and compute script.
- **v1.3 (Oct 9, 2026, 19:45 UTC, IN PROGRESS):** Lead review at 1537ca8 (second round). Rebuilt fixture with contiguous activities (A2310 → A2320 → A3000, no gap). Fixed propagate_slip to honor shared float along paths. Added Jul 5, 2027 holiday. Updated all examples and test cases with computed numbers. Fixed working→calendar day $ conversion. Removed CPM references. Fixed "3 weeks" = 15 working days. TC6 working-day list corrected. **REMAINING:** Data requirements (match main migration), Due/escalation fields on A1/A2/A4/A5/A7/A8, tier enum fixes, A6 escalation fix, A4 email mode fix, requires_procore on all actions, party enum (gc_vendor OPEN), cure_default display label.
